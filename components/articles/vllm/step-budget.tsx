"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One iteration of the V1 scheduler, as a token budget.
//
// vllm/v1/core/sched/scheduler.py:520
//   token_budget = self.max_num_scheduled_tokens
// vllm/v1/core/sched/scheduler.py:549
//   # First, schedule the RUNNING requests.
//   while req_index < len(self.running) and token_budget > 0:
// vllm/v1/core/sched/scheduler.py:724
//   token_budget -= num_new_tokens
// vllm/v1/core/sched/scheduler.py:770
//   # Next, schedule the WAITING requests.
// vllm/v1/core/sched/scheduler.py:976
//   threshold = self.scheduler_config.long_prefill_token_threshold
//   if 0 < threshold < num_new_tokens:
//       num_new_tokens = threshold
// vllm/v1/core/sched/scheduler.py:983
//   if not self.scheduler_config.enable_chunked_prefill and \
//      num_new_tokens > request_token_budget:
//       break
//
// Defaults, from vllm/config/scheduler.py:
//   DEFAULT_MAX_NUM_BATCHED_TOKENS = 2048   (line 42, "mainly for testing")
//   DEFAULT_MAX_NUM_SEQS = 128              (line 44)
//   enable_chunked_prefill = True           (line 74)
//   long_prefill_token_threshold = 0        (line 70, 0 disables the cap)
//
// The scheduler comment worth the whole diagram, at scheduler.py:501:
//   "There's no 'decoding phase' nor 'prefill phase' in the scheduler.
//    Each request just has the num_computed_tokens and num_tokens_with_spec."

const DECODE = "oklch(0.60 0.15 255)"
const PREFILL = "oklch(0.55 0.16 155)"
const IDLE = "oklch(0.62 0.03 250)"
const BLOCKED = "oklch(0.58 0.19 27)"

export function StepBudget() {
  const [budget, setBudget] = useState(8192)
  const [running, setRunning] = useState(64)
  const [prompt, setPrompt] = useState(16384)
  const [chunked, setChunked] = useState(true)
  const [capLong, setCapLong] = useState(false)

  const threshold = capLong ? 2048 : 0

  const decodeTokens = Math.min(running, budget)
  const avail = budget - decodeTokens
  let want = prompt
  if (threshold > 0) want = Math.min(want, threshold)
  const blocked = !chunked && want > avail
  const chunk = blocked ? 0 : Math.min(want, avail)
  const idle = budget - decodeTokens - chunk
  const steps = chunk > 0 ? Math.ceil(prompt / chunk) : 0
  const noRoom = chunk === 0
  const stallMsg = blocked
    ? "prompt too long for one step, chunking is off"
    : "the decodes used the whole budget"

  const W = 700
  const X0 = 104
  const BAR = 466
  const H = 156

  const segs = [
    { k: "dec", label: `${decodeTokens} decode`, colour: DECODE, n: decodeTokens },
    { k: "pre", label: `${chunk} prefill`, colour: noRoom ? BLOCKED : PREFILL, n: chunk },
    { k: "idl", label: `${idle} idle`, colour: IDLE, n: idle },
  ]

  let x = X0
  const rects = segs.map((s) => {
    const w = (s.n / budget) * BAR
    const node = (
      <g key={s.k}>
        <rect x={x} y={30} width={Math.max(w, 0)} height={28} fill={s.colour} fillOpacity={s.k === "idl" ? 0.16 : 0.8} />
        {w >= 88 ? (
          <text
            x={x + w / 2}
            y={72}
            fontSize={9}
            textAnchor="middle"
            fill={s.colour}
            fontFamily="ui-monospace, monospace"
          >
            {s.label}
          </text>
        ) : null}
      </g>
    )
    x += w
    return node
  })

  // The prompt, cut into per-step chunks.
  const shown = Math.min(steps, 48)
  const dividers = Array.from(
    { length: Math.max(shown - 1, 0) },
    (_, i) => X0 + (Math.min((i + 1) * chunk, prompt) / prompt) * BAR,
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one schedule() call · max_num_batched_tokens = {budget}
        </span>
        <span className="font-mono text-[10px]" style={{ color: noRoom ? BLOCKED : PREFILL }}>
          {noRoom ? "prompt not scheduled this step" : `${steps} step${steps === 1 ? "" : "s"} to first token`}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["chunked prefill", chunked, () => setChunked((v) => !v)],
              ["long_prefill_token_threshold = 2048", capLong, () => setCapLong((v) => !v)],
            ] as const
          ).map(([label, on, toggle]) => (
            <button
              key={label}
              type="button"
              onClick={toggle}
              aria-pressed={on}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                on
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A ${budget}-token step. ${decodeTokens} tokens go to running decodes; ${
                noRoom
                  ? `the queued prompt gets none because ${stallMsg}`
                  : `${chunk} go to the queued prompt, which finishes in ${steps} steps`
              }.`}
            </title>

            <text
              x={X0 - 10}
              y={48}
              fontSize={9.5}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.75}
              fontFamily="ui-monospace, monospace"
            >
              token budget
            </text>
            <text
              x={X0}
              y={20}
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              {`${running} running decodes, one token each, scheduled first`}
            </text>
            {rects}
            <rect x={X0} y={30} width={BAR} height={28} fill="none" stroke="currentColor" strokeOpacity={0.18} />

            <text
              x={X0 - 10}
              y={112}
              fontSize={9.5}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.75}
              fontFamily="ui-monospace, monospace"
            >
              the prompt
            </text>
            <text
              x={X0}
              y={90}
              fontSize={9}
              fill="currentColor"
              fillOpacity={0.45}
              fontFamily="ui-monospace, monospace"
            >
              {noRoom ? `${prompt} prompt tokens, none scheduled this step` : `${prompt} prompt tokens, cut into chunks of ${chunk}`}
            </text>
            <rect
              x={X0}
              y={98}
              width={BAR}
              height={22}
              fill={noRoom ? BLOCKED : PREFILL}
              fillOpacity={noRoom ? 0.18 : 0.32}
            />
            {dividers.map((dx, i) => (
              <line key={i} x1={dx} y1={98} x2={dx} y2={120} stroke="currentColor" strokeOpacity={0.35} />
            ))}
            <rect x={X0} y={98} width={BAR} height={22} fill="none" stroke="currentColor" strokeOpacity={0.18} />
            <text
              x={X0 + BAR}
              y={140}
              fontSize={8.5}
              textAnchor="end"
              fill={noRoom ? BLOCKED : "currentColor"}
              fillOpacity={noRoom ? 1 : 0.5}
              fontFamily="ui-monospace, monospace"
            >
              {noRoom
                ? `${stallMsg} — the scheduler leaves the queue alone and tries again next step`
                : `${steps} forward passes before this request emits anything${
                    steps > 48 ? " (first 48 boundaries drawn)" : ""
                  }`}
            </text>
          </svg>
        </div>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {segs.map((s) => (
            <span key={s.k} className="flex items-center gap-1.5 font-mono text-[9.5px] text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-[2px]"
                style={{ backgroundColor: s.colour, opacity: s.k === "idl" ? 0.3 : 0.8 }}
              />
              {s.label} tokens
            </span>
          ))}
        </div>

        <div className="mt-3 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          {(
            [
              ["budget", budget, setBudget, 512, 16384, 512, IDLE, "max_num_batched_tokens for the step"],
              ["decodes", running, setRunning, 0, 256, 8, DECODE, "number of running requests each taking one decode token"],
              ["prompt", prompt, setPrompt, 512, 65536, 512, PREFILL, "length of the queued prompt in tokens"],
            ] as const
          ).map(([label, v, set, lo, hi, step, colour, aria]) => (
            <div key={label} className="flex items-center gap-2">
              <span className="w-16 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
                {label}
              </span>
              <Range
                min={lo}
                max={hi}
                step={step}
                value={v}
                onChange={(e) => set(Number(e.target.value))}
                className="flex-1"
                aria-label={aria}
                accent={colour}
              />
              <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{v}</span>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The V1 scheduler has no prefill phase and no decode phase. Every request carries a{" "}
          <code>num_computed_tokens</code>, and a step is just a{" "}
          <span className="text-foreground">token budget</span> handed out until it runs out. Running
          requests go first, one token each for a plain decode, and whatever is left is offered to
          the queue.
          <br />
          <br />
          That single number is the throughput/latency dial. A big budget lets a long prompt prefill
          in one shot, at the cost of making every decode in that step wait behind it. A small budget
          keeps inter-token latency tight and stretches time-to-first-token across many steps. Turn
          on <code>long_prefill_token_threshold</code> and you cap any one prompt&rsquo;s share
          regardless of how much room is going spare — protecting the decodes from a 64k prompt that
          would otherwise eat the whole step.
          <br />
          <br />
          Turn <span style={{ color: BLOCKED }}>chunked prefill</span> off and the failure mode is
          the one V0 shipped with: a prompt bigger than the free budget is not scheduled at all, the
          loop breaks, and the request waits for a step with enough room. V1 enables chunking by
          default, which is why <code>max_num_batched_tokens</code> can be smaller than{" "}
          <code>max_model_len</code> without rejecting long requests.
        </p>
      </div>
    </figure>
  )
}
