"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog } from "@/lib/dmath"

// Toy cross-section: each day, 300 stocks get a forecast f and a realised return
// r = rho * f + sqrt(1 - rho^2) * noise, with f and noise standard normal. The daily
// RankIC is the Spearman correlation of f and r across the 300 names. Everything is
// invented; it exists to show how noisy a small RankIC is day to day, and how many
// days it takes before the average means anything.

const ACC = "oklch(0.6 0.13 250)"
const NEG = "oklch(0.62 0.17 30)"
const STOCKS = 300

function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function normal(r: () => number) {
  const u = Math.max(1e-12, r())
  return Math.sqrt(-2 * mlog(u)) * mcos(2 * Math.PI * r())
}

function ranks(a: number[]) {
  const idx = a.map((v, i) => [v, i] as const).sort((p, q) => p[0] - q[0])
  const out = new Array<number>(a.length)
  idx.forEach(([, i], k) => (out[i] = k))
  return out
}

function pearson(a: number[], b: number[]) {
  const n = a.length
  const ma = a.reduce((s, v) => s + v, 0) / n
  const mb = b.reduce((s, v) => s + v, 0) / n
  let sab = 0
  let saa = 0
  let sbb = 0
  for (let i = 0; i < n; i++) {
    sab += (a[i] - ma) * (b[i] - mb)
    saa += (a[i] - ma) * (a[i] - ma)
    sbb += (b[i] - mb) * (b[i] - mb)
  }
  return sab / Math.sqrt(saa * sbb)
}

export function RankIcLab() {
  const [rhoI, setRhoI] = useState(3)
  const [days, setDays] = useState(60)
  const rho = rhoI / 100

  const ics = useMemo(() => {
    const out: number[] = []
    for (let d = 0; d < days; d++) {
      const r = rng(7919 * (d + 1))
      const f: number[] = []
      const ret: number[] = []
      for (let i = 0; i < STOCKS; i++) {
        const fi = normal(r)
        f.push(fi)
        ret.push(rho * fi + Math.sqrt(1 - rho * rho) * normal(r))
      }
      out.push(pearson(ranks(f), ranks(ret)))
    }
    return out
  }, [rho, days])

  const mean = ics.reduce((a, b) => a + b, 0) / ics.length
  const sd = Math.sqrt(ics.reduce((a, b) => a + (b - mean) * (b - mean), 0) / Math.max(1, ics.length - 1))
  const t = sd > 0 ? (mean / sd) * Math.sqrt(ics.length) : 0
  const pos = ics.filter((v) => v > 0).length

  const W = 600
  const H = 120
  const bw = W / ics.length
  const scale = 0.25

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">RankIC lab · toy cross-section of 300 invented stocks</span>
        <span className="font-mono text-[10px] text-muted-foreground">no real prices, no real model</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>true skill (correlation built into the toy)</span>
              <span className="text-base font-semibold" style={{ color: ACC }}>{rho.toFixed(2)}</span>
            </span>
            <Range min={0} max={15} step={1} value={rhoI} accent={ACC} onChange={(e) => setRhoI(Number(e.target.value))}
              aria-label="True skill" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>trading days observed</span>
              <span className="text-base font-semibold" style={{ color: ACC }}>{days}</span>
            </span>
            <Range min={10} max={250} step={10} value={days} accent={ACC} onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Number of days" className="mt-1 w-full" />
          </label>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded border bg-background" preserveAspectRatio="none" role="img"
          aria-label={`Daily RankIC over ${days} days, mean ${mean.toFixed(3)}`}>
          <line x1={0} x2={W} y1={H / 2} y2={H / 2} stroke="currentColor" opacity={0.3} />
          {ics.map((v, i) => {
            const h = (Math.min(Math.abs(v), scale) / scale) * (H / 2 - 4)
            return <rect key={i} x={i * bw + 0.5} width={Math.max(0.8, bw - 1)} y={v >= 0 ? H / 2 - h : H / 2} height={h} fill={v >= 0 ? ACC : NEG} />
          })}
          <line x1={0} x2={W} y1={H / 2 - (mean / scale) * (H / 2 - 4)} y2={H / 2 - (mean / scale) * (H / 2 - 4)} stroke="currentColor" strokeDasharray="4 3" />
        </svg>
        <p className="font-mono text-[11px] text-muted-foreground">one bar per day: Spearman correlation of forecast and outcome across 300 names (axis ±0.25); dashed: the mean</p>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="rounded border px-2 py-1.5">mean RankIC <b>{mean.toFixed(4)}</b></div>
          <div className="rounded border px-2 py-1.5">daily std {sd.toFixed(4)}</div>
          <div className="rounded border px-2 py-1.5">positive days {pos}/{ics.length}</div>
          <div className="rounded border px-2 py-1.5">t-stat {t.toFixed(2)} {Math.abs(t) < 2 ? "(could be luck)" : "(unlikely to be luck)"}</div>
        </div>
      </div>
    </figure>
  )
}
