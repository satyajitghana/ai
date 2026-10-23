"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { SAMPLES, STARLIGHT_GRADS, STARLIGHT_PATHS, type Grad } from "./data"

// An SVG anatomy explorer built from Ideogram's own files. The drawing on the
// left is Ideogram Vector's image-to-SVG output for the "Starlight" example on
// ideogram.ai/models/vector, path for path and stop for stop; only the
// gradient ids are prefixed so they cannot collide with anything else on the
// page. The corpus panel underneath is my measurement of all 40 sample SVGs on
// that page (fetched 2026-10-23), parsed with Python's ElementTree.

type View = "shipped" | "outlines" | "flat"

const VIEWS: { id: View; label: string; note: string }[] = [
  { id: "shipped", label: "as shipped", note: "The file as Ideogram serves it: 22 filled paths, no strokes, no <text>, no groups." },
  { id: "outlines", label: "outlines", note: "Every path drawn as a hairline. The letters are closed outlines, the same kind of shape as the stars." },
  { id: "flat", label: "gradients flattened", note: "Each gradient swapped for the average of its stops. This is roughly what a tracer that only emits flat fills has to approximate with bands." },
]

const PFX = "iv-star-"
const ACCENT = "oklch(0.66 0.17 330)"

function hexToRgb(h: string): [number, number, number] {
  const v = h.replace("#", "")
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)]
}

function meanStop(g: Grad): string {
  const s = g.stops.map(([, c]) => hexToRgb(c))
  const avg = [0, 1, 2].map((i) => Math.round(s.reduce((a, c) => a + c[i], 0) / s.length))
  return `rgb(${avg[0]}, ${avg[1]}, ${avg[2]})`
}

function gradOf(fill: string): Grad | undefined {
  const m = fill.match(/^url\(#(.+)\)$/)
  return m ? STARLIGHT_GRADS.find((g) => g.id === m[1]) : undefined
}

function fmtBytes(b: number): string {
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`
  if (b >= 1e4) return `${Math.round(b / 1000)} kB`
  return `${(b / 1000).toFixed(1)} kB`
}

export function SvgAnatomy() {
  const [view, setView] = useState<View>("shipped")
  const [sel, setSel] = useState(1)
  const [sampleId, setSampleId] = useState("0db91efc")

  const p = STARLIGHT_PATHS[sel]
  const g = gradOf(p.fill)
  const total = Object.values(p.cmds).reduce((a, b) => a + b, 0)
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0]

  const lo = mlog10(10)
  const hi = mlog10(20000)
  const xPct = (n: number) => Math.max(0, Math.min(100, ((mlog10(n) - lo) / (hi - lo)) * 100))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Ideogram Vector output · &ldquo;Starlight&rdquo; · 16,145 bytes
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">hover or step through the paths</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={view === v.id}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                view === v.id ? "border-foreground/40 bg-secondary text-foreground" : "text-muted-foreground hover:bg-muted/40",
              )}
            >
              {v.label}
            </button>
          ))}
        </div>
        <p className="mt-2 mb-3 text-xs leading-5 text-muted-foreground">{VIEWS.find((v) => v.id === view)!.note}</p>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,15rem)]">
          <svg
            viewBox="0 0 1024 1024"
            className="aspect-square w-full rounded-lg border bg-black"
            role="img"
            aria-label="Ideogram's Starlight SVG: cyan-to-pink script lettering with white stars on black"
          >
            <defs>
              {STARLIGHT_GRADS.map((gr) =>
                gr.type === "linear" ? (
                  <linearGradient key={gr.id} id={PFX + gr.id} {...gr.attrs}>
                    {gr.stops.map(([o, c], i) => (
                      <stop key={i} offset={o} stopColor={c} />
                    ))}
                  </linearGradient>
                ) : (
                  <radialGradient key={gr.id} id={PFX + gr.id} {...gr.attrs}>
                    {gr.stops.map(([o, c], i) => (
                      <stop key={i} offset={o} stopColor={c} />
                    ))}
                  </radialGradient>
                ),
              )}
            </defs>
            {STARLIGHT_PATHS.map((path, i) => {
              const gg = gradOf(path.fill)
              const fill =
                view === "outlines" ? "none" : gg ? (view === "flat" ? meanStop(gg) : `url(#${PFX}${gg.id})`) : path.fill
              const on = i === sel
              return (
                <path
                  key={i}
                  d={path.d}
                  fill={fill}
                  stroke={view === "outlines" ? (on ? ACCENT : "#9a9a9a") : on && i > 0 ? ACCENT : "none"}
                  strokeWidth={view === "outlines" ? (on ? 4 : 1.5) : 4}
                  opacity={view !== "outlines" && !on && i > 0 && sel > 0 ? 0.55 : 1}
                  onMouseEnter={() => setSel(i)}
                  onFocus={() => setSel(i)}
                />
              )
            })}
          </svg>

          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-md border px-2 py-0.5 font-mono text-[11px] hover:bg-muted/40"
                onClick={() => setSel((s) => (s + STARLIGHT_PATHS.length - 1) % STARLIGHT_PATHS.length)}
                aria-label="Previous path"
              >
                &larr;
              </button>
              <span className="font-mono text-[11px] tabular-nums">
                path {sel + 1} of {STARLIGHT_PATHS.length}
              </span>
              <button
                type="button"
                className="rounded-md border px-2 py-0.5 font-mono text-[11px] hover:bg-muted/40"
                onClick={() => setSel((s) => (s + 1) % STARLIGHT_PATHS.length)}
                aria-label="Next path"
              >
                &rarr;
              </button>
            </div>

            <div className="rounded-lg border bg-muted/20 p-2.5">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">fill</div>
              {g ? (
                <>
                  <div className="mt-1 font-mono text-[11px]">
                    {g.type}Gradient, {g.stops.length} stops
                  </div>
                  <div
                    className="mt-1.5 h-3 rounded-sm"
                    style={{
                      background: `linear-gradient(90deg, ${g.stops.map(([o, c]) => `${c} ${(o * 100).toFixed(1)}%`).join(", ")})`,
                    }}
                  />
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground tabular-nums">
                    offsets {g.stops.map(([o]) => o.toFixed(2)).join(" · ")}
                  </div>
                  {g.type === "radial" ? (
                    <div className="mt-1 text-[10px] leading-4 text-muted-foreground">
                      Elliptical: a rotate and a non-uniform scale in gradientTransform squash the circle.
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="mt-1 flex items-center gap-2 font-mono text-[11px]">
                  <span className="inline-block size-3 rounded-sm border" style={{ background: p.fill }} />
                  flat {p.fill}
                </div>
              )}
            </div>

            <div className="rounded-lg border bg-muted/20 p-2.5">
              <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                commands · {total}
              </div>
              <div className="mt-1.5 space-y-1">
                {(["M", "L", "Q", "C", "Z"] as const).map((k) => (
                  <div key={k} className="grid grid-cols-[1.5rem_1fr_2rem] items-center gap-1.5">
                    <span className="font-mono text-[11px]">{k}</span>
                    <div className="h-2 rounded-sm bg-muted/40">
                      <div
                        className="h-2 rounded-sm"
                        style={{ width: `${total ? ((p.cmds[k] ?? 0) / total) * 100 : 0}%`, background: ACCENT }}
                      />
                    </div>
                    <span className="text-right font-mono text-[10px] tabular-nums">{p.cmds[k] ?? 0}</span>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 mb-0 text-[10px] leading-4 text-muted-foreground">
                {p.cmds.M > 1
                  ? `${p.cmds.M} subpaths: a compound shape, holes cut by winding.`
                  : p.fill === "#090808" && sel > 0
                    ? "One closed subpath in the background colour, painted on top: this is a letter's counter, not a hole."
                    : "One closed subpath. Absolute coordinates, three decimals."}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-lg border bg-muted/20 px-3 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              All 40 sample files
            </span>
            <select
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              aria-label="Sample file"
              className="max-w-[60%] rounded-md border bg-background px-2 py-1 font-mono text-[11px]"
            >
              {SAMPLES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} · {s.paths} paths
                </option>
              ))}
            </select>
          </div>

          <div className="relative mt-3 h-10" aria-hidden>
            <div className="absolute top-5 right-0 left-0 h-px bg-border" />
            {SAMPLES.map((s) => (
              <button
                key={s.id}
                type="button"
                tabIndex={-1}
                onClick={() => setSampleId(s.id)}
                title={`${s.name}: ${s.paths} paths`}
                className="absolute top-5 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border"
                style={{
                  left: `${xPct(s.paths).toFixed(2)}%`,
                  background: s.id === sampleId ? ACCENT : s.source === "image" ? "transparent" : "var(--muted-foreground)",
                  borderColor: s.id === sampleId ? ACCENT : "var(--muted-foreground)",
                  opacity: s.id === sampleId ? 1 : 0.55,
                  zIndex: s.id === sampleId ? 2 : 1,
                }}
              />
            ))}
            <span className="absolute bottom-0 left-0 font-mono text-[9px] text-muted-foreground">10 paths</span>
            <span className="absolute bottom-0 left-1/2 -translate-x-1/2 font-mono text-[9px] text-muted-foreground">
              log scale
            </span>
            <span className="absolute right-0 bottom-0 font-mono text-[9px] text-muted-foreground">20,000</span>
          </div>

          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[11px] sm:grid-cols-4">
            {[
              ["mode", sample.source === "image" ? "image-to-SVG" : "gallery"],
              ["canvas", sample.viewBox.replace(/^0 0 /, "").replace(" ", " x ")],
              ["file", fmtBytes(sample.bytes)],
              ["paths", String(sample.paths)],
              ["gradients", `${sample.linear} lin · ${sample.radial} rad`],
              ["flat colours", String(sample.colours)],
              ["<text> nodes", String(sample.text)],
              ["strokes", String(sample.strokes)],
              ["commands", sample.cmds.toLocaleString("en-US")],
              ["cmds/path", `med ${sample.median} · max ${sample.max}`],
              ["circles/ellipses", String(sample.primitives)],
              ["writer", sample.serializer === "A" ? "compact, 2 dp" : "spaced, 3 dp"],
            ].map(([k, v]) => (
              <div key={k} className="min-w-0">
                <dt className="text-[9px] tracking-wider text-muted-foreground uppercase">{k}</dt>
                <dd className="m-0 truncate tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-2 mb-0 text-xs leading-5 text-muted-foreground">
            Filled dots are gallery samples, hollow ones the three image-to-SVG conversions. Not one of the 40
            files has a <code>&lt;text&gt;</code> element: every letter is an outline. Six files are written by a
            different serializer (two decimals, real circles and ellipses); the other 34 share one format. No file uses a stroke.
          </p>
        </div>
      </div>
    </figure>
  )
}
