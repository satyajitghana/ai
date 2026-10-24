"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// How many SVG circles the ui variant's dot field puts on the page, and how
// many DOM writes a frame costs. The grid rule is the runtime's: one circle
// every 15 px from -30 px to (size + 44) px on each axis, all of them updated
// every animation frame (opacity, r, and an is-lit class toggle). The three
// demo cards are the real sizes I measured in headless Chromium.

const SP = 15
const MG = 44
const START = Math.floor(MG / SP) * SP // 30

const axis = (n: number) => Math.floor((n + MG + START) / SP) + 1
const dotsFor = (w: number, h: number) => axis(w) * axis(h)

const DEMO = [
  { name: "Heart Rate Monitor", w: 332, h: 345, nodes: 947 },
  { name: "Chart card", w: 320, h: 554, nodes: 1431 },
  { name: "Music Player Likes", w: 360, h: 421, nodes: 1198 },
]

const fmt = (n: number) => n.toLocaleString("en-US")

export function DotBudget() {
  const [w, setW] = useState(332)
  const [h, setH] = useState(345)
  const [n, setN] = useState(1)

  const per = dotsFor(w, h)
  const total = per * n
  const writes = total * 3
  const perSecond = writes * 60

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what the dot field costs</span>
        <span className="text-muted-foreground/60">grid rule from ui-generation.js · demo sizes measured</span>
      </div>

      <div className="grid gap-2 px-4 pt-3 font-mono text-[11px] text-muted-foreground">
        {(
          [
            ["width", w, setW, 120, 900, "px"],
            ["height", h, setH, 120, 900, "px"],
            ["elements at once", n, setN, 1, 6, ""],
          ] as const
        ).map(([label, v, set, lo, hi, unit]) => (
          <label key={label} className="flex items-center gap-3">
            <span className="w-32 shrink-0">{label}</span>
            <Range
              min={lo}
              max={hi}
              step={1}
              value={v}
              onChange={(e) => set(Number(e.target.value))}
              aria-label={label}
              className="flex-1"
            />
            <span className="w-16 shrink-0 text-right tabular-nums text-foreground">
              {v}
              {unit}
            </span>
          </label>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 px-4 py-4 sm:grid-cols-4">
        {[
          ["grid", `${axis(w)} × ${axis(h)}`],
          ["circles", fmt(total)],
          ["DOM writes / frame", fmt(writes)],
          ["at 60 fps, / s", fmt(perSecond)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-lg border bg-background/60 px-3 py-2">
            <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{k}</div>
            <div className="font-mono text-lg tabular-nums">{v}</div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3 font-mono text-[10.5px] text-muted-foreground">
        <div className="mb-1 text-foreground">the skill&apos;s own demo cards (measured)</div>
        {DEMO.map((d) => (
          <button
            key={d.name}
            type="button"
            onClick={() => {
              setW(d.w)
              setH(d.h)
              setN(1)
            }}
            className="flex w-full items-center justify-between gap-3 rounded px-1 py-0.5 text-left hover:bg-muted"
          >
            <span>{d.name}</span>
            <span className="tabular-nums">
              {d.w}×{d.h} px · {fmt(dotsFor(d.w, d.h))} dots · {fmt(d.nodes)} overlay nodes
            </span>
          </button>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A {w} by {h} px element gets a {axis(w)} by {axis(h)} grid: {fmt(per)} circles each, {fmt(total)} for {n} at once.
        Every frame the runtime sets two attributes and toggles one class on each, about {fmt(writes)} DOM writes a frame.
        The grid grows with area, so a full-width hero costs several times a card. The text and image variants avoid this:
        their halftone lands on a canvas.
      </figcaption>
    </figure>
  )
}
