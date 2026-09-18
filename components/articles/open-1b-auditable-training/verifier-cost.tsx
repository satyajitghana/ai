import { mlog10 } from "@/lib/dmath"

// Real per-step replay times, pulled from the live ledger at
// open1b.gensyn.ai/v1/ledger.jsonl on 2026-09-18 (26 submissions, one
// superseded -- 25 counted toward "stepsAudited"). Grouped by hardware class;
// min/max are the fastest and slowest logged submission in that class, not an
// average, so the range is exactly what happened, not a smoothed estimate.
//
// The cluster's own median step time (Table 7 of the tech report) is plotted
// as a reference band -- the reason the two ends of this chart are ~2,500x
// apart is that a single device replays sequentially what 48 GPUs did at once.
//
// A server component: every number here is a fetched-and-committed snapshot
// (like a paper's Table X), not a live call to the audit site at render time.

const ROWS: { label: string; sub: string; min: number; max: number; n: number; color: string }[] = [
  {
    label: "the original training step",
    sub: "48×H100, in parallel — Table 7",
    min: 28.0 / 3600,
    max: 47.1 / 3600,
    n: 80957,
    color: "var(--muted-foreground)",
  },
  {
    label: "H100",
    sub: "one datacenter GPU, replaying alone",
    min: 0.4106,
    max: 2.773,
    n: 11,
    color: "oklch(0.60 0.15 255)",
  },
  {
    label: "RTX 3090 / 4090",
    sub: "one consumer GPU",
    min: 0.9297,
    max: 1.4531,
    n: 9,
    color: "oklch(0.66 0.14 165)",
  },
  {
    label: "Apple Silicon (M4 / M5)",
    sub: "one laptop chip",
    min: 5.5044,
    max: 19.2069,
    n: 5,
    color: "oklch(0.68 0.13 85)",
  },
]

const H_MIN = 0.006 // ~22s
const H_MAX = 30 // hours
const TICKS = [0.01, 0.1, 1, 10]

function fmtHours(h: number): string {
  if (h < 1 / 60) return `${Math.round(h * 3600)}s`
  if (h < 1) return `${Math.round(h * 60)}min`
  return `${h < 10 ? h.toFixed(1) : Math.round(h)}h`
}

export function VerifierCost() {
  const W = 860
  const plotX = 210
  const plotW = W - plotX - 20
  const rowH = 46
  const H = ROWS.length * rowH + 40

  const x = (hours: number) => {
    const lo = mlog10(H_MIN)
    const hi = mlog10(H_MAX)
    const t = (mlog10(hours) - lo) / (hi - lo)
    return plotX + Math.max(0, Math.min(1, t)) * plotW
  }

  // The arithmetic behind the closing line, done here (not hand-typed) so it
  // stays consistent with the rows above if the ledger snapshot ever updates.
  const totalSteps = 80957
  const trainingGpuDays = (48 * 27.8).toFixed(0) // 48 H100s x 27.8 active days
  const bestCaseSoloYears = ((totalSteps * ROWS[1].min) / 24 / 365.25).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>verifying one step vs. training one, logged runtimes</span>
        <span className="text-muted-foreground/50">log scale &middot; open1b.gensyn.ai, 2026-09-18</span>
      </div>

      <div className="overflow-x-auto p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img" aria-label="Range of hours needed to replay and verify one training step, by hardware class, compared with the original 28-47 second cluster step time.">
          {/* grid + ticks */}
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={8} y2={H - 24} stroke="var(--border)" strokeWidth={1} />
              <text x={x(t)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {fmtHours(t)}
              </text>
            </g>
          ))}

          {ROWS.map((r, i) => {
            const y = 16 + i * rowH
            const x0 = x(r.min)
            const x1 = x(r.max)
            return (
              <g key={r.label}>
                <text x={0} y={y + 5} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                  {r.label}
                </text>
                <text x={0} y={y + 18} className="fill-muted-foreground font-mono" fontSize={9}>
                  {r.sub}
                </text>
                <line x1={x0} x2={x1} y1={y} y2={y} stroke={r.color} strokeWidth={6} strokeLinecap="round" opacity={0.85} />
                <circle cx={x0} cy={y} r={4} fill={r.color} />
                <circle cx={x1} cy={y} r={4} fill={r.color} />
                <text x={Math.max(x0 - 4, plotX)} y={y - 8} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={9}>
                  {fmtHours(r.min)}&ndash;{fmtHours(r.max)}
                  <tspan className="fill-muted-foreground/60"> (n={r.n})</tspan>
                </text>
              </g>
            )
          })}
        </svg>

        {/* coverage today */}
        <div className="mt-2 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          {[
            { label: "steps audited", value: "25 / 80,957", note: "0.03%" },
            { label: "segments confirmed", value: "0 / 810", note: "every step must match" },
            { label: "contributors", value: "11", note: "self-reported handles" },
            { label: "active claims", value: "7", note: "in progress" },
          ].map((s) => (
            <div key={s.label}>
              <div className="font-mono text-[9px] tracking-wide text-muted-foreground uppercase">{s.label}</div>
              <div className="mt-0.5 font-mono text-base tabular-nums">{s.value}</div>
              <div className="font-mono text-[9px] text-muted-foreground">{s.note}</div>
            </div>
          ))}
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Even the fastest H100 submission logged so far ({fmtHours(ROWS[1].min)}/step) sustained across all{" "}
          {totalSteps.toLocaleString()} steps on one GPU comes to about {bestCaseSoloYears} GPU-years &mdash; more than
          the {trainingGpuDays} GPU-days ({(Number(trainingGpuDays) / 365.25).toFixed(1)} GPU-years) the original run
          spent training, across the whole 48-GPU cluster. That is why the audit is designed to be split across many
          machines rather than run by one.
        </p>
      </div>
    </figure>
  )
}
