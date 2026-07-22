"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The thesis as an efficiency frontier: non-embedding parameters (x) against a
// benchmark score (y). Nanbeige4.2-3B (3B non-emb) sits up-and-to-the-left of
// Qwen3.5-9B (8B) and Gemma4-12B (10B) on agentic and code tasks — smaller and
// higher. Pick a benchmark. Numbers: Nanbeige4.2-3B model card.

type Row = { name: string; p: number; nanbeige?: boolean; scores: Record<string, number> }

const MODELS: Row[] = [
  { name: "Nanbeige4.2-3B", p: 3, nanbeige: true, scores: { gdpval: 74.3, swev: 63.6, term: 44.1, gpqa: 87.4, hmmt: 82.8, mcp: 57.8 } },
  { name: "Qwen3.5-9B", p: 8, scores: { gdpval: 61.9, swev: 53.1, term: 29.2, gpqa: 81.7, hmmt: 69.6, mcp: 47.4 } },
  { name: "Qwen3.5-4B", p: 4, scores: { gdpval: 46.7, swev: 38.8, term: 25.8, gpqa: 78.2, hmmt: 60.6, mcp: 40.8 } },
  { name: "Gemma4-12B", p: 10, scores: { gdpval: 68.5, swev: 44.2, term: 21.1, gpqa: 78.8, hmmt: 51.5, mcp: 30.5 } },
  { name: "Gemma4-E4B", p: 4, scores: { gdpval: 31.5, swev: 14.0, term: 12.4, gpqa: 60.6, hmmt: 24.2, mcp: 15.0 } },
]

const BENCH = [
  { key: "swev", label: "SWE-Bench Verified" },
  { key: "term", label: "Terminal-Bench 2.0" },
  { key: "gdpval", label: "GDPval rubrics" },
  { key: "mcp", label: "MCP-Atlas" },
  { key: "gpqa", label: "GPQA-Diamond" },
  { key: "hmmt", label: "HMMT-Feb-2026" },
]

const ACCENT = "oklch(0.64 0.1 188)"
const OTHER = "oklch(0.6 0.03 250)"
const W = 640
const H = 360
const padL = 40
const padR = 14
const padT = 16
const padB = 40
const r2 = (n: number) => Math.round(n * 100) / 100

export function ParamEfficiency() {
  const [bk, setBk] = useState("swev")
  const [hover, setHover] = useState<number | null>(null)

  const pts = useMemo(() => MODELS.map((m, i) => ({ m, i, x: m.p, y: m.scores[bk] })), [bk])
  const yhi = Math.max(...pts.map((p) => p.y)) + 8
  const ylo = Math.max(0, Math.min(...pts.map((p) => p.y)) - 8)
  const xhi = 11

  const sx = (v: number) => r2(padL + (v / xhi) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - (v - ylo) / (yhi - ylo || 1)) * (H - padT - padB))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">score vs non-embedding params</span>
        <div className="flex flex-wrap gap-1">
          {BENCH.map((b) => (
            <button key={b.key} type="button" onClick={() => setBk(b.key)} className={chip(b.key === bk)}>{b.key}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Score against non-embedding parameters for ${BENCH.find((b) => b.key === bk)?.label}. Nanbeige4.2-3B is smaller and higher than Qwen3.5-9B and Gemma4-12B.`}>
          {[0, 0.25, 0.5, 0.75, 1].map((f) => {
            const gy = ylo + (yhi - ylo) * f
            return (
              <g key={f}>
                <line x1={padL} y1={sy(gy)} x2={W - padR} y2={sy(gy)} stroke="currentColor" strokeOpacity="0.07" />
                <text x={padL - 5} y={sy(gy) + 3} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize="9">{Math.round(gy)}</text>
              </g>
            )
          })}
          {[2, 4, 6, 8, 10].map((gx) => (
            <text key={gx} x={sx(gx)} y={H - 24} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize="9">{gx}B</text>
          ))}
          <text x={(W + padL) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9">non-embedding parameters</text>
          <text x={12} y={(H - padB) / 2} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize="9" transform={`rotate(-90 12 ${(H - padB) / 2})`}>{BENCH.find((b) => b.key === bk)?.label}</text>

          {pts.map((p) => {
            const on = hover === p.i
            return (
              <g key={p.i} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)} className="cursor-pointer">
                <circle cx={sx(p.x)} cy={sy(p.y)} r={p.m.nanbeige ? (on ? 8 : 6.5) : on ? 6 : 4.5} fill={p.m.nanbeige ? ACCENT : OTHER} opacity={hover == null || on || p.m.nanbeige ? 1 : 0.5} />
                <text x={sx(p.x)} y={sy(p.y) - 10} textAnchor="middle" className="font-mono" fontSize={p.m.nanbeige ? 9.5 : 8.5} fontWeight={p.m.nanbeige ? 600 : 400} fill={p.m.nanbeige ? "var(--foreground)" : "var(--muted-foreground)"}>
                  {p.m.nanbeige ? "Nanbeige4.2-3B" : on ? p.m.name : ""}
                </text>
              </g>
            )
          })}
        </svg>

        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          On agentic and code benchmarks the teal point is up-and-left of everything: <span style={{ color: ACCENT }}>fewer
          parameters, higher score</span>. On saturated knowledge tests (GPQA) the field bunches, but even there the
          3B model leads. &ldquo;Well beyond its parameter scale&rdquo; is the whole pitch, and it holds.
        </p>
      </div>
    </figure>
  )
}
