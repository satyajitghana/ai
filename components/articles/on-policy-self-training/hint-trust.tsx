"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { PAPER_BASE_MMLU, PAPER_WRONG, TRUST, WRONG } from "./data"

// Two views of one claim: conditioning the teacher on a candidate answer is not
// the same as training on it. Left, MEASURED in the toy (30 seeds): how much
// probability a hinted teacher puts on the hinted answer, by how confident the
// student already is. Training on the answer (SFT) is a target of 1.0 at every
// confidence. Right, the wrong-label test: toy (measured) beside the paper's
// Table 5c (reported, Gemma 4 E2B, MMLU).

const ACCENT = "oklch(0.62 0.16 35)"
const BAND = "oklch(0.60 0.15 255)"
const mono = { fontFamily: "ui-monospace, monospace" } as const

const LABELS = ["0.38-0.50", "0.50-0.62", "0.62-0.75", "0.75-0.88", "0.88-1.00"]
const FRACS = ["0.0", "0.25", "0.5", "0.75"]

function Trust() {
  const [i, setI] = useState(0)
  const W = 640, H = 220, PX = 46, PY = 14, PW = W - PX - 16, PH = H - PY - 38
  const bw = PW / 5
  const sy = (v: number) => PY + PH - v * PH
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
        <title>
          Teacher probability on the hinted answer, by student confidence. For a hint the student disagrees with it
          falls from 37 percent when the student is unsure to 2.5 percent when it is sure. For a hint equal to the
          student&apos;s own answer it rises from 72 to 99 percent. Training on the hint would put 100 percent on it
          everywhere.
        </title>
        {[0, 0.25, 0.5, 0.75, 1].map((t) => (
          <g key={t}>
            <line x1={PX} x2={PX + PW} y1={sy(t)} y2={sy(t)} stroke="currentColor" strokeOpacity={t === 1 ? 0.45 : 0.12} strokeDasharray={t === 1 ? "4 3" : undefined} />
            <text x={PX - 6} y={sy(t) + 3} textAnchor="end" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.55}>{(t * 100).toFixed(0)}%</text>
          </g>
        ))}
        <text x={PX + PW - 2} y={sy(1) - 4} textAnchor="end" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.6}>SFT target: 100% on the hint</text>
        {LABELS.map((l, k) => (
          <g key={l} opacity={k === i ? 1 : 0.7}>
            <rect x={PX + k * bw + 8} width={(bw - 16) / 2 - 1} y={sy(TRUST.ownHint[k])} height={PH - (sy(TRUST.ownHint[k]) - PY)} fill={BAND} fillOpacity={k === i ? 0.9 : 0.5} />
            <rect x={PX + k * bw + 8 + (bw - 16) / 2 + 1} width={(bw - 16) / 2 - 1} y={sy(TRUST.otherHint[k])} height={PH - (sy(TRUST.otherHint[k]) - PY)} fill={ACCENT} fillOpacity={k === i ? 0.95 : 0.5} />
            <text x={PX + k * bw + bw / 2} y={H - 22} textAnchor="middle" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.6}>{l}</text>
          </g>
        ))}
        <text x={PX + PW / 2} y={H - 8} textAnchor="middle" fontSize={9} style={mono} fill="currentColor" fillOpacity={0.55}>student&apos;s confidence in its own answer</text>
      </svg>
      <div className="flex flex-wrap gap-4 font-mono text-[11px] text-muted-foreground">
        <span><span style={{ color: BAND }}>&#9632;</span> hint = the student&apos;s own answer</span>
        <span><span style={{ color: ACCENT }}>&#9632;</span> hint = a different answer</span>
      </div>
      <label className="mt-2 flex items-center gap-3 font-mono text-xs">
        <span className="w-24 shrink-0 text-muted-foreground">confidence</span>
        <Range min={0} max={4} step={1} value={i} onChange={(e) => setI(Number(e.target.value))} aria-label="Student confidence bin" accent={ACCENT} />
      </label>
      <p className="mt-2 font-mono text-[11px] leading-relaxed">
        Student confidence {LABELS[i]}: shown a conflicting hint, the teacher puts{" "}
        <b>{(TRUST.otherHint[i] * 100).toFixed(1)}%</b> on it; shown its own answer, <b>{(TRUST.ownHint[i] * 100).toFixed(1)}%</b>. SFT would put 100% on the hint either way.
      </p>
    </div>
  )
}

function Wrong() {
  const [k, setK] = useState(3)
  const f = FRACS[k]
  const pk = String(Math.round(Number(f) * 100)) as keyof typeof PAPER_WRONG
  const toy = WRONG[f as keyof typeof WRONG]
  const pp = PAPER_WRONG[pk]
  const row = (label: string, v: number, lo: number, hi: number, color: string, unit: string, ref: number) => {
    const w = Math.max(0, Math.min(100, ((v - lo) / (hi - lo)) * 100))
    const r = Math.max(0, Math.min(100, ((ref - lo) / (hi - lo)) * 100))
    return (
      <div className="grid grid-cols-[5.5rem_1fr_3.5rem] items-center gap-2 font-mono text-[11px]">
        <span className="text-muted-foreground">{label}</span>
        <span className="relative block h-4 rounded bg-muted/40">
          <span className="absolute inset-y-0 left-0 rounded" style={{ width: `${w}%`, background: color, opacity: 0.85 }} />
          <span className="absolute inset-y-[-3px] w-px bg-foreground/60" style={{ left: `${r}%` }} />
        </span>
        <span className="text-right">{v.toFixed(1)}{unit}</span>
      </div>
    )
  }
  return (
    <div>
      <label className="flex items-center gap-3 font-mono text-xs">
        <span className="w-32 shrink-0 text-muted-foreground">wrong answers</span>
        <Range min={0} max={3} step={1} value={k} onChange={(e) => setK(Number(e.target.value))} aria-label="Fraction of wrong candidate answers" accent={ACCENT} />
        <span className="w-10 text-right">{Math.round(Number(f) * 100)}%</span>
      </label>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">toy, in-domain accuracy (measured)</div>
          {row("OPST", toy.opst[0] * 100, 0, 100, ACCENT, "%", BASE_IN)}
          {row("SFT", toy.sft[0] * 100, 0, 100, BAND, "%", BASE_IN)}
          <div className="font-mono text-[10px] text-muted-foreground">tick = base, 80.0%; 30 seeds</div>
        </div>
        <div className="space-y-1.5">
          <div className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">paper, MMLU on Gemma 4 E2B (reported)</div>
          {row("OPST", pp.opst, 30, 50, ACCENT, "", PAPER_BASE_MMLU)}
          {row("SFT", pp.sft, 30, 50, BAND, "", PAPER_BASE_MMLU)}
          <div className="font-mono text-[10px] text-muted-foreground">tick = base, {PAPER_BASE_MMLU}; axis starts at 30</div>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Filters off in both. At 75% the toy&apos;s labels carry no information about the truth (each class, the right one
        included, is equally likely), so OPST holding at 78% means it kept what it already knew, not that it learned.
      </p>
    </div>
  )
}

const BASE_IN = 80.0

export function HintTrust() {
  const [tab, setTab] = useState<"trust" | "wrong">("trust")
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">context versus target · toy measured, paper reported</span>
        <div role="tablist" className="flex gap-1 font-mono text-xs">
          {([["trust", "teacher's trust"], ["wrong", "wrong labels"]] as const).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`rounded-md border px-2.5 py-1 ${tab === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      <div className="p-3 sm:p-4">{tab === "trust" ? <Trust /> : <Wrong />}</div>
    </figure>
  )
}
