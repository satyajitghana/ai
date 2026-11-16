"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One deepseek-ultrafast decode step at TP4, stage by stage, as the source
// (basetenlabs/deepseek-ultrafast @ 76766a9) lays it out:
//   capture_spec_vadapt / dspark_draft / markov_rounds  (crates/engine/src/model.rs)
//   forward_impl -> layer() x 40 -> head() -> pick_head / samp_stats
//   spec_accept                                        (crates/kernels/cu/ops.cu)
//   comm_* push kernels                                (crates/kernels/cu/comm.cu)
//   block 6 and theta 0.3 on sm_103 TP4                (crates/cuda/src/profile.rs)
//   experts sliced inter / tp, vocab / tp, heads / tp  (crates/engine/src/weights.rs)
// Sizes are the checkpoint's config: dim 5120, 64 heads, 384 experts, 2,304
// expert width, vocab 129,280.

type Lane = { text: string; busy: number }
type Stage = {
  key: string
  name: string
  rows: string
  comm: string | null
  what: string
  lanes: [Lane, Lane, Lane, Lane] | "same"
  lane?: Lane
}

const STAGES: Stage[] = [
  {
    key: "launch",
    name: "launch the step",
    rows: "none yet",
    comm: null,
    what: "Each GPU's host thread launches the same captured CUDA graph and, while it runs, reads back how many tokens the previous step committed. No logits or drafts cross to the CPU.",
    lanes: "same",
    lane: { text: "graph launch, read step n-1's count", busy: 0.15 },
  },
  {
    key: "draft",
    name: "draft: three DSpark layers",
    rows: "6 rows: the last token + 5 noise tokens",
    comm: "all-reduce after attention and after the MoE, in every draft layer",
    what: "The drafter runs all six positions at once (semi-autoregressive). Each GPU holds 16 of the 64 heads and a quarter of each of the 3 experts (of 128) a row routes to.",
    lanes: "same",
    lane: { text: "16 heads · 1/4 of 3 experts a row", busy: 0.55 },
  },
  {
    key: "markov",
    name: "draft head + Markov rounds",
    rows: "6 draft tokens out",
    comm: "draft candidates exchanged between GPUs",
    what: "An FP8 copy of the LM head scores the six positions. A rank-256 Markov head then conditions each draft on the one before it, round by round, so the six drafts read as a sequence and not six independent guesses.",
    lanes: [
      { text: "vocab ids 0-32,319", busy: 0.5 },
      { text: "vocab ids 32,320-64,639", busy: 0.5 },
      { text: "vocab ids 64,640-96,959", busy: 0.5 },
      { text: "vocab ids 96,960-129,279", busy: 0.5 },
    ],
  },
  {
    key: "switch",
    name: "how many drafts to check",
    rows: "verify 2 to 7 rows",
    comm: null,
    what: "A confidence head scores the drafts against a threshold (0.3 on TP4). A conditional node inside the CUDA graph picks one of six pre-captured verify bodies. The choice never leaves the GPU.",
    lanes: "same",
    lane: { text: "graph switch: body 1 of 6", busy: 0.1 },
  },
  {
    key: "attn",
    name: "verify, attention (x 40 layers)",
    rows: "up to 7 rows",
    comm: "push all-reduce: each GPU stores its partial into all 4 GPUs' buffers",
    what: "Mix the four residual lanes (mHC), project Q and the single 512-wide KV in FP8, let the indexer pick the 512 best compressed positions (every layer but the first two), attend to those plus the last 128 tokens, project out. Engram rows for layers 1 and 14 were fetched before layer 0 on a side stream.",
    lanes: [
      { text: "heads 0-15", busy: 0.7 },
      { text: "heads 16-31", busy: 0.7 },
      { text: "heads 32-47", busy: 0.7 },
      { text: "heads 48-63", busy: 0.7 },
    ],
  },
  {
    key: "moe",
    name: "verify, MoE (x 40 layers)",
    rows: "up to 7 rows x 6 experts",
    comm: "push all-reduce, fused with the next layer's mHC mix",
    what: "Every GPU routes every row (the router is replicated), then computes its quarter of every chosen expert: columns 0-575 of 2,304 on the first GPU, and so on, from FP4 weights. No token is sent anywhere; only the partial sums are added.",
    lanes: [
      { text: "expert cols 0-575", busy: 0.9 },
      { text: "expert cols 576-1,151", busy: 0.9 },
      { text: "expert cols 1,152-1,727", busy: 0.9 },
      { text: "expert cols 1,728-2,303", busy: 0.9 },
    ],
  },
  {
    key: "head",
    name: "verify head + sampling",
    rows: "up to 7 rows of logits",
    comm: "softmax statistics pushed to peers, not the logits",
    what: "The LM head (an FP8 copy on TP4) produces a quarter of the vocabulary on each GPU. Each GPU reduces its shard to statistics and pushes those; speculative sampling then decides how many drafts survive.",
    lanes: [
      { text: "logits 0-32,319", busy: 0.45 },
      { text: "logits 32,320-64,639", busy: 0.45 },
      { text: "logits 64,640-96,959", busy: 0.45 },
      { text: "logits 96,960-129,279", busy: 0.45 },
    ],
  },
  {
    key: "accept",
    name: "accept",
    rows: "1 to 7 tokens committed",
    comm: null,
    what: "One thread appends the c accepted drafts and one sampled token, moves the position by c + 1 and makes the sampled token the next anchor. The drafter's KV for the next step was prepared on a side stream while the head ran.",
    lanes: "same",
    lane: { text: "write c + 1 tokens, next anchor", busy: 0.1 },
  },
]

const GPU = ["GPU 0", "GPU 1", "GPU 2", "GPU 3"]

export function StepWalk() {
  const [i, setI] = useState(0)
  const s = STAGES[i]
  const lanes = s.lanes === "same" ? [s.lane!, s.lane!, s.lane!, s.lane!] : s.lanes

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one decode step on 4 GPUs, TP4</span>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setI((v) => Math.max(0, v - 1))}
            disabled={i === 0}
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:bg-foreground/[0.04] disabled:opacity-40"
          >
            prev
          </button>
          <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
            {i + 1} / {STAGES.length}
          </span>
          <button
            type="button"
            onClick={() => setI((v) => Math.min(STAGES.length - 1, v + 1))}
            disabled={i === STAGES.length - 1}
            className="rounded-sm border px-2 py-0.5 font-mono text-[10px] hover:bg-foreground/[0.04] disabled:opacity-40"
          >
            next
          </button>
        </div>
      </div>

      <ol className="flex gap-1 overflow-x-auto px-3 pt-3 sm:px-4" aria-label="Stages of one step">
        {STAGES.map((st, k) => (
          <li key={st.key} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => setI(k)}
              aria-current={k === i ? "step" : undefined}
              className={cn(
                "h-1.5 w-full rounded-full transition-colors",
                k === i ? "bg-sky-500" : k < i ? "bg-sky-500/40" : "bg-foreground/10"
              )}
              aria-label={st.name}
              title={st.name}
            />
          </li>
        ))}
      </ol>

      <div className="px-3 pt-3 sm:px-4">
        <div className="text-sm font-medium">{s.name}</div>
        <div className="mt-0.5 font-mono text-[11px] text-muted-foreground">{s.rows}</div>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{s.what}</p>
      </div>

      <div className="relative mx-3 my-3 space-y-1.5 sm:mx-4">
        {lanes.map((l, g) => (
          <div key={g} className="flex items-center gap-2">
            <span className="w-11 shrink-0 font-mono text-[10px] text-muted-foreground">{GPU[g]}</span>
            <div className="relative h-7 flex-1 overflow-hidden rounded-sm bg-foreground/[0.04]">
              <div
                className="absolute inset-y-0 left-0 bg-sky-500/25 transition-[width] duration-300 dark:bg-sky-400/20"
                style={{ width: `${(l.busy * 100).toFixed(0)}%` }}
              />
              <span className="absolute inset-y-0 left-2 flex items-center font-mono text-[10px]">{l.text}</span>
            </div>
          </div>
        ))}
        {s.comm && (
          <div className="flex items-start gap-2 pt-1">
            <span className="w-11 shrink-0 font-mono text-[10px] text-amber-600 dark:text-amber-400">NVLink</span>
            <span className="font-mono text-[10px] text-amber-700 dark:text-amber-300">{s.comm}</span>
          </div>
        )}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Read from the engine&apos;s source, not from a profile: the bars show which slice of the work each GPU owns at each
        stage, not how long the stage takes. The draft, verify and accept stages are one CUDA graph, launched once a step.
      </figcaption>
    </figure>
  )
}
