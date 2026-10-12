"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A line-for-line port of VoiceStudio's Smart Fit planner for one segment:
// backend/services/fit_planner.py, `_fit_one` and the overflow check in
// `plan_fit`, with the defaults of `FitParams` (commit 7703ca66):
//   max_audio_only_rate 1.2   audio-only speed-up "imperceptible up to ~1.2x"
//   audio_rate_cap      1.5   "the intelligibility cap"
//   video_slow_cap      2.0   "the limit before motion looks syrupy"
//   min_audio_rate      0.85  underrun fill floor
//   UNDERRUN_TOLERANCE  0.95  slots filled to within this are left alone
//   MAX_AUDIO_RATE_HARD 1.8   audio-only ceiling when video retiming is off
// The planner labels leftover speech "overflow_trimmed", but the caller
// (api/routers/dub_generate.py ~L1691) refuses to publish a track whose fitted
// audio runs more than 20 ms past its new slot, so overflow stops the render.
// `need` is natural TTS duration / slot, where the slot already includes the
// silence borrowed from the gap before the next line (minus a 50 ms guard).
const MAX_AUDIO_ONLY = 1.2
const AUDIO_CAP = 1.5
const VIDEO_CAP = 2.0
const MIN_AUDIO = 0.85
const UNDERRUN_TOL = 0.95
const HARD_AUDIO = 1.8
const EPS = 1e-9

type Status = "fits" | "audio_slowed" | "audio_stretched" | "hybrid" | "overflow_trimmed"

function fitOne(need: number, allowVideo: boolean): { audio: number; video: number; status: Status } {
  if (need <= 1 + EPS) {
    if (need > EPS && need < UNDERRUN_TOL && MIN_AUDIO < 1 - EPS) {
      return { audio: Math.max(need, MIN_AUDIO), video: 1, status: "audio_slowed" }
    }
    return { audio: 1, video: 1, status: "fits" }
  }
  if (need <= MAX_AUDIO_ONLY + EPS) return { audio: need, video: 1, status: "audio_stretched" }
  if (!allowVideo) {
    const audio = Math.min(need, HARD_AUDIO)
    return { audio, video: 1, status: audio >= need - EPS ? "audio_stretched" : "overflow_trimmed" }
  }
  // Geometric 50/50 split: equal perceptual burden on audio and video.
  const audio = Math.min(Math.sqrt(need), AUDIO_CAP)
  const video = Math.min(need / audio, VIDEO_CAP)
  return { audio, video, status: audio * video >= need - EPS ? "hybrid" : "overflow_trimmed" }
}

const STATUS_TEXT: Record<Status, string> = {
  fits: "fits as spoken, nothing to do",
  audio_slowed: "slowed toward the slot so the dub keeps talking while the mouth does",
  audio_stretched: "pitch-preserving speed-up of the audio only",
  hybrid: "split the burden: audio faster, this stretch of video slower",
  overflow_trimmed: "both knobs are at their caps. The planner marks the excess for trimming, but the generate route refuses to publish a track that would lose words and asks for a shorter line",
}

const SLOT_COLOR = "oklch(0.6 0.02 260)"
const AUDIO_COLOR = "oklch(0.62 0.16 25)"
const VIDEO_COLOR = "oklch(0.6 0.13 250)"
const CUT_COLOR = "oklch(0.55 0.2 15)"

export function SmartFit() {
  const [needPct, setNeedPct] = useState(160)
  const [allowVideo, setAllowVideo] = useState(true)

  const slot = 4 // seconds, an illustrative slot; only the ratio matters
  const need = needPct / 100
  const natural = need * slot
  const { audio, video, status } = fitOne(need, allowVideo)
  const stretched = audio > 0 ? natural / audio : natural
  const videoSlot = slot * video
  const overflow = Math.max(0, stretched - videoSlot)
  const finalStatus: Status = overflow > 1e-6 && status !== "overflow_trimmed" ? "overflow_trimmed" : status

  const W = 560
  const left = 118
  const maxSec = 14
  const px = (s: number) => (Math.min(s, maxSec) / maxSec) * (W - left - 10)

  const rows = [
    { label: "original slot", w: px(slot), color: SLOT_COLOR, note: `${slot.toFixed(1)} s` },
    { label: "TTS, natural", w: px(natural), color: AUDIO_COLOR, note: `${natural.toFixed(2)} s`, faint: true },
    { label: `audio x${audio.toFixed(2)}`, w: px(Math.min(stretched, videoSlot)), color: AUDIO_COLOR, note: `${stretched.toFixed(2)} s` },
    { label: `video x${video.toFixed(2)}`, w: px(videoSlot), color: VIDEO_COLOR, note: `${videoSlot.toFixed(2)} s` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          backend/services/fit_planner.py &middot; _fit_one(), default FitParams
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">ported from the source, one segment</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} 132`} width={W} height={132} role="img" className="w-full">
          <title>
            {`A translated line that runs ${needPct}% of its slot: audio rate ${audio.toFixed(2)}, video slow-down ${video.toFixed(2)}, status ${finalStatus}, ${overflow.toFixed(2)} s still over.`}
          </title>
          {rows.map((r, i) => {
            const y = 8 + i * 28
            return (
              <g key={r.label}>
                <text x={0} y={y + 13} fontSize={10} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
                  {r.label}
                </text>
                <rect x={left} y={y} width={Math.max(r.w, 1)} height={18} rx={2} fill={r.color} fillOpacity={r.faint ? 0.35 : 0.8} />
                <text x={left + Math.max(r.w, 1) + 6} y={y + 13} fontSize={9.5} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                  {r.note}
                </text>
              </g>
            )
          })}
          {overflow > 1e-6 && (
            <rect x={left + px(videoSlot)} y={8 + 2 * 28} width={Math.max(px(stretched) - px(videoSlot), 1)} height={18} rx={2} fill={CUT_COLOR} fillOpacity={0.35} stroke={CUT_COLOR} strokeDasharray="3 2" />
          )}
        </svg>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-1 items-center gap-3">
            <span className="w-28 shrink-0 font-mono text-[10.5px] text-muted-foreground">line = {needPct}% of slot</span>
            <Range
              min={50}
              max={350}
              step={5}
              value={needPct}
              onChange={(e) => setNeedPct(Number(e.target.value))}
              accent={AUDIO_COLOR}
              className="flex-1"
              aria-label="Natural length of the translated line as a percentage of its slot"
            />
          </div>
          <button
            type="button"
            onClick={() => setAllowVideo((v) => !v)}
            aria-pressed={allowVideo}
            data-on={allowVideo}
            className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground data-[on=true]:border-foreground/30 data-[on=true]:bg-muted/50 data-[on=true]:text-foreground"
          >
            video retime {allowVideo ? "on" : "off"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 font-mono text-[10.5px] sm:grid-cols-4">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">status</div>
            <div className="text-foreground">{finalStatus}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">audio rate</div>
            <div className="text-foreground">{audio.toFixed(3)}&times;</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">video slow-down</div>
            <div className="text-foreground">{video.toFixed(3)}&times;</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">still over</div>
            <div className="text-foreground">{overflow.toFixed(2)} s</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {STATUS_TEXT[finalStatus]}. Up to 1.2&times; the planner only speeds the audio up. Past that it takes
          the square root of the overrun for each side, so a line 1.6&times; too long becomes audio at about
          1.26&times; and video slowed by the same factor, until the audio hits 1.5&times; or the video 2&times;.
          Anything beyond 3&times; the slot cannot be absorbed, and the render stops on that line. Turn video retime off and the
          audio alone is allowed up to 1.8&times;. Lines that come out short are slowed, never below
          0.85&times;, unless they already fill 95% of the slot.
        </p>
      </div>
    </figure>
  )
}
