"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The teacher-first pipeline as a map of what is and is not on the public
// record. Each stage is a node; click one to see what the model card, the
// config and the files actually say about it. Nodes are tagged by evidence:
// "measured" (I computed it from files), "reported" (the publisher said it) or
// "unknown" (nothing public). The flow arrows animate unless the reader prefers
// reduced motion. All coordinates are literals, so SSR and the browser agree.

type Tag = "measured" | "reported" | "unknown"

type Stage = {
  id: string
  title: string
  sub: string
  x: number
  y: number
  tag: Tag
  facts: { tag: Tag; text: string }[]
}

const STAGES: Stage[] = [
  {
    id: "base",
    title: "33B-Base",
    sub: "pretrained",
    x: 14,
    y: 40,
    tag: "measured",
    facts: [
      { tag: "measured", text: "Dense Llama architecture, 33,118,977,024 parameters, 52 layers, 8 KV heads, 128K positions in its config." },
      { tag: "reported", text: "Beats Gemma4-31B-Base on all eight listed benchmarks (MMLU-Pro 66.9 vs 59.3, GPQA 62.0 vs 41.5)." },
      { tag: "unknown", text: "Pretraining tokens, data mix, compute, and whether it was trained from scratch." },
    ],
  },
  {
    id: "post",
    title: "Post-training",
    sub: "recipe",
    x: 38,
    y: 40,
    tag: "unknown",
    facts: [
      { tag: "measured", text: "Weights moved: ordinary embedding rows differ by about 28% from Base, and the seven new chat tokens went from near-zero to trained." },
      { tag: "measured", text: "Context stretched on paper: rope_theta 1e7 and 131,072 positions in Base, 1.2e8 and 524,288 in the chat model." },
      { tag: "unknown", text: "SFT data, RL algorithm and rewards, agent environments, scaffolds used for trajectories. No technical report is linked." },
    ],
  },
  {
    id: "teacher",
    title: "33B teacher",
    sub: "released",
    x: 62,
    y: 40,
    tag: "reported",
    facts: [
      { tag: "reported", text: "Leads 17 of 20 listed benchmarks against Qwen3.8-27B, Muse-Glimmer-30B and Gemma4-31B at highest thinking effort." },
      { tag: "reported", text: "Same harness and hyperparameters per benchmark across models; Nanbeige scored with preserve_thinking=true." },
      { tag: "unknown", text: "Tokens per task, cost per task, and whether rivals got an equivalent thinking-retention setting." },
    ],
  },
  {
    id: "student",
    title: "3B student",
    sub: "announced",
    x: 86,
    y: 40,
    tag: "unknown",
    facts: [
      { tag: "reported", text: "The post says the 33B will serve as a teacher for smaller models, starting with Nanbeige4.3-3B." },
      { tag: "measured", text: "No Nanbeige4.3-3B repository existed in a Hugging Face search on 26 October 2026." },
      { tag: "unknown", text: "Distillation method (logits, trajectories, or both), data size, student architecture. The earlier 4.2-3B was a two-pass looped transformer; whether 4.3 keeps that is not stated." },
    ],
  },
]

const COL: Record<Tag, string> = {
  measured: "oklch(0.62 0.12 190)",
  reported: "oklch(0.66 0.14 70)",
  unknown: "oklch(0.6 0.02 260)",
}

export function TeacherMap() {
  const [sel, setSel] = useState("teacher")
  const cur = STAGES.find((s) => s.id === sel) ?? STAGES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <style>{`
        @keyframes nb-flow { to { stroke-dashoffset: -14; } }
        .nb-flow { animation: nb-flow 1.2s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .nb-flow { animation: none; } }
      `}</style>
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">teacher first · what is on the record</div>
      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 100 62" className="w-full" role="img" aria-label="Four stages in a row: 33B-Base, post-training, 33B teacher, 3B student. The arrow into the student is the announced distillation; its method is unknown.">
          {STAGES.slice(0, -1).map((s, i) => {
            const n = STAGES[i + 1]
            const dash = n.tag === "unknown" || s.tag === "unknown"
            return (
              <line
                key={s.id}
                x1={s.x + 8.5}
                y1={s.y}
                x2={n.x - 8.5}
                y2={n.y}
                stroke="currentColor"
                strokeOpacity={dash ? 0.4 : 0.7}
                strokeWidth="0.7"
                strokeDasharray="2.4 2.4"
                className="nb-flow"
              />
            )
          })}
          <text x="74" y="31" textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="2.6">
            distill: unspecified
          </text>
          {STAGES.map((s) => {
            const on = s.id === sel
            return (
              <g key={s.id} onClick={() => setSel(s.id)} style={{ cursor: "pointer" }}>
                <rect
                  x={s.x - 8}
                  y={s.y - 8}
                  width="16"
                  height="16"
                  rx="2"
                  fill={COL[s.tag]}
                  fillOpacity={on ? 0.3 : 0.12}
                  stroke={COL[s.tag]}
                  strokeWidth={on ? 1 : 0.5}
                  strokeDasharray={s.tag === "unknown" ? "1.6 1.2" : undefined}
                />
                <text x={s.x} y={s.y - 0.5} textAnchor="middle" className="fill-foreground font-mono" fontSize="2.8">
                  {s.title}
                </text>
                <text x={s.x} y={s.y + 3.4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize="2.4">
                  {s.sub}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 flex flex-wrap gap-1">
          {STAGES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setSel(s.id)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
                s.id === sel ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s.title}
            </button>
          ))}
        </div>

        <ul className="mt-3 space-y-2 text-sm">
          {cur.facts.map((f) => (
            <li key={f.text} className="flex gap-2">
              <span className="mt-0.5 w-16 shrink-0 rounded border px-1 py-0.5 text-center font-mono text-[10px]" style={{ color: COL[f.tag], borderColor: COL[f.tag] }}>
                {f.tag}
              </span>
              <span>{f.text}</span>
            </li>
          ))}
        </ul>
      </div>
    </figure>
  )
}
