"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One ffmpeg-skill job, "remove the pauses from talk.mp4 and burn in subs.srt",
// walked through the six calls the skill's workflow makes, with the command line
// each script actually builds (read from kajisho5/ffmpeg-skill at 008333a, not run).
//
// The clip and its silences are illustrative: a 30 s talk with five quiet spans
// that ffmpeg's silencedetect would report at -35 dB / 0.6 s. keepRanges() is a
// line-for-line port of keep_ranges() in scripts/silence.py, so the margin and
// min-keep sliders move the cut list, the select= expression and the expected
// duration exactly the way the script would. Arithmetic only (+ - * / min max),
// so server and client render identical strings.

const ACCENT = "oklch(0.60 0.15 255)"
const CUT = "oklch(0.62 0.19 27)"
const GOOD = "oklch(0.58 0.14 155)"
const MUTED = "oklch(0.62 0.02 260)"

const DURATION = 30
// [start, end]; end = Infinity means "silence runs to the end", as detect_silences() returns it
const SILENCES: [number, number][] = [
  [3.2, 4.6],
  [9.85, 11.4],
  [17.1, 17.8],
  [21.3, 23.9],
  [28.7, Infinity],
]

function keepRanges(
  silences: [number, number][],
  duration: number,
  margin: number,
  minKeep: number,
): [number, number][] {
  const keeps: [number, number][] = []
  let cursor = 0
  for (const [s, e] of [...silences].sort((a, b) => a[0] - b[0])) {
    const sAdj = Math.max(cursor, s + margin)
    if (sAdj - cursor >= minKeep) keeps.push([cursor, sAdj])
    cursor = Math.max(cursor, e !== Infinity ? Math.min(duration, e - margin) : duration)
  }
  if (duration - cursor >= minKeep) keeps.push([cursor, duration])
  return keeps
}

const f3 = (x: number) => x.toFixed(3)

type Phase = "probe" | "measure" | "plan" | "run" | "verify"

const PHASE_COLOUR: Record<Phase, string> = {
  probe: ACCENT,
  measure: ACCENT,
  plan: MUTED,
  run: CUT,
  verify: GOOD,
}

interface Step {
  phase: Phase
  title: string
  agent: string
  ffmpeg: string
  reads: string
  why: string
}

function buildSteps(keeps: [number, number][], kept: number): Step[] {
  const expr = keeps.map(([s, e]) => `between(t,${f3(s)},${f3(e)})`).join("+")
  const tightCmd =
    `ffmpeg -hide_banner -loglevel error -nostdin -y -i talk.mp4 ` +
    `-vf "select='${expr}',setpts=N/FRAME_RATE/TB" ` +
    `-c:v libx264 -preset medium -crf 18 -pix_fmt yuv420p -movflags +faststart … ` +
    `-af "aselect='${expr}',asetpts=N/SR/TB" -c:a aac -b:a 192k talk_tight.mp4`
  const step = kept / 6
  return [
    {
      phase: "probe",
      title: "Probe what you plan from",
      agent: "python3 $S/probe.py talk.mp4 --compact",
      ffmpeg:
        "ffprobe -v error -print_format json -show_format -show_streams -show_chapters talk.mp4",
      reads: "talk.mp4: 30.000 s, 1920x1080, 30 fps, h264 + aac stereo, VFR suspected: no",
      why: "Workflow step 1. Every later number comes from this, not from the file name.",
    },
    {
      phase: "measure",
      title: "Measure the silences",
      agent: "python3 $S/silence.py talk.mp4 --list --json",
      ffmpeg:
        "ffmpeg -hide_banner -nostdin -i talk.mp4 -vn -af silencedetect=noise=-35dB:d=0.6 -f null -",
      reads: `${SILENCES.length} silences parsed from stderr; ${keeps.length} kept ranges after keep_ranges()`,
      why: "A measuring tool: it runs ffmpeg even under --dry-run, and writes no media.",
    },
    {
      phase: "plan",
      title: "Plan the cut, write nothing",
      agent: "python3 $S/silence.py talk.mp4 --dry-run --json",
      ffmpeg: tightCmd,
      reads: `planned command only; expected length ~${f3(kept)} s`,
      why: "Workflow step 3. The plan is the exact argv the run will execute, recorded in commands[].",
    },
    {
      phase: "run",
      title: "Cut, then check the file exists",
      agent: "python3 $S/silence.py talk.mp4 --json-brief",
      ffmpeg: tightCmd,
      reads: `emit() → verify_output(): file exists, not 0 bytes, ffprobe reads a stream → "verified": true. Agent compares the probed duration with ~${f3(kept)} s.`,
      why: "The script proves the file is media. Whether the length is right is the agent's step 6.",
    },
    {
      phase: "run",
      title: "Burn the captions on the tight file",
      agent: "python3 $S/caption.py talk_tight.mp4 --srt subs.srt",
      ffmpeg:
        `ffmpeg -hide_banner -loglevel error -nostdin -y -i talk_tight.mp4 -map 0:v:0 ` +
        `-vf "subtitles=subs.srt:force_style='…'" … talk_tight_captioned.mp4`,
      reads: "cues_burned counted; a burn with no cue inside the clip is refused (kind: input)",
      why: "Order is silence, then captions. caption.py has --offset but no remap from the cut list, so subs.srt must be timed for talk_tight.mp4.",
    },
    {
      phase: "verify",
      title: "Look at the picture",
      agent: "python3 $S/look.py talk_tight_captioned.mp4 --tiles 3x2",
      ffmpeg:
        `ffmpeg -hide_banner -loglevel error -nostdin -y -ss ${(step / 2).toFixed(6)} -i talk_tight_captioned.mp4 ` +
        `-vf "select='isnan(prev_selected_t)+gte(t-prev_selected_t\\,${(step * 0.98).toFixed(6)})',` +
        `scale=426:-2,drawtext=…,tile=3x2:padding=2:margin=2:color=0x202020" -frames:v 1 talk_tight_captioned_sheet.png`,
      reads: "Done: talk_tight_captioned.mp4 … Look: talk_tight_captioned_sheet.png",
      why: "Workflow step 8. The picture changed, so the report is unfinished until its Look: line names a PNG the agent opened.",
    },
  ]
}

const W = 640
const H = 70
const X0 = 8
const X1 = W - 8
const xOf = (t: number) => X0 + (Math.min(t, DURATION) / DURATION) * (X1 - X0)

export function ProbeActVerify() {
  const [i, setI] = useState(0)
  const [margin, setMargin] = useState(0.15)
  const [minKeep, setMinKeep] = useState(0.2)

  const keeps = keepRanges(SILENCES, DURATION, margin, minKeep)
  const kept = keeps.reduce((a, [s, e]) => a + (e - s), 0)
  const steps = buildSteps(keeps, kept)
  const st = steps[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5 font-mono text-[11px] text-muted-foreground sm:px-4 sm:text-xs">
        <span className="min-w-0 truncate">ffmpeg-skill · remove the pauses, burn subs.srt</span>
        <span className="shrink-0 text-muted-foreground/60">clip illustrative · commands from source</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {steps.map((s, k) => (
            <button
              key={k}
              type="button"
              onClick={() => setI(k)}
              aria-pressed={k === i}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                k === i ? "bg-foreground text-background" : "hover:bg-muted",
              )}
            >
              <span style={{ color: k === i ? undefined : PHASE_COLOUR[s.phase] }}>
                {k + 1}. {s.phase}
              </span>
            </button>
          ))}
        </div>

        <div>
          <div className="text-sm font-medium">{st.title}</div>
          <p className="mt-1 text-xs text-muted-foreground">{st.why}</p>
        </div>

        <div className="space-y-2 font-mono text-[11px] leading-relaxed">
          <div>
            <div className="text-muted-foreground">agent runs</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2">
              {st.agent}
            </pre>
          </div>
          <div>
            <div className="text-muted-foreground">the script builds</div>
            <pre className="max-h-40 overflow-auto whitespace-pre-wrap break-all rounded-md bg-muted/50 p-2">
              {st.ffmpeg}
            </pre>
          </div>
          <div>
            <div className="text-muted-foreground">what comes back</div>
            <pre
              className="overflow-x-auto whitespace-pre-wrap rounded-md border p-2"
              style={{ borderColor: PHASE_COLOUR[st.phase] }}
            >
              {st.reads}
            </pre>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="talk.mp4 timeline: silences removed, ranges kept">
          <rect x={X0} y={10} width={X1 - X0} height={22} rx={3} fill={MUTED} opacity={0.15} />
          {SILENCES.map(([s, e], k) => (
            <rect
              key={`s${k}`}
              x={xOf(s)}
              y={10}
              width={xOf(e) - xOf(s)}
              height={22}
              fill={CUT}
              opacity={0.35}
            />
          ))}
          {keeps.map(([s, e], k) => (
            <rect
              key={`k${k}`}
              x={xOf(s)}
              y={38}
              width={Math.max(0.5, xOf(e) - xOf(s))}
              height={10}
              rx={2}
              fill={GOOD}
            />
          ))}
          <text x={X0} y={64} fontSize={10} fill="currentColor" opacity={0.7} fontFamily="monospace">
            0 s
          </text>
          <text x={X1} y={64} fontSize={10} fill="currentColor" opacity={0.7} textAnchor="end" fontFamily="monospace">
            {DURATION} s
          </text>
          <text x={W / 2} y={64} fontSize={10} fill="currentColor" opacity={0.7} textAnchor="middle" fontFamily="monospace">
            red: detected silence · green: kept ({keeps.length} ranges, {f3(kept)} s)
          </text>
        </svg>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>--margin</span>
              <span>{margin.toFixed(2)} s</span>
            </span>
            <Range min={0} max={0.5} step={0.05} value={margin} onChange={(e) => setMargin(Number(e.target.value))} />
          </label>
          <label className="block font-mono text-[11px]">
            <span className="flex justify-between">
              <span>--min-keep</span>
              <span>{minKeep.toFixed(2)} s</span>
            </span>
            <Range min={0} max={1} step={0.05} value={minKeep} onChange={(e) => setMinKeep(Number(e.target.value))} />
          </label>
        </div>

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-xs disabled:opacity-40"
            onClick={() => setI((k) => Math.max(0, k - 1))}
            disabled={i === 0}
          >
            back
          </button>
          <span className="font-mono text-[11px] text-muted-foreground">
            step {i + 1} of {steps.length}
          </span>
          <button
            type="button"
            className="rounded-md border px-3 py-1 text-xs disabled:opacity-40"
            onClick={() => setI((k) => Math.min(steps.length - 1, k + 1))}
            disabled={i === steps.length - 1}
          >
            next
          </button>
        </div>
      </div>
    </figure>
  )
}
