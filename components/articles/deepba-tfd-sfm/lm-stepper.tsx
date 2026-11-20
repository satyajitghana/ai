"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog10, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { coldStart, cost, lmStep, makeScene, noisyStart, poseError, type State, type Vec } from "./lm-math"

// Flatland bundle adjustment, stepped by hand: Levenberg-Marquardt with the
// points eliminated by the Schur complement. Left, the scene from above (grey:
// truth; coloured: the current estimate, aligned to the truth by a similarity
// so the gauge does not move it around). Right, the normal matrix H = J^T J of
// the current step (cameras first, then points) and the reduced camera system
// S that the solver actually factors. Everything is computed live in lm-math.ts.

const W = 560
const H = 360
const SC = 62
const sx = (x: number) => W / 2 + x * SC
const sy = (y: number) => H - 40 - y * SC

type Start = "noisy" | "cold"

const ACCENT = "oklch(0.58 0.16 255)"
const WARN = "oklch(0.62 0.19 30)"

function clampPt(p: Vec): Vec {
  return [Math.max(-4.4, Math.min(4.4, p[0])), Math.max(-0.5, Math.min(5.5, p[1]))]
}

export function LmStepper() {
  const [turn, setTurn] = useState(60)
  const [noise, setNoise] = useState(10)
  const [start, setStart] = useState<Start>("noisy")
  const [seed, setSeed] = useState(3)
  const scene = useMemo(() => makeScene(1, seed, turn), [seed, turn])
  const init = useMemo<State>(() => (start === "cold" ? coldStart(scene) : noisyStart(scene, noise, seed)), [scene, start, noise, seed])
  const [run, setRun] = useState<{ key: string; state: State; lambda: number; iters: number; costs: number[] }>(() => ({
    key: "",
    state: init,
    lambda: 1e-3,
    iters: 0,
    costs: [],
  }))
  const key = `${seed}|${turn}|${start}|${noise}`
  const cur = run.key === key ? run : { key, state: init, lambda: 1e-3, iters: 0, costs: [cost(scene, init)] }
  const info = useMemo(() => lmStep(scene, cur.state, cur.lambda), [scene, cur.state, cur.lambda])

  const advance = (n: number) => {
    let s = cur.state
    let lam = cur.lambda
    const costs = [...cur.costs]
    for (let i = 0; i < n; i++) {
      const st = lmStep(scene, s, lam)
      s = st.state
      lam = st.lambda
      costs.push(st.cost)
    }
    setRun({ key, state: s, lambda: lam, iters: cur.iters + n, costs })
  }

  const err = poseError(scene, cur.state)
  const shown = err.aligned
  const c0 = cur.costs[0] ?? 1
  const cNow = cur.costs[cur.costs.length - 1] ?? c0

  // matrix picture: magnitudes on a log scale
  const nc = info.nCamParams
  const n = nc + info.nPtParams
  const cell = 220 / n
  const shade = (v: number) => (v <= 1e-12 ? 0 : Math.max(0.12, Math.min(1, (mlog10(v) + 6) / 8)))
  const scell = 150 / nc

  const desc = `Bundle adjustment of five 1D cameras and thirty points in a plane, ${
    start === "cold" ? "from a cold start" : `from poses perturbed by ${noise} degrees`
  }, after ${cur.iters} Levenberg-Marquardt steps. Mean heading error ${err.headDeg.toFixed(2)} degrees.`

  // cost history sparkline
  const hist = cur.costs.slice(-40)
  const lo = -8
  const hi = 4
  const cy = (c: number) => 60 - ((Math.max(lo, Math.min(hi, mlog10(Math.max(c, 1e-12)))) - lo) / (hi - lo)) * 56

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Levenberg-Marquardt with a Schur complement, one step at a time</span>
        <span className="text-muted-foreground/60">a 2D toy, computed live</span>
      </div>
      <div className="flex flex-wrap gap-2 px-4 pt-3">
        {(
          [
            ["noisy", "start near the truth"],
            ["cold", "cold start"],
          ] as [Start, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStart(id)}
            aria-pressed={start === id}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              start === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
        <button type="button" onClick={() => advance(1)} className="rounded-full border px-3 py-1 font-mono text-[11px] text-foreground hover:bg-muted">
          one LM step
        </button>
        <button type="button" onClick={() => advance(10)} className="rounded-full border px-3 py-1 font-mono text-[11px] text-foreground hover:bg-muted">
          ten steps
        </button>
        <button
          type="button"
          onClick={() => setRun({ key, state: init, lambda: 1e-3, iters: 0, costs: [cost(scene, init)] })}
          className="rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          reset
        </button>
        <button
          type="button"
          onClick={() => setSeed((s) => s + 1)}
          className="rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
        >
          new scene
        </button>
      </div>
      <div className="grid gap-2 px-2 pt-2 md:grid-cols-[1.45fr_1fr]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          {scene.pts.map((p, k) => {
            const q = clampPt(shown.pts[k])
            return (
              <g key={`p${k}`}>
                <line x1={sx(p[0])} y1={sy(p[1])} x2={sx(q[0])} y2={sy(q[1])} stroke={ACCENT} strokeWidth={0.8} opacity={0.5} />
                <circle cx={sx(p[0])} cy={sy(p[1])} r={2.6} className="fill-muted-foreground" />
                <circle cx={sx(q[0])} cy={sy(q[1])} r={3.4} fill="none" stroke={ACCENT} strokeWidth={1.3} />
              </g>
            )
          })}
          {scene.cams.map((c, i) => {
            const e = shown.cams[i]
            const ep = clampPt(e.c)
            // forward of a camera at heading th is world (-sin th, cos th)
            const fx = (th: number) => -msin(th)
            const fy = (th: number) => mcos(th)
            return (
              <g key={`c${i}`}>
                <line x1={sx(c.c[0])} y1={sy(c.c[1])} x2={sx(c.c[0]) + 30 * fx(c.th)} y2={sy(c.c[1]) - 30 * fy(c.th)} className="stroke-muted-foreground" strokeWidth={1.2} />
                <circle cx={sx(c.c[0])} cy={sy(c.c[1])} r={4} className="fill-muted-foreground" />
                <line x1={sx(ep[0])} y1={sy(ep[1])} x2={sx(ep[0]) + 30 * fx(e.th)} y2={sy(ep[1]) - 30 * fy(e.th)} stroke={i === 0 ? WARN : ACCENT} strokeWidth={2.2} />
                <circle cx={sx(ep[0])} cy={sy(ep[1])} r={4.5} className="fill-background" stroke={i === 0 ? WARN : ACCENT} strokeWidth={1.6} />
              </g>
            )
          })}
          <g className="font-mono" fontSize={10}>
            <text x={10} y={16} className="fill-muted-foreground">
              grey: truth · blue: estimate · orange: camera 0, held fixed
            </text>
            <polyline
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.5}
              points={hist.map((c, i) => `${W - 150 + (i * 140) / Math.max(1, hist.length - 1)},${H - 70 + cy(c)}`).join(" ")}
            />
            <text x={W - 150} y={H - 76} className="fill-muted-foreground">
              cost (log), last {hist.length}
            </text>
          </g>
        </svg>
        <div className="px-2 font-mono text-[10px] text-muted-foreground">
          <div className="mb-1">H = JᵀJ: cameras {nc}, points {info.nPtParams}</div>
          <svg viewBox="0 0 230 230" className="h-auto w-full max-w-[240px]" role="img" aria-label="Sparsity of the normal matrix: a dense camera block, a block-diagonal point block and the camera-point coupling.">
            {info.H.map((row, i) =>
              row.map((v, j) => {
                const a = shade(v)
                return a > 0 ? <rect key={`${i}-${j}`} x={j * cell} y={i * cell} width={cell} height={cell} fill={i < nc && j < nc ? WARN : ACCENT} opacity={a} /> : null
              }),
            )}
            <line x1={nc * cell} y1={0} x2={nc * cell} y2={220} className="stroke-muted-foreground" strokeWidth={0.6} />
            <line x1={0} y1={nc * cell} x2={220} y2={nc * cell} className="stroke-muted-foreground" strokeWidth={0.6} />
          </svg>
          <div className="mb-1 mt-2">S = B − E C⁻¹ Eᵀ: what gets factored ({nc}×{nc})</div>
          <svg viewBox="0 0 160 160" className="h-auto w-full max-w-[160px]" role="img" aria-label="The reduced camera system after eliminating every point.">
            {info.S.map((row, i) =>
              row.map((v, j) => {
                const a = shade(v)
                return a > 0 ? <rect key={`${i}-${j}`} x={j * scell} y={i * scell} width={scell} height={scell} fill={WARN} opacity={a} /> : null
              }),
            )}
          </svg>
        </div>
      </div>
      <div className="grid gap-3 px-4 pb-2 pt-1 sm:grid-cols-2">
        <label className="block font-mono text-[11px] text-muted-foreground">
          how much the walk turns: {turn}°
          <Range min={0} max={90} step={10} value={turn} onChange={(e) => setTurn(Number(e.target.value))} />
        </label>
        <label className={cn("block font-mono text-[11px] text-muted-foreground", start === "cold" && "opacity-40")}>
          starting pose noise: {noise}° (and {(noise * 3).toFixed(0)} cm)
          <Range min={0} max={30} step={1} value={noise} disabled={start === "cold"} onChange={(e) => setNoise(Number(e.target.value))} />
        </label>
      </div>
      <figcaption className="grid gap-1 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <span>
          steps: <span className="text-foreground">{cur.iters}</span> · λ: <span className="text-foreground">{cur.lambda.toExponential(1)}</span>
        </span>
        <span>
          cost: {c0.toExponential(2)} → <span className="text-foreground">{cNow.toExponential(2)}</span>
        </span>
        <span>
          mean heading error: <span className="text-foreground">{err.headDeg.toFixed(2)}°</span>
        </span>
        <span>
          camera centres off by <span className="text-foreground">{(err.posRms * 100).toFixed(1)} cm</span> RMS (after a similarity)
        </span>
      </figcaption>
    </figure>
  )
}
