"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Three ways failure knowledge reaches a WebShop agent, one episode each.
//
// ACE and AgentGuard are condensed from the paper's own Qwen3.5-9B trajectories
// (Figure 4: tasks 4494 and 4585). The Sentry episode is ILLUSTRATIVE: the
// paper prints no full Sentry trajectory, so it is the ACE task replayed with
// Sentry's published rules (W = 5 window, label-filtered retrieval, k <= 5, an
// H = 10 verifier) and two entries copied verbatim from the paper's example
// WebShop playbook (Appendix A.8.4). No reward is invented for it.

type Step = {
  act: string // the agent's action (or its reasoning, when it emits none)
  obs: string // what the environment returns
  lessons: number // recovery lessons in the agent's prompt at this step
  lessonsNote?: string
  monitor: string // what the outside monitor is doing
  fire?: boolean // the monitor injected something this step
  bad?: boolean // this step is where it goes wrong
  good?: boolean
}

type Mode = {
  key: "ace" | "guard" | "sentry"
  name: string
  source: string
  task: string
  context: string[] // what sits in the agent's context from the start
  steps: Step[]
  outcome: string
}

const ACE_RULES = [
  "no viable result → broaden the query",
  "no match on page 1 → check the next pages",
  "results still irrelevant → refine the query",
]

const MODES: Mode[] = [
  {
    key: "ace",
    name: "ACE: lessons always in context",
    source: "paper, Figure 4a (task 4494), condensed",
    task: "I need high-quality hair extensions, 20 inch, under $80.",
    context: ACE_RULES,
    steps: [
      {
        act: "search[hair extensions 20 inch]",
        obs: "1. QAZPL Deep Curly Virgin Human Hair, 20 inch, $79.63 · 2. … 3. … 4. …",
        lessons: 3,
        monitor: "none: ACE has no runtime monitor",
      },
      {
        act: "think: “Item 1 fits the description perfectly. Let me also go through item 2, item 3, item 4 to make sure there is nothing better…”",
        obs: "no action emitted",
        lessons: 3,
        monitor: "none",
        bad: true,
      },
      {
        act: "(episode ends)",
        obs: "reward 0 · the correct click[B08X4YD5WH] was never taken",
        lessons: 3,
        monitor: "none",
        bad: true,
      },
    ],
    outcome:
      "The three rules were learned from an earlier task where search really did fail. Here search worked, and the rules still had the agent's attention at every step.",
  },
  {
    key: "guard",
    name: "AgentGuard: a fixed rule, no memory",
    source: "paper, Figure 4b (task 4585), condensed",
    task: "A later WebShop task: buy the product with the right colour and size.",
    context: [],
    steps: [
      {
        act: "click[B00O30JLDK]",
        obs: "product page (reopened after seven identical searches)",
        lessons: 0,
        monitor: "counting no-progress transitions",
      },
      {
        act: "click[mossy oak country]",
        obs: "product page unchanged · option registered",
        lessons: 0,
        monitor: "page unchanged → no-progress count rises",
      },
      {
        act: "click[large]",
        obs: "product page unchanged · both options registered",
        lessons: 0,
        monitor: "rule fires: “No progress detected. Take a state-changing action.”",
        fire: true,
        bad: true,
      },
      {
        act: "click[< Prev]",
        obs: "back to the results page · the selected options are lost",
        lessons: 0,
        monitor: "progress made, streak resets",
        bad: true,
      },
      {
        act: "click[B00O30JLDK] → click[Buy Now]",
        obs: "purchased with options = { } · reward 0.6",
        lessons: 0,
        monitor: "no lesson stored",
      },
    ],
    outcome:
      "The same warning had rescued a real search loop on task 3980. On a product page, “unchanged” meant the options had registered, and a fixed rule cannot learn that difference.",
  },
  {
    key: "sentry",
    name: "Sentry: silent until a failure",
    source: "ILLUSTRATIVE: the ACE task replayed with Sentry's rules; lesson texts from Appendix A.8.4",
    task: "I need high-quality hair extensions, 20 inch, under $80.",
    context: [],
    steps: [
      {
        act: "search[hair extensions 20 inch]",
        obs: "1. QAZPL Deep Curly Virgin Human Hair, 20 inch, $79.63 · 2. … 3. … 4. …",
        lessons: 0,
        monitor: "detector reads the last 5 cycles: no failure, no retrieval",
      },
      {
        act: "click[item 2]",
        obs: "18 inch · does not match",
        lessons: 0,
        monitor: "no failure",
      },
      {
        act: "click[< Prev] → click[item 3]",
        obs: "16 inch · does not match",
        lessons: 0,
        monitor: "no failure yet: still looks like exploration",
      },
      {
        act: "click[< Prev] → click[item 4]",
        obs: "20 inch · $112 · over budget",
        lessons: 2,
        lessonsNote: "2 retrieved into the soft-repair message",
        monitor:
          "Progress failure · labels: over-exploration, termination miscalibration → retrieve matching entries",
        fire: true,
      },
      {
        act: "click[B08X4YD5WH] → click[20 inch]",
        obs: "item 1 page · 20 inch selected · $79.63",
        lessons: 2,
        lessonsNote: "repair message still in the conversation (the paper does not say it is pruned)",
        monitor: "verifier window open: watching the next cycles",
        good: true,
      },
      {
        act: "click[Buy Now]",
        obs: "purchase made",
        lessons: 2,
        lessonsNote: "repair message still in the conversation",
        monitor: "verifier: over-exploration stopped, grounded progress → resolved → write a new entry",
        good: true,
      },
    ],
    outcome:
      "Nothing about failure was in the prompt while the agent was making progress. When the window showed the agent circling, two lessons for that label arrived, and the episode became a playbook entry only because the verifier judged the repair to have worked.",
  },
]

// Two entries verbatim from the paper's example WebShop playbook (A.8.4).
const RETRIEVED = [
  {
    id: "explore-00008",
    text: "When an item page already shows enough evidence for the requested constraints, commit instead of opening more unrelated candidates.",
  },
  {
    id: "term-00012",
    text: "If the task is not yet purchased, do not stop merely because a good candidate was found; finish with the valid purchase action.",
  },
]

export function TrajectoryStepper() {
  const [modeIdx, setModeIdx] = useState(0)
  const [stepIdx, setStepIdx] = useState(0)
  const mode = MODES[modeIdx]
  const last = mode.steps.length - 1
  const at = Math.min(stepIdx, last)
  const showRetrieved = mode.key === "sentry" && at >= 3

  const tab = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors",
      on
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-3 py-2.5 sm:px-4">
        {MODES.map((m, i) => (
          <button
            key={m.key}
            type="button"
            onClick={() => {
              setModeIdx(i)
              setStepIdx(0)
            }}
            className={tab(i === modeIdx)}
          >
            {m.key === "ace" ? "ACE" : m.key === "guard" ? "AgentGuard" : "Sentry"}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div>
          <div className="text-sm font-semibold">{mode.name}</div>
          <div
            className={cn(
              "font-mono text-[11px]",
              mode.key === "sentry" ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground",
            )}
          >
            source: {mode.source}
          </div>
          <div className="mt-1 text-sm text-muted-foreground">task: {mode.task}</div>
        </div>

        <div className="rounded-lg border px-3 py-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            in the agent&rsquo;s context before step 1
          </div>
          {mode.context.length ? (
            <ul className="mt-1 space-y-0.5 font-mono text-xs">
              {mode.context.map((r) => (
                <li key={r}>• {r}</li>
              ))}
            </ul>
          ) : (
            <div className="mt-1 font-mono text-xs text-muted-foreground">
              no recovery lessons
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
            step {at + 1} / {last + 1}
          </span>
          <Range
            min={0}
            max={last}
            step={1}
            value={at}
            onChange={(e) => setStepIdx(Number(e.target.value))}
            aria-label="step through the episode"
          />
        </div>

        {/* one row per step, revealed up to the slider */}
        <ol className="space-y-1.5">
          {mode.steps.map((s, i) => (
            <li
              key={i}
              className={cn(
                "rounded-md border px-3 py-2 text-xs transition-opacity",
                i > at && "opacity-25",
                i === at && "border-foreground/30",
                s.bad && i <= at && "border-destructive/50 bg-destructive/5",
                s.good && i <= at && "border-emerald-600/40 bg-emerald-600/5",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono">{s.act}</span>
                <span className="flex items-center gap-1" aria-label={`${s.lessons} recovery lessons in the prompt`}>
                  {[0, 1, 2].map((d) => (
                    <span
                      key={d}
                      className={cn(
                        "inline-block size-2 rounded-full border",
                        d < s.lessons
                          ? mode.key === "ace"
                            ? "border-foreground/50 bg-foreground/50"
                            : "border-amber-600 bg-amber-500"
                          : "border-muted-foreground/30",
                      )}
                    />
                  ))}
                </span>
              </div>
              <div className="mt-0.5 text-muted-foreground">→ {s.obs}</div>
              <div
                className={cn(
                  "mt-0.5 font-mono text-[11px]",
                  s.fire ? "text-amber-700 dark:text-amber-400" : "text-muted-foreground/70",
                )}
              >
                monitor: {s.monitor}
                {s.lessonsNote ? ` · ${s.lessonsNote}` : ""}
              </div>
            </li>
          ))}
        </ol>

        {showRetrieved && (
          <div className="rounded-lg border border-amber-600/40 bg-amber-500/5 px-3 py-2">
            <div className="font-mono text-[11px] text-amber-700 dark:text-amber-400">
              soft repair · retrieved from the external playbook (k ≤ 5; assume only these two match so far)
            </div>
            <ul className="mt-1 space-y-1 text-xs">
              {RETRIEVED.map((r) => (
                <li key={r.id}>
                  <span className="font-mono text-muted-foreground">[{r.id}]</span> {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {at === last && <p className="text-sm">{mode.outcome}</p>}
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Dots: recovery lessons in the agent&rsquo;s prompt at that step. ACE and AgentGuard
        episodes are condensed from the paper&rsquo;s Figure 4; the Sentry episode is an
        illustration built from the paper&rsquo;s stated rules, not a recorded run, and it
        carries no reward.
      </figcaption>
    </figure>
  )
}
