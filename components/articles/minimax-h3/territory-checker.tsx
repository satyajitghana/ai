"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The MiniMax H3 Community License Agreement scopes its grant to "the
// Applicable Territory," defined as worldwide EXCLUDING the "Excluded
// Territories": the European Union, United Kingdom, Republic of Korea, and
// United States of America. This reconstructs that clause as a checker over a
// small, fixed list of countries — no geolocation, no network call, just the
// license text applied to a name. Revenue gate ($20M/yr) is the license's
// separate, stacked condition for territories that ARE covered.

const EXCLUDED = "oklch(0.62 0.2 25)"
const OK = "oklch(0.68 0.14 200)"

type Country = { name: string; excluded: boolean; note: string }

const COUNTRIES: Country[] = [
  { name: "United States", excluded: true, note: "named Excluded Territory" },
  { name: "United Kingdom", excluded: true, note: "named Excluded Territory" },
  { name: "Germany", excluded: true, note: "Excluded Territory as an EU member" },
  { name: "South Korea", excluded: true, note: "named Excluded Territory" },
  { name: "Switzerland", excluded: false, note: "European, but not an EU member" },
  { name: "India", excluded: false, note: "not in any Excluded Territory" },
  { name: "Japan", excluded: false, note: "not in any Excluded Territory" },
  { name: "Brazil", excluded: false, note: "not in any Excluded Territory" },
]

export function TerritoryChecker() {
  const [idx, setIdx] = useState(0)
  const [over20m, setOver20m] = useState(false)
  const c = COUNTRIES[idx]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        minimax h3 community license · territory checker
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {COUNTRIES.map((cc, i) => (
            <button
              key={cc.name}
              type="button"
              onClick={() => setIdx(i)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                i === idx
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {cc.name}
            </button>
          ))}
        </div>

        <div
          className="mt-4 rounded-lg border px-3 py-3 text-center"
          style={{ borderColor: c.excluded ? EXCLUDED : OK }}
        >
          <div className="font-mono text-sm" style={{ color: c.excluded ? EXCLUDED : OK }}>
            {c.excluded ? "not licensed here" : "licensed here"}
          </div>
          <div className="mt-1 font-mono text-[11px] text-muted-foreground">{c.note}</div>
        </div>

        {!c.excluded ? (
          <div className="mt-3 flex items-center justify-center gap-2 font-mono text-[11px]">
            <button
              type="button"
              role="switch"
              aria-checked={over20m}
              onClick={() => setOver20m((v) => !v)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 transition-colors",
                over20m ? "border-foreground/30 bg-muted/50 text-foreground" : "text-muted-foreground"
              )}
            >
              {over20m ? "✓" : "○"} commercial revenue over $20M/yr
            </button>
          </div>
        ) : null}

        {!c.excluded && over20m ? (
          <p className="mt-2 text-center font-mono text-[11px]" style={{ color: EXCLUDED }}>
            → requires separate, prior written authorization from MiniMax
          </p>
        ) : null}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The license grants use &ldquo;worldwide&rdquo; except in four named Excluded Territories — the point is that the exclusion is drawn at the EU/UK/US/ROK
          level, not by geography generally: Switzerland, right next to three excluded blocs, is not excluded. Everywhere not excluded still carries a
          separate condition — written authorization once a commercial deployment clears $20M/yr in revenue.
        </p>
      </div>
    </figure>
  )
}
