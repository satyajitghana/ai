"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The exact per-layer recipe, not a redrawing of a diagram -- there isn't
// one. Read directly from the GGUF repo's own recipe file (the *.tensortypes
// files llama-quantize consumes as --tensor-type-file rules), which is
// checked into the repo alongside the two GGUFs:
//   https://huggingface.co/AngelSlim/Hy4-preview-GGUF/raw/main/
//     hy4-preview-patch/Hy4-preview-STQ1_0.tensortypes
//
// 77 MoE layers (1-77; layer 0 is the dense FFN, untouched by this recipe).
// 48 of them get an explicit per-layer override to IQ2_XXS (2.0625 bpw) on
// ffn_gate_exps/ffn_up_exps; the other 29 fall through to the file's generic
// rule, STQ1_0 (1.3125 bpw), on those same two tensors. Cross-checked against
// the README's own type histogram rather than just trusted from the recipe
// file: IQ2_XXS appears on exactly 96 tensors (48 layers x 2 tensors each)
// and STQ1_0 on exactly 58 (29 x 2) -- both match to the tensor, confirming
// the recipe file is what actually shipped in the GGUF.
//
// IQ2_XXS layers (imatrix-selected "safe" set): 1, 12, 17-19, 25-28, 30,
// 39-77 except 41. STQ1_0 layers (the aggressive set): 2-11, 13-16, 20-24,
// 29, 31-38, 41. The recipe's own comments show its lineage: it starts from
// Unsloth's separate unsloth/GLM-5.2-GGUF UD-IQ1_M recipe (same glm-dsa/hyv4
// architecture family -- MLA + 256 routed experts top-8 + a DSA indexer),
// then swaps that recipe's IQ1_S generic type for the author's own STQ1_0
// encoder on the 29 layers imatrix flags as safe to push lower, and fixes
// two llama.cpp auto-detection misses specific to HY4's tensor names and
// 256-expert count (attn_output and the split MLA q_b/k_b/v_b never get
// their usual precision bump).
//
// Tensor-family recipe, all read from the same file:
const FAMILIES: { name: string; format: string; note: string }[] = [
  { name: "ffn_gate_exps / ffn_up_exps", format: "STQ1_0 (29L) / IQ2_XXS (48L)", note: "the bulk of parameters; imatrix picks the split" },
  { name: "ffn_down_exps", format: "IQ3_XXS (74L) / IQ4_XS (last 3L)", note: "writes straight into the residual stream, unattenuated by a later gate -- deliberately 2 formats higher" },
  { name: "attn_output / attn_gate / attn_q_a", format: "Q5_K, all 78L", note: "llama.cpp only auto-bumps this at n_expert==8; HY4 has 256, so uncorrected it silently falls to IQ2_XXS" },
  { name: "MLA q_b / k_b / v_b / kv_a_mqa", format: "Q8_0, all 78L", note: "HY4's split tensor names miss llama.cpp's substring match for the usual auto-bump" },
  { name: "DSA indexer (105 tensors)", format: "Q8_0 / F32", note: "0.4GiB in bf16 -- the floor is nearly free for the tensors gating every query's 2048-token attention window" },
  { name: "iHC mixing matrices, router, norms", format: "F32", note: "mirrors the reference checkpoint's own _keep_in_fp32_modules list" },
  { name: "output.weight (lm_head)", format: "F32", note: "--leave-output-tensor, more conservative than the GLM baseline's Q4_K" },
]

const N_MOE = 77
const IQ2_LAYERS = new Set([1, 12, 17, 18, 19, 25, 26, 27, 28, 30, 39, 40, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77])

const DENSE = "oklch(0.62 0.03 250)"
const STQ = "oklch(0.68 0.13 85)"
const IQ2 = "oklch(0.60 0.15 255)"

const W = 700
const CELL = 15
const GAP = 2.2
const COLS = 26
const GRID_X = 14

type View = "grid" | "recipe"

export function BitAllocationMap() {
  const [view, setView] = useState<View>("grid")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Hy4-preview-STQ1_0.gguf&rsquo;s own recipe file</span>
        <div className="flex gap-1">
          {(["grid", "recipe"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                view === v
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {v === "grid" ? "78-layer grid" : "tensor-family recipe"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "grid" ? (
          <>
            <div className="overflow-x-auto">
              <svg viewBox={`0 0 ${W} 150`} width={W} height={150} role="img" className="min-w-[660px] max-w-full">
                <title>
                  {`Seventy-eight layers drawn as a grid. Layer 0 is the dense feed-forward layer, untouched by this recipe. Of the 77 mixture-of-experts layers, 48 -- filled solid -- get their gate and up projections quantized to IQ2_XXS at 2.0625 bits per weight. The other 29 -- outlined only -- fall through to the file's generic rule, STQ1_0 at 1.3125 bits per weight, the more aggressive format.`}
                </title>
                {Array.from({ length: N_MOE + 1 }, (_, i) => {
                  const col = i % COLS
                  const row = Math.floor(i / COLS)
                  const x = GRID_X + col * (CELL + GAP)
                  const y = 8 + row * (CELL + GAP)
                  const isDense = i === 0
                  const isIQ2 = IQ2_LAYERS.has(i)
                  const fill = isDense ? DENSE : isIQ2 ? IQ2 : STQ
                  return (
                    <rect
                      key={i}
                      x={x}
                      y={y}
                      width={CELL}
                      height={CELL}
                      rx={2.5}
                      fill={fill}
                      fillOpacity={isDense || isIQ2 ? 0.85 : 0.28}
                      stroke={!isDense && !isIQ2 ? STQ : "none"}
                      strokeWidth={!isDense && !isIQ2 ? 1.4 : 0}
                      strokeOpacity={0.9}
                    />
                  )
                })}
                <g transform="translate(14, 68)">
                  <rect x={0} y={-8} width={11} height={11} rx={2} fill={DENSE} fillOpacity={0.85} />
                  <text x={15} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                    layer 0, dense (untouched)
                  </text>
                  <rect x={195} y={-8} width={11} height={11} rx={2} fill={IQ2} fillOpacity={0.85} />
                  <text x={210} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                    IQ2_XXS, 2.0625 bpw (48 layers)
                  </text>
                  <rect x={430} y={-8} width={11} height={11} rx={2} fill={STQ} fillOpacity={0.28} stroke={STQ} strokeWidth={1.4} />
                  <text x={445} y={0} fontSize={7} fill="currentColor" fillOpacity={0.7} fontFamily="ui-monospace, monospace">
                    STQ1_0, 1.3125 bpw (29 layers)
                  </text>
                </g>
              </svg>
            </div>
            <div className="mt-2 font-mono text-[10px] text-muted-foreground">
              cross-checked against the README&rsquo;s own type histogram: IQ2_XXS × 96 tensors (48 layers × 2) and
              STQ1_0 × 58 tensors (29 × 2) — both match exactly
            </div>
          </>
        ) : (
          <div className="space-y-2.5">
            {FAMILIES.map((f) => (
              <div key={f.name} className="rounded-lg border px-3 py-2.5">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <span className="font-mono text-[11px] text-foreground">{f.name}</span>
                  <span className="font-mono text-[10px] text-muted-foreground">{f.format}</span>
                </div>
                <p className="mt-1.5 font-mono text-[10px] leading-4 text-muted-foreground">{f.note}</p>
              </div>
            ))}
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          &ldquo;Calibration data picks each layer&rsquo;s bit-width&rdquo; is the accurate part of the
          promotional line, and the recipe file backs it up at the level of individual layer indices, not
          just an average. Thirty-eight of the 48{" "}
          <span style={{ color: IQ2 }}>IQ2_XXS</span> layers form a near-solid block from layer 39 to 77,
          skipping only layer 41; the other ten (1, 12, 17&ndash;19, 25&ndash;28, 30) are scattered earlier.
          The 29 <span style={{ color: STQ }}>STQ1_0</span> layers fill in almost everything from 2
          through 41 — the deeper of those two ranges gets the safer format, the shallower one the more
          aggressive one, which lines up with the same instinct GLM-5.3&rsquo;s own Unsloth recipe encodes
          for its last three layers&rsquo; <code>ffn_down_exps</code> — later layers get more precision —
          extended here to a full imatrix-driven per-layer sweep rather than a fixed rule of thumb.
        </p>
      </div>
    </figure>
  )
}
