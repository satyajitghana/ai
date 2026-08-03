"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Reproduces the exact discrepancy found by reading all three JOSIE-2 model
// cards' `model-index` YAML against their own `config.json` / `base_model`
// frontmatter. Every card's baseline row is labeled "Qwen/Qwen3.5-4B (base)"
// in the machine-readable model-index — even on the 2B and 9B cards, where
// config.json shows a same-size base throughout. Numbers below are copied
// verbatim from each card; only the label toggles between what's published
// and what config.json actually says.

const WRONG = "oklch(0.62 0.2 25)"
const RIGHT = "oklch(0.68 0.14 200)"

type Card = {
  size: string
  configBase: string
  reasoningBaseline: { arc: string; truthfulqa: string }
  reasoningJosie: { arc: string; truthfulqa: string }
  nonReasoningBaseline: { arc: string; truthfulqa: string }
  nonReasoningJosie: { arc: string; truthfulqa: string }
}

const CARDS: Card[] = [
  {
    size: "2B",
    configBase: "Qwen/Qwen3.5-2B",
    reasoningBaseline: { arc: "82.5", truthfulqa: "49.1" },
    reasoningJosie: { arc: "84.2", truthfulqa: "51.9" },
    nonReasoningBaseline: { arc: "76.4", truthfulqa: "48.9" },
    nonReasoningJosie: { arc: "78.0", truthfulqa: "50.9" },
  },
  {
    size: "4B",
    configBase: "Qwen/Qwen3.5-4B",
    reasoningBaseline: { arc: "83.4", truthfulqa: "48.9" },
    reasoningJosie: { arc: "95.5", truthfulqa: "69.2" },
    nonReasoningBaseline: { arc: "78.9", truthfulqa: "51.8" },
    nonReasoningJosie: { arc: "91.9", truthfulqa: "66.8" },
  },
  {
    size: "9B",
    configBase: "Qwen/Qwen3.5-9B",
    reasoningBaseline: { arc: "92.6", truthfulqa: "69.5" },
    reasoningJosie: { arc: "—", truthfulqa: "—" },
    nonReasoningBaseline: { arc: "85.8", truthfulqa: "64.0" },
    nonReasoningJosie: { arc: "94.2", truthfulqa: "76.7" },
  },
]

const PUBLISHED_LABEL = "Qwen/Qwen3.5-4B"

export function LabelChecker() {
  const [i, setI] = useState(0)
  const [verified, setVerified] = useState(false)
  const card = CARDS[i]
  const wrong = card.configBase !== PUBLISHED_LABEL

  const row = (label: string, r: { arc: string; truthfulqa: string }, dim = false) => (
    <div className={cn("grid grid-cols-[1fr_60px_60px] items-center gap-2 font-mono text-[11px]", dim ? "text-muted-foreground" : "text-foreground")}>
      <span className="truncate">{label}</span>
      <span className="text-right tabular-nums">{r.arc}</span>
      <span className="text-right tabular-nums">{r.truthfulqa}</span>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        JOSIE-2 model-index · published label vs config.json
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1">
            {CARDS.map((c, idx) => (
              <button
                key={c.size}
                type="button"
                onClick={() => setI(idx)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                  idx === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground"
                )}
              >
                JOSIE-2-{c.size}-OSS
              </button>
            ))}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={verified}
            onClick={() => setVerified((v) => !v)}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
              verified ? "border-foreground/30 bg-muted/50 text-foreground" : "text-muted-foreground"
            )}
          >
            {verified ? "config.json label" : "as-published label"}
          </button>
        </div>

        <div className="mt-3 grid grid-cols-[1fr_60px_60px] gap-2 font-mono text-[10px] text-muted-foreground">
          <span>baseline row</span>
          <span className="text-right">ARC-C</span>
          <span className="text-right">TruthfulQA</span>
        </div>

        <div className="mt-1 space-y-1 border-b pb-2">
          <div
            className="grid grid-cols-[1fr_60px_60px] items-center gap-2 rounded px-1 py-0.5 font-mono text-[11px]"
            style={{ color: verified ? RIGHT : wrong ? WRONG : "var(--muted-foreground)" }}
          >
            <span className="truncate">{(verified ? card.configBase : PUBLISHED_LABEL) + " (base) · reasoning"}</span>
            <span className="text-right tabular-nums">{card.reasoningBaseline.arc}</span>
            <span className="text-right tabular-nums">{card.reasoningBaseline.truthfulqa}</span>
          </div>
          {row(`JOSIE-2-${card.size}-OSS · reasoning`, card.reasoningJosie)}
          <div
            className="grid grid-cols-[1fr_60px_60px] items-center gap-2 rounded px-1 py-0.5 font-mono text-[11px] text-muted-foreground"
          >
            <span className="truncate">{(verified ? card.configBase : PUBLISHED_LABEL) + " (base) · non-reasoning"}</span>
            <span className="text-right tabular-nums">{card.nonReasoningBaseline.arc}</span>
            <span className="text-right tabular-nums">{card.nonReasoningBaseline.truthfulqa}</span>
          </div>
          {row(`JOSIE-2-${card.size}-OSS · non-reasoning`, card.nonReasoningJosie, true)}
        </div>

        {verified ? (
          wrong ? (
            <p className="mt-2 font-mono text-[11px]" style={{ color: RIGHT }}>
              config.json says the {card.size} card&apos;s own base is {card.configBase} — not {PUBLISHED_LABEL} as published.
            </p>
          ) : (
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              this is the one card where the published label happens to be correct — its real base is {card.configBase}.
            </p>
          )
        ) : (
          <p className="mt-2 font-mono text-[11px]" style={{ color: wrong ? WRONG : "var(--muted-foreground)" }}>
            every JOSIE-2 card&apos;s model-index publishes this exact same baseline label, {PUBLISHED_LABEL}, regardless of size.
          </p>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Toggle the label and the numbers never move — only the caption does. That is the artifact: the benchmark values are real, but the 2B and 9B
          cards attribute them to the wrong base model. The 9B card&apos;s reasoning-mode row for its own model is blank, published as {'"'}comming soon{'"'}
          on the card&apos;s own chart.
        </p>
      </div>
    </figure>
  )
}
