"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One class, 237 fields. SoupConfig — the object soup.yaml actually deserializes to —
// is a small root with ~10 top-level keys; one of those keys, `training`, points at
// TrainingConfig, a single Pydantic model spanning 2,911 lines and 237 annotated
// fields. The grid below is one cell per field: 216 ordinary cells, plus the bottom
// row of 21 — an exact, counted subset — that are `reward_hack_*` fields alone.
// Everything else in the grid is real but its per-category breakdown is not published
// anywhere, so only that one row claims a count; the category buttons below only
// change which example field names are listed, never how many cells light up.

const ROOT_KEYS = ["base", "task", "modality", "backend", "data", "training", "output", "experiment_name", "eval", "advise"]

const COLS = 24
const ROWS = 10
const TOTAL = 237
const HACK_COUNT = 21 // reward_hack_* — counted directly, not estimated

type Category = { key: string; label: string; fields: string[] }

const CATEGORIES: Category[] = [
  { key: "core", label: "core", fields: ["epochs", "lr", "batch_size", "gradient_accumulation_steps", "optimizer"] },
  { key: "pref", label: "preference / RLHF", fields: ["dpo_beta", "kto_beta", "orpo_beta", "simpo_gamma", "grpo_beta", "num_generations", "reward_fn"] },
  { key: "hack", label: `reward-hack control (${HACK_COUNT})`, fields: ["reward_hack_detector", "reward_hack_mitigation", "reward_hack_pid_kp", "reward_hack_pid_ki", "reward_hack_beta_floor", "reward_hack_beta_ceil", "reward_hack_rollback"] },
  { key: "stream", label: "layer streaming", fields: ["stream_layers", "stream_source", "stream_buffers", "stream_pin", "stream_vram_probe", "stream_disk_kind"] },
  { key: "peft", label: "PEFT variants", fields: ["relora_steps", "use_galore", "galore_rank", "lisa_enabled", "grace_codebook"] },
  { key: "other", label: "curriculum / unlearn / RAG", fields: ["curriculum_dynamic", "unlearn_method", "ra_dit_stage", "citation_faithful"] },
]

export function ConfigSurface() {
  const [active, setActive] = useState<string>("hack")
  const cat = CATEGORIES.find((c) => c.key === active) ?? CATEGORIES[0]

  const W = 720
  const PAD = 18
  const gap = 3
  const innerW = W - PAD * 2
  const cellW = (innerW - (COLS - 1) * gap) / COLS
  const cellH = cellW
  const gridH = ROWS * cellH + (ROWS - 1) * gap
  const H = gridH + 30

  const cells = Array.from({ length: TOTAL }, (_, i) => i)
  const hackStart = TOTAL - HACK_COUNT // 216

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">soup.yaml → SoupConfig → training: TrainingConfig</span>
        <span className="text-muted-foreground/70">237 fields · 2,911 lines · 156 validators</span>
      </div>

      <div className="p-3 sm:p-4">
        {/* SoupConfig root — the part a user actually types */}
        <div className="mb-3 flex flex-wrap items-center gap-1.5 font-mono text-[10.5px]">
          <span className="mr-1 text-muted-foreground">SoupConfig root:</span>
          {ROOT_KEYS.map((k) => (
            <span
              key={k}
              className={cn(
                "rounded border px-1.5 py-0.5",
                k === "training" ? "border-foreground/40 font-semibold text-foreground" : "border-border text-muted-foreground"
              )}
            >
              {k}
            </span>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`TrainingConfig: 237 annotated fields in one Pydantic model, of which 21 are reward_hack_* fields alone.`}>
          {cells.map((i) => {
            const col = i % COLS
            const row = Math.floor(i / COLS)
            const isHack = i >= hackStart
            return (
              <rect
                key={i}
                x={PAD + col * (cellW + gap)}
                y={row * (cellH + gap)}
                width={cellW}
                height={cellH}
                rx={2}
                fill={isHack ? "oklch(0.62 0.2 25)" : "var(--muted-foreground)"}
                opacity={isHack ? (active === "hack" ? 1 : 0.85) : 0.22}
                className="transition-all duration-200"
              />
            )
          })}
          {/* bracket under the reward-hack row (exactly the 21 highlighted cells) */}
          <line
            x1={PAD + (hackStart % COLS) * (cellW + gap)}
            y1={ROWS * (cellH + gap) - gap + 6}
            x2={PAD + (((TOTAL - 1) % COLS) + 1) * (cellW + gap) - gap}
            y2={ROWS * (cellH + gap) - gap + 6}
            stroke="oklch(0.62 0.2 25)"
            strokeWidth={1.5}
          />
          <text
            x={PAD + (((TOTAL - 1) % COLS) + 1) * (cellW + gap) - gap}
            y={gridH + 22}
            textAnchor="end"
            className="font-mono"
            fill="oklch(0.62 0.2 25)"
            fontSize={10.5}
            fontWeight={600}
          >
            21 of 237 are reward_hack_* fields alone
          </text>
        </svg>

        {/* category selector */}
        <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10.5px]">
          {CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setActive(c.key)}
              aria-pressed={active === c.key}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                active === c.key ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {cat.fields.map((f) => (
            <code key={f} className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10.5px] text-foreground">
              {f}
            </code>
          ))}
        </div>
        <p className="mt-1 font-mono text-[10px] text-muted-foreground">
          example fields, not exhaustive — only the reward-hack row above is a published count.
        </p>
      </div>
    </figure>
  )
}
