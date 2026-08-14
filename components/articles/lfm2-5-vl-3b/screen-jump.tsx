"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// ScreenSpot-v2, the row where the previous generation was not merely weak but
// absent. All numbers transcribed from Liquid AI's own comparison table; the
// averages are computed from the three splits, and they reproduce the blog's
// quoted figures exactly (80.7 / 51.2 / 78.5 / 84.1).

type M = { name: string; params: string; desktop: number; mobile: number; web: number; self?: boolean; prev?: boolean }

const MODELS: M[] = [
  { name: "LFM2.5-VL-3B", params: "3.1B", desktop: 78.7, mobile: 81.2, web: 82.2, self: true },
  { name: "LFM2-VL-3B", params: "3.1B", desktop: 6.0, mobile: 7.6, web: 2.5, prev: true },
  { name: "gemma-4-E2B-it", params: "5.1B", desktop: 28.1, mobile: 42.9, web: 22.4 },
  { name: "gemma-4-E4B-it", params: "8B", desktop: 45.8, mobile: 60.3, web: 47.6 },
  { name: "InternVL 3.5 2B", params: "2.4B", desktop: 79.9, mobile: 86.2, web: 79.9 },
  { name: "InternVL 3.5 4B", params: "4.7B", desktop: 82.0, mobile: 87.8, web: 82.6 },
  { name: "Qwen3.5-2B", params: "2.3B", desktop: 63.8, mobile: 69.7, web: 65.9 },
  { name: "Qwen3.5-4B", params: "4.7B", desktop: 76.3, mobile: 81.4, web: 77.8 },
]

const avg = (m: M) => (m.desktop + m.mobile + m.web) / 3

const SPLITS = ["average", "desktop", "mobile", "web"] as const

const SELF = "oklch(0.60 0.15 255)"
const PREV = "oklch(0.58 0.19 25)"
const OTHER = "oklch(0.62 0.03 250)"

export function ScreenJump() {
  const [split, setSplit] = useState<(typeof SPLITS)[number]>("average")

  const val = (m: M) => (split === "average" ? avg(m) : m[split])
  const ranked = [...MODELS].sort((a, b) => val(b) - val(a))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">ScreenSpot-v2 · GUI grounding</span>
        <div className="flex flex-wrap gap-1">
          {SPLITS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSplit(s)}
              aria-pressed={split === s}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                split === s
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-1.5">
          {ranked.map((m) => {
            const v = val(m)
            return (
              <div key={m.name} className="flex items-center gap-2">
                <span className="w-32 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground">
                  {m.name}
                </span>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${v}%`, background: m.self ? SELF : m.prev ? PREV : OTHER }}
                  />
                </div>
                <span className="w-11 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                  {v.toFixed(1)}
                </span>
                <span className="w-9 shrink-0 text-right font-mono text-[9px] text-muted-foreground">{m.params}</span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: SELF }}>
            5.4 → 80.7 average · a 15× move in one release
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">
            Liquid AI files this under &ldquo;significant improvements in screen understanding,&rdquo; which
            undersells it. LFM2-VL-3B scored 6.0, 7.6 and 2.5 on the three splits — not weak, effectively absent.
            Whatever the previous model was doing when shown a screenshot, it was not grounding UI elements.
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The two InternVL models still lead this row, and the gap is not trivial — 84.1 against 80.7. What changed
          is that GUI grounding went from a capability this line did not have to one where it beats every Gemma and
          Qwen model in the comparison, including ones two and a half times its size. For a model whose stated
          purpose is running on the device the screen belongs to, that is the row that matters most.
        </p>
      </div>
    </figure>
  )
}
