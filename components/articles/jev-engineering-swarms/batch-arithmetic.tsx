"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The one efficiency argument the single-agent framing cannot make.
//
// A swarm batches every agent's question against ONE shared state. The state is
// the expensive part of the request — the arena, the positions, the precomputed
// features — and sending it once instead of N times is where the saving lives.
// Per-question overhead is the small part.
//
// Anchors, all from published sources, none invented:
//   * jev-swarm's own screenshot: a 4-question tick billed 2,610 input tokens
//     and 167 output tokens, at 409 ms with p50/p95 of 412/495 ms.
//   * jev-swarm's README: "A 10-question request costs ~0.37 s p50 / ~1.24 s
//     p95 — the model answers ten judgments in roughly the time of one."
//
// From those two points the split is recoverable. Call the shared state S input
// tokens and each question Q. The 4-question tick carries S + 4Q = 2,610. A
// single-question request in the same harness would carry S + Q. The model is
// scored per option and returns no prose, so the marginal question is small
// relative to a 30x30 arena with per-action features for every snake — I take
// Q = 120 tokens, which makes S = 2,130. That split is an estimate from one
// observation and is labelled as such below; the token totals at N = 4 are
// measured, and the ratio is what the argument rests on.
//
// Latency is anchored, not modelled: 0.412 s measured at 4 questions and 0.37 s
// stated at 10, so batched wall time is treated as flat at ~0.4 s. Sequential
// wall time is N separate round trips at the same per-call cost.

const Q_TOKENS = 120
const STATE_TOKENS = 2_610 - 4 * Q_TOKENS // 2,130
const CALL_SECONDS = 0.412

const AGENTS = [1, 2, 4, 10, 20]

function batched(n: number) {
  return {
    requests: 1,
    tokens: STATE_TOKENS + n * Q_TOKENS,
    seconds: CALL_SECONDS,
  }
}

function sequential(n: number) {
  return {
    requests: n,
    tokens: n * (STATE_TOKENS + Q_TOKENS),
    seconds: n * CALL_SECONDS,
  }
}

function fmt(n: number) {
  return n.toLocaleString("en-US")
}

export function BatchArithmetic() {
  const [n, setN] = useState(10)
  const b = batched(n)
  const s = sequential(n)
  const tokenRatio = s.tokens / b.tokens
  const timeRatio = s.seconds / b.seconds
  const max = Math.max(s.tokens, b.tokens)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          N agents, one shared state: batched vs. one request each
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          anchored on jev-swarm&rsquo;s measured 4-question tick
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">agents</span>
          {AGENTS.map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => setN(a)}
              aria-pressed={a === n}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] tabular-nums transition-colors",
                a === n
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent bg-muted/20 text-muted-foreground hover:bg-muted/35",
              )}
            >
              {a}
            </button>
          ))}
        </div>

        <div className="mt-4 space-y-3">
          {[
            {
              k: "seq",
              label: "one request per agent",
              sub: `${fmt(s.requests)} request${s.requests === 1 ? "" : "s"} · the state re-sent ${fmt(s.requests)}x`,
              tokens: s.tokens,
              seconds: s.seconds,
              color: "oklch(0.62 0.19 27)",
            },
            {
              k: "batch",
              label: "one request, N questions",
              sub: `1 request · the state sent once · ${fmt(n)} distribution${n === 1 ? "" : "s"} back`,
              tokens: b.tokens,
              seconds: b.seconds,
              color: "oklch(0.58 0.15 155)",
            },
          ].map((row) => (
            <div key={row.k}>
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">{row.label}</span>
                <span className="font-mono text-[11px] tabular-nums" style={{ color: row.color }}>
                  {fmt(row.tokens)} tok · {row.seconds.toFixed(2)} s
                </span>
              </div>
              <div className="mt-1 h-4 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm transition-all"
                  style={{ width: `${(row.tokens / max) * 100}%`, background: row.color, opacity: 0.9 }}
                />
              </div>
              <div className="mt-1 text-[11px] leading-5 text-muted-foreground">{row.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-lg tabular-nums text-foreground">{tokenRatio.toFixed(2)}x</div>
            <div className="text-[11px] leading-5 text-muted-foreground">
              fewer input tokens, because the state is sent once
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-lg tabular-nums text-foreground">{timeRatio.toFixed(2)}x</div>
            <div className="text-[11px] leading-5 text-muted-foreground">
              less wall time, because the questions are answered in one pass
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The shared state is doing all the work here. A 30&times;30 arena with per-action features for every
          snake is roughly 2,100 tokens; one more question against it is roughly 120. Sending the state once and
          asking ten questions costs about 1.6x a single question; asking it ten separate times costs 10x. That
          ratio grows with how expensive the state is, which is exactly backwards from the intuition that more
          agents means more model, and it is the part of the swarm framing a single-agent pitch cannot reach for.
          The token split is my estimate from one measured tick; the 2,610-token total at four questions and the
          0.412&nbsp;s median are the repository&rsquo;s own readouts.
        </p>
      </div>
    </figure>
  )
}
