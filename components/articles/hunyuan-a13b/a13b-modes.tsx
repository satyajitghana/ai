"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Slow thinking vs fast thinking, same weights, per benchmark.
// Numbers are the report's own: Table 3 (slow-thinking mode) and Table 4
// (fast-thinking mode). Qwen3-A22B appears in both tables, so it is the one
// baseline that can be compared mode against mode. The 20 rows are the
// benchmarks the two tables share (ArtifactsBench is only in Table 3, McEval
// only in Table 4). The report gives no token counts per mode, so there is no
// cost axis here — only accuracy. Only + - * / and toFixed reach the DOM.

const SLOW = "oklch(0.60 0.16 45)"
const FAST = "oklch(0.62 0.12 230)"

type Row = {
  name: string
  cat: string
  own?: boolean // Tencent's own or internal benchmark
  a13b: [number, number] // [slow, fast]
  qwen: [number, number]
}

const ROWS: Row[] = [
  { name: "AIME 2024", cat: "maths", a13b: [87.3, 30.6], qwen: [85.7, 40.1] },
  { name: "AIME 2025", cat: "maths", a13b: [76.8, 19.2], qwen: [81.5, 24.7] },
  { name: "MATH", cat: "maths", a13b: [94.3, 85.4], qwen: [94, 87.2] },
  { name: "GPQA-Diamond", cat: "science", a13b: [71.2, 61.8], qwen: [71.1, 62.9] },
  { name: "OlympiadBench", cat: "science", a13b: [82.7, 64.1], qwen: [85.7, 69.9] },
  { name: "LiveCodeBench", cat: "code", a13b: [63.9, 27.4], qwen: [70.7, 35.3] },
  { name: "FullstackBench", cat: "code", a13b: [67.8, 58.3], qwen: [65.6, 57.8] },
  { name: "BBH", cat: "reasoning", a13b: [89.1, 87], qwen: [88.9, 68.1] },
  { name: "DROP", cat: "reasoning", a13b: [91.1, 86.5], qwen: [90.3, 82.4] },
  { name: "ZebraLogic", cat: "reasoning", a13b: [84.7, 36.5], qwen: [80.3, 37.7] },
  { name: "IF-Eval", cat: "instructions", a13b: [84.7, 84.4], qwen: [83.4, 83.2] },
  { name: "SysBench", cat: "instructions", a13b: [76.1, 70.2], qwen: [74.2, 72.1] },
  { name: "LengthCtrl", cat: "text", own: true, a13b: [55.4, 53.9], qwen: [53.3, 54.7] },
  { name: "InsCtrl", cat: "text", own: true, a13b: [71.9, 68.9], qwen: [73.7, 71.2] },
  { name: "ComplexNLU", cat: "understanding", own: true, a13b: [61.2, 54.5], qwen: [59.8, 56.7] },
  { name: "Word-Task", cat: "understanding", own: true, a13b: [62.9, 53.4], qwen: [56.4, 56.4] },
  { name: "BFCL v3", cat: "agent", a13b: [78.3, 65.9], qwen: [70.8, 68] },
  { name: "τ-Bench", cat: "agent", a13b: [54.7, 42.6], qwen: [44.6, 36.4] },
  { name: "ComplexFuncBench", cat: "agent", a13b: [61.2, 74], qwen: [40.6, 38.1] },
  { name: "C3-Bench", cat: "agent", own: true, a13b: [63.5, 65.4], qwen: [51.7, 48.4] },
]

const MODELS = [
  { id: "a13b", label: "Hunyuan-A13B" },
  { id: "qwen", label: "Qwen3-A22B" },
] as const
type ModelId = (typeof MODELS)[number]["id"]

// gap in tenths, as an integer, so every comparison and sort is exact
const gapTenths = (r: Row, m: ModelId) => Math.round(r[m][0] * 10) - Math.round(r[m][1] * 10)
const signed = (tenths: number) => `${tenths > 0 ? "+" : tenths < 0 ? "−" : "±"}${(Math.abs(tenths) / 10).toFixed(1)}`

export function A13bModes() {
  const [model, setModel] = useState<ModelId>("a13b")
  const [sorted, setSorted] = useState(true)

  const rows = sorted
    ? ROWS.slice().sort((x, y) => gapTenths(y, model) - gapTenths(x, model) || (x.name < y.name ? -1 : 1))
    : ROWS

  const gaps = ROWS.map((r) => gapTenths(r, model)).sort((x, y) => x - y)
  const median = (gaps[9] + gaps[10]) / 2 // 20 rows
  const fastWins = gaps.filter((g) => g < 0).length
  const big = gaps.filter((g) => g >= 300).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>same weights, two modes · reported accuracy</span>
        <span className="text-muted-foreground/50">report Tables 3 and 4</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModel(m.id)}
              aria-pressed={m.id === model}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                m.id === model ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setSorted((v) => !v)}
            aria-pressed={sorted}
            className="ml-auto cursor-pointer rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            {sorted ? "sorted by gap" : "in table order"}
          </button>
        </div>

        <div className="mb-2 flex flex-wrap gap-x-4 font-mono text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: SLOW }} />
            slow thinking (default, /think)
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: FAST }} />
            fast thinking (/no_think)
          </span>
          <span>* Tencent&apos;s own or internal benchmark</span>
        </div>

        <div className="space-y-1">
          {rows.map((r) => {
            const [s, f] = r[model]
            const g = gapTenths(r, model)
            return (
              <div key={r.name} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-right font-mono text-[10px] text-muted-foreground sm:w-32">
                  {r.name}
                  {r.own ? "*" : ""}
                </span>
                <div className="relative h-5 flex-1 rounded-sm bg-muted/30">
                  <div
                    className="absolute top-0.5 left-0 h-1.5 rounded-sm transition-all"
                    style={{ width: `${s}%`, background: SLOW }}
                    title={`slow ${s.toFixed(1)}`}
                  />
                  <div
                    className="absolute bottom-0.5 left-0 h-1.5 rounded-sm transition-all"
                    style={{ width: `${f}%`, background: FAST }}
                    title={`fast ${f.toFixed(1)}`}
                  />
                </div>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {s.toFixed(1)}
                </span>
                <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                  {f.toFixed(1)}
                </span>
                <span
                  className={cn(
                    "w-12 shrink-0 text-right font-mono text-[11px] tabular-nums",
                    g < 0 ? "font-medium" : "text-muted-foreground"
                  )}
                  style={g < 0 ? { color: FAST } : g >= 300 ? { color: SLOW } : undefined}
                >
                  {signed(g)}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3 border-t pt-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">median gap</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: SLOW }}>
              {(median / 10).toFixed(2)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">points, slow minus fast</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">gap of 30 or more</div>
            <div className="font-mono text-lg text-foreground tabular-nums">{big} of 20</div>
            <div className="font-mono text-[9px] text-muted-foreground">competition maths, code, logic</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">fast beats slow</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: FAST }}>
              {fastWins} of 20
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">same weights, no thinking</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The report prints accuracy for each mode but no token counts, so this chart has no cost axis: what the
          fast mode saves is not measured anywhere in it. What it does show is where thinking pays. Without it, Hunyuan-A13B
          loses 36.5 to 57.6 points on competition maths, contest code and logic puzzles; instruction following barely
          moves; and on two of its four agent benchmarks the fast mode scores{" "}
          <span className="text-foreground">higher</span>.
        </p>
      </div>
    </figure>
  )
}
