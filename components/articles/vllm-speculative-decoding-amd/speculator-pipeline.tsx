"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The post never draws its own "train a speculator" section — no figure, just
// a six-step list. This diagrams that workflow, with two things pinned to
// real, checked sources rather than paraphrase:
//
//   - the three hidden-state modes (online / offline / hybrid) are the post's
//     own three-row table, verbatim tradeoffs;
//   - the "selected target layers" annotation uses z-lab/Qwen3-8B-DFlash-b16's
//     actual published config.json: target_layer_ids [1, 9, 17, 25, 33] out of
//     36 target layers — a 5-layer drafter reading 5 of 36 target layers.

type Mode = "online" | "offline" | "hybrid"
type Method = "eagle3" | "dflash" | "dspark" | "mtp"

const MODES: { key: Mode; label: string; how: string; tradeoff: string }[] = [
  {
    key: "online",
    label: "Online",
    how: "a running vLLM server produces hidden states on demand, used once and discarded",
    tradeoff: "avoids a large disk cache, but target inference and training compete for GPUs at the same time",
  },
  {
    key: "offline",
    label: "Offline",
    how: "hidden states are generated and stored in full before training starts",
    tradeoff: "frees every GPU for training afterward, but requires substantial storage up front",
  },
  {
    key: "hybrid",
    label: "Hybrid",
    how: "hidden states are generated and cached during the first epoch, then reused",
    tradeoff: "pays the generation cost exactly once, without a separate preprocessing stage",
  },
]

const METHODS: { key: Method; label: string; collect: string }[] = [
  {
    key: "eagle3",
    label: "EAGLE-3",
    collect: "hidden states from selected target layers, for autoregressive drafting",
  },
  {
    key: "dflash",
    label: "DFlash",
    collect: "target features used to train a network that predicts a whole block in parallel",
  },
  {
    key: "dspark",
    label: "DSpark",
    collect: "the same target features, plus training for a lightweight sequential + confidence head",
  },
  {
    key: "mtp",
    label: "MTP",
    collect: "no separate speculator — fine-tunes the target's own MTP path (needs compatible layers already)",
  },
]

const STAGES = [
  "Prepare prompts\n+ target responses",
  "Choose hidden-\nstate mode",
  "Collect target\nhidden states",
  "Train the\nspeculator",
  "Test acceptance\n+ throughput",
]

const C = "oklch(0.6 0.15 255)"
const WARN = "oklch(0.62 0.19 25)"

export function SpeculatorPipeline() {
  const [mode, setMode] = useState<Mode>("hybrid")
  const [method, setMethod] = useState<Method>("dflash")
  const activeMode = MODES.find((m) => m.key === mode)!
  const activeMethod = METHODS.find((m) => m.key === method)!

  const W = 700
  const H = 190
  const n = STAGES.length
  const boxW = 108
  const boxH = 52
  const gap = (W - 20 - n * boxW) / (n - 1)
  const bx = (i: number) => 10 + i * (boxW + gap)
  const by = 26

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">training a speculator for a new target model</span>
        <span className="font-mono text-[10px] text-muted-foreground">not figured in the source post</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              A five-stage speculator training pipeline: prepare prompts and target responses, choose a hidden-state
              collection mode, collect target hidden states, train the speculator, then test acceptance and serving
              throughput — looping back to adjust the prompt mix if acceptance is weak.
            </title>
            <defs>
              <marker id="sp-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={C} strokeWidth={1.5} />
              </marker>
              <marker id="sp-arrow-warn" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={WARN} strokeWidth={1.5} />
              </marker>
              <filter id="sp-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
              </filter>
            </defs>

            {/* forward arrows */}
            {STAGES.slice(0, -1).map((_, i) => (
              <path
                key={i}
                d={`M ${bx(i) + boxW} ${by + boxH / 2} L ${bx(i + 1) - 2} ${by + boxH / 2}`}
                stroke={C}
                strokeWidth={1.5}
                markerEnd="url(#sp-arrow)"
              />
            ))}

            {/* feedback loop: stage 5 back to stage 1 */}
            <path
              d={`M ${bx(4) + boxW / 2} ${by + boxH + 4} C ${bx(4) + boxW / 2} ${by + boxH + 34}, ${bx(0) + boxW / 2} ${
                by + boxH + 34
              }, ${bx(0) + boxW / 2} ${by + boxH + 4}`}
              fill="none"
              stroke={WARN}
              strokeWidth={1.5}
              strokeDasharray="4,3"
              markerEnd="url(#sp-arrow-warn)"
            />
            <text x={W / 2} y={by + boxH + 48} textAnchor="middle" fontSize={9.5} fill={WARN} fontFamily="ui-monospace, monospace">
              acceptance weak on the target workload → adjust prompt mix or training config, retrain
            </text>

            {STAGES.map((s, i) => {
              const isMode = i === 1
              const isCollect = i === 2
              return (
                <g key={i}>
                  <rect
                    x={bx(i)}
                    y={by}
                    width={boxW}
                    height={boxH}
                    rx={9}
                    fill="var(--background)"
                    stroke={isMode || isCollect ? C : "var(--border)"}
                    strokeWidth={isMode || isCollect ? 1.75 : 1.25}
                    filter="url(#sp-soft)"
                  />
                  {s.split("\n").map((line, li) => (
                    <text
                      key={li}
                      x={bx(i) + boxW / 2}
                      y={by + boxH / 2 - 6 + li * 12}
                      textAnchor="middle"
                      fontSize={10}
                      fill="currentColor"
                      fillOpacity={0.85}
                      fontFamily="ui-monospace, monospace"
                    >
                      {line}
                    </text>
                  ))}
                  <text x={bx(i) + 8} y={by - 6} fontSize={9} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    {i + 1}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">stage 2 — hidden-state mode</div>
            <div className="flex flex-wrap gap-1.5">
              {MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMode(m.key)}
                  aria-pressed={mode === m.key}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    mode === m.key
                      ? "border-foreground/30 bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              <span className="text-foreground">{activeMode.how}.</span> {activeMode.tradeoff}.
            </p>
          </div>

          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">stage 3 — what gets collected</div>
            <div className="flex flex-wrap gap-1.5">
              {METHODS.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setMethod(m.key)}
                  aria-pressed={method === m.key}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                    method === m.key
                      ? "border-foreground/30 bg-muted/50 text-foreground"
                      : "border-border text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{activeMethod.collect}.</p>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A concrete instance of stage 3: Z-Lab&rsquo;s published{" "}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">Qwen3-8B-DFlash-b16</code> config
          lists <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">target_layer_ids: [1, 9, 17, 25, 33]</code>{" "}
          against a 36-layer target — a 5-layer drafter reading five of the target&rsquo;s thirty-six layers, not the
          whole stack. That number comes from the checkpoint&rsquo;s own config.json, not from the blog post.
        </p>
      </div>
    </figure>
  )
}
