"use client"

import { useState } from "react"

// The Simple Attention Network, block by block.
//
// Every component in Needle's architecture exists to buy capability without
// buying bandwidth, which on a microcontroller is the only currency that matters.
// The page's own framing: "Every architectural element was benchmarked on the
// target hardware before it earned its parameters."
//
// The four pieces below are the ones that are unusual. Everything else — sandwich
// norms, gates, RMSNorm — is conventional and does not need a diagram.
//
// Shape: 27 layers, 512 wide, 45M parameters of which 35M are matmul-active and
// 8M live in the engram tables. The engram sites fire at two layers, not all
// twenty-seven.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const MUTED = "oklch(0.62 0.03 250)"

type Part = {
  key: string
  l: string
  rule: string
  c: string
  buys: string
  costs: string
  note: string
}

const PARTS: Part[] = [
  {
    key: "lanes",
    l: "multi-lane residual streams",
    rule: "x̂ = RMSNorm(flatten(4 residual streams))",
    c: ACCENT,
    buys: "the routing flexibility of a much wider network",
    costs: "a few dot products per layer",
    note: "Four residual streams instead of one, RMS-normalised and flattened before each block reads them. A 27-layer, 512-wide network gets routing flexibility it would otherwise have to buy with width — and width is weight reads, which is latency and battery on this hardware.",
  },
  {
    key: "hadamard",
    l: "Hadamard MLP",
    rule: "H · x with learned diagonals — H fixed, orthonormal, n log n",
    c: GOOD,
    buys: "channel mixing, which dominates a small model's weight reads",
    costs: "almost no parameters at all",
    note: "The usual dense up-and-down projections are replaced by a fixed Walsh–Hadamard transform plus learned diagonals. H has no weights to read and applies in n log n time. Channel mixing is the single largest consumer of a small model's bandwidth budget, and this makes it nearly free.",
  },
  {
    key: "engram",
    l: "engram sites, two layers only",
    rule: "(kᵢ, vᵢ) rows gathered from hashed n-gram tables",
    c: WARM,
    buys: "world knowledge as capacity, not as arithmetic",
    costs: "8M parameters read a few rows per token — zero MACs",
    note: "World knowledge moves out of the stack and into hashed n-gram tables, read a handful of rows at a time. This is the whole gap between Needle's 45M parameters and its 35M matmul-active ones: capacity that is nearly free at decode time, which matters on a device where every megabyte pulled from flash is latency and battery.",
  },
  {
    key: "sinkhorn",
    l: "Sinkhorn-normalised routing",
    rule: "P = doubly-stochastic normalisation of routing logits A",
    c: MUTED,
    buys: "balanced routing across the lanes",
    costs: "an iterative normalisation, kept in log space",
    note: "Routing logits are normalised to a doubly-stochastic matrix by Sinkhorn iteration. Worth knowing that the log-space version is load-bearing: an independent reimplementation found the mathematically equivalent linear-space form underflows straight to NaN on this hardware.",
  },
  {
    key: "grammar",
    l: "byte-level grammar-constrained decode",
    rule: "candidate rows only — up to 98% of the vocab projection skipped",
    c: GOOD,
    buys: "schema-valid output, and a large share of the decode compute back",
    costs: "a grammar compiled from the declared tool schemas",
    note: "The grammar is an optimization as much as a guarantee. Because the matcher knows which tokens are legal before the logits exist, the engine computes output scores only for candidate rows — skipping up to 98% of the vocabulary projection on structural tokens, and skipping it entirely on steps whose output is already forced.",
  },
]

const SHAPE = [
  { l: "layers", v: "27" },
  { l: "width", v: "512" },
  { l: "parameters", v: "45M" },
  { l: "matmul-active", v: "35M" },
  { l: "attention window", v: "256, sliding" },
  { l: "deployment precision", v: "CQ2-bit" },
]

export function AttentionNetwork() {
  const [sel, setSel] = useState("engram")
  const p = PARTS.find((x) => x.key === sel) ?? PARTS[0]

  const W = 720
  const H = 178
  const LANE_Y = [30, 46, 62, 78]
  const BX = 214
  const BW = 96

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          the Simple Attention Network · every element benchmarked on target hardware before it earned its parameters
        </span>
        <span className="font-mono text-[10px]" style={{ color: p.c }}>
          {p.l}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              Four residual streams running left to right through an attention block, a Hadamard MLP, an engram
              gather site and a grammar-constrained output head, with Sinkhorn-normalised routing feeding the
              lanes.
            </title>

            {/* the four residual lanes */}
            {LANE_Y.map((yy) => (
              <line
                key={yy}
                x1={78}
                y1={yy}
                x2={W - 118}
                y2={yy}
                stroke={sel === "lanes" ? ACCENT : "currentColor"}
                strokeOpacity={sel === "lanes" ? 0.85 : 0.22}
                strokeWidth={sel === "lanes" ? 2 : 1.25}
              />
            ))}
            <text x={72} y={58} fontSize={9} fill={sel === "lanes" ? ACCENT : "currentColor"} fillOpacity={sel === "lanes" ? 1 : 0.5} textAnchor="end" fontFamily="ui-monospace, monospace">
              4 residual
            </text>
            <text x={72} y={70} fontSize={9} fill={sel === "lanes" ? ACCENT : "currentColor"} fillOpacity={sel === "lanes" ? 1 : 0.5} textAnchor="end" fontFamily="ui-monospace, monospace">
              streams
            </text>

            {/* blocks along the lanes */}
            {[
              { key: "sinkhorn", l: "route", sub: "Sinkhorn P", x: BX - 118 },
              { key: "attn", l: "attention", sub: "256 window", x: BX },
              { key: "hadamard", l: "Hadamard MLP", sub: "H · x, learned diag", x: BX + 128 },
              { key: "engram", l: "engram", sub: "gather, 2 layers", x: BX + 268 },
            ].map((b) => {
              const on = sel === b.key
              const c = PARTS.find((x) => x.key === b.key)?.c ?? MUTED
              return (
                <g key={b.l} onClick={() => (PARTS.some((x) => x.key === b.key) ? setSel(b.key) : undefined)} style={{ cursor: PARTS.some((x) => x.key === b.key) ? "pointer" : "default" }}>
                  <rect
                    x={b.x}
                    y={20}
                    width={b.key === "hadamard" ? 118 : BW}
                    height={68}
                    rx={6}
                    fill={c}
                    fillOpacity={on ? 0.22 : 0.08}
                    stroke={c}
                    strokeOpacity={on ? 1 : 0.4}
                    strokeWidth={on ? 1.75 : 1}
                  />
                  <text x={b.x + (b.key === "hadamard" ? 59 : BW / 2)} y={48} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {b.l}
                  </text>
                  <text x={b.x + (b.key === "hadamard" ? 59 : BW / 2)} y={62} fontSize={8} fill="currentColor" fillOpacity={0.55} textAnchor="middle" fontFamily="ui-monospace, monospace">
                    {b.sub}
                  </text>
                </g>
              )
            })}

            {/* the engram tables below */}
            <g onClick={() => setSel("engram")} style={{ cursor: "pointer" }}>
              <rect x={BX + 268} y={100} width={BW} height={26} rx={5} fill={WARM} fillOpacity={sel === "engram" ? 0.22 : 0.08} stroke={WARM} strokeOpacity={sel === "engram" ? 1 : 0.4} />
              <text x={BX + 268 + BW / 2} y={116} fontSize={8.5} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                n-gram tables
              </text>
              <line x1={BX + 268 + BW / 2} y1={88} x2={BX + 268 + BW / 2} y2={100} stroke={WARM} strokeOpacity={sel === "engram" ? 0.85 : 0.35} strokeDasharray="3 2" />
              <text x={BX + 268 + BW + 8} y={116} fontSize={8.5} fill={WARM} fillOpacity={sel === "engram" ? 1 : 0.5} fontFamily="ui-monospace, monospace">
                8M params · 0 MACs
              </text>
            </g>

            {/* grammar head */}
            <g onClick={() => setSel("grammar")} style={{ cursor: "pointer" }}>
              <rect x={W - 112} y={20} width={104} height={68} rx={6} fill={GOOD} fillOpacity={sel === "grammar" ? 0.22 : 0.08} stroke={GOOD} strokeOpacity={sel === "grammar" ? 1 : 0.4} strokeWidth={sel === "grammar" ? 1.75 : 1} />
              <text x={W - 60} y={44} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                grammar
              </text>
              <text x={W - 60} y={57} fontSize={10} fill="currentColor" textAnchor="middle" fontFamily="ui-monospace, monospace">
                head
              </text>
              <text x={W - 60} y={71} fontSize={8} fill="currentColor" fillOpacity={0.55} textAnchor="middle" fontFamily="ui-monospace, monospace">
                candidate rows only
              </text>
            </g>

            <text x={8} y={H - 42} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              × 27 layers, 512 wide · sandwich-normed and gated throughout · engram sites fire at two layers
            </text>
            <text x={8} y={H - 28} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              KV cache bounded by the 256-token window; system prompt and tool declarations pinned as permanent sinks
            </text>
            <text x={8} y={H - 8} fontSize={9} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              click a block
            </text>
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex flex-wrap items-baseline gap-2">
            <span className="font-mono text-[11px]" style={{ color: p.c }}>
              {p.l}
            </span>
            <span className="font-mono text-[9px] text-muted-foreground">{p.rule}</span>
          </div>
          <div className="mt-1.5 grid gap-1 sm:grid-cols-2">
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground">buys</span>{" "}
              <span className="text-foreground">{p.buys}</span>
            </div>
            <div className="font-mono text-[10px]">
              <span className="text-muted-foreground">costs</span>{" "}
              <span style={{ color: p.c }}>{p.costs}</span>
            </div>
          </div>
          <div className="mt-1.5 text-sm leading-6 text-muted-foreground">{p.note}</div>
        </div>

        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
          {SHAPE.map((s) => (
            <span key={s.l} className="font-mono text-[9px] text-muted-foreground">
              {s.l} <span className="text-foreground">{s.v}</span>
            </span>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every block here is a different answer to the same question: how do you add capability without adding
          bytes read per token? The Hadamard MLP mixes channels with a matrix that has no weights. The engram
          stores knowledge in tables that are gathered rather than multiplied. The lanes buy routing flexibility
          with dot products instead of width.{" "}
          <span className="text-foreground">The grammar head declines to compute most of the vocabulary
          projection at all.</span>
          <br />
          <br />
          The memory system is designed backwards from the same constraint. A 256-token sliding attention window
          means the KV cache is bounded no matter how long a session runs — and the system prompt and tool
          declarations are pinned as permanent sinks, so the one thing a tool-calling model must never forget is{" "}
          <em>structurally unable</em>{" "}to be evicted. That is what turns a RAM budget into a deterministic 28 MB
          ceiling rather than a curve.
        </p>
      </div>
    </figure>
  )
}
