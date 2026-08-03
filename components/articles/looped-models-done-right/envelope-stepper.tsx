"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The construction path: start from Ouro (full-stack loop, direct init) and add
// exactly one design axis at a time — sandwich envelope, then persistent input
// injection, then random state init — until you reach full Huginn. Each step's
// measured net effect is IFM Research's own numbers. The point of the stepper:
// the reader can see which single wire produced which result, instead of
// comparing two whole architectures and guessing why one won.

const CORE = "oklch(0.60 0.14 250)"
const ENV = "oklch(0.75 0.13 80)"
const INJECT = "oklch(0.62 0.19 25)" // warm red-orange, the injection wire

const W = 760
const H = 300
const BY = 120
const BH = 54

const P_X = 140, P_W = 90
const GAP = 40
const CORE_X = P_X + P_W + GAP, CORE_W = 220
const CODA_X = CORE_X + CORE_W + GAP, CODA_W = 90
const CODA_END = CODA_X + CODA_W

type Chip = { label: string; text: string; dir: "up" | "down" | "flat" | "boundedDown" }

type Stage = {
  name: string
  note: string
  chips: Chip[]
}

const STAGES: Stage[] = [
  {
    name: "Ouro — full-stack, direct init",
    note: "Baseline: the entire 28-block stack loops 4×; no separate prelude/coda, z₀ = e.",
    chips: [],
  },
  {
    name: "+ sandwich envelope",
    note: "Untie a prelude and coda from the loop; only the middle 12-block core repeats. Reasoning tasks move, knowledge and code mostly don't.",
    chips: [
      { label: "MATH500", text: "+12.00", dir: "up" },
      { label: "DROP", text: "+2.61", dir: "up" },
      { label: "knowledge / code", text: "flat or down", dir: "flat" },
    ],
  },
  {
    name: "+ persistent input injection",
    note: "Write the prelude's fixed representation e into the core at every pass. Helps most tasks, but taxes quantitative reasoning.",
    chips: [
      { label: "BBH-CoT", text: "+6.63", dir: "up" },
      { label: "HumanEval+", text: "+5.49", dir: "up" },
      { label: "MBPP+", text: "+4.23", dir: "up" },
      { label: "MMLU", text: "+2.53", dir: "up" },
      { label: "DROP", text: "+1.39", dir: "up" },
      { label: "MATH500", text: "−3.60", dir: "down" },
      { label: "GSM8K", text: "−2.51", dir: "down" },
    ],
  },
  {
    name: "+ random state init  (= full Huginn)",
    note: "Swap z₀ = e for z₀ ~ N(0, I/d). Two tasks improve; four get worse by more than a point. Direct init still wins 6 of 10 benchmarks overall — this step is the myth.",
    chips: [
      { label: "ARC-C", text: "+3.34", dir: "up" },
      { label: "GSM8K", text: "+1.22", dir: "up" },
      { label: "MMLU", text: "worse >1pt", dir: "boundedDown" },
      { label: "MATH500", text: "worse >1pt", dir: "boundedDown" },
      { label: "HumanEval+", text: "worse >1pt", dir: "boundedDown" },
      { label: "MBPP+", text: "worse >1pt", dir: "boundedDown" },
    ],
  },
]

function chipClass(dir: Chip["dir"]) {
  if (dir === "up") return "border-emerald-600/30 text-emerald-700 dark:border-emerald-400/30 dark:text-emerald-400"
  if (dir === "down") return "border-destructive/30 text-destructive"
  if (dir === "boundedDown") return "border-dashed border-destructive/40 text-destructive/80"
  return "border-border text-muted-foreground"
}

export function EnvelopeStepper() {
  const [stage, setStage] = useState(1)
  const sandwich = stage >= 1
  const injected = stage >= 2
  const randomInit = stage >= 3
  const s = STAGES[stage]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Ouro to Huginn, one wire at a time</span>
        <span className="text-muted-foreground/50">construction path</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Stage ${stage + 1} of 4: ${s.name}. ${s.note}`}
        >
          <defs>
            <marker id="es-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} />
            </marker>
            <marker id="es-arrow-inject" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={INJECT} strokeWidth={1.5} />
            </marker>
            <marker id="es-arrow-core" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={CORE} strokeWidth={1.5} />
            </marker>
            <filter id="es-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* token embedding -> chain */}
          <text x={40} y={BY + BH / 2 + 4} className="fill-muted-foreground font-mono" fontSize={10}>
            in
          </text>
          <path d={`M 58 ${BY + BH / 2} L ${sandwich ? P_X : P_X} ${BY + BH / 2}`} stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#es-arrow)" opacity={0.6} />

          {!sandwich ? (
            <>
              {/* Ouro: one homogeneous tied stack */}
              <path
                d={`M ${P_X} ${BY - 30} C ${P_X} ${BY - 46}, ${CODA_END} ${BY - 46}, ${CODA_END} ${BY - 30}`}
                fill="none"
                stroke={CORE}
                strokeWidth={1.7}
                markerEnd="url(#es-arrow-core)"
                opacity={0.85}
              />
              <text x={(P_X + CODA_END) / 2} y={BY - 52} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={700} style={{ fill: CORE }}>
                ×4
              </text>
              <rect x={P_X} y={BY} width={CODA_END - P_X} height={BH} rx={9} fill={CORE} fillOpacity={0.85} stroke={CORE} strokeWidth={1.5} filter="url(#es-soft)" />
              <text x={(P_X + CODA_END) / 2} y={BY + BH / 2 - 2} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={600} style={{ fill: "oklch(0.98 0 0)" }}>
                tied stack Rθ
              </text>
              <text x={(P_X + CODA_END) / 2} y={BY + BH / 2 + 14} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: "oklch(0.9 0 0)" }}>
                z₀ = e
              </text>
            </>
          ) : (
            <>
              {/* prelude */}
              <rect x={P_X} y={BY} width={P_W} height={BH} rx={8} fill={ENV} fillOpacity={0.85} stroke={ENV} strokeWidth={1.5} filter="url(#es-soft)" />
              <text x={P_X + P_W / 2} y={BY + BH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} style={{ fill: "oklch(0.2 0 0)" }}>
                Pθ
              </text>
              <path d={`M ${P_X + P_W} ${BY + BH / 2} L ${CORE_X} ${BY + BH / 2}`} stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#es-arrow)" opacity={0.6} />

              {/* core loop */}
              <path
                d={`M ${CORE_X} ${BY - 26} C ${CORE_X} ${BY - 42}, ${CORE_X + CORE_W} ${BY - 42}, ${CORE_X + CORE_W} ${BY - 26}`}
                fill="none"
                stroke={CORE}
                strokeWidth={1.7}
                markerEnd="url(#es-arrow-core)"
                opacity={0.85}
              />
              <text x={CORE_X + CORE_W / 2} y={BY - 48} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={700} style={{ fill: CORE }}>
                ×8
              </text>
              <rect x={CORE_X} y={BY} width={CORE_W} height={BH} rx={9} fill={CORE} fillOpacity={0.85} stroke={CORE} strokeWidth={1.5} filter="url(#es-soft)" />
              <text x={CORE_X + CORE_W / 2} y={BY + BH / 2 - 2} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} style={{ fill: "oklch(0.98 0 0)" }}>
                tied core Rθ
              </text>
              <text x={CORE_X + CORE_W / 2} y={BY + BH / 2 + 14} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: "oklch(0.9 0 0)" }}>
                z₀ {randomInit ? "~ N(0, I/d)" : "= e"}
              </text>

              {/* injection: e held from prelude, written into core every pass */}
              <g opacity={injected ? 1 : 0.12} className="transition-opacity duration-300">
                <path
                  d={`M ${P_X + P_W / 2} ${BY} C ${P_X + P_W / 2} ${BY - 70}, ${CORE_X + CORE_W / 2} ${BY - 70}, ${CORE_X + CORE_W / 2} ${BY - 26}`}
                  fill="none"
                  stroke={INJECT}
                  strokeWidth={1.6}
                  strokeDasharray={injected ? undefined : "4 4"}
                  markerEnd="url(#es-arrow-inject)"
                  opacity={0.85}
                />
                <text x={(P_X + P_W / 2 + CORE_X + CORE_W / 2) / 2 + 6} y={BY - 76} textAnchor="middle" className="font-mono" fontSize={9} fontWeight={600} style={{ fill: INJECT }}>
                  D(zₜ, e) — every pass
                </text>
              </g>

              <path d={`M ${CORE_X + CORE_W} ${BY + BH / 2} L ${CODA_X} ${BY + BH / 2}`} stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#es-arrow)" opacity={0.6} />

              {/* coda */}
              <rect x={CODA_X} y={BY} width={CODA_W} height={BH} rx={8} fill={ENV} fillOpacity={0.85} stroke={ENV} strokeWidth={1.5} filter="url(#es-soft)" />
              <text x={CODA_X + CODA_W / 2} y={BY + BH / 2 + 4} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={600} style={{ fill: "oklch(0.2 0 0)" }}>
                Cθ
              </text>
            </>
          )}

          <path d={`M ${CODA_END} ${BY + BH / 2} L ${W - 40} ${BY + BH / 2}`} stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#es-arrow)" opacity={0.6} />
          <text x={W - 30} y={BY + BH / 2 + 4} className="fill-muted-foreground font-mono" fontSize={10}>
            out
          </text>

          {/* stage caption */}
          <text x={W / 2} y={H - 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            {s.name}
          </text>
        </svg>

        {/* stage selector */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {STAGES.map((st, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setStage(i)}
              aria-pressed={stage === i}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 text-left font-mono text-[10px] transition-colors",
                stage === i ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {i}. {["Ouro", "+ envelope", "+ injection", "+ random init"][i]}
            </button>
          ))}
        </div>

        <div className="mt-3 min-h-16">
          {s.chips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {s.chips.map((c) => (
                <span key={c.label} className={cn("rounded-full border px-2 py-0.5 font-mono text-[10px] tabular-nums", chipClass(c.dir))}>
                  {c.label} {c.text}
                </span>
              ))}
            </div>
          ) : null}
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{s.note}</p>
        </div>
      </div>
    </figure>
  )
}
