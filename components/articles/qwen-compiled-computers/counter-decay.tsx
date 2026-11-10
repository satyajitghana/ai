"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { FIRST_NON_DECREASING, FIRST_ZERO, LOG2_X } from "./counter-data"

// The qwenFS offset counter: one Gated DeltaNet head that writes 20 at an anchor token and then lets the gate decay
// it by alpha = exp(-softplus(-3.125)) per token. The curve is MEASURED (counter.py, transformers' reference
// recurrence and gated RMSNorm, bf16 activations). The decoder below is qwenFS's thermometer rule: unit j fires when
// the value is under the geometric mean of the values at j - 1 and j, so the count of firing units is n.

const NMAX = 600
const N = LOG2_X.length - 1
const W = 640
const H = 220
const PADL = 52
const PADB = 28
const YMIN = -130
const YMAX = 0

const sx = (n: number) => PADL + (n / N) * (W - PADL - 12)
const sy = (l: number) => 10 + ((YMAX - l) / (YMAX - YMIN)) * (H - PADB - 10)

function decode(n: number): number {
  // the thermometer: count thresholds j = 1..NMAX with x_n below sqrt(x_{j-1} x_j), on log2 values
  const l = LOG2_X[n]
  if (l === null) return NMAX
  let c = 0
  for (let j = 1; j <= NMAX; j++) {
    const a = LOG2_X[j - 1]
    const b = LOG2_X[j]
    if (a === null || b === null) break
    if (l < (a + b) / 2) c++
  }
  return c
}

const PATH = LOG2_X.map((l, n) => (l === null ? null : `${n === 0 ? "M" : "L"}${sx(n).toFixed(1)},${sy(l).toFixed(1)}`))
  .filter(Boolean)
  .join(" ")

export function CounterDecay() {
  const [n, setN] = useState(37)
  const l = LOG2_X[n]
  const d = decode(n)
  const inRange = n <= NMAX
  const ideal = -n / 16

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        qwenFS offset counter · one DeltaNet head, rebuilt on transformers&apos; recurrence · measured, bf16
      </div>
      <div className="flex items-center gap-3 border-b px-4 py-2.5 text-xs">
        <span className="shrink-0 font-mono text-muted-foreground">tokens since anchor</span>
        <Range min={0} max={N} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="tokens since the anchor" className="w-full" />
        <span className="w-12 shrink-0 text-right font-mono tabular-nums">{n}</span>
      </div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="log2 of the counter value against tokens since the anchor: a straight falling line until about 1,737 tokens, then flat steps and zero">
          {[0, -32, -64, -96, -128].map((t) => (
            <g key={t}>
              <line x1={PADL} x2={W - 12} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PADL - 6} y={sy(t) + 3} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
                2^{t}
              </text>
            </g>
          ))}
          <rect x={sx(0)} y={8} width={sx(NMAX) - sx(0)} height={H - PADB - 8} fill="oklch(0.65 0.13 150 / 0.08)" />
          <text x={sx(NMAX) - 4} y={22} fontSize={10} textAnchor="end" className="fill-muted-foreground font-mono">
            qwenFS decodes 0..600
          </text>
          <line x1={sx(FIRST_NON_DECREASING)} x2={sx(FIRST_NON_DECREASING)} y1={8} y2={H - PADB} stroke="oklch(0.62 0.18 25)" strokeDasharray="3 3" />
          <text x={sx(FIRST_NON_DECREASING) - 4} y={H - PADB - 8} fontSize={10} textAnchor="end" fill="oklch(0.62 0.18 25)" className="font-mono">
            first repeat, n = {FIRST_NON_DECREASING}
          </text>
          <path d={PATH} fill="none" stroke="oklch(0.6 0.14 250)" strokeWidth={1.6} />
          {l !== null && <circle cx={sx(n)} cy={sy(l)} r={4.5} fill="oklch(0.6 0.14 250)" stroke="var(--background)" strokeWidth={1.5} />}
          {[0, 600, 1200, 1800].map((t) => (
            <text key={t} x={sx(t)} y={H - 8} fontSize={10} textAnchor="middle" className="fill-muted-foreground font-mono">
              {t}
            </text>
          ))}
        </svg>
        <dl className="mt-3 grid gap-x-6 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">value the head writes</dt>
            <dd className="tabular-nums">{l === null ? "0 (underflow)" : `2^${l.toFixed(2)}`}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">if alpha were exactly 2^(-1/16)</dt>
            <dd className="tabular-nums">x0 · 2^{ideal.toFixed(2)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">thermometer reads</dt>
            <dd className="tabular-nums">
              {inRange ? (
                <span className={d === n ? "" : "text-red-600 dark:text-red-400"}>
                  n = {d} {d === n ? "(exact)" : "(wrong)"}
                </span>
              ) : (
                <span className="text-muted-foreground">past 600: every unit on, reads {d}</span>
              )}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted-foreground">
          The line is straight on a log axis because the gate multiplies the state by the same factor every token. bf16
          keeps eight significant bits at every exponent, so a value that halves every 16 tokens stays distinct for
          hundreds of tokens. It stops being distinct at n = {FIRST_NON_DECREASING}, where the head&apos;s output falls into
          fp32&apos;s subnormal range, and reads exactly 0 from n = {FIRST_ZERO}.
        </p>
      </div>
    </figure>
  )
}
