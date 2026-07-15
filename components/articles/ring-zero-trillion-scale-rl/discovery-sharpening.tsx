"use client"

import { useState } from "react"

// Ring-Zero's second finding: zero RL moves through two phases. Early on, coverage
// (pass@1024 — can the model solve it in *any* of 1024 tries) climbs fast as RL
// discovers new reasoning patterns; it then plateaus. Meanwhile pass@1 (does it get
// it right on the FIRST try) keeps rising long after — RL sharpening the policy
// inside a boundary it already found. Drag the training step. Numbers read from the
// paper's AIME-2024 curves for the 1T model (first-stage RL). Illustrative chart.

const ACCENT = "oklch(0.58 0.19 300)" // pass@1 — sharpening
const COVER = "oklch(0.62 0.13 235)" // pass@1024 — discovery

const STEPS = [0, 400, 800, 1200, 1600, 2000]
const PASS1 = [21.5, 55.7, 60.8, 64.4, 73.7, 76.6]
const PASS1024 = [86.7, 93.3, 96.7, 96.7, 96.7, 96.7]
const DISCOVERY_END = 800

// scene geometry
const W = 760
const H = 260
const ML = 44
const MR = 20
const MT = 20
const MB = 40
const xOf = (step: number) => ML + (step / 2000) * (W - ML - MR)
const yOf = (v: number) => MT + (1 - v / 100) * (H - MT - MB)

function lerp(step: number, ys: number[]) {
  if (step <= STEPS[0]) return ys[0]
  if (step >= STEPS[STEPS.length - 1]) return ys[ys.length - 1]
  let i = 0
  while (i < STEPS.length - 1 && STEPS[i + 1] < step) i++
  const t = (step - STEPS[i]) / (STEPS[i + 1] - STEPS[i])
  return ys[i] + t * (ys[i + 1] - ys[i])
}

const path = (ys: number[]) => STEPS.map((s, i) => `${i === 0 ? "M" : "L"} ${xOf(s)} ${yOf(ys[i])}`).join(" ")

export function DiscoverySharpening() {
  const [step, setStep] = useState(600)
  const p1 = lerp(step, PASS1)
  const p1024 = lerp(step, PASS1024)
  const phase = step < DISCOVERY_END ? "discovery" : "sharpening"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>AIME 2024 · coverage vs accuracy over training</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At step ${step}, pass@1 is ${p1.toFixed(1)} percent and pass@1024 is ${p1024.toFixed(1)} percent; phase: ${phase}`}>
          {/* y grid */}
          {[0, 20, 40, 60, 80, 100].map((t) => (
            <g key={t}>
              <line x1={ML} y1={yOf(t)} x2={W - MR} y2={yOf(t)} stroke="var(--border)" strokeWidth={1} opacity={t === 0 ? 0.6 : 0.25} />
              <text x={ML - 8} y={yOf(t) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>{t}</text>
            </g>
          ))}

          {/* discovery / sharpening divider */}
          <line x1={xOf(DISCOVERY_END)} y1={MT} x2={xOf(DISCOVERY_END)} y2={H - MB} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 4" opacity={0.5} />
          <text x={xOf(DISCOVERY_END / 2)} y={MT + 12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>discovery</text>
          <text x={(xOf(DISCOVERY_END) + xOf(2000)) / 2} y={MT + 12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>sharpening</text>

          {/* x ticks */}
          {STEPS.map((s) => (
            <text key={s} x={xOf(s)} y={H - MB + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{s}</text>
          ))}
          <text x={(ML + W - MR) / 2} y={H - 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>training step</text>

          {/* curves */}
          <path d={path(PASS1024)} fill="none" stroke={COVER} strokeWidth={2} opacity={0.9} />
          <path d={path(PASS1)} fill="none" stroke={ACCENT} strokeWidth={2} opacity={0.95} />

          {/* scrub marker */}
          <line x1={xOf(step)} y1={MT} x2={xOf(step)} y2={H - MB} stroke="var(--foreground)" strokeWidth={1} opacity={0.35} />
          <circle cx={xOf(step)} cy={yOf(p1024)} r={4} fill={COVER} />
          <circle cx={xOf(step)} cy={yOf(p1)} r={4} fill={ACCENT} />

          {/* inline labels */}
          <text x={xOf(2000)} y={yOf(96.7) - 6} textAnchor="end" className="font-mono" fontSize={9} fill={COVER}>pass@1024 (coverage)</text>
          <text x={xOf(2000)} y={yOf(76.6) + 14} textAnchor="end" className="font-mono" fontSize={9} fill={ACCENT}>pass@1 (accuracy)</text>
        </svg>

        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>step <span className="text-foreground">{step}</span></span>
          <span>pass@1 <span style={{ color: ACCENT }}>{p1.toFixed(1)}%</span></span>
          <span>pass@1024 <span style={{ color: COVER }}>{p1024.toFixed(1)}%</span></span>
          <span className="ml-auto">phase <span className="text-foreground">{phase}</span></span>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">training step (drag)</div>
          <input
            type="range"
            min={0}
            max={2000}
            step={50}
            value={step}
            onChange={(e) => setStep(Number(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.58_0.19_300)]"
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Coverage saturates near <span style={{ color: COVER }}>96.7%</span> by step ~800 — RL has found essentially every
          pattern it will ever use (the <span className="text-foreground">discovery</span> phase). Yet first-try accuracy
          keeps climbing well past that point (<span className="text-foreground">sharpening</span>): the model is not
          learning new tricks, it is getting reliable at the ones it already has. This is the paper&rsquo;s evidence that
          zero RL sharpens a policy inside a boundary set by pretraining rather than expanding it.
        </p>
      </div>
    </figure>
  )
}
