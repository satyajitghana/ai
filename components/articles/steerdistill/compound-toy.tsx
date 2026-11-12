"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// A toy of why one bad turn sinks a multi-turn agent, and what the paper's
// repair loop buys at training time.
//
// Inputs p (per-turn reliability) and k (turns) are free toy knobs: nothing in
// the paper measures a per-turn rate. Turns are treated as independent, which
// real tasks are not. The two repair rates are the paper's own: in its BFCL V4
// multi-turn diagnostic, four unguided retries from the
// restored pre-error state fix a divergent turn 9.6% of the time, and four
// teacher-steered attempts fix it 82.3% of the time (turn-level Pass@4).
//
// The repair modes describe TRAINING rollouts, where a BF16 teacher and a
// state snapshot are available. At inference the distilled student runs alone.

type Mode = "none" | "retry" | "steer"

const MODES: { id: Mode; label: string; fix: number; note: string }[] = [
  { id: "none", label: "no repair", fix: 0, note: "the rollout stops at its first bad turn" },
  { id: "retry", label: "retry ×4, unguided", fix: 0.096, note: "paper: 9.6% of divergent turns fixed in four tries" },
  { id: "steer", label: "teacher steering ×4", fix: 0.823, note: "paper: 82.3% of divergent turns fixed in four tries" },
]

const ROLLOUTS = 36
const ACCENT = "oklch(0.62 0.15 150)"
const BAD = "oklch(0.6 0.19 25)"
const MONO = "ui-monospace, monospace"

// Deterministic draws so the server and client render the same grid.
function draws(n: number): number[] {
  let s = 0x2f6e2b1
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    out.push(((t ^ (t >>> 14)) >>> 0) / 4294967296)
  }
  return out
}
const U = draws(ROLLOUTS * 30 * 2)

type Cell = "ok" | "fixed" | "dead" | "empty"

export function CompoundToy() {
  const [p, setP] = useState(0.95)
  const [k, setK] = useState(12)
  const [mode, setMode] = useState<Mode>("steer")
  const fix = MODES.find((m) => m.id === mode)!.fix

  const unaided = mpow(p, k)
  const r = p + (1 - p) * fix
  const repaired = mpow(r, k)
  // expected verified corrections per rollout: sum over t of P(reach t) * (1-p) * fix
  const corrections = fix === 0 ? 0 : r >= 1 ? 0 : ((1 - p) * fix * (1 - repaired)) / (1 - r)

  const grid = useMemo(() => {
    const rows: Cell[][] = []
    for (let i = 0; i < ROLLOUTS; i++) {
      const row: Cell[] = []
      let alive = true
      for (let t = 0; t < 30; t++) {
        if (t >= k) {
          row.push("empty")
          continue
        }
        if (!alive) {
          row.push("empty")
          continue
        }
        const a = U[(i * 30 + t) * 2]
        const b = U[(i * 30 + t) * 2 + 1]
        if (a < p) row.push("ok")
        else if (b < fix) row.push("fixed")
        else {
          row.push("dead")
          alive = false
        }
      }
      rows.push(row)
    }
    return rows
  }, [p, k, fix])

  const finished = grid.filter((row) => !row.includes("dead")).length
  const W = 600
  const CW = W / 30
  const RH = 9

  // the p^k curve, k = 1..30, for the current p
  const CH = 110
  const curve = Array.from({ length: 30 }, (_, i) => {
    const kk = i + 1
    return `${(i * (W - 40)) / 29 + 30},${CH - 14 - mpow(p, kk) * (CH - 28)}`
  }).join(" ")
  const curveR = Array.from({ length: 30 }, (_, i) => {
    const kk = i + 1
    return `${(i * (W - 40)) / 29 + 30},${CH - 14 - mpow(r, kk) * (CH - 28)}`
  }).join(" ")
  const kx = ((k - 1) * (W - 40)) / 29 + 30

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="grid gap-3 border-b px-4 py-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span>
            per-turn reliability p = <b>{p.toFixed(3)}</b>
          </span>
          <Range min={0.8} max={1} step={0.005} value={p} onChange={(e) => setP(Number(e.target.value))} aria-label="per-turn reliability" />
        </label>
        <label className="flex flex-col gap-1 font-mono text-xs">
          <span>
            turns in the task k = <b>{k}</b>
          </span>
          <Range min={1} max={30} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="turns in the task" />
        </label>
        <div className="flex flex-wrap items-center gap-1 sm:col-span-2">
          <span className="mr-1 font-mono text-xs text-muted-foreground">training-time repair:</span>
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${mode === m.id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2 p-3 font-mono text-xs sm:grid-cols-3 sm:p-4">
        <div className="rounded-lg border px-3 py-2">
          <div className="text-muted-foreground">task success, student alone</div>
          <div className="text-lg">{(unaided * 100).toFixed(1)}%</div>
          <div className="text-muted-foreground">
            p<sup>k</sup> = {p.toFixed(3)}
            <sup>{k}</sup>
          </div>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <div className="text-muted-foreground">rollouts with every bad turn repaired</div>
          <div className="text-lg" style={{ color: fix > 0 ? ACCENT : undefined }}>
            {(repaired * 100).toFixed(1)}%
          </div>
          <div className="text-muted-foreground">(p + (1−p)·fix)<sup>k</sup></div>
        </div>
        <div className="rounded-lg border px-3 py-2">
          <div className="text-muted-foreground">verified corrections per rollout</div>
          <div className="text-lg">{corrections.toFixed(2)}</div>
          <div className="text-muted-foreground">each one a training example</div>
        </div>
      </div>

      <div className="px-3 pb-2 sm:px-4">
        <svg viewBox={`0 0 ${W} ${ROLLOUTS * RH + 4}`} role="img" className="h-auto w-full">
          <title>{`${ROLLOUTS} sample rollouts of ${k} turns at p = ${p.toFixed(3)} with ${MODES.find((m) => m.id === mode)!.label}: ${finished} reach the end.`}</title>
          {grid.map((row, i) =>
            row.map((c, t) =>
              c === "empty" ? null : (
                <rect
                  key={`${i}-${t}`}
                  x={t * CW + 1}
                  y={i * RH + 2}
                  width={CW - 2}
                  height={RH - 2}
                  rx={1.5}
                  fill={c === "ok" ? "currentColor" : c === "fixed" ? ACCENT : BAD}
                  fillOpacity={c === "ok" ? 0.22 : 0.9}
                />
              ),
            ),
          )}
        </svg>
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">
          {ROLLOUTS} sample rollouts, one row each, left to right by turn. Grey: the turn went right. Red: a bad turn
          nobody repaired, and the rollout ends. Green: a bad turn repaired from the restored state. {finished} of{" "}
          {ROLLOUTS} reach turn {k}.
        </p>
      </div>

      <div className="border-t px-3 py-2 sm:px-4">
        <svg viewBox={`0 0 ${W} ${CH}`} role="img" className="h-auto w-full">
          <title>{`Task success against number of turns: p to the k falls from ${(p * 100).toFixed(1)}% at one turn to ${(mpow(p, 30) * 100).toFixed(1)}% at thirty.`}</title>
          {[0, 0.5, 1].map((v) => (
            <g key={v}>
              <line x1={30} x2={W - 10} y1={CH - 14 - v * (CH - 28)} y2={CH - 14 - v * (CH - 28)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={24} y={CH - 11 - v * (CH - 28)} fontSize={9} fontFamily={MONO} textAnchor="end" fill="currentColor" fillOpacity={0.55}>
                {v * 100}%
              </text>
            </g>
          ))}
          {fix > 0 && <polyline points={curveR} fill="none" stroke={ACCENT} strokeWidth={1.6} strokeDasharray="4 3" />}
          <polyline points={curve} fill="none" stroke="currentColor" strokeWidth={1.6} />
          <line x1={kx} x2={kx} y1={8} y2={CH - 14} stroke={BAD} strokeOpacity={0.6} />
          <text x={W - 10} y={CH - 2} fontSize={9} fontFamily={MONO} textAnchor="end" fill="currentColor" fillOpacity={0.55}>
            turns →
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A toy. p and k are free knobs, and turns are treated as independent, which real tasks are not. The two repair
        rates are the paper&apos;s turn-level Pass@4 from its BFCL V4 multi-turn diagnostic: {MODES[1].note.replace("paper: ", "")};{" "}
        {MODES[2].note.replace("paper: ", "")}. Repair happens only while training, where a teacher and a state snapshot
        exist. At inference the distilled student runs alone, so the left number is the one a deployed agent lives with.
      </figcaption>
    </figure>
  )
}
