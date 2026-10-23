"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// DeepInfer's verify-budget choice, re-implemented from csrc/engine/mtp_varlen.hpp
// (MTPVarlen::schedule) without its two runtime corrections (a fitted per-token
// slope and the sampler's time). Every request has 5 draft tokens; a draft's
// rate is the chance it and every draft before it are accepted. All drafts of
// all requests are sorted by rate, and the scheduler grows the step one query
// token at a time down that list, keeping the size where expected tokens per
// millisecond peaks.
//
// The step-time curve is reasoned, not measured: it is DeepInfer's own decode
// chart (doc/images/decode_pareto.png, EP64, nextn=3, so 4 query tokens per
// request) read back as milliseconds per step = 3.25 / per-user speed. The
// engine profiles its own curve at start-up and looks up the next captured
// graph size; with six points this widget interpolates linearly between them.

const CURVE: [number, number][] = [
  [32, 9.99],
  [64, 10.34],
  [128, 10.94],
  [256, 13.2],
  [512, 18.21],
  [1024, 31.53],
]
const ND = 5

function stepMs(q: number): number | null {
  if (q <= CURVE[0][0]) return CURVE[0][1]
  for (let i = 1; i < CURVE.length; i++) {
    const [a, ta] = CURVE[i - 1]
    const [b, tb] = CURVE[i]
    if (q <= b) return ta + ((q - a) * (tb - ta)) / (b - a)
  }
  return null
}

type Result = {
  sweep: { q: number; tps: number }[]
  best: { q: number; tps: number; exp: number }
  fixed: { q: number; tps: number; exp: number } | null
}

function simulate(n: number, pbar: number, spread: number): Result {
  // per-request conditional acceptance, spread evenly around the mean
  const rates: { r: number; i: number }[] = []
  let fixedExp = 0
  for (let i = 0; i < n; i++) {
    const p = Math.min(0.99, Math.max(0.05, pbar + spread * ((i + 0.5) / n - 0.5)))
    let cum = 1
    fixedExp += 1
    for (let j = 0; j < ND; j++) {
      cum *= p
      rates.push({ r: cum, i })
      fixedExp += cum
    }
  }
  rates.sort((a, b) => (a.r !== b.r ? b.r - a.r : a.i - b.i))

  const sweep: { q: number; tps: number }[] = []
  let exp = n
  let q = n
  let t = stepMs(q)
  let best = { q, tps: t ? (exp / t) * 1000 : 0, exp }
  if (t) sweep.push({ q, tps: best.tps })
  for (const { r } of rates) {
    exp += r
    q += 1
    t = stepMs(q)
    if (t === null) break
    const tps = (exp / t) * 1000
    sweep.push({ q, tps })
    if (tps > best.tps) best = { q, tps, exp }
  }
  const ft = stepMs(n * (ND + 1))
  const fixed = ft === null ? null : { q: n * (ND + 1), tps: (fixedExp / ft) * 1000, exp: fixedExp }
  return { sweep, best, fixed }
}

const W = 520
const H = 210
const L = 52
const R = 14
const T = 14
const B = 34

export function VerifyBudget() {
  const [n, setN] = useState(60)
  const [p, setP] = useState(0.75)
  const [spread, setSpread] = useState(0.3)
  const res = useMemo(() => simulate(n, p, spread), [n, p, spread])

  const qMin = n
  const qMax = Math.max(n * (ND + 1), res.sweep[res.sweep.length - 1]?.q ?? n + 1)
  const yMax = Math.max(...res.sweep.map((s) => s.tps), res.fixed?.tps ?? 0) * 1.08
  const x = (q: number) => L + ((q - qMin) / Math.max(1, qMax - qMin)) * (W - L - R)
  const y = (v: number) => T + (1 - v / yMax) * (H - T - B)
  const path = res.sweep.map((s, i) => `${i ? "L" : "M"} ${x(s.q).toFixed(1)} ${y(s.tps).toFixed(1)}`).join(" ")

  const avgVerify = (res.best.q - n) / n
  const accDyn = res.best.exp / n
  const accFixed = res.fixed ? res.fixed.exp / n : 0
  const gain = res.fixed ? (res.best.tps / res.fixed.tps - 1) * 100 : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        how many drafts to verify: the greedy in mtp_varlen.hpp
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-3 sm:p-4">
        <label className="grid gap-1 font-mono text-xs">
          <span>
            requests per rank <b className="text-foreground">{n}</b>
          </span>
          <Range min={8} max={160} step={4} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </label>
        <label className="grid gap-1 font-mono text-xs">
          <span>
            mean acceptance per draft <b className="text-foreground">{p.toFixed(2)}</b>
          </span>
          <Range min={0.4} max={0.95} step={0.01} value={p} onChange={(e) => setP(Number(e.target.value))} />
        </label>
        <label className="grid gap-1 font-mono text-xs">
          <span>
            spread across requests <b className="text-foreground">{spread.toFixed(2)}</b>
          </span>
          <Range min={0} max={0.6} step={0.02} value={spread} onChange={(e) => setSpread(Number(e.target.value))} />
        </label>
      </div>
      <div className="px-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Expected output tokens per second per GPU against query tokens per step. Best at ${res.best.q} query tokens, ${Math.round(res.best.tps)} tokens per second; verifying all five drafts gives ${res.fixed ? Math.round(res.fixed.tps) : "no value"}.`}
        >
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={L} x2={W - R} y1={y(yMax * f)} y2={y(yMax * f)} stroke="var(--border)" opacity={0.6} />
              <text x={L - 6} y={y(yMax * f) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                {Math.round((yMax * f) / 100) * 100}
              </text>
            </g>
          ))}
          <line x1={L} x2={W - R} y1={H - B} y2={H - B} stroke="currentColor" className="text-muted-foreground" />
          <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            query tokens per step (requests + verified drafts)
          </text>
          <text x={L} y={H - B + 13} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
            {qMin}
          </text>
          <text x={W - R} y={H - B + 13} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            {qMax}
          </text>
          <path d={path} fill="none" stroke="currentColor" strokeWidth={2} className="text-sky-600 dark:text-sky-400" />
          {res.fixed && (
            <g>
              <circle cx={x(res.fixed.q)} cy={y(res.fixed.tps)} r={4.5} className="fill-amber-500" />
              <text
                x={x(res.fixed.q) - 6}
                y={y(res.fixed.tps) - 8}
                textAnchor="end"
                fontSize={9.5}
                className="fill-amber-700 font-mono dark:fill-amber-300"
              >
                verify all 5
              </text>
            </g>
          )}
          <circle cx={x(res.best.q)} cy={y(res.best.tps)} r={5} className="fill-emerald-500" />
          <text
            x={x(res.best.q)}
            y={y(res.best.tps) - 9}
            textAnchor="middle"
            fontSize={9.5}
            className="fill-emerald-700 font-mono dark:fill-emerald-300"
          >
            chosen
          </text>
        </svg>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 px-4 pb-3 font-mono text-xs sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">drafts verified / req</dt>
          <dd className="text-sm text-foreground">
            {avgVerify.toFixed(2)} <span className="text-muted-foreground">vs 5</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">tokens kept / step</dt>
          <dd className="text-sm text-foreground">
            {accDyn.toFixed(2)} <span className="text-muted-foreground">vs {accFixed.toFixed(2)}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">tok/s per GPU</dt>
          <dd className="text-sm text-foreground">
            {Math.round(res.best.tps).toLocaleString("en-US")}{" "}
            <span className="text-muted-foreground">vs {res.fixed ? Math.round(res.fixed.tps).toLocaleString("en-US") : "n/a"}</span>
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">gain</dt>
          <dd className="text-sm text-foreground">{res.fixed ? `${gain >= 0 ? "+" : ""}${gain.toFixed(1)}%` : "off the curve"}</dd>
        </div>
      </dl>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        The algorithm is DeepInfer&apos;s; the step-time curve is read back from its published decode chart, and the acceptance
        rates are a model (each draft accepted with a fixed chance given the one before). Illustrative, not a measurement.
      </figcaption>
    </figure>
  )
}
