// Pure-SVG line/bar plot for blog explainers. Server-rendered, zero JS —
// degrades perfectly for agents, print, and no-JS readers.
type Point = { x: number; y: number }

export function Plot({
  data,
  type = "line",
  label,
  height = 200,
  width = 560,
}: {
  data: number[] | Point[]
  type?: "line" | "bar"
  label?: string
  height?: number
  width?: number
}) {
  const points: Point[] = data.map((d, i) =>
    typeof d === "number" ? { x: i, y: d } : d
  )
  if (points.length === 0) return null

  const pad = 28
  const xs = points.map((p) => p.x)
  const ys = points.map((p) => p.y)
  const xMin = Math.min(...xs)
  const xMax = Math.max(...xs)
  const yMin = Math.min(0, ...ys)
  const yMax = Math.max(...ys)
  const sx = (x: number) =>
    pad + ((x - xMin) / (xMax - xMin || 1)) * (width - 2 * pad)
  const sy = (y: number) =>
    height - pad - ((y - yMin) / (yMax - yMin || 1)) * (height - 2 * pad)

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`)
    .join(" ")
  const barWidth = ((width - 2 * pad) / points.length) * 0.6

  return (
    <figure className="my-8">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={label ?? "plot"}
        className="w-full rounded-md border"
      >
        {/* axes */}
        <line
          x1={pad} y1={height - pad} x2={width - pad} y2={height - pad}
          stroke="var(--border)" strokeWidth="1"
        />
        <line
          x1={pad} y1={pad} x2={pad} y2={height - pad}
          stroke="var(--border)" strokeWidth="1"
        />
        {type === "line" ? (
          <path d={path} fill="none" stroke="var(--foreground)" strokeWidth="1.5" />
        ) : (
          points.map((p, i) => (
            <rect
              key={i}
              x={sx(p.x) - barWidth / 2}
              y={sy(p.y)}
              width={barWidth}
              height={height - pad - sy(p.y)}
              fill="var(--foreground)"
              opacity="0.8"
            />
          ))
        )}
        {/* min/max ticks */}
        <text x={pad - 6} y={sy(yMax) + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" fontFamily="monospace">
          {yMax}
        </text>
        <text x={pad - 6} y={height - pad + 4} textAnchor="end" fontSize="10" fill="var(--muted-foreground)" fontFamily="monospace">
          {yMin}
        </text>
      </svg>
      {label ? (
        <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {label}
        </figcaption>
      ) : null}
    </figure>
  )
}
