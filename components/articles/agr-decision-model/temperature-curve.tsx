"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mpow } from "@/lib/dmath"

// The two temperature rules, as their checkpoints ship them (measured from the
// files): CommandCode/agr config.json "temperature_by_options" {a: 1.25,
// b: -0.05, min: 0.05}, and Mapika/decider-chat-gemma4-31b decider_config.json
// {a: 10.124, b: -1.633, min: 0.05}, which reads stock Gemma 4 31B IT weights.
// Both compute T(n) = max(min, a + b ln n) for a question with n options. The
// "logit gap" demo below is illustrative: a top option ahead of n-1 equal rivals.

const AGR = { a: 1.25, b: -0.05, min: 0.05 }
const STOCK = { a: 10.124, b: -1.633, min: 0.05 }

function temp(r: { a: number; b: number; min: number }, n: number) {
  return Math.max(r.min, r.a + r.b * mlog(Math.max(n, 2)))
}

function pTop(gap: number, n: number, t: number) {
  const e = mexp(gap / t)
  return e / (e + (n - 1))
}

function conf(p: number, n: number) {
  return (p - 1 / n) / (1 - 1 / n)
}

const W = 320
const H = 150
const PAD = { l: 30, r: 8, t: 8, b: 22 }
const NMAX = 255
const TMAX = 10

function x(n: number) {
  return PAD.l + ((mlog(n) - mlog(2)) / (mlog(NMAX) - mlog(2))) * (W - PAD.l - PAD.r)
}
function y(t: number) {
  return H - PAD.b - (t / TMAX) * (H - PAD.t - PAD.b)
}

function path(r: { a: number; b: number; min: number }) {
  const pts: string[] = []
  for (let i = 0; i <= 60; i++) {
    const n = Math.round(2 * mpow(NMAX / 2, i / 60))
    pts.push(`${x(n).toFixed(1)},${y(temp(r, n)).toFixed(1)}`)
  }
  return `M${pts.join("L")}`
}

const NS = [2, 3, 4, 5, 8, 10, 16, 26, 32, 64, 128, 255]

export function TemperatureCurve() {
  const [ni, setNi] = useState(2)
  const [gap, setGap] = useState(4)
  const n = NS[ni]
  const tA = temp(AGR, n)
  const tS = temp(STOCK, n)

  const rows = [
    { label: "T = 1 (raw softmax)", t: 1 },
    { label: `Agr, T(${n}) = ${tA.toFixed(3)}`, t: tA },
    { label: `stock Gemma readout, T(${n}) = ${tS.toFixed(3)}`, t: tS },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the fitted temperature, T(n) = max(min, a + b ln n), for two checkpoints of the same Gemma
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2">
        <div>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Temperature against option count: Agr's curve stays near 1.2 to 1.0, the stock-weights readout falls from about 9 at two options to about 1 at 255.">
            {[0, 2, 4, 6, 8, 10].map((t) => (
              <g key={t}>
                <line x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} className="stroke-muted" strokeWidth={0.6} />
                <text x={PAD.l - 4} y={y(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[8px]">
                  {t}
                </text>
              </g>
            ))}
            {[2, 4, 10, 26, 64, 255].map((v) => (
              <text key={v} x={x(v)} y={H - 8} textAnchor="middle" className="fill-muted-foreground font-mono text-[8px]">
                {v}
              </text>
            ))}
            <path d={path(STOCK)} fill="none" className="stroke-amber-500" strokeWidth={2} />
            <path d={path(AGR)} fill="none" className="stroke-sky-600" strokeWidth={2} />
            <line x1={x(n)} x2={x(n)} y1={PAD.t} y2={H - PAD.b} className="stroke-foreground" strokeDasharray="2 2" strokeWidth={0.8} />
            <circle cx={x(n)} cy={y(tA)} r={3} className="fill-sky-600" />
            <circle cx={x(n)} cy={y(tS)} r={3} className="fill-amber-500" />
          </svg>
          <p className="m-0 font-mono text-[10px] text-muted-foreground">
            x: options (log) · y: temperature · <span className="text-sky-600">Agr</span> ·{" "}
            <span className="text-amber-600">decider-chat, stock weights</span>
          </p>
        </div>

        <div className="grid content-start gap-2 font-mono text-[11px]">
          <label className="flex items-center gap-2">
            <span className="w-24 shrink-0">options: {n}</span>
            <Range min={0} max={NS.length - 1} step={1} value={ni} onChange={(e) => setNi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-24 shrink-0">logit gap: {gap}</span>
            <Range min={0} max={20} step={0.5} value={gap} onChange={(e) => setGap(Number(e.target.value))} />
          </label>
          <p className="m-0 text-[10px] text-muted-foreground">
            top option ahead of {n - 1} equal rival{n > 2 ? "s" : ""} by the gap (illustrative)
          </p>
          {rows.map((r) => {
            const p = pTop(gap, n, r.t)
            return (
              <div key={r.label} className="grid gap-0.5">
                <span>{r.label}</span>
                <div className="relative h-4 overflow-hidden rounded-sm bg-muted">
                  <div className="h-full bg-foreground/60" style={{ width: `${(p * 100).toFixed(2)}%` }} />
                  <span className="absolute inset-y-0 left-1 flex items-center font-semibold">
                    top p {p.toFixed(3)} · confidence {conf(p, n).toFixed(3)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        A temperature divides the option logits before the softmax. Agr&apos;s fitted curve sits between 1.215 at two
        options and 0.973 at 255; the stock-weights readout of the same Gemma needs 8.992 at two options. Confidence
        is System One&apos;s (p_max − 1/K) / (1 − 1/K), not an accuracy.
      </figcaption>
    </figure>
  )
}
