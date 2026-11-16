"use client"

import { useMemo, useState, useSyncExternalStore } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// xeet's line fitting, from crates/xeet-core/src/inline.rs (commit 71079ff1):
//
//   fn ceil64(w) = ceil(w * 64) / 64                    // Blink's LayoutUnit::FromFloatCeil
//   fn fits(width, avail, at_space) =
//       ceil64(width) <= avail + (at_space ? 1/64 : 0)  // one 1/64 px of slack at a space break
//
// layout_hard_line() walks the break opportunities from the line start, keeps
// the furthest one that fits using widths measured inside the paragraph, then
// re-shapes that line on its own and steps back one opportunity at a time
// while the re-shaped line does not fit. This widget runs that loop.
//
// The widths are NOT Chirp's. They are measured on mount with canvas
// measureText in this browser's own sans-serif at 15 px, so the line breaks
// here are this browser's, and only the arithmetic is xeet's. Nothing about
// xeet's fonts or wasm is loaded.

const TEXT =
  "A hermetic, pixel-perfect X post renderer in safe Rust / wasm. Zero browser, network, filesystem, system fonts. Renders a post to PNG in ~1ms."
const FONT = "15px Helvetica, Arial, sans-serif"
const UNIT = 1 / 64

const ceil64 = (w: number) => Math.ceil(w * 64) / 64
const fits = (w: number, avail: number, atSpace: boolean) => ceil64(w) <= avail + (atSpace ? UNIT : 0)
const px = (w: number) => w.toFixed(3)

type Cand = { end: number; text: string; para: number; alone: number; atSpace: boolean; ok: boolean }
type LineTrace = { start: number; text: string; cands: Cand[]; best: number | null; chosen: number; stepped: number }

// Break opportunities: after each run of spaces (Chrome's space rule), and after "/" and "-"
// inside a word is left out to keep the toy readable. Offsets are character indices.
function opportunities(text: string): number[] {
  const out: number[] = []
  for (let i = 1; i < text.length; i++) if (text[i - 1] === " " && text[i] !== " ") out.push(i)
  return out
}

function layout(text: string, avail: number, measure: (s: string) => number): LineTrace[] {
  const opps = opportunities(text)
  // Paragraph positions: the prefix widths of the whole text, as the shaper sees it before breaking.
  const prefix = (i: number) => measure(text.slice(0, i))
  const trail = (s: number, e: number) => {
    let t = e
    while (t > s && text[t - 1] === " ") t--
    return t
  }
  const lines: LineTrace[] = []
  let ls = 0
  let guard = 0
  while (ls < text.length && guard++ < 60) {
    const ends = opps.filter((o) => o > ls).concat(text.length)
    const cands: Cand[] = []
    let best: number | null = null
    for (let k = 0; k < ends.length; k++) {
      const e = ends[k]
      const t = trail(ls, e)
      const para = prefix(t) - prefix(ls)
      const atSpace = t < e
      const ok = fits(para, avail, atSpace)
      cands.push({ end: e, text: text.slice(ls, t), para, alone: measure(text.slice(ls, t)), atSpace, ok })
      if (ok) best = k
      else break
    }
    let chosen = 0
    let stepped = 0
    if (best !== null) {
      let k = best
      while (k > 0 && !fits(cands[k].alone, avail, cands[k].atSpace)) {
        k--
        stepped++
      }
      chosen = k
    }
    const end = cands[chosen].end
    lines.push({ start: ls, text: text.slice(ls, trail(ls, end)), cands, best, chosen, stepped })
    ls = end
  }
  return lines
}

const noop = () => () => {}

function makeMeasure(): ((s: string) => number) | null {
  const ctx = document.createElement("canvas").getContext("2d")
  if (!ctx) return null
  ctx.font = FONT
  const cache = new Map<string, number>()
  return (s: string) => {
    let w = cache.get(s)
    if (w === undefined) {
      w = ctx.measureText(s).width
      cache.set(s, w)
    }
    return w
  }
}

export function LineFit() {
  // Canvas exists only in the browser: render the "measuring" state on the server and on the
  // first client pass, then build the measurer.
  const mounted = useSyncExternalStore(noop, () => true, () => false)
  const measure = useMemo(() => (mounted ? makeMeasure() : null), [mounted])
  const [avail, setAvail] = useState(260)
  const [line, setLine] = useState(0)

  const lines = useMemo(() => (measure ? layout(TEXT, avail, measure) : []), [measure, avail])
  const cur = lines[Math.min(line, Math.max(0, lines.length - 1))]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">Fitting a line the way xeet copies Blink</div>
        <div className="font-mono text-xs text-muted-foreground">ceil64(width) ≤ box (+1/64 at a space)</div>
      </div>

      <label className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
        <span>column width</span>
        <span>{avail.toFixed(2)} px</span>
      </label>
      <Range
        min={180}
        max={340}
        step={0.25}
        value={avail}
        onChange={(e) => {
          setAvail(Number(e.target.value))
          setLine(0)
        }}
        aria-label="Column width in CSS pixels"
      />

      {!measure ? (
        <p className="mt-4 text-muted-foreground">Measuring the text in your browser…</p>
      ) : (
        <>
          <div
            className="mt-4 overflow-hidden rounded-md border border-dashed border-border bg-background p-2"
            style={{ width: avail + 18, maxWidth: "100%" }}
          >
            {lines.map((l, i) => (
              <button
                key={l.start}
                type="button"
                onClick={() => setLine(i)}
                className={cn(
                  "block w-full whitespace-pre text-left",
                  i === line ? "bg-primary/10 text-foreground" : "text-muted-foreground",
                )}
                style={{ font: FONT, lineHeight: "20px" }}
              >
                {l.text}
              </button>
            ))}
          </div>

          <div className="mt-4 flex items-center gap-2">
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 font-mono text-xs disabled:opacity-40"
              disabled={line === 0}
              onClick={() => setLine((v) => Math.max(0, v - 1))}
            >
              ← line
            </button>
            <span className="font-mono text-xs text-muted-foreground">
              line {Math.min(line, lines.length - 1) + 1} of {lines.length}
            </span>
            <button
              type="button"
              className="rounded border border-border px-2 py-0.5 font-mono text-xs disabled:opacity-40"
              disabled={line >= lines.length - 1}
              onClick={() => setLine((v) => Math.min(lines.length - 1, v + 1))}
            >
              line →
            </button>
          </div>

          {cur && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[30rem] font-mono text-xs">
                <thead className="text-muted-foreground">
                  <tr className="text-left">
                    <th className="py-1 pr-2 font-normal">candidate end</th>
                    <th className="py-1 pr-2 text-right font-normal">width</th>
                    <th className="py-1 pr-2 text-right font-normal">ceil64</th>
                    <th className="py-1 pr-2 text-right font-normal">limit</th>
                    <th className="py-1 font-normal">verdict</th>
                  </tr>
                </thead>
                <tbody>
                  {cur.cands.map((c, k) => {
                    const limit = avail + (c.atSpace ? UNIT : 0)
                    const isChosen = k === cur.chosen
                    const words = c.text.split(" ")
                    return (
                      <tr key={c.end} className={cn("border-t border-border", isChosen && "bg-primary/10")}>
                        <td className="max-w-[12rem] truncate py-1 pr-2">…{words[words.length - 1]}</td>
                        <td className="py-1 pr-2 text-right">{px(c.para)}</td>
                        <td className="py-1 pr-2 text-right">{px(ceil64(c.para))}</td>
                        <td className="py-1 pr-2 text-right">{px(limit)}</td>
                        <td className={cn("py-1", c.ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                          {c.ok ? (isChosen ? "fits, furthest: break here" : "fits") : "too wide, stop"}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-xs text-muted-foreground">
                {cur.best === null
                  ? "Nothing fits: xeet breaks inside the word, keeping at least one grapheme."
                  : cur.stepped > 0
                    ? `Re-shaped on its own, the furthest candidate no longer fit, so the loop stepped back ${cur.stepped}.`
                    : `Re-shaped on its own (${px(cur.cands[cur.chosen].alone)} px), the chosen line still fits.`}
              </p>
            </div>
          )}
        </>
      )}

      <SlackDemo />

      <figcaption className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        The loop and the rounding are xeet&apos;s (<code>fits</code> and <code>ceil64</code> in{" "}
        <code>inline.rs</code>). The widths are your browser&apos;s sans-serif at 15 px, measured with canvas{" "}
        <code>measureText</code>, not Chirp, so your breaks are not X&apos;s. Drag the width a quarter pixel at a time
        and watch a word hop lines when its rounded width crosses the limit.
      </figcaption>
    </figure>
  )
}

// The worked example in the comment on `fits()`: a 240.015625 px line in a 240 px box.
function SlackDemo() {
  const [atSpace, setAtSpace] = useState(true)
  const width = 240.015625
  const box = 240
  const ok = fits(width, box, atSpace)
  return (
    <div className="mt-5 rounded-md border border-border bg-background p-3">
      <div className="mb-2 text-xs font-medium">The 1/64 px of slack, from the comment on <code>fits()</code></div>
      <div className="mb-2 flex flex-wrap gap-2">
        {[
          [true, "line ends before a space"],
          [false, "line ends after a hyphen"],
        ].map(([v, label]) => (
          <button
            key={String(v)}
            type="button"
            onClick={() => setAtSpace(v as boolean)}
            className={cn(
              "rounded border px-2 py-0.5 font-mono text-xs",
              atSpace === v ? "border-primary bg-primary/10" : "border-border text-muted-foreground",
            )}
          >
            {label as string}
          </button>
        ))}
      </div>
      <div className="font-mono text-xs leading-6">
        <div>width {width} px → ceil64 = {ceil64(width)} px</div>
        <div>
          box {atSpace ? "240 px + 1/64 = 240.015625 px" : "240 px"} →{" "}
          <span className={ok ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>
            {ok ? "fits" : "does not fit"}
          </span>
        </div>
      </div>
    </div>
  )
}
