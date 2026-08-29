"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// A build "fits" a Mac RAM tier when the tier's unified memory is at least the
// README's own stated "Min RAM" for that build -- nothing more elaborate than
// that comparison. RAM tiers are Apple's published unified-memory options
// across the current Mac lineup; 128 GB is the largest available anywhere,
// and it is only offered on the top M4 Max / M5 Max configuration -- the
// base and Pro-tier chips top out far lower. That context isn't in the
// README; the min-RAM numbers checked against it are.

const MAC_TIERS = [16, 18, 24, 32, 36, 48, 64, 96, 128] as const
const MAX_TIER = 128

const BUILDS = [
  { key: "2bit-lite", sizeGB: 102, minRamGB: 112 },
  { key: "2-bit", sizeGB: 145, minRamGB: 160 },
  { key: "3-bit", sizeGB: 184, minRamGB: 200 },
  { key: "4-bit", sizeGB: 204, minRamGB: 224 },
  { key: "6-bit", sizeGB: 296, minRamGB: 320 },
] as const

type Build = (typeof BUILDS)[number]

const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

export function MacFitChecker() {
  const [sel, setSel] = useState<Build["key"]>("2bit-lite")
  const build = BUILDS.find((b) => b.key === sel)!

  const fitCount = useMemo(
    () => BUILDS.reduce((n, b) => n + MAC_TIERS.filter((t) => t >= b.minRamGB).length, 0),
    [],
  )
  const totalCells = BUILDS.length * MAC_TIERS.length

  const fitsForSel = MAC_TIERS.filter((t) => t >= build.minRamGB)
  const shortfall = build.minRamGB - MAX_TIER

  const W = 700
  const LABEL_W = 150
  const COLS = MAC_TIERS.length
  const CELL_W = (W - LABEL_W - 10) / COLS
  const ROW_H = 26
  const H = BUILDS.length * ROW_H + 34

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">9 common Mac RAM tiers × 5 builds</span>
        <span className="font-mono text-[10px]" style={{ color: BAD }}>
          {fitCount} of {totalCells} combinations fit
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A grid of 5 builds by 9 Mac unified-memory tiers, from 16 gigabytes to 128 gigabytes. A cell is filled when the tier's memory is at least the build's minimum RAM requirement. Only one cell in the entire 45-cell grid is filled: the 128 gigabyte tier running 2bit-lite.`}
            </title>
            {MAC_TIERS.map((t, c) => (
              <text
                key={t}
                x={LABEL_W + c * CELL_W + CELL_W / 2}
                y={10}
                fontSize={8}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.5}
                fontFamily="ui-monospace, monospace"
              >
                {t}
              </text>
            ))}
            <text
              x={LABEL_W + COLS * CELL_W - 4}
              y={22}
              fontSize={7}
              textAnchor="end"
              fill="currentColor"
              fillOpacity={0.35}
              fontFamily="ui-monospace, monospace"
            >
              GB unified memory →
            </text>

            {BUILDS.map((b, r) => {
              const y = 26 + r * ROW_H
              const isSel = b.key === sel
              return (
                <g key={b.key} opacity={isSel ? 1 : 0.55}>
                  <text x={0} y={y + 14} fontSize={9} fill="currentColor" fillOpacity={0.9} fontFamily="ui-monospace, monospace">
                    {b.key}
                  </text>
                  <text x={0} y={y + 23} fontSize={7} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                    min {b.minRamGB} GB
                  </text>
                  {MAC_TIERS.map((t, c) => {
                    const fits = t >= b.minRamGB
                    return (
                      <rect
                        key={t}
                        x={LABEL_W + c * CELL_W + 1.5}
                        y={y}
                        width={CELL_W - 3}
                        height={20}
                        rx={3}
                        fill={fits ? GOOD : "currentColor"}
                        fillOpacity={fits ? (isSel ? 0.85 : 0.5) : 0.06}
                        stroke={isSel ? "currentColor" : "none"}
                        strokeOpacity={isSel ? 0.25 : 0}
                        strokeWidth={1}
                      />
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {BUILDS.map((b) => (
            <button
              key={b.key}
              type="button"
              onClick={() => setSel(b.key)}
              aria-pressed={sel === b.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === b.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {b.key}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "min RAM, this build", v: `${build.minRamGB} GB`, c: "currentColor" },
            { l: "of 9 tiers fit", v: `${fitsForSel.length}`, c: fitsForSel.length ? GOOD : BAD },
            {
              l: "vs. largest tier (128 GB)",
              v: shortfall > 0 ? `short by ${shortfall} GB` : "fits, with headroom",
              c: shortfall > 0 ? BAD : GOOD,
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Of the forty-five cells in this grid — five builds across nine memory tiers — exactly{" "}
          <span style={{ color: BAD }}>one</span> is a fit: the <span className="text-foreground">128 GB</span>{" "}
          tier running <span className="text-foreground">2bit-lite</span>. Regular 2-bit needs 160 GB,
          which no Mac configuration reaches — the 128 GB ceiling is short by 32 GB, and the gap only
          widens from there: 72 GB for 3-bit, 96 GB for 4-bit, 192 GB for 6-bit. 128 GB is also Apple&rsquo;s
          most expensive unified-memory tier, available only on the top M4 Max / M5 Max configuration —
          the base and Pro-tier chips this site&rsquo;s reader is more likely to actually own top out
          far lower.
        </p>
      </div>
    </figure>
  )
}
