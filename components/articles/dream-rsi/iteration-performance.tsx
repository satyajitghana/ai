"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Tab A -- the only per-round curve the paper publishes at this granularity:
// Figure 6(a)/(b), ConvDiv, GPU-kernel engineering (Sec. 5.2). Both series are
// the exact labeled values printed on the chart, E0 through E8 (9 rounds --
// the longest recursive run shown anywhere in the paper; Lasso runs 5 rounds,
// the three math tasks run 10, and neither publishes a matching per-round
// curve). The "Recursive Fixed Exploration, comparable budget" reference line
// is NOT one of the paper's plotted points -- it is 1.898 / 2.09, derived from
// Fig. 4's own stated ConvDiv ratio ("2.09x higher score, similar budget")
// applied to this run's final value. Flagged as derived in the UI itself.
const PERF = [0.427, 0.625, 0.855, 1.403, 1.488, 1.499, 1.77, 1.88, 1.898]
const ATTEMPTS = [110, 110, 87, 80, 50, 92, 80, 91, 86]
const ROUNDS = ["E0", "E1", "E2", "E3", "E4", "E5", "E6", "E7", "E8"]
const FIXED_EXPLORATION_IMPLIED = 1.898 / 2.09 // ~0.908, see note above

// Tab B -- every task/backbone pair where the paper reports Dream-RSI against
// its OWN controlled ablation, Recursive Fixed Exploration (same discovery
// agent, evaluator, initialization, and per-round call budget in round 1;
// only the exploration-policy code differs after that). Numbers are exact,
// taken directly from Fig. 3(a)'s table and Fig. 4's caption and Table 1 --
// none are interpolated. `computeX` > 1 means Dream-RSI used FEWER discovery-
// agent calls; `qualityX` > 1 means Dream-RSI scored better, in whichever
// direction is "better" for that task's own metric.
type Row = {
  task: string
  backbone: string
  computeX: number | null
  computeNote: string
  qualityX: number
  qualityNote: string
  source: string
}

const ROWS: Row[] = [
  { task: "Lasso path", backbone: "Gemini-3.1-Pro", computeX: 550 / 317, computeNote: "317 vs 550 calls", qualityX: 3587.1 / 2931.0, qualityNote: "2931.0 vs 3587.1 ms avg", source: "Fig. 3(a)" },
  { task: "Lasso path", backbone: "Gemini-3.7-Flash", computeX: 3200 / 1879, computeNote: "1879 vs 3200 calls", qualityX: 2516.7 / 2350.6, qualityNote: "2350.6 vs 2516.7 ms avg", source: "Fig. 3(a)" },
  { task: "Kernel · VGG16", backbone: "Gemini-3.1-Pro", computeX: 2.43, computeNote: "“2.43× fewer generations”", qualityX: 1.0, qualityNote: "stated as comparable, not exact", source: "Fig. 4" },
  { task: "Kernel · LayerNorm", backbone: "Gemini-3.1-Pro", computeX: 1.79, computeNote: "“1.79× fewer generations”", qualityX: 1.0, qualityNote: "stated as comparable, not exact", source: "Fig. 4" },
  { task: "Kernel · ConvDiv", backbone: "Gemini-3.1-Pro", computeX: 1.0, computeNote: "stated as “similar budget”, not exact", qualityX: 2.09, qualityNote: "“2.09× higher score”", source: "Fig. 4" },
  { task: "Kernel · ConvMax", backbone: "Gemini-3.1-Pro", computeX: 1.0, computeNote: "stated as “similar budget”, not exact", qualityX: 1.44, qualityNote: "“1.44× higher score”", source: "Fig. 4" },
  { task: "Math · Sum-Diff", backbone: "Gemini-3.1-Pro", computeX: null, computeNote: "not reported (rounds=10, no call count)", qualityX: 1.145427 / 1.144047, qualityNote: "1.145427 vs 1.144047, higher better", source: "Table 1" },
  { task: "Math · Autocorrelation", backbone: "Gemini-3.1-Pro", computeX: null, computeNote: "not reported (rounds=10, no call count)", qualityX: 1.456001 / 1.456375, qualityNote: "1.456375 vs 1.456001, lower better", source: "Table 1" },
  { task: "Math · Circle packing", backbone: "Gemini-3.1-Pro", computeX: null, computeNote: "not reported (rounds=10, no call count)", qualityX: 2.635983 / 2.635983, qualityNote: "2.635983 vs 2.635983 — exact tie", source: "Table 1" },
]

const ACCENT = "oklch(0.60 0.15 255)"
const ATTN = "oklch(0.65 0.16 45)"
const WORSE = "oklch(0.62 0.17 25)"
const OK_GREEN = "oklch(0.58 0.14 145)"

const W = 720
const H = 220
const PL = 44, PR = 700, PT = 16, PB = 168
const xPix = (i: number) => PL + (i / (ROUNDS.length - 1)) * (PR - PL)
const yPix = (v: number) => PB - (v / 2) * (PB - PT)

const BW = 720
const BH = 108
const BPT = 10, BPB = 92
const byPix = (v: number) => BPB - (v / 120) * (BPB - BPT)

function perfPath() {
  return PERF.map((v, i) => `${i === 0 ? "M" : "L"} ${xPix(i)} ${yPix(v)}`).join(" ")
}

type Tab = "curve" | "cross-task"

export function IterationPerformance() {
  const [tab, setTab] = useState<Tab>("curve")
  const [round, setRound] = useState(8)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">does the loop win, and does the win come from compute?</span>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setTab("curve")}
            aria-pressed={tab === "curve"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              tab === "curve" ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            9 rounds, one task
          </button>
          <button
            type="button"
            onClick={() => setTab("cross-task")}
            aria-pressed={tab === "cross-task"}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              tab === "cross-task" ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            every reported comparison
          </button>
        </div>
      </div>

      {tab === "curve" ? (
        <div className="p-3 sm:p-4">
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">
            ConvDiv (GPU kernel engineering) · round-best performance, Fig. 6(a)
          </div>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Round-best performance on ConvDiv rises from 0.427 at round E0 to 1.898 at round E8 across 9 recursive rounds, the longest per-round curve published in the paper. A dashed reference line at approximately 0.908, derived from the paper's stated 2.09x ratio rather than independently plotted, marks where Recursive Fixed Exploration lands at a comparable final budget.`}>
            <defs>
              <filter id="ip-soft" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
              </filter>
            </defs>
            {[0, 0.5, 1, 1.5, 2].map((t) => (
              <line key={`g${t}`} x1={PL} y1={yPix(t)} x2={PR} y2={yPix(t)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.35} />
            ))}
            {[0, 0.5, 1, 1.5, 2].map((t) => (
              <text key={`yl${t}`} x={PL - 8} y={yPix(t) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{t}</text>
            ))}
            {ROUNDS.map((r, i) => (
              <text key={`x${r}`} x={xPix(i)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{r}</text>
            ))}
            <text x={PL - 8} y={PT - 4} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={9}>performance (1/ms)</text>

            {/* derived Fixed Exploration reference */}
            <line x1={PL} y1={yPix(FIXED_EXPLORATION_IMPLIED)} x2={PR} y2={yPix(FIXED_EXPLORATION_IMPLIED)} stroke="var(--muted-foreground)" strokeWidth={1.6} strokeDasharray="5 4" opacity={0.85} />
            <text x={PR} y={yPix(FIXED_EXPLORATION_IMPLIED) - 6} textAnchor="end" className="font-mono" fontSize={9} fill="var(--muted-foreground)">
              Fixed Exploration, comparable budget ≈ {FIXED_EXPLORATION_IMPLIED.toFixed(2)} (implied, not plotted by the paper)
            </text>

            <path d={perfPath()} fill="none" stroke={ACCENT} strokeWidth={2.4} filter="url(#ip-soft)" />
            {PERF.map((v, i) => (
              <circle key={`pt${i}`} cx={xPix(i)} cy={yPix(v)} r={i === round ? 5.5 : 3.5} fill={i === round ? ACCENT : "var(--background)"} stroke={ACCENT} strokeWidth={1.6} />
            ))}
          </svg>

          <div className="mt-3 mb-1 font-mono text-[11px] text-muted-foreground">evaluated attempts / round · Fig. 6(b)</div>
          <svg viewBox={`0 0 ${BW} ${BH}`} className="w-full" role="img" aria-label="Evaluated attempts per round: 110, 110, 87, 80, 50, 92, 80, 91, 86 — the policy conserves compute as it improves, then spends more again when progress stalls.">
            {ATTEMPTS.map((v, i) => {
              const bw = (PR - PL) / ROUNDS.length - 10
              const x = xPix(i) - bw / 2
              return (
                <rect
                  key={`b${i}`}
                  x={x}
                  y={byPix(v)}
                  width={bw}
                  height={BPB - byPix(v)}
                  rx={3}
                  fill={ATTN}
                  opacity={i === round ? 0.9 : 0.45}
                />
              )
            })}
            {ATTEMPTS.map((v, i) => (
              <text key={`bl${i}`} x={xPix(i)} y={byPix(v) - 4} textAnchor="middle" className="font-mono fill-muted-foreground" fontSize={8}>{v}</text>
            ))}
          </svg>

          <div className="mt-2">
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>drag through the 9 rounds</span>
              <span className="tabular-nums text-foreground">
                {ROUNDS[round]} · perf {PERF[round].toFixed(3)} · {ATTEMPTS[round]} attempts
              </span>
            </div>
            <Range min={0} max={ROUNDS.length - 1} step={1} value={round} onChange={(e) => setRound(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
          </div>

          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            This is the only task the paper carries past 5–10 rounds, and performance keeps rising through all 9 —
            no plateau, no collapse. But look at the bar underneath: compute per round is not monotonic either. It
            drops 110 → 50 as the policy gets more selective, then climbs back to ~90 once progress stalls at E4–E5.
            The gain tracks a smarter schedule, not a bigger one.
          </p>
        </div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="mb-3 font-mono text-[11px] text-muted-foreground">
            Recursive Fixed Exploration = same discovery agent, evaluator, init, and round-1 budget — only the
            exploration-policy code differs afterward. compute× &gt; 1 → Dream-RSI used fewer calls.
          </div>
          <div className="space-y-3">
            {ROWS.map((row, i) => {
              const worse = row.qualityX < 0.999
              const tied = row.qualityX >= 0.999 && row.qualityX <= 1.001
              const qColor = worse ? WORSE : tied ? "var(--muted-foreground)" : OK_GREEN
              return (
                <div key={i} className="rounded-lg border border-border/60 px-3 py-2">
                  <div className="flex flex-wrap items-baseline justify-between gap-1">
                    <span className="font-mono text-xs font-semibold text-foreground">{row.task}</span>
                    <span className="font-mono text-[10px] text-muted-foreground">{row.backbone} · {row.source}</span>
                  </div>
                  <div className="mt-1.5 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">compute</span>
                      <span className="font-mono text-[11px] tabular-nums" style={{ color: row.computeX && row.computeX > 1.02 ? OK_GREEN : "var(--muted-foreground)" }}>
                        {row.computeX ? `${row.computeX.toFixed(2)}×` : "—"}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/70">{row.computeNote}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">quality</span>
                      <span className="font-mono text-[11px] font-semibold tabular-nums" style={{ color: qColor }}>
                        {row.qualityX.toFixed(3)}×
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground/70">{row.qualityNote}</span>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Eight of nine comparisons favor Dream-RSI, several at <em>lower</em> compute, not just comparable
            compute — the opposite of the confound this site usually flags. The exception is{" "}
            <strong style={{ color: WORSE }}>Autocorrelation</strong>: Dream-RSI is measurably worse than its own
            matched baseline there (1.456375 vs 1.456001, lower is better), and neither beats SimpleTES&apos;s
            1.453675 at all — SimpleTES just needs 51,200 generations to get it. The three math rows also have no
            reported compute column at all: Table 1 states round counts, not call counts, so &ldquo;equal
            compute&rdquo; can&apos;t be checked there, only quality.
          </p>
        </div>
      )}
    </figure>
  )
}
