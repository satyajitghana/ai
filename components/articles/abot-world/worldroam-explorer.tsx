"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Table 3 of the paper (WorldRoamBench, a third-party benchmark ABot-World-0
// does not control). This is the honesty-first view of that table: pick a
// sub-metric and see where the 5B model actually lands against two much
// larger open comparators and one un-sized closed one. The "beats X on N/7"
// counts are computed from the data below on every render -- they can't drift
// out of sync with the numbers. Scores are the paper's raw 0-1 metric values,
// shown here as percentages (x100) for readability.

const ACCENT = "oklch(0.66 0.15 165)"
const MODELS = [
  { key: "genie3", label: "Genie 3", size: null },
  { key: "happyoyster", label: "HappyOyster", size: null },
  { key: "lingbot", label: "LingBot-World", size: "14B" },
  { key: "hyworld", label: "HY-World 1.5", size: "8.3B" },
  { key: "abot", label: "ABot-World-0", size: "5B" },
] as const

type ModelKey = (typeof MODELS)[number]["key"]

// Values x100 (paper reports 0-1 fractions; shown here as percentage points).
const METRICS: { key: string; label: string; values: Record<ModelKey, number> }[] = [
  { key: "strict", label: "Strict Acc.", values: { genie3: 47.0, happyoyster: 53.17, lingbot: 32.35, hyworld: 16.4, abot: 52.66 } },
  { key: "partial", label: "Partial Acc.", values: { genie3: 66.08, happyoyster: 76.31, lingbot: 41.98, hyworld: 20.88, abot: 72.9 } },
  { key: "traj", label: "Traj. Score", values: { genie3: 67.19, happyoyster: 77.37, lingbot: 40.94, hyworld: 20.15, abot: 67.52 } },
  { key: "aesthetic", label: "Aesthetic", values: { genie3: 47.11, happyoyster: 52.35, lingbot: 28.98, hyworld: 14.0, abot: 50.39 } },
  { key: "imaging", label: "Imaging", values: { genie3: 47.57, happyoyster: 43.77, lingbot: 28.75, hyworld: 12.36, abot: 46.51 } },
  { key: "mechanics", label: "Mechanics", values: { genie3: 54.54, happyoyster: 53.95, lingbot: 27.77, hyworld: 11.15, abot: 52.23 } },
  { key: "memory", label: "Memory", values: { genie3: 60.73, happyoyster: 63.09, lingbot: 30.06, hyworld: 15.62, abot: 50.41 } },
]

const W = 720

export function WorldRoamExplorer() {
  const [mi, setMi] = useState(0)
  const metric = METRICS[mi]

  const counts = useMemo(() => {
    const c: Record<ModelKey, number> = { genie3: 0, happyoyster: 0, lingbot: 0, hyworld: 0, abot: 0 }
    for (const m of METRICS) {
      const abotVal = m.values.abot
      for (const key of Object.keys(c) as ModelKey[]) {
        if (key !== "abot" && abotVal > m.values[key]) c[key]++
      }
    }
    return c
  }, [])

  const rows = MODELS.map((m) => ({ ...m, value: metric.values[m.key] }))
  const maxVal = Math.max(...rows.map((r) => r.value))
  const scaleMax = Math.ceil(maxVal * 1.15)
  const leader = rows.reduce((a, b) => (b.value > a.value ? b : a))
  const abot = rows.find((r) => r.key === "abot")!
  const gap = Math.round((leader.value - abot.value) * 10) / 10

  const rowH = 30
  const chartH = rows.length * rowH + 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>worldroambench · third-party, 7 sub-metrics</span>
        <span className="text-muted-foreground/50">● = leader on this metric</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((m, i) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setMi(i)}
              aria-pressed={mi === i}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[11px] transition-colors",
                mi === i ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mi === i ? { background: ACCENT } : undefined}
            >
              {m.label}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${chartH}`}
          className="mt-3 w-full"
          role="img"
          aria-label={`${metric.label}: ${rows.map((r) => `${r.label} ${r.value.toFixed(1)} percent`).join(", ")}. Leader is ${leader.label}.`}
        >
          {rows.map((r, i) => {
            const y = i * rowH
            const isAbot = r.key === "abot"
            const isLeader = r.key === leader.key
            const barMaxW = W - 168
            const bw = Math.max((r.value / scaleMax) * barMaxW, 2)
            return (
              <g key={r.key}>
                <text
                  x={140}
                  y={y + rowH / 2 + 4}
                  textAnchor="end"
                  className="font-mono"
                  fontSize={11}
                  fontWeight={isAbot ? 700 : 500}
                  fill={isAbot ? "var(--foreground)" : "var(--muted-foreground)"}
                >
                  {r.label}
                  {r.size ? ` (${r.size})` : ""}
                </text>
                <rect x={150} y={y + 4} width={barMaxW} height={rowH - 12} rx={4} fill="var(--muted)" opacity={0.35} />
                <rect
                  x={150}
                  y={y + 4}
                  width={bw}
                  height={rowH - 12}
                  rx={4}
                  fill={isAbot ? ACCENT : "var(--muted-foreground)"}
                  opacity={isAbot ? 0.95 : 0.55}
                />
                <text x={150 + bw + 6} y={y + rowH / 2 + 4} className="font-mono fill-foreground" fontSize={10.5}>
                  {isLeader ? "● " : ""}
                  {r.value.toFixed(1)}
                </text>
              </g>
            )
          })}
        </svg>

        <div className="mt-2 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">
            {abot.key === leader.key ? (
              <>ABot-World-0 (5B) leads {metric.label} at {abot.value.toFixed(1)}.</>
            ) : (
              <>
                ABot-World-0 (5B) trails the leader ({leader.label}) on {metric.label} by {gap} points --{" "}
                {abot.value.toFixed(1)} vs {leader.value.toFixed(1)}.
              </>
            )}
          </p>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Across all seven sub-metrics: ABot-World-0 beats <span className="text-foreground">LingBot-World (14B)</span>{" "}on{" "}
          {counts.lingbot}/7 and <span className="text-foreground">HY-World 1.5 (8.3B)</span>{" "}on {counts.hyworld}/7 --
          every metric, at roughly a third and three-fifths the parameter count. Against{" "}
          <span className="text-foreground">HappyOyster</span>, the un-sized model that actually tops this benchmark,
          ABot-World-0 wins on {counts.happyoyster}/7 (Imaging) and trails on the rest. That is the honest shape of
          this result: a clear efficiency win, not a leaderboard sweep.
        </p>
      </div>
    </figure>
  )
}
