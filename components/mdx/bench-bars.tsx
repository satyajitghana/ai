import { cn } from "@/lib/utils"

// Small horizontal benchmark bar chart for explainers. Data comes from MDX:
//   <BenchBars title="SWE-Bench Pro" unit="%" bars={[{label, value, highlight}]} />
// The highlighted bar (the model under discussion) gets the accent colour; the
// rest stay muted, so the comparison reads at a glance. Server-rendered.
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
  const top = max ?? Math.max(...bars.map((b) => b.value)) * 1.08

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      {title ? (
        <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
          {title}
        </div>
      ) : null}
      <div className="space-y-2 p-4">
        {bars.map((b, i) => (
          <div key={i} className="flex items-center gap-3">
            <span
              className={cn(
                "w-32 shrink-0 truncate text-right font-mono text-xs sm:w-36",
                b.highlight ? "font-medium text-foreground" : "text-muted-foreground"
              )}
            >
              {b.label}
            </span>
            <div className="relative h-5 flex-1 overflow-hidden rounded bg-muted">
              <div
                className="h-full rounded transition-all duration-500"
                style={{
                  width: `${Math.min((b.value / top) * 100, 100)}%`,
                  background: b.highlight
                    ? "oklch(0.72 0.15 195)"
                    : "oklch(0.6 0.015 260)",
                }}
              />
            </div>
            <span
              className={cn(
                "w-14 shrink-0 font-mono text-xs tabular-nums",
                b.highlight ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {b.value}
              {unit}
            </span>
          </div>
        ))}
      </div>
    </figure>
  )
}
