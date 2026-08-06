"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The mechanism, read straight out of modeling_interns2_mobius.py. A standard MoE
// transformer gives every decoder layer its own private bank of routed experts —
// N layers, N banks. Mobius has num_blocks = 4 in config.json: exactly four
// InternS2MobiusMetaMoeBlock objects (a router + 2560 experts each), held in a
// single nn.ModuleList called meta_mlp. Every decoder layer looks up
// block_idx = layer_idx % num_blocks and routes into meta_mlp[block_idx] — so
// layers 0, 4, 8 … 36 all query the *same* physical weight tensors. Forty
// layers, four banks, each bank reused ten times over depth. That's the
// "globally shared Memory" the model card describes, made literal.
// Bonus fact visible in the same config: layer_types cycles linear/linear/
// linear/full every 4 layers too (full_attention_interval = 4) — so bank 3 is
// always the one full-attention layer in its group of four; banks 0–2 are
// always linear attention (Gated DeltaNet). That alignment isn't asserted
// anywhere in the README; it falls out of matching the two config arrays.

const LAYERS = 40
const NUM_BLOCKS = 4
const BANK_COLORS = [
  "oklch(0.62 0.16 300)", // bank 0 — violet
  "oklch(0.64 0.15 230)", // bank 1 — blue
  "oklch(0.64 0.14 155)", // bank 2 — green
  "oklch(0.68 0.16 60)", // bank 3 — amber (always the full-attention slot)
]
const PRIVATE_COLOR = "var(--muted-foreground)"

type Mode = "shared" | "private"

// viewBox geometry — a horizontal depth strip, layer 0 (input) on the left.
const W = 720
const CELL_W = 14
const GAP = 2.4
const STRIDE = CELL_W + GAP
const ROW_Y = 30
const ROW_H = 30
const START_X = (W - LAYERS * STRIDE + GAP) / 2

export function MemoryMap() {
  const [mode, setMode] = useState<Mode>("shared")
  const [hover, setHover] = useState<number | null>(null)

  const shown = hover ?? 0
  const bank = shown % NUM_BLOCKS
  const isFullAttn = shown % NUM_BLOCKS === NUM_BLOCKS - 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">meta_mlp · 40 decoder layers, {mode === "shared" ? "4" : "40"} memory banks</span>
        <div className="flex gap-1">
          {[
            { v: "shared" as const, label: "Mobius (shared)" },
            { v: "private" as const, label: "standard MoE (private)" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === o.v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === o.v ? { background: "oklch(0.62 0.16 300)" } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} 92`}
          className="w-full"
          role="img"
          aria-label={
            mode === "shared"
              ? "40 decoder layers cycling through 4 shared memory banks, each bank reused by 10 layers; the fourth bank in every group of four is also the one full-attention layer"
              : "40 decoder layers, each with its own private, never-reused memory bank, as in a standard mixture-of-experts transformer"
          }
        >
          {/* depth axis labels */}
          <text x={START_X} y={16} className="fill-muted-foreground font-mono" fontSize={9}>
            layer 0 (input)
          </text>
          <text x={START_X + LAYERS * STRIDE - GAP} y={16} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            layer 39 (output)
          </text>

          {Array.from({ length: LAYERS }, (_, i) => {
            const cx = START_X + i * STRIDE
            const b = i % NUM_BLOCKS
            const full = b === NUM_BLOCKS - 1
            const fill = mode === "shared" ? BANK_COLORS[b] : PRIVATE_COLOR
            const isHover = hover === i
            return (
              <g
                key={i}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                style={{ cursor: "pointer" }}
              >
                <rect
                  x={cx}
                  y={ROW_Y}
                  width={CELL_W}
                  height={ROW_H}
                  rx={2.5}
                  fill={fill}
                  fillOpacity={mode === "shared" ? 0.88 : 0.22 + (i % 5) * 0.02}
                  stroke={isHover ? "var(--foreground)" : "var(--border)"}
                  strokeWidth={isHover ? 1.4 : 1}
                  strokeDasharray={mode === "private" ? "2 1.4" : undefined}
                />
                {/* full-attention marker */}
                {full && (
                  <circle cx={cx + CELL_W / 2} cy={ROW_Y + ROW_H + 8} r={2.2} fill="var(--foreground)" />
                )}
              </g>
            )
          })}

          <text x={START_X} y={ROW_Y + ROW_H + 24} className="fill-muted-foreground font-mono" fontSize={8.5}>
            &bull; = full attention (every 4th layer) &middot; else Gated DeltaNet (linear attention)
          </text>
        </svg>

        <div className="mt-1 grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs sm:grid-cols-4">
          {mode === "shared" ? (
            BANK_COLORS.map((c, i) => (
              <div key={i} className="bg-background px-3 py-2">
                <div className="flex items-center gap-1.5">
                  <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
                  <span className="text-[10px] text-muted-foreground">bank {i}</span>
                </div>
                <div className="mt-0.5 text-[10px] text-muted-foreground">
                  layers {i}, {i + 4}, {i + 8} … {i + 36}
                  {i === NUM_BLOCKS - 1 ? " · full attn" : " · linear attn"}
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-2 bg-background px-3 py-2 sm:col-span-4">
              <div className="font-medium text-foreground">40 private banks, 0 reuse</div>
              <div className="mt-0.5 text-[10px] leading-4 text-muted-foreground">
                what it would take to give every layer its own 2560-expert bank instead — 10&times; the distinct expert weight objects for the same routing width.
              </div>
            </div>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "shared" ? (
            <>
              This is <code>block_idx = layer_idx % num_blocks</code> straight out of{" "}
              <code>modeling_interns2_mobius.py</code>. All 40 decoder layers keep their own attention
              and layernorms, but the routed-expert bank — the &ldquo;Memory&rdquo; the model card
              describes — comes from just <span className="text-foreground">four</span> physical
              <code> InternS2MobiusMetaMoeBlock</code> objects, each reused by ten layers spread across the
              full depth. Hover a cell: {isFullAttn ? "bank 3" : `bank ${bank}`} is queried by layers{" "}
              {bank}, {bank + 4}, {bank + 8}, {bank + 12}, {bank + 16}, {bank + 20}, {bank + 24},{" "}
              {bank + 28}, {bank + 32}, and {bank + 36} — {isFullAttn ? "the one full-attention layer in its group of four" : "a linear-attention (Gated DeltaNet) layer"}.
            </>
          ) : (
            <>
              A conventional MoE stack ties knowledge storage to depth: layer <em>k</em> owns expert bank{" "}
              <em>k</em>, full stop. Knowledge learned at layer 12 lives only at layer 12. Mobius&apos;s bet
              is that decoupling the two — same memory, different reasoning steps — lets a shallow and a
              deep layer draw on the identical knowledge subspace, which is the concrete thing the card
              calls a <span className="text-foreground">Backward Residual Connection</span>.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
