"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why a tokenizer that's "already multithreaded Rust" can still get ~1000x
// faster. A BPE tokenizer does two things: PRETOKENIZE (split text into words/
// chunks — almost always handed to a regex engine) then MERGE (apply BPE within
// each chunk). The regex pretokenization is the fat part of the bar. Gigatoken
// rewrites it as a hand-tuned SIMD scanner and caches the merge result for any
// word it's seen before — so repeated words are a lookup, not a re-encode.

const ACCENT = "oklch(0.6 0.16 250)"
const SLOW = "oklch(0.68 0.15 40)"

// relative wall-time shares (illustrative of the "most time is pretokenization" point)
const STAGES = {
  naive: [
    { key: "pretokenize (regex)", w: 68, color: SLOW },
    { key: "BPE merges", w: 30, color: "oklch(0.6 0.03 250)" },
    { key: "python glue", w: 2, color: "oklch(0.7 0.03 250)" },
  ],
  gigatoken: [
    { key: "pretokenize (SIMD)", w: 7, color: ACCENT },
    { key: "BPE merges (cached)", w: 3, color: ACCENT },
  ],
}

export function PretokenPipeline() {
  const [mode, setMode] = useState<"naive" | "gigatoken">("gigatoken")
  const stages = STAGES[mode]
  const total = stages.reduce((a, s) => a + s.w, 0)

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where the time goes · one tokenizer pass</span>
        <div className="flex gap-1">
          {(["naive", "gigatoken"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={chip(mode === m)}>{m}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {/* the time bar, drawn against a fixed 100-unit track so gigatoken visibly shrinks */}
        <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>relative wall-time</span>
          <span className="tabular-nums" style={{ color: mode === "gigatoken" ? ACCENT : SLOW }}>
            {mode === "gigatoken" ? "~10× shorter" : "baseline"}
          </span>
        </div>
        <div className="flex h-10 w-full overflow-hidden rounded-md border bg-muted/20">
          {stages.map((s) => (
            <div
              key={s.key}
              className="flex items-center justify-center overflow-hidden whitespace-nowrap px-1 font-mono text-[9px] text-white transition-all duration-500"
              style={{ width: `${s.w}%`, background: s.color }}
              title={s.key}
            >
              {s.w >= 8 ? s.key : ""}
            </div>
          ))}
          <div className="flex-1" />
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          {[
            { h: "The bottleneck", b: "Pretokenization — the regex split — is the majority of a tokenizer's time, not the BPE merges everyone pictures." },
            { h: "SIMD rewrite", b: "Gigatoken replaces the regex with a hand-written SIMD scanner doing the exact same split at >2 GB/s per thread." },
            { h: "Pretoken cache", b: "A word seen before skips BPE entirely — its token IDs are a cache lookup, so real text (full of repeats) flies." },
          ].map((c) => (
            <div key={c.h} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[11px]" style={{ color: ACCENT }}>{c.h}</div>
              <div className="mt-1 text-[12px] leading-5 text-muted-foreground">{c.b}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The trick isn&rsquo;t more threads — HF tokenizers and tiktoken already run multithreaded Rust. It&rsquo;s
          killing the <span style={{ color: SLOW }}>regex</span> that dominates the pass and turning repeated words
          into <span style={{ color: ACCENT }}>lookups</span>.
        </p>
      </div>
    </figure>
  )
}
