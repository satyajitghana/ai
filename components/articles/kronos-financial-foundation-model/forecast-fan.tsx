"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, mlog } from "@/lib/dmath"

import { REAL_FAN } from "./data"

// Two views of "sample N paths, then summarise".
//  toy  — invented random-walk paths (seeded, so server and client agree). Temperature
//         here just scales the step noise, standing in for what T does to Kronos's
//         token distribution. Labelled as a toy everywhere it appears.
//  real — the 20 paths one Kronos-mini run produced (T = 1.0, top_p = 0.9) on the
//         repo's bundled 5-minute test series, with the 24 closes that followed.
// KronosPredictor.predict() returns only the mean path (model/kronos.py:467); the band,
// the median and the "share ending higher" are what you lose by taking that mean.

const ACC = "oklch(0.6 0.13 250)"
const MED = "oklch(0.62 0.17 40)"
const TRUTH = "oklch(0.55 0.16 150)"

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

function quantile(sorted: number[], q: number) {
  const p = (sorted.length - 1) * q
  const i = Math.floor(p)
  const f = p - i
  return i + 1 < sorted.length ? sorted[i] * (1 - f) + sorted[i + 1] * f : sorted[i]
}

type Fan = { hist: number[]; paths: number[][]; truth?: number[]; last: number }

function toyFan(n: number, temp: number): Fan {
  const r0 = rng(11)
  const hist: number[] = [100]
  for (let i = 1; i < 48; i++) hist.push(hist[i - 1] * (1 + 0.004 * normal(r0)))
  const last = hist[hist.length - 1]
  const paths: number[][] = []
  for (let k = 0; k < n; k++) {
    const r = rng(1000 + k)
    // each path gets its own small drift, the way sampled token paths wander off together
    const drift = 0.0012 * normal(r) * temp
    const p: number[] = []
    let v = last
    for (let t = 0; t < 24; t++) {
      v = v * (1 + drift + 0.004 * temp * normal(r))
      p.push(v)
    }
    paths.push(p)
  }
  return { hist, paths, last }
}

export function ForecastFan() {
  const [view, setView] = useState<"toy" | "real">("toy")
  const [n, setN] = useState(30)
  const [tI, setTI] = useState(10)
  const temp = tI / 10

  const fan: Fan = useMemo(
    () => (view === "toy" ? toyFan(n, temp) : { hist: REAL_FAN.hist, paths: REAL_FAN.paths, truth: REAL_FAN.truth, last: REAL_FAN.last }),
    [view, n, temp],
  )

  const H = 24
  const cols = Array.from({ length: H }, (_, t) => fan.paths.map((p) => p[t]).sort((a, b) => a - b))
  const median = cols.map((c) => quantile(c, 0.5))
  const q10 = cols.map((c) => quantile(c, 0.1))
  const q90 = cols.map((c) => quantile(c, 0.9))
  const mean = cols.map((c) => c.reduce((a, b) => a + b, 0) / c.length)
  const ends = fan.paths.map((p) => p[H - 1])
  const upShare = ends.filter((e) => e > fan.last).length / ends.length

  const W = 600
  const HH = 220
  const all = [...fan.hist, ...fan.paths.flat(), ...(fan.truth ?? [])]
  const lo = Math.min(...all)
  const hi = Math.max(...all)
  const nh = fan.hist.length
  const x = (i: number) => 10 + (i / (nh + H - 1)) * (W - 20)
  const y = (v: number) => 10 + ((hi - v) / (hi - lo || 1)) * (HH - 20)
  const line = (vals: number[], off: number) => vals.map((v, i) => `${i ? "L" : "M"}${x(i + off).toFixed(1)},${y(v).toFixed(1)}`).join("")
  const lastPt = `M${x(nh - 1).toFixed(1)},${y(fan.last).toFixed(1)}`
  const band =
    q90.map((v, i) => `${i ? "L" : "M"}${x(nh + i).toFixed(1)},${y(v).toFixed(1)}`).join("") +
    q10.slice().reverse().map((v, i) => `L${x(nh + H - 1 - i).toFixed(1)},${y(v).toFixed(1)}`).join("") + "Z"

  const nPaths = fan.paths.length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {view === "toy" ? "forecast fan · toy data: invented random walks, not a model" : "forecast fan · one real Kronos-mini run, 20 paths"}
        </span>
        <div className="flex gap-1 font-mono text-[11px]">
          {(["toy", "real"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} aria-pressed={view === v}
              className={`rounded border px-2 py-0.5 ${view === v ? "bg-foreground text-background" : "text-muted-foreground"}`}>
              {v === "toy" ? "toy" : "real run"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        {view === "toy" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="flex items-baseline justify-between font-mono text-xs">
                <span>sampled paths N</span>
                <span className="text-base font-semibold" style={{ color: ACC }}>{n}</span>
              </span>
              <Range min={1} max={60} step={1} value={n} accent={ACC} onChange={(e) => setN(Number(e.target.value))}
                aria-label="Number of sampled paths" className="mt-1 w-full" />
            </label>
            <label className="block">
              <span className="flex items-baseline justify-between font-mono text-xs">
                <span>temperature (toy: scales the noise)</span>
                <span className="text-base font-semibold" style={{ color: ACC }}>{temp.toFixed(1)}</span>
              </span>
              <Range min={2} max={15} step={1} value={tI} accent={ACC} onChange={(e) => setTI(Number(e.target.value))}
                aria-label="Sampling temperature" className="mt-1 w-full" />
            </label>
          </div>
        ) : (
          <p className="font-mono text-[11px] text-muted-foreground">
            Kronos-mini + Kronos-Tokenizer-2k on CPU, 512 five-minute candles of context, 24 steps ahead, T = 1.0, top_p = 0.9.
            Green is what actually happened. One run, one series: an illustration, not an evaluation.
          </p>
        )}

        <svg viewBox={`0 0 ${W} ${HH}`} className="w-full rounded border bg-background" role="img"
          aria-label={`${nPaths} sampled paths fanning out from the last close, with median, 10 to 90 percent band and mean`}>
          <path d={band} fill={ACC} opacity={0.15} />
          {fan.paths.map((p, k) => (
            <path key={k} d={lastPt + line(p, nh).replace(/^M/, "L")} fill="none" stroke={ACC} strokeWidth={0.7} opacity={0.35} />
          ))}
          <path d={line(fan.hist, 0)} fill="none" stroke="currentColor" strokeWidth={1.4} />
          {fan.truth && <path d={lastPt + line(fan.truth, nh).replace(/^M/, "L")} fill="none" stroke={TRUTH} strokeWidth={2} />}
          <path d={lastPt + line(median, nh).replace(/^M/, "L")} fill="none" stroke={MED} strokeWidth={2} />
          <path d={lastPt + line(mean, nh).replace(/^M/, "L")} fill="none" stroke="currentColor" strokeWidth={1.2} strokeDasharray="4 3" />
          <line x1={x(nh - 1)} x2={x(nh - 1)} y1={6} y2={HH - 6} stroke="currentColor" opacity={0.25} strokeDasharray="2 3" />
        </svg>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded border px-2 py-1.5">
            <span style={{ color: MED }}>median</span> and <span style={{ color: ACC }}>10–90% band</span> across {nPaths} paths
          </div>
          <div className="rounded border px-2 py-1.5">
            dashed: the mean path, the only thing <code>predict()</code> hands back
          </div>
          <div className="rounded border px-2 py-1.5">
            share ending higher: {Math.round(upShare * nPaths)}/{nPaths} = {(upShare * 100).toFixed(1)}%
            <span className="text-muted-foreground"> (moves in steps of {(100 / nPaths).toFixed(1)} points)</span>
          </div>
        </div>
      </div>
    </figure>
  )
}
