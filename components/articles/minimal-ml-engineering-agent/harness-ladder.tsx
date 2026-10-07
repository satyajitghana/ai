"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number here is copied from a table in arXiv 2609.40303 (Brilliantov,
// Hernández-Cano, Abbé; EPFL and Apple). Nothing is estimated or read off a
// chart. Each group is one table, on one task split, at one backbone, and the
// groups are deliberately NOT drawn on a shared axis with each other: the
// splits differ (default29, fixed14, fixed30), so a number in one group is not
// comparable with a number in another.
//
// Self-select is the submission the agent itself rated best on its own
// validation split; oracle is the submission that scored best on the hidden
// test set. The distance between the two is the selection gap, and that gap is
// where most of the multi-agent damage turns out to live.
//
// The sign test at the right is computed here from the per-task win counts the
// paper prints next to each paired comparison (wins for A / wins for B / ties),
// dropping ties. Integer arithmetic and division only, so server and client
// agree to the last digit.

type CI = [number, number, number] // value, lo, hi
type Row = {
  label: string
  note?: string
  pct: { self: CI; oracle?: CI }
  medal?: { self: CI; oracle?: CI }
  // paired-by-task comparison against the group's reference row, as printed
  paired?: { pct: string; medal: string; won: [number, number, number]; sigPct: boolean; sigMedal: boolean }
  ref?: boolean
}
type Group = {
  id: string
  tab: string
  source: string
  split: string
  pairedLabel: string
  rows: Row[]
}

const SEARCH: Group = {
  id: "search",
  tab: "search vs autonomy",
  source: "Tables 5, 6 and 13",
  split: "default29 · 24h · GLM 5.2",
  pairedLabel: "Malena vs this row",
  rows: [
    {
      label: "Oneshot ×1",
      note: "one 6h session, one submission",
      pct: { self: [55.15, 54.31, 55.98] },
      medal: { self: [36.8, 35.5, 38.2] },
    },
    {
      label: "Chain",
      note: "always refine the latest",
      pct: { self: [64.72, 61.97, 67.42], oracle: [66.87, 64.08, 69.57] },
      paired: { pct: "+4.58 [+0.97, +8.35]", medal: "+7.7 [+1.1, +14.8]", won: [9, 3, 17], sigPct: true, sigMedal: true },
    },
    {
      label: "Greedy",
      note: "refine the best so far",
      pct: { self: [66.19, 63.43, 68.71], oracle: [68.98, 67.32, 70.56] },
      paired: { pct: "+3.11 [-0.39, +6.71]", medal: "+6.6 [+0.5, +12.8]", won: [8, 4, 17], sigPct: false, sigMedal: true },
    },
    {
      label: "UCB1",
      note: "explore vs exploit",
      pct: { self: [66.92, 64.3, 69.36], oracle: [70.89, 68.45, 73.35] },
      paired: { pct: "+2.38 [-1.06, +5.88]", medal: "+6.6 [+0.4, +12.9]", won: [7, 3, 19], sigPct: false, sigMedal: true },
    },
    {
      label: "Best-of-N",
      note: "independent sessions",
      pct: { self: [64.21, 61.19, 67.07], oracle: [71.04, 69.49, 72.66] },
      paired: { pct: "+5.09 [+1.34, +8.98]", medal: "+11.9 [+5.6, +18.6]", won: [11, 2, 16], sigPct: true, sigMedal: true },
    },
    {
      label: "Malena",
      note: "one session, 24h",
      pct: { self: [69.3, 66.74, 71.78], oracle: [71.18, 69.02, 73.46] },
      medal: { self: [59.4, 54.8, 63.9], oracle: [62.5, 58.4, 66.3] },
      ref: true,
    },
  ],
}

const TOOLS: Group = {
  id: "tools",
  tab: "Malena's own tools",
  source: "Tables 9 and 10",
  split: "default29 · 24h · GLM 5.2",
  pairedLabel: "base vs this row",
  rows: [
    {
      label: "base",
      note: "submission + system + jobs",
      pct: { self: [69.3, 66.74, 71.78], oracle: [71.18, 69.02, 73.46] },
      medal: { self: [59.4, 54.8, 63.9], oracle: [62.5, 58.4, 66.3] },
      ref: true,
    },
    {
      label: "+N",
      note: "time nudges at 25/50/75/90%",
      pct: { self: [63.85, 59.73, 67.77], oracle: [65.98, 62.05, 69.83] },
      medal: { self: [48.9, 43.1, 54.0], oracle: [52.3, 46.6, 57.5] },
      paired: { pct: "+5.46 [+0.70, +10.67]", medal: "+10.6 [+3.7, +17.9]", won: [8, 1, 20], sigPct: true, sigMedal: true },
    },
    {
      label: "−J",
      note: "no background jobs",
      pct: { self: [70.47, 66.89, 74.25], oracle: [72.84, 69.55, 76.1] },
      medal: { self: [62.1, 56.9, 67.2], oracle: [62.1, 56.9, 67.2] },
      paired: { pct: "-1.17 [-5.64, +3.34]", medal: "-2.6 [-10.2, +4.7]", won: [3, 6, 20], sigPct: false, sigMedal: false },
    },
    {
      label: "−S−J",
      note: "no clock, no jobs",
      pct: { self: [65.33, 62.05, 68.61], oracle: [68.36, 65.16, 71.45] },
      medal: { self: [50.6, 44.8, 56.3], oracle: [56.9, 50.6, 62.6] },
      paired: { pct: "+3.97 [-0.07, +7.97]", medal: "+8.9 [+1.7, +15.9]", won: [9, 3, 17], sigPct: false, sigMedal: true },
    },
  ],
}

const ORCH: Group = {
  id: "orch",
  tab: "multi-agent",
  source: "Tables 1 and 10",
  split: "fixed14 · 24h · GLM 5.2",
  pairedLabel: "base vs this row",
  rows: [
    {
      label: "base",
      note: "one Malena session",
      pct: { self: [66.51, 62.46, 69.97], oracle: [69.29, 65.82, 72.13] },
      medal: { self: [55.7, 48.2, 62.9], oracle: [60.4, 53.2, 66.8] },
      ref: true,
    },
    {
      label: "+D",
      note: "background subagents",
      pct: { self: [63.62, 59.27, 68.26], oracle: [67.4, 63.22, 71.98] },
      medal: { self: [45.2, 38.1, 54.8], oracle: [47.0, 38.1, 56.0] },
      paired: { pct: "+2.88 [-2.94, +8.73]", medal: "+10.5 [-1.0, +22.0]", won: [4, 4, 6], sigPct: false, sigMedal: false },
    },
    {
      label: "+P3",
      note: "three sessions, one GPU",
      pct: { self: [67.77, 64.58, 70.62], oracle: [71.79, 69.34, 73.83] },
      medal: { self: [52.4, 42.8, 61.9], oracle: [60.7, 53.6, 67.3] },
      paired: { pct: "-1.26 [-6.09, +3.21]", medal: "+3.3 [-8.2, +14.9]", won: [4, 3, 7], sigPct: false, sigMedal: false },
    },
    {
      label: "+B+P3",
      note: "three sessions + broadcast",
      pct: { self: [58.91, 53.5, 64.05], oracle: [68.57, 65.77, 71.14] },
      medal: { self: [33.3, 23.8, 40.5], oracle: [53.0, 45.8, 60.1] },
      paired: { pct: "+7.59 [+0.99, +13.86]", medal: "+22.4 [+10.8, +33.7]", won: [7, 2, 5], sigPct: true, sigMedal: true },
    },
  ],
}

// Table 15 and Table 16, fixed30, per backbone.
const RELEASED: Record<string, Row[]> = {
  "GLM 5.2": [
    { label: "Malena", pct: { self: [69.74, 67.38, 72.23], oracle: [71.56, 69.43, 73.66] }, medal: { self: [62.5, 58.3, 66.7], oracle: [65.0, 61.7, 68.3] }, ref: true },
    { label: "Arbor", pct: { self: [59.26, 56.37, 62.13], oracle: [60.7, 57.92, 63.54] }, medal: { self: [45.8, 41.7, 50.0], oracle: [47.5, 42.5, 52.5] }, paired: { pct: "+10.48 [+6.76, +14.29]", medal: "+16.7 [+10.0, +22.5]", won: [12, 1, 17], sigPct: true, sigMedal: true } },
    { label: "AiScientist", pct: { self: [61.39, 58.81, 63.81], oracle: [62.35, 59.89, 64.74] }, medal: { self: [47.1, 42.3, 52.2], oracle: [49.9, 45.2, 54.3] }, paired: { pct: "+8.36 [+5.12, +11.90]", medal: "+15.4 [+8.7, +21.9]", won: [12, 1, 17], sigPct: true, sigMedal: true } },
    { label: "MLEvolve", pct: { self: [54.32, 52.04, 56.61], oracle: [64.87, 62.94, 66.88] }, medal: { self: [39.2, 35.0, 42.5], oracle: [50.0, 45.8, 53.3] }, paired: { pct: "+15.42 [+12.05, +18.76]", medal: "+23.3 [+17.5, +28.4]", won: [14, 2, 14], sigPct: true, sigMedal: true } },
    { label: "ScienceFlow", pct: { self: [47.59, 44.47, 50.41], oracle: [58.74, 56.79, 60.92] }, medal: { self: [24.4, 18.9, 30.0], oracle: [40.0, 36.7, 43.3] }, paired: { pct: "+22.16 [+18.43, +26.11]", medal: "+38.1 [+31.1, +45.0]", won: [19, 0, 11], sigPct: true, sigMedal: true } },
  ],
  "Kimi K3": [
    { label: "Malena", pct: { self: [72.75, 70.75, 74.82], oracle: [75.54, 73.9, 77.35] }, medal: { self: [60.0, 55.6, 64.4], oracle: [65.6, 60.0, 70.0] }, ref: true },
    { label: "Arbor", pct: { self: [68.46, 66.63, 70.08], oracle: [69.53, 67.76, 71.25] }, medal: { self: [60.0, 56.7, 63.3], oracle: [61.1, 57.8, 64.4] }, paired: { pct: "+4.29 [+1.54, +7.05]", medal: "+0.0 [-5.6, +5.6]", won: [5, 5, 20], sigPct: true, sigMedal: false } },
    { label: "AiScientist", pct: { self: [64.15, 61.26, 67.1], oracle: [65.48, 62.54, 68.32] }, medal: { self: [52.2, 46.7, 57.8], oracle: [53.3, 47.8, 58.9] }, paired: { pct: "+8.60 [+4.91, +12.15]", medal: "+7.8 [+0.0, +15.6]", won: [7, 2, 21], sigPct: true, sigMedal: false } },
    { label: "MLEvolve", pct: { self: [63.89, 62.0, 65.74], oracle: [70.32, 68.98, 71.58] }, medal: { self: [50.0, 46.7, 54.4], oracle: [63.3, 60.0, 66.7] }, paired: { pct: "+8.85 [+6.11, +11.70]", medal: "+10.0 [+3.3, +16.7]", won: [7, 2, 21], sigPct: true, sigMedal: true } },
  ],
  "DeepSeek V4 Flash": [
    { label: "Malena", pct: { self: [58.53, 54.31, 62.43], oracle: [63.21, 59.72, 66.52] }, medal: { self: [44.4, 37.8, 51.1], oracle: [48.9, 43.3, 54.4] }, ref: true },
    { label: "Arbor", pct: { self: [61.23, 57.88, 64.53], oracle: [64.0, 61.26, 66.46] }, medal: { self: [50.0, 45.6, 54.4], oracle: [51.1, 46.7, 55.6] }, paired: { pct: "-2.71 [-8.26, +2.50]", medal: "-5.6 [-13.3, +2.2]", won: [6, 8, 16], sigPct: false, sigMedal: false } },
    { label: "AiScientist", pct: { self: [59.13, 55.33, 62.97], oracle: [59.45, 55.55, 63.32] }, medal: { self: [45.6, 40.0, 51.1], oracle: [45.6, 40.0, 51.1] }, paired: { pct: "-0.60 [-6.10, +5.27]", medal: "-1.1 [-10.0, +7.8]", won: [6, 5, 19], sigPct: false, sigMedal: false } },
    { label: "MLEvolve", pct: { self: [42.53, 38.67, 46.42], oracle: [54.81, 51.9, 57.6] }, medal: { self: [26.7, 21.1, 32.2], oracle: [40.0, 35.6, 44.4] }, paired: { pct: "+16.00 [+10.38, +21.40]", medal: "+17.8 [+8.9, +26.7]", won: [14, 5, 11], sigPct: true, sigMedal: true } },
    { label: "ScienceFlow", pct: { self: [49.99, 46.61, 53.41], oracle: [54.79, 51.67, 57.94] }, medal: { self: [34.4, 28.9, 40.0], oracle: [40.0, 34.4, 45.6] }, paired: { pct: "+8.54 [+2.85, +13.58]", medal: "+10.0 [+1.1, +17.8]", won: [10, 3, 17], sigPct: true, sigMedal: true } },
  ],
  "Gemma 4 31B": [
    { label: "Malena", pct: { self: [32.35, 29.29, 35.62], oracle: [35.71, 32.53, 38.98] }, medal: { self: [17.8, 14.4, 21.1], oracle: [22.2, 17.8, 26.7] }, ref: true },
    { label: "AiScientist", pct: { self: [33.0, 29.61, 36.45], oracle: [36.3, 32.98, 39.5] }, medal: { self: [20.0, 15.6, 24.4], oracle: [23.3, 20.0, 26.7] }, paired: { pct: "-0.65 [-5.23, +3.83]", medal: "-2.2 [-7.8, +3.3]", won: [3, 3, 24], sigPct: false, sigMedal: false } },
    { label: "MLEvolve", pct: { self: [42.88, 40.24, 45.44], oracle: [50.73, 49.16, 52.34] }, medal: { self: [22.2, 17.8, 26.7], oracle: [31.1, 27.8, 35.6] }, paired: { pct: "-10.53 [-14.72, -6.36]", medal: "-4.4 [-10.0, +1.1]", won: [4, 6, 20], sigPct: true, sigMedal: false } },
  ],
}
const BACKBONES = Object.keys(RELEASED)

// Exact two-sided sign test on wins vs losses, ties dropped.
function signTest(a: number, b: number): number {
  const n = a + b
  if (n === 0) return 1
  const k = Math.max(a, b)
  let c = 1 // C(n, 0)
  const coefs: number[] = [1]
  for (let i = 1; i <= n; i++) {
    c = (c * (n - i + 1)) / i
    coefs.push(c)
  }
  let tail = 0
  for (let i = k; i <= n; i++) tail += coefs[i]
  let total = 1
  for (let i = 0; i < n; i++) total *= 2
  return Math.min(1, (2 * tail) / total)
}

const fmtP = (p: number) => (p < 0.001 ? "<0.001" : p.toFixed(3))

const SELF = "oklch(0.58 0.15 255)"
const ORACLE = "oklch(0.66 0.15 50)"

export function HarnessLadder() {
  const [gid, setGid] = useState("orch")
  const [metric, setMetric] = useState<"medal" | "pct">("medal")
  const [bb, setBb] = useState("GLM 5.2")

  const group: Group =
    gid === "search"
      ? SEARCH
      : gid === "tools"
        ? TOOLS
        : gid === "orch"
          ? ORCH
          : {
              id: "released",
              tab: "released harnesses",
              source: "Tables 15 and 16",
              split: `fixed30 · 24h · ${bb}`,
              pairedLabel: "Malena vs this row",
              rows: RELEASED[bb],
            }

  const get = (r: Row) => (metric === "medal" ? r.medal : r.pct)
  const vals: number[] = []
  for (const r of group.rows) {
    const m = get(r)
    if (!m) continue
    vals.push(m.self[1], m.self[2])
    if (m.oracle) vals.push(m.oracle[1], m.oracle[2])
  }
  const lo = Math.max(0, Math.floor((Math.min(...vals) - 2) / 10) * 10)
  const hi = Math.min(100, Math.ceil((Math.max(...vals) + 2) / 10) * 10)

  const W = 640
  const L = 128
  const R = 18
  const rowH = 46
  const top = 26
  const H = top + group.rows.length * rowH + 22
  const x = (v: number) => L + ((v - lo) / (hi - lo)) * (W - L - R)
  const ticks: number[] = []
  for (let t = lo; t <= hi; t += 10) ticks.push(t)

  const unit = metric === "medal" ? "%" : ""
  const fv = (v: number) => (metric === "medal" ? v.toFixed(1) : v.toFixed(2))
  const metricName = metric === "medal" ? "medal rate" : "percentile"
  const desc = group.rows
    .map((r) => {
      const m = get(r)
      if (!m) return `${r.label}: ${metricName} not tabulated`
      return `${r.label}: self-select ${fv(m.self[0])}${unit} [${fv(m.self[1])}, ${fv(m.self[2])}]${
        m.oracle ? `, oracle ${fv(m.oracle[0])}${unit}` : ""
      }`
    })
    .join("; ")

  const tabs: [string, string][] = [
    ["search", "search vs autonomy"],
    ["tools", "Malena's tools"],
    ["orch", "multi-agent"],
    ["released", "released harnesses"],
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the harness ladder, rung by rung</span>
        <span className="text-muted-foreground/60">every number from the paper&apos;s tables</span>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 px-4 pt-3">
        {tabs.map(([id, name]) => (
          <button
            key={id}
            type="button"
            onClick={() => setGid(id)}
            aria-pressed={gid === id}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              gid === id ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {name}
          </button>
        ))}
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        {(["medal", "pct"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMetric(m)}
            aria-pressed={metric === m}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              metric === m ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {m === "medal" ? "medal rate" : "percentile"}
          </button>
        ))}
      </div>

      {gid === "released" && (
        <div className="flex flex-wrap items-center gap-1.5 px-4 pt-2">
          {BACKBONES.map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBb(b)}
              aria-pressed={bb === b}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10.5px] transition-colors",
                bb === b ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {b}
            </button>
          ))}
        </div>
      )}

      <div className="px-4 pt-2 font-mono text-[11px] text-muted-foreground">
        {group.split} · {group.source}
      </div>

      <div className="overflow-x-auto px-2 pt-1">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[520px]" role="img" aria-label={`${metricName}, ${group.split}. ${desc}`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={top - 10} x2={x(t)} y2={H - 20} className="stroke-border" strokeDasharray="2 4" />
              <text x={x(t)} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {`${t}${unit}`}
              </text>
            </g>
          ))}
          {group.rows.map((r, i) => {
            const y = top + i * rowH + 12
            const m = get(r)
            return (
              <g key={r.label}>
                <text x={0} y={y + 1} className={cn("font-mono", r.ref ? "fill-foreground font-semibold" : "fill-foreground")} style={{ fontSize: 11.5 }}>
                  {r.label}
                </text>
                {r.note && (
                  <text x={0} y={y + 14} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                    {r.note}
                  </text>
                )}
                {!m ? (
                  <text x={L} y={y + 4} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                    not tabulated for this metric
                  </text>
                ) : (
                  <g>
                    {m.oracle && (
                      <g>
                        <line x1={x(m.self[0])} y1={y} x2={x(m.oracle[0])} y2={y} stroke={ORACLE} strokeWidth={6} opacity={0.18} />
                        <line x1={x(m.oracle[1])} y1={y + 7} x2={x(m.oracle[2])} y2={y + 7} stroke={ORACLE} strokeWidth={1.4} />
                        <rect x={x(m.oracle[0]) - 3.5} y={y + 3.5} width={7} height={7} fill="var(--background)" stroke={ORACLE} strokeWidth={1.6} />
                      </g>
                    )}
                    <line x1={x(m.self[1])} y1={y - 3} x2={x(m.self[2])} y2={y - 3} stroke={SELF} strokeWidth={2.2} />
                    <circle cx={x(m.self[0])} cy={y - 3} r={4.2} fill={SELF} />
                    <text
                      x={x(m.self[2]) + 6}
                      y={y}
                      className="fill-muted-foreground font-mono"
                      style={{ fontSize: 9.5 }}
                    >
                      {`${fv(m.self[0])}${unit}`}
                    </text>
                  </g>
                )}
              </g>
            )
          })}
        </svg>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 font-mono text-[10.5px] text-muted-foreground">
        <span>
          <span style={{ color: SELF }}>●</span> self-select, 95% CI
        </span>
        <span>
          <span style={{ color: ORACLE }}>□</span> oracle (best hidden-test submission)
        </span>
        <span>shaded: selection gap</span>
      </div>

      <div className="overflow-x-auto border-t px-4 py-3">
        <table className="w-full min-w-[520px] font-mono text-[11px]">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="pb-1 pr-3 font-normal">{group.pairedLabel}</th>
              <th className="pb-1 pr-3 font-normal">Δ {metricName}</th>
              <th className="pb-1 pr-3 font-normal">won A/B/=</th>
              <th className="pb-1 font-normal">sign test p</th>
            </tr>
          </thead>
          <tbody>
            {group.rows
              .filter((r) => r.paired)
              .map((r) => {
                const p = r.paired!
                const sig = metric === "medal" ? p.sigMedal : p.sigPct
                const st = signTest(p.won[0], p.won[1])
                return (
                  <tr key={r.label} className="border-t border-border/50">
                    <td className="py-1 pr-3">{r.label}</td>
                    <td className={cn("py-1 pr-3", sig ? "text-foreground" : "text-muted-foreground")}>
                      {metric === "medal" ? p.medal : p.pct}
                      {sig ? " *" : ""}
                    </td>
                    <td className="py-1 pr-3 text-muted-foreground">{p.won.join("/")}</td>
                    <td className={cn("py-1", st < 0.05 ? "text-foreground" : "text-muted-foreground")}>{fmtP(st)}</td>
                  </tr>
                )
              })}
          </tbody>
        </table>
        <p className="mt-2 text-[11px] leading-snug text-muted-foreground">
          Δ and its bracket are the paper&apos;s paired-by-task bootstrap; * means the bracket excludes zero. The win counts
          are printed beside each comparison in the paper; the sign test on them (ties dropped) is computed here.
          It asks whether the result would survive drawing a different set of tasks, which the bootstrap does not.
        </p>
      </div>
    </figure>
  )
}
