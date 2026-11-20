"use client"

// What a pixel threshold buys on a real asset, from three-nanite's own measurements: the
// crate (1.85M source triangles, 2 m, 1080p, 60 degree field of view) at eight distances,
// from docs/REPORT.md's "One prop" table. The screen height uses REPORT's companion figure,
// 765 px at 3 m (RESEARCH.md), scaled as 1 / distance. Triangles per pixel is drawn
// triangles over the crate's bounding square on screen; the cost uses REPORT's integrated
// GPU figure of about 8 ms per million drawn triangles.

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

const DIST = [1.5, 3, 6, 12, 25, 50, 100, 200]
const MODES = [
  { id: "1", label: "DAG 1 px", tris: [280e3, 204e3, 129e3, 91e3, 77e3, 58e3, 35e3, 12e3] },
  { id: "2", label: "DAG 2 px", tris: [195e3, 141e3, 93e3, 77e3, 59e3, 35e3, 12e3, 5.2e3] },
  { id: "4", label: "DAG 4 px", tris: [143e3, 98e3, 79e3, 63e3, 35e3, 14e3, 5.2e3, 5.2e3] },
  { id: "lod", label: "discrete LOD 1 px", tris: [462e3, 462e3, 116e3, 116e3, 29e3, 29e3, 6.8e3, 6.8e3] },
] as const
const SOURCE = 1.85e6
const H_AT_3M = 765

const fmtK = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k` : `${Math.round(n)}`)
// bar length on a log axis from 1k to 2M triangles
const LO = 3, HI = mlog10(2e6)
const bar = (n: number) => Math.min(1, Math.max(0.02, (mlog10(n) - LO) / (HI - LO)))

export function CrateTable() {
  const [mode, setMode] = useState(0)
  const [row, setRow] = useState(6)
  const m = MODES[mode]
  const d = DIST[row]
  const h = (H_AT_3M * 3) / d
  const px = h * h
  const tris = m.tris[row]
  const tpp = tris / px

  return (
    <figure className="not-prose my-8 rounded-xl border">
      <div className="flex flex-wrap gap-1 border-b px-3 py-2.5 font-mono text-xs" role="group" aria-label="Selection mode">
        {MODES.map((x, i) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={mode === i}
            onClick={() => setMode(i)}
            className={`rounded-md border px-2.5 py-1 transition-colors ${mode === i ? "bg-foreground text-background" : "hover:bg-muted"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-3 py-3 sm:grid-cols-[1fr_15rem] sm:px-4">
        <div className="flex flex-col gap-1" role="listbox" aria-label="Camera distance">
          {DIST.map((dist, i) => {
            const n = m.tris[i]
            const hh = (H_AT_3M * 3) / dist
            const sel = i === row
            return (
              <button
                key={dist}
                type="button"
                role="option"
                aria-selected={sel}
                onClick={() => setRow(i)}
                className={`grid grid-cols-[3.2rem_1fr_3.6rem] items-center gap-2 rounded-md px-1.5 py-1 text-left font-mono text-xs transition-colors hover:bg-muted ${sel ? "bg-muted" : ""}`}
              >
                <span className="text-muted-foreground">{dist} m</span>
                <span className="relative h-3.5 rounded-sm bg-muted-foreground/10">
                  <span className={`absolute inset-y-0 left-0 rounded-sm ${sel ? "bg-foreground" : "bg-foreground/45"}`} style={{ width: `${(bar(n) * 100).toFixed(1)}%` }} />
                  <span className="absolute inset-y-0 rounded-sm border-r-2 border-amber-500" style={{ left: 0, width: `${(bar(Math.max(1001, hh * hh)) * 100).toFixed(1)}%` }} />
                </span>
                <span className="text-right">{fmtK(n)}</span>
              </button>
            )
          })}
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            bar: triangles drawn (log scale, 1k to 2M) · <span className="text-amber-600 dark:text-amber-400">|</span> pixels the crate covers
          </p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] content-start gap-x-3 gap-y-1.5 rounded-lg bg-muted/50 p-3 font-mono text-xs">
          <dt className="text-muted-foreground">distance</dt>
          <dd>{d} m</dd>
          <dt className="text-muted-foreground">on screen</dt>
          <dd>about {Math.round(h)} px tall</dd>
          <dt className="text-muted-foreground">pixels</dt>
          <dd>about {fmtK(px)}</dd>
          <dt className="text-muted-foreground">drawn</dt>
          <dd>
            {fmtK(tris)} of {fmtK(SOURCE)}
          </dd>
          <dt className="text-muted-foreground">per pixel</dt>
          <dd className={tpp > 1 ? "font-semibold text-red-600 dark:text-red-400" : ""}>{tpp >= 10 ? Math.round(tpp) : tpp.toFixed(2)} triangles</dd>
          <dt className="text-muted-foreground">iGPU cost</dt>
          <dd>about {((tris / 1e6) * 8).toFixed(2)} ms</dd>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        One crate of 1.85M triangles at eight distances, from three-nanite&apos;s REPORT.md. Pixels are the crate&apos;s bounding square,
        scaled from the report&apos;s 765 px at 3 m; cost is the report&apos;s integrated-GPU rate of about 8 ms per million triangles. From 12 m
        out, every mode draws more triangles than the crate covers pixels, and a hardware rasteriser pays for each of them.
      </figcaption>
    </figure>
  )
}
