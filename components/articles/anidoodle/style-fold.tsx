"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How "32 styles" is counted, re-done by hand from the repo's own rules (tools/registry.mjs) and its file list.
// 34 modules export a STYLE literal; styles.legacy.json declares 11 more. 44 distinct ids after one overlap.
const DRAW = ["foxDraw", "koiDraw", "lighthouseDraw", "moonPhasesDraw", "pocketWatchDraw", "ranunculusDraw", "storybookDraw", "wrenDraw"]
const NOT_A_HAND = ["adaptAlmond", "adaptAquarelle", "adaptScrapbook", "brickBalloon"]
const HANDS = [
  "balloon", "blueprint", "brokenColour", "charcoalErasure", "colouredPencil", "dreamGlaze", "embroidery", "flatVector", "folkTale", "fox", "halftone", "isometric",
  "koi", "lighthouse", "lowPoly", "mellan", "midCentury", "moonPhases", "paintedOil", "paperCraft", "pixelArt", "pocketWatch", "ranunculus", "rubberHose",
  "scrapbook", "scratchboard", "stipple", "storybook", "sumiE", "toyBrick", "woodcut", "wren",
]

const STEPS = [
  { n: 44, text: "Every id the registry can see: 34 scanned STYLE literals plus 11 legacy entries, with one id in both." },
  { n: 36, text: "Fold the eight drawing-film variants (a name ending in Draw whose parent exists) into their parents. They are the same hand, drawn on." },
  { n: 32, text: "Drop four entries that use a hand rather than add one: three house styles matched from someone's image, and one scene (brickBalloon) drawn in toyBrick." },
]

export function StyleFold() {
  const [s, setS] = useState(0)
  const step = STEPS[s]
  const items = s === 0 ? [...HANDS, ...NOT_A_HAND, ...DRAW] : s === 1 ? [...HANDS, ...NOT_A_HAND] : HANDS
  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-4xl">{step.n}</span>
        <span className="text-sm text-muted-foreground">after step {s}</span>
      </div>
      <Range min={0} max={2} step={1} value={s} onChange={(e) => setS(Number(e.target.value))} className="mt-2 w-full" aria-label="Counting step" />
      <p className="mt-2 text-sm">{step.text}</p>
      <ul className="mt-3 flex flex-wrap gap-1.5">
        {items.map((id) => {
          const gone = DRAW.includes(id) ? "draw" : NOT_A_HAND.includes(id) ? "use" : ""
          return (
            <li
              key={id}
              className={
                "rounded border px-1.5 py-0.5 font-mono text-[11px] " +
                (gone === "draw" ? "border-amber-500 text-amber-600" : gone === "use" ? "border-rose-500 text-rose-600" : "border-border")
              }
            >
              {id}
            </li>
          )
        })}
      </ul>
      <figcaption className="mt-3 text-xs text-muted-foreground">
        Reasoned from tools/registry.mjs and the STYLE literals; I did not run the registry. The result matches the 32 rows in the repo&apos;s own references/styles/INDEX.md.
      </figcaption>
    </figure>
  )
}
