"use client"

import { useState } from "react"

// The mechanism behind the KV-cache arithmetic in this article, drawn as a
// grouping diagram. Every shape comes from openbmb/MiniCPM5-2B's config.json:
// num_attention_heads=16, num_key_value_heads=2, head_dim=128, 42 layers,
// max_position_embeddings=131072. The 16:2 split is Grouped-Query Attention
// (GQA) -- 8 query heads share one key/value head instead of each of the 16
// query heads keeping its own K/V (Multi-Head Attention, MHA). Weights are
// per-head and unaffected by this choice; only the KV cache -- the thing that
// has to be stored per token, per layer, for the whole generated sequence --
// shrinks. The "hypothetical MHA" panel is not a real MiniCPM5 variant; it is
// the same config.json with num_key_value_heads set to 16 instead of 2, used
// only to make the ratio legible.
//
// Per-token KV bytes = layers x kv_heads x head_dim x 2 (K and V) x dtype_bytes.
// At f16 (2 bytes): GQA 42x2x128x2x2 = 43,008 B/token; MHA 42x16x128x2x2 =
// 344,064 B/token -- exactly 8x, matching num_attention_heads / num_key_value_heads.

const LAYERS = 42
const HEAD_DIM = 128
const Q_HEADS = 16
const F16_BYTES = 2
const MAX_CTX = 131072

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"
const QCOLOR = "oklch(0.60 0.15 255)"

type Mode = "gqa" | "mha"

const CONFIGS: Record<Mode, { kvHeads: number; label: string; sub: string }> = {
  gqa: { kvHeads: 2, label: "GQA — shipped", sub: "16 query heads : 2 KV heads (8:1)" },
  mha: { kvHeads: 16, label: "hypothetical MHA", sub: "16 query heads : 16 KV heads (1:1)" },
}

function perTokenBytes(kvHeads: number) {
  return LAYERS * kvHeads * HEAD_DIM * 2 * F16_BYTES
}

function fmtGB(bytes: number) {
  return (bytes / 1e9).toFixed(2)
}

export function GqaGeometry() {
  const [mode, setMode] = useState<Mode>("gqa")
  const cfg = CONFIGS[mode]
  const perToken = perTokenBytes(cfg.kvHeads)
  const total131k = perToken * MAX_CTX

  const gqaTotal = perTokenBytes(2) * MAX_CTX
  const mhaTotal = perTokenBytes(16) * MAX_CTX
  const ratio = mhaTotal / gqaTotal

  // layout: 16 query heads across top, grouped down to kvHeads boxes below
  const W = 700
  const qY = 30
  const kvY = 130
  const qW = 30
  const qGap = 8
  const startX = (W - (Q_HEADS * qW + (Q_HEADS - 1) * qGap)) / 2
  const groupSize = Q_HEADS / cfg.kvHeads
  const kvW = groupSize * qW + (groupSize - 1) * qGap
  const H = 210

  const qxs = Array.from({ length: Q_HEADS }, (_, i) => startX + i * (qW + qGap))
  const kvBoxes = Array.from({ length: cfg.kvHeads }, (_, i) => {
    const groupQxs = qxs.slice(i * groupSize, (i + 1) * groupSize)
    const x = groupQxs[0]
    return { x, w: kvW, cx: x + kvW / 2 }
  })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">config.json, drawn: why 2 KV heads is the whole trick</span>
        <span className="font-mono text-[10px]" style={{ color: mode === "gqa" ? GOOD : BAD }}>
          {fmtGB(total131k)} GB KV cache @ 131,072 tokens
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(CONFIGS) as Mode[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors " +
                (mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground")
              }
            >
              {CONFIGS[k].label}
            </button>
          ))}
          <span className="self-center font-mono text-[10px] text-muted-foreground">{cfg.sub}</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[600px] max-w-full">
            <title>
              {`${mode === "gqa" ? "GQA as shipped" : "Hypothetical MHA"}: ${Q_HEADS} query heads mapping to ${cfg.kvHeads} key/value head${cfg.kvHeads > 1 ? "s" : ""}. Per-token KV cache bytes across all 42 layers: ${perToken.toLocaleString()}. At the model's native 131,072-token context that is ${fmtGB(total131k)} GB.`}
            </title>

            <text x={startX} y={qY - 10} fontSize={9} fill={QCOLOR} fontFamily="ui-monospace, monospace">
              16 query heads (unchanged by this choice)
            </text>
            {qxs.map((x, i) => (
              <rect key={i} x={x} y={qY} width={qW} height={26} rx={4} fill={QCOLOR} fillOpacity={0.75} />
            ))}

            {/* connectors */}
            {kvBoxes.map((kb, gi) => {
              const groupQxs = qxs.slice(gi * groupSize, (gi + 1) * groupSize)
              return (
                <g key={gi}>
                  {groupQxs.map((qx, qi) => {
                    const x1 = qx + qW / 2
                    const y1 = qY + 26
                    const x2 = kb.cx
                    const y2 = kvY
                    const my = (y1 + y2) / 2
                    return (
                      <path
                        key={qi}
                        d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
                        fill="none"
                        stroke={mode === "gqa" ? GOOD : BAD}
                        strokeOpacity={0.35}
                        strokeWidth={1.3}
                      />
                    )
                  })}
                </g>
              )
            })}

            {kvBoxes.map((kb, i) => (
              <rect
                key={i}
                x={kb.x}
                y={kvY}
                width={kb.w}
                height={30}
                rx={5}
                fill={mode === "gqa" ? GOOD : BAD}
                fillOpacity={0.85}
              />
            ))}
            <text
              x={W / 2}
              y={kvY + 50}
              fontSize={9}
              textAnchor="middle"
              fill={mode === "gqa" ? GOOD : BAD}
              fontFamily="ui-monospace, monospace"
            >
              {cfg.kvHeads} key/value head{cfg.kvHeads > 1 ? "s" : ""} — this is what gets cached, per token, per layer
            </text>
          </svg>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">bytes / token / layer</div>
            <div className="font-mono text-sm tabular-nums text-foreground">
              {cfg.kvHeads} × 128 × 2 × 2 = {(cfg.kvHeads * HEAD_DIM * 2 * F16_BYTES).toLocaleString()} B
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">× 42 layers</div>
            <div className="font-mono text-sm tabular-nums text-foreground">{perToken.toLocaleString()} B/token</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">× 131,072 tokens</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: mode === "gqa" ? GOOD : BAD }}>
              {fmtGB(total131k)} GB
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Every query head still gets its own attention output — GQA doesn&rsquo;t shrink the
          model, and nothing here touches the <span style={{ color: QCOLOR }}>16 query heads</span>{" "}
          on top. What shrinks is what has to be <em>stored</em>: with{" "}
          <span style={{ color: GOOD }}>2 KV heads</span>, groups of 8 query heads share one cached
          key/value pair, so the cache pays for 2 heads instead of 16. Toggle to the{" "}
          <span style={{ color: BAD }}>hypothetical MHA</span> panel — same model, same 131K
          context, only <code>num_key_value_heads</code> changed from 2 to 16 — and the cache at
          full context jumps from <span style={{ color: GOOD }}>{fmtGB(gqaTotal)} GB</span> to{" "}
          <span style={{ color: BAD }}>{fmtGB(mhaTotal)} GB</span>, exactly {ratio.toFixed(0)}×
          larger. {fmtGB(mhaTotal)} GB of KV cache alone doesn&rsquo;t fit on any consumer GPU sold
          today, at any weight quantization. The 8:1 GQA ratio isn&rsquo;t a minor efficiency knob
          here — it&rsquo;s the difference between a 131K context window that fits in a laptop
          and one that doesn&rsquo;t exist outside a datacenter.
        </p>
      </div>
    </figure>
  )
}
