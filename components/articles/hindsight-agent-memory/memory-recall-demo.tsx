"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A fact stated in session 1 is needed in session 20. Two ways to get it back.
//
// FULL CONTEXT pastes the raw transcript and lets a window slide over it. The
// session-1 fact falls out of the window the moment the window stops reaching
// session 1 — which, at real scale, it always does (LongMemEval's M setting is
// ~1.5M tokens across ~500 sessions). The model then answers from nothing.
//
// HINDSIGHT retained the fact as a structured memory at session 1. At session
// 20 the recall pipeline runs four retrievers in parallel over the whole bank,
// fuses their ranked lists with Reciprocal Rank Fusion (the paper's k = 60),
// reranks, and the fact comes back regardless of how long ago it was said.
//
// The retriever ranks shown are ILLUSTRATIVE — a plausible lane-by-lane result
// for this one fact, not a measured run. The RRF score is the paper's real
// formula, RRF(f) = sum_i 1/(k + r_i), k = 60, computed on those ranks with
// exact integer/float arithmetic (no transcendental ops, so no dmath needed).

const RRF_K = 60
const TOKENS_PER_SESSION = 2_000 // rough, for the demo's token counter
const BUDGET_TOKENS = 16_000

type Session = { n: number; text: string; key?: boolean; query?: boolean }

const SESSIONS: Session[] = [
  { n: 1, text: "My daughter Mira is allergic to penicillin.", key: true },
  { n: 2, text: "Planning a trip to Kyoto in spring." },
  { n: 3, text: "What's a good miso soup recipe?" },
  { n: 4, text: "Switched our team to a four-day week." },
  { n: 5, text: "Mira started piano lessons." },
  { n: 6, text: "Need a gift idea for my brother." },
  { n: 7, text: "The garden tomatoes finally ripened." },
  { n: 8, text: "Debugging a flaky CI pipeline." },
  { n: 9, text: "Booked a dentist appointment." },
  { n: 10, text: "Reading a biography of Ada Lovelace." },
  { n: 11, text: "Mira's school play is next month." },
  { n: 12, text: "Trying to cut back on coffee." },
  { n: 13, text: "Repainting the kitchen a pale green." },
  { n: 14, text: "What's the weather like this weekend?" },
  { n: 15, text: "Started running again on Tuesdays." },
  { n: 16, text: "Comparing two mortgage offers." },
  { n: 17, text: "Mira wants a kitten for her birthday." },
  { n: 18, text: "Fixed the leaking bathroom tap." },
  { n: 19, text: "Meal-prepping lentil curry for the week." },
  { n: 20, text: "Mira has an ear infection — which antibiotic should we avoid?", query: true },
]

// Four retrievers, each with an illustrative rank for the session-1 allergy
// fact. A fact phrased plainly ("allergic to penicillin") is easy for lexical
// and semantic lanes, harder for a pure time-range lane (the query carries no
// date), and reachable by the graph lane through the shared entity "Mira".
type Lane = {
  key: string
  name: string
  what: string
  rank: number | null // rank of the session-1 fact in this lane; null = miss
}

const LANES: Lane[] = [
  { key: "sem", name: "Semantic", what: "cosine over HNSW vectors", rank: 2 },
  { key: "bm25", name: "BM25", what: "lexical, GIN index", rank: 1 },
  { key: "graph", name: "Graph", what: "spreading activation via entity “Mira”", rank: 3 },
  { key: "temporal", name: "Temporal", what: "time-range filter (no date in query)", rank: null },
]

// RRF(f) = sum over lanes of 1/(k + rank). A miss contributes nothing.
function rrfScore(lanes: Lane[]): number {
  return lanes.reduce((s, l) => (l.rank == null ? s : s + 1 / (RRF_K + l.rank)), 0)
}

const HS_STEPS = ["retain", "recall", "fuse", "answer"] as const
type HsStep = (typeof HS_STEPS)[number]

export function MemoryRecallDemo() {
  const [mode, setMode] = useState<"full" | "hindsight">("full")
  const [windowSize, setWindowSize] = useState(6) // sessions kept, counting back from 20
  const [stepIdx, setStepIdx] = useState(0)
  const step: HsStep = HS_STEPS[stepIdx]

  const firstKept = 20 - windowSize + 1 // lowest session number still in the window
  const reachesFact = firstKept <= 1
  const rawTokens = 20 * TOKENS_PER_SESSION
  const keptTokens = windowSize * TOKENS_PER_SESSION

  const fused = rrfScore(LANES)
  const hits = LANES.filter((l) => l.rank != null)

  const tab = (on: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-3 py-1 font-mono text-xs transition-colors",
      on
        ? "border-foreground/30 bg-muted/60 text-foreground"
        : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          session 1 says it; session 20 needs it
        </span>
        <div className="flex gap-1">
          <button type="button" onClick={() => setMode("full")} className={tab(mode === "full")}>
            full context
          </button>
          <button
            type="button"
            onClick={() => setMode("hindsight")}
            className={tab(mode === "hindsight")}
          >
            Hindsight
          </button>
        </div>
      </div>

      {/* The 20-session strip, shared by both modes. */}
      <div className="border-b px-3 py-3 sm:px-4">
        <div className="flex flex-wrap gap-1">
          {SESSIONS.map((s) => {
            const inWindow = mode === "full" && s.n >= firstKept
            const droppedKey = mode === "full" && s.key && !reachesFact
            return (
              <span
                key={s.n}
                title={`Session ${s.n}: ${s.text}`}
                className={cn(
                  "inline-flex h-6 min-w-6 items-center justify-center rounded border px-1 font-mono text-[11px] transition-colors",
                  s.key && "font-bold",
                  s.query && "border-foreground/40",
                  mode === "full" && inWindow && "bg-muted/60 text-foreground",
                  mode === "full" && !inWindow && "text-muted-foreground/40",
                  droppedKey && "border-destructive/60 text-destructive",
                  mode === "hindsight" && s.key && "border-foreground/40 text-foreground",
                  mode === "hindsight" && !s.key && "text-muted-foreground",
                )}
              >
                {s.n}
              </span>
            )
          })}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>
            <strong className="font-bold text-foreground">1</strong> “Mira is allergic to penicillin.”
          </span>
          <span>
            <strong className="text-foreground">20</strong> “which antibiotic should we avoid?”
          </span>
        </div>
      </div>

      {mode === "full" ? (
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex items-center gap-3">
            <span className="w-40 shrink-0 font-mono text-[11px] text-muted-foreground">
              context window: last {windowSize} sessions
            </span>
            <Range
              min={2}
              max={20}
              step={1}
              value={windowSize}
              onChange={(e) => setWindowSize(Number(e.target.value))}
              aria-label="context window size in sessions"
            />
          </div>

          <div className="font-mono text-[11px] text-muted-foreground">
            raw transcript {rawTokens.toLocaleString()} tok · kept {keptTokens.toLocaleString()} tok ·
            budget {BUDGET_TOKENS.toLocaleString()} tok
          </div>

          <div
            className={cn(
              "rounded-lg border px-3 py-2.5 text-sm",
              reachesFact
                ? "border-foreground/20 bg-muted/20"
                : "border-destructive/50 bg-destructive/5",
            )}
          >
            {reachesFact ? (
              <>
                <span className="font-mono text-xs text-muted-foreground">answer</span>
                <p className="mt-1">
                  Avoid penicillins. The window reaches session 1, so the allergy is in the
                  prompt — but only because this demo is 20 sessions. LongMemEval&rsquo;s M setting is
                  about 1.5M tokens across roughly 500 sessions; no window that size fits.
                </p>
              </>
            ) : (
              <>
                <span className="font-mono text-xs text-destructive">answer (wrong)</span>
                <p className="mt-1">
                  &ldquo;I don&rsquo;t have any record of an allergy.&rdquo; The fact was stated in session 1,
                  which fell outside the last {windowSize} sessions. It was truncated, so the
                  model never saw it.
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-1">
            {HS_STEPS.map((s, i) => (
              <button
                key={s}
                type="button"
                onClick={() => setStepIdx(i)}
                className={cn(
                  "cursor-pointer rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  i === stepIdx
                    ? "border-foreground/30 bg-muted/60 text-foreground"
                    : i < stepIdx
                      ? "border-transparent text-foreground/70"
                      : "border-transparent text-muted-foreground/50 hover:text-foreground",
                )}
              >
                {i + 1}. {s}
              </button>
            ))}
          </div>

          {step === "retain" && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                retain · at session 1
              </span>
              <p className="mt-1">
                The sentence is extracted into a structured fact and filed in the world network,
                with the entity <code>Mira</code> resolved and temporal metadata attached. It no
                longer depends on staying inside a context window.
              </p>
              <div className="mt-2 rounded border bg-background/60 px-2 py-1 font-mono text-[11px]">
                {"{ text: “Mira is allergic to penicillin”, entities: [Mira], network: world }"}
              </div>
            </div>
          )}

          {step === "recall" && (
            <div className="space-y-2">
              <span className="font-mono text-xs text-muted-foreground">
                recall · four retrievers run in parallel over the whole bank
              </span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {LANES.map((l) => (
                  <div key={l.key} className="rounded-lg border bg-muted/15 px-3 py-2">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-xs font-medium text-foreground">{l.name}</span>
                      <span
                        className={cn(
                          "font-mono text-[11px]",
                          l.rank == null ? "text-muted-foreground/60" : "text-foreground",
                        )}
                      >
                        {l.rank == null ? "miss" : `fact at rank ${l.rank}`}
                      </span>
                    </div>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">{l.what}</p>
                  </div>
                ))}
              </div>
              <p className="font-mono text-[11px] text-muted-foreground">
                three lanes find the fact; the time-range lane misses because the question carries
                no date. Ranks are illustrative.
              </p>
            </div>
          )}

          {step === "fuse" && (
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted-foreground">
                fuse · Reciprocal Rank Fusion, then cross-encoder rerank
              </span>
              <div className="mt-2 space-y-1 font-mono text-[11px]">
                {hits.map((l) => (
                  <div key={l.key} className="flex justify-between">
                    <span className="text-muted-foreground">
                      {l.name} · 1 / (60 + {l.rank})
                    </span>
                    <span className="text-foreground">
                      {(1 / (RRF_K + (l.rank as number))).toFixed(4)}
                    </span>
                  </div>
                ))}
                <div className="flex justify-between border-t pt-1">
                  <span className="text-muted-foreground">RRF total (k = 60)</span>
                  <span className="font-bold text-foreground">{fused.toFixed(4)}</span>
                </div>
              </div>
              <p className="mt-2 text-[12px] text-muted-foreground">
                A fact that three lanes agree on accumulates more fused weight than one a single
                lane returned. The cross-encoder (<code>ms-marco-MiniLM-L-6-v2</code>) then reranks
                the top candidates and the allergy fact lands at #1.
              </p>
            </div>
          )}

          {step === "answer" && (
            <div className="rounded-lg border border-foreground/20 bg-muted/20 px-3 py-2.5 text-sm">
              <span className="font-mono text-xs text-muted-foreground">answer</span>
              <p className="mt-1">
                Avoid penicillins. The fact surfaced on its own merits, nineteen sessions after it
                was said — no window had to still contain it.
              </p>
            </div>
          )}
        </div>
      )}
    </figure>
  )
}
