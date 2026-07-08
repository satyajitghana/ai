"use client"

import { useState } from "react"

import { ATT, FigureCard, Legend, WARM } from "./shared"

// Differential attention (Ye / Microsoft 2024). A query computes TWO softmax maps and
// returns their difference:  (softmax(Q₁K₁ᵀ/√d) − λ·softmax(Q₂K₂ᵀ/√d))·V.
// Both maps carry the same broadband "attention noise" — mass smeared over irrelevant
// tokens because softmax must sum to 1 — so subtracting one from the other cancels the
// common-mode part and leaves the sparse signal, like a differential amplifier. Drag λ
// from 0 (plain, noisy attention) up to watch the noise floor cancel. Deterministic.

const N = 16
const SIGNAL = new Set([3, 11]) // the genuinely relevant keys

function noise(k: number) {
  // broadband, correlated across both maps (the common-mode part)
  return 0.35 + 0.3 * (Math.sin(k * 1.7) * 0.5 + Math.cos(k * 0.9 + 1) * 0.5 + 1) / 2
}
function signal(k: number) {
  return SIGNAL.has(k) ? 2.6 : 0
}
function softmax(xs: number[]) {
  const m = Math.max(...xs)
  const ex = xs.map((x) => Math.exp(x - m))
  const s = ex.reduce((a, b) => a + b, 0)
  return ex.map((e) => e / s)
}

const W = 720
const ROWH = 78
const MX = 40
const bw = (W - 2 * MX) / N
const bx = (k: number) => MX + k * bw

function BarRow({
  y,
  weights,
  color,
  label,
  signed,
}: {
  y: number
  weights: number[]
  color: string
  label: string
  signed?: boolean
}) {
  const max = Math.max(...weights.map(Math.abs), 0.001)
  const base = y + ROWH - 20
  return (
    <g>
      <text x={MX} y={y + 12} className="fill-muted-foreground font-mono" fontSize={10}>
        {label}
      </text>
      <line x1={MX} x2={W - MX} y1={base} y2={base} stroke="var(--border)" strokeWidth={1} />
      {weights.map((w, k) => {
        const h = (Math.abs(w) / max) * 40
        const isSig = SIGNAL.has(k)
        const neg = signed && w < 0
        return (
          <rect
            key={k}
            x={bx(k) + 2}
            y={neg ? base : base - h}
            width={bw - 4}
            height={h}
            rx={2}
            fill={isSig && !signed ? ATT : isSig ? ATT : color}
            opacity={isSig ? 0.9 : 0.4}
            className="transition-all duration-300"
          />
        )
      })}
    </g>
  )
}

export function DifferentialAttention() {
  const [lambda, setLambda] = useState(0.8)

  const raw1 = Array.from({ length: N }, (_, k) => signal(k) + noise(k))
  const raw2 = Array.from({ length: N }, (_, k) => 0.25 * signal(k) + noise(k))
  const w1 = softmax(raw1)
  const w2 = softmax(raw2)
  const diff = w1.map((w, k) => w - lambda * w2[k])
  // renormalise positive part for the "effective attention" readout
  const pos = diff.map((d) => Math.max(0, d))
  const posSum = pos.reduce((a, b) => a + b, 0) || 1

  const sigMass = (ws: number[]) => [...SIGNAL].reduce((s, k) => s + Math.max(0, ws[k]), 0)
  const totMass = (ws: number[]) => ws.reduce((s, w) => s + Math.max(0, w), 0) || 1
  const snr1 = sigMass(w1) / totMass(w1)
  const snrD = sigMass(pos) / posSum

  return (
    <FigureCard label="differential attention · cancel the common-mode noise">
      <svg
        viewBox={`0 0 ${W} 270`}
        className="w-full"
        role="img"
        aria-label={`Two softmax attention maps over ${N} keys share broadband noise on irrelevant tokens; subtracting λ=${lambda.toFixed(2)} times the second from the first cancels that noise and sharpens the two signal keys.`}
      >
        <BarRow y={8} weights={w1} color="var(--muted-foreground)" label="map 1 = softmax(Q₁K₁ᵀ/√d) — signal + noise" />
        <BarRow y={92} weights={w2} color={WARM} label="map 2 = softmax(Q₂K₂ᵀ/√d) — mostly the shared noise" />
        <BarRow y={182} weights={pos} color="var(--muted-foreground)" label={`result = map1 − λ·map2 (λ=${lambda.toFixed(2)}) — noise cancelled`} />
      </svg>

      <div className="mt-1">
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>λ (subtraction strength · learnable in the real model)</span>
          <span className="tabular-nums text-foreground">{lambda.toFixed(2)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={1}
          step={0.02}
          value={lambda}
          onChange={(e) => setLambda(Number(e.target.value))}
          className="w-full cursor-pointer"
          style={{ accentColor: ATT }}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 font-mono text-[11px] text-muted-foreground">
        <span>
          signal share, map 1: <span className="tabular-nums" style={{ color: "var(--muted-foreground)" }}>{(snr1 * 100).toFixed(0)}%</span>
        </span>
        <span>
          signal share, result: <span className="tabular-nums" style={{ color: ATT }}>{(snrD * 100).toFixed(0)}%</span>
        </span>
        <span className="ml-auto text-foreground">{(snrD / snr1).toFixed(1)}× cleaner</span>
      </div>

      <Legend
        items={[
          { color: ATT, label: "relevant key (signal)" },
          { color: WARM, label: "second map" },
          { color: "var(--muted-foreground)", label: "attention on other keys", op: 0.4 },
        ]}
      />

      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Softmax attention always spends some mass on tokens that do not matter — it has to, because the weights are
        forced to sum to 1. Differential attention computes the map <em>twice</em> with separate projections and returns
        the difference. The irrelevant mass is roughly common to both maps, so it subtracts away, while the genuine
        peaks — which differ between the two — survive. <span className="text-foreground">λ</span> is learned per head
        (reparameterised, initialised around 0.8), and the reported effect is sparser, less "distracted" attention and
        better long-context retrieval.
      </p>
    </FigureCard>
  )
}
