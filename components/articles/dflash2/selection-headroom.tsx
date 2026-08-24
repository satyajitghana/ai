"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// The measurement the whole of DFlash 2 is built on.
//
// A parallel drafter predicts every position of the block at once. Table 1 of the
// post reports, for each draft position, how often its top pick is correct
// (Recall@1) and how often the correct token appears anywhere in its top 16
// (Recall@16) — each conditioned on every earlier position already being right,
// which is exactly the condition speculative verification imposes.
//
// Acceptance length follows directly from those conditional rates. A block is
// accepted up to its first mistake, and the verifier contributes one token of its
// own, so
//
//   E[accepted] = 1 + sum_t prod_{i<=t} r_i
//
// With the Recall@1 row that evaluates to 4.27, and with Recall@16 — an oracle
// that always picks correctly from the shortlist — 6.79. Both reproduce the
// post's numbers exactly, which is how you know the two tables are describing the
// same quantity.
//
// The slider interpolates each position's rate between the two rows. It is not a
// claim that a selector of "quality x" achieves that rate; it is a way to see how
// much acceptance length a selector has to play for. DFlash 2's actual pairwise
// selector lands at 4.61 on this setup.
//
// Products and sums only — no lib/dmath needed.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const R1 = [0.854, 0.803, 0.794, 0.783, 0.775, 0.759, 0.729]
const R16 = [0.995, 0.973, 0.948, 0.926, 0.908, 0.894, 0.878]

// Measured points on this exact setup (five-layer Qwen3-4B DFlash, GSM8K).
const MARKS = [
  { l: "DFlash — take each position's top pick", v: 4.27, c: WARM },
  { l: "+ DSpark-style sequential correction (+77.8M params, +9.6% latency)", v: 4.49, c: ACCENT },
  { l: "+ DFlash 2 pairwise path selector (+2.0M params, +0.6% latency)", v: 4.61, c: GOOD },
  { l: "oracle: always pick correctly from the top 16", v: 6.79, c: "oklch(0.62 0.03 250)" },
]

const acceptance = (rates: number[]) => {
  let cum = 1
  let total = 1
  for (const r of rates) {
    cum *= r
    total += cum
  }
  return total
}

export function SelectionHeadroom() {
  const [mix, setMix] = useState(0)
  const rates = R1.map((a, i) => a + (R16[i] - a) * mix)
  const acc = acceptance(rates)

  const W = 720
  const H = 190
  const PAD = { l: 40, r: 16, t: 16, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const X = (i: number) => PAD.l + (i / (R1.length - 1)) * iw
  const Y = (v: number) => PAD.t + ih - ((v - 0.6) / 0.4) * ih

  const line = (a: number[]) => a.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          five-layer Qwen3-4B DFlash · GSM8K · conditional on every earlier position being right
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          acceptance {acc.toFixed(2)}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              Per-position recall of a parallel drafter: the top pick is right about 85% of the time at the first
              position and decays to 73% by the last, while the correct token is in the top sixteen candidates
              99.5% of the time at first and 87.8% at last
            </title>
            {[0.6, 0.7, 0.8, 0.9, 1.0].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {(g * 100).toFixed(0)}%
                </text>
              </g>
            ))}

            <path d={line(R16)} fill="none" stroke={GOOD} strokeWidth={1.5} strokeDasharray="4 3" />
            <path d={line(R1)} fill="none" stroke={WARM} strokeWidth={1.5} strokeDasharray="4 3" />
            <path d={line(rates)} fill="none" stroke={ACCENT} strokeWidth={2.5} />

            {rates.map((v, i) => (
              <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={ACCENT} />
            ))}

            <text x={X(6) - 4} y={Y(R16[6]) - 8} fontSize={9} fill={GOOD} textAnchor="end" fontFamily="ui-monospace, monospace">
              in the top 16
            </text>
            <text x={X(6) - 4} y={Y(R1[6]) + 14} fontSize={9} fill={WARM} textAnchor="end" fontFamily="ui-monospace, monospace">
              the top pick
            </text>

            {R1.map((_, i) => (
              <text
                key={i}
                x={X(i)}
                y={PAD.t + ih + 14}
                fontSize={9}
                fill="currentColor"
                fillOpacity={0.45}
                textAnchor="middle"
                fontFamily="ui-monospace, monospace"
              >
                {i}
              </text>
            ))}
            <text x={PAD.l + iw / 2} y={H - 2} fontSize={9} fill="currentColor" fillOpacity={0.5} textAnchor="middle" fontFamily="ui-monospace, monospace">
              draft position
            </text>
          </svg>
        </div>

        <div className="mt-3 flex items-center gap-2">
          <span className="w-28 shrink-0 font-mono text-[10px] text-muted-foreground">selector quality</span>
          <Range
            min={0}
            max={100}
            step={1}
            value={mix * 100}
            onChange={(e) => setMix(Number(e.target.value) / 100)}
            className="flex-1"
            aria-label="how far the selector closes the gap from the top pick to the top-16 oracle"
            accent={ACCENT}
          />
          <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {mix === 0 ? "top pick" : mix === 1 ? "oracle" : `${(mix * 100).toFixed(0)}% of the way`}
          </span>
        </div>

        <div className="mt-3 space-y-1">
          {MARKS.map((m) => (
            <div key={m.l} className="flex items-center gap-2">
              <span className="hidden w-72 shrink-0 truncate text-right font-mono text-[10px] text-foreground sm:inline">
                {m.l}
              </span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(m.v / 8) * 100}%`, background: m.c }} />
              </div>
              <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: m.c }}>
                {m.v.toFixed(2)}
              </span>
            </div>
          ))}
          <div className="flex items-center gap-2 pt-0.5">
            <span className="hidden w-72 shrink-0 truncate text-right font-mono text-[10px] sm:inline" style={{ color: ACCENT }}>
              your slider
            </span>
            <div className="h-4 flex-1 rounded-sm bg-muted/40">
              <div className="h-4 rounded-sm" style={{ width: `${(acc / 8) * 100}%`, background: ACCENT, opacity: 0.6 }} />
            </div>
            <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
              {acc.toFixed(2)}
            </span>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two dashed lines are the entire argument. At the first draft position the top pick is right{" "}
          <span className="text-foreground">85.4%</span>{" "}of the time — but the right token is somewhere in the top
          sixteen <span className="text-foreground">99.5%</span>{" "}of the time. The drafter is not failing to know
          the answer. It is failing to <em>choose</em>{" "}it.
          <br />
          <br />
          Turn those rates into acceptance length and the gap is 4.27 against 6.79, more than two and a half tokens
          per verification pass sitting in a shortlist the drafter already computed. DFlash 2 claims about 0.34 of
          it with two million parameters. DSpark&rsquo;s sequential rewrite claims 0.22 with seventy-eight million.
          Choosing really is cheaper than predicting — and the oracle says most of the headroom is still there.
        </p>
      </div>
    </figure>
  )
}
