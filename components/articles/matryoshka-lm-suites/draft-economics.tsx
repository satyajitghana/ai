"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"

// Why a 1:6 draft-to-verifier ratio is normally a losing bet, and what nesting
// changes about it.
//
// The expected number of tokens emitted per speculative cycle, for acceptance
// rate a and draft length g, is the standard geometric sum:
//
//   E[emitted] = (1 - a^(g+1)) / (1 - a)
//
// (Leviathan et al.) It saturates: past a certain draft length the marginal token
// is almost never reached, while its drafting cost is paid every cycle. That is
// why the literature uses drafts one to two orders of magnitude smaller than the
// verifier — 60M for 11B, 160M-1B for 7B-70B Llama. A 500M draft against a 3B
// verifier is far outside that range, and the paper measures the consequence: the
// Vanilla 500M/3B pair barely beats plain autoregressive decoding, and under
// nucleus sampling it is slower.
//
// Nesting changes two of the terms, neither of which is the acceptance rate:
//
//   - the draft's KV cache IS the verifier's, for the shared layers, so there is
//     no second cache to hold. Same 80 GB, batch 102 instead of 64.
//   - the verifier only runs the layers the draft did not, since the shared
//     prefix's cache is already computed. 2.70B of new blocks, not 3.20B.
//
// And it improves the acceptance rate as a by-product, since weight sharing plus
// online distillation raise cross-model agreement (+5.7 points on the 1.5B/3B
// pair). The slider below is that third effect in isolation; the boxes are the
// first two. The measured outcome at draft length 6 is 2,650 tok/s against 2,100.
//
// mpow rather than Math.pow — the curve geometry reaches the DOM.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const emitted = (a: number, g: number) => (a >= 1 ? g + 1 : (1 - mpow(a, g + 1)) / (1 - a))

const RESOURCES = [
  {
    l: "draft KV cache",
    van: "a second cache, held alongside the verifier's",
    mat: "none — the shared layers' cache is the verifier's",
  },
  {
    l: "verifier work per cycle",
    van: "all 3.19B parameters, every verification",
    mat: "only the 2.70B of blocks above the draft",
  },
  {
    l: "max batch in 80 GB",
    van: "64",
    mat: "102",
  },
  {
    l: "throughput at draft length 6, greedy",
    van: "2,100 tok/s",
    mat: "2,650 tok/s",
  },
]

export function DraftEconomics() {
  const [base, setBase] = useState(72)
  const gap = 5.7
  const aV = base / 100
  const aM = Math.min(0.99, (base + gap) / 100)

  const W = 720
  const H = 186
  const PAD = { l: 42, r: 120, t: 14, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const GMAX = 10
  const YMAX = 6
  const X = (g: number) => PAD.l + (g / GMAX) * iw
  const Y = (v: number) => PAD.t + ih - (Math.min(v, YMAX) / YMAX) * ih
  const curve = (a: number) =>
    Array.from({ length: GMAX + 1 }, (_, g) => `${g === 0 ? "M" : "L"}${X(g).toFixed(1)},${Y(emitted(a, g)).toFixed(1)}`).join(" ")

  const at6V = emitted(aV, 6)
  const at6M = emitted(aM, 6)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          E[emitted] = (1 − a<sup>γ+1</sup>) / (1 − a) · 500M draft, 3B verifier, A100
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          +{(at6M - at6V).toFixed(2)} tokens per cycle at γ = 6
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              Expected tokens emitted per speculative cycle against draft length, for two acceptance rates
              differing by the measured cross-model agreement gap; both curves flatten as the draft lengthens
            </title>
            {[0, 2, 4, 6].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g}
                </text>
              </g>
            ))}

            <path d={curve(aV)} fill="none" stroke={WARM} strokeWidth={2} />
            <path d={curve(aM)} fill="none" stroke={GOOD} strokeWidth={2} />

            <line x1={X(6)} y1={PAD.t} x2={X(6)} y2={PAD.t + ih} stroke={ACCENT} strokeDasharray="2 3" strokeOpacity={0.6} />
            <circle cx={X(6)} cy={Y(at6V)} r={3.5} fill={WARM} />
            <circle cx={X(6)} cy={Y(at6M)} r={3.5} fill={GOOD} />

            <text x={PAD.l + iw + 6} y={Y(emitted(aM, GMAX)) + 3} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
              nested · {(aM * 100).toFixed(1)}%
            </text>
            <text x={PAD.l + iw + 6} y={Y(emitted(aV, GMAX)) + 14} fontSize={9} fill={WARM} fontFamily="ui-monospace, monospace">
              independent · {(aV * 100).toFixed(1)}%
            </text>

            {[0, 2, 4, 6, 8, 10].map((g) => (
              <text
                key={g}
                x={X(g)}
                y={PAD.t + ih + 14}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.45}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {g}
              </text>
            ))}
            <text x={PAD.l + iw / 2} y={H - 2} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              draft length γ — every one of these tokens is paid for whether accepted or not
            </text>
          </svg>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">agreement rate</span>
          <Range
            min={40}
            max={92}
            step={0.5}
            value={base}
            onChange={(e) => setBase(Number(e.target.value))}
            className="flex-1"
            aria-label="next-token agreement rate of the independently trained pair"
            accent={WARM}
          />
          <span className="w-28 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {base.toFixed(1)}% → {(base + gap).toFixed(1)}%
          </span>
        </div>

        <div className="mt-3 space-y-1">
          <div className="flex items-baseline gap-2 font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            <span className="w-56 shrink-0 text-right">what nesting removes</span>
            <span className="flex-1">independent suite</span>
            <span className="flex-1">Matryoshka suite</span>
          </div>
          {RESOURCES.map((r) => (
            <div key={r.l} className="flex items-baseline gap-2 font-mono text-[10px]">
              <span className="w-56 shrink-0 truncate text-right text-foreground">{r.l}</span>
              <span className="flex-1" style={{ color: WARM }}>
                {r.van}
              </span>
              <span className="flex-1" style={{ color: GOOD }}>
                {r.mat}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Both curves flatten, and that flattening is the whole reason drafts are usually tiny. Past a certain
          length the marginal drafted token is almost never reached, but you pay to generate it on every single
          cycle — so drafting cost grows linearly while the return saturates. At a 1:6 ratio the draft is
          expensive enough that the two lines cross, which is exactly what the paper measures: the independently
          trained 500M/3B pair{" "}
          <span className="text-foreground">barely beats plain autoregressive decoding, and loses to it under
          nucleus sampling</span>.
          <br />
          <br />
          Nesting attacks that from three directions at once, and only one of them is the curve above. Sharing the
          KV cache removes the draft&rsquo;s memory footprint entirely, which is worth a 59% larger batch in the
          same 80 GB. Sharing the layers means verification runs 2.70B of new blocks instead of 3.19B of
          everything. And weight sharing plus free online distillation raise the agreement rate, which is the one
          term everyone already optimizes. The same configuration that was a losing bet becomes a 26% speedup.
        </p>
      </div>
    </figure>
  )
}
