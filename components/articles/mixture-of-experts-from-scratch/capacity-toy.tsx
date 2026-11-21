"use client"

import { useEffect, useMemo, useState } from "react"

import { cn } from "@/lib/utils"
import { mpow } from "@/lib/dmath"
import { Range } from "@/components/articles/ui/range"

import { layerCounts, loadRouting, type RoutingData } from "./routing-data"

// Capacity factor and dropped tokens. Every expert gets C = ceil(CF x T x k / E) slots for a
// batch of T tokens that each pick k of E experts. Assignments past an expert's C are
// dropped: that expert adds nothing for that token, and a token whose every choice overflows
// rides the residual connection unchanged.
//
// "toy" mode: 16 experts, a deterministic load profile that slides from even to Zipf-like
// skew, tokens filled in a fixed order. "Qwen3 layer" mode: the measured counts of one layer
// of Qwen3-30B-A3B (128 experts, top-8) scaled to a 1,024-token batch, i.e. that layer's
// average load profile. Real batches also fluctuate around it, so real drops are higher; the
// article quotes the per-batch numbers.

const OK = "oklch(0.62 0.14 250)"
const DROP = "oklch(0.62 0.2 25)"
const EMPTY = "var(--border)"

function toyLoads(E: number, T: number, k: number, skew: number): number[] {
  // Zipf-like profile with exponent `skew` (0 = even), shuffled by a fixed permutation
  const w = Array.from({ length: E }, (_, i) => 1 / mpow(i + 1, skew * 1.4))
  const order = Array.from({ length: E }, (_, i) => (i * 7 + 3) % E)
  const sum = w.reduce((a, b) => a + b, 0)
  const total = T * k
  const raw = order.map((i) => (w[i] / sum) * total)
  const out = raw.map((v) => Math.floor(v))
  let rest = total - out.reduce((a, b) => a + b, 0)
  const frac = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0])
  for (let j = 0; rest > 0; j++, rest--) out[frac[j % E][1]]++
  return out
}

function scaled(c: number[], T: number, k: number): number[] {
  const sum = c.reduce((a, b) => a + b, 0)
  return c.map((n) => (n / sum) * T * k)
}

export function CapacityToy() {
  const [mode, setMode] = useState<"toy" | "qwen">("toy")
  const [cf, setCf] = useState(1.25)
  const [skew, setSkew] = useState(0.6)
  const [k, setK] = useState(1)
  const [layer, setLayer] = useState(24)
  const [domain, setDomain] = useState("code")
  const [data, setData] = useState<RoutingData | null>(null)

  useEffect(() => {
    if (mode !== "qwen" || data) return
    let live = true
    loadRouting()
      .then((d) => live && setData(d))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [mode, data])

  const view = useMemo(() => {
    if (mode === "toy") {
      const E = 16
      const T = 64
      const loads = toyLoads(E, T, k, skew)
      return { E, T, k, loads }
    }
    if (!data) return null
    const T = 1024
    const c = layerCounts(data, domain, layer)
    return { E: data.experts, T, k: data.k, loads: scaled(c, T, data.k) }
  }, [mode, k, skew, data, domain, layer])

  const stats = useMemo(() => {
    if (!view) return null
    const C = Math.ceil((cf * view.T * view.k) / view.E)
    let dropped = 0
    let empty = 0
    for (const n of view.loads) {
      dropped += Math.max(0, n - C)
      empty += Math.max(0, C - n)
    }
    const total = view.T * view.k
    const need = Math.max(...view.loads) / (total / view.E)
    return { C, dropped: dropped / total, empty: empty / (C * view.E), need }
  }, [view, cf])

  const W = 640
  const H = 220
  const BASE = 196
  const TOP = 14

  let body = null
  if (view && stats) {
    const order = mode === "qwen" ? [...view.loads].sort((a, b) => b - a) : view.loads
    const maxV = Math.max(stats.C * 1.05, ...order)
    const bw = (W - 20) / view.E
    const y = (v: number) => BASE - (v / maxV) * (BASE - TOP)
    body = (
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Expert loads against a capacity of ${stats.C} slots; ${(stats.dropped * 100).toFixed(1)}% of assignments dropped.`}>
        {order.map((n, i) => {
          const x = 10 + i * bw
          const kept = Math.min(n, stats.C)
          return (
            <g key={i}>
              <rect x={x + bw * 0.12} y={y(stats.C)} width={bw * 0.76} height={BASE - y(stats.C)} fill="none" stroke={EMPTY} strokeWidth={view.E > 32 ? 0.4 : 1} />
              <rect x={x + bw * 0.12} y={y(kept)} width={bw * 0.76} height={BASE - y(kept)} fill={OK} opacity={0.85} />
              {n > stats.C && <rect x={x + bw * 0.12} y={y(n)} width={bw * 0.76} height={y(stats.C) - y(n)} fill={DROP} opacity={0.9} />}
            </g>
          )
        })}
        <line x1={6} x2={W - 6} y1={y(stats.C)} y2={y(stats.C)} stroke="var(--muted-foreground)" strokeDasharray="5 4" strokeWidth={1} />
        <text x={W - 8} y={y(stats.C) - 5} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
          capacity {stats.C} slots
        </text>
        <line x1={6} x2={W - 6} y1={BASE} y2={BASE} stroke="var(--border)" />
        <text x={10} y={BASE + 16} fontSize={10} className="fill-muted-foreground font-mono">
          {mode === "qwen" ? "128 experts, busiest first" : "16 experts"}
        </text>
      </svg>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">capacity factor and dropped tokens</span>
        <div className="flex gap-1">
          {(
            [
              ["toy", "toy"],
              ["qwen", "Qwen3 layer"],
            ] as const
          ).map(([v, label]) => (
            <button
              key={v}
              type="button"
              onClick={() => setMode(v)}
              aria-pressed={mode === v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === v ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 px-4 pt-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span>
            capacity factor <b className="text-foreground">{cf.toFixed(2)}</b>
          </span>
          <Range min={0.5} max={3} step={0.25} value={cf} onChange={(e) => setCf(Number(e.target.value))} />
        </label>
        {mode === "toy" ? (
          <>
            <label className="flex flex-col gap-1">
              <span>
                routing skew <b className="text-foreground">{skew.toFixed(2)}</b>
              </span>
              <Range min={0} max={1} step={0.05} value={skew} onChange={(e) => setSkew(Number(e.target.value))} />
            </label>
            <div className="flex items-center gap-2">
              experts per token
              {[1, 2].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setK(v)}
                  aria-pressed={k === v}
                  className={cn("cursor-pointer rounded px-2 py-0.5", k === v ? "bg-foreground text-background" : "bg-muted")}
                >
                  top-{v}
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <label className="flex flex-col gap-1">
              <span>
                layer <b className="text-foreground">{layer}</b>
              </span>
              <Range min={0} max={47} step={1} value={layer} onChange={(e) => setLayer(Number(e.target.value))} />
            </label>
            <div className="flex flex-wrap items-center gap-1">
              {["all", "code", "prose", "math", "latex"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDomain(d)}
                  aria-pressed={domain === d}
                  className={cn("cursor-pointer rounded px-2 py-0.5", domain === d ? "bg-foreground text-background" : "bg-muted")}
                >
                  {d}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="px-3 py-3 sm:px-4">
        {body ?? (
          <div className="flex items-center justify-center font-mono text-xs text-muted-foreground" style={{ height: 180 }}>
            loading measured routing counts
          </div>
        )}
        {stats && (
          <div className="mt-1 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>
              dropped <b style={{ color: DROP }}>{(stats.dropped * 100).toFixed(1)}%</b> of assignments
            </span>
            <span>
              empty slots <b className="text-foreground">{(stats.empty * 100).toFixed(1)}%</b>
            </span>
            <span>
              factor that drops nothing <b className="text-foreground">{stats.need.toFixed(2)}</b>
            </span>
          </div>
        )}
      </div>

      <p className="border-t px-4 py-3 text-sm leading-6 text-muted-foreground">
        {mode === "toy"
          ? "Slots are paid for whether they are filled or not. Raise the factor and drops fall while the empty, outlined slots grow; skew the routing and one expert overflows while the rest wait. The toy profile is invented."
          : "One measured layer's average load, scaled to a 1,024-token batch. A single batch fluctuates around this profile, so it drops more than the average does."}
      </p>
    </figure>
  )
}
