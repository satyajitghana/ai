"use client"

import { useState } from "react"

// The economic argument, made draggable. Calling a big model's API costs something on
// every input. PAW pays a one-time compile (one call to a 4B compiler) and then runs
// the compiled adapter locally for ~free per application. So cumulative cost crosses
// over fast: after a handful of calls, "compile once, run local" wins and the gap only
// widens. Drag the number of calls and watch the two curves separate. Costs are in
// relative units (illustrative) — the shape, not the exact price, is the point.

const INDIGO = "oklch(0.55 0.17 275)"
const GRAY = "oklch(0.62 0.03 260)"

const A_CALL = 1 // cost per API call (relative unit)
const COMPILE = 8 // one-time PAW compile (one 4B-compiler call)
const P_CALL = 0.02 // local per-call cost (~electricity)

const MAXN = 100
const W = 640
const H = 260
const PL = 40
const PB = 28
const PT = 14
const PR = 12

export function CostCrossover() {
  const [n, setN] = useState(40)

  const apiAt = (k: number) => k * A_CALL
  const pawAt = (k: number) => COMPILE + k * P_CALL
  const yMax = apiAt(MAXN)
  const x = (k: number) => PL + (k / MAXN) * (W - PL - PR)
  const y = (c: number) => PT + (1 - c / yMax) * (H - PT - PB)

  const crossover = COMPILE / (A_CALL - P_CALL) // ≈ 8.2 calls
  const api = apiAt(n)
  const paw = pawAt(n)
  const ratio = paw > 0 ? api / paw : 0

  const path = (f: (k: number) => number) =>
    Array.from({ length: MAXN + 1 }, (_, k) => `${k === 0 ? "M" : "L"} ${x(k).toFixed(1)} ${y(f(k)).toFixed(1)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>cost to run a fuzzy function N times</span>
        <span className="text-muted-foreground/60">relative units · illustrative</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">calls so far</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{n}</div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: GRAY }}>call the 32B API</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GRAY }}>{api.toFixed(0)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: INDIGO }}>compile once, run local</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: INDIGO }}>{paw.toFixed(1)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">PAW is</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{ratio >= 1 ? `${ratio.toFixed(1)}×` : `${(1 / ratio).toFixed(1)}×`}<span className="text-xs text-muted-foreground">{ratio >= 1 ? " cheaper" : " pricier"}</span></div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${n} calls, the API costs ${api.toFixed(0)} versus ${paw.toFixed(1)} for compile-once-run-local`}>
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={PL} x2={W - PR} y1={y(g * yMax)} y2={y(g * yMax)} stroke="currentColor" className="text-border" strokeWidth={1} />
          ))}
          {/* crossover marker */}
          <line x1={x(crossover)} x2={x(crossover)} y1={PT} y2={H - PB} stroke="currentColor" className="text-border" strokeDasharray="3 3" strokeWidth={1} />
          <text x={x(crossover) + 4} y={PT + 10} className="fill-muted-foreground font-mono" fontSize={9}>break-even ≈ {crossover.toFixed(0)} calls</text>

          {/* filled gap up to n */}
          <path d={`${path(apiAt).split(" L ").slice(0, n + 1).join(" L ")} L ${x(n)} ${y(pawAt(n))} ${Array.from({ length: n + 1 }, (_, k) => `L ${x(n - k)} ${y(pawAt(n - k))}`).join(" ")} Z`} fill={INDIGO} opacity={0.08} />

          <path d={path(apiAt)} fill="none" stroke={GRAY} strokeWidth={2.5} strokeLinecap="round" />
          <path d={path(pawAt)} fill="none" stroke={INDIGO} strokeWidth={2.5} strokeLinecap="round" />

          {/* current markers */}
          <circle cx={x(n)} cy={y(api)} r={4} fill={GRAY} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={x(n)} cy={y(paw)} r={4} fill={INDIGO} stroke="var(--background)" strokeWidth={1.5} />
          <line x1={x(n)} x2={x(n)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/20" strokeWidth={1} />

          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>number of times the function is applied →</text>
        </svg>

        <label className="mt-1 block">
          <span className="sr-only">number of calls</span>
          <input type="range" min={1} max={MAXN} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.55_0.17_275)]" />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The API bill grows with every input. PAW pays once to <span style={{ color: INDIGO }}>compile</span> the
          function, then each application is nearly free — so the lines cross within the first handful of calls and the
          gap only widens. That&apos;s the shift from <span className="text-foreground">per-input problem solver</span> to{" "}
          <span className="text-foreground">tool builder</span>.
        </p>
      </div>
    </figure>
  )
}
