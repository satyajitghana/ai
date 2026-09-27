"use client"

import { useState } from "react"

// Public items against sealed items, JevBench v1.4.2 (Benchmark Heaven, scored
// 24 Sept 2026). Every value is a row of that board as read on 2026-09-26: the
// accuracy on the 231 public items against the accuracy on the 308 sealed
// items, which v1.4 added. Seven rows, not 93: these are the rows extracted by
// hand, and the board's own median public-minus-sealed gap (45.8 points across
// 89 ranked systems) is quoted in the footer rather than drawn.
//
// The first view is what a release shows you: the public column alone. The
// second adds the sealed column. The point is the ordering: the public lead
// of XOR's JevBench row ("JevOne") over Jev inverts on sealed items, while the
// one frontier chat model in the set barely moves.
//
// Geometry is linear arithmetic on the values; no transcendental maths reaches
// the DOM, so server and client serialise identical coordinates.

const ACCENT = "oklch(0.72 0.15 195)"
const WARN = "oklch(0.68 0.17 35)"

type Row = {
  name: string
  note: string
  pub: number
  sealed: number
  jev?: boolean
  frontier?: boolean
}

const ROWS: Row[] = [
  { name: "GPT-6 Luna", note: "frontier chat model", pub: 99.6, sealed: 95.5, frontier: true },
  { name: "XOR (row: JevOne)", note: "Juspay, 35B", pub: 89.6, sealed: 33.8 },
  { name: "Cygnet", note: "Jev-class", pub: 87.9, sealed: 33.8 },
  { name: "Jev 1.13.0", note: "TypeSafe, closed", pub: 86.6, sealed: 36.7, jev: true },
  { name: "decider-4b v2", note: "board #1 overall", pub: 83.5, sealed: 34.7 },
  { name: "Open-Jev 9B", note: "Zefan Cai", pub: 77.5, sealed: 29.9 },
  { name: "Open-Jev 2B", note: "Zefan Cai", pub: 64.5, sealed: 26.3 },
]

const W = 680
const LABEL_W = 176
const X0 = LABEL_W + 8
const X1 = W - 24
const ROW_H = 34
const TOP = 34
const H = TOP + ROWS.length * ROW_H + 30

const x = (v: number) => X0 + (v / 100) * (X1 - X0)

type Sort = "public" | "sealed"

export function PublicSealed() {
  const [showSealed, setShowSealed] = useState(false)
  const [sort, setSort] = useState<Sort>("public")

  const key = showSealed ? sort : "public"
  const ordered = [...ROWS].sort((a, b) =>
    key === "public" ? b.pub - a.pub : b.sealed - a.sealed
  )

  // Rank among the decision models only: the frontier chat model is a
  // reference line, not a competitor for the "leads Jev" claim.
  const rankOf = (r: Row) => {
    if (r.frontier) return null
    const peers = ordered.filter((o) => !o.frontier)
    return peers.indexOf(r) + 1
  }

  const btn =
    "cursor-pointer rounded-md border px-3 py-1.5 font-mono text-[11px] transition-colors"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        JevBench v1.4.2 · accuracy on 231 public items vs 308 sealed items
      </div>
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => setShowSealed((v) => !v)}
          aria-pressed={showSealed}
          className={btn}
          style={
            showSealed
              ? { background: ACCENT, color: "var(--background)", borderColor: ACCENT }
              : undefined
          }
        >
          {showSealed ? "sealed tier: shown" : "add the sealed tier"}
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">sort by</span>
        {(["public", "sealed"] as Sort[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={s === "sealed" && !showSealed}
            onClick={() => setSort(s)}
            aria-pressed={key === s}
            className={`${btn} disabled:cursor-not-allowed disabled:opacity-40`}
            style={
              key === s
                ? { background: "var(--foreground)", color: "var(--background)" }
                : undefined
            }
          >
            {s}
          </button>
        ))}
      </div>
      <div className="p-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A dot chart of JevBench version 1.4.2 accuracy. On the 231 public items: GPT-6 Luna 99.6 percent, XOR's row JevOne 89.6, Cygnet 87.9, Jev 1.13.0 86.6, decider-4b v2 83.5, Open-Jev 9B 77.5 and Open-Jev 2B 64.5. On the 308 sealed items: GPT-6 Luna 95.5, Jev 36.7, decider-4b v2 34.7, Cygnet and XOR 33.8 each, Open-Jev 9B 29.9 and Open-Jev 2B 26.3. Every decision model falls by between 38 and 56 points; GPT-6 Luna falls by 4.1. XOR leads Jev by 3.0 points on public items and trails it by 2.9 on sealed items."
        >
          {[0, 25, 50, 75, 100].map((g) => (
            <g key={g}>
              <line
                x1={x(g)}
                y1={TOP - 12}
                x2={x(g)}
                y2={H - 24}
                stroke="var(--border)"
                strokeDasharray={g === 0 ? undefined : "2 5"}
              />
              <text
                x={x(g)}
                y={H - 10}
                textAnchor="middle"
                className="font-mono"
                fontSize="9"
                fill="currentColor"
                fillOpacity="0.45"
              >
                {g}%
              </text>
            </g>
          ))}

          <g className="font-mono" fontSize="9" fill="currentColor" fillOpacity="0.6">
            <text x={8} y={16}>
              system
            </text>
            <circle cx={X0 + 6} cy={13} r={4} fill="currentColor" fillOpacity="0.75" />
            <text x={X0 + 14} y={16}>
              public 231
            </text>
            {showSealed ? (
              <>
                <circle cx={X0 + 96} cy={13} r={4} fill={WARN} />
                <text x={X0 + 104} y={16}>
                  sealed 308
                </text>
              </>
            ) : null}
          </g>

          {ordered.map((r, i) => {
            const cy = TOP + i * ROW_H + ROW_H / 2
            const rank = rankOf(r)
            const gap = r.pub - r.sealed
            const strong = r.jev ? ACCENT : "currentColor"
            return (
              <g key={r.name}>
                {r.jev ? (
                  <rect
                    x={2}
                    y={cy - ROW_H / 2 + 2}
                    width={W - 4}
                    height={ROW_H - 4}
                    rx={4}
                    fill={ACCENT}
                    fillOpacity="0.08"
                  />
                ) : null}
                <text
                  x={8}
                  y={cy - 2}
                  className="font-mono"
                  fontSize="10.5"
                  fontWeight={r.jev ? 700 : 500}
                  fill={strong}
                >
                  {rank ? `#${rank} ` : ""}
                  {r.name}
                </text>
                <text
                  x={8}
                  y={cy + 10}
                  className="font-mono"
                  fontSize="8.5"
                  fill="currentColor"
                  fillOpacity="0.5"
                >
                  {r.note}
                </text>

                {showSealed ? (
                  <>
                    <line
                      x1={x(r.sealed)}
                      y1={cy}
                      x2={x(r.pub)}
                      y2={cy}
                      stroke="currentColor"
                      strokeOpacity="0.28"
                      strokeWidth={2}
                    />
                    <circle cx={x(r.sealed)} cy={cy} r={5} fill={WARN} />
                    <text
                      x={x(r.sealed) - 8}
                      y={cy + 3.5}
                      textAnchor="end"
                      className="font-mono"
                      fontSize="9"
                      fill={WARN}
                    >
                      {r.frontier
                        ? `${r.sealed.toFixed(1)} sealed · ${r.pub.toFixed(1)} public · −${gap.toFixed(1)}`
                        : r.sealed.toFixed(1)}
                    </text>
                    <text
                      x={(x(r.sealed) + x(r.pub)) / 2}
                      y={cy - 6}
                      textAnchor="middle"
                      className="font-mono"
                      fontSize="8.5"
                      fill="currentColor"
                      fillOpacity="0.55"
                    >
                      {gap < 10 ? "" : `−${gap.toFixed(1)}`}
                    </text>
                  </>
                ) : null}

                <circle
                  cx={x(r.pub)}
                  cy={cy}
                  r={5}
                  fill={r.jev ? ACCENT : "currentColor"}
                  fillOpacity={r.jev ? 1 : 0.75}
                />
                {showSealed && r.frontier ? null : (
                  <text
                    x={r.frontier ? x(r.pub) - 8 : x(r.pub) + 8}
                    y={cy + 3.5}
                    textAnchor={r.frontier ? "end" : "start"}
                    className="font-mono"
                    fontSize="9"
                    fill={strong}
                    fillOpacity={r.jev ? 1 : 0.8}
                  >
                    {r.pub.toFixed(1)}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        {showSealed
          ? "Every decision model loses 38 to 56 points on the sealed tier, Jev included; the board's median gap is 45.8 points across 89 ranked systems. The ordering is what moves: XOR is 3.0 points ahead of Jev on public items and 2.9 behind on sealed ones. GPT-6 Luna loses 4.1."
          : "This is the view a release gives you: public items only, where XOR's row sits 3.0 points above Jev. Add the sealed tier."}
      </figcaption>
    </figure>
  )
}
