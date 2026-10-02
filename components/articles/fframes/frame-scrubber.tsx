"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// fframes' core idea on a slider: a video is a pure function of the frame
// index. render_frame(frame) returns one SVG tree, and nothing else about the
// frame exists. Scrub the index and watch the scene recompute from i alone —
// the same contract as hello-world in the repo, where a square moves along a
// timeline and a line of text prints the current frame.
//
// The second thing it shows is what the svgr! macro decides at compile time.
// An attribute with no {expression} is static: its string never changes, so
// the macro hashes it once and the Skia RenderCache replays the painted path
// instead of rebuilding it. An attribute that reads the frame is dynamic and
// is converted fresh every frame. The markup panel colours the two apart and
// substitutes the live values, so you see exactly which strings move.
//
// Only sin is transcendental; it goes through lib/dmath so the SSR string and
// the browser string agree and React does not report a hydration mismatch.
// Everything else here is +, -, * and / on doubles, which is exact per IEEE-754.

const FPS = 30
const LAST = 89 // frames 0..89, just under three seconds at 30 fps

const DYN = "oklch(0.64 0.17 42)" // recomputed every frame
const STAT = "oklch(0.60 0.02 260)" // hashed once, cached

// The moving square, a pure function of i: x sweeps left to right, the fill is a
// compile-time constant. cy of the bobbing dot is the one sinusoid.
const rectX = (i: number) => 20 + (i / LAST) * 236
const dotCy = (i: number) => 92 + msin(i * 0.16) * 54

export function FrameScrubber() {
  const [i, setI] = useState(0)
  const sec = (i / FPS).toFixed(2)
  const x = rectX(i)
  const cy = dotCy(i)

  const go = (n: number) => setI(Math.max(0, Math.min(LAST, n)))

  const btn =
    "cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"

  // One markup line: a label, then runs of text that are either static or
  // dynamic. A dynamic run shows the live value for this frame.
  type Run = { t: string; dyn?: boolean }
  const line = (indent: number, runs: Run[]) => ({ indent, runs })
  const LINES = [
    line(0, [{ t: '<svg viewBox="0 0 280 184">' }]),
    line(1, [{ t: "// hashed once, replayed every frame", dyn: false }]),
    line(1, [{ t: '<rect width="44" height="44" fill="' }, { t: "steelblue" }, { t: '"' }]),
    line(2, [{ t: "x=" }, { t: `"${x.toFixed(1)}"`, dyn: true }, { t: " />" }]),
    line(1, [{ t: '<circle cx="140" r="11"' }]),
    line(2, [{ t: "cy=" }, { t: `"${cy.toFixed(1)}"`, dyn: true }, { t: " />" }]),
    line(1, [{ t: "<text>frame " }, { t: `${i}`, dyn: true }, { t: ", second " }, { t: sec, dyn: true }, { t: "</text>" }]),
    line(0, [{ t: "</svg>" }]),
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">render_frame(frame) → one SVG tree</span>
        <span className="font-mono text-[10px] text-muted-foreground">30 fps, the scene is a function of i</span>
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-2">
        <div>
          <svg viewBox="0 0 280 184" role="img" className="w-full rounded-lg border bg-background">
            <title>{`Frame ${i} at ${sec} seconds: a square at x ${x.toFixed(0)} and a dot at y ${cy.toFixed(0)}, both computed from the frame index alone.`}</title>
            <line x1={0} x2={280} y1={dotCy(0)} y2={dotCy(0)} stroke="currentColor" strokeOpacity={0.08} />
            <rect x={x} y={62} width={44} height={44} rx={5} fill="steelblue" />
            <circle cx={140} cy={cy} r={11} fill={DYN} />
            <text x={14} y={170} fontSize={13} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.75}>
              {`frame ${i}, second ${sec}`}
            </text>
          </svg>

          <div className="mt-3 flex items-center gap-2">
            <span className="w-10 shrink-0 font-mono text-[10px] text-muted-foreground">frame</span>
            <Range
              min={0}
              max={LAST}
              step={1}
              value={i}
              onChange={(e) => go(Number(e.target.value))}
              className="flex-1"
              aria-label="Frame index"
              accent={DYN}
            />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{i}</span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <button type="button" className={btn} onClick={() => go(0)}>
              frame 0
            </button>
            <button type="button" className={btn} onClick={() => go(i - 1)}>
              prev
            </button>
            <button type="button" className={btn} onClick={() => go(i + 1)}>
              next
            </button>
            <button type="button" className={btn} onClick={() => go(LAST)}>
              last
            </button>
          </div>
        </div>

        <div>
          <div className="rounded-lg border bg-muted/20 p-3 font-mono text-[11px] leading-5">
            {LINES.map((l, k) => (
              <div key={k} style={{ paddingLeft: l.indent * 12 }}>
                {l.runs.map((r, j) => (
                  <span
                    key={j}
                    style={{ color: r.dyn ? DYN : STAT }}
                    className={cn(r.dyn ? "font-semibold" : undefined, r.t.startsWith("//") ? "italic opacity-70" : undefined)}
                  >
                    {r.t}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 font-mono text-[10px]">
            <div>
              <dt className="text-muted-foreground">static, cached</dt>
              <dd style={{ color: STAT }}>viewBox, width, height, fill, cx, r</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">dynamic, recomputed</dt>
              <dd style={{ color: DYN }}>x, cy, the text content</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            The coloured strings are the only ones that change frame to frame. The macro hashes the rest at compile
            time and the renderer replays the painted path, so a static subtree is drawn once and reused, not rebuilt.
          </p>
        </div>
      </div>
    </figure>
  )
}
