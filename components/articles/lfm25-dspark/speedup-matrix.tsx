"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Three draft models, five datasets, two very different machines.
//
// Every number is from Tables 2-4 of the release post. Same protocol
// throughout: DSpark block size 9, batch size 1, temperature 0, up to 256 output
// tokens. GPU is SGLang on one H100 80 GB in BF16; on-device is llama.cpp with
// Metal on an M4 Max MacBook Pro using FP16 GGUF weights.
//
// The reason this is worth being able to sort is that acceptance length and
// realized speedup come apart, badly, and in a direction that is easy to miss.
// LFM2.5-8B-A1B has the HIGHEST acceptance of the three — 6.95 of a possible 10,
// against 5.02 and 4.81 for the dense models — and the WORST on-device speedup, at
// 1.18x. The draft is doing its job. The hardware is not paying for it.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

type Cell = { task: string; accept: number; h100: [number, number]; mac: [number, number] }

const MODELS: { key: string; label: string; sub: string; rows: Cell[]; mean: Cell }[] = [
  {
    key: "1.2b",
    label: "LFM2.5-1.2B-Instruct",
    sub: "dense · non-reasoning · 295.7M draft",
    rows: [
      { task: "MATH500", accept: 6.02, h100: [668, 1712], mac: [140, 366] },
      { task: "HumanEval", accept: 5.31, h100: [664, 1499], mac: [136, 389] },
      { task: "MBPP", accept: 5.52, h100: [667, 1578], mac: [137, 375] },
      { task: "GSM8K", accept: 4.34, h100: [624, 1041], mac: [140, 381] },
      { task: "MT-Bench", accept: 3.9, h100: [657, 1091], mac: [137, 237] },
    ],
    mean: { task: "mean", accept: 5.02, h100: [656, 1384], mac: [138, 350] },
  },
  {
    key: "2.6b",
    label: "LFM2.5-2.6B",
    sub: "dense · reasoning · 327.7M draft",
    rows: [
      { task: "MATH500", accept: 5.42, h100: [326, 1000], mac: [61, 137] },
      { task: "HumanEval", accept: 4.54, h100: [326, 835], mac: [61, 161] },
      { task: "MBPP", accept: 4.71, h100: [326, 861], mac: [62, 132] },
      { task: "GSM8K", accept: 4.32, h100: [312, 693], mac: [60, 143] },
      { task: "MT-Bench", accept: 5.07, h100: [325, 933], mac: [62, 123] },
    ],
    mean: { task: "mean", accept: 4.81, h100: [323, 864], mac: [61, 139] },
  },
  {
    key: "8b",
    label: "LFM2.5-8B-A1B",
    sub: "MoE · reasoning · 327.7M draft",
    rows: [
      { task: "MATH500", accept: 8.27, h100: [428, 1362], mac: [93, 112] },
      { task: "HumanEval", accept: 7.02, h100: [426, 1100], mac: [91, 101] },
      { task: "MBPP", accept: 6.93, h100: [426, 1122], mac: [89, 97] },
      { task: "GSM8K", accept: 4.02, h100: [385, 496], mac: [90, 129] },
      { task: "MT-Bench", accept: 8.52, h100: [426, 1288], mac: [87, 90] },
    ],
    mean: { task: "mean", accept: 6.95, h100: [418, 1074], mac: [90, 106] },
  },
]

const sp = (p: [number, number]) => p[1] / p[0]

export function SpeedupMatrix() {
  const [sel, setSel] = useState("8b")
  const [hw, setHw] = useState<"h100" | "mac">("mac")
  const m = MODELS.find((x) => x.key === sel) ?? MODELS[0]
  const rows = [...m.rows, m.mean]
  const maxSp = 3.3

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          block 9 · batch size 1 · temperature 0 · greedy output identical to baseline
        </span>
        <span className="font-mono text-[10px]" style={{ color: sp(m.mean[hw]) > 2 ? GOOD : WARM }}>
          mean {sp(m.mean[hw]).toFixed(2)}× · accepts {m.mean.accept.toFixed(2)} of 10
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {MODELS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setSel(x.key)}
              aria-pressed={sel === x.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === x.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {(
            [
              ["mac", "M4 Max · llama.cpp + Metal"],
              ["h100", "H100 80 GB · SGLang"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setHw(k)}
              aria-pressed={hw === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                hw === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-1 font-mono text-[9px] text-muted-foreground">{m.sub}</div>

        <div className="mt-3 space-y-1">
          {rows.map((r) => {
            const pair = r[hw]
            const s = sp(pair)
            const isMean = r.task === "mean"
            return (
              <div
                key={r.task}
                className={cn("flex items-center gap-2 rounded-md px-1.5 py-1", isMean && "bg-muted/30")}
              >
                <span className="w-20 shrink-0 truncate text-right font-mono text-[10px] text-foreground">
                  {r.task}
                </span>
                <div className="h-8 w-16 shrink-0">
                  <div className="h-3 rounded-sm bg-muted/40">
                    <div
                      className="h-3 rounded-sm"
                      style={{ width: `${(r.accept / 10) * 100}%`, background: GOOD, opacity: 0.8 }}
                      title={`acceptance ${r.accept} of 10`}
                    />
                  </div>
                  <div className="mt-0.5 font-mono text-[9px] tabular-nums" style={{ color: GOOD }}>
                    {r.accept.toFixed(2)}
                  </div>
                </div>
                <div className="h-4 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{ width: `${Math.min(100, (s / maxSp) * 100)}%`, background: s >= 2 ? ACCENT : WARM }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: s >= 2 ? ACCENT : WARM }}>
                  {s.toFixed(2)}×
                </span>
                <span className="w-28 shrink-0 text-right font-mono text-[9px] tabular-nums text-muted-foreground">
                  {pair[0]} → {pair[1]}
                </span>
              </div>
            )
          })}
        </div>

        <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1">
          <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: GOOD, opacity: 0.8 }} />
            acceptance length, of a possible 10
          </span>
          <span className="flex items-center gap-1 font-mono text-[9px] text-muted-foreground">
            <span className="inline-block h-2 w-3 rounded-sm" style={{ background: ACCENT }} />
            realized throughput speedup (tok/s)
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Select the 8B-A1B and stay on the MacBook. Its draft is the{" "}
          <em>best</em>{" "}of the three by the metric that is supposed to matter — 6.95 accepted tokens of a
          possible 10, against 5.02 for the 1.2B — and it delivers{" "}
          <span className="text-foreground">1.18×</span>, where the 1.2B delivers 2.54×. On MT-Bench it accepts
          8.52 tokens per pass and returns 1.04×: essentially nothing.
          <br />
          <br />
          Switch to the H100 and the same checkpoint returns 2.54×. Nothing about the draft changed. What changed
          is that verifying nine tokens through a mixture-of-experts touches far more expert weight than decoding
          one does, and on a machine whose Metal MoE path is not built for it, that extra traffic eats the entire
          win. Acceptance length is a property of the draft model; speedup is a property of the draft model{" "}
          <em>and the machine</em>, and this table is the cleanest illustration of the difference I have seen
          published.
        </p>
      </div>
    </figure>
  )
}
