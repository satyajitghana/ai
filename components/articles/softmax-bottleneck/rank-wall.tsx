"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The whole paper in one picture.
//
// A softmax language model computes logits as H W^T, where H is (N contexts x d)
// and W is (M tokens x d). Whatever the true log-probability matrix A looks like,
// the product H W^T has rank at most d — the width of the shared middle
// dimension. No amount of depth, width, or universal approximation in the network
// that PRODUCES h_c can raise that ceiling, because the ceiling is a property of
// the factorization, not of the function class.
//
// So the bar drawn here is not an estimate. rank(H W^T) <= min(N, M, d) is
// linear algebra. The open question — the part the paper argues rather than
// proves — is how high rank(A) actually is for natural language.

type Preset = { id: string; label: string; d: number; m: number; note: string }

const PRESETS: Preset[] = [
  { id: "ptb", label: "the paper's PTB softmax", d: 400, m: 10000, note: "measured empirical rank: exactly 400" },
  { id: "moc", label: "the paper's MoC baseline", d: 280, m: 10000, note: "measured empirical rank: exactly 280" },
  { id: "qwen06", label: "Qwen3-0.6B", d: 1024, m: 151936, note: "tied embeddings, 151,936-token vocab" },
  { id: "dsv3", label: "DeepSeek-V3", d: 7168, m: 129280, note: "the widest hidden state here" },
]

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"

export function RankWall() {
  const [d, setD] = useState(400)
  const [m, setM] = useState(10000)

  const ratio = m / d
  // The two "easy fixes" the paper prices out, in output-layer parameters.
  const softmaxParams = m * d
  const bigSoftmaxParams = m * m

  // Draw all three matrices at one shared scale: |V| always occupies W drawn
  // pixels, so d occupies (d/m)*W. When d exceeds the vocabulary the bound stops
  // binding and there is nothing left to show, so the drawn width clamps at W.
  const W = 240 // drawn px for the |V| dimension
  const dW = Math.min(W, Math.max(3, (d / m) * W))
  const COL2 = 40 + W + 34 // Wt block x
  const COL3 = COL2 + W + 34 // A block x

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the output layer, drawn to scale</span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          rank ≤ {d.toLocaleString()} of {m.toLocaleString()}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox="0 0 866 196" className="w-full min-w-[600px]" role="img" aria-label={`Matrix factorization drawn to scale: an N by ${d} context matrix times a ${d} by ${m} embedding matrix produces an N by ${m} logit matrix whose rank cannot exceed ${d}`}>
            <defs>
              <pattern id="sb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                <rect width="6" height="6" fill="transparent" />
                <line x1="0" y1="0" x2="0" y2="6" stroke={WARM} strokeWidth="1.6" opacity="0.45" />
              </pattern>
            </defs>

            {/* H: N x d */}
            <rect x="40" y="46" width={dW} height="104" fill={ACCENT} opacity="0.3" stroke={ACCENT} strokeWidth="1" />
            <text x={40 + dW / 2} y="38" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              d
            </text>
            <text x="27" y="98" textAnchor="middle" transform="rotate(-90 27 98)" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              N
            </text>
            <text x="40" y="174" className="fill-foreground" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
              H — one row per context
            </text>

            <text x={(40 + dW + COL2) / 2} y="103" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 15 }}>
              ×
            </text>

            {/* Wt: d x |V| — same scale, so its height is the same d */}
            <rect x={COL2} y={98 - dW / 2} width={W} height={dW} fill={ACCENT} opacity="0.3" stroke={ACCENT} strokeWidth="1" />
            <text x={COL2 + W / 2} y="38" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              |V|
            </text>
            <text x={COL2 - 13} y="98" textAnchor="middle" transform={`rotate(-90 ${COL2 - 13} 98)`} className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              d
            </text>
            <text x={COL2} y="174" className="fill-foreground" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
              Wᵀ — one column per token
            </text>

            <text x={(COL2 + W + COL3) / 2} y="103" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 15 }}>
              =
            </text>

            {/* A: N x |V|, with only a d-wide band reachable */}
            <rect x={COL3} y="46" width={W} height="104" fill="url(#sb-hatch)" stroke={WARM} strokeWidth="1" />
            <rect x={COL3} y="46" width={dW} height="104" fill={ACCENT} opacity="0.36" stroke={ACCENT} strokeWidth="1" />
            <text x={COL3 + W / 2} y="38" textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 10, fontFamily: "var(--font-mono)" }}>
              |V|
            </text>
            <text x={COL3} y="174" className="fill-foreground" style={{ fontSize: 11, fontFamily: "var(--font-mono)" }}>
              Â — logits, rank ≤ d
            </text>
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: ACCENT, opacity: 0.34 }} />
            expressible directions
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm border" style={{ borderColor: WARM, background: "transparent" }} />
            everything the true distribution might need and cannot get
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">hidden dim d</span>
            <Range min={128} max={8192} step={64} value={d} onChange={(e) => setD(Number(e.target.value))} className="flex-1" aria-label="hidden dimension" accent={ACCENT} />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{d.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">vocab |V|</span>
            <Range min={2048} max={262144} step={2048} value={m} onChange={(e) => setM(Number(e.target.value))} className="flex-1" aria-label="vocabulary size" accent={WARM} />
            <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{m.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { setD(p.d); setM(p.m) }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                d === p.d && m === p.m
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">rank ceiling</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>{d.toLocaleString()}</div>
            <div className="font-mono text-[9px] text-muted-foreground">{ratio.toFixed(1)}× narrower than |V|</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">output-layer params</div>
            <div className="font-mono text-sm tabular-nums text-foreground">{(softmaxParams / 1e6).toFixed(1)}M</div>
            <div className="font-mono text-[9px] text-muted-foreground">|V| × d, as built</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">if d were raised to |V|</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {bigSoftmaxParams >= 1e9 ? `${(bigSoftmaxParams / 1e9).toFixed(1)}B` : `${(bigSoftmaxParams / 1e6).toFixed(0)}M`}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">|V| × |V| — the easy fix, priced</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The hatched region is the argument. Whatever the network computing{" "}
          <span className="font-mono text-foreground">h_c</span>{" "}does — however deep, however wide, universal
          approximator or not — the logits it can produce live in a{" "}
          <span className="text-foreground">d-dimensional subspace</span>, because they are formed by multiplying
          through a shared d-wide waist. That is not an empirical finding. It is the rank of a product of two
          matrices. The only empirical question left is whether the distribution you are trying to express needs
          more directions than that.
        </p>
      </div>
    </figure>
  )
}
