import { cn } from "@/lib/utils"

// Horizontal benchmark bar chart for explainers. Data comes from MDX:
//   <BenchBars title="SWE-Bench Pro" unit="%" bars={[{label, value, highlight}]} />
// The highlighted bar (the model under discussion) gets the accent colour; the
// rest stay muted, so the comparison reads at a glance. Server-rendered, zero JS —
// degrades perfectly for agents, print, and no-JS readers. Now with a nice tick
// scale, vertical gridlines, and a baseline axis so values are readable, not just
// relative.

// "Nice" axis maximum + evenly spaced ticks (1/2/5 × 10^k steps).
function niceScale(maxValue: number, targetTicks = 4): { top: number; ticks: number[] } {
  if (maxValue <= 0) return { top: 1, ticks: [0, 1] }
  const rawStep = maxValue / targetTicks
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const norm = rawStep / mag
  const niceStep = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const top = Math.ceil(maxValue / niceStep) * niceStep
  const ticks: number[] = []
  for (let t = 0; t <= top + 1e-9; t += niceStep) ticks.push(Number(t.toFixed(6)))
  return { top, ticks }
}

// Trim trailing zeros so ticks read 7.5 / 15 / 100, not 7.50 / 15.00.
const fmt = (n: number) => (Number.isInteger(n) ? `${n}` : `${parseFloat(n.toFixed(2))}`)

export function BenchBars({
  title,
  unit = "",
  bars,
  max,
}: {
  title?: string
  unit?: string
  bars: { label: string; value: number; highlight?: boolean }[]
  max?: number
}) {
  const dataMax = Math.max(...bars.map((b) => b.value))
  const { top, ticks } = niceScale(max ?? dataMax)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      {title ? (
        <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
          {title}
        </div>
      ) : null}

      <div className="px-4 pt-4 pb-3">
        <div className="space-y-2">
          {bars.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-28 shrink-0 truncate text-right font-mono text-xs sm:w-40",
                  b.highlight
                    ? "font-medium text-foreground"
                    : "text-muted-foreground"
                )}
              >
                {b.label}
              </span>

              {/* plot area — gridlines behind, bar in front */}
              <div className="relative h-6 flex-1">
                {/* vertical gridlines at each tick */}
                <div className="absolute inset-0">
                  {ticks.map((t, ti) => (
                    <span
                      key={ti}
                      className={cn(
                        "absolute top-0 bottom-0 w-px",
                        ti === 0 ? "bg-border" : "bg-border/40"
                      )}
                      style={{ left: `${(t / top) * 100}%` }}
                    />
                  ))}
                </div>
                {/* the bar */}
                <div
                  className={cn(
                    "absolute top-1/2 h-4 -translate-y-1/2 rounded-sm",
                    b.highlight ? "shadow-sm" : ""
                  )}
                  style={{
                    width: `${Math.max((b.value / top) * 100, 0.5)}%`,
                    background: b.highlight
                      ? "oklch(0.72 0.15 195)"
                      : "oklch(0.62 0.02 260)",
                  }}
                />
                {/* value label — sits just past the bar end, but rides INSIDE the bar
                    (right-aligned, dark on the coloured fill) once the bar is near full
                    width, so it never spills past the figure edge */}
                {(() => {
                  const pct = Math.min((b.value / top) * 100, 100)
                  const inside = pct >= 80
                  return (
                    <span
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 font-mono text-[11px] tabular-nums",
                        inside ? "pr-1.5" : "pl-1.5",
                        !inside && (b.highlight ? "text-foreground" : "text-muted-foreground")
                      )}
                      style={inside ? { right: `${100 - pct}%`, color: "oklch(0.22 0 0)" } : { left: `${pct}%` }}
                    >
                      {fmt(b.value)}
                      {unit}
                    </span>
                  )
                })()}
              </div>
            </div>
          ))}
        </div>

        {/* tick scale under the plot area (aligned with the bar column) */}
        <div className="mt-2 flex items-center gap-3">
          <span className="w-28 shrink-0 sm:w-40" aria-hidden />
          <div className="relative h-4 flex-1">
            {ticks.map((t, ti) => (
              <span
                key={ti}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground tabular-nums"
                style={{ left: `${(t / top) * 100}%` }}
              >
                {fmt(t)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  )
}
