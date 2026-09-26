"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What an extra verify row costs.
//
// Speculative decoding pays off only when a forward pass over R rows costs much
// less than R one-row passes. Every number here is a measured whole-model
// forward time from TensorFold's own recipe pages (docs/recipes/, commit
// d7470ed):
//
//   * Qwen3.8-27B, dense, M5 Max, its "lane" 4-bit matmul on the tensor units,
//     at 1/2/4/8/16 rows: 46.8 / 47.1 / 48.1 / 49.7 / 53.7 ms.
//   * The same model through MLX's own quantized matmul at the same row counts:
//     32.9 / 35.2 / 49.2 / 86.8 / 112.6 ms.
//   * Qwen3.8 Flash Next, a 512-expert MoE, M3 Ultra, 2k context, fused kernels
//     with the overheads removed, at 1/2/4/8 rows: 11.0 / 14.5 / 21.7 / 36.7 ms.
//     16 rows was not measured.
//
// The 27B times predate the pipelined graph build, which later took the one-row
// forward from 46.6 to 38.7 ms; the shape of the curve is the point.
//
// The reader picks a window width R and how many tokens T a pass commits, and
// the table turns the measured pass time into milliseconds per committed token.

const ROWS = [1, 2, 4, 8, 16] as const

type Series = {
  key: string
  label: string
  sub: string
  ms: (number | null)[]
  color: string
  dash?: string
}

const LANE = "oklch(0.55 0.16 250)"
const MLX = "oklch(0.62 0.03 250)"
const MOE = "oklch(0.60 0.16 45)"

const SERIES: Series[] = [
  {
    key: "lane",
    label: "27B · lane matmul",
    sub: "dense, M5 Max",
    ms: [46.8, 47.1, 48.1, 49.7, 53.7],
    color: LANE,
  },
  {
    key: "mlx",
    label: "27B · MLX matmul",
    sub: "dense, M5 Max",
    ms: [32.9, 35.2, 49.2, 86.8, 112.6],
    color: MLX,
    dash: "5 4",
  },
  {
    key: "moe",
    label: "Flash Next · fused",
    sub: "MoE, M3 Ultra, 2k",
    ms: [11.0, 14.5, 21.7, 36.7, null],
    color: MOE,
  },
]

const W = 760
const H = 330
const L = 56
const R = 190
const T = 24
const B = 48
const PW = W - L - R
const PH = H - T - B
const Y_MAX = 120

const px = (i: number) => L + (i / (ROWS.length - 1)) * PW
const py = (v: number) => T + PH - (v / Y_MAX) * PH

export function RowCost() {
  const [rowIdx, setRowIdx] = useState(4)
  const [commit, setCommit] = useState(5)

  const rows = ROWS[rowIdx]
  const t = Math.min(commit, rows)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One forward pass, 1 to 16 rows · measured, TensorFold recipe pages
      </div>

      <div className="px-2 pt-4 sm:px-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Whole-model forward time in milliseconds against the number of rows verified in one pass, on a doubling axis from 1 to 16. TensorFold's lane matmul on Qwen3.8-27B stays nearly flat, 46.8 milliseconds at one row and 53.7 at sixteen. MLX's own quantized matmul on the same model starts lower at 32.9 milliseconds but climbs to 112.6 at sixteen rows. Qwen3.8 Flash Next, a mixture of experts on an M3 Ultra, goes from 11.0 milliseconds at one row to 36.7 at eight, because each extra row routes to experts of its own."
        >
          <defs>
            <filter id="rc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {[0, 20, 40, 60, 80, 100, 120].map((v) => (
            <g key={v}>
              <line
                x1={L}
                y1={py(v)}
                x2={L + PW}
                y2={py(v)}
                stroke="var(--border)"
                strokeWidth={1}
                strokeDasharray={v === 0 ? undefined : "2 4"}
              />
              <text
                x={L - 8}
                y={py(v) + 3.5}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                fontSize={10}
              >
                {v}
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => (
            <g key={r}>
              <line
                x1={px(i)}
                y1={py(0)}
                x2={px(i)}
                y2={py(0) + 4}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={px(i)}
                y={py(0) + 17}
                textAnchor="middle"
                className={cn(
                  "font-mono",
                  i === rowIdx ? "fill-foreground" : "fill-muted-foreground"
                )}
                fontSize={10}
              >
                {r}
              </text>
            </g>
          ))}
          <text
            x={L + PW / 2}
            y={H - 8}
            textAnchor="middle"
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            rows verified in one pass
          </text>
          <text
            x={L - 38}
            y={T + PH / 2}
            textAnchor="middle"
            transform={`rotate(-90 ${L - 38} ${T + PH / 2})`}
            className="fill-muted-foreground font-mono"
            fontSize={10}
          >
            forward ms
          </text>

          <line
            x1={px(rowIdx)}
            y1={py(0)}
            x2={px(rowIdx)}
            y2={T}
            stroke="var(--muted-foreground)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />

          {SERIES.map((s) => {
            const pts = s.ms
              .map((v, i) => (v == null ? null : `${px(i)},${py(v)}`))
              .filter((p): p is string => p !== null)
            const lastIdx = s.ms.reduce<number>((acc, v, i) => (v == null ? acc : i), 0)
            const lastV = s.ms[lastIdx] as number
            return (
              <g key={s.key}>
                <polyline
                  points={pts.join(" ")}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dash}
                  strokeLinejoin="round"
                />
                {s.ms.map((v, i) =>
                  v == null ? null : (
                    <circle
                      key={i}
                      cx={px(i)}
                      cy={py(v)}
                      r={i === rowIdx ? 5.5 : 3.5}
                      fill="var(--background)"
                      stroke={s.color}
                      strokeWidth={2}
                      filter={i === rowIdx ? "url(#rc-soft)" : undefined}
                    />
                  )
                )}
                {/* A series that stops short of 16 rows is labelled beside its
                    last point, below the line, so the label sits with its data. */}
                <text
                  x={px(lastIdx) + 12}
                  y={py(lastV) + (lastIdx < ROWS.length - 1 ? 18 : s.key === "lane" ? -4 : 3.5)}
                  className="fill-foreground font-mono"
                  fontSize={10.5}
                >
                  {s.label}
                </text>
                <text
                  x={px(lastIdx) + 12}
                  y={py(lastV) + (lastIdx < ROWS.length - 1 ? 30 : s.key === "lane" ? 8 : 15.5)}
                  className="fill-muted-foreground font-mono"
                  fontSize={9}
                >
                  {s.sub}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-3 border-t px-4 py-3 sm:grid-cols-2">
        <div className="text-xs">
          <div className="mb-1.5 font-mono text-muted-foreground">rows in the pass</div>
          <div className="flex flex-wrap gap-1.5">
            {ROWS.map((r, i) => (
              <button
                key={r}
                type="button"
                onClick={() => setRowIdx(i)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  i === rowIdx
                    ? "border-foreground/40 bg-muted text-foreground"
                    : "text-muted-foreground hover:bg-muted"
                )}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
        <label className="flex flex-col gap-1.5 text-xs">
          <span className="font-mono text-muted-foreground">
            tokens the pass commits: {t.toFixed(1)}
            {commit > rows ? ` (capped at ${rows} rows)` : ""}
          </span>
          <input
            type="range"
            min={1}
            max={8}
            step={0.1}
            value={commit}
            onChange={(e) => setCommit(Number(e.target.value))}
            className="h-1 w-full cursor-pointer appearance-none rounded-full bg-border accent-foreground"
            aria-label="Tokens committed per pass"
          />
        </label>
      </div>

      <div className="border-t">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b text-muted-foreground">
              <th className="px-4 py-1.5 text-left font-mono font-normal">path</th>
              <th className="px-3 py-1.5 text-right font-mono font-normal">pass ms</th>
              <th className="px-3 py-1.5 text-right font-mono font-normal">ms / token</th>
              <th className="px-4 py-1.5 text-right font-mono font-normal">vs one row</th>
            </tr>
          </thead>
          <tbody>
            {SERIES.map((s) => {
              const pass = s.ms[rowIdx]
              const one = s.ms[0] as number
              if (pass == null) {
                return (
                  <tr key={s.key} className="border-b last:border-0">
                    <td className="px-4 py-1.5 font-mono">{s.label}</td>
                    <td
                      colSpan={3}
                      className="px-4 py-1.5 text-right font-mono text-muted-foreground"
                    >
                      not measured at {rows} rows
                    </td>
                  </tr>
                )
              }
              const perTok = pass / t
              const speed = one / perTok
              return (
                <tr key={s.key} className="border-b last:border-0">
                  <td className="px-4 py-1.5 font-mono">{s.label}</td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {pass.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums">
                    {perTok.toFixed(1)}
                  </td>
                  <td
                    className="px-4 py-1.5 text-right font-mono tabular-nums"
                    style={{ color: speed < 1 ? "oklch(0.58 0.19 28)" : undefined }}
                  >
                    {speed.toFixed(2)}×
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
          &ldquo;vs one row&rdquo; is the speed of the drafted pass against that same path
          decoding one token per pass. Committed tokens are an input here, not a
          measurement.
        </p>
      </div>
    </figure>
  )
}
