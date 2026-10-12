"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import {
  DOMAINS,
  STATIONS,
  type DomainId,
  type StationId,
  type Status,
} from "@/components/articles/rsi-anything/data"

// The six-step loop from the paper's Figure 2, walked one station at a time,
// for each of the four benchmark domains. Each station is coloured by what the
// released code does for the headline number: live, partial (offline, weaker,
// or undocumented) or off. The round slider walks the domain's reported
// versions; the numbers are the paper's and the repository's, listed in data.ts.
// Node positions are fixed constants, so nothing here needs trigonometry.

const COLORS: Record<Status, string> = {
  live: "oklch(0.62 0.13 160)",
  partial: "oklch(0.74 0.14 75)",
  off: "oklch(0.62 0.19 25)",
}
const STATUS_TEXT: Record<Status, string> = {
  live: "does it",
  partial: "partly, offline, or not documented",
  off: "not in the headline run",
}

const W = 360
const H = 300
// a hexagon, clockwise from the top-left
const POS: [number, number][] = [
  [110, 46],
  [250, 46],
  [318, 150],
  [250, 254],
  [110, 254],
  [42, 150],
]

export function RsiLoop() {
  const [domainId, setDomainId] = useState<DomainId>("gui")
  const [station, setStation] = useState(0)
  const [round, setRound] = useState(0)

  const domain = DOMAINS.find((d) => d.id === domainId) ?? DOMAINS[0]
  const sid: StationId = STATIONS[station].id
  const note = domain.stations[sid]
  const r = Math.min(round, domain.rounds.length - 1)
  const current = domain.rounds[r]
  const maxV = 100

  const counts = { live: 0, partial: 0, off: 0 }
  for (const s of STATIONS) counts[domain.stations[s.id].status]++

  return (
    <div className="my-8 rounded-lg border bg-card p-4 sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-heading text-sm font-semibold">
          The loop, station by station, as the code runs it
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          {counts.live} live · {counts.partial} partial · {counts.off} off
        </div>
      </div>

      <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Domain">
        {DOMAINS.map((d) => (
          <button
            key={d.id}
            type="button"
            role="tab"
            aria-selected={d.id === domainId}
            onClick={() => {
              setDomainId(d.id)
              setRound(0)
            }}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (d.id === domainId
                ? "border-foreground bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-[minmax(0,360px)_1fr]">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[360px]"
          role="img"
          aria-label={`Six-station loop for ${domain.label}; current station ${STATIONS[station].label}`}
        >
          <defs>
            <marker id="rsi-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0 0 L10 5 L0 10 z" fill="currentColor" opacity={0.45} />
            </marker>
          </defs>
          {POS.map((p, i) => {
            const q = POS[(i + 1) % POS.length]
            const dx = q[0] - p[0]
            const dy = q[1] - p[1]
            const len = Math.sqrt(dx * dx + dy * dy)
            const ux = dx / len
            const uy = dy / len
            const pad = 38
            return (
              <line
                key={`e${i}`}
                x1={p[0] + ux * pad}
                y1={p[1] + uy * pad}
                x2={q[0] - ux * pad}
                y2={q[1] - uy * pad}
                stroke="currentColor"
                strokeOpacity={0.35}
                strokeWidth={1.5}
                strokeDasharray={i === 5 ? "4 3" : undefined}
                markerEnd="url(#rsi-arrow)"
              />
            )
          })}
          <text x={W / 2} y={H / 2 - 8} textAnchor="middle" fontSize={11} fill="currentColor" opacity={0.6}>
            {domain.label}
          </text>
          <text x={W / 2} y={H / 2 + 10} textAnchor="middle" fontSize={15} fontWeight={700} fill="currentColor">
            {current.label}
          </text>
          <text x={W / 2} y={H / 2 + 28} textAnchor="middle" fontSize={12} fill="currentColor" opacity={0.8}>
            {current.value.toFixed(2)}
            {domain.unit}
          </text>
          {STATIONS.map((s, i) => {
            const st = domain.stations[s.id].status
            const active = i === station
            return (
              <g
                key={s.id}
                onClick={() => setStation(i)}
                style={{ cursor: "pointer" }}
                role="button"
                aria-label={`${s.label}: ${STATUS_TEXT[st]}`}
              >
                <rect
                  x={POS[i][0] - 40}
                  y={POS[i][1] - 18}
                  width={80}
                  height={36}
                  rx={8}
                  fill={COLORS[st]}
                  fillOpacity={active ? 0.9 : 0.22}
                  stroke={COLORS[st]}
                  strokeWidth={active ? 2.5 : 1.5}
                />
                <text
                  x={POS[i][0]}
                  y={POS[i][1] + 4}
                  textAnchor="middle"
                  fontSize={12}
                  fontWeight={active ? 700 : 500}
                  fill={active ? "white" : "currentColor"}
                >
                  {s.label}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="flex flex-col gap-3 text-sm">
          <div className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs text-muted-foreground">
                {station + 1}/6 · {STATIONS[station].label}
              </span>
              <span
                className="rounded-full px-2 py-0.5 font-mono text-[11px]"
                style={{ background: COLORS[note.status], color: "white" }}
              >
                {note.status}
              </span>
            </div>
            <p className="mt-2 leading-relaxed">{note.text}</p>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => setStation((station + 5) % 6)}
              >
                ← back
              </button>
              <button
                type="button"
                className="rounded border px-2 py-1 text-xs hover:bg-muted"
                onClick={() => {
                  if (station === 5) setRound(Math.min(r + 1, domain.rounds.length - 1))
                  setStation((station + 1) % 6)
                }}
              >
                {station === 5 ? "next round →" : "next station →"}
              </button>
            </div>
          </div>

          <div className="rounded-md border border-dashed p-3">
            <div className="flex items-center justify-between font-mono text-xs text-muted-foreground">
              <span>{domain.metric}</span>
            </div>
            <Range
              min={0}
              max={domain.rounds.length - 1}
              step={1}
              value={r}
              onChange={(e) => setRound(Number(e.target.value))}
              className="mt-2 w-full"
              aria-label="Reported version"
            />
            <div className="mt-2 flex items-end gap-1" aria-hidden>
              {domain.rounds.map((x, i) => (
                <button
                  key={x.label}
                  type="button"
                  onClick={() => setRound(i)}
                  className="flex flex-1 flex-col items-center gap-1"
                  tabIndex={-1}
                >
                  <div className="flex h-16 w-full items-end">
                    <div
                      className="w-full rounded-t"
                      style={{
                        height: `${((x.value / maxV) * 100).toFixed(1)}%`,
                        background: i === r ? COLORS.live : "currentColor",
                        opacity: i === r ? 0.9 : 0.18,
                      }}
                    />
                  </div>
                  <span className="text-center text-[10px] leading-tight text-muted-foreground">{x.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs leading-relaxed">
              <span className="font-semibold">
                {current.label}: {current.value.toFixed(2)}
                {domain.unit}.
              </span>{" "}
              {current.changed}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
