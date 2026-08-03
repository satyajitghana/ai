"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// SipIt reconstructs a prompt causally, one position at a time: the hidden state at
// position t depends only on the already-recovered prefix and the true token at t, so
// the algorithm tries vocabulary candidates against the observed hidden state until one
// matches, locks it in, and moves on. It never rescans an earlier position, and it stops
// the instant a candidate matches -- it does not score the rest of the vocabulary.
//
// The candidate strip below uses an illustrative vocabulary of V=40 purely so the scan is
// visible on a page. SipIt's own experiments explore under 0.25% of a real 30,000-128,000
// token vocabulary per prompt (paper, Tables 4 and 6) -- at V=40 that floor isn't
// representable, so the on-screen percentage reads higher than the real numbers on purpose.

const TOKENS = ["A", "user", "typed", "a", "secret", "phrase", "into", "chat"]
const TRIES = [3, 9, 1, 14, 2, 19, 4, 7] // candidates tried before the match, per position
const V = 40
const T = TOKENS.length

const ACCENT = "oklch(0.72 0.15 195)"
const BAD = "oklch(0.65 0.19 25)"

const W = 720
const SLOT = W / V
const H = 150
const STRIP_Y = 74

export function SipItWalker() {
  const [t, setT] = useState(T - 1)

  const { cumulative, budgetSoFar, pct } = useMemo(() => {
    let sum = 0
    for (let i = 0; i <= t; i++) sum += TRIES[i]
    const budget = (t + 1) * V
    return { cumulative: sum, budgetSoFar: budget, pct: (sum / budget) * 100 }
  }, [t])

  const tries = TRIES[t]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>SipIt · reconstructing one position at a time</span>
        <span className="text-muted-foreground/50">illustrative vocabulary</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Reconstructing position ${t + 1} of ${T}. ${tries} of ${V} illustrative vocabulary candidates were tried before the match; the rest were never touched.`}
        >
          <defs>
            <filter id="sip-soft" x="-40%" y="-60%" width="180%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* reconstructed sequence, position by position */}
          {TOKENS.map((tok, i) => {
            const solved = i <= t
            const active = i === t
            const pillW = W / T - 6
            const x = i * (W / T) + 3
            return (
              <g key={i}>
                <rect
                  x={x}
                  y={8}
                  width={pillW}
                  height={30}
                  rx={6}
                  fill={active ? ACCENT : "var(--background)"}
                  opacity={solved ? (active ? 0.16 : 1) : 0.4}
                  stroke={active ? ACCENT : solved ? "var(--border)" : "var(--border)"}
                  strokeDasharray={solved ? undefined : "3 2"}
                  strokeWidth={1.5}
                  filter={active ? "url(#sip-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={x + pillW / 2}
                  y={27}
                  textAnchor="middle"
                  className={cn("font-mono", solved ? "fill-foreground" : "fill-muted-foreground/50")}
                  fontSize={11}
                >
                  {solved ? tok : "?"}
                </text>
              </g>
            )
          })}

          {/* candidate scan for the active position */}
          <text x={0} y={62} className="fill-muted-foreground font-mono" fontSize={9}>
            position {t + 1} · vocabulary scan, stops at the match
          </text>
          {Array.from({ length: V }, (_, v) => {
            const rejected = v < tries - 1
            const match = v === tries - 1
            let fill = "var(--muted)"
            let op = 0.25
            if (rejected) {
              fill = BAD
              op = 0.55
            }
            if (match) {
              fill = ACCENT
              op = 0.95
            }
            return (
              <rect
                key={v}
                x={v * SLOT + 1}
                y={STRIP_Y}
                width={SLOT - 2}
                height={match ? 34 : 22}
                rx={2}
                fill={fill}
                opacity={op}
                filter={match ? "url(#sip-soft)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}
          <text x={W} y={STRIP_Y + 46} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={8}>
            {tries - 1} rejected · 1 match · {V - tries} never tried
          </text>
        </svg>

        <div className="mt-2 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">this position</div>
            <div className="font-medium text-foreground">{tries} tried</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">explored so far</div>
            <div className="font-medium text-foreground">
              {cumulative} / {budgetSoFar}
            </div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">of illustrative vocab</div>
            <div className="font-medium" style={{ color: ACCENT }}>
              {pct.toFixed(1)}%
            </div>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>position</span>
            <span className="tabular-nums text-foreground">
              {t + 1} / {T}
            </span>
          </div>
          <Range
            min={0}
            max={T - 1}
            step={1}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="w-full cursor-pointer"
            accent={ACCENT}
            aria-label="position"
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Each position depends only on the prefix already recovered, so SipIt never revisits
          an earlier token — it tries candidates, stops the instant one matches the observed
          hidden state, and appends it.{" "}
          <span style={{ color: BAD }}>Red</span>{" "}is a rejected candidate,{" "}
          <span style={{ color: ACCENT }}>green</span>{" "}is the match, and everything past the
          match is never touched. That early exit is where the linear-time guarantee comes
          from. This vocabulary is compressed to {V} entries for legibility — against a real
          30,000–128,000 token vocabulary, SipIt explored under a quarter of one percent per
          prompt (Tables 4 and 6); the mechanism here is identical, just at a scale that would
          not fit on a page.
        </p>
      </div>
    </figure>
  )
}
