"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Three published tables, transcribed as printed:
//   paper  : TeleOCR paper (arXiv 2608.12898v3), Table 1, OmniDocBench v1.6 Full
//   owners : OmniDocBench's own v1.6_full leaderboard (opendatalab/OmniDocBench
//            README), TeleOCR added 2026-09-11
//   wild   : TeleOCR paper, Table 2, Wild-OmniDocBench v1.5 Full
// A subset of rows, chosen as the systems nearest the top. Overall is the
// benchmark's own definition: ((1 - TextEdit) x 100 + FormulaCDM + TableTEDS) / 3.
// The "runner-up's tables" toggle is the one thing computed here: TeleOCR's
// overall recomputed from its own text and formula scores with the best table
// score of any other row in the same table.

type Bench = "paper" | "owners" | "wild"
type Metric = "overall" | "text" | "formula" | "table" | "ro"

type Row = {
  model: string
  size: string
  overall: number
  text: number
  formula: number
  table: number
  ro: number
  flag?: string
}

const TELE = "TeleOCR"

const DATA: Record<Bench, { label: string; note: string; rows: Row[] }> = {
  paper: {
    label: "OmniDocBench v1.6, the paper's table",
    note: "Authors' own table. HunyuanOCR-1.5's text, formula, table and reading-order cells repeat PaddleOCR-VL-1.6's exactly; they average to 96.32, not the 94.74 printed beside them.",
    rows: [
      { model: TELE, size: "1.2B", overall: 96.87, text: 0.027, formula: 96.36, table: 97.05, ro: 0.122 },
      { model: "OvisOCR2", size: "0.8B", overall: 96.58, text: 0.025, formula: 97.53, table: 94.76, ro: 0.111 },
      { model: "PaddleOCR-VL-1.6", size: "0.9B", overall: 96.33, text: 0.033, formula: 97.49, table: 94.76, ro: 0.127 },
      { model: "MinerU2.5-Pro", size: "1.2B", overall: 95.75, text: 0.036, formula: 97.45, table: 93.42, ro: 0.12 },
      { model: "GLM-OCR", size: "0.9B", overall: 95.22, text: 0.044, formula: 97.18, table: 92.83, ro: 0.133 },
      { model: "PaddleOCR-VL-1.5", size: "0.9B", overall: 94.87, text: 0.038, formula: 96.69, table: 91.67, ro: 0.13 },
      { model: "HunyuanOCR-1.5", size: "1B", overall: 94.74, text: 0.033, formula: 97.49, table: 94.76, ro: 0.127, flag: "*" },
      { model: "Youtu-Parsing", size: "2.5B", overall: 93.68, text: 0.044, formula: 93.45, table: 92.02, ro: 0.116 },
      { model: "Gemini 3 Pro", size: "n/a", overall: 92.85, text: 0.064, formula: 95.83, table: 89.15, ro: 0.165 },
    ],
  },
  owners: {
    label: "OmniDocBench v1.6, the benchmark owners' run",
    note: "The owners' entry links the Hugging Face weights, and their TeleOCR row averages to its own overall.",
    rows: [
      { model: TELE, size: "1.2B", overall: 96.91, text: 0.0267, formula: 96.5895, table: 96.8183, ro: 0.1184 },
      { model: "OvisOCR2", size: "0.8B", overall: 96.47, text: 0.0265, formula: 97.4854, table: 94.5842, ro: 0.112 },
      { model: "PaddleOCR-VL-1.6", size: "0.9B", overall: 96.34, text: 0.0326, formula: 97.5304, table: 94.7619, ro: 0.1278 },
      { model: "MinerU2.5-Pro", size: "1.2B", overall: 95.75, text: 0.036, formula: 97.45, table: 93.42, ro: 0.12 },
      { model: "GLM-OCR", size: "0.9B", overall: 95.22, text: 0.044, formula: 97.18, table: 92.83, ro: 0.133 },
      { model: "PaddleOCR-VL-1.5", size: "0.9B", overall: 94.93, text: 0.038, formula: 96.89, table: 91.67, ro: 0.13 },
      { model: "Unlimited-OCR", size: "3B", overall: 94.0, text: 0.0394, formula: 95.7234, table: 90.21, ro: 0.1281 },
      { model: "Youtu-Parsing", size: "2.5B", overall: 93.74, text: 0.044, formula: 93.63, table: 92.02, ro: 0.116 },
      { model: "Gemini 3 Pro", size: "n/a", overall: 92.91, text: 0.064, formula: 95.99, table: 89.15, ro: 0.165 },
    ],
  },
  wild: {
    label: "Wild-OmniDocBench v1.5, the paper's table",
    note: "Photographed prints and screen re-captures of OmniDocBench v1.5 pages. Authors' own table; no owner leaderboard lists TeleOCR.",
    rows: [
      { model: TELE, size: "1.2B", overall: 88.53, text: 0.1173, formula: 88.26, table: 89.05, ro: 0.2011 },
      { model: "OvisOCR2", size: "0.8B", overall: 87.91, text: 0.129, formula: 90.37, table: 85.13, ro: 0.2021 },
      { model: "PaddleOCR-VL-1.6", size: "0.9B", overall: 87.36, text: 0.1369, formula: 88.42, table: 85.76, ro: 0.2057 },
      { model: "MinerU2.5-Pro", size: "1.2B", overall: 87.33, text: 0.1362, formula: 90.15, table: 85.46, ro: 0.2013 },
      { model: "GLM-OCR", size: "0.9B", overall: 85.08, text: 0.1514, formula: 89.09, table: 81.31, ro: 0.2228 },
      { model: "PaddleOCR-VL-1.5", size: "0.9B", overall: 84.64, text: 0.1461, formula: 86.72, table: 81.8, ro: 0.2138 },
      { model: "dots.ocr", size: "3B", overall: 81.84, text: 0.1483, formula: 85.0, table: 75.32, ro: 0.22 },
      { model: "HunyuanOCR-1.5", size: "1B", overall: 77.62, text: 0.1979, formula: 85.12, table: 67.54, ro: 0.275 },
      { model: "Logics-Parsing-v2", size: "4B", overall: 77.1, text: 0.4029, formula: 91.4, table: 80.19, ro: 0.2355 },
    ],
  },
}

const METRICS: { key: Metric; label: string; lowerBetter: boolean; digits: number }[] = [
  { key: "overall", label: "Overall", lowerBetter: false, digits: 2 },
  { key: "text", label: "Text edit", lowerBetter: true, digits: 4 },
  { key: "formula", label: "Formula CDM", lowerBetter: false, digits: 2 },
  { key: "table", label: "Table TEDS", lowerBetter: false, digits: 2 },
  { key: "ro", label: "Reading-order edit", lowerBetter: true, digits: 4 },
]

const TELE_C = "oklch(0.62 0.17 300)"
const OTHER_C = "oklch(0.62 0.02 260)"

function trim(v: number, digits: number): string {
  // Print as the source did: no padding zeros past what it published.
  const s = v.toFixed(digits)
  return digits > 2 ? s.replace(/0+$/, "").replace(/\.$/, "") : s
}

export function ScoreSplit() {
  const [bench, setBench] = useState<Bench>("owners")
  const [metric, setMetric] = useState<Metric>("overall")
  const [swap, setSwap] = useState(false)

  const set = DATA[bench]
  const m = METRICS.find((x) => x.key === metric)!
  const runnerUpTable = Math.max(...set.rows.filter((r) => r.model !== TELE).map((r) => r.table))

  const value = (r: Row): number => {
    if (swap && metric === "overall" && r.model === TELE) {
      return ((1 - r.text) * 100 + r.formula + runnerUpTable) / 3
    }
    return r[metric]
  }

  const sorted = [...set.rows].sort((a, b) => (m.lowerBetter ? value(a) - value(b) : value(b) - value(a)))
  const vals = sorted.map(value)
  const lo = Math.min(...vals)
  const hi = Math.max(...vals)
  const pad = (hi - lo) * 0.12 || 1
  const floor = lo - pad
  const span = hi + pad - floor
  const rank = sorted.findIndex((r) => r.model === TELE) + 1
  const tele = set.rows.find((r) => r.model === TELE)!

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        Where the lead comes from &middot; one overall score, split back into its parts
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(Object.keys(DATA) as Bench[]).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBench(b)}
              aria-pressed={bench === b}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 text-left font-mono text-[10px] transition-colors",
                bench === b
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {DATA[b].label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {METRICS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setMetric(x.key)}
              aria-pressed={metric === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                metric === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {x.label}
              {x.lowerBetter ? " ↓" : " ↑"}
            </button>
          ))}
        </div>

        <label className="flex cursor-pointer items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input
            type="checkbox"
            checked={swap}
            onChange={(e) => setSwap(e.target.checked)}
            disabled={metric !== "overall"}
          />
          <span className={cn(metric !== "overall" && "opacity-50")}>
            give TeleOCR the runner-up&rsquo;s table score ({trim(runnerUpTable, 4)}) and recompute its overall
          </span>
        </label>

        <div className="space-y-1.5">
          {sorted.map((r) => {
            const v = value(r)
            const pct = ((v - floor) / span) * 100
            const isTele = r.model === TELE
            return (
              <div key={r.model} className="flex items-center gap-3">
                <span
                  className={cn(
                    "w-36 shrink-0 truncate text-right font-mono text-[11px] sm:w-44",
                    isTele ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {r.model}
                  {r.flag ?? ""} <span className="opacity-60">{r.size}</span>
                </span>
                <div className="relative h-5 flex-1">
                  <div
                    className="absolute top-1/2 h-3.5 -translate-y-1/2 rounded-sm"
                    style={{
                      width: `${Math.max(pct, 1).toFixed(2)}%`,
                      background: isTele ? TELE_C : OTHER_C,
                      opacity: isTele && swap && metric === "overall" ? 0.6 : 1,
                    }}
                  />
                  <span
                    className={cn(
                      "absolute top-1/2 -translate-y-1/2 pl-1.5 font-mono text-[10px] tabular-nums",
                      isTele ? "text-foreground" : "text-muted-foreground"
                    )}
                    style={{ left: `${Math.min(pct, 82).toFixed(2)}%` }}
                  >
                    {trim(v, m.digits)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="font-mono text-[10px] text-muted-foreground">
          Axis runs from {trim(floor, 2)} to {trim(hi + pad, 2)}, not from zero: the gaps are small and a zero-based bar
          would hide them. {m.lowerBetter ? "Shorter is better." : "Longer is better."}
        </p>

        <p className="text-sm leading-6 text-muted-foreground">
          {metric === "overall" && swap ? (
            <>
              With the runner-up&rsquo;s tables, TeleOCR&rsquo;s own text and formula scores add up to{" "}
              <span style={{ color: TELE_C }}>{trim(value(tele), 2)}</span>, rank {rank} of {sorted.length}. The first
              place rests on the table score.
            </>
          ) : metric === "table" ? (
            <>
              This is where the lead comes from: TeleOCR&rsquo;s table TEDS is{" "}
              <span style={{ color: TELE_C }}>{trim(tele.table, 2)}</span> against {trim(runnerUpTable, 2)} for the
              best of the rest.
            </>
          ) : metric === "formula" ? (
            <>
              Formulas are TeleOCR&rsquo;s weak column: rank {rank} of {sorted.length} here, behind systems it beats
              overall.
            </>
          ) : (
            <>
              TeleOCR ranks {rank} of {sorted.length} on {m.label.toLowerCase()} in this table.
            </>
          )}
        </p>
        <p className="font-mono text-[10px] leading-4 text-muted-foreground">{set.note}</p>
      </div>
    </figure>
  )
}
