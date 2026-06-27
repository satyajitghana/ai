"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Mixture-of-Agents, made tunable. MoA stacks L layers; each layer runs n agents
// as "proposers", and every agent in a layer reads ALL outputs of the previous
// layer through an Aggregate-and-Synthesize prompt. Add layers and watch the
// synthesized answer sharpen — the paper's "collaborativeness" effect: models
// improve when shown peers' answers, even weaker ones. Illustrative trace of one
// factual question; the quality bar is a stand-in for AlpacaEval-style win rate.

const PROPOSERS = ["Qwen-110B", "WizardLM-8x22B", "Llama-3-70B", "Mixtral-8x22B"]

// hand-authored synthesized answer + a stand-in quality at each depth
const STAGES = [
  {
    label: "single model",
    answer:
      "The Kuiper Belt is past Neptune. It has icy bodies. Pluto is one of them.",
    quality: 57,
    note: "One model, one pass — fluent but thin, and it drops the scattered disc entirely.",
  },
  {
    label: "1 MoA layer",
    answer:
      "Beyond Neptune (~30–50 AU) lies the Kuiper Belt of icy bodies — Pluto, Haumea, Makemake — the source of short-period comets, distinct from the more distant scattered disc.",
    quality: 65,
    note: "The aggregator reads all four proposers at once: one supplied the AU range, another the dwarf planets, a third the comet link. Synthesis keeps the parts each got right.",
  },
  {
    label: "2 MoA layers",
    answer:
      "Beyond Neptune (~30–50 AU) lies the Kuiper Belt — a torus of icy planetesimals left from planet formation. It hosts dwarf planets (Pluto, Haumea, Makemake), feeds the short-period comets, and grades outward into the dynamically hotter scattered disc; not to be confused with the far more distant Oort cloud.",
    quality: 70,
    note: "A second layer re-aggregates the first layer's syntheses — errors that survived one round get cross-checked again, and the Oort-cloud confusion is caught.",
  },
]

export function MoANetwork() {
  const [stage, setStage] = useState(0)
  const layers = stage // 0, 1, or 2 MoA layers
  const s = STAGES[stage]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
        <span className="text-muted-foreground">mixture-of-agents · depth</span>
        <div className="flex gap-1">
          {STAGES.map((o, i) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setStage(i)}
              aria-pressed={stage === i}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                stage === i
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {/* layered graph */}
        <div className="space-y-2">
          {Array.from({ length: layers }).map((_, li) => (
            <div key={li}>
              <div className="mb-1 font-mono text-[10px] text-muted-foreground">
                layer {li + 1} · proposers
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PROPOSERS.map((p, pi) => (
                  <div
                    key={p}
                    className="flex items-center gap-1.5 rounded-md border bg-muted/30 px-2 py-1.5 font-mono text-[11px]"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ background: `oklch(0.72 0.14 ${pi * 70 + 120})` }}
                    />
                    <span className="truncate">{p}</span>
                  </div>
                ))}
              </div>
              <div className="py-1 text-center font-mono text-[10px] text-muted-foreground/60">
                ↓ all outputs → every agent in the next layer (aggregate &amp; synthesize)
              </div>
            </div>
          ))}

          {/* final aggregator */}
          <div className="rounded-md border border-foreground/30 bg-background px-3 py-2 text-center font-mono text-xs">
            {layers === 0 ? "single model" : "final aggregator"}
            <div className="text-[10px] text-muted-foreground">
              {layers === 0 ? "Hermes 4 · one pass" : "Hermes 4 · synthesize → answer"}
            </div>
          </div>
        </div>

        {/* synthesized answer */}
        <div className="mt-4 rounded-md border-l-2 border-foreground/30 bg-muted/30 px-3 py-2.5">
          <div className="font-mono text-[10px] text-muted-foreground">
            output · &ldquo;What is the Kuiper Belt?&rdquo;
          </div>
          <p className="mt-1 text-sm leading-6">{s.answer}</p>
        </div>

        {/* quality bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>answer quality (stand-in win rate)</span>
            <span className="text-foreground tabular-nums">{s.quality}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded bg-muted">
            <div
              className="h-full rounded transition-all duration-500"
              style={{
                width: `${s.quality}%`,
                background: "oklch(0.72 0.15 150)",
              }}
            />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{s.note}</p>
      </div>
    </figure>
  )
}
