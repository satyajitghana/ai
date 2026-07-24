"use client"

import { useState } from "react"

// The three-stage SFT curriculum (report, Figure 5). As the context window grows
// 64K → 128K → 256K, the supervised target-token mixture is deliberately shifted
// from reasoning-STEM toward long-horizon agentic data — the model first learns
// to think, then learns to act. Percentages are the report's; the widget is ours.

const ACCENT = "oklch(0.64 0.1 188)" // agentic — the segment that grows
const REASON = "oklch(0.62 0.11 264)" // reasoning-STEM
const GENERAL = "oklch(0.7 0.02 250)" // general instruction

type Seg = { key: "reason" | "general" | "agentic"; label: string; color: string }
const SEGS: Seg[] = [
  { key: "reason", label: "reasoning · STEM", color: REASON },
  { key: "general", label: "general instruction", color: GENERAL },
  { key: "agentic", label: "agentic", color: ACCENT },
]

type Stage = { ctx: string; reason: number; general: number; agentic: number }
const STAGES: Stage[] = [
  { ctx: "64K", reason: 82.7, general: 11.6, agentic: 5.7 },
  { ctx: "128K", reason: 47.8, general: 22.7, agentic: 29.5 },
  { ctx: "256K", reason: 22.4, general: 8.7, agentic: 68.9 },
]

export function SftCurriculum() {
  const [hover, setHover] = useState<Seg["key"] | null>(null)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">sft curriculum · target-token mixture</span>
        <div className="flex flex-wrap gap-2.5">
          {SEGS.map((s) => (
            <button
              key={s.key}
              type="button"
              onMouseEnter={() => setHover(s.key)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(s.key)}
              onBlur={() => setHover(null)}
              className="flex cursor-pointer items-center gap-1.5 font-mono text-[11px] text-muted-foreground transition-opacity hover:text-foreground"
            >
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
              {s.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        {STAGES.map((st) => (
          <div key={st.ctx} className="flex items-center gap-3">
            <div className="w-16 shrink-0 text-right font-mono text-xs text-muted-foreground">
              {st.ctx}
            </div>
            <div className="flex h-9 flex-1 overflow-hidden rounded-md border">
              {SEGS.map((s) => {
                const v = st[s.key]
                const dim = hover != null && hover !== s.key
                return (
                  <div
                    key={s.key}
                    className="flex items-center justify-center transition-opacity duration-150"
                    style={{ width: `${v}%`, background: s.color, opacity: dim ? 0.28 : 1 }}
                    title={`${s.label}: ${v}%`}
                  >
                    {v >= 12 ? (
                      <span className="font-mono text-[11px] font-medium tabular-nums text-white/95">{v}%</span>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <div className="w-16 shrink-0" />
          <div className="flex flex-1 items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>context window &amp; stage &rarr;</span>
            <span style={{ color: ACCENT }}>agentic share: 5.7% &rarr; 29.5% &rarr; 68.9%</span>
          </div>
        </div>

        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Each row is one SFT stage. The context window grows 64K &rarr; 128K &rarr; 256K, and the mix of what the
          loss is computed on slides from <span style={{ color: REASON }}>reasoning-STEM</span> toward{" "}
          <span style={{ color: ACCENT }}>long-horizon agentic data</span> — the model builds a reasoning
          foundation first, then spends most of the final stage learning to plan, call tools, read execution
          feedback, and recover from its own mistakes. Bad intermediate turns stay in context but are masked
          out of the loss, so it learns recovery without being trained to repeat the error.
        </p>
      </div>
    </figure>
  )
}
