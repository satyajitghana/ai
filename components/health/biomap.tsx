import { health, type HealthCategory } from "@/data/health"
import {
  categoryColorVar,
  categoryLabel,
  deriveStatus,
  statusCaption,
  type HealthStatus,
} from "@/lib/health/status"
import { cellArea, layoutTreemap } from "@/lib/health/treemap"

// Below this cell area (in percentage-points², 0–10000) a non-optimal cell
// shows a compact colored dot instead of the full status caption.
const CAPTION_AREA_THRESHOLD = 90

// Tint a category color to a low-opacity fill via oklch's `/ alpha` syntax.
function categoryFill(category: HealthCategory, alpha: string): string {
  return `oklch(from var(${categoryColorVar(category)}) l c h / ${alpha})`
}

const statusColor: Record<HealthStatus, string> = {
  optimal: "var(--muted-foreground)",
  borderline: "oklch(0.78 0.13 85)",
  low: "oklch(0.7 0.14 250)",
  elevated: "var(--destructive)",
}

const categories: HealthCategory[] = [
  "cardiovascular",
  "metabolic",
  "liver_kidney",
  "hormonal",
  "nutritional",
  "blood_panel",
  "vitals",
]

export function Biomap() {
  const cells = layoutTreemap(health.biomarkers, 16 / 10)

  return (
    <div>
      <div className="relative aspect-[16/10] w-full overflow-hidden rounded-md border bg-muted/20">
        {cells.map((cell) => {
          const { marker } = cell
          const status = deriveStatus(marker.value, marker.optimalRange)
          const showCaption =
            status !== "optimal" && cellArea(cell) >= CAPTION_AREA_THRESHOLD
          const showDot = status !== "optimal" && !showCaption

          return (
            <div
              key={marker.key}
              className="absolute overflow-hidden p-2"
              style={{
                left: `${cell.x0}%`,
                top: `${cell.y0}%`,
                width: `${cell.x1 - cell.x0}%`,
                height: `${cell.y1 - cell.y0}%`,
                // 1px gap effect between cells without affecting layout math.
                padding: "calc(0.5px + 0.4rem)",
              }}
            >
              <div
                className="flex h-full w-full flex-col justify-between overflow-hidden rounded-sm border p-2"
                style={{
                  backgroundColor: categoryFill(marker.category, "0.12"),
                  borderColor: categoryFill(marker.category, "0.35"),
                }}
              >
                <div className="flex items-start justify-between gap-1">
                  <span className="truncate font-mono text-[10px] text-muted-foreground">
                    {marker.label}
                  </span>
                  {showDot ? (
                    <span
                      aria-label={status}
                      className="mt-0.5 size-1.5 shrink-0 rounded-full"
                      style={{ backgroundColor: statusColor[status] }}
                    />
                  ) : null}
                </div>

                <div className="min-w-0">
                  <p className="truncate font-mono text-sm font-bold">
                    {marker.value}
                    <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                      {marker.unit}
                    </span>
                  </p>
                  {showCaption ? (
                    <p
                      className="mt-1 line-clamp-2 font-mono text-[9px] leading-3"
                      style={{ color: statusColor[status] }}
                    >
                      {statusCaption(status, marker.label)}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Category legend */}
      <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
        {categories.map((category) => (
          <li
            key={category}
            className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground"
          >
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: `var(${categoryColorVar(category)})` }}
            />
            {categoryLabel(category)}
          </li>
        ))}
      </ul>
    </div>
  )
}
