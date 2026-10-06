"use client"

import { useState } from "react"

// Every score is copied from Table 1 of the ALoDLM paper (arXiv 2610.04198),
// identical to the table on the amazon/ALoDLM-8B model card. The widget only
// re-averages the benchmarks you leave ticked, so you can see which ones carry
// the "beats its AR parent" margin.

const BENCH = [
  "ARC-C",
  "ARC-E",
  "MMLU",
  "MMLU-Pro",
  "GSM8K",
  "MATH-500",
  "GPQA-Diamond",
  "MBPP",
  "MBPP+",
  "HumanEval",
  "HumanEval+",
]
const CODE = new Set([7, 8, 9, 10])

type Model = { name: string; kind: "AR" | "DLM" | "ours"; s: number[] }

const SCALES: Record<"1.7B" | "8B", Model[]> = {
  "1.7B": [
    { name: "Qwen3-1.7B", kind: "AR", s: [82.4, 90.0, 60.3, 39.0, 83.2, 72.0, 31.3, 61.9, 58.5, 62.8, 60.4] },
    { name: "SDAR-1.7B", kind: "DLM", s: [74.9, 86.5, 63.4, 37.0, 80.1, 62.4, 32.3, 60.3, 59.4, 61.6, 53.0] },
    { name: "ALoDLM-1.7B", kind: "ours", s: [77.7, 88.7, 59.4, 39.6, 85.5, 61.8, 41.4, 65.5, 60.1, 72.6, 67.7] },
  ],
  "8B": [
    { name: "Qwen3-8B", kind: "AR", s: [93.9, 96.1, 76.6, 56.8, 93.6, 81.8, 47.0, 79.0, 74.5, 85.4, 79.3] },
    { name: "LLaDA-8B", kind: "DLM", s: [85.6, 92.6, 62.4, 35.6, 73.8, 42.2, 22.7, 46.0, 43.4, 43.3, 38.4] },
    { name: "Dream-7B", kind: "DLM", s: [84.3, 93.0, 68.4, 42.0, 82.0, 42.0, 23.7, 65.5, 60.6, 53.7, 50.0] },
    { name: "Fast-dLLM-v2-7B", kind: "DLM", s: [77.2, 83.4, 66.7, 40.6, 85.1, 58.2, 21.2, 61.9, 50.0, 65.9, 61.0] },
    { name: "SDAR-8B", kind: "DLM", s: [90.0, 93.4, 78.5, 56.3, 91.4, 77.0, 38.4, 72.0, 67.9, 78.0, 73.2] },
    { name: "WeDLM-8B", kind: "DLM", s: [91.9, 97.5, 78.0, 58.3, 93.3, 77.8, 37.4, 74.3, 63.5, 79.9, 74.4] },
    { name: "ALoDLM-8B", kind: "ours", s: [94.4, 98.1, 76.6, 63.9, 94.2, 80.8, 49.5, 81.5, 72.5, 87.8, 84.2] },
  ],
}

function avg(s: number[], on: boolean[]) {
  let sum = 0
  let n = 0
  s.forEach((v, i) => {
    if (on[i]) {
      sum += v
      n += 1
    }
  })
  return n ? sum / n : 0
}

function signed(x: number) {
  return `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)}`
}

export function TableOne() {
  const [scale, setScale] = useState<"1.7B" | "8B">("8B")
  const [on, setOn] = useState<boolean[]>(BENCH.map(() => true))
  const models = SCALES[scale]
  const ours = models.find((m) => m.kind === "ours")!
  const ar = models.find((m) => m.kind === "AR")!
  const ranked = [...models].sort((a, b) => avg(b.s, on) - avg(a.s, on))
  const bestDlm = ranked.find((m) => m.kind === "DLM")!
  const count = on.filter(Boolean).length
  let wins = 0
  let ties = 0
  let losses = 0
  BENCH.forEach((_, i) => {
    if (!on[i]) return
    const d = ours.s[i] - ar.s[i]
    if (d > 0.05) wins += 1
    else if (d < -0.05) losses += 1
    else ties += 1
  })
  const dAr = avg(ours.s, on) - avg(ar.s, on)
  const dDlm = avg(ours.s, on) - avg(bestDlm.s, on)
  const top = ranked.length ? avg(ranked[0].s, on) : 1

  const preset = (f: (i: number) => boolean) => setOn(BENCH.map((_, i) => f(i)))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">re-average Table 1 · ALoDLM paper</span>
        <span className="font-mono text-[10px] text-muted-foreground">greedy, one token per pass, 4,096-token cap</span>
      </div>
      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-2 font-mono text-xs">
          {(["8B", "1.7B"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScale(s)}
              className={
                scale === s
                  ? "rounded-md border border-foreground/50 bg-muted px-2.5 py-1"
                  : "rounded-md border px-2.5 py-1 text-muted-foreground"
              }
            >
              {s}
            </button>
          ))}
          <span className="mx-1 self-center text-muted-foreground">|</span>
          <button type="button" className="rounded-md border px-2.5 py-1" onClick={() => preset(() => true)}>
            all 11
          </button>
          <button type="button" className="rounded-md border px-2.5 py-1" onClick={() => preset((i) => !CODE.has(i))}>
            no code
          </button>
          <button type="button" className="rounded-md border px-2.5 py-1" onClick={() => preset((i) => CODE.has(i))}>
            code only
          </button>
          <button type="button" className="rounded-md border px-2.5 py-1" onClick={() => preset((i) => i !== 3)}>
            drop MMLU-Pro
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {BENCH.map((b, i) => {
            const d = ours.s[i] - ar.s[i]
            return (
              <label
                key={b}
                className={
                  on[i]
                    ? "flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[11px]"
                    : "flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed px-2 py-1 font-mono text-[11px] opacity-50"
                }
              >
                <input
                  type="checkbox"
                  checked={on[i]}
                  onChange={() => setOn(on.map((v, j) => (j === i ? !v : v)))}
                />
                {b}
                <span className={d > 0.05 ? "text-emerald-600" : d < -0.05 ? "text-rose-600" : "text-muted-foreground"}>
                  {d >= 0 ? "+" : "−"}
                  {Math.abs(d).toFixed(1)}
                </span>
              </label>
            )
          })}
        </div>

        <div className="space-y-1">
          {ranked.map((m) => {
            const v = avg(m.s, on)
            return (
              <div key={m.name} className="flex items-center gap-2 font-mono text-[11px]">
                <span className="w-32 shrink-0 truncate">{m.name}</span>
                <div className="h-3 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-3 rounded-sm"
                    style={{
                      width: `${count ? (v / top) * 100 : 0}%`,
                      background:
                        m.kind === "ours"
                          ? "oklch(0.55 0.15 255)"
                          : m.kind === "AR"
                            ? "oklch(0.6 0.1 150)"
                            : "oklch(0.7 0.03 260)",
                    }}
                  />
                </div>
                <span className="w-10 text-right">{count ? v.toFixed(2) : "–"}</span>
              </div>
            )
          })}
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Stat k={`${ours.name} − ${ar.name}`} v={count ? signed(dAr) : "–"} hl />
          <Stat k={`${ours.name} − best DLM (${bestDlm.name})`} v={count ? signed(dDlm) : "–"} />
          <Stat k="vs its AR parent: wins / ties / losses" v={`${wins} / ${ties} / ${losses} of ${count}`} />
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Numbers next to each benchmark are ALoDLM minus its Qwen3 parent. The paper averages all eleven with equal
          weight; HumanEval has 164 problems and GPQA-Diamond 198 questions, so one problem moves them by about 0.6 and
          0.5 points.
        </p>
      </div>
    </figure>
  )
}

function Stat({ k, v, hl }: { k: string; v: string; hl?: boolean }) {
  return (
    <div className={hl ? "rounded-lg border border-foreground/40 bg-muted/40 px-3 py-2" : "rounded-lg border px-3 py-2"}>
      <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
      <div className="mt-0.5 font-mono text-sm">{v}</div>
    </div>
  )
}
