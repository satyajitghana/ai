import type { ContributionCalendar } from "@/data/github-dummy"

// Contribution heatmap — a CSS grid of one rounded square per day, columns =
// weeks, rows = weekdays. Intensity is rendered as opacity over bg-foreground
// so it reads correctly in both light and dark. Month labels sit on top.

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
]

// Map a raw count to one of 5 intensity steps (0 = empty).
function level(count: number): number {
  if (count <= 0) return 0
  if (count <= 2) return 1
  if (count <= 5) return 2
  if (count <= 8) return 3
  return 4
}

const OPACITY = [0.06, 0.25, 0.45, 0.7, 1]

export function Heatmap({
  contributions,
}: {
  contributions: ContributionCalendar
}) {
  const { weeks } = contributions

  // Month label appears above the first week whose first day starts a new month.
  const monthLabels = weeks.map((week, i) => {
    const first = week.days[0]
    if (!first) return ""
    const month = new Date(`${first.date}T00:00:00Z`).getUTCMonth()
    const prev = weeks[i - 1]?.days[0]
    const prevMonth = prev
      ? new Date(`${prev.date}T00:00:00Z`).getUTCMonth()
      : -1
    return month !== prevMonth ? MONTHS[month] : ""
  })

  return (
    <div className="overflow-x-auto">
      <div className="inline-block">
        <div
          className="grid gap-[3px]"
          style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}
        >
          {monthLabels.map((label, i) => (
            <span
              key={i}
              className="font-mono text-[10px] text-muted-foreground"
            >
              {label}
            </span>
          ))}
        </div>
        <div
          className="mt-1 grid grid-flow-col gap-[3px]"
          style={{ gridTemplateRows: "repeat(7, 1fr)" }}
        >
          {weeks.flatMap((week) =>
            week.days.map((day) => (
              <div
                key={day.date}
                title={`${day.count} contributions on ${day.date}`}
                className="size-[11px] rounded-[2px] bg-foreground"
                style={{ opacity: OPACITY[level(day.count)] }}
              />
            ))
          )}
        </div>
      </div>
    </div>
  )
}
