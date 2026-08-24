"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The actual shape of the 3B suite, drawn to scale.
//
// The thing worth seeing is that the blocks get shorter and much wider as you go
// up: 24 layers at width 1024, then 10 at 2304, then 5 at 4352. That is the
// opposite of how a uniform-width early-exit model looks, and it is what lets
// each exit hit its parameter target with a KV-cache footprint that scales with
// the exit rather than with the full stack.
//
// The junction between blocks adds no parameters at all. Concatenating a
// Transformer output with a fresh input embedding creates a magnitude mismatch —
// outputs have much larger norms than embeddings, which destabilizes the low-index
// channels — so the output is rescaled to match the embedding's norm first:
//
//   o~ = o * ||e|| / ||o||
//   next input = concat(e, o~)
//
// Both halves of that matter empirically. Table 3's ablation at 200M scale:
// dropping the norm match costs +0.15 average PPL, and replacing the fresh
// embedding with zeros costs +0.54.
//
// All figures are Table 1. The Vanilla 3B reference footprint is 266.0 KB/token
// and 5.54 GFLOPs/token.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Suite = {
  key: string
  label: string
  blocks: { exit: string; params: number; cumul: number; d: number; layers: number; heads: number; hd: number; ffn: number }[]
  note: string
}

const SUITES: Suite[] = [
  {
    key: "mat",
    label: "Matryoshka",
    note: "One architecture, 39 layers total, three exits. Each block is shorter and wider than the one below it — the depth triplet (24, 10, 5) was chosen from a sweep of every feasible split of 39 layers, to land on the Vanilla 3B's KV cache and per-token FLOPs simultaneously.",
    blocks: [
      { exit: "500M", params: 0.5, cumul: 0.5, d: 1024, layers: 24, heads: 16, hd: 64, ffn: 4096 },
      { exit: "1.5B", params: 0.98, cumul: 1.48, d: 2304, layers: 10, heads: 24, hd: 96, ffn: 9216 },
      { exit: "3B", params: 1.72, cumul: 3.2, d: 4352, layers: 5, heads: 34, hd: 128, ffn: 17408 },
    ],
  },
  {
    key: "van",
    label: "Vanilla",
    note: "Three independent Llama-style models at matched sizes, following established small-LM conventions — the 500M and 1.5B mirror SmolLM2, the 3B follows Llama-3.2-3B. Same tokenizer, same data, same hyperparameters. Nothing is shared, so the totals add up.",
    blocks: [
      { exit: "500M", params: 0.5, cumul: 0.5, d: 1024, layers: 24, heads: 16, hd: 64, ffn: 4096 },
      { exit: "1.5B", params: 1.51, cumul: 1.51, d: 1728, layers: 28, heads: 18, hd: 96, ffn: 6912 },
      { exit: "3B", params: 3.19, cumul: 3.19, d: 2560, layers: 28, heads: 20, hd: 128, ffn: 10240 },
    ],
  },
]

export function NestedStack() {
  const [sel, setSel] = useState("mat")
  const s = SUITES.find((x) => x.key === sel) ?? SUITES[0]
  const nested = sel === "mat"
  const total = nested ? s.blocks[2].cumul : s.blocks.reduce((a, b) => a + b.params, 0)

  const maxD = 4352
  const W = 720
  const ROW = 30
  const GAP = 8
  const H = s.blocks.length * (ROW + GAP) + 46

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {nested ? "39 layers, three exits, one run" : "three architectures, three runs"}
        </span>
        <span className="font-mono text-[10px]" style={{ color: nested ? GOOD : WARM }}>
          {total.toFixed(2)}B parameters trained
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SUITES.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label} suite
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[620px] max-w-full">
            <title>
              Each sub-model drawn as a bar whose width is the model&rsquo;s hidden dimension and whose label gives
              its layer count, stacked from the smallest exit at the bottom to the largest at the top
            </title>
            <text x={4} y={12} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              bar width = hidden dimension · stacked bottom-up, smallest first
            </text>

            {s.blocks
              .slice()
              .reverse()
              .map((b, ri) => {
                const i = s.blocks.length - 1 - ri
                const y = 24 + ri * (ROW + GAP)
                const w = (b.d / maxD) * (W - 190)
                const c = [GOOD, ACCENT, WARM][i]
                return (
                  <g key={b.exit}>
                    <rect x={70} y={y} width={Math.max(24, w)} height={ROW} rx={4} fill={c} fillOpacity={0.85} />
                    <text
                      x={70 + Math.max(24, w) / 2}
                      y={y + 19}
                      fontSize={10}
                      fill="#0c0a09"
                      textAnchor="middle"
                      fontFamily="ui-monospace, monospace"
                    >
                      {b.layers} layers × {b.d}
                    </text>
                    <text x={62} y={y + 19} fontSize={10} fill={c} textAnchor="end" fontFamily="ui-monospace, monospace">
                      {b.exit}
                    </text>
                    <text
                      x={W - 4}
                      y={y + 12}
                      fontSize={9}
                      fill="currentColor"
                      fillOpacity={0.6}
                      textAnchor="end"
                      fontFamily="ui-monospace, monospace"
                    >
                      {b.heads} heads × {b.hd} · FFN {b.ffn.toLocaleString()}
                    </text>
                    <text
                      x={W - 4}
                      y={y + 24}
                      fontSize={9}
                      fill={c}
                      textAnchor="end"
                      fontFamily="ui-monospace, monospace"
                    >
                      {nested ? `+${b.params.toFixed(2)}B → ${b.cumul.toFixed(2)}B` : `${b.params.toFixed(2)}B standalone`}
                    </text>
                    {nested && ri < s.blocks.length - 1 ? (
                      <text
                        x={70}
                        y={y + ROW + 7}
                        fontSize={8}
                        fill="currentColor"
                        fillOpacity={0.45}
                        fontFamily="ui-monospace, monospace"
                      >
                        ↑ junction: rescale to ‖e‖, then concat a fresh embedding for the new channels
                      </text>
                    ) : null}
                  </g>
                )
              })}
          </svg>
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
          {s.note}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Flip between the two and watch the bars change direction. The Vanilla suite gets{" "}
          <em>wider and deeper</em>{" "}with size, as models normally do. The Matryoshka suite gets much wider and
          much <em>shallower</em>, because its blocks are increments rather than models: the 3B exit is five layers
          of width 4352 sitting on top of everything below it.
          <br />
          <br />
          That shape is deliberate and it is the part most likely to be misread as arbitrary. The authors sweep
          every feasible way to split 39 layers into three blocks and pick (24, 10, 5) because it lands on the
          Vanilla 3B&rsquo;s KV cache <em>and</em>{" "}its per-token FLOPs at the same time — 266 KB and
          5.54 GFLOPs per token. Shallower budgets undershoot the memory footprint, deeper ones inflate the KV
          cache.{" "}
          <span className="text-foreground">The comparison is only fair because the shape was chosen to make it
          fair</span>, which is a nicer piece of experimental design than it first looks.
        </p>
      </div>
    </figure>
  )
}
