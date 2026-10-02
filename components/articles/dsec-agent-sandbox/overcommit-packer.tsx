"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// DSec — overcommit packing, drawn as the host's CPU budget.
//
// The paper's one published anchor: ~90% of both container and microVM sandboxes
// use no more than 5% of their *requested* CPU on average (Figure 5). Memory, by
// contrast, must stay resident. So CPU is almost all idle, which is the slack
// overcommit reclaims. DeepSeek's Zhihu writeup reports an overcommit ratio past
// 50x; the arXiv report does not print a single ratio — it gives the utilization
// distribution and per-node stable counts instead.
//
// The model here is deliberately simple and labelled illustrative: a host is 100
// CPU-% units. Place `ratio`x a host's worth of requests on it; if each sandbox
// draws `draw`% of its request on average, the host actually burns ratio*draw
// percent. Overcommit has headroom while that stays under 100. The exact mean
// draw is NOT published — only that ~90% stay under 5% — so `draw` is a dial, not
// a measurement. Arithmetic is integer/rational only (no transcendentals), so
// server and client serialize identical SVG.

const ACCENT = "oklch(0.62 0.17 28)" // charcoal-ember red, matches the film
const COLS = 10
const ROWS = 10

export function OvercommitPacker() {
  const [ratio, setRatio] = useState(50) // overcommit multiple, 1x..50x
  const [drawTenths, setDrawTenths] = useState(15) // mean draw per sandbox, 0.1% units -> 1.5%

  const draw = drawTenths / 10 // percent of each request actually used, on average
  const util = (ratio * drawTenths) / 10 // host CPU actually burned, percent
  const lit = Math.min(100, Math.round(util))
  const over = Math.max(0, util - 100)
  const headroom = Math.floor(100 / draw) // max ratio before the host saturates, at this draw
  const contended = util > 100

  // baseline: no overcommit (1x) burns exactly `draw`% — the host sits idle.
  const baseUtil = draw

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one host · 100 CPU-% units · requests packed {ratio}x over capacity</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="grid gap-5 p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)] sm:p-4">
        {/* the host grid: 100 cells = the host's CPU budget */}
        <div>
          <svg
            viewBox="0 0 320 300"
            className="w-full"
            role="img"
            aria-label={`A host of 100 CPU-percent cells. At ${ratio} times overcommit with each sandbox drawing ${draw} percent of its request on average, the host actually burns ${util.toFixed(1)} percent, lighting ${lit} cells${contended ? `, and is oversubscribed by ${over.toFixed(0)} percent` : ""}.`}
          >
            <defs>
              <filter id="op-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="0.6" stdDeviation="1" floodOpacity="0.12" />
              </filter>
            </defs>
            <text x={4} y={14} className="fill-muted-foreground font-mono" fontSize={11}>
              host CPU budget (100%)
            </text>
            {Array.from({ length: ROWS * COLS }).map((_, i) => {
              const r = Math.floor(i / COLS)
              const c = i % COLS
              // fill cells bottom-up so "drawing" reads as a rising level
              const cellIndex = (ROWS - 1 - r) * COLS + c
              const on = cellIndex < lit
              const x = 8 + c * 30
              const y = 24 + r * 26
              return (
                <rect
                  key={i}
                  x={x}
                  y={y}
                  width={24}
                  height={20}
                  rx={3.5}
                  fill={on ? ACCENT : "var(--muted)"}
                  stroke={on ? ACCENT : "var(--border)"}
                  strokeWidth={1}
                  opacity={on ? 0.92 : 0.5}
                  filter={on ? "url(#op-soft)" : undefined}
                  className="transition-all duration-200"
                />
              )
            })}
          </svg>
          <p className="mt-1 font-mono text-[11px] text-muted-foreground">
            lit = CPU actually drawn ·{" "}
            <span style={{ color: contended ? ACCENT : undefined }}>
              {contended ? `oversubscribed +${over.toFixed(0)}%` : `${(100 - util).toFixed(0)}% idle headroom`}
            </span>
          </p>
        </div>

        {/* readouts + controls */}
        <div className="flex flex-col justify-center gap-4">
          <div className="grid grid-cols-2 gap-3">
            <Stat label="requests promised" value={`${ratio}x`} sub="a host's worth, each" />
            <Stat
              label="host CPU drawn"
              value={`${util.toFixed(1)}%`}
              sub={contended ? "contended" : "fits, with slack"}
              hot={contended}
            />
          </div>

          <div className="space-y-3 rounded-lg border bg-background/40 p-3">
            <label className="block">
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>overcommit ratio</span>
                <span className="text-foreground">{ratio}x</span>
              </div>
              <Range
                min={1}
                max={50}
                step={1}
                value={ratio}
                accent={ACCENT}
                onChange={(e) => setRatio(Number(e.target.value))}
                aria-label="overcommit ratio"
              />
            </label>
            <label className="block">
              <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
                <span>mean draw per sandbox</span>
                <span className="text-foreground">{draw.toFixed(1)}%</span>
              </div>
              <Range
                min={5}
                max={100}
                step={1}
                value={drawTenths}
                accent={ACCENT}
                onChange={(e) => setDrawTenths(Number(e.target.value))}
                aria-label="mean draw per sandbox, percent of its request"
              />
            </label>
          </div>

          <p className="text-sm leading-6 text-muted-foreground">
            {contended ? (
              <>
                At <span className="text-foreground">{draw.toFixed(1)}%</span> mean draw, the host
                saturates past <span className="text-foreground">{headroom}x</span>. Beyond that,
                CPU scheduling decides who waits.
              </>
            ) : (
              <>
                At <span className="text-foreground">{draw.toFixed(1)}%</span> mean draw you can
                promise about <span className="text-foreground">{headroom}x</span> the host before
                it saturates on average. No overcommit (1x) would burn{" "}
                <span className="text-foreground">{baseUtil.toFixed(1)}%</span> and leave the rest
                idle while memory stays resident.
              </>
            )}
          </p>
        </div>
      </div>

      <p className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Illustrative. The report publishes the utilization distribution (~90% of sandboxes under 5%
        of requested CPU, Figure 5) and stable per-node counts, not a mean draw or a single
        overcommit ratio; the 50x figure is from DeepSeek&apos;s Zhihu writeup. The dial shows the
        precondition, not a measurement: overcommit buys headroom only while ratio x mean-draw stays
        under the host.
      </p>
    </figure>
  )
}

function Stat({
  label,
  value,
  sub,
  hot,
}: {
  label: string
  value: string
  sub: string
  hot?: boolean
}) {
  return (
    <div className="rounded-lg border bg-background/40 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn("font-mono text-xl font-semibold tabular-nums")}
        style={hot ? { color: ACCENT } : undefined}
      >
        {value}
      </div>
      <div className="font-mono text-[10px] text-muted-foreground">{sub}</div>
    </div>
  )
}
