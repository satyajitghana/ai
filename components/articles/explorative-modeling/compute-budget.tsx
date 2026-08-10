"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { mlog } from "@/lib/dmath"

// Same total compute budget, spent in a different place. A step-factored generator
// (diffusion, AR) pays almost nothing extra to train, then pays NFE forward passes
// on every single sample forever after. An Explorative Model pays extra once, at
// training (K extra generations per step, to buy expressivity), then samples in a
// single forward pass (NFE = 1) for the rest of its life. Drag the generator's step
// count and watch its inference bill run away while XM's flat line just sits there.
// Numbers are relative units, illustrative — chosen so dragging to 100/256 steps
// (the paper's Diffusion Policy / Diffuser comparisons) lands the ratio in the same
// ballpark the paper reports, not to claim an exact FLOP count.

const GEN = "oklch(0.60 0.02 260)" // step-factored generator
const XM = "oklch(0.66 0.15 165)" // explorative model

const TRAIN_BASE = 1 // cost to train the shared base network (both pay this)
const K_EXTRA = 8 // XM's one-time exploration overhead at training (illustrative)
const N_SAMPLES = 50 // samples generated, for the running total (illustrative)
const MAX_NFE = 256

const W = 640
const H = 260
const PL = 44
const PB = 26
const PT = 16
const PR = 14

const diffTotal = (nfe: number) => TRAIN_BASE + nfe * N_SAMPLES
const xmTotal = TRAIN_BASE * (1 + K_EXTRA) + 1 * N_SAMPLES // does not depend on nfe

// Totals span ~1 to ~12,800 — a plain linear axis would pin the flat XM line to
// the very bottom pixel row. Log-scale the y-axis so both lines stay legible;
// the x-axis (NFE) stays linear, matching the slider one-to-one.
const yMax = diffTotal(MAX_NFE)
const logc = (c: number) => mlog(c + 1)
const logMax = logc(yMax)

export function ComputeBudget() {
  const [nfe, setNfe] = useState(100)

  const x = (v: number) => PL + (v / MAX_NFE) * (W - PL - PR)
  const y = (c: number) => PT + (1 - logc(c) / logMax) * (H - PT - PB)

  const crossoverNfe = (xmTotal - TRAIN_BASE) / N_SAMPLES // ≈1.16 steps
  const diff = diffTotal(nfe)
  const ratio = diff / xmTotal

  const path = Array.from({ length: MAX_NFE + 1 }, (_, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(diffTotal(i)).toFixed(1)}`).join(" ")

  // Fill only the region where the step-factored total exceeds XM's flat total
  // (from just past the crossover onward), so the shaded gap never crosses itself.
  const fillFrom = Math.max(2, Math.ceil(crossoverNfe))
  const gapFill =
    nfe > fillFrom
      ? `M ${x(fillFrom).toFixed(1)} ${y(xmTotal).toFixed(1)} ` +
        Array.from({ length: nfe - fillFrom + 1 }, (_, j) => `L ${x(fillFrom + j).toFixed(1)} ${y(diffTotal(fillFrom + j)).toFixed(1)}`).join(" ") +
        ` L ${x(nfe).toFixed(1)} ${y(xmTotal).toFixed(1)} Z`
      : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        where the compute goes · {N_SAMPLES} samples generated
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {[
            { label: "Diffusion Policy · 100 steps", v: 100 },
            { label: "Diffuser (Maze2D) · 256 steps", v: 256 },
          ].map((p) => (
            <button
              key={p.v}
              type="button"
              onClick={() => setNfe(p.v)}
              aria-pressed={nfe === p.v}
              className="cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground data-[active=true]:border-foreground/40 data-[active=true]:text-foreground"
              data-active={nfe === p.v}
            >
              {p.label}
            </button>
          ))}
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`At ${nfe} generation steps per sample, the step-factored generator spends ${diff.toFixed(0)} compute units against ${xmTotal.toFixed(0)} for the explorative model — a ${ratio.toFixed(0)}x gap`}>
          {/* gridlines evenly spaced in log-space, since the axis itself is log-scaled */}
          {[0, 0.5, 1].map((g) => (
            <line key={g} x1={PL} x2={W - PR} y1={PT + (1 - g) * (H - PT - PB)} y2={PT + (1 - g) * (H - PT - PB)} stroke="currentColor" className="text-border" strokeWidth={1} />
          ))}

          {/* gap fill: where the step-factored total exceeds XM's flat total */}
          {gapFill ? <path d={gapFill} fill={GEN} opacity={0.08} /> : null}

          {/* break-even marker */}
          <line x1={x(crossoverNfe)} x2={x(crossoverNfe)} y1={PT} y2={H - PB} stroke="currentColor" className="text-border" strokeDasharray="3 3" strokeWidth={1} />
          <text x={x(crossoverNfe) + 5} y={PT + 11} className="fill-muted-foreground font-mono" fontSize={9}>
            break-even ≈ {crossoverNfe.toFixed(1)} step{crossoverNfe >= 1.5 ? "s" : ""}
          </text>

          {/* XM flat line — one-time training cost, then NFE=1 forever */}
          <line x1={PL} x2={W - PR} y1={y(xmTotal)} y2={y(xmTotal)} stroke={XM} strokeWidth={2.5} strokeLinecap="round" />
          {/* diffusion rising line */}
          <path d={path} fill="none" stroke={GEN} strokeWidth={2.5} strokeLinecap="round" />

          <circle cx={x(nfe)} cy={y(diff)} r={4} fill={GEN} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={x(nfe)} cy={y(xmTotal)} r={4} fill={XM} stroke="var(--background)" strokeWidth={1.5} />
          <line x1={x(nfe)} x2={x(nfe)} y1={PT} y2={H - PB} stroke="currentColor" className="text-foreground/20" strokeWidth={1} />

          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            generation steps per sample (NFE) →
          </text>
        </svg>

        <div className="mt-1 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">NFE (drag)</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{nfe}</div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: GEN }}>step-factored total</div>
              <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: GEN }}>{diff.toFixed(0)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: XM }}>explorative total</div>
              <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: XM }}>{xmTotal.toFixed(0)}</div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">XM is</div>
              <div className="font-mono text-lg font-semibold tabular-nums text-foreground">{ratio.toFixed(0)}×<span className="text-xs text-muted-foreground"> cheaper</span></div>
            </div>
          </div>
        </div>

        <label className="mt-2 block">
          <span className="sr-only">generation steps per sample</span>
          <Range min={1} max={MAX_NFE} value={nfe} onChange={(e) => setNfe(Number(e.target.value))} className="w-full cursor-pointer" accent={GEN} />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The <span style={{ color: XM }} className="font-medium">explorative</span>{" "}line is flat because its
          training paid a one-time premium ({K_EXTRA}× extra generations per step, spent once) so inference could
          drop to a single forward pass. The <span style={{ color: GEN }} className="font-medium">step-factored</span>{" "}
          line keeps climbing because every one of its {N_SAMPLES} samples pays the full step count again. Drag to
          100 or 256 steps — the actual NFE gaps the paper measures on Diffusion Policy and Diffuser — and the ratio
          lands right around what it reports, even though these particular unit costs are illustrative.
        </p>
      </div>
    </figure>
  )
}
