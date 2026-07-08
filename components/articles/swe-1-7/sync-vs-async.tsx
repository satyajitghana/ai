"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Sync vs async RL, drawn as a pipeline timeline. Two fleets share one wall-clock:
//   ACTORS  — inference workers running agentic rollouts (edit → run tests → observe → …),
//             which are long and *variable-length*.
//   LEARNER — the trainer doing optimizer steps on finished trajectories.
//
// SYNC:  the learner can only step once the *slowest* rollout in the batch lands, so it
//        idles most of the wall-clock and the fast actors idle waiting for the batch.
// ASYNC: actors stream trajectories into a buffer and the learner trains on whatever is
//        ready — both fleets stay busy — at the cost of training on slightly stale
//        (off-policy) weights. Numbers here are illustrative of the schedule, not measured.
//
// SSR-safe: schedules are built once from a fixed length pool in bounded for-loops (no
// while-until-fill, no Math.random). First render is deterministic at playhead t=0; the
// sweeping playhead runs only inside useEffect.

const ROLLOUT = "oklch(0.68 0.14 235)" // actors / rollout — blue
const TRAIN = "oklch(0.70 0.15 160)" // learner / train — teal-green
const PLAYHEAD = "var(--foreground)"

// A fixed, deterministic pool of variable rollout "durations" (abstract wall-clock units).
const LENS = [11, 17, 9, 14, 20, 12, 16, 10, 18, 13, 15, 8, 19, 11, 14, 9, 16, 12]
const T = 96 // shared timeline length for both modes — the fair comparison
const START = 3
const TRAIN_DUR = 3.6

type Block = { start: number; dur: number; ver: number }
type Sched = { actors: Block[][]; learner: Block[]; utilPct: number }

function syncSchedule(): Sched {
  const actors: Block[][] = [[], [], []]
  const learner: Block[] = []
  let roundStart = START
  for (let r = 0; r < 16; r++) {
    if (roundStart >= T) break
    const lens = [0, 1, 2].map((l) => LENS[(r * 3 + l) % LENS.length])
    const slowest = Math.max(...lens)
    lens.forEach((len, l) => actors[l].push({ start: roundStart, dur: len, ver: r + 1 }))
    const trainStart = roundStart + slowest
    if (trainStart < T) learner.push({ start: trainStart, dur: TRAIN_DUR, ver: r + 1 })
    roundStart = trainStart + TRAIN_DUR
  }
  const busy = learner.length * TRAIN_DUR
  return { actors, learner, utilPct: Math.round((busy / (T - START)) * 100) }
}

function asyncSchedule(): Sched {
  const actors: Block[][] = [[], [], []]
  for (let l = 0; l < 3; l++) {
    let t = START + l * 2.5 // slight stagger so workers don't line up
    for (let i = 0; i < 24; i++) {
      if (t >= T) break
      const dur = LENS[(l * 7 + i * 3) % LENS.length]
      actors[l].push({ start: t, dur, ver: i + 1 })
      t += dur + 0.8 // tiny handoff gap
    }
  }
  const learner: Block[] = []
  let t = START + 5 // buffer warmup before the first optimizer step
  for (let i = 0; i < 48; i++) {
    if (t >= T) break
    learner.push({ start: t, dur: TRAIN_DUR, ver: i + 1 })
    t += TRAIN_DUR + 0.5
  }
  const busy = learner.length * TRAIN_DUR
  return { actors, learner, utilPct: Math.round((busy / (T - START)) * 100) }
}

// geometry
const W = 780
const PL = 92
const PR = 18
const IW = W - PL - PR
const PT = 24
const LH = 28
const BH = 15
const DIV = 16
const H = PT + 3 * LH + DIV + LH + 26

const px = (t: number) => PL + (Math.max(0, Math.min(t, T)) / T) * IW
const actorY = (l: number) => PT + l * LH
const LEARNER_Y = PT + 3 * LH + DIV
const barY = (rowTop: number) => rowTop + (LH - BH) / 2

function countDone(blocks: Block[], tp: number) {
  let n = 0
  for (const b of blocks) if (b.start + b.dur <= tp) n++
  return n
}

export function SyncVsAsync() {
  const [mode, setMode] = useState<"sync" | "async">("sync")
  const [tp, setTp] = useState(0)
  const [playing, setPlaying] = useState(true)

  const sched = useMemo(() => (mode === "sync" ? syncSchedule() : asyncSchedule()), [mode])

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => {
      setTp((x) => (x >= T ? 0 : x + 1.1))
    }, 55)
    return () => clearInterval(id)
  }, [playing])

  const allActors = sched.actors.flat()
  const updates = countDone(sched.learner, tp)
  const trajectories = countDone(allActors, tp)
  const lag = mode === "sync" ? "0 · on-policy" : "~2–3 versions"

  const renderBlocks = (blocks: Block[], rowTop: number, color: string) =>
    blocks.map((b, i) => {
      if (b.start >= T) return null
      const x = px(b.start)
      const w = Math.max(px(b.start + b.dur) - x, 1.5)
      const reached = b.start <= tp
      return (
        <rect
          key={i}
          x={x}
          y={barY(rowTop)}
          width={w}
          height={BH}
          rx={2.5}
          fill={color}
          opacity={reached ? 0.92 : 0.28}
          className="transition-opacity duration-200"
        />
      )
    })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>RL pipeline · one shared wall-clock</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            {(["sync", "async"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  setMode(m)
                  setTp(0)
                }}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[11px] transition-colors",
                  mode === m ? "bg-foreground text-background" : "bg-muted hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="cursor-pointer transition-colors hover:text-foreground"
          >
            {playing ? "pause" : "play"}
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${mode} RL schedule: learner GPU utilization about ${sched.utilPct} percent`}
        >
          {/* lane idle tracks */}
          {[0, 1, 2].map((l) => (
            <rect
              key={l}
              x={px(START)}
              y={barY(actorY(l))}
              width={px(T) - px(START)}
              height={BH}
              rx={2.5}
              fill="var(--muted-foreground)"
              opacity={0.1}
            />
          ))}
          <rect
            x={px(START)}
            y={barY(LEARNER_Y)}
            width={px(T) - px(START)}
            height={BH}
            rx={2.5}
            fill="var(--muted-foreground)"
            opacity={0.1}
          />

          {/* row labels */}
          <text x={8} y={actorY(0) + LH / 2 - 4} className="fill-muted-foreground font-mono" fontSize={9} fontWeight={600}>
            ACTORS
          </text>
          <text x={8} y={actorY(0) + LH / 2 + 7} className="fill-muted-foreground/70 font-mono" fontSize={8}>
            rollout ×3
          </text>
          {[0, 1, 2].map((l) => (
            <text key={l} x={PL - 8} y={actorY(l) + LH / 2 + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={8}>
              w{l}
            </text>
          ))}
          <text x={8} y={LEARNER_Y + LH / 2 + 3} className="fill-muted-foreground font-mono" fontSize={9} fontWeight={600}>
            LEARNER
          </text>

          {/* blocks */}
          {sched.actors.map((lane, l) => (
            <g key={l}>{renderBlocks(lane, actorY(l), ROLLOUT)}</g>
          ))}
          {renderBlocks(sched.learner, LEARNER_Y, TRAIN)}

          {/* divider between fleets */}
          <line x1={PL} x2={W - PR} y1={LEARNER_Y - DIV / 2} y2={LEARNER_Y - DIV / 2} stroke="var(--border)" strokeDasharray="2 4" />

          {/* playhead */}
          <line x1={px(tp)} x2={px(tp)} y1={PT - 6} y2={LEARNER_Y + LH - 6} stroke={PLAYHEAD} strokeWidth={1} opacity={0.4} />

          {/* wall-clock axis */}
          <text x={px(START)} y={H - 8} className="fill-muted-foreground/60 font-mono" fontSize={8}>
            wall-clock →
          </text>
          <text x={W - PR} y={H - 8} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={8}>
            same window, both modes
          </text>
        </svg>

        {/* utilization + live counters */}
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">learner GPU util</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="font-mono text-lg tabular-nums" style={{ color: TRAIN }}>
                {sched.utilPct}
              </span>
              <span className="font-mono text-[10px] text-muted-foreground">%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full transition-all duration-300" style={{ width: `${sched.utilPct}%`, background: TRAIN }} />
            </div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">weight updates</div>
            <div className="mt-1 font-mono text-lg tabular-nums text-foreground">{updates}</div>
            <div className="font-mono text-[9px] text-muted-foreground/70">optimizer steps so far</div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">trajectories</div>
            <div className="mt-1 font-mono text-lg tabular-nums" style={{ color: ROLLOUT }}>
              {trajectories}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground/70">rollouts finished</div>
          </div>
          <div className="rounded-md bg-muted/40 px-3 py-2">
            <div className="font-mono text-[10px] text-muted-foreground">policy lag</div>
            <div className="mt-1 font-mono text-sm tabular-nums text-foreground">{lag}</div>
            <div className="font-mono text-[9px] text-muted-foreground/70">off-policy staleness</div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ROLLOUT }} /> rollout (actor)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: TRAIN }} /> train (learner)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-muted-foreground/25" /> idle
          </span>
          <span className="ml-auto text-muted-foreground/50">illustrative schedule</span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          In <span className="text-foreground">sync</span> the learner can only step once the{" "}
          <span className="text-foreground">slowest</span> rollout in the batch lands, so it sits idle across most of the
          window and the fast actors wait too — GPUs starve. In <span className="text-foreground">async</span> the actors
          stream trajectories into a buffer and the learner trains back-to-back on whatever is ready, so both fleets stay
          busy. The bill is <span style={{ color: ROLLOUT }}>off-policy staleness</span>: the learner is training on
          weights a few versions old, which needs importance-sampling and a bounded mismatch to stay stable.
        </p>
      </div>
    </figure>
  )
}
