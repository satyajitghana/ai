"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The time-attention mask Timestral builds for one decode block without covariates
// (masks.py, build_forecast_time_mask): the sequence is [Enc ; Dec], context patches
// followed by h copies of one learned forecast-query token.
//   Enc -> Enc  causal (a patch reads itself and earlier patches)
//   Enc -> Dec  never (the context never reads the horizon)
//   Dec -> Enc  every valid context patch
//   Dec -> Dec  causal along the horizon
// Leading all-missing patches are left padding and never valid keys.
// The lower panel does the real-size arithmetic from config.json and forecaster.py.

const ENC = "oklch(0.58 0.13 250)"
const DEC = "oklch(0.66 0.15 45)"

const PATCH = 32
const BLOCK = 32
const MAXCTX = 32768

export function DhfMask() {
  const [L, setL] = useState(6)
  const [h, setHh] = useState(3)
  const [pad, setPad] = useState(1)

  const n = L + h
  const cell = Math.min(26, Math.floor(300 / n))
  const size = cell * n
  const lab = 44

  const canAttend = (q: number, k: number) => {
    const kValid = k >= L || k >= pad
    if (q < L) return k <= q && (kValid || k === q)
    if (k < L) return kValid
    return k <= q
  }

  const [ctxSteps, setCtx] = useState(4096)
  const [hor, setHor] = useState(96)
  const used = Math.min(ctxSteps, MAXCTX)
  const ctxPatches = Math.ceil(used / PATCH)
  const horPatches = Math.ceil(hor / PATCH)
  const blocks = Math.ceil(horPatches / BLOCK)
  const tokens = ctxPatches + Math.min(horPatches, BLOCK)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        decoupled horizon forecasting · the time-attention mask, from masks.py
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>context patches</span>
              <span className="text-base font-semibold" style={{ color: ENC }}>{L}</span>
            </span>
            <Range min={2} max={10} step={1} value={L} accent={ENC} onChange={(e) => { const v = Number(e.target.value); setL(v); setPad(Math.min(pad, v - 1)) }}
              aria-label="Context patches" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>forecast tokens</span>
              <span className="text-base font-semibold" style={{ color: DEC }}>{h}</span>
            </span>
            <Range min={1} max={6} step={1} value={h} accent={DEC} onChange={(e) => setHh(Number(e.target.value))}
              aria-label="Forecast tokens" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>left-padding patches</span>
              <span className="text-base font-semibold">{pad}</span>
            </span>
            <Range min={0} max={L - 1} step={1} value={pad} onChange={(e) => setPad(Number(e.target.value))}
              aria-label="Left padding patches" className="mt-1 w-full" />
          </label>
        </div>

        <svg viewBox={`0 0 ${size + lab + 8} ${size + lab + 8}`} className="mx-auto block w-full max-w-sm" role="img"
          aria-label={`Attention mask over ${L} context patches and ${h} forecast tokens; rows are queries, columns are keys`}>
          <text x={lab + size / 2} y={12} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}>keys</text>
          <text x={10} y={lab + size / 2} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.6}
            transform={`rotate(-90 10 ${lab + size / 2})`}>queries</text>
          {Array.from({ length: n }, (_, i) => (
            <g key={`l${i}`}>
              <text x={lab + i * cell + cell / 2} y={lab - 6} textAnchor="middle" fontSize={9}
                fill={i < L ? ENC : DEC}>{i < L ? (i < pad ? "·" : `c${i + 1}`) : `f${i - L + 1}`}</text>
              <text x={lab - 6} y={lab + i * cell + cell / 2 + 3} textAnchor="end" fontSize={9}
                fill={i < L ? ENC : DEC}>{i < L ? (i < pad ? "·" : `c${i + 1}`) : `f${i - L + 1}`}</text>
            </g>
          ))}
          {Array.from({ length: n }, (_, q) =>
            Array.from({ length: n }, (_, k) => {
              const ok = canAttend(q, k)
              return (
                <rect key={`${q}-${k}`} x={lab + k * cell + 1} y={lab + q * cell + 1} width={cell - 2} height={cell - 2} rx={2}
                  fill={ok ? (q < L ? ENC : DEC) : "currentColor"} opacity={ok ? 0.85 : 0.07} />
              )
            }),
          )}
          <line x1={lab + L * cell} x2={lab + L * cell} y1={lab} y2={lab + size} stroke="currentColor" opacity={0.5} />
          <line x1={lab} x2={lab + size} y1={lab + L * cell} y2={lab + L * cell} stroke="currentColor" opacity={0.5} />
        </svg>

        <p className="font-mono text-[11px] text-muted-foreground">
          Blue rows: context patches read themselves and earlier patches. Orange rows: forecast tokens read every valid context
          patch and the forecast tokens before them. The top-right quadrant is empty, so the context never sees the horizon.
          Padding patches (·) are never read.
        </p>

        <div className="grid gap-4 border-t pt-4 sm:grid-cols-2">
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>history you pass (steps)</span>
              <span className="text-base font-semibold">{ctxSteps.toLocaleString("en-US")}</span>
            </span>
            <Range min={64} max={65536} step={64} value={ctxSteps} onChange={(e) => setCtx(Number(e.target.value))}
              aria-label="History length in steps" className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex items-baseline justify-between font-mono text-xs">
              <span>horizon (steps)</span>
              <span className="text-base font-semibold">{hor.toLocaleString("en-US")}</span>
            </span>
            <Range min={1} max={4096} step={1} value={hor} onChange={(e) => setHor(Number(e.target.value))}
              aria-label="Horizon in steps" className="mt-1 w-full" />
          </label>
        </div>
        <div className="grid gap-2 font-mono text-xs sm:grid-cols-4">
          <div className="rounded border px-3 py-2"><div className="text-muted-foreground">steps read</div>{used.toLocaleString("en-US")}{ctxSteps > MAXCTX ? " (oldest dropped)" : ""}</div>
          <div className="rounded border px-3 py-2"><div className="text-muted-foreground">context tokens</div>{ctxPatches.toLocaleString("en-US")} patches</div>
          <div className="rounded border px-3 py-2"><div className="text-muted-foreground">first-pass sequence</div>{tokens.toLocaleString("en-US")} tokens</div>
          <div className="rounded border px-3 py-2"><div className="text-muted-foreground">decode blocks</div>{blocks} × 2 passes{blocks > 1 ? ", medians fed back" : ""}</div>
        </div>
      </div>
    </figure>
  )
}
