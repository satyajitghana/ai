"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { fmt, ROUTE, RULES, simulate, type Rule } from "./mixer-sim"

// An n-stream residual mixer: pick the number of streams, the depth, how far
// each sublayer's mixing matrix drifts from the identity, a systematic gain
// bias and the Sinkhorn iteration count, and watch the product of the mixing
// matrices explode, vanish or hold under four rules (plain, HC, mHC, xHC).
// The simulation and its assumptions are documented in ./mixer-sim.ts.

const W = 640
const H = 250
const L = 48
const R = 12
const T = 12
const B = 30
const YMIN = -3
const YMAX = 3

function Seg<V extends string | number>({
  value,
  options,
  onChange,
  label,
}: {
  value: V
  options: { v: V; label: string }[]
  onChange: (v: V) => void
  label: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={label}>
      <span className="mr-1 font-mono text-[11px] text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={String(o.v)}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o.v
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StreamMixer() {
  const [N, setN] = useState(16)
  const [depth, setDepth] = useState(64)
  const [drift, setDrift] = useState(0.15)
  const [bias, setBias] = useState(0)
  const [iters, setIters] = useState(20)
  const [seed, setSeed] = useState(1)
  const [view, setView] = useState<"fwd" | "bwd">("fwd")
  const [shown, setShown] = useState<Rule>("xhc")

  const tr = useMemo(() => simulate(N, depth, drift, bias, iters, seed), [N, depth, drift, bias, iters, seed])
  const [k] = ROUTE[N]

  const x = (l: number) => L + (l / depth) * (W - L - R)
  const y = (g: number) => {
    const lg = g > 0 && Number.isFinite(g) ? mlog10(g) : YMAX + 1
    const c = Math.min(YMAX, Math.max(YMIN, lg))
    return T + ((YMAX - c) / (YMAX - YMIN)) * (H - T - B)
  }
  const path = (vals: number[]) =>
    vals.map((g, l) => `${l === 0 ? "M" : "L"}${x(l).toFixed(1)},${y(g).toFixed(1)}`).join(" ")

  const series = (r: Rule) => (view === "fwd" ? tr[r].fwd : tr[r].bwd)
  const final = (r: Rule, v: "fwd" | "bwd") => tr[r][v][tr[r][v].length - 1]

  const mat = tr[shown].last
  const n = mat.length
  let maxAbs = 0
  for (const row of mat) for (const v of row) maxAbs = Math.max(maxAbs, Math.abs(v))
  const CELL = n <= 4 ? 30 : n <= 8 ? 18 : 11
  const HM = n * CELL

  const hcF = final("hc", "fwd")
  const summary = `After ${depth} sublayers with ${N} streams, the unconstrained HC product has forward gain ${fmt(hcF)}, mHC ${fmt(final("mhc", "fwd"))} forward and ${fmt(final("mhc", "bwd"))} backward, xHC ${fmt(final("xhc", "fwd"))} forward and ${fmt(final("xhc", "bwd"))} backward. A plain residual stays at 1.`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">residual mixing, compounded over depth</span>
        <span className="font-mono text-[10px] text-muted-foreground">toy: random matrices · not a trained model</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-col gap-2">
          <Seg
            label="streams N"
            value={N}
            onChange={setN}
            options={[2, 4, 8, 16].map((v) => ({ v, label: String(v) }))}
          />
          <Seg
            label="sublayers"
            value={depth}
            onChange={setDepth}
            options={[16, 32, 64].map((v) => ({ v, label: String(v) }))}
          />
          <Seg
            label="gain"
            value={view}
            onChange={setView}
            options={[
              { v: "fwd" as const, label: "forward (max row sum)" },
              { v: "bwd" as const, label: "backward (max column sum)" },
            ]}
          />
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>{summary}</title>
          {[-3, -2, -1, 0, 1, 2, 3].map((e) => {
            const yy = T + ((YMAX - e) / (YMAX - YMIN)) * (H - T - B)
            return (
              <g key={e}>
                <line
                  x1={L}
                  x2={W - R}
                  y1={yy}
                  y2={yy}
                  stroke="currentColor"
                  strokeOpacity={e === 0 ? 0.35 : 0.1}
                  strokeDasharray={e === 0 ? undefined : "2 3"}
                />
                <text
                  x={L - 6}
                  y={yy + 3}
                  fontSize={10}
                  textAnchor="end"
                  fill="currentColor"
                  fillOpacity={0.55}
                  fontFamily="ui-monospace, monospace"
                >
                  {["0.001", "0.01", "0.1", "1", "10", "100", "1000"][e + 3]}
                </text>
              </g>
            )
          })}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const l = Math.round(f * depth)
            return (
              <text
                key={f}
                x={x(l)}
                y={H - 10}
                fontSize={10}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.55}
                fontFamily="ui-monospace, monospace"
              >
                {l}
              </text>
            )
          })}
          {RULES.map((r) => (
            <path
              key={r.k}
              d={path(series(r.k))}
              fill="none"
              stroke={r.color}
              strokeWidth={r.k === shown ? 2.6 : 1.6}
              strokeOpacity={r.k === shown ? 1 : 0.75}
              strokeDasharray={r.k === "plain" ? "4 3" : undefined}
            />
          ))}
          {series("hc").some((g) => !(g <= 1000 && g >= 0.001)) ? (
            <text
              x={W - R}
              y={T + 10}
              fontSize={10}
              textAnchor="end"
              fill="oklch(0.62 0.2 28)"
              fontFamily="ui-monospace, monospace"
            >
              HC leaves the chart
            </text>
          ) : null}
        </svg>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {RULES.map((r) => (
            <button
              key={r.k}
              type="button"
              onClick={() => setShown(r.k)}
              aria-pressed={shown === r.k}
              className={cn(
                "inline-flex cursor-pointer items-center gap-1.5",
                shown === r.k ? "text-foreground" : "hover:text-foreground"
              )}
            >
              <span className="inline-block h-0.5 w-4" style={{ background: r.color }} /> {r.label}
            </button>
          ))}
          <span>· y axis is log scale · x axis is sublayer</span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px]">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="py-1 pr-3 font-normal">rule</th>
                  <th className="py-1 pr-3 font-normal">streams</th>
                  <th className="py-1 pr-3 font-normal">forward</th>
                  <th className="py-1 pr-3 font-normal">backward</th>
                  <th className="py-1 font-normal">self-share</th>
                </tr>
              </thead>
              <tbody>
                {RULES.map((r) => (
                  <tr key={r.k} className={cn("border-t", shown === r.k && "bg-muted/40")}>
                    <td className="py-1 pr-3" style={{ color: r.color }}>
                      {r.label}
                    </td>
                    <td className="py-1 pr-3">{r.k === "plain" ? "1" : r.k === "xhc" ? `${N} (${k} active)` : N}</td>
                    <td className="py-1 pr-3">{fmt(final(r.k, "fwd"))}</td>
                    <td className="py-1 pr-3">{fmt(final(r.k, "bwd"))}</td>
                    <td className="py-1">{r.k === "plain" ? "1" : r.k === "hc" ? "n/a" : fmt(tr[r.k].self)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
              Self-share is the average diagonal of the product: how much of each stream&apos;s own sublayer-0
              content it still holds at the top. It is only meaningful for a doubly stochastic product, where 1 means
              the streams never mixed and 1/N means every stream has become the average of all of them.
            </p>
          </div>
          <div className="flex flex-col items-center gap-1">
            <svg viewBox={`0 0 ${HM + 2} ${HM + 2}`} width={HM + 2} height={HM + 2} role="img">
              <title>{`The ${n} by ${n} product of every mixing matrix for ${RULES.find((r) => r.k === shown)?.label}. Row i is output stream i; column j is where its content came from at sublayer 0.`}</title>
              {mat.map((row, i) =>
                row.map((v, j) => (
                  <rect
                    key={`${i}-${j}`}
                    x={1 + j * CELL}
                    y={1 + i * CELL}
                    width={CELL - 1}
                    height={CELL - 1}
                    rx={1.5}
                    fill={v >= 0 ? "oklch(0.58 0.14 250)" : "oklch(0.62 0.2 28)"}
                    fillOpacity={maxAbs > 0 ? Math.max(0.04, Math.abs(v) / maxAbs) : 0.04}
                  />
                ))
              )}
            </svg>
            <span className="max-w-[190px] text-center font-mono text-[10px] text-muted-foreground">
              {RULES.find((r) => r.k === shown)?.label}: the product matrix at the top (blue positive, red
              negative; click a legend entry to switch)
            </span>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>drift from identity</span>
              <span className="text-foreground">{drift.toFixed(2)}</span>
            </span>
            <Range
              min={0}
              max={0.4}
              step={0.01}
              value={drift}
              onChange={(e) => setDrift(Number(e.target.value))}
              aria-label="Drift of each mixing matrix from the identity"
              className="mt-1.5 w-full"
            />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>row-sum bias per sublayer</span>
              <span className="text-foreground">{bias >= 0 ? "+" : ""}{bias.toFixed(2)}</span>
            </span>
            <Range
              min={-0.06}
              max={0.06}
              step={0.01}
              value={bias}
              onChange={(e) => setBias(Number(e.target.value))}
              aria-label="Systematic gain bias of each mixing matrix"
              className="mt-1.5 w-full"
            />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>Sinkhorn iterations</span>
              <span className="text-foreground">{iters}</span>
            </span>
            <Range
              min={1}
              max={20}
              step={1}
              value={iters}
              onChange={(e) => setIters(Number(e.target.value))}
              aria-label="Sinkhorn iterations for mHC and xHC"
              className="mt-1.5 w-full"
            />
          </label>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setSeed((s) => s + 1)}
            className="cursor-pointer rounded-full border px-3 py-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            new random draw
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">draw #{seed} · same draw for every rule</span>
        </div>
      </div>
    </figure>
  )
}
