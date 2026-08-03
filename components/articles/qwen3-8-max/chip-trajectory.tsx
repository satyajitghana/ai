"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// The chip-design case study, as a staircase. Qwen3.8-Max ran ~500 turns of an
// autonomous edit-simulate-synthesize-layout loop against a GCD/RSA hardware
// accelerator, with no golden reference design. Gate count only ever drops —
// each milestone below is a real, named architectural change from the source,
// positioned at the turn (or end-of-range turn) where it completed. Steps are
// drawn as instantaneous drops for readability; several were incremental across
// their labelled turn range. Y-axis is log-scaled (8,298 -> 678 spans 12x).

const ACCENT = "oklch(0.62 0.16 35)" // warm — silicon
const MUTED = "var(--muted-foreground)"

type Step = { turn: number; gates: number; label: string; detail: string }

const STEPS: Step[] = [
  { turn: 0, gates: 8298, label: "First functional design", detail: "The first design to pass bit-exact functional verification across 4-, 6-, 8-, and 16-bit configurations under the randomized cocotb testbench." },
  { turn: 22, gates: 2010, label: "Modulo divider → shift-subtract", detail: "Replaced the 16-bit hardware modulo divider in modular_multiplier with an iterative shift-subtract architecture — the single largest step, −6,288 gates, over 80% of the total reduction." },
  { turn: 48, gates: 1304, label: "Redundancy elimination & bitwidth trim", detail: "Bypassed the entire REDUCE stage, merged two independent reduction modules into one shared block, moved the output path to combinational logic, narrowed the k_ff register." },
  { turn: 113, gates: 907, label: "Register & FSM pruning", detail: "Removed the redundant base and mod registers and the k_nz flip-flop, added an early exit for even numbers, reused the subtractor's MSB as the comparator, merged compare-then-subtract into one reusable subtractor." },
  { turn: 252, gates: 765, label: "Module fusion & logic sharing", detail: "Dissolved module boundaries: inlined the multiplier directly into the modular-exponentiation FSM, merged three sub-modules, shared one subtractor globally." },
  { turn: 500, gates: 678, label: "Gate-level refinement", detail: "Local optimizations — a shared NOR-gate tree, absolute-difference subtraction splitting, byte-to-bit selection logic — squeezed out the final redundancies." },
]

const LOG_MIN = Math.log10(600)
const LOG_MAX = Math.log10(9000)
const Y_TICKS = [700, 1000, 2000, 4000, 8000]
const X_TICKS = [0, 100, 200, 300, 400, 500]

const W = 760
const H = 300
const PL = 60
const PR = 728
const PT = 18
const PB = 232

const xPix = (turn: number) => PL + (turn / 500) * (PR - PL)
const yPix = (gates: number) => PB - ((Math.log10(gates) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * (PB - PT)

function stepPath(): string {
  let d = `M ${xPix(STEPS[0].turn)} ${yPix(STEPS[0].gates)} `
  for (let i = 1; i < STEPS.length; i++) {
    d += `L ${xPix(STEPS[i].turn)} ${yPix(STEPS[i - 1].gates)} `
    d += `L ${xPix(STEPS[i].turn)} ${yPix(STEPS[i].gates)} `
  }
  return d
}
const PATH = stepPath()

function levelAt(turn: number): { idx: number; gates: number } {
  let idx = 0
  for (let i = 0; i < STEPS.length; i++) {
    if (STEPS[i].turn <= turn) idx = i
  }
  return { idx, gates: STEPS[idx].gates }
}

// die-area comparison, nested squares to scale (side length, not area)
const DIE_START = 106
const DIE_FINAL = 46
const DIE_SCALE = 92 / DIE_START

export function ChipTrajectory() {
  const [turn, setTurn] = useState(22)
  const { idx, gates } = levelAt(turn)
  const step = STEPS[idx]
  const pct = Math.round((1 - 678 / 8298) * 1000) / 10

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>chip design · gate count over ~500 turns</span>
        <span className="text-muted-foreground/50">8,298 → 678 gates ({pct}%)</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Gate count staircase: at turn ${turn}, the design is at the "${step.label}" stage with ${gates.toLocaleString()} gates.`}
        >
          <defs>
            <filter id="ct-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {Y_TICKS.map((g) => (
            <g key={`y${g}`}>
              <line x1={PL} y1={yPix(g)} x2={PR} y2={yPix(g)} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.4} />
              <text x={PL - 8} y={yPix(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
                {g.toLocaleString()}
              </text>
            </g>
          ))}
          {X_TICKS.map((t) => (
            <text key={`x${t}`} x={xPix(t)} y={PB + 16} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {t}
            </text>
          ))}
          <text x={(PL + PR) / 2} y={PB + 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>
            turn
          </text>
          <text x={PL - 8} y={PT - 4} textAnchor="start" className="fill-muted-foreground font-mono" fontSize={10}>
            gates (log)
          </text>

          <path d={PATH} fill="none" stroke={ACCENT} strokeWidth={2.2} filter="url(#ct-soft)" />

          {STEPS.map((s, i) =>
            i === 0 ? null : (
              <g key={s.turn}>
                <circle cx={xPix(s.turn)} cy={yPix(s.gates)} r={3.2} fill={ACCENT} />
              </g>
            )
          )}

          {/* scrub marker */}
          <line x1={xPix(turn)} y1={PT} x2={xPix(turn)} y2={PB} stroke={MUTED} strokeWidth={1} strokeDasharray="3 3" opacity={0.5} />
          <circle cx={xPix(turn)} cy={yPix(gates)} r={5} fill="var(--background)" stroke={ACCENT} strokeWidth={2.2} />
        </svg>

        <div className="mt-1">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">turn (drag)</div>
          <Range min={0} max={500} value={turn} onChange={(e) => setTurn(Number(e.target.value))} className="w-full cursor-pointer" accent={ACCENT} />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {STEPS.map((s) => (
            <button
              key={s.turn}
              type="button"
              onClick={() => setTurn(s.turn)}
              aria-pressed={idx === STEPS.indexOf(s) && turn === s.turn}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                turn === s.turn ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={turn === s.turn ? { background: ACCENT } : undefined}
            >
              t{s.turn}
            </button>
          ))}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <p className="text-sm leading-6 text-foreground">
            <span style={{ color: ACCENT }}>{gates.toLocaleString()} gates</span>{" "}— {step.label}
          </p>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">{step.detail}</p>
        </div>

        {/* die-area comparison, nested to scale */}
        <div className="mt-4 flex flex-col items-start gap-3 border-t pt-4 sm:flex-row sm:items-center">
          <svg viewBox="0 0 110 110" className="h-24 w-24 shrink-0" role="img" aria-label="Die area shrank from 106 by 106 micrometers to 46 by 46 micrometers, nested to scale.">
            <rect x={4} y={4} width={DIE_START * DIE_SCALE} height={DIE_START * DIE_SCALE} rx={3} fill="none" stroke={MUTED} strokeWidth={1.4} strokeDasharray="3 2" />
            <rect x={4} y={4 + (DIE_START - DIE_FINAL) * DIE_SCALE} width={DIE_FINAL * DIE_SCALE} height={DIE_FINAL * DIE_SCALE} rx={2} fill={ACCENT} opacity={0.75} />
          </svg>
          <div className="grid grid-cols-3 gap-x-5 gap-y-1 font-mono text-[11px]">
            <div className="text-muted-foreground">die area</div>
            <div className="col-span-2">
              106×106 <span className="text-muted-foreground">→</span> <span style={{ color: ACCENT }}>46×46 µm²</span>{" "}(−81%)
            </div>
            <div className="text-muted-foreground">wirelength</div>
            <div className="col-span-2">
              33,369 <span className="text-muted-foreground">→</span> <span style={{ color: ACCENT }}>4,187 µm</span>
            </div>
            <div className="text-muted-foreground">timing slack</div>
            <div className="col-span-2">
              −4.46 ns <span className="text-muted-foreground">→</span>{" "}
              <span style={{ color: ACCENT }}>+0.66 ns</span>{" "}at 500 MHz
            </div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Drag the turn marker or jump between milestones. The trajectory only ever goes down, and the biggest single cut
          — replacing a hardware modulo divider with iterative shift-subtract at turn 22 — happened early, not late,
          and still accounts for most of the total reduction. The later milestones (turns 60–500) show the model
          finding real, if smaller, structural wins <span className="text-foreground">hundreds of turns in</span>, rather
          than plateauing after the first big rewrite. Physical layout (OpenROAD, Nangate45) confirms the front-end
          optimization actually routes: the die shrinks 81% and timing closes at 500 MHz with positive slack.
        </p>
      </div>
    </figure>
  )
}
