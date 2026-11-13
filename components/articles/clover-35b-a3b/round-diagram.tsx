"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One self-speculative round of Clover, as SGLang PR 46927 runs it
// (python/sglang/srt/speculative/clover_worker.py at head a1eee6c).
//
//   1. preview: block = [pending, MASK x (W-1)], forward_mode DLLM_EXTEND. Bidirectional
//      inside the block, the cache is read but never written. The MoE router gate applies
//      the block coreset (CloverSparseMoeBlock.forward checks is_dllm_extend()).
//   2. candidates = argmax of each slot's same-position logits; slot 0 stays the pending token.
//   3. verify: the same weights, causal, forward_mode TARGET_VERIFY (inherited from
//      DFlashVerifyInput.prepare_for_verify). No coreset: each token routes to its own top 8.
//      logits[j] verify candidates[j + 1].
//   4. accept: the longest passing prefix, r drafts (exact or threshold rule), plus one bonus
//      token sampled from logits[r]. Output r + 1 tokens; KV / conv / SSM state advances by r + 1.
// Static layout; the only state is which stage is shown and r.

const W = 32
const STAGES = [
  { key: "preview", label: "1. Preview" },
  { key: "verify", label: "2. Verify" },
  { key: "accept", label: "3. Accept" },
] as const
type Stage = (typeof STAGES)[number]["key"]

export function RoundDiagram() {
  const [stage, setStage] = useState<Stage>("preview")
  const [r, setR] = useState(6)

  const cell = 18
  const gap = 2
  const left = 8
  const width = left * 2 + W * (cell + gap)
  const y0 = 34

  function slotClass(i: number) {
    if (stage === "preview") return i === 0 ? "fill-amber-500/80" : "fill-muted-foreground/25"
    if (stage === "verify") return i === 0 ? "fill-amber-500/80" : "fill-sky-500/60"
    if (i === 0) return "fill-amber-500/80"
    if (i <= r) return "fill-emerald-500/70"
    return "fill-rose-500/25"
  }

  return (
    <div className="my-8 rounded-xl border border-border bg-card/40 p-4 sm:p-5">
      <div className="mb-3 text-sm font-medium">One self-speculative round, as the SGLang worker runs it</div>
      <div className="flex flex-wrap gap-2 text-xs">
        {STAGES.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => setStage(s.key)}
            className={cn("rounded-full border px-3 py-1", stage === s.key ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} 96`} className="mt-4 w-full" role="img" aria-label={`A block of ${W} slots at the ${stage} stage`}>
        <text x={left} y={18} fontSize={11} className="fill-muted-foreground">
          {stage === "preview"
            ? "input: pending token + 31 masks · bidirectional in the block · coreset ON"
            : stage === "verify"
              ? "input: pending token + 31 candidates · causal · coreset OFF (TARGET_VERIFY)"
              : `kept: ${r} drafts + 1 bonus = ${r + 1} tokens · state advances by ${r + 1}`}
        </text>
        {Array.from({ length: W }, (_, i) => (
          <g key={i}>
            <rect x={left + i * (cell + gap)} y={y0} width={cell} height={cell} rx={3} className={slotClass(i)} />
            {stage === "preview" && i > 0 && (
              <text x={left + i * (cell + gap) + cell / 2} y={y0 + 13} fontSize={9} textAnchor="middle" className="fill-muted-foreground">
                M
              </text>
            )}
          </g>
        ))}
        {stage === "verify" &&
          Array.from({ length: W - 1 }, (_, j) => (
            <path
              key={j}
              d={`M ${left + j * (cell + gap) + cell / 2} ${y0 + cell + 4} q ${(cell + gap) / 2} 12 ${cell + gap} 0`}
              className="fill-none stroke-sky-600/50"
              strokeWidth={1}
            />
          ))}
        {stage === "accept" && r + 1 < W && (
          <rect
            x={left + (r + 1) * (cell + gap) - gap}
            y={y0 - 4}
            width={cell + 2 * gap}
            height={cell + 8}
            rx={4}
            className="fill-none stroke-emerald-600"
            strokeDasharray="3 2"
          />
        )}
        <text x={left} y={y0 + cell + 30} fontSize={10} className="fill-muted-foreground">
          {stage === "preview"
            ? "each slot's logits predict the token at that same slot; argmax gives 31 candidates"
            : stage === "verify"
              ? "logits at slot j check the candidate at slot j + 1"
              : r + 1 < W
                ? `dashed: slot ${r + 1}, where the bonus token from the verify logits goes`
                : "every draft passed; the bonus token starts the next round"}
        </text>
      </svg>

      {stage === "accept" && (
        <label className="mt-3 flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">drafts kept r</span>
          <Range min={0} max={W - 1} step={1} value={r} onChange={(e) => setR(Number(e.currentTarget.value))} className="flex-1" aria-label="drafts kept" />
          <span className="w-8 shrink-0 text-right font-mono tabular-nums">{r}</span>
        </label>
      )}

      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        Two forward passes over the same weights per round. The preview never writes the cache; the verify
        pass is an ordinary causal pass whose state is kept only up to the accepted prefix. The expert
        coreset applies to the preview alone, so the verify pass reads every expert its {W} tokens pick.
      </p>
    </div>
  )
}
