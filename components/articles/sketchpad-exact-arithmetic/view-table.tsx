"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { SUM_MARGINS, TABLE_MIN } from "./margins"
import { BLANK, GLYPHS, type View, rule, token, viewLabel } from "./sheet-rule"

// All 242 rows of Sketchpad's SUM table, coloured by the margin the published
// device certificate records for each (Apple M4, WebGPU, fp16). Darker = closer
// to flipping. Two panels: no carry in, carry in. Rows are the top digit,
// columns the bottom digit, blank first.

const LO = 3
const HI = 20

function shade(m: number) {
  const k = Math.min(1, Math.max(0, (HI - m) / (HI - LO)))
  const a = 0.08 + 0.85 * k * k
  return `oklch(0.62 0.2 10 / ${a.toFixed(3)})`
}

export function ViewTable() {
  const [pick, setPick] = useState<number>(73)
  const [equalOnly, setEqualOnly] = useState(false)

  const ci = pick >= 121 ? 1 : 0
  const ti = Math.floor((pick % 121) / 11)
  const bi = pick % 11
  const view: View = [ci ? "1" : BLANK, GLYPHS[ti], GLYPHS[bi]]
  const ans = rule(view)
  const m = SUM_MARGINS[pick]
  const unequal = (view[1] === BLANK) !== (view[2] === BLANK)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-3 font-mono text-xs text-muted-foreground">
        The 242 views of the addition table, coloured by the certified margin on the M4 · darker is closer to a wrong answer · tap a cell
      </figcaption>

      <label className="mb-3 flex items-center gap-2 font-mono text-xs text-muted-foreground">
        <input type="checkbox" checked={equalOnly} onChange={(e) => setEqualOnly(e.target.checked)} />
        fade the 40 views only operands of unequal length can reach
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        {[0, 1].map((c) => (
          <div key={c}>
            <div className="mb-1 font-mono text-xs text-muted-foreground">{c ? "carry in: 1" : "carry in: blank"}</div>
            <div className="grid" style={{ gridTemplateColumns: "1.1rem repeat(11, minmax(0, 1fr))", gap: "2px" }}>
              <div />
              {GLYPHS.map((g) => (
                <div key={g} className="text-center font-mono text-[10px] text-muted-foreground">
                  {g === BLANK ? "·" : g}
                </div>
              ))}
              {GLYPHS.map((tg, t) => (
                <Line
                  key={tg}
                  label={tg === BLANK ? "·" : tg}
                  base={c * 121 + t * 11}
                  pick={pick}
                  setPick={setPick}
                  equalOnly={equalOnly}
                  topBlank={tg === BLANK}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1 font-mono text-[10px] text-muted-foreground">rows: top digit · columns: bottom digit · · is a blank cell</div>

      <div className="mt-3 grid gap-2 rounded-lg bg-muted/40 p-3 font-mono text-xs sm:grid-cols-3">
        <div>
          <div className="text-muted-foreground">view (carry, top, bottom)</div>
          <div className="text-foreground">[{viewLabel(view)}]{unequal ? " · unequal lengths" : ""}</div>
        </div>
        <div>
          <div className="text-muted-foreground">table answer (one token)</div>
          <div className="text-foreground">
            {token(ans)}
            {ans.halt ? " = halt" : ` = digit ${ans.digit}, carry ${ans.carry}`}
          </div>
        </div>
        <div>
          <div className="text-muted-foreground">certified margin</div>
          <div className={cn(m < 6 ? "text-[oklch(0.62_0.2_10)]" : "text-foreground")}>
            {m.toFixed(3)} logits{m <= TABLE_MIN.SUM ? " · weakest of all 2,446" : ""}
          </div>
        </div>
      </div>
    </figure>
  )
}

function Line({
  label,
  base,
  pick,
  setPick,
  equalOnly,
  topBlank,
}: {
  label: string
  base: number
  pick: number
  setPick: (i: number) => void
  equalOnly: boolean
  topBlank: boolean
}) {
  return (
    <>
      <div className="flex items-center justify-center font-mono text-[10px] text-muted-foreground">{label}</div>
      {GLYPHS.map((bg, b) => {
        const i = base + b
        const m = SUM_MARGINS[i]
        const unequal = topBlank !== (bg === BLANK)
        return (
          <button
            key={bg}
            type="button"
            aria-label={`view ${i}, margin ${m.toFixed(2)}`}
            onClick={() => setPick(i)}
            onMouseEnter={() => setPick(i)}
            className={cn(
              "aspect-square rounded-[2px] border",
              i === pick ? "border-foreground" : "border-transparent",
              equalOnly && unequal && "opacity-15",
            )}
            style={{ background: shade(m) }}
          />
        )
      })}
    </>
  )
}
