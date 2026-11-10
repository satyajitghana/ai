"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { ROTSYNC, ROTSYNC_SETUP } from "./rotsync"

// What a certificate buys, on the smallest problem of XM4D's kind: rotation
// synchronisation over SO(3). Every number comes from the article's numpy toy
// (rotsync.ts says how it was produced); nothing is computed in the browser.

const W = 640
const H = 210
const PLOT = { x0: 46, y0: 18, w: 570, h: 150 }

export function CertifyToy() {
  const [k, setK] = useState(2)
  const row = ROTSYNC[k]
  const n = ROTSYNC.length
  const bw = PLOT.w / n
  const other = row.localRuns - row.localCertified - row.localStuck
  const rankEntries = Object.entries(row.rankNeeded)
  const lifted = rankEntries.filter(([r]) => r !== "3").reduce((s, [, c]) => s + c, 0)

  const desc = `Noise ${row.sigma} radians per axis. Of ${row.localRuns} local runs from random starts, ${
    row.localCertified
  } reached a point that passes the certificate and ${row.localStuck} stopped at a worse cost. The staircase certified ${
    row.sdpCertified
  } of ${row.problems} problems; ${row.tight} rounded back to rotations with no gap.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>local search vs the certified relaxation</span>
        <span className="text-muted-foreground/60">
          SO(3) toy · {ROTSYNC_SETUP.nodes} rotations, {ROTSYNC_SETUP.edges} edges · measured
        </span>
      </div>
      <div className="px-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={desc}>
          {[0, 0.5, 1].map((t) => (
            <g key={t}>
              <line
                x1={PLOT.x0}
                x2={PLOT.x0 + PLOT.w}
                y1={PLOT.y0 + PLOT.h * (1 - t)}
                y2={PLOT.y0 + PLOT.h * (1 - t)}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={PLOT.x0 - 6}
                y={PLOT.y0 + PLOT.h * (1 - t) + 4}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {ROTSYNC.map((r, i) => {
            const x = PLOT.x0 + i * bw + 6
            const w = bw - 12
            const fc = r.localCertified / r.localRuns
            const fs = r.localStuck / r.localRuns
            const hc = fc * PLOT.h
            const hs = fs * PLOT.h
            const sel = i === k
            return (
              <g key={r.sigma} onClick={() => setK(i)} className="cursor-pointer">
                <rect
                  x={x}
                  y={PLOT.y0 + PLOT.h - hc}
                  width={w}
                  height={hc}
                  fill="oklch(0.58 0.14 250)"
                  opacity={sel ? 1 : 0.45}
                />
                <rect
                  x={x}
                  y={PLOT.y0 + PLOT.h - hc - hs}
                  width={w}
                  height={hs}
                  fill="oklch(0.64 0.19 30)"
                  opacity={sel ? 1 : 0.45}
                />
                <text
                  x={x + w / 2}
                  y={PLOT.y0 + PLOT.h + 16}
                  textAnchor="middle"
                  className={cn("font-mono", sel ? "fill-foreground" : "fill-muted-foreground")}
                  fontSize={11}
                >
                  σ {r.sigma}
                </text>
              </g>
            )
          })}
          <text x={PLOT.x0} y={H - 6} className="fill-muted-foreground font-mono" fontSize={10}>
            share of local runs: blue reached a certified optimum, red stopped at a worse cost
          </text>
        </svg>
      </div>
      <div className="flex flex-wrap gap-2 px-4">
        {ROTSYNC.map((r, i) => (
          <button
            key={r.sigma}
            type="button"
            onClick={() => setK(i)}
            aria-pressed={i === k}
            className={cn(
              "rounded-full border px-3 py-1 font-mono text-[11px] transition-colors",
              i === k ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            σ = {r.sigma} rad
          </button>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 px-4 py-3 font-mono text-[12px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">local runs certified</dt>
          <dd>
            {row.localCertified} / {row.localRuns}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">stuck at a worse cost</dt>
          <dd>
            {row.localStuck}
            {other > 0 ? ` (+${other} unconverged)` : ""}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">staircase certified</dt>
          <dd>
            {row.sdpCertified} / {row.problems}, {lifted} needed rank above 3
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">relaxation tight</dt>
          <dd>
            {row.tight} / {row.problems}
          </dd>
        </div>
      </dl>
      <figcaption className="px-4 pb-4 text-sm text-muted-foreground">
        Each noise level is {row.problems} random problems, each solved from {ROTSYNC_SETUP.inits} random starts by plain
        Riemannian descent on SO(3), and once by a Burer–Monteiro staircase that lifts the rank until the dual certificate
        holds. &ldquo;Tight&rdquo; means the certified answer rounds back to true rotations at the same cost, so it is
        provably the global optimum. A toy of the idea, not XM4D&apos;s solver or its data.
      </figcaption>
    </figure>
  )
}
