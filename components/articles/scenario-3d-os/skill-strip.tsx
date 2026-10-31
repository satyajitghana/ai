"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { SKILLS } from "./skills-data"

// Every one of the 167 SKILL.md bodies in scenario-labs/skills, one square each,
// sorted by body word count within its tier. The repository's style check fails a
// body over 2,500 words; the dashed line is that cap. Measured, not drawn by hand.

const CORE = "oklch(0.70 0.15 235)"
const EXPERT = "oklch(0.74 0.16 55)"
const CAP = 2500
const MIN = 500
const W = 640
const ROW = 14
const GAP = 3

type Tier = "c" | "e"

export function SkillStrip() {
  const [tier, setTier] = useState<Tier | "all">("all")
  const [hover, setHover] = useState<number | null>(null)

  // bins of 250 words, stacked as columns of squares
  const bins: { lo: number; items: { i: number; tier: Tier; name: string; words: number; code: number }[] }[] = []
  for (let lo = MIN; lo < CAP; lo += 250) bins.push({ lo, items: [] })
  SKILLS.forEach((s, i) => {
    if (tier !== "all" && s[1] !== tier) return
    const b = Math.min(Math.floor((s[3] - MIN) / 250), bins.length - 1)
    bins[b].items.push({ i, tier: s[1], name: s[0], words: s[3], code: s[4] })
  })
  const colW = W / bins.length
  const maxStack = Math.max(...bins.map((b) => b.items.length), 1)
  const H = maxStack * (ROW + GAP) + 34
  const hv = hover === null ? null : SKILLS[hover]
  const med = (t: Tier) => {
    const w = SKILLS.filter((s) => s[1] === t).map((s) => s[3]).sort((a, b) => a - b)
    return w[Math.floor(w.length / 2)]
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>167 SKILL.md bodies, by word count</span>
        <span className="text-muted-foreground/50">measured</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {(["all", "c", "e"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTier(t)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
                tier === t ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t === "all" ? "both tiers" : t === "c" ? "80 core (Scenario MCP)" : "87 expert (local apps)"}
            </button>
          ))}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-md border bg-background" role="img" aria-label="Histogram of skill body lengths; expert skills pile up just under the 2,500 word cap">
          {bins.map((b, bi) =>
            b.items.map((it, k) => (
              <rect
                key={it.i}
                x={bi * colW + 4}
                y={H - 22 - (k + 1) * (ROW + GAP)}
                width={colW - 8}
                height={ROW}
                rx={2}
                fill={it.tier === "c" ? CORE : EXPERT}
                opacity={hover === null || hover === it.i ? 0.9 : 0.35}
                onMouseEnter={() => setHover(it.i)}
                onMouseLeave={() => setHover(null)}
                onClick={() => setHover(it.i)}
              />
            )),
          )}
          {bins.map((b, bi) => (
            <text key={b.lo} x={bi * colW + colW / 2} y={H - 8} textAnchor="middle" fontSize={9} className="font-mono" fill="currentColor" opacity={0.55}>
              {b.lo}
            </text>
          ))}
          <line x1={W - 1} x2={W - 1} y1={4} y2={H - 22} stroke="currentColor" strokeDasharray="4 3" opacity={0.6} />
          <text x={W - 6} y={14} textAnchor="end" fontSize={9} className="font-mono" fill="currentColor" opacity={0.7}>
            2,500-word cap
          </text>
        </svg>
        <div className="mt-2 min-h-[2.5rem] font-mono text-[11px] text-muted-foreground">
          {hv ? (
            <span>
              <span className="text-foreground">{hv[0]}</span> · {hv[3].toLocaleString("en-US")} words · {hv[4].toLocaleString("en-US")} lines of shipped scripts · {hv[5] ? "calls model_run" : "no model_run"}
            </span>
          ) : (
            <span>
              Medians: core <span className="text-foreground">{med("c").toLocaleString("en-US")}</span> words, expert{" "}
              <span className="text-foreground">{med("e").toLocaleString("en-US")}</span>. Hover a square for the skill. Bins are 250 words wide; the last holds 2,250 to 2,499.
            </span>
          )}
        </div>
      </div>
    </figure>
  )
}
