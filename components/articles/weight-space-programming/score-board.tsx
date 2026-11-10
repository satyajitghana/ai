"use client"

import { useState } from "react"

import { SCORE_ROWS, type ScoreRow } from "./scores"

// Every MATH-500 and IFEval number in the argument, on one axis, with where it
// comes from. "reported" rows are copied from their sources (the post, the
// edited model's repository, Qwen's model card, the logs, two replies on X);
// "measured" rows are mine. The rows differ in protocol (thinking or not,
// samples per problem, token cap, number of problems), which is the point of
// the widget: the protocol is written next to every bar, and a bar is only
// comparable with another bar that shares it.

const ACCENT = "oklch(0.62 0.16 35)"
const BLUE = "oklch(0.60 0.15 255)"
const GREY = "oklch(0.62 0.02 255)"
const MONO = "ui-monospace, monospace"

const W = 640
const LX = 210
const RX = W - 46
const ROW = 30

const color = (r: ScoreRow) => (r.edited ? ACCENT : r.kind === "other" ? GREY : BLUE)

export function ScoreBoard() {
  const [bench, setBench] = useState<"MATH-500" | "IFEval">("MATH-500")
  const rows = SCORE_ROWS.filter((r) => r.bench === bench)
  const H = rows.length * ROW + 26
  const sx = (v: number) => LX + (v / 100) * (RX - LX)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">every score in the argument, with its protocol</span>
        <div className="flex gap-1">
          {(["MATH-500", "IFEval"] as const).map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setBench(b)}
              aria-pressed={bench === b}
              className={`rounded-md border px-2 py-0.5 font-mono text-xs ${bench === b ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>
            {`${bench} accuracy from each source: ${rows.map((r) => `${r.label}, ${r.value}%`).join("; ")}.`}
          </title>
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={sx(t)} x2={sx(t)} y1={4} y2={H - 20} stroke="currentColor" strokeOpacity={0.08} />
              <text x={sx(t)} y={H - 6} fontSize={9} textAnchor="middle" fontFamily={MONO} fill="currentColor" fillOpacity={0.5}>
                {t}%
              </text>
            </g>
          ))}
          {rows.map((r, i) => {
            const y = 6 + i * ROW
            return (
              <g key={r.label}>
                <text x={LX - 8} y={y + 10} fontSize={10} textAnchor="end" fontFamily={MONO} fill="currentColor">
                  {r.label}
                </text>
                <text x={LX - 8} y={y + 21} fontSize={8} textAnchor="end" fontFamily={MONO} fill="currentColor" fillOpacity={0.55}>
                  {r.how}
                </text>
                <rect x={LX} y={y + 3} width={Math.max(sx(r.value) - LX, 2)} height={14} rx={2} fill={color(r)} fillOpacity={0.8} />
                <text x={sx(r.value) + 5} y={y + 14} fontSize={10} fontFamily={MONO} fill="currentColor">
                  {r.value}
                </text>
                <text x={sx(r.value) + 34} y={y + 14} fontSize={8} fontFamily={MONO} fill="currentColor" fillOpacity={0.5}>
                  {r.status}
                </text>
              </g>
            )
          })}
        </svg>
        <div className="mt-2 flex flex-wrap gap-3 font-mono text-[11px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-3 rounded-sm align-middle" style={{ background: BLUE }} /> unedited Qwen3.5-0.8B
          </span>
          <span>
            <span className="inline-block h-2 w-3 rounded-sm align-middle" style={{ background: ACCENT }} /> some edit to the weights
          </span>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Sources: the post and its logs (base, three edits, Astra&apos;s random control), the edited model&apos;s
        repository (the 51.0% re-run), Qwen&apos;s model card (IFEval in both modes), and two replies on X (non-thinking
        and noise), whose protocols I could not check. My CPU rows are measured, on few problems; read their protocol
        before comparing.
      </figcaption>
    </figure>
  )
}
