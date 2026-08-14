"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The claims, and what each one is actually worth. Everything here is the
// paper's own — including the caveats, which it states rather than buries.

type Claim = {
  id: string
  headline: string
  strength: "strong" | "qualified" | "limited"
  what: string
  catch: string
}

const CLAIMS: Claim[] = [
  {
    id: "efficiency",
    headline: "≈1.5× token efficiency",
    strength: "strong",
    what: "Full-bandwidth transformers \"match or approach standard transformers trained with roughly 1.5× more tokens,\" at negligible per-token decoding overhead. That is the headline, and for a change that leaves the architecture, KV cache and objective intact it is a large claim.",
    catch: "Measured at 1B parameters, up to 400B tokens. Whether the gain holds, grows or vanishes at 10B or 100B is exactly what the paper does not know.",
  },
  {
    id: "freelunch",
    headline: "gains without using it at inference",
    strength: "strong",
    what: "The most useful result in the paper. Feedback passes act as an auxiliary training signal: gradients from later predictions flow back into earlier hidden states, pushing them to be reusable as inputs rather than merely predictive at the output layer. Models trained this way improve on LM Eval and free-form generation even when decoded normally.",
    catch: "None stated — and this is the version that costs nothing to deploy, since the serving pipeline is unchanged. If only one thing from this paper survives, it should be this.",
  },
  {
    id: "concise",
    headline: "shorter reasoning traces",
    strength: "qualified",
    what: "On the base model, latent-feedback decoding often produces markedly shorter traces at equal or better accuracy — the behaviour the bandwidth argument predicts. Computation that would otherwise have to be spelled out token by token rides the hidden state instead.",
    catch: "It disappears after instruction tuning. The paper's own explanation: the tuning data is off-policy — those traces were written by standard token-by-token reasoning, so fitting them re-imposes the verbose style regardless of what the latent could carry.",
  },
  {
    id: "bandwidth",
    headline: "richer shallow-layer residuals",
    strength: "qualified",
    what: "Controlled state-tracking probes with a fixed target and varying context — completion tracking and delayed memory — confirm the extra bandwidth is actually being used, not just available.",
    catch: "These are synthetic diagnostics built for the purpose, not downstream tasks. They show the channel carries something; they do not show how much of the 1.5× comes from it.",
  },
  {
    id: "scale",
    headline: "everything above is 1B",
    strength: "limited",
    what: "The paper's first stated limitation, in its own words: the experiment scale is limited to 1B-parameter models and the approach was not verified at larger scale.",
    catch: "Their intuition points the optimistic way — a deeper model's top-layer state should carry more, so the feedback should be worth more. That is a hypothesis, not a result.",
  },
  {
    id: "sched",
    headline: "the schedule is a heuristic",
    strength: "limited",
    what: "Latent feedback is introduced late in pretraining, with a small fraction of deeper feedback passes mixed in for stability. Multi-pass training preserves parallel teacher forcing, which is what makes any of this trainable at scale.",
    catch: "The second stated limitation: the schedule is heuristic. No ablation on the length of the recurrence phase, and no principled way to pick the number of recurrence steps.",
  },
]

const C: Record<string, string> = {
  strong: "oklch(0.55 0.16 155)",
  qualified: "oklch(0.68 0.13 85)",
  limited: "oklch(0.62 0.03 250)",
}

export function ResultLedger() {
  const [sel, setSel] = useState(1)
  const c = CLAIMS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">what the paper claims, and what it costs</span>
        <span className="font-mono text-[10px] text-muted-foreground">1B params · 400B tokens</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1">
          {CLAIMS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "flex w-full cursor-pointer items-center gap-2 rounded-md border px-2 py-1.5 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: C[x.strength] }} />
              <span className="flex-1 truncate font-mono text-[11px] text-foreground">{x.headline}</span>
              <span className="shrink-0 font-mono text-[9px]" style={{ color: C[x.strength] }}>
                {x.strength}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: C[c.strength] }}>
            {c.headline}
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{c.what}</div>
          <div className="mt-2 border-t pt-2 text-sm leading-6 text-muted-foreground">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">the catch</span>
            <br />
            {c.catch}
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The conciseness result is the one I keep turning over. It appears on the base model and{" "}
          <span className="text-foreground">vanishes after instruction tuning</span>, and the paper&rsquo;s
          explanation is that the tuning traces were written by a model that had no choice but to verbalize. If
          that is right, then a capability can be trained in and then trained straight back out by imitation data
          that predates it — which is a problem that generalizes well beyond this architecture.
        </p>
      </div>
    </figure>
  )
}
