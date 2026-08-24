"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Suffix decay, and the cheapest thing that fixes it.
//
// Every parallel drafter gets worse toward the end of its block: even the top-16
// oracle falls from 99.5% to 87.8%. That is not a selection problem — the
// candidates themselves are running out — so it has to be fixed in the backbone.
//
// Depth fixes it. Tripling the drafter from five layers to fifteen lifts the last
// position by nearly six points. But the curves are almost identical at position
// zero, so ten extra attention blocks are buying capacity where none was needed,
// at 15.2% added draft-verify cycle latency.
//
// The targeted fix comes from a diagnosis: DFlash's attention has two jobs, read
// the context before the block and model dependencies inside it, and it spends
// less and less on the second — within-block attention mass falls from 30% in
// layer 1 to 8% in layer 5, concentrated in a shrinking handful of heads. So give
// the within-block work its own operator: a two-tap dynamic depthwise convolution
// before and after each attention and MLP sublayer, mixing each position with its
// predecessor (and the first with the last verified token).
//
// +3% parameters, +0.7% latency, and it lands on the 15-layer curve. Afterwards,
// average within-block attention across layers 4 and 5 falls from 9.4% to 0.5% —
// the attention hands the job over.
//
// All numbers are the post's Figure 2 table. Plain arithmetic only.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Curve = { key: string; label: string; color: string; dash?: string; v: number[]; cost: string }

const CURVES: Curve[] = [
  {
    key: "3l",
    label: "DFlash 3L",
    color: MUTED,
    dash: "3 3",
    v: [85.21, 79.26, 77.18, 75.75, 73.96, 70.4, 64.97],
    cost: "the small drafter — and it falls apart down the block",
  },
  {
    key: "5l",
    label: "DFlash 5L",
    color: WARM,
    v: [85.39, 80.31, 79.39, 78.27, 77.39, 76.03, 72.86],
    cost: "the shipped baseline",
  },
  {
    key: "15l",
    label: "DFlash 15L",
    color: MUTED,
    dash: "5 3",
    v: [86.42, 81.61, 80.68, 80.34, 80.59, 79.66, 78.73],
    cost: "3× the parameters · +15.2% cycle latency",
  },
  {
    key: "conv",
    label: "DFlash 5L + two-tap conv",
    color: GOOD,
    v: [85.83, 80.94, 79.98, 79.68, 79.73, 79.43, 77.61],
    cost: "+3% parameters · +0.7% cycle latency",
  },
]

// Within-block attention mass by layer, averaged over the 32 heads of the
// five-layer drafter — the diagnosis that motivated the convolution.
const BLOCK_MASS = [
  { layer: 1, pct: 30 },
  { layer: 2, pct: 26 },
  { layer: 3, pct: 20 },
  { layer: 4, pct: 11 },
  { layer: 5, pct: 8 },
]

export function SuffixDecay() {
  const [on, setOn] = useState<string[]>(["5l", "15l", "conv"])
  const toggle = (k: string) => setOn((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]))

  const W = 720
  const H = 200
  const PAD = { l: 40, r: 130, t: 14, b: 30 }
  const iw = W - PAD.l - PAD.r
  const ih = H - PAD.t - PAD.b
  const LO = 62
  const HI = 88
  const X = (i: number) => PAD.l + (i / 6) * iw
  const Y = (v: number) => PAD.t + ih - ((v - LO) / (HI - LO)) * ih
  const line = (a: number[]) => a.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ")

  const decay = (c: Curve) => c.v[0] - c.v[6]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3-4B Recall@1 on GSM8K at T=0 · conditional on every earlier position
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          a kernel reaching one token back ≈ ten more layers
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {CURVES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={on.includes(c.key)}
              className={cn(
                "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on.includes(c.key)
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="inline-block h-[2px] w-3" style={{ background: c.color }} />
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full">
            <title>
              Per-position draft accuracy for three drafter depths and a five-layer drafter with two-tap
              convolutions; all four start together at the first position and fan apart toward the end of the block
            </title>
            {[65, 70, 75, 80, 85].map((g) => (
              <g key={g}>
                <line x1={PAD.l} x2={PAD.l + iw} y1={Y(g)} y2={Y(g)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={4} y={Y(g) + 3} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {g}%
                </text>
              </g>
            ))}

            {CURVES.filter((c) => on.includes(c.key)).map((c) => (
              <g key={c.key}>
                <path d={line(c.v)} fill="none" stroke={c.color} strokeWidth={c.key === "conv" ? 2.5 : 1.5} strokeDasharray={c.dash} />
                <text
                  x={PAD.l + iw + 6}
                  y={Y(c.v[6]) + 3}
                  fontSize={9}
                  fill={c.color}
                  fontFamily="ui-monospace, monospace"
                >
                  {c.label.replace("DFlash ", "")}
                </text>
              </g>
            ))}

            {Array.from({ length: 7 }, (_, i) => (
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

        <div className="mt-3 space-y-1">
          {CURVES.filter((c) => on.includes(c.key)).map((c) => (
            <div key={c.key} className="flex flex-wrap items-baseline gap-2 font-mono text-[10px]">
              <span className="w-44 shrink-0 truncate text-right" style={{ color: c.color }}>
                {c.label}
              </span>
              <span className="w-24 shrink-0 tabular-nums text-foreground">−{decay(c).toFixed(2)} pts</span>
              <span className="text-muted-foreground">{c.cost}</span>
            </div>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">
            the diagnosis — share of attention the drafter spends inside its own block
          </div>
          <div className="mt-2 flex items-end gap-1.5">
            {BLOCK_MASS.map((b) => (
              <div key={b.layer} className="flex-1">
                <div className="flex h-14 items-end">
                  <div className="w-full rounded-sm" style={{ height: `${(b.pct / 32) * 100}%`, background: ACCENT, opacity: 0.85 }} />
                </div>
                <div className="mt-1 text-center font-mono text-[9px] tabular-nums text-muted-foreground">{b.pct}%</div>
                <div className="text-center font-mono text-[9px] text-muted-foreground">L{b.layer}</div>
              </div>
            ))}
          </div>
          <div className="mt-1.5 font-mono text-[9px] text-muted-foreground">
            After the convolution is added, the average across layers 4 and 5 falls from 9.4% to 0.5% — attention
            hands the local job over and goes back to reading context.
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Look at position zero first: all four curves are within a point of each other there. Everything the extra
          depth buys, it buys at the <em>end</em>{" "}of the block — which is the tell that the problem was never
          general capacity. Attention in a parallel drafter is doing two jobs, and by layer five it has almost
          stopped doing the second one.
          <br />
          <br />
          So the fix is a two-tap kernel: each position mixes its own representation with its predecessor&rsquo;s,
          before and after every attention and MLP sublayer, with coefficients that adapt to the content. Blocks
          are four to sixteen tokens long and the tight dependencies are between neighbours, so{" "}
          <span className="text-foreground">reaching exactly one position back recovers most of what ten extra
          Transformer layers buy</span>{" "}— at 3% of the parameters and a twentieth of the latency. Everything
          still computes in parallel; the convolution is block-local and stateless, so it drops in without touching
          attention, the LM head, or verification.
        </p>
      </div>
    </figure>
  )
}
