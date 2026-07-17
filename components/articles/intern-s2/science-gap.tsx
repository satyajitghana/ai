"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The whole Intern-S2 story in one chart: on general tasks it sits at frontier PARITY
// (a 397B model trading blows with much larger closed models — usually a hair behind);
// on specialized science it LEADS, often by multiples. Each row plots Intern-S2 against
// the best competing model on a 0–100 axis; the connecting line is the gap. Flip the
// task family. Numbers are as reported on the Intern-S2-Preview-397B model card.

const ACCENT = "oklch(0.62 0.14 165)"

type Row = { name: string; intern: number; comp: number; compName: string }

const GENERAL: Row[] = [
  { name: "MMLU-Pro", intern: 89.75, comp: 91.0, compName: "Gemini-3.1-Pro" },
  { name: "SimpleQA-V", intern: 69.9, comp: 75.6, compName: "Gemini-3.1-Pro" },
  { name: "HMMT-2026", intern: 91.57, comp: 97.06, compName: "GPT-5.5" },
  { name: "SWE-Bench-Pro", intern: 61.56, comp: 69.2, compName: "Claude-Opus-4.8" },
  { name: "TerminalBench", intern: 67.42, comp: 84.6, compName: "Claude-Opus-4.8" },
  { name: "SWE-Multiling", intern: 81.67, comp: 82.0, compName: "GLM-5.2" },
]

const SCIENTIFIC: Row[] = [
  { name: "Bio-Instructions", intern: 56.92, comp: 13.87, compName: "Gemini-3.1-Pro" },
  { name: "Mol-Instructions", intern: 52.37, comp: 40.49, compName: "GPT-5.5" },
  { name: "MP20 (mat-gen)", intern: 67.88, comp: 16.75, compName: "Gemini-3.1-Pro" },
  { name: "MolecularIQ", intern: 61.49, comp: 76.41, compName: "GPT-5.5" },
]

// scene geometry (viewBox units)
const W = 720
const TOP = 46
const ROW = 34
const SLOTS = 6
const BAND = SLOTS * ROW
const H = TOP + BAND + 26
const AX = 150 // axis left
const AXW = 510 // axis width → x(100) = 660, leaving room for right-side labels
const x = (v: number) => AX + (v / 100) * AXW
const TICKS = [0, 25, 50, 75, 100]

function median(xs: number[]) {
  const s = [...xs].sort((a, b) => a - b)
  const mid = Math.floor(s.length / 2)
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

export function ScienceGap() {
  const [fam, setFam] = useState<"general" | "scientific">("scientific")
  const rows = fam === "general" ? GENERAL : SCIENTIFIC
  const startY = TOP + (BAND - rows.length * ROW) / 2

  const gaps = rows.map((r) => r.intern - r.comp)
  const med = median(gaps)
  const wins = rows.filter((r) => r.intern >= r.comp).length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">Intern-S2 vs. best competing model</span>
        <div className="flex gap-1">
          {[
            { v: "general" as const, label: "general tasks" },
            { v: "scientific" as const, label: "scientific tasks" },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setFam(o.v)}
              aria-pressed={fam === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                fam === o.v ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={fam === o.v ? { background: ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${fam} tasks: Intern-S2 against the best competing model on each benchmark, with a median gap of ${med.toFixed(1)} points`}
        >
          <defs>
            <filter id="sg-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* gridlines + tick labels */}
          {TICKS.map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={TOP - 8} x2={x(t)} y2={TOP + BAND} stroke="var(--border)" strokeWidth={1} opacity={t === 0 ? 1 : 0.4} />
              <text x={x(t)} y={TOP + BAND + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>{t}</text>
            </g>
          ))}
          <text x={AX} y={TOP - 18} className="fill-muted-foreground font-mono" fontSize={9.5}>score →</text>

          {rows.map((r, i) => {
            const cy = startY + i * ROW + ROW / 2
            const xi = x(r.intern)
            const xc = x(r.comp)
            const ahead = r.intern >= r.comp
            const mid = (xi + xc) / 2
            const iSide = xi < mid ? "end" : "start"
            const cSide = xc < mid ? "end" : "start"
            return (
              <g key={r.name}>
                <text x={AX - 12} y={cy + 3.5} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>{r.name}</text>

                {/* gap connector */}
                <line
                  x1={xc}
                  y1={cy}
                  x2={xi}
                  y2={cy}
                  stroke={ahead ? ACCENT : "var(--muted-foreground)"}
                  strokeWidth={2}
                  strokeDasharray={ahead ? undefined : "4 3"}
                  opacity={ahead ? 0.5 : 0.55}
                />

                {/* competitor dot */}
                <circle cx={xc} cy={cy} r={4} fill="var(--muted-foreground)" />
                <text x={cSide === "end" ? xc - 8 : xc + 8} y={cy + 3.5} textAnchor={cSide} className="fill-muted-foreground font-mono" fontSize={9.5}>{r.comp.toFixed(2)}</text>

                {/* Intern-S2 dot (on top) */}
                <circle cx={xi} cy={cy} r={5} fill={ACCENT} filter="url(#sg-soft)" />
                <text x={iSide === "end" ? xi - 9 : xi + 9} y={cy + 3.5} textAnchor={iSide} className="font-mono" fontSize={9.5} fontWeight={600} fill={ACCENT}>{r.intern.toFixed(2)}</text>
              </g>
            )
          })}
        </svg>

        {/* legend + readout */}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: ACCENT }} />
            Intern-S2
          </span>
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground" />
            best competitor
          </span>
          <span className="ml-auto text-muted-foreground">
            leads <span className="text-foreground">{wins}/{rows.length}</span> · median gap{" "}
            <span style={{ color: med >= 0 ? ACCENT : undefined }} className={med >= 0 ? "" : "text-foreground"}>
              {med >= 0 ? "+" : ""}{med.toFixed(1)}
            </span>
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {fam === "general" ? (
            <>
              On general knowledge, math and agentic coding, Intern-S2 lands just behind the very
              best closed models — a <span className="text-foreground">397B model at frontier parity</span>,
              which is the point. It rarely wins here, but it rarely loses by much.
            </>
          ) : (
            <>
              On specialized science the picture inverts: Intern-S2 opens gaps of{" "}
              <span style={{ color: ACCENT }}>30–50 points</span> on multi-omics, molecular reasoning
              and material generation — routinely 4× the nearest frontier model. MolecularIQ is the
              honest exception, where GPT-5.5 still leads.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
