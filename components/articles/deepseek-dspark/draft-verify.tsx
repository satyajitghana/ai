"use client"

import { useState } from "react"
import {
  ArrowCounterClockwiseIcon,
  CheckIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// One round of speculative decoding, made steppable. A cheap draft proposes a
// block of W tokens in a single pass; the target verifies all W in ONE forward
// and accepts the longest prefix that matches its own greedy choice, plus one
// free "bonus" token. Accepted length g is how many real tokens that one
// expensive target forward bought — the whole game is making g large.
// Hand-authored trace of a code-generation example; illustrative, not a live model.

type Round = {
  ctx: string
  draft: string[]
  // index of the first REJECTED draft token (everything before it is accepted)
  accept: number
  bonus: string // the token the target emits at the mismatch position (always correct)
}

// Generating a small Python function, block size W = 5 (DSpark's released config).
const ROUNDS: Round[] = [
  {
    ctx: "def fib(n):",
    draft: ["\\n", "    if", " n", " <", " 2"],
    accept: 5,
    bonus: ":",
  },
  {
    ctx: "…if n < 2:",
    draft: ["\\n", "        return", " n", "\\n", "    return"],
    accept: 5,
    bonus: " fib",
  },
  {
    ctx: "…return fib",
    draft: ["(n", "-1)", " +", " fib(n", "-3)"],
    accept: 4, // target wanted "-2)" not "-3)"
    bonus: "-2)",
  },
]

export function DraftVerify() {
  const [r, setR] = useState(0)
  const round = ROUNDS[r]
  const g = round.accept + 1 // accepted drafts + the bonus token

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>speculative round · draft → verify → accept</span>
        <span>
          round {r + 1}/{ROUNDS.length}
        </span>
      </div>

      <div className="space-y-3 p-4">
        {/* context */}
        <div className="font-mono text-xs text-muted-foreground">
          context so far:{" "}
          <span className="text-foreground">{round.ctx}</span>
        </div>

        {/* draft block */}
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            1 · draft network proposes {round.draft.length} tokens in one pass
          </div>
          <div className="flex flex-wrap gap-1.5">
            {round.draft.map((t, i) => (
              <span
                key={i}
                className="rounded border bg-muted/40 px-2 py-1 font-mono text-xs"
              >
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* verify + accept */}
        <div>
          <div className="mb-1 font-mono text-[11px] text-muted-foreground">
            2 · target verifies all {round.draft.length} in one forward, keeps
            the matching prefix
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {round.draft.map((t, i) => {
              const ok = i < round.accept
              return (
                <span
                  key={i}
                  className={cn(
                    "flex items-center gap-1 rounded border px-2 py-1 font-mono text-xs",
                    ok
                      ? "border-transparent text-background"
                      : "border-destructive/40 text-muted-foreground line-through opacity-60"
                  )}
                  style={ok ? { background: "oklch(0.72 0.15 150)" } : undefined}
                >
                  {ok ? <CheckIcon size={11} weight="bold" /> : <XIcon size={11} weight="bold" />}
                  {t}
                </span>
              )
            })}
            {/* bonus token from the target itself — always correct */}
            <span
              className="flex items-center gap-1 rounded border border-foreground/30 px-2 py-1 font-mono text-xs"
              title="the target's own next token at the mismatch — free, always correct"
            >
              +{round.bonus}
            </span>
          </div>
        </div>

        {/* readout */}
        <div className="grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <Stat label="accepted (g)" value={`${g} tok`} />
          <Stat label="target forwards" value="1" />
          <Stat label="vs autoregressive" value={`${g}× tokens`} />
        </div>
        <p className="text-sm leading-6 text-muted-foreground">
          {round.accept === round.draft.length
            ? `All ${round.draft.length} drafts matched — one expensive target pass produced ${g} real tokens instead of 1.`
            : `The target disagreed at token ${round.accept + 1}, so the tail is thrown away — but its own correction is emitted for free, so the round still nets ${g} tokens. Output is bit-identical to plain decoding; only the speed changes.`}
        </p>
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-2 font-mono text-xs">
        <button
          type="button"
          onClick={() => setR((n) => Math.max(0, n - 1))}
          disabled={r === 0}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          ← prev
        </button>
        <button
          type="button"
          onClick={() => setR((n) => Math.min(ROUNDS.length - 1, n + 1))}
          disabled={r === ROUNDS.length - 1}
          className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          next round →
        </button>
        <button
          type="button"
          onClick={() => setR(0)}
          className="ml-auto flex cursor-pointer items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowCounterClockwiseIcon size={13} weight="bold" />
          reset
        </button>
      </div>
    </figure>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-background px-3 py-2">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="font-medium text-foreground">{value}</div>
    </div>
  )
}
