"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Noise baselines (README of qlabs-eng/noise at 00ca1d2) on one loss axis,
// and the forward work per update I count from each training script.
// Every number here is also in the article's prose.

type View = "loss" | "work"

const DUST = "oklch(0.55 0.2 295)"
const BACKPROP = "oklch(0.45 0.02 260)"
const EGG = "oklch(0.72 0.14 65)"

type Entry = { label: string; loss: number; color: string; dashed?: boolean; work: number; workNote: string; hours?: number }

const ROWS: { optimizer: string; entries: Entry[] }[] = [
  {
    optimizer: "SGD",
    entries: [
      { label: "Dust, 16k", loss: 5.058, color: DUST, work: 16384, workNote: "16,384 full forwards", hours: 1.32 },
      { label: "backprop", loss: 5.007, color: BACKPROP, dashed: true, work: 3, workNote: "about 3 forwards" },
    ],
  },
  {
    optimizer: "AdamW",
    entries: [
      { label: "EGGROLL, 128k pairs", loss: 5.954, color: EGG, work: 32768, workNote: "262,144 one-sequence members", hours: 5.33 },
      { label: "Dust, 24k", loss: 4.167, color: DUST, work: 11712, workNote: "11,712 forwards, plus head and attention-internal draws", hours: 1.76 },
      { label: "backprop", loss: 3.769, color: BACKPROP, dashed: true, work: 3, workNote: "about 3 forwards" },
    ],
  },
]

const TARGET = 4.2
const LO = 3.6
const HI = 6.2
const W = 640
const X0 = 24
const X1 = W - 24
const r2 = (n: number) => Math.round(n * 100) / 100
const sx = (loss: number) => r2(X0 + ((loss - LO) / (HI - LO)) * (X1 - X0))

// log10 of each work count, precomputed: Math.log10 may differ by an ULP between server and client.
const LOG10: Record<number, number> = { 3: 0.477, 11712: 4.069, 16384: 4.214, 32768: 4.515 }
const WORK_MAX = 4.6

export function NoiseBoard() {
  const [view, setView] = useState<View>("loss")
  const all = ROWS.flatMap((r) => r.entries.map((e) => ({ ...e, optimizer: r.optimizer })))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Noise baselines · 37.7M GPT · 10M tokens · one epoch
        </span>
        <div className="flex gap-1.5" role="group" aria-label="view">
          {(["loss", "work"] as View[]).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => setView(v)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                view === v
                  ? "border-foreground/30 bg-muted/40 text-foreground"
                  : "border-transparent text-muted-foreground hover:border-foreground/20 hover:text-foreground",
              )}
            >
              {v === "loss" ? "final val loss" : "forward work per update"}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        {view === "loss" ? (
          <>
            {ROWS.map((row) => {
              const dust = row.entries.find((e) => e.label.startsWith("Dust"))
              const bp = row.entries.find((e) => e.label === "backprop")
              const gap = dust && bp ? (dust.loss - bp.loss).toFixed(3) : ""
              return (
                <div key={row.optimizer} className="mb-3">
                  <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
                    <span>{row.optimizer}</span>
                    <span>Dust trails backprop by {gap} nats</span>
                  </div>
                  <svg
                    viewBox={`0 0 ${W} 56`}
                    className="w-full"
                    role="img"
                    aria-label={`${row.optimizer}: ${row.entries.map((e) => `${e.label} ${e.loss}`).join(", ")}. Speedrun target ${TARGET}.`}
                  >
                    <line x1={X0} y1={28} x2={X1} y2={28} stroke="currentColor" strokeOpacity={0.15} />
                    <line x1={sx(TARGET)} y1={6} x2={sx(TARGET)} y2={50} stroke="currentColor" strokeOpacity={0.45} strokeDasharray="3 3" />
                    {row.entries.map((e, i) => (
                      <g key={e.label}>
                        <circle
                          cx={sx(e.loss)}
                          cy={28}
                          r={6}
                          fill={e.dashed ? "none" : e.color}
                          stroke={e.color}
                          strokeWidth={2}
                        />
                        <text
                          x={sx(e.loss)}
                          y={i % 2 ? 50 : 14}
                          textAnchor="middle"
                          className="font-mono"
                          fontSize={11}
                          fill={e.color}
                        >
                          {e.label} {e.loss.toFixed(3)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              )
            })}
            <svg viewBox={`0 0 ${W} 18`} className="w-full" aria-hidden>
              {[3.6, 4.0, 4.4, 4.8, 5.2, 5.6, 6.0].map((t) => (
                <text key={t} x={sx(t)} y={12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={11}>
                  {t.toFixed(1)}
                </text>
              ))}
            </svg>
            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
              dashed line: the speedrun target, {TARGET}. Lower is better. Open circles are backprop, outside the
              competition.
            </p>
          </>
        ) : (
          <>
            <table className="w-full font-mono text-[11px]">
              <tbody>
                {all.map((e) => (
                  <tr key={e.optimizer + e.label} className="border-t border-foreground/5">
                    <td className="w-40 py-1.5 pr-2 align-top text-muted-foreground">
                      {e.label} <span className="opacity-60">({e.optimizer})</span>
                    </td>
                    <td className="py-1.5">
                      <div
                        className="h-2.5 rounded-sm"
                        style={{ width: `${r2((LOG10[e.work] / WORK_MAX) * 100)}%`, background: e.color }}
                      />
                      <div className="mt-0.5 text-muted-foreground">
                        {e.workNote}
                        {e.hours ? ` · ${e.hours} h on 8xH100` : ""}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 font-mono text-[11px] text-muted-foreground">
              Bars on a log scale, in units of one forward pass over the 8-sequence batch. Counted from each
              script&apos;s draw allocation; the hours are the README&apos;s.
            </p>
          </>
        )}
      </div>
    </figure>
  )
}
