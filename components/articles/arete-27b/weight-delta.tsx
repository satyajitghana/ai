"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MEASURED by HTTP range requests against Qwen/Qwen3.8-27B (weights unchanged between the training revision
// 1d4bf0f2 and main) and NousResearch/Arete-27B (sha 108f0afb). For each tensor, the first 1 MiB of its bf16 data
// (524,288 values; the whole tensor for the 5,120-value norms) was read from both checkpoints and compared:
//   rel   = ||W_arete - W_base|| / ||W_base||, in per cent
//   same  = share of values whose bf16 bits are identical
// The slice is the leading rows of each matrix, not a random sample: the per-layer shape is the finding, the
// absolute level is for those rows only. Full-attention layers are 3, 7, ..., 63 (every fourth); the others are
// Gated DeltaNet, whose output projection is linear_attn.out_proj.

const DOWN = [0.408, 0.433, 0.553, 0.486, 0.475, 0.512, 0.582, 0.574, 0.567, 0.559, 0.556, 0.548, 0.538, 0.538, 0.535, 0.527, 0.542, 0.569, 0.607, 0.675, 0.715, 0.719, 0.74, 0.757, 0.778, 0.767, 0.748, 0.734, 0.717, 0.706, 0.694, 0.684, 0.682, 0.687, 0.718, 0.776, 0.802, 0.775, 0.794, 0.76, 0.768, 0.722, 0.693, 0.672, 0.676, 0.681, 0.678, 0.681, 0.689, 0.712, 0.759, 0.777, 0.768, 0.743, 0.748, 0.712, 0.703, 0.657, 0.598, 0.555, 0.527, 0.486, 0.515, 0.638]
const DOWN_SAME = [45.7, 40.0, 33.8, 36.8, 36.9, 34.3, 31.2, 31.3, 31.8, 32.0, 32.0, 32.4, 33.0, 32.8, 32.9, 33.4, 32.4, 31.2, 29.9, 27.1, 25.8, 25.3, 24.6, 23.9, 23.4, 23.5, 23.8, 24.2, 24.9, 25.1, 25.5, 25.8, 25.8, 25.7, 24.9, 23.5, 22.9, 23.4, 22.8, 23.8, 23.4, 24.8, 25.7, 26.5, 26.5, 26.2, 26.4, 26.5, 26.3, 25.8, 24.7, 24.9, 25.1, 26.0, 26.4, 27.8, 28.3, 29.7, 32.2, 34.9, 37.9, 41.7, 40.2, 35.1]
const ATTN = [0.446, 0.369, 0.375, 0.311, 0.354, 0.359, 0.394, 0.359, 0.363, 0.368, 0.358, 0.384, 0.394, 0.38, 0.378, 0.378, 0.371, 0.402, 0.376, 0.446, 0.384, 0.377, 0.367, 0.463, 0.407, 0.442, 0.448, 0.622, 0.502, 0.488, 0.504, 0.642, 0.508, 0.526, 0.507, 0.665, 0.449, 0.421, 0.386, 0.581, 0.402, 0.426, 0.428, 0.657, 0.496, 0.456, 0.512, 0.55, 0.495, 0.5, 0.503, 0.488, 0.447, 0.416, 0.375, 0.353, 0.409, 0.368, 0.32, 0.33, 0.335, 0.279, 0.333, 0.395]
const ATTN_SAME = [39.8, 48.0, 46.1, 57.7, 50.0, 49.6, 45.2, 50.1, 48.5, 47.4, 48.5, 48.3, 45.0, 45.4, 46.3, 48.2, 46.5, 44.1, 46.1, 42.4, 48.1, 49.3, 49.2, 38.6, 44.6, 40.7, 40.3, 30.0, 36.1, 36.8, 36.6, 28.4, 35.3, 34.0, 35.5, 27.8, 42.5, 46.1, 48.1, 31.2, 45.3, 42.6, 41.9, 28.4, 37.3, 39.7, 37.6, 33.4, 37.3, 36.4, 37.4, 39.1, 46.1, 49.3, 54.0, 47.1, 51.7, 54.9, 59.8, 49.0, 62.4, 68.3, 60.7, 44.6]
const NORM = [0.165, 0.077, 0.081, 0.001, 0.023, 0.035, 0.061, 0.029, 0.034, 0.049, 0.09, 0.052, 0.096, 0.084, 0.108, 0.086, 0.124, 0.143, 0.15, 0.098, 0.038, 0.023, 0.038, 0.122, 0.14, 0.104, 0.111, 0.124, 0.067, 0.045, 0.043, 0.066, 0.045, 0.053, 0.06, 0.11, 0.041, 0.042, 0.041, 0.139, 0.107, 0.07, 0.086, 0.128, 0.078, 0.044, 0.057, 0.086, 0.07, 0.063, 0.091, 0.139, 0.031, 0.033, 0.034, 0.058, 0.026, 0.022, 0.019, 0.032, 0.004, 0.006, 0.012, 0.042]
const NORM_SAME = [63.4, 75.5, 72.8, 100.0, 99.0, 97.5, 89.4, 83.8, 97.6, 91.3, 73.7, 77.5, 73.8, 80.3, 65.7, 69.2, 62.2, 63.8, 58.3, 68.2, 96.7, 97.3, 93.4, 62.1, 58.0, 64.3, 64.2, 70.9, 77.2, 83.2, 84.0, 78.4, 83.2, 82.9, 80.4, 67.8, 92.0, 92.7, 91.6, 52.5, 74.6, 81.2, 71.6, 67.5, 76.8, 85.1, 82.0, 73.8, 81.1, 83.2, 77.9, 75.5, 95.6, 93.5, 93.8, 88.7, 97.6, 98.0, 98.2, 88.2, 99.9, 99.9, 99.8, 87.3]

const SERIES = {
  down: { tab: "MLP down_proj", rel: DOWN, same: DOWN_SAME, max: 0.9 },
  attn: { tab: "attention output", rel: ATTN, same: ATTN_SAME, max: 0.9 },
  norm: { tab: "input_layernorm", rel: NORM, same: NORM_SAME, max: 0.2 },
} as const
type Key = keyof typeof SERIES

const FIXED = [
  { k: "vision tower", v: "0.000%", s: "6 tensors sampled, every bit identical" },
  { k: "MTP head", v: "removed", s: "15 tensors, 424,699,392 params" },
  { k: "embed_tokens", v: "0.691%", s: "31.2% of values unchanged" },
  { k: "lm_head", v: "1.176%", s: "22.5% unchanged" },
  { k: "final norm", v: "0.000%", s: "2 of 5,120 values differ" },
]

const C_DN = "oklch(0.62 0.12 250)"
const C_FA = "oklch(0.66 0.15 40)"

export function WeightDelta() {
  const [key, setKey] = useState<Key>("down")
  const [sel, setSel] = useState(36)
  const S = SERIES[key]
  const W = 640
  const H = 150
  const bw = W / 64

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">What two epochs of SFT did to each layer</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured · range reads, first 1 MiB per tensor</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(SERIES) as Key[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKey(k)}
              aria-pressed={key === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                key === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {SERIES[k].tab}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H + 18}`} className="w-full" role="img" aria-label={`relative weight change per layer, ${S.tab}`}>
          {[0.25, 0.5, 0.75, 1].map((f) => (
            <line
              key={f}
              x1={0}
              x2={W}
              y1={(H - f * H).toFixed(1)}
              y2={(H - f * H).toFixed(1)}
              stroke="currentColor"
              strokeOpacity={0.08}
            />
          ))}
          {S.rel.map((v, i) => {
            const h = (Math.min(v, S.max) / S.max) * H
            const fa = i % 4 === 3
            return (
              <rect
                key={i}
                x={(i * bw + 1).toFixed(1)}
                y={(H - h).toFixed(1)}
                width={(bw - 2).toFixed(1)}
                height={h.toFixed(1)}
                fill={fa ? C_FA : C_DN}
                opacity={sel === i ? 1 : 0.7}
                stroke={sel === i ? "currentColor" : "none"}
                onMouseEnter={() => setSel(i)}
                onClick={() => setSel(i)}
                style={{ cursor: "pointer" }}
              />
            )
          })}
          {[0, 16, 32, 48, 63].map((i) => (
            <text key={i} x={(i * bw + bw / 2).toFixed(1)} y={H + 13} fontSize={9} textAnchor="middle" fill="currentColor" opacity={0.6}>
              {i}
            </text>
          ))}
          <text x={W - 2} y={10} fontSize={9} textAnchor="end" fill="currentColor" opacity={0.6}>
            top of axis {S.max.toFixed(1)}%
          </text>
        </svg>

        <div className="flex flex-wrap items-center gap-3 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C_DN }} /> Gated DeltaNet layer
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: C_FA }} /> full-attention layer
          </span>
          <span className="ml-auto text-foreground">
            layer {sel}: {S.rel[sel].toFixed(3)}% change · {S.same[sel].toFixed(1)}% of values bit-identical
          </span>
        </div>

        <div className="grid gap-1.5 sm:grid-cols-5">
          {FIXED.map((f) => (
            <div key={f.k} className="rounded-md border px-2.5 py-1.5">
              <p className="font-mono text-[9px] text-muted-foreground">{f.k}</p>
              <p className="font-mono text-sm tabular-nums text-foreground">{f.v}</p>
              <p className="font-mono text-[9px] leading-4 text-muted-foreground">{f.s}</p>
            </div>
          ))}
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {key === "down" ? (
            <>
              The MLP changes least at the two ends of the stack and most between layers 20 and 55, peaking at 0.802% in
              layer 36. In that layer 23% of the sampled values kept their exact bf16 bits and another 30% moved by one
              bf16 step, the smallest change bf16 can store.
            </>
          ) : key === "attn" ? (
            <>
              The five largest attention-output changes are all full-attention layers, 27 to 43 (0.58-0.67%), against
              0.28-0.53% for every Gated DeltaNet layer. The recurrent decay parameters of all 48 DeltaNet layers{" "}
              (<code>A_log</code>) barely move: the largest relative change is 0.005%.
            </>
          ) : (
            <>
              The pre-attention norms barely move: under 0.17% everywhere, and in layers 60-62 more than 99.8% of values
              are bit-identical. The fine-tune changed what the matrices compute, not the scale they work at.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
