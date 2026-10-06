"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// Every number below is the paper's own (arXiv 2610.02185, Table A11):
// LoopCD-Logits at w = 0.5, with the reference taken after iteration k.
// "alone" = the reference's own accuracy, "disagrees" = share of questions on
// which it picks a different option from the final prediction, "gain" = points
// added by LoopCD over the unguided final prediction. Huginn's HellaSwag block
// has no k = 1 row in the paper, so none is shown.

type Row = { k: number; alone: number; dis: number; gain: number }
type Block = { final: number; rows: Row[] }
type Bench = "arc" | "hella"

const DATA: Record<string, Record<Bench, Block>> = {
  "Huginn-0125": {
    arc: {
      final: 37.54,
      rows: [
        { k: 1, alone: 22.78, dis: 51.3, gain: 3.07 },
        { k: 2, alone: 22.1, dis: 46.8, gain: 1.79 },
        { k: 4, alone: 30.12, dis: 35.8, gain: 0.94 },
        { k: 6, alone: 32.25, dis: 29.5, gain: 1.11 },
        { k: 8, alone: 33.45, dis: 20.0, gain: 0.6 },
        { k: 16, alone: 37.2, dis: 7.3, gain: 0.17 },
        { k: 24, alone: 38.05, dis: 2.7, gain: 0.17 },
      ],
    },
    hella: {
      final: 66.74,
      rows: [
        { k: 2, alone: 34.4, dis: 44.2, gain: 4.31 },
        { k: 4, alone: 46.35, dis: 27.6, gain: 4.12 },
        { k: 6, alone: 56.36, dis: 15.3, gain: 2.58 },
        { k: 8, alone: 61.3, dis: 9.4, gain: 1.47 },
        { k: 16, alone: 66.33, dis: 2.3, gain: 0.09 },
        { k: 24, alone: 66.62, dis: 0.8, gain: 0.05 },
      ],
    },
  },
  "Parcae-1.3B": {
    arc: {
      final: 40.36,
      rows: [
        { k: 1, alone: 32.34, dis: 30.0, gain: 3.5 },
        { k: 2, alone: 38.91, dis: 18.1, gain: 2.39 },
        { k: 4, alone: 40.36, dis: 9.7, gain: 1.54 },
        { k: 6, alone: 41.04, dis: 7.0, gain: 1.02 },
      ],
    },
    hella: {
      final: 56.28,
      rows: [
        { k: 1, alone: 44.39, dis: 19.9, gain: 2.9 },
        { k: 2, alone: 50.76, dis: 11.4, gain: 1.68 },
        { k: 4, alone: 55.01, dis: 5.7, gain: 0.47 },
        { k: 6, alone: 56.09, dis: 3.6, gain: 0.13 },
      ],
    },
  },
  "Ouro-1.4B": {
    arc: {
      final: 60.41,
      rows: [
        { k: 1, alone: 38.65, dis: 40.2, gain: 2.13 },
        { k: 2, alone: 54.86, dis: 17.0, gain: 0.09 },
        { k: 3, alone: 59.56, dis: 6.1, gain: 0.34 },
      ],
    },
    hella: {
      final: 74.52,
      rows: [
        { k: 1, alone: 55.39, dis: 31.1, gain: 0.76 },
        { k: 2, alone: 71.47, dis: 10.8, gain: 0.33 },
        { k: 3, alone: 73.95, dis: 3.1, gain: 0.03 },
      ],
    },
  },
  "Ouro-2.6B": {
    arc: {
      final: 66.21,
      rows: [
        { k: 1, alone: 47.95, dis: 30.6, gain: 2.56 },
        { k: 2, alone: 62.29, dis: 10.7, gain: 0.51 },
        { k: 3, alone: 65.36, dis: 3.4, gain: 0.6 },
      ],
    },
    hella: {
      final: 79.47,
      rows: [
        { k: 1, alone: 68.89, dis: 18.0, gain: 1.56 },
        { k: 2, alone: 77.84, dis: 6.6, gain: 0.86 },
        { k: 3, alone: 79.23, dis: 2.6, gain: 0.03 },
      ],
    },
  },
}

const MODELS = Object.keys(DATA)
const BENCH: Record<Bench, string> = { arc: "ARC-Challenge", hella: "HellaSwag" }
const C_DIS = "oklch(0.66 0.13 45)"
const C_GAIN = "oklch(0.6 0.13 250)"
const GAIN_MAX = 4.5

export function ReferencePicker() {
  const [model, setModel] = useState("Huginn-0125")
  const [bench, setBench] = useState<Bench>("arc")
  const block = DATA[model][bench]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">which loop is the amateur · paper Table A11</span>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(BENCH) as Bench[]).map((b) => (
            <Pill key={b} on={bench === b} onClick={() => setBench(b)}>
              {BENCH[b]}
            </Pill>
          ))}
        </div>
      </div>
      <div className="space-y-3 px-4 py-4">
        <div className="flex flex-wrap gap-1">
          {MODELS.map((m) => (
            <Pill key={m} on={model === m} onClick={() => setModel(m)}>
              {m}
            </Pill>
          ))}
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          unguided final prediction: {block.final.toFixed(2)}% · LoopCD-Logits at ω = 0.5
        </p>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[28rem] border-collapse font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-2 font-normal">ref k</th>
                <th className="py-1 pr-2 font-normal">alone</th>
                <th className="w-2/5 py-1 pr-2 font-normal" style={{ color: C_DIS }}>
                  disagrees with final
                </th>
                <th className="w-2/5 py-1 font-normal" style={{ color: C_GAIN }}>
                  gain (points)
                </th>
              </tr>
            </thead>
            <tbody>
              {block.rows.map((r) => (
                <tr key={r.k} className="border-t border-border/60">
                  <td className="py-1.5 pr-2 font-semibold">h{r.k}</td>
                  <td className="py-1.5 pr-2 tabular-nums">{r.alone.toFixed(2)}%</td>
                  <td className="py-1.5 pr-2">
                    <Bar frac={r.dis / 60} color={C_DIS} text={`${r.dis.toFixed(1)}%`} />
                  </td>
                  <td className="py-1.5">
                    <Bar frac={r.gain / GAIN_MAX} color={C_GAIN} text={`+${r.gain.toFixed(2)}`} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] leading-relaxed text-muted-foreground">
          The gain follows the disagreement column, not the accuracy column: a reference that is nearly as accurate as
          the final prediction, but agrees with it, has no direction left to give. Reported numbers, ARC-Challenge and
          HellaSwag only.
        </p>
      </div>
    </figure>
  )
}

function Pill({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
        on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  )
}

function Bar({ frac, color, text }: { frac: number; color: string; text: string }) {
  const w = Math.max(0.01, Math.min(1, frac))
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted/40">
        <div className="h-full rounded-full" style={{ width: `${(w * 100).toFixed(1)}%`, background: color }} />
      </div>
      <span className="w-12 text-right tabular-nums">{text}</span>
    </div>
  )
}
