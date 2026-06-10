"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Interactive architecture ↔ code map of the sparse-MoE language model. Click a
// block in the flow and its actual forward() code appears alongside. The MoE
// block carries a live router→experts fan-out (top-2 of 8 lit) so the one line
// that swaps a dense FFN for experts reads as the centre of the model.

const EXPERTS = 8
const ACTIVE = new Set([2, 5]) // the two experts this token routes to
const COLORS = Array.from(
  { length: EXPERTS },
  (_, i) => `oklch(0.72 0.13 ${(i * 45) % 360})`
)

type StageId = "embed" | "attn" | "moe" | "head"

const STAGES: Record<
  StageId,
  { label: string; shape: string; code: string; note: string }
> = {
  embed: {
    label: "token + position embeddings",
    shape: "(B, T) → (B, T, C)",
    code: `tok_emb = self.token_embedding_table(idx)      # (B,T,C)
pos_emb = self.position_embedding_table(arange(T))  # (T,C)
x = tok_emb + pos_emb`,
    note: "Tokens become vectors; positions are added so order carries.",
  },
  attn: {
    label: "self-attention + residual",
    shape: "(B, T, C) → (B, T, C)",
    code: `x = x + self.sa(self.ln1(x))   # multi-head attention`,
    note: "Each token mixes in earlier tokens. Identical to a dense transformer — MoE leaves attention alone.",
  },
  moe: {
    label: "sparse MoE + residual",
    shape: "(B, T, C) → (B, T, C)",
    code: `x = x + self.smoe(self.ln2(x))   # <- was a single MLP

# inside SparseMoE.forward:
gates, idx = self.router(x)            # pick top-2 of 8
for i, expert in enumerate(self.experts):
    mask = (idx == i).any(-1)          # tokens routed here
    out[mask] += gates[mask, i] * expert(x[mask])`,
    note: "The whole idea, in one swapped line. A router sends each token to 2 of 8 expert MLPs; their gated outputs are summed.",
  },
  head: {
    label: "final norm → LM head",
    shape: "(B, T, C) → (B, T, vocab)",
    code: `x = self.ln_f(x)
logits = self.lm_head(x)   # (B,T,vocab_size)`,
    note: "Project back to vocabulary logits — the next-token distribution.",
  },
}

function Box({
  id,
  selected,
  onSelect,
  children,
  accent,
}: {
  id: StageId
  selected: StageId
  onSelect: (id: StageId) => void
  children: React.ReactNode
  accent?: boolean
}) {
  const active = selected === id
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={active}
      className={cn(
        "w-full cursor-pointer rounded-md border px-3 py-2 text-left transition-all",
        active
          ? "border-foreground/40 bg-foreground/[0.06] ring-1 ring-foreground/20"
          : "hover:border-foreground/30 hover:bg-muted/40",
        accent && !active && "border-foreground/20"
      )}
    >
      {children}
    </button>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center py-1 text-muted-foreground/50" aria-hidden>
      <svg width="12" height="14" viewBox="0 0 12 14">
        <path
          d="M6 0 V12 M2 8 L6 12 L10 8"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </div>
  )
}

export function MoeArchitecture() {
  const [selected, setSelected] = useState<StageId>("moe")
  const stage = STAGES[selected]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        sparse-MoE language model — tap a block to read its code
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* flow diagram */}
        <div className="font-mono text-xs">
          <div className="mb-1 text-center text-[10px] text-muted-foreground">
            idx (B, T)
          </div>
          <Arrow />
          <Box id="embed" selected={selected} onSelect={setSelected}>
            <div className="font-medium">embeddings</div>
            <div className="text-[10px] text-muted-foreground">token + position</div>
          </Box>
          <Arrow />

          {/* repeated transformer block */}
          <div className="relative rounded-md border border-dashed border-foreground/25 p-2 pt-4">
            <span className="absolute -top-2 left-3 bg-background px-1 text-[10px] text-muted-foreground">
              transformer block × 8
            </span>
            <Box id="attn" selected={selected} onSelect={setSelected}>
              <div className="font-medium">ln → multi-head attention</div>
              <div className="text-[10px] text-muted-foreground">+ residual</div>
            </Box>
            <Arrow />
            <Box id="moe" selected={selected} onSelect={setSelected} accent>
              <div className="flex items-center justify-between">
                <div className="font-medium">ln → sparse MoE</div>
                <span className="rounded bg-muted px-1 text-[9px] text-muted-foreground">
                  top-2 / 8
                </span>
              </div>
              {/* live router → experts fan-out */}
              <div className="mt-2 flex items-center gap-2">
                <span className="rounded border border-foreground/30 px-1.5 py-0.5 text-[9px]">
                  router
                </span>
                <span className="text-muted-foreground/50">→</span>
                <div className="flex flex-1 gap-1">
                  {Array.from({ length: EXPERTS }, (_, i) => (
                    <div
                      key={i}
                      className="h-5 flex-1 rounded-sm transition-all"
                      title={`expert ${i}${ACTIVE.has(i) ? " (active)" : ""}`}
                      style={{
                        background: COLORS[i],
                        opacity: ACTIVE.has(i) ? 1 : 0.16,
                      }}
                    />
                  ))}
                </div>
              </div>
            </Box>
          </div>

          <Arrow />
          <Box id="head" selected={selected} onSelect={setSelected}>
            <div className="font-medium">final norm → LM head</div>
            <div className="text-[10px] text-muted-foreground">→ logits</div>
          </Box>
          <Arrow />
          <div className="text-center text-[10px] text-muted-foreground">
            logits (B, T, vocab)
          </div>
        </div>

        {/* code panel */}
        <div className="flex flex-col rounded-md border bg-muted/30">
          <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
            <span className="font-medium">{stage.label}</span>
            <span className="text-muted-foreground">{stage.shape}</span>
          </div>
          <pre className="flex-1 overflow-x-auto px-3 py-3 font-mono text-[11px] leading-5">
            {stage.code}
          </pre>
          <p className="border-t px-3 py-2 text-xs leading-5 text-muted-foreground">
            {stage.note}
          </p>
        </div>
      </div>
    </figure>
  )
}
