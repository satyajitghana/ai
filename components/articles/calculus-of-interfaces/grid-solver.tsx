"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp } from "@/lib/dmath"
import { KMAX, NODES, OUTS, TEXTS } from "./baked"

// OURS. The six-card grid below is drawn from the 401-node program our tracing compiler produced (baked.ts), evaluated
// here node by node: affine, mul, relu, step. The "direct" column is a hand-written layout with real if/for/Math.max.
// With the softness slider at 0 the two agree exactly (the article checks this on 20,000 random props at 3 sizes).
// Above 0, every step becomes a sigmoid and the cards smear: the same program, a different reading of `step`.

const CH = 8
const LH = 18
const BASE = 40
const TOP = 96
const LMAX = 4

function wrap(text: string, cap: number): number {
  let lines = 0
  let cur = ""
  for (const w of text.split(" ")) {
    if (!cur) cur = w
    else if (cur.length + 1 + w.length <= cap) cur += " " + w
    else {
      lines++
      cur = w
    }
  }
  return cur ? lines + 1 : lines
}

type Props = { W: number; M: number; p: number; g: number; m: number; total: number }
type Card = { x: number; y: number; w: number; h: number }

function direct(pr: Props): { cols: number; H: number; cards: (Card | null)[] } {
  const { W, M, p, g, m, total } = pr
  const n = TEXTS.length
  const inner = Math.min(W, M) - 2 * p
  let cols = 1
  for (let k = 2; k <= KMAX; k++) if (inner + g >= k * (m + g)) cols = k
  const cardW = (inner - (cols - 1) * g) / cols
  const cap = Math.max(1, Math.floor(cardW / CH))
  const cards: (Card | null)[] = Array(n).fill(null)
  let y = TOP + p
  let shown = 0
  for (let r = 0; r < Math.ceil(n / cols); r++) {
    let rh = 0
    let any = false
    for (let c = 0; c < cols; c++) {
      const i = r * cols + c
      if (i >= n || i >= total) continue
      any = true
      const h = BASE + LH * Math.min(LMAX, wrap(TEXTS[i], cap))
      rh = Math.max(rh, h)
      cards[i] = { x: p + c * (cardW + g), y, w: cardW, h }
    }
    if (any) {
      y += rh + g
      shown++
    }
  }
  return { cols, H: shown ? y - g + p : TOP + 2 * p, cards }
}

function run(pr: Props, tau: number) {
  const x = [pr.W, pr.M, pr.p, pr.g, pr.m, pr.total]
  const v = new Float64Array(NODES.length)
  for (let i = 0; i < NODES.length; i++) {
    const n = NODES[i]
    switch (n[0]) {
      case 0:
        v[i] = x[n[1]]
        break
      case 1:
        v[i] = n[1]
        break
      case 2: {
        let s = n[1]
        for (let j = 2; j < n.length; j += 2) s += v[n[j]] * n[j + 1]
        v[i] = s
        break
      }
      case 3:
        v[i] = v[n[1]] * v[n[2]]
        break
      case 4:
        v[i] = Math.max(0, v[n[1]])
        break
      default:
        v[i] = tau > 0 ? 1 / (1 + mexp(-v[n[1]] / tau)) : v[n[1]] >= 0 ? 1 : 0
    }
  }
  const o = (k: string) => v[OUTS[k]]
  const cards: Card[] = TEXTS.map((_, i) => ({ x: o("x" + i), y: o("y" + i), w: o("w" + i), h: o("h" + i) }))
  return { cols: o("cols"), H: o("H"), cards }
}

const FIELDS: { k: keyof Props; label: string; min: number; max: number; step: number }[] = [
  { k: "W", label: "viewport W", min: 320, max: 1920, step: 1 },
  { k: "g", label: "gap g", min: 0, max: 48, step: 1 },
  { k: "m", label: "min card m", min: 160, max: 480, step: 1 },
  { k: "total", label: "cards shown", min: 1, max: 6, step: 1 },
]

export function GridSolver() {
  const [pr, setPr] = useState<Props>({ W: 1100, M: 1248, p: 24, g: 24, m: 300, total: 6 })
  const [tau, setTau] = useState(0)
  const set = (k: keyof Props, v: number) => setPr((s) => ({ ...s, [k]: v }))
  const a = run(pr, tau)
  const b = direct(pr)
  let diff = Math.abs(a.H - b.H)
  b.cards.forEach((c, i) => {
    if (!c) return
    const q = a.cards[i]
    diff = Math.max(diff, Math.abs(q.x - c.x), Math.abs(q.y - c.y), Math.abs(q.w - c.w), Math.abs(q.h - c.h))
  })
  const frameW = Math.min(pr.W, pr.M)
  const VH = 1100

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        ours: a six-card grid evaluated from its compiled program, 401 nodes, no layout engine running
      </div>
      <div className="grid gap-x-6 gap-y-2 border-b px-4 py-3 sm:grid-cols-2">
        {FIELDS.map((f) => (
          <label key={f.k} className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>{f.label}</span>
              <span className="text-foreground">{pr[f.k]}</span>
            </span>
            <Range min={f.min} max={f.max} step={f.step} value={pr[f.k]} onChange={(e) => set(f.k, Number(e.target.value))} aria-label={f.label} />
          </label>
        ))}
        <label className="block sm:col-span-2">
          <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>step softness tau (0 = exact steps, as compiled)</span>
            <span className="text-foreground">{tau}</span>
          </span>
          <Range min={0} max={60} step={1} value={tau} onChange={(e) => setTau(Number(e.target.value))} aria-label="step softness" />
        </label>
      </div>
      <div className="px-3 pt-3">
        <svg viewBox={`0 0 1920 ${VH}`} className="w-full" role="img" aria-label={`Card grid at viewport ${pr.W} pixels: ${a.cols.toFixed(1)} columns, page height ${a.H.toFixed(0)} pixels.`}>
          <rect x={0} y={0} width={frameW} height={Math.max(a.H, 120)} fill="none" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="8 8" strokeWidth={3} />
          {a.cards.map((c, i) => (
            <g key={i}>
              <rect x={c.x} y={c.y} width={Math.max(c.w, 0)} height={Math.max(c.h, 0)} rx={8} fill="oklch(0.62 0.15 250)" fillOpacity={0.16} stroke="oklch(0.55 0.17 250)" strokeWidth={3} />
              {c.h > 1 && (
                <text x={c.x + 14} y={c.y + 30} fontSize={26} fill="currentColor" fillOpacity={0.7} fontFamily="monospace">
                  card {i + 1}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>
      <div className="grid gap-1 border-t px-4 py-2.5 font-mono text-[11px] text-muted-foreground sm:grid-cols-3">
        <span>
          columns <span className="text-foreground">{a.cols.toFixed(tau ? 2 : 0)}</span> (direct {b.cols})
        </span>
        <span>
          page height <span className="text-foreground">{a.H.toFixed(1)}</span> px (direct {b.H.toFixed(1)})
        </span>
        <span>
          largest difference <span className="text-foreground">{diff < 1e-9 ? "0 (exact)" : diff.toFixed(2) + " px"}</span>
        </span>
      </div>
    </figure>
  )
}
