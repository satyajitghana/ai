"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// SAIL's node value (paper, Eq. 4), computed on four made-up rollouts of the
// real-robot task's three subtasks. The rollouts are illustrative: I chose how
// many frames each subtask takes and where the VLM's completion estimate
// stalls. The arithmetic is the paper's:
//
//   r(f) = ( (m(f) - 1) + VLM(l_m, f) / 100 ) / M
//
// m(f) is the subtask in progress at sampled frame f; it only advances when the
// VLM reports 100% for the current subtask. The node value is the mean of r(f)
// over N = 50 uniformly sampled frames. The step-level feedback tags waypoints
// with r at the frames aligned to them; here T = 10 waypoints, five frames each,
// tagged with the last of their five (my choice; the paper does not give T).

const N = 50
const M = 3
const T = 10
const SUBTASKS = ["grasp the blue block", "move to the bowl", "release into the bowl"]

type Seg = { dur: number; peak: number; after?: number }
type Scenario = { id: string; label: string; segs: Seg[] }

const SCENARIOS: Scenario[] = [
  { id: "clean", label: "clean success", segs: [{ dur: 14, peak: 100 }, { dur: 16, peak: 100 }, { dur: 8, peak: 100 }] },
  { id: "late", label: "success, but slow", segs: [{ dur: 24, peak: 100 }, { dur: 14, peak: 100 }, { dur: 10, peak: 100 }] },
  { id: "miss", label: "missed grasp", segs: [{ dur: 14, peak: 60 }] },
  { id: "drop", label: "dropped in transit", segs: [{ dur: 14, peak: 100 }, { dur: 12, peak: 45, after: 10 }] },
]

type Frame = { f: number; m: number; pct: number; r: number }

function rollout(segs: Seg[]): Frame[] {
  const out: Frame[] = []
  let m = 1
  let k = 0
  let done = false
  for (let f = 1; f <= N; f++) {
    let pct: number
    if (done) {
      pct = 100
    } else {
      k += 1
      const s = segs[m - 1]
      if (k <= s.dur) {
        pct = Math.round((s.peak * k) / s.dur)
      } else if (s.after !== undefined) {
        // progress on this subtask falls back after the drop, over ten frames
        const j = Math.min(k - s.dur, 10)
        pct = Math.round(s.peak - ((s.peak - s.after) * j) / 10)
      } else {
        pct = s.peak
      }
    }
    out.push({ f, m, pct, r: (m - 1 + pct / 100) / M })
    if (!done && pct >= 100) {
      if (m < M && m < segs.length) {
        m += 1
        k = 0
      } else {
        done = true
      }
    }
  }
  return out
}

export function ProgressScore() {
  const [sid, setSid] = useState("miss")
  const sc = SCENARIOS.find((s) => s.id === sid) ?? SCENARIOS[0]
  const frames = useMemo(() => rollout(sc.segs), [sc])
  const value = frames.reduce((a, x) => a + x.r, 0) / N
  const success = frames[N - 1].r >= 1
  const tags = Array.from({ length: T }, (_, i) => frames[(i + 1) * (N / T) - 1].r)
  let stall = -1
  for (let i = 1; i < T; i++) {
    if (tags[i] < 1 && tags[i] <= tags[i - 1]) {
      stall = i
      break
    }
  }

  const W = 720
  const H = 230
  const PAD = { l: 40, r: 14, t: 12, b: 34 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const X = (f: number) => PAD.l + ((f - 1) / (N - 1)) * iw
  const Y = (v: number) => PAD.t + ih - v * ih
  const line = frames.map((x, i) => `${i === 0 ? "M" : "L"}${X(x.f).toFixed(1)},${Y(x.r).toFixed(1)}`).join(" ")
  const area = `${line} L${X(N).toFixed(1)},${Y(0).toFixed(1)} L${X(1).toFixed(1)},${Y(0).toFixed(1)} Z`

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap gap-1.5 border-b px-3 py-2">
        {SCENARIOS.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === sid}
            onClick={() => setSid(s.id)}
            className={cn(
              "rounded-sm border px-2 py-1 font-mono text-[11px] transition-colors",
              s.id === sid ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full min-w-[520px]" role="img">
          <title>
            {`Progress score r(f) over 50 sampled frames for the "${sc.label}" rollout. Node value ${value.toFixed(3)}.`}
          </title>
          {[0, 1 / 3, 2 / 3, 1].map((v, i) => (
            <g key={i}>
              <line
                x1={PAD.l}
                x2={W - PAD.r}
                y1={Y(v)}
                y2={Y(v)}
                stroke="currentColor"
                strokeDasharray={i === 0 || i === 3 ? "" : "3 3"}
                className="text-border"
              />
              <text x={PAD.l - 6} y={Y(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {i === 0 ? "0" : i === 3 ? "1" : `${i}/3`}
              </text>
            </g>
          ))}
          {SUBTASKS.map((s, i) => (
            <text
              key={s}
              x={W - PAD.r - 4}
              y={Y((i + 1) / 3) + 12}
              textAnchor="end"
              className="fill-muted-foreground font-mono text-[9px]"
            >
              {`${i + 1}. ${s}`}
            </text>
          ))}
          <path d={area} fill="oklch(0.6 0.13 250 / 0.18)" />
          <path d={line} fill="none" stroke="oklch(0.55 0.15 250)" strokeWidth={2} />
          <line x1={PAD.l} x2={W - PAD.r} y1={Y(value)} y2={Y(value)} stroke="oklch(0.62 0.16 40)" strokeWidth={1.5} />
          <text x={PAD.l + 4} y={Y(value) - 4} className="fill-foreground font-mono text-[10px]">
            node value = mean r = {value.toFixed(3)}
          </text>
          {tags.map((_, i) => {
            const f = (i + 1) * (N / T)
            return (
              <line
                key={i}
                x1={X(f)}
                x2={X(f)}
                y1={Y(0)}
                y2={Y(0) + 5}
                stroke="currentColor"
                className={i === stall ? "text-red-500" : "text-muted-foreground"}
                strokeWidth={i === stall ? 2 : 1}
              />
            )
          })}
          <text x={PAD.l + iw / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            sampled frame f (1 to 50) · ticks: the ten waypoints
          </text>
        </svg>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 font-mono text-[11px] sm:grid-cols-2">
        <div className="space-y-0.5">
          <div className="text-muted-foreground">what the policy VLM gets back (toy)</div>
          {tags.map((t, i) => (
            <div key={i} className={cn(i === stall ? "text-red-600 dark:text-red-400" : "text-foreground")}>
              [SCORE: {t.toFixed(2)}] STEP {i + 1}
              {i === stall ? "  <- progress stops here" : ""}
            </div>
          ))}
        </div>
        <div className="space-y-1 text-muted-foreground">
          <div>
            simulator success check:{" "}
            <span className="text-foreground">{success ? "pass" : "fail"}</span>
          </div>
          <div>
            node value: <span className="text-foreground">{value.toFixed(3)}</span>
          </div>
          <div>
            floor after a completed subtask: once subtask m is marked done, r cannot fall below m/3, even if the
            next frames show the block on the table.
          </div>
          <div>
            a slower success scores lower: the value is the area under the curve, not where it ends.
          </div>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Illustrative rollouts I made up; the formula is the paper&apos;s Eq. 4 with M = 3 subtasks and N = 50 frames.
        The waypoint count T = 10 is my choice. The real scorer is Gemini Robotics-ER 1.5 reading two frames at a time.
      </figcaption>
    </figure>
  )
}
