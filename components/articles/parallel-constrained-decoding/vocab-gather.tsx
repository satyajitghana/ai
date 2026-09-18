"use client"

import { cn } from "@/lib/utils"

// Two small diagrams for the "prefill once, then a cheap suffix pass" mechanism.
// TokenTape draws a row of token chips — used once for the shared prefill and
// once for a field's short suffix, so the reader sees exactly what gets redone
// (nothing) versus what gets appended (a handful of tokens). VocabGather draws
// the LM head's output: a full ~152k-row logit strip that collapses to the
// handful of rows the schema actually cares about. Both are static SSR — the
// numbers are a fixed, illustrative worked example (schema field "risk_level",
// choices HIGH / MEDIUM / LOW / NONE), not a captured trace.

const ACCENT = "oklch(0.72 0.15 195)"

export function TokenTape({
  label,
  tokens,
  highlightFrom,
}: {
  label: string
  tokens: string[]
  highlightFrom?: number
}) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1 p-3">
        {tokens.map((t, i) => {
          const isNew = highlightFrom !== undefined && i >= highlightFrom
          return (
            <span
              key={i}
              className={cn(
                "rounded-sm px-1.5 py-1 font-mono text-[10px] leading-none",
                isNew
                  ? "text-white"
                  : "border border-dashed text-muted-foreground"
              )}
              style={isNew ? { background: ACCENT } : undefined}
              title={isNew ? "new — not in the cached prefix" : "reused from the cached prefill"}
            >
              {t}
            </span>
          )
        })}
      </div>
      {highlightFrom !== undefined ? (
        <div className="border-t px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          dashed = read from the cached KV, no recompute · solid = the only tokens this pass
          actually runs the decoder on
        </div>
      ) : null}
    </div>
  )
}

const CANDIDATE_ROWS = [
  { name: "HIGH", tokenId: 90219, str: "HIGH", multi: false },
  { name: "MEDIUM", tokenId: 44, str: "M", multi: true },
  { name: "LOW", tokenId: 9441, str: "LOW", multi: false },
  { name: "NONE", tokenId: 45425, str: "NONE", multi: false },
]

export function VocabGather({ stage }: { stage: "full" | "gathered" }) {
  return (
    <div className="my-4 overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        LM head output for the last position · Qwen2.5-1.5B vocab, 151,936 rows
      </div>
      <div className="p-3">
        {stage === "full" ? (
          <div className="flex items-center gap-0.5 overflow-hidden">
            {Array.from({ length: 48 }, (_, i) => {
              const hit = [6, 19, 31, 43].includes(i)
              return (
                <span
                  key={i}
                  className="h-8 flex-1 rounded-[2px]"
                  style={{
                    background: hit ? ACCENT : "var(--muted)",
                    opacity: hit ? 1 : 0.35 + (i % 5) * 0.08,
                  }}
                />
              )
            })}
          </div>
        ) : (
          <div className="space-y-1.5">
            {CANDIDATE_ROWS.map((r) => (
              <div key={r.name} className="flex items-center gap-3 font-mono text-[11px]">
                <span className="w-16 shrink-0 text-muted-foreground">{r.name}</span>
                <span
                  className="flex h-6 items-center rounded-sm px-2 text-white"
                  style={{ background: ACCENT }}
                >
                  id {r.tokenId} · {"“"}{r.str}{"”"}
                </span>
                {r.multi ? (
                  <span className="text-muted-foreground">
                    ← only this token; {"“"}EDIUM{"”"} is never looked at
                  </span>
                ) : (
                  <span className="text-muted-foreground">← the whole value, one token</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
      <div className="border-t px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        {stage === "full"
          ? "one shared linear layer, one matmul — the same LM head every token in the model already uses"
          : "everything except these 4 numbers is thrown away"}
      </div>
    </div>
  )
}
