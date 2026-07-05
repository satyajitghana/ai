"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Expert collapse, made tangible — an SVG bar chart. Toggle between a balanced router
// and a collapsed one: without a load-balancing pressure, a few experts win early, get
// all the gradient, and the rest starve. Bar height is each expert's share of tokens;
// the accent tint runs hot for the winners and fades toward the starving experts. The
// dashed line is the ideal uniform share (1/8 = 12.5%). Animated so the redistribution
// is visible; the scale is fixed across both states so the toggle stays honest.

const ACCENT = "oklch(0.60 0.15 255)"
const EXPERTS = 8
const IDEAL = 100 / EXPERTS

// load distributions (% of tokens) — must each sum to ~100
const BALANCED = [12, 13, 11, 14, 12, 13, 12, 13]
const COLLAPSED = [34, 3, 27, 2, 2, 22, 8, 2]

// ── scene geometry (viewBox units) ─────────────────────────────────────────
const W = 640
const H = 210
const BASE = 174
const TOPY = 20
const MAX = Math.max(...COLLAPSED) // fixed scale so the toggle is honest
const BW = 58
const X0 = 12
const GAP = (W - 2 * X0 - EXPERTS * BW) / (EXPERTS - 1)
const bx = (i: number) => X0 + i * (BW + GAP)
const barY = (c: number) => BASE - (c / MAX) * (BASE - TOPY)

export function MoeLoadBalance() {
  const [collapsed, setCollapsed] = useState(false)
  const load = collapsed ? COLLAPSED : BALANCED
  const idealY = barY(IDEAL)
  const alive = load.filter((c) => c >= 5).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">expert load distribution</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "balanced" },
            { v: true, label: "collapsed" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setCollapsed(o.v)}
              aria-pressed={collapsed === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                collapsed === o.v
                  ? "text-background"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={collapsed === o.v ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-3 py-3 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Bar chart of token share across 8 experts, ${collapsed ? "collapsed: three experts take most traffic and the rest starve" : "balanced: every expert gets a fair share near the 12.5% ideal"}.`}
        >
          <defs>
            <filter id="moe-lb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* baseline */}
          <line x1={X0 - 4} y1={BASE} x2={W - X0 + 4} y2={BASE} stroke="var(--border)" strokeWidth={1} />

          {/* ideal share line */}
          <line
            x1={X0 - 4}
            y1={idealY}
            x2={W - X0 + 4}
            y2={idealY}
            stroke="var(--muted-foreground)"
            strokeWidth={1.2}
            strokeDasharray="5 4"
          />
          <text x={W - X0} y={idealY - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
            ideal 12.5%
          </text>

          {/* bars */}
          {load.map((c, e) => {
            const y = barY(c)
            const hot = c / MAX
            const starving = c < IDEAL * 0.5
            return (
              <g key={e}>
                <text
                  x={bx(e) + BW / 2}
                  y={y - 6}
                  textAnchor="middle"
                  fontSize={11}
                  className={cn("font-mono tabular-nums", starving ? "fill-muted-foreground/50" : "fill-muted-foreground")}
                >
                  {c}%
                </text>
                <rect
                  x={bx(e)}
                  y={y}
                  width={BW}
                  height={Math.max(BASE - y, 0.5)}
                  rx={4}
                  fill={ACCENT}
                  opacity={0.22 + 0.66 * hot}
                  filter={hot > 0.55 ? "url(#moe-lb-soft)" : undefined}
                  className="transition-all duration-700 ease-out"
                />
                <text
                  x={bx(e) + BW / 2}
                  y={BASE + 16}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  className={cn("font-mono", starving ? "fill-muted-foreground/50" : "fill-foreground")}
                >
                  E{e}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
          <span>share of tokens per expert · fixed scale</span>
          <span>
            live experts (≥5%): <span className="text-foreground">{alive}</span>/8
          </span>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        {collapsed ? (
          <>
            Three experts swallow ~83% of the tokens; four are all but dead. Those
            experts get almost no gradient, never improve, and the model is quietly
            a fraction of its advertised size. This is the failure mode you fight.
          </>
        ) : (
          <>
            Every expert sees a fair share, so all of them keep learning. Getting
            here is not free — it takes the routing noise plus an auxiliary
            load-balancing loss that penalises lopsided routing during training.
          </>
        )}
      </p>
    </figure>
  )
}
