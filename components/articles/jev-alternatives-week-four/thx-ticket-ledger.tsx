"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// THX-01's support-ticket arena, read straight out of the file the release ships:
// results/thx01/tickets_arena.json in doofz/THX-01 (Hub commit of 2026-10-08).
//
// Top: the row the model card prints (it matches the file's `thx01_v10c_s15` entry to the
// last digit), TypeSafe Jev (`jev`, called through OpenRouter as ~typesafe/jev-latest), and
// the checkpoint the card's own robustness chart labels "THX-01-Zero", whose four numbers
// match the file's `system01_v8`. Accuracy or ECE (10 bins, the arena script's definition).
//
// Bottom: every THX-family checkpoint in the same file, scored on the same four test sets.
// Eighteen of them. The line is Jev. Nothing here is a model run of mine.

type SetKey = "clean" | "corrupted" | "messy" | "independent"

const SETS: { key: SetKey; name: string; n: number; who: string }[] = [
  { key: "clean", name: "Clean", n: 800, who: "written by Wahoo 1.5, a teacher model in training" },
  { key: "corrupted", name: "Corrupted", n: 726, who: "programmatic typos, transliteration, stripped diacritics: the same corruptions stage 5 trained on" },
  { key: "messy", name: "Messy", n: 600, who: "written messy on purpose by Wahoo 1.5, as stage 5's training messages were" },
  { key: "independent", name: "Independent", n: 717, who: "written by GPT-6-Luna; this set was never trained on, though Luna also wrote training messages" },
]

type Row = Record<SetKey, number>

const ACC: Record<"thx" | "jev" | "zero", Row> = {
  thx: { clean: 0.9925, corrupted: 0.9766, messy: 0.9883, independent: 0.9791 },
  jev: { clean: 0.9925, corrupted: 0.9504, messy: 0.9617, independent: 0.9902 },
  zero: { clean: 0.94, corrupted: 0.8898, messy: 0.9417, independent: 0.9623 },
}

const ECE: Record<"thx" | "jev", Row> = {
  thx: { clean: 0.0111, corrupted: 0.0303, messy: 0.0176, independent: 0.0034 },
  jev: { clean: 0.012, corrupted: 0.0193, messy: 0.0142, independent: 0.0074 },
}

// [name in the file, clean, corrupted, messy, independent]
const CKPTS: [string, number, number, number, number][] = [
  ["system01_v6", 0.9, 0.7617, 0.8617, 0.8466],
  ["system01_v7", 0.9125, 0.8444, 0.8917, 0.908],
  ["system01_v8", 0.94, 0.8898, 0.9417, 0.9623],
  ["system01_v9", 0.9438, 0.8912, 0.935, 0.961],
  ["system01_tickets", 0.9863, 0.9573, 0.9833, 0.9861],
  ["system01_tickets_soup", 0.9913, 0.9669, 0.9883, 0.9847],
  ["system01_tickets_v9", 0.99, 0.9725, 0.9867, 0.9833],
  ["tk_ens2", 0.9925, 0.9725, 0.9883, 0.9833],
  ["tk_soup_tta4", 0.9925, 0.9711, 0.985, 0.9819],
  ["tk_v9_tta4", 0.9938, 0.9697, 0.9883, 0.9805],
  ["mix15", 0.9925, 0.9711, 0.9867, 0.9833],
  ["mix30", 0.9888, 0.9683, 0.9783, 0.9874],
  ["thx01_num", 0.9913, 0.9711, 0.985, 0.9847],
  ["thx01_num_s15", 0.9925, 0.9725, 0.9883, 0.9833],
  ["thx01_num_s30", 0.9925, 0.9725, 0.9883, 0.9819],
  ["thx01_final", 0.9913, 0.978, 0.99, 0.9819],
  ["thx01_v10", 0.9938, 0.9725, 0.9867, 0.9833],
  ["thx01_v10c_s15", 0.9925, 0.9766, 0.9883, 0.9791],
]

const SHIPPED = "thx01_v10c_s15"
const IDX: Record<SetKey, 1 | 2 | 3 | 4> = { clean: 1, corrupted: 2, messy: 3, independent: 4 }

const C_THX = "oklch(0.58 0.2 0)"
const C_JEV = "oklch(0.62 0.11 180)"
const C_ZERO = "oklch(0.78 0.08 0)"

const pct = (x: number) => (x * 100).toFixed(1)

export function ThxTicketLedger() {
  const [metric, setMetric] = useState<"acc" | "ece">("acc")
  const [set, setSet] = useState<SetKey>("independent")

  const pill = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  // bar scale: accuracy from 85% to 100%, ECE from 0 to 0.035
  const accW = (x: number) => Math.max(0, Math.min(100, ((x - 0.85) / 0.15) * 100))
  const eceW = (x: number) => Math.max(0, Math.min(100, (x / 0.035) * 100))

  const jevLine = ACC.jev[set]
  const vals = CKPTS.map((c) => ({ name: c[0], v: c[IDX[set]] }))
  const above = vals.filter((x) => x.v > jevLine).length
  const tied = vals.filter((x) => x.v === jevLine).length
  const lo = 0.75
  const x = (v: number) => ((v - lo) / (1 - lo)) * 100
  const meta = SETS.find((s) => s.key === set) ?? SETS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">THX-01 vs Jev, from tickets_arena.json</span>
        <div className="flex gap-1.5">
          <button type="button" className={pill(metric === "acc")} onClick={() => setMetric("acc")}>
            accuracy
          </button>
          <button type="button" className={pill(metric === "ece")} onClick={() => setMetric("ece")}>
            ECE
          </button>
        </div>
      </div>

      <div className="grid gap-4 px-4 py-4 sm:grid-cols-2">
        {SETS.map((s) => {
          const rows =
            metric === "acc"
              ? [
                  { label: "THX-01", v: ACC.thx[s.key], c: C_THX },
                  { label: "Jev", v: ACC.jev[s.key], c: C_JEV },
                  { label: "THX-01-Zero", v: ACC.zero[s.key], c: C_ZERO },
                ]
              : [
                  { label: "THX-01", v: ECE.thx[s.key], c: C_THX },
                  { label: "Jev", v: ECE.jev[s.key], c: C_JEV },
                ]
          const best =
            metric === "acc"
              ? Math.max(ACC.thx[s.key], ACC.jev[s.key])
              : Math.min(ECE.thx[s.key], ECE.jev[s.key])
          return (
            <button
              type="button"
              key={s.key}
              onClick={() => setSet(s.key)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                set === s.key ? "border-foreground/30 bg-muted/30" : "border-border hover:bg-muted/20",
              )}
            >
              <div className="mb-2 flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium">{s.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">n = {s.n}</span>
              </div>
              {rows.map((r) => (
                <div key={r.label} className="mb-1 flex items-center gap-2">
                  <span className="w-24 shrink-0 font-mono text-[10px] text-muted-foreground">{r.label}</span>
                  <div className="relative h-3 flex-1 rounded-sm bg-muted/40">
                    <div
                      className="absolute inset-y-0 left-0 rounded-sm"
                      style={{ width: `${metric === "acc" ? accW(r.v) : eceW(r.v)}%`, background: r.c }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right font-mono text-[11px]",
                      r.label !== "THX-01-Zero" && r.v === best ? "font-semibold text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {metric === "acc" ? pct(r.v) : r.v.toFixed(3)}
                  </span>
                </div>
              ))}
            </button>
          )
        })}
      </div>

      <div className="border-t px-4 py-4">
        <div className="mb-1 font-mono text-[11px] text-muted-foreground">
          {meta.name}: every THX checkpoint in the file, same {meta.n} tickets
        </div>
        <svg viewBox="0 0 100 18" className="h-16 w-full" preserveAspectRatio="none" aria-hidden="true">
          <line x1={0} x2={100} y1={12} y2={12} stroke="currentColor" strokeOpacity={0.2} strokeWidth={0.3} />
          <line x1={x(jevLine)} x2={x(jevLine)} y1={2} y2={16} stroke={C_JEV} strokeWidth={0.6} />
          {vals.map((d, i) => (
            <circle
              key={d.name}
              cx={x(d.v)}
              cy={d.name === SHIPPED ? 12 : 6 + (i % 3) * 2}
              r={d.name === SHIPPED ? 1.1 : 0.7}
              fill={d.name === SHIPPED ? C_THX : C_ZERO}
              stroke={d.name === SHIPPED ? "currentColor" : "none"}
              strokeWidth={0.25}
            />
          ))}
        </svg>
        <div className="flex justify-between font-mono text-[10px] text-muted-foreground">
          <span>75%</span>
          <span>100%</span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          The line is Jev at {pct(jevLine)}%. Of 18 checkpoints, {above} score above it and {tied} tie it. The ringed dot
          is the row the card prints. This set was {meta.who}.
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Click a set to see the checkpoints on it. Numbers are the release&apos;s own file; the card&apos;s headline averages
        these four sets, two of which come from the generators THX-01 was trained on.
      </figcaption>
    </figure>
  )
}
