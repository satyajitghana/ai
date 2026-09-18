"use client"

import { useState } from "react"

import { mlog10, mpow } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

// A first-principles model of when the two-passes-per-cycle mechanic actually
// pays off, not a chart of measured numbers.
//
// Section 4.2 of the paper fixes the only two facts this needs: every Uno
// cycle costs exactly 2 forward passes (one draft, one verify), and a cycle
// emits tau tokens on average, where tau is the measured mean acceptance
// length for a given sampler config and task. AR costs 1 pass per token. So
// for an output of n tokens:
//
//   cycles(n)   = ceil(n / tau)
//   speedup(n)  = n / (2 * cycles(n))            (tokens per pass, relative)
//
// As n grows, cycles(n) ~ n/tau and speedup -> tau/2: the asymptote. At small
// n the ceiling rounds up hard — at n=1, cycles=1 regardless of tau, so
// speedup = 1/2 no matter how predictable the text is. Uno is *slower* than
// plain AR for a one-token reply, by construction, because it still pays for
// a verify pass it didn't need.
//
// tau itself is not invented: the two endpoints are Table 2's measured mean
// acceptance length for UnoQwen's per-request-optimal sampler (B=16, tree
// K=32/V=32, temp=1) on its lowest-tau benchmark (IFEval, 4.58 — open-ended
// instruction following) and its highest (MATH500, 6.89 — structured math).
// The slider interpolates linearly between them; nothing about the shape of
// speedup(n) is fitted or tuned, it falls straight out of the ceiling.

const LOW = { tau: 4.58, label: "IFEval-like (open-ended)" }
const HIGH = { tau: 6.89, label: "MATH500-like (structured)" }

const N_MIN = 32
const N_MAX = 8192
const N_TICKS = [32, 64, 128, 256, 512, 1024, 2048, 4096, 8192]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

// Dense, fixed sample grid in log-space so the sawtooth from the ceiling is
// visible but not aliased. Computed once; only the y-values depend on tau.
const SAMPLES = 240
const LOG_MIN = mlog10(N_MIN)
const LOG_MAX = mlog10(N_MAX)
const N_GRID: number[] = Array.from({ length: SAMPLES + 1 }, (_, i) => {
  const t = i / SAMPLES
  const logN = LOG_MIN + t * (LOG_MAX - LOG_MIN)
  // mpow, not Math.pow: this value is reused below both to compute a plotted
  // y (speedupOf) and, via mlog10 again inside X(), a plotted x — it has to
  // come out byte-identical on server and client or the path's "d" string
  // hydration-mismatches.
  return mpow(10, logN)
})

function speedupOf(n: number, tau: number) {
  const cycles = Math.ceil(n / tau)
  return n / (2 * cycles)
}

export function SpeedupModel() {
  const [mix, setMix] = useState(35) // 0..100, predictability slider
  const [nExp, setNExp] = useState(6) // index into N_TICKS
  const tau = LOW.tau + (HIGH.tau - LOW.tau) * (mix / 100)
  const n = N_TICKS[nExp]

  const cycles = Math.ceil(n / tau)
  const speedup = speedupOf(n, tau)
  const asymptote = tau / 2

  const W = 720
  const H = 220
  const PAD = { l: 34, r: 12, t: 16, b: 28 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const yMax = HIGH.tau / 2 + 0.4

  const X = (v: number) => PAD.l + ((mlog10(v) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * iw
  const Y = (v: number) => PAD.t + ih - (v / yMax) * ih

  const line = (tauLine: number) =>
    N_GRID.map((v, i) => `${i === 0 ? "M" : "L"}${X(v).toFixed(1)},${Y(speedupOf(v, tauLine)).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          speedup(n) = n / (2 × ⌈n / τ⌉) · τ = mean tokens/cycle
        </span>
        <span className="font-mono text-[10px]" style={{ color: ACCENT }}>
          asymptote τ/2 = {asymptote.toFixed(2)}×
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              Speedup versus output length on a log axis, for the low- and high-predictability endpoints and the
              interpolated setting. Every curve starts at 0.5x for a one-token reply and rises, with diminishing
              ripples, toward its own tau-over-2 ceiling as output length grows.
            </title>

            {[1, 2, 3].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.08} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g}×
                </text>
              </g>
            ))}
            <line x1={PAD.l} x2={PAD.l + iw} y1={Y(1)} y2={Y(1)} stroke={MUTED} strokeOpacity={0.5} strokeDasharray="2 3" />

            <line x1={X(n)} x2={X(n)} y1={PAD.t} y2={PAD.t + ih} stroke="currentColor" strokeOpacity={0.12} />

            <path d={line(LOW.tau)} fill="none" stroke={WARM} strokeWidth={1.3} strokeOpacity={0.55} strokeDasharray="3 3" />
            <path d={line(HIGH.tau)} fill="none" stroke={GOOD} strokeWidth={1.3} strokeOpacity={0.55} strokeDasharray="3 3" />
            <line
              x1={PAD.l}
              x2={PAD.l + iw}
              y1={Y(asymptote)}
              y2={Y(asymptote)}
              stroke={ACCENT}
              strokeOpacity={0.35}
              strokeDasharray="5 3"
            />
            <path d={line(tau)} fill="none" stroke={ACCENT} strokeWidth={2.4} />
            <circle cx={X(n)} cy={Y(speedup)} r={4} fill={ACCENT} />

            {N_TICKS.filter((_, i) => i % 2 === 0).map((v) => (
              <text
                key={v}
                x={X(v)}
                y={PAD.t + ih + 14}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.45}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {v}
              </text>
            ))}
            <text x={PAD.l + iw / 2} y={H - 2} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              output length n (tokens, log scale)
            </text>

            <text x={X(N_MAX) - 4} y={Y(HIGH.tau / 2) - 6} fontSize={9} fill={GOOD} textAnchor="end" fontFamily="ui-monospace, monospace">
              MATH500-like (τ={HIGH.tau})
            </text>
            <text x={X(N_MAX) - 4} y={Y(LOW.tau / 2) + 12} fontSize={9} fill={WARM} textAnchor="end" fontFamily="ui-monospace, monospace">
              IFEval-like (τ={LOW.tau})
            </text>
          </svg>
        </div>

        <div className="mt-3 space-y-2.5">
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">predictability</span>
            <Range
              min={0}
              max={100}
              step={1}
              value={mix}
              onChange={(e) => setMix(Number(e.target.value))}
              className="flex-1"
              aria-label="task predictability, interpolating tau between the IFEval and MATH500 endpoints"
              accent={ACCENT}
            />
            <span className="w-32 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              τ = {tau.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">output length</span>
            <Range
              min={0}
              max={N_TICKS.length - 1}
              step={1}
              value={nExp}
              onChange={(e) => setNExp(Number(e.target.value))}
              className="flex-1"
              aria-label="output length in tokens"
              accent={ACCENT}
            />
            <span className="w-32 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              n = {n}
            </span>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          At n = <span className="font-mono text-foreground">{n}</span>{" "}tokens: {cycles}{" "}
          cycle{cycles === 1 ? "" : "s"}, {cycles * 2}{" "}passes, speedup{" "}
          <span className="font-mono text-foreground">{speedup.toFixed(2)}×</span>. Ceiling for this τ:{" "}
          <span className="font-mono text-foreground">{asymptote.toFixed(2)}×</span>.
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both curves start at the same place: <span className="text-foreground">0.5×</span>{" "}at n=1, because
          a single-token reply still costs a draft pass and a verify pass to produce one accepted token — Uno is
          slower than plain autoregressive decoding until the output is long enough to amortize that second pass.
          Only past a few hundred tokens do the curves separate, and only then does predictability start to matter:
          the structured, high-τ end of the slider converges to a ceiling{" "}
          <span className="text-foreground">50% higher</span>{" "}than the open-ended, low-τ end. Neither curve
          needed a batch-size story to explain this — it is the same 2-passes-per-cycle arithmetic from Sec. 4.2,
          run out to different output lengths.
        </p>
      </div>
    </figure>
  )
}
