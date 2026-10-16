"use client"

import { useEffect, useState } from "react"

// The Terminal-RSI loop as a cycle, with the paper's Table 2 numbers per
// retained stage. Two halves:
//  - RSR (Recursive Self-Rewrite, actor only): the current actor solves tasks
//    under several harnesses, the verifier keeps passes, the same actor turns
//    each pass into a runbook and re-solves the task under the target harness,
//    and the verified re-solves become supervised fine-tuning data.
//  - RPR (Recursive Policy-Refine, actor + critic): the inherited critic gets
//    four critic-only updates, then PPO updates both, and a checkpoint is kept.
// Every score here is reported (paper, Table 2, Mean@3); the per-half sums are
// arithmetic on those numbers. Nothing is re-run.

type Kind = "base" | "rsr" | "rpr"
const STAGES: { id: string; kind: Kind; note: string }[] = [
  { id: "Base", kind: "base", note: "Qwen3.8-27B before any of this. Only the actor exists; there is no critic yet." },
  { id: "RSR-1", kind: "rsr", note: "Cycle 1, rewrite: the base model discovers, rewrites and is fine-tuned on its own verified re-solves." },
  { id: "RPR-1", kind: "rpr", note: "Cycle 1, refine: PPO from the RSR-1 actor and a warm-up critic, retained at step 20." },
  { id: "RSR-2", kind: "rsr", note: "Cycle 2, rewrite: the RPR-1 actor now does the discovering and rewriting. The critic is carried through untouched." },
  { id: "RPR-2", kind: "rpr", note: "Cycle 2, refine: the inherited critic is recalibrated, actor rate cut fivefold, SPR reward; retained at step 18." },
]

const BENCH: { id: string; label: string; vals: number[] }[] = [
  { id: "tb21", label: "TB 2.1", vals: [51.7, 70.1, 77.53, 86.52, 86.52] },
  { id: "tb40", label: "TB 4.0", vals: [0, 6.1, 16.67, 17.46, 19.84] },
  { id: "tb30", label: "TB 3.0", vals: [0, 6.8, 14.29, 15.0, 16.95] },
  { id: "hard", label: "TB Hard", vals: [31.0, 54.0, 69.5, 76.0, 79.0] },
]

// Loop stations. Top row runs left to right (the RSR half), bottom row runs
// right to left (the RPR half), and the left edge closes the cycle.
const W = 136
const H = 52
const XS = [16, 172, 328, 484]
const YT = 34
const YB = 214
type Node = { x: number; y: number; t: string; s: string; on: Kind[] }
const NODES: Node[] = [
  { x: XS[0], y: YT, t: "Actor, gen k", s: "the retained policy", on: ["base", "rsr", "rpr"] },
  { x: XS[1], y: YT, t: "Discover", s: "several harnesses", on: ["rsr"] },
  { x: XS[2], y: YT, t: "Verifier", s: "keep passes only", on: ["rsr"] },
  { x: XS[3], y: YT, t: "Rewrite", s: "runbook, fresh re-solve", on: ["rsr"] },
  { x: XS[3], y: YB, t: "SFT", s: "actor only", on: ["rsr"] },
  { x: XS[2], y: YB, t: "Critic warm-up", s: "4 critic-only updates", on: ["rpr"] },
  { x: XS[1], y: YB, t: "PPO", s: "actor + critic, verifier reward", on: ["rpr"] },
  { x: XS[0], y: YB, t: "Retain", s: "becomes gen k+1", on: ["rpr"] },
]
const cx = (n: Node) => n.x + W / 2
const cy = (n: Node) => n.y + H / 2
const LOOP = `M${cx(NODES[0])} ${cy(NODES[0])} H${cx(NODES[3])} V${cy(NODES[4])} H${cx(NODES[7])} Z`

const C = {
  rsr: "oklch(0.62 0.16 250)",
  rpr: "oklch(0.66 0.17 330)",
  base: "oklch(0.6 0.02 260)",
}

const r2 = (x: number) => Math.round(x * 100) / 100
const fmt = (x: number) => r2(x).toFixed(2)

export function RsiLoop() {
  const [bench, setBench] = useState("tb21")
  const [stage, setStage] = useState(4)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const id = window.setInterval(() => {
      setStage((s) => (s + 1) % STAGES.length)
    }, 1700)
    return () => window.clearInterval(id)
  }, [playing])

  const b = BENCH.find((x) => x.id === bench) ?? BENCH[0]
  const st = STAGES[stage]
  const deltas = b.vals.map((v, i) => (i === 0 ? 0 : r2(v - b.vals[i - 1])))
  const rsrSum = r2(deltas[1] + deltas[3])
  const rprSum = r2(deltas[2] + deltas[4])
  const total = r2(b.vals[4] - b.vals[0])
  const top = Math.max(20, Math.ceil(Math.max(...b.vals) / 10) * 10)

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">One loop, run twice</div>
        <div className="font-mono text-xs text-muted-foreground">reported · paper Table 2, Mean@3</div>
      </div>

      <div className="mb-3 flex flex-wrap gap-1.5" role="group" aria-label="Benchmark">
        {BENCH.map((x) => {
          const on = x.id === bench
          return (
            <button
              key={x.id}
              type="button"
              aria-pressed={on}
              onClick={() => setBench(x.id)}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs transition-colors"
              style={{
                background: on ? C.rsr : "transparent",
                borderColor: on ? C.rsr : undefined,
                color: on ? "white" : undefined,
              }}
            >
              {x.label}
            </button>
          )
        })}
      </div>

      <svg viewBox="0 0 636 300" className="w-full" role="img" aria-label="The Terminal-RSI loop: actor, discover, verifier, rewrite, supervised fine-tuning, critic warm-up, PPO, retain, and back to the actor.">
        <path d={LOOP} fill="none" stroke="currentColor" strokeOpacity={0.25} strokeWidth={2} strokeDasharray="5 5" />
        <text x={318} y={20} textAnchor="middle" fontSize={11} fill={C.rsr} fontFamily="var(--font-mono, monospace)">
          RSR · rewrite verified successes · actor only
        </text>
        <text x={318} y={292} textAnchor="middle" fontSize={11} fill={C.rpr} fontFamily="var(--font-mono, monospace)">
          RPR · refine with PPO · critic inherited
        </text>
        <circle r={6} fill={st.kind === "rpr" ? C.rpr : C.rsr} className="motion-reduce:hidden">
          <animateMotion dur="6s" repeatCount="indefinite" path={LOOP} />
        </circle>
        {NODES.map((n) => {
          const lit = n.on.includes(st.kind)
          const col = n.on.includes("rpr") && !n.on.includes("rsr") ? C.rpr : n.on.includes("rsr") && !n.on.includes("rpr") ? C.rsr : C.base
          return (
            <g key={n.t} opacity={lit ? 1 : 0.35}>
              <rect x={n.x} y={n.y} width={W} height={H} rx={9} fill={lit ? col : "transparent"} fillOpacity={lit ? 0.16 : 0} stroke={col} strokeWidth={lit ? 2 : 1} />
              <text x={cx(n)} y={n.y + 22} textAnchor="middle" fontSize={13} fontWeight={600} fill="currentColor">
                {n.t}
              </text>
              <text x={cx(n)} y={n.y + 39} textAnchor="middle" fontSize={10} fill="currentColor" fillOpacity={0.7}>
                {n.s}
              </text>
            </g>
          )
        })}
        <text x={318} y={157} textAnchor="middle" fontSize={34} fontWeight={700} fill="currentColor" fontFamily="var(--font-mono, monospace)">
          {fmt(b.vals[stage])}%
        </text>
        <text x={318} y={178} textAnchor="middle" fontSize={11} fill="currentColor" fillOpacity={0.7}>
          {b.label} after {st.id}
          {stage > 0 ? ` (${deltas[stage] >= 0 ? "+" : ""}${fmt(deltas[stage])} pts)` : ""}
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Stage">
        {STAGES.map((s, i) => {
          const on = i === stage
          const col = C[s.kind]
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={on}
              onClick={() => {
                setPlaying(false)
                setStage(i)
              }}
              className="rounded-md border px-2.5 py-1.5 font-mono text-xs"
              style={{ background: on ? col : "transparent", borderColor: col, color: on ? "white" : undefined }}
            >
              {s.id}
            </button>
          )
        })}
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="ml-auto rounded-md border px-2.5 py-1.5 font-mono text-xs"
        >
          {playing ? "pause" : "play the cycles"}
        </button>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{st.note}</p>

      <div className="mt-4 space-y-1.5">
        {STAGES.map((s, i) => (
          <div key={s.id} className="flex items-center gap-2">
            <span className="w-12 shrink-0 font-mono text-xs">{s.id}</span>
            <div className="h-3 flex-1 rounded-sm bg-muted">
              <div
                className="h-3 rounded-sm transition-[width] duration-300 motion-reduce:transition-none"
                style={{
                  width: `${((b.vals[i] / top) * 100).toFixed(2)}%`,
                  minWidth: b.vals[i] > 0 ? 2 : 0,
                  background: C[s.kind],
                  opacity: i <= stage ? 1 : 0.3,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums">{fmt(b.vals[i])}%</span>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-muted-foreground">
              {i === 0 ? "" : `${deltas[i] >= 0 ? "+" : ""}${fmt(deltas[i])}`}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Of the {fmt(total)}-point gain on {b.label},{" "}
        <span style={{ color: C.rsr }}>the two rewrite stages add {fmt(rsrSum)}</span> and{" "}
        <span style={{ color: C.rpr }}>the two PPO stages add {fmt(rprSum)}</span> (reasoned, from the table). Cycle
        two adds less than cycle one on every suite; on TB 2.1 its PPO stage adds nothing.
      </p>
    </div>
  )
}
