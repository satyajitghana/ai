"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// MemOnce's read path on a toy conversation, scaled down so it fits on screen. The procedure is
// post-training/model.py and eval/post-training/inference.py:
//   - write: every turn leaves one block (the last 64 final-layer states); the most recent 16
//     blocks also form the FIFO short window (_update_state), which is always in front of the
//     question; older blocks are only reachable through retrieval (answer(): keep = pool - 16).
//   - index: the question is written like a turn, its last state goes through mem_to_emb, and
//     cosine similarity against every older block's key picks the top-K (_retrieve), once.
//   - read: [retrieved | short window] is decoded into K and V for each full-attention layer
//     (_build_memory_cache): the same blocks for all 8 layers, for every generated token.
// What is NOT real: 32 turns instead of thousands, a window of 4 instead of 16, topics instead of
// text, and similarity scores made up from topic overlap plus a fixed jitter.

const TOPICS = ["trip", "dog", "job", "doctor", "band"] as const
type Topic = (typeof TOPICS)[number]
const N = 32
const WINDOW = 4
const LAYERS = 8

// fixed pseudo-random sequence (integer LCG, same on server and client)
function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

const TURNS: { topic: Topic; jitter: number }[] = (() => {
  const r = lcg(7)
  const out: { topic: Topic; jitter: number }[] = []
  for (let i = 0; i < N; i++) {
    out.push({ topic: TOPICS[Math.floor(r() * TOPICS.length)], jitter: r() })
  }
  return out
})()

export function MemoryWalk() {
  const [q, setQ] = useState<Topic>("dog")
  const [k, setK] = useState(4)
  const [stage, setStage] = useState(0)

  const poolEnd = N - WINDOW // blocks [0, poolEnd) are retrievable
  const scores = TURNS.map((t, i) => (i < poolEnd ? (t.topic === q ? 0.6 : 0.1) + 0.3 * t.jitter : -1))
  const order = scores
    .map((s, i) => ({ s, i }))
    .filter((x) => x.i < poolEnd)
    .sort((a, b) => b.s - a.s || a.i - b.i)
  const picked = new Set(order.slice(0, k).map((x) => x.i))
  const hits = order.slice(0, k).filter((x) => TURNS[x.i].topic === q).length
  const relevant = TURNS.slice(0, poolEnd).filter((t) => t.topic === q).length
  const inFront = picked.size + WINDOW

  const STAGES = ["Write", "Index", "Read"]

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Write once, index once, read in every layer (toy scale)</figcaption>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {STAGES.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(i)}
            aria-pressed={stage === i}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              stage === i ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-muted-foreground">The question is about</span>
          <select
            value={q}
            onChange={(e) => setQ(e.target.value as Topic)}
            className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1"
            aria-label="Question topic"
          >
            {TOPICS.map((t) => (
              <option key={t} value={t}>
                the {t}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-muted-foreground">
            Retrieved blocks K: <span className="font-mono text-foreground">{k}</span>
          </span>
          <Range min={0} max={12} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} className="w-full" aria-label="Retrieved blocks" />
        </label>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-xs text-muted-foreground">
          {N} turns, oldest on the left. Each square is the 64-state block its turn left behind.
        </div>
        <div className="grid grid-cols-8 gap-1 sm:grid-cols-16" role="img" aria-label="Memory blocks">
          {TURNS.map((t, i) => {
            const inWindow = i >= poolEnd
            const isPicked = picked.has(i)
            const tone =
              stage === 0
                ? inWindow
                  ? "bg-emerald-500/70"
                  : "bg-amber-500/50"
                : inWindow
                  ? "bg-emerald-500/70"
                  : isPicked
                    ? "bg-sky-500/80"
                    : "bg-muted"
            return (
              <div key={i} className={cn("flex h-9 flex-col items-center justify-center rounded text-[10px] leading-tight", tone)} title={`turn ${i}: ${t.topic}`}>
                <span>{t.topic}</span>
                {stage === 1 && !inWindow && <span className="font-mono opacity-70">{scores[i].toFixed(2)}</span>}
              </div>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span><span className="mr-1 inline-block h-2 w-3 rounded bg-emerald-500/70" />short window, always read</span>
          {stage === 0 ? (
            <span><span className="mr-1 inline-block h-2 w-3 rounded bg-amber-500/50" />long-term pool, offloadable</span>
          ) : (
            <span><span className="mr-1 inline-block h-2 w-3 rounded bg-sky-500/80" />retrieved for this question</span>
          )}
        </div>
      </div>

      {stage === 2 && (
        <div className="mt-4">
          <div className="mb-1 text-xs text-muted-foreground">
            The same {inFront} blocks become K and V in each of the {LAYERS} attention layers, through that layer&apos;s own projection.
          </div>
          <div className="space-y-1">
            {Array.from({ length: LAYERS }, (_, l) => (
              <div key={l} className="flex items-center gap-2">
                <span className="w-14 font-mono text-[10px] text-muted-foreground">layer {3 + 4 * l}</span>
                <div className="flex flex-1 gap-0.5">
                  {Array.from({ length: inFront }, (_, j) => (
                    <div key={j} className={cn("h-3 flex-1 rounded-sm", j < picked.size ? "bg-sky-500/70" : "bg-emerald-500/60")} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="mt-3 rounded bg-muted px-2 py-1.5 text-xs">
        {stage === 0 && `Writing is one forward pass per group of turns. Nothing is ever re-encoded: the pool only grows, ${poolEnd} blocks here plus a window of ${WINDOW}.`}
        {stage === 1 && `One cosine pass over ${poolEnd} keys. Of the ${relevant} blocks about the ${q}, ${hits} made the top ${k}; a block that misses here is invisible to every layer for the whole answer.`}
        {stage === 2 && `${inFront} blocks in front of the question, decoded for every layer. The routing decision is not revisited while the answer is generated.`}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">
        Toy scale: the checkpoint writes 64 states per turn, keeps 16 blocks in the window and retrieves 64. Topics and scores are made up.
      </p>
    </figure>
  )
}
