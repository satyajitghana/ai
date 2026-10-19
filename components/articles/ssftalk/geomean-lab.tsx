"use client"

import { useState } from "react"

import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The fourteen rows of ssftalk's README benchmark table (REPORTED: their own run,
// labelled Apple-Silicon-UMA-NEON128). "base" is the constant typed into
// examples/full_suite_benchmark.rs for that stage (MEASURED by reading the file:
// none of them is timed). "vault" marks a stage whose code is compiled from the
// encrypted assets/ssftalk_moat_vault.bin rather than from readable source. The
// geometric mean is recomputed here from the visible pairs (REASONED).

type Stage = { n: number; name: string; ours: number; base: number; vs: string; vault: boolean }

const STAGES: Stage[] = [
  { n: 1, name: "TTS + timestamps", ours: 40833.61, base: 420000, vs: "Cloud TTS v2 REST", vault: true },
  { n: 2, name: "Stream-input first chunk", ours: 24473.17, base: 75000, vs: "ElevenLabs Flash v2.5 WS", vault: true },
  { n: 3, name: "Prosody director", ours: 13.97, base: 14500, vs: "Cross-attention prosody LLM", vault: true },
  { n: 4, name: "Voice clone", ours: 305.3, base: 480000, vs: "ECAPA-TDNN", vault: false },
  { n: 5, name: "Voice design, 3 previews", ours: 62687.4, base: 1850000, vs: "Cloud voice design API", vault: true },
  { n: 6, name: "Speech-to-speech", ours: 5669.11, base: 620000, vs: "RVC v2 / cloud STS", vault: true },
  { n: 7, name: "Audio isolation", ours: 73.88, base: 95000, vs: "Demucs", vault: true },
  { n: 8, name: "Sound effect, 1 s", ours: 234.46, base: 920000, vs: "AudioLDM2", vault: true },
  { n: 9, name: "WSOLA dubbing", ours: 23218.17, base: 840000, vs: "Librosa phase vocoder", vault: true },
  { n: 10, name: "ASR + forced align", ours: 1.94, base: 165000, vs: "WhisperX + PyAnnote", vault: true },
  { n: 11, name: "j128 codec round trip", ours: 4282.95, base: 6400, vs: "FFmpeg libmp3lame", vault: false },
  { n: 12, name: "Duplex room + barge-in", ours: 0.3, base: 3200, vs: "WebRTC SFU", vault: true },
  { n: 13, name: "Prune + 1-bit match", ours: 15.36, base: 18400, vs: "Dense audio-LLM", vault: false },
  { n: 14, name: "64-D signature", ours: 159.28, base: 28000, vs: "WavLM-Large", vault: false },
]

const fmt = (x: number) =>
  x >= 100 ? Math.round(x).toLocaleString("en-US") : x >= 10 ? x.toFixed(1) : x.toFixed(2)

export function GeomeanLab() {
  const [on, setOn] = useState<boolean[]>(() => STAGES.map(() => true))
  const picked = STAGES.filter((_, i) => on[i])
  const g = picked.length ? mexp(picked.reduce((s, r) => s + mlog(r.base / r.ours), 0) / picked.length) : 0
  const maxLog = mlog(90000)

  const preset = (keep: (s: Stage) => boolean) => setOn(STAGES.map(keep))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          geomean of {picked.length} stage{picked.length === 1 ? "" : "s"}:{" "}
          <span className="text-base font-semibold text-foreground tabular-nums">{picked.length ? `${fmt(g)}x` : "n/a"}</span>
        </span>
        <div className="flex flex-wrap gap-1.5">
          {[
            ["all 14", () => preset(() => true)],
            ["drop 10 and 12", () => preset((s) => s.n !== 10 && s.n !== 12)],
            ["readable code only", () => preset((s) => !s.vault)],
            ["speech out: 1, 2, 11", () => preset((s) => [1, 2, 11].includes(s.n))],
          ].map(([label, fn]) => (
            <button
              key={label as string}
              type="button"
              onClick={fn as () => void}
              className="cursor-pointer rounded-md border border-border px-2 py-1 font-mono text-[11px] text-muted-foreground hover:bg-muted/20"
            >
              {label as string}
            </button>
          ))}
        </div>
      </div>
      <ul className="divide-y">
        {STAGES.map((s, i) => {
          const sp = s.base / s.ours
          const w = Math.max(2, (mlog(sp) / maxLog) * 100)
          return (
            <li key={s.n} className={cn("px-4 py-1.5 transition-opacity", !on[i] && "opacity-40")}>
              <label className="flex cursor-pointer items-center gap-3">
                <input
                  type="checkbox"
                  checked={on[i]}
                  onChange={() => setOn((o) => o.map((v, j) => (j === i ? !v : v)))}
                  className="accent-current"
                />
                <span className="w-44 shrink-0 text-xs sm:w-52">
                  <span className="font-mono text-muted-foreground">{String(s.n).padStart(2, "0")}</span>{" "}
                  {s.name}
                  {s.vault ? <span className="ml-1 font-mono text-[9px] text-amber-700 dark:text-amber-400">vault</span> : null}
                </span>
                <span className="relative h-3 min-w-0 flex-1 rounded-sm bg-muted/40">
                  <span className="absolute inset-y-0 left-0 rounded-sm bg-foreground/50" style={{ width: `${w.toFixed(2)}%` }} />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-xs tabular-nums">{fmt(sp)}x</span>
              </label>
              <p className="ml-7 font-mono text-[10px] text-muted-foreground">
                {fmt(s.ours)} us timed vs {s.base.toLocaleString("en-US")} us typed in as &quot;{s.vs}&quot;
              </p>
            </li>
          )
        })}
      </ul>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        ssftalk&apos;s 14 benchmark rows (reported), bars on a log scale. Every baseline is a constant in{" "}
        <code>full_suite_benchmark.rs</code>; nothing on the right-hand side is run. Untick rows to see how much of the
        265.5x headline comes from which comparison.
      </figcaption>
    </figure>
  )
}
