"use client"

import { type ReactNode, useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { N_MAX, type Pt, block, call, makeScene, range, relUpdate, rmsErr } from "./toy"

// A linear stand-in for Solv3R's solver properties (see toy.ts). Forty cameras on a ring, camera 0 the fixed
// reference, each pair within eight places of each other contributing one noisy relative-offset measurement.
// One call = one Jacobi sweep, the same update every time, with no step index. Every number on this panel is
// computed live by the code in toy.ts; under Node the same code gives the figures the article quotes.

const SCENE = makeScene()
const GAMMA = 0.02
const MAX_HIST = 160

const C_TRUE = "oklch(0.70 0.02 250)"
const C_OLD = "oklch(0.58 0.15 255)"
const C_NEW = "oklch(0.64 0.17 40)"
const C_ERR = "oklch(0.58 0.15 255)"
const C_RES = "oklch(0.60 0.14 150)"

type Hist = { err: number; res: number }
type State = { x: Pt[]; present: number[]; joined: number[]; calls: number; hist: Hist[]; stopAt: number | null }

const copy = (x: Pt[]): Pt[] => x.map((p) => [p[0], p[1]] as Pt)

function initial(n: number): State {
  return { x: copy(SCENE.guess), present: range(0, n), joined: [], calls: 0, hist: [], stopAt: null }
}

function run(s: State, k: number, mode: "all" | "block"): State {
  let x = s.x
  const hist = s.hist.slice()
  let stopAt = s.stopAt
  let calls = s.calls
  for (let t = 0; t < k; t++) {
    const act = mode === "all" ? s.present : block(s.present, 8, calls + 1, true)
    const y = call(SCENE, x, act)
    const r = relUpdate(x, y, act)
    x = y
    calls++
    hist.push({ err: rmsErr(SCENE, x, s.present), res: r })
    if (stopAt === null && mode === "all" && r < GAMMA) stopAt = calls
  }
  return { ...s, x, calls, hist: hist.slice(-MAX_HIST), stopAt }
}

const W = 300
const H = 200
const sx = (v: number) => W / 2 + v * 118
const sy = (v: number) => H / 2 - v * 118

function Ring({ s }: { s: State }) {
  const joined = new Set(s.joined)
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Camera positions on a ring">
      {range(0, N_MAX).map((i) => {
        const t = SCENE.truth[i]
        return <circle key={`t${i}`} cx={sx(t[0])} cy={sy(t[1])} r={4.5} fill="none" stroke={C_TRUE} strokeWidth={1} />
      })}
      {s.present.map((i) => {
        const p = s.x[i]
        const t = SCENE.truth[i]
        const c = joined.has(i) ? C_NEW : C_OLD
        return (
          <g key={`p${i}`}>
            <line x1={sx(t[0])} y1={sy(t[1])} x2={sx(p[0])} y2={sy(p[1])} stroke={c} strokeOpacity={0.35} strokeWidth={1} />
            <circle cx={sx(p[0])} cy={sy(p[1])} r={i === 0 ? 4 : 2.6} fill={i === 0 ? "currentColor" : c} />
          </g>
        )
      })}
      <text x={sx(SCENE.truth[0][0]) - 6} y={sy(SCENE.truth[0][1]) - 9} fontSize={9} textAnchor="end" fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.7}>
        ref
      </text>
    </svg>
  )
}

const CW = 300
const CH = 200
const PAD = { l: 34, r: 8, t: 10, b: 22 }
const GRID: [number, number][] = [
  [-4, 1e-4],
  [-3, 1e-3],
  [-2, 1e-2],
  [-1, 1e-1],
  [0, 1],
]
const LO = -4
const HI = 0.5
const ly = (v: number) => {
  const l = Math.min(HI, Math.max(LO, mlog10(Math.max(v, 1e-6))))
  return PAD.t + ((HI - l) / (HI - LO)) * (CH - PAD.t - PAD.b)
}

function Chart({ s }: { s: State }) {
  const n = s.hist.length
  const lx = (i: number) => PAD.l + (n <= 1 ? 0 : (i / (Math.max(n, 16) - 1)) * (CW - PAD.l - PAD.r))
  const path = (key: "err" | "res") =>
    s.hist.map((h, i) => `${i ? "L" : "M"}${lx(i).toFixed(1)},${ly(h[key]).toFixed(1)}`).join(" ")
  return (
    <svg viewBox={`0 0 ${CW} ${CH}`} className="w-full" role="img" aria-label="Error and relative update per call">
      {GRID.map(([e, v]) => (
        <g key={e}>
          <line x1={PAD.l} x2={CW - PAD.r} y1={ly(v)} y2={ly(v)} stroke="currentColor" strokeOpacity={0.08} />
          <text x={PAD.l - 4} y={ly(v) + 3} fontSize={8} textAnchor="end" fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.6}>
            {e === 0 ? "1" : `1e${e}`}
          </text>
        </g>
      ))}
      <line x1={PAD.l} x2={CW - PAD.r} y1={ly(GAMMA)} y2={ly(GAMMA)} stroke={C_RES} strokeDasharray="3 3" strokeOpacity={0.8} />
      <text x={CW - PAD.r} y={ly(GAMMA) - 3} fontSize={8} textAnchor="end" fontFamily="ui-monospace, monospace" fill={C_RES}>
        γ = 0.02
      </text>
      {n > 0 ? <path d={path("res")} fill="none" stroke={C_RES} strokeWidth={1.4} /> : null}
      {n > 0 ? <path d={path("err")} fill="none" stroke={C_ERR} strokeWidth={1.8} /> : null}
      <text x={PAD.l} y={CH - 6} fontSize={8} fontFamily="ui-monospace, monospace" fill="currentColor" opacity={0.6}>
        calls →
      </text>
    </svg>
  )
}

function Btn(props: { onClick: () => void; children: ReactNode; disabled?: boolean; on?: boolean }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      disabled={props.disabled}
      className={cn(
        "rounded border px-2 py-1 font-mono text-[11px] transition-colors hover:bg-muted disabled:opacity-40",
        props.on && "bg-foreground text-background hover:bg-foreground/90",
      )}
    >
      {props.children}
    </button>
  )
}

export function SolverRing() {
  const [mode, setMode] = useState<"all" | "block">("all")
  const [s, setS] = useState<State>(() => initial(20))
  const last = s.hist[s.hist.length - 1]

  const perturb = () =>
    setS((p) => ({
      ...p,
      x: p.x.map((q, i) => (i === 0 || !p.present.includes(i) ? q : ([q[0] + 0.3 * ((i * 37) % 7 - 3) / 3, q[1] + 0.3 * ((i * 53) % 5 - 2) / 2] as Pt))),
      stopAt: null,
    }))
  const addViews = () =>
    setS((p) => {
      if (p.present.length >= N_MAX) return p
      const add = range(p.present.length, N_MAX)
      const x = copy(p.x)
      for (const i of add) x[i] = [SCENE.guess[i][0], SCENE.guess[i][1]]
      return { ...p, x, present: range(0, N_MAX), joined: add, stopAt: null }
    })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">a stationary solver on a toy problem · computed live</span>
        <div className="flex gap-1">
          <Btn on={mode === "all"} onClick={() => setMode("all")}>
            all views per call
          </Btn>
          <Btn on={mode === "block"} onClick={() => setMode("block")}>
            8 per call
          </Btn>
        </div>
      </div>
      <div className="grid gap-2 p-3 sm:grid-cols-2 sm:p-4">
        <Ring s={s} />
        <Chart s={s} />
      </div>
      <div className="flex flex-wrap gap-1.5 border-t px-4 py-2.5">
        <Btn onClick={() => setS((p) => run(p, 1, mode))}>1 call</Btn>
        <Btn onClick={() => setS((p) => run(p, 8, mode))}>8 calls</Btn>
        <Btn onClick={() => setS((p) => run(p, 40, mode))}>40 calls</Btn>
        <Btn onClick={perturb}>perturb (P2)</Btn>
        <Btn onClick={addViews} disabled={s.present.length >= N_MAX}>
          add 20 views (P3)
        </Btn>
        <Btn onClick={() => setS(initial(s.present.length))}>restart from encodings</Btn>
        <Btn onClick={() => setS(initial(20))}>reset</Btn>
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-4 py-2.5 font-mono text-[11px] sm:grid-cols-4">
        <span>
          views <b className="tabular-nums">{s.present.length}</b>
        </span>
        <span>
          calls <b className="tabular-nums">{s.calls}</b>
        </span>
        <span style={{ color: C_ERR }}>
          rms error <b className="tabular-nums">{last ? last.err.toFixed(4) : rmsErr(SCENE, s.x, s.present).toFixed(4)}</b>
        </span>
        <span style={{ color: C_RES }}>
          r<sup>k</sup> <b className="tabular-nums">{last ? last.res.toExponential(1) : "—"}</b>
          {s.stopAt !== null ? <span className="text-muted-foreground"> · stop at {s.stopAt}</span> : null}
        </span>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Rings are the true camera positions, dots the current estimate (orange: views that joined late). One call moves
        every active camera to where its overlapping neighbours say it should be, with no step index. Keep calling and a
        solved ring stays put (P1). Perturb it and the same calls pull it back (P2). Add 20 views and they join from
        their starting guesses while the solved 20 keep their state (P3). &ldquo;8 per call&rdquo; updates a random
        block of eight that always includes the reference, reading only the measurements inside the block: it gets
        close, then jitters at about twice the error floor, because the joint solution is not a fixed point of any
        one block&apos;s update. A toy, linear and noise-free apart from its measurements; Solv3R&apos;s operator is
        learned and its properties are trained, not guaranteed.
      </figcaption>
    </figure>
  )
}
