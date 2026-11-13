"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// AbsRel needs an alignment before it means anything. A relative-depth model
// like Iris-Z emits *normalised log depth*: per image, the 2nd-98th percentile
// of log ray distance is squeezed into [-1, 0.95] (iris_z/depth.py,
// encode_log_depth). So its output is x = a * log(d) + b with a and b unknown
// per image. A benchmark has to undo a and b against the ground truth before
// it can score anything, and *which* fit it uses changes the number.
//
// This lab builds a 12 x 8 toy room in metres, synthesises a "model output"
// x = a * (log d + noise) + b, and scores it four ways:
//   raw        exp(x) taken as metres, no fit
//   depth LS   least-squares scale + shift on exp(x) against d
//   depth L1   scale + shift minimising sum |s p + t - d| / d, the relative-error
//              L1 fit MoGe's protocol uses (solved exactly: the optimum of a
//              2-parameter L1 problem sits where two residuals are zero, so we
//              try every pair)
//   log LS     least-squares scale + shift on x against log d, then exp; the
//              family Marigold's protocol fits (it uses RANSAC on top; this is
//              plain least squares)
// Everything is deterministic (no Math.random) so the server and the browser
// render the same numbers, and every exp/log goes through lib/dmath.

const W = 12
const H = 8

type Method = "raw" | "dls" | "dl1" | "lls"
const METHODS: { id: Method; label: string; blurb: string }[] = [
  { id: "raw", label: "no fit", blurb: "exp(x) read as metres" },
  { id: "dls", label: "depth, least squares", blurb: "fit s, t on exp(x)" },
  { id: "dl1", label: "depth, relative L1", blurb: "MoGe-style fit" },
  { id: "lls", label: "log depth, least squares", blurb: "Marigold-style family" },
]

// Ground truth: a floor receding from 1.2 m to 6 m, a back wall at 6 m, a box at
// 2 m, and a window onto a garden at 9 m. `glass` marks the window pixels.
function groundTruth(): { d: number[]; glass: boolean[] } {
  const d: number[] = []
  const glass: boolean[] = []
  for (let r = 0; r < H; r++) {
    for (let c = 0; c < W; c++) {
      let v = 6
      if (r >= 4) v = 6 - ((r - 3) / 4) * 4.8 // floor: row 4 -> 4.8 m ... row 7 -> 1.2 m
      const isBox = c >= 1 && c <= 3 && r >= 3 && r <= 6
      if (isBox) v = 2
      const isWin = c >= 7 && c <= 10 && r >= 1 && r <= 3
      if (isWin) v = 9
      d.push(v)
      glass.push(isWin)
    }
  }
  return { d, glass }
}

// Small deterministic noise in [-1, 1] per pixel.
function hashNoise(i: number): number {
  const x = Math.imul(i + 1, 2654435761)
  const y = Math.imul(x ^ (x >>> 13), 1274126177)
  return ((y >>> 0) % 2001) / 1000 - 1
}

function fitLS(p: number[], g: number[]): [number, number] {
  let sp = 0, sg = 0, spp = 0, spg = 0
  const n = p.length
  for (let i = 0; i < n; i++) {
    sp += p[i]
    sg += g[i]
    spp += p[i] * p[i]
    spg += p[i] * g[i]
  }
  const den = n * spp - sp * sp
  if (Math.abs(den) < 1e-12) return [1, 0]
  const s = (n * spg - sp * sg) / den
  return [s, (sg - s * sp) / n]
}

function fitRelL1(p: number[], g: number[]): [number, number] {
  const n = p.length
  let best = Infinity
  let bs = 1, bt = 0
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dp = p[j] - p[i]
      if (Math.abs(dp) < 1e-9) continue
      const s = (g[j] - g[i]) / dp
      if (s <= 0) continue
      const t = g[i] - s * p[i]
      let cost = 0
      for (let k = 0; k < n; k++) cost += Math.abs(s * p[k] + t - g[k]) / g[k]
      if (cost < best) {
        best = cost
        bs = s
        bt = t
      }
    }
  }
  return [bs, bt]
}

function score(pred: number[], gt: number[]): { absrel: number; d1: number } {
  let ar = 0, ok = 0
  for (let i = 0; i < gt.length; i++) {
    const q = Math.max(pred[i], 1e-3)
    ar += Math.abs(q - gt[i]) / gt[i]
    if (Math.max(q / gt[i], gt[i] / q) < 1.25) ok++
  }
  return { absrel: ar / gt.length, d1: ok / gt.length }
}

// near = red, far = blue, on log depth between 1 m and 10 m
function depthColour(d: number): string {
  const u = Math.min(1, Math.max(0, mlog(Math.max(d, 0.01)) / mlog(10)))
  const hue = Math.round(25 + u * 225)
  return `hsl(${hue} 70% 52%)`
}

function errColour(e: number): string {
  const u = Math.min(1, e / 0.5)
  return `hsl(0 75% ${Math.round(96 - u * 50)}%)`
}

const GT = groundTruth()
const LOG_GT = GT.d.map((v) => mlog(v))

function DepthMap({ values, colour, label }: { values: number[]; colour: (v: number) => string; label: string }) {
  const cell = 14
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${W * cell} ${H * cell}`} className="w-full max-w-[168px]" role="img" aria-label={label}>
        {values.map((v, i) => (
          <rect
            key={i}
            x={(i % W) * cell}
            y={Math.floor(i / W) * cell}
            width={cell - 1}
            height={cell - 1}
            fill={colour(v)}
          />
        ))}
      </svg>
      <span className="font-mono text-[10px] text-muted-foreground">{label}</span>
    </div>
  )
}

export function AbsRelLab() {
  const [a, setA] = useState(1.6)
  const [b, setB] = useState(-0.4)
  const [noise, setNoise] = useState(0.04)
  const [glassWrong, setGlassWrong] = useState(false)
  const [method, setMethod] = useState<Method>("dls")

  const res = useMemo(() => {
    // the model's "log depth" before its own a, b: true log depth + noise, with the
    // window seen as a pane of glass at 3 m when the toggle is on
    const seen = LOG_GT.map((l, i) => (glassWrong && GT.glass[i] ? mlog(3) : l) + noise * hashNoise(i))
    const x = seen.map((l) => a * l + b)
    const ex = x.map((v) => mexp(v))

    const out: Record<Method, { pred: number[]; s: number; t: number; absrel: number; d1: number }> = {} as never
    {
      const pred = ex
      out.raw = { pred, s: 1, t: 0, ...score(pred, GT.d) }
    }
    {
      const [s, t] = fitLS(ex, GT.d)
      const pred = ex.map((v) => s * v + t)
      out.dls = { pred, s, t, ...score(pred, GT.d) }
    }
    {
      const [s, t] = fitRelL1(ex, GT.d)
      const pred = ex.map((v) => s * v + t)
      out.dl1 = { pred, s, t, ...score(pred, GT.d) }
    }
    {
      const [s, t] = fitLS(x, LOG_GT)
      const pred = x.map((v) => mexp(s * v + t))
      out.lls = { pred, s, t, ...score(pred, GT.d) }
    }
    return out
  }, [a, b, noise, glassWrong])

  const cur = res[method]
  const err = cur.pred.map((p, i) => Math.abs(p - GT.d[i]) / GT.d[i])
  const worst = Math.max(...METHODS.map((m) => Math.min(res[m.id].absrel, 2)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">AbsRel after alignment &middot; a 12 &times; 8 toy room</span>
        <button
          type="button"
          onClick={() => setGlassWrong((g) => !g)}
          aria-pressed={glassWrong}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            glassWrong
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          window read as glass at 3 m
        </button>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="tablist" onKeyDown={tablistKeys()} aria-label="alignment">
          {METHODS.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={method === m.id}
              tabIndex={method === m.id ? 0 : -1}
              onClick={() => setMethod(m.id)}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                method === m.id
                  ? "border-foreground/30 bg-muted/60 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3">
          <DepthMap values={GT.d} colour={depthColour} label="ground truth (m)" />
          <DepthMap values={cur.pred} colour={depthColour} label="aligned prediction" />
          <DepthMap values={err} colour={errColour} label="|d̂ − d| / d per pixel" />
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">log scale a</span>
            <Range min={0.5} max={2.5} step={0.05} value={a} onChange={(e) => setA(Number(e.target.value))} className="grow" aria-label="log scale a" />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums">{a.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">log shift b</span>
            <Range min={-2} max={2} step={0.05} value={b} onChange={(e) => setB(Number(e.target.value))} className="grow" aria-label="log shift b" />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums">{b.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-16 shrink-0 font-mono text-[11px] text-muted-foreground">noise</span>
            <Range min={0} max={0.2} step={0.01} value={noise} onChange={(e) => setNoise(Number(e.target.value))} className="grow" aria-label="noise in log depth" />
            <span className="w-9 shrink-0 text-right font-mono text-[11px] tabular-nums">{noise.toFixed(2)}</span>
          </label>
        </div>

        <div className="space-y-1.5" role="list" aria-label="AbsRel by alignment">
          {METHODS.map((m) => {
            const r = res[m.id]
            const shown = Math.min(r.absrel, 2)
            return (
              <button
                key={m.id}
                type="button"
                role="listitem"
                onClick={() => setMethod(m.id)}
                className={cn(
                  "flex w-full cursor-pointer items-center gap-2 rounded px-1 font-mono text-[11px]",
                  method === m.id ? "bg-muted/50" : ""
                )}
              >
                <span className="w-44 shrink-0 text-left text-foreground">{m.label}</span>
                <span className="hidden w-36 shrink-0 text-left text-muted-foreground sm:inline">{m.blurb}</span>
                <span className="h-1.5 grow overflow-hidden rounded-sm bg-muted/40">
                  <span
                    className="block h-full rounded-sm bg-foreground/60"
                    style={{ width: `${((shown / Math.max(worst, 1e-6)) * 100).toFixed(2)}%` }}
                  />
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums text-foreground">
                  {r.absrel > 2 ? "> 200" : (r.absrel * 100).toFixed(2)}
                </span>
                <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
                  {(r.d1 * 100).toFixed(1)}%
                </span>
              </button>
            )
          })}
          <div className="flex gap-2 px-1 font-mono text-[10px] text-muted-foreground">
            <span className="grow text-right">AbsRel &times; 100</span>
            <span className="w-16 shrink-0 text-right">&delta;1</span>
          </div>
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground">
          Fitted here: s = {cur.s.toFixed(3)}, t = {cur.t.toFixed(3)}
          {method === "lls" ? " (in log space)" : method === "raw" ? " (nothing fitted)" : " (in metres)"}. The output is
          log depth with an unknown scale a and shift b. A scale-and-shift fit in log space removes both exactly, so only
          the noise and the glass error are left. A fit in metres can only stretch and slide exp(x), which is d to the
          power a: when a is not 1 the curvature survives every depth-space fit. The relative-L1 fit shrugs off the
          glass pixels that drag least squares around. Toy data, not a benchmark.
        </p>
      </div>
    </figure>
  )
}
