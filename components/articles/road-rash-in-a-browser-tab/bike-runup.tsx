"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { BIKES } from "./data"

// Our re-run of roadrash.fun's bike model (see data.ts): every curve is computed from the site's own bike table, not
// measured in the game. Bikes are listed by price, the order the shop lists them in.
const W = 640
const H = 280
const L = 44
const R = 14
const T = 14
const B = 34
const SECS = 45
const MAXV = 180

const x = (s: number) => L + (s / SECS) * (W - L - R)
const y = (v: number) => H - B - (v / MAXV) * (H - T - B)

function path(series: number[]): string {
  let d = `M${x(0).toFixed(1)} ${y(0).toFixed(1)}`
  for (let i = 0; i < series.length; i++) d += ` L${x((i + 1) * 0.5).toFixed(1)} ${y(series[i]).toFixed(1)}`
  return d
}

export function BikeRunUp() {
  const [i, setI] = useState(0)
  const b = BIKES[i]
  const gap = b.terminal - b.top

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        our re-run of the site&apos;s bike model · flat dry road, throttle held · computed from its bike table, not measured in the game
      </div>
      <div className="px-4 pt-4">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">bike by price</span>
          <Range
            min={0}
            max={BIKES.length - 1}
            step={1}
            value={i}
            onChange={(e) => setI(Number(e.target.value))}
            aria-label="Bike, cheapest to dearest"
            className="w-full"
          />
          <span className="w-28 shrink-0 text-right font-mono tabular-nums">
            ${b.price.toLocaleString("en-US")}
          </span>
        </label>
      </div>
      <div className="px-2 pb-2 pt-3">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Speed against time for the bike priced at ${b.price} dollars: 0 to 60 mph in ${b.mph60} seconds, settling at ${b.terminal} mph.`}>
          {[0, 30, 60, 90, 120, 150, 180].map((v) => (
            <g key={v}>
              <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={L - 6} y={y(v) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {v}
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40].map((s) => (
            <text key={s} x={x(s)} y={H - B + 16} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {s}s
            </text>
          ))}
          {BIKES.map((o, k) =>
            k === i ? null : <path key={o.id} d={path(o.series)} fill="none" stroke="currentColor" strokeOpacity={0.14} strokeWidth={1} />
          )}
          <line x1={L} x2={W - R} y1={y(b.top)} y2={y(b.top)} stroke="oklch(0.62 0.15 30)" strokeDasharray="4 4" />
          <text x={W - R} y={y(b.top) - 5} textAnchor="end" fontSize={10} fill="oklch(0.62 0.15 30)" className="font-mono">
            table &quot;top&quot; {b.top.toFixed(1)}
          </text>
          <line x1={L} x2={W - R} y1={y(60)} y2={y(60)} stroke="currentColor" strokeOpacity={0.3} strokeDasharray="1 4" />
          <path d={path(b.series)} fill="none" stroke="oklch(0.60 0.16 255)" strokeWidth={2.2} />
          {b.shifts.map(([t, g]) => (
            <line key={g} x1={x(t)} x2={x(t)} y1={H - B} y2={H - B + 6} stroke="oklch(0.60 0.16 255)">
              <title>{`shift into gear ${g} at ${t.toFixed(1)} s`}</title>
            </line>
          ))}
        </svg>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 border-t px-4 py-3 font-mono text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">0 to 60 mph</dt>
          <dd className="tabular-nums">{b.mph60.toFixed(2)} s</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">0 to 100 mph</dt>
          <dd className="tabular-nums">{b.mph100 === null ? "never" : `${b.mph100.toFixed(2)} s`}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">settles at</dt>
          <dd className="tabular-nums">{b.terminal.toFixed(1)} mph</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">vs table &quot;top&quot;</dt>
          <dd className={cn("tabular-nums", Math.abs(gap) > 5 && "text-foreground font-semibold")}>
            {gap >= 0 ? "+" : ""}
            {gap.toFixed(1)} mph
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">power / weight</dt>
          <dd className="tabular-nums">
            {b.power} / {b.weight}
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">gears</dt>
          <dd className="tabular-nums">
            {b.gears}
            {b.nitro ? " + nitro" : ""}
          </dd>
        </div>
        <div className="col-span-2">
          <dt className="text-muted-foreground">shifts (s, to gear)</dt>
          <dd className="tabular-nums">{b.shifts.map(([t, g]) => `${t.toFixed(1)}→${g}`).join("  ")}</dd>
        </div>
      </dl>
      {b.id === 7 && (
        <p className="border-t px-4 py-2.5 text-xs text-muted-foreground">
          This bike never reaches its sixth gear. The table says it shifts up above 179.2 mph, but in fifth it settles at{" "}
          {b.terminal.toFixed(1)}, so the model stays there, {gap.toFixed(1)} mph above the table&apos;s {b.top.toFixed(1)}.
        </p>
      )}
    </figure>
  )
}
