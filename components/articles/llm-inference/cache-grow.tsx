"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// Watch the KV cache grow. Prefill writes one entry per prompt token in a single
// pass; then every decode step appends exactly one entry and reuses all the rest
// (bright = written this step, faded = already cached, never recomputed). The cache
// — and so the memory — grows linearly with sequence length. Steps through prefill
// then the decode loop; loops.

const PROMPT = ["The", "cat", "sat", "on"]
const STEPS = [
  { phase: "PREFILL", input: PROMPT, token: "the", note: "writes 4 entries in one pass" },
  { phase: "DECODE", input: ["the"], token: "mat", note: "append 1, reuse 4" },
  { phase: "DECODE", input: ["mat"], token: ".", note: "append 1, reuse 5" },
  { phase: "DECODE", input: ["."], token: "<EOS>", note: "append 1, reuse 6" },
]

// the cache tokens present after each step
const CACHE_AT = STEPS.reduce<string[][]>((acc, s, i) => {
  const prev = i === 0 ? [] : acc[i - 1]
  acc.push([...prev, ...(i === 0 ? PROMPT : [STEPS[i].input[0]])])
  return acc
}, [])
const NEW_AT = STEPS.map((s, i) => (i === 0 ? PROMPT.length : 1))

export function CacheGrow() {
  const [k, setK] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setK((x) => (x + 1) % STEPS.length), 1700)
    return () => clearInterval(id)
  }, [playing])

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>KV cache growth · prefill writes N, decode appends 1</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="space-y-2 p-4">
        {/* column headers */}
        <div className="grid grid-cols-[88px_1fr_88px] gap-2 font-mono text-[10px] text-muted-foreground sm:grid-cols-[110px_1fr_96px]">
          <span>step</span>
          <span>KV cache after step · bright = new, faded = reused</span>
          <span className="text-right">output</span>
        </div>

        {STEPS.map((s, i) => {
          const shown = i <= k
          const active = i === k
          const cache = CACHE_AT[i]
          const newN = NEW_AT[i]
          return (
            <div
              key={i}
              className={cn(
                "grid grid-cols-[88px_1fr_88px] items-center gap-2 rounded-md border px-2 py-2 transition-all sm:grid-cols-[110px_1fr_96px]",
                active ? "border-foreground/40 bg-muted/40" : shown ? "opacity-100" : "opacity-25"
              )}
            >
              {/* step label */}
              <div className="font-mono text-[10px]">
                <div className="text-foreground">step {i}</div>
                <div className={cn(s.phase === "PREFILL" ? "text-foreground" : "text-muted-foreground")}>{s.phase}</div>
              </div>

              {/* cache row */}
              <div className="flex flex-wrap gap-1">
                {cache.map((tok, ci) => {
                  const isNew = shown && ci >= cache.length - newN
                  return (
                    <span
                      key={ci}
                      className={cn(
                        // always reserve a 1px border (transparent when borderless) so
                        // token width — and thus flex-wrap line count — never changes
                        "rounded border border-dashed px-1.5 py-0.5 font-mono text-[10px] transition-all",
                        !shown
                          ? "border-transparent opacity-0"
                          : isNew
                            ? "border-transparent text-background"
                            : "border-foreground/30 text-muted-foreground"
                      )}
                      style={shown && isNew ? { background: "oklch(0.72 0.15 195)" } : undefined}
                    >
                      {tok}
                    </span>
                  )
                })}
                <span
                  className={cn(
                    "self-center pl-1 font-mono text-[10px] text-muted-foreground transition-opacity",
                    shown ? "opacity-100" : "opacity-0"
                  )}
                >
                  {cache.length} entries (+{newN})
                </span>
              </div>

              {/* output */}
              <div className="text-right">
                {shown ? (
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-foreground" style={{ borderColor: "oklch(0.72 0.15 150)" }}>
                    {s.token}
                  </span>
                ) : null}
              </div>
            </div>
          )
        })}

        <p className="pt-1 text-sm leading-6 text-muted-foreground">
          Prefill writes <span className="text-foreground">N</span> entries in one pass;
          each decode step adds exactly <span className="text-foreground">one</span> and
          recomputes nothing. The cache — and the memory it costs — grows linearly with the
          sequence, which is why long contexts crowd out batch size.
        </p>
      </div>
    </figure>
  )
}
