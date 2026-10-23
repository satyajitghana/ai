"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Does the arithmetic close? Two quantities that should agree if a lab's reported
// numbers are internally consistent:
//   needed    = 6 x N_active x D                          (forward + backward FLOPs)
//   delivered = GPUs x peak x seconds x MFU x goodput     (what the cluster did)
// Preset to Microsoft's stated MAI-Base-2 run: 80B active, 50T tokens, 16k GB200s,
// 38 days, 21% MFU normalised by 2.5 PFLOPS (BF16 dense), 89% goodput.
// Everything here is plain + - * /, so server and client render identical numbers.

const ACCENT = "oklch(0.6 0.16 45)"
const ALT = "oklch(0.55 0.12 200)"

const W = 760
const H = 250
const BX = 170
const BW = 540

const R2 = (n: number): number => Math.round(n * 100) / 100

type Preset = {
  n: number
  d: number
  gpus: number
  days: number
  peak: number
  mfu: number
  good: number
  useGood: boolean
}

const MAI2: Preset = { n: 80, d: 50, gpus: 16384, days: 38, peak: 2.5, mfu: 21, good: 89, useGood: true }

function sci(x: number): string {
  const [m, e] = x.toExponential(2).split("e")
  return `${m} × 10^${Number(e)}`
}

export function ComputeReconciler() {
  const [s, setS] = useState<Preset>(MAI2)
  const set = (k: keyof Preset, v: number | boolean) => setS((p) => ({ ...p, [k]: v }))

  const needed = 6 * s.n * 1e9 * s.d * 1e12
  const seconds = s.days * 86400
  const rawPeak = s.gpus * s.peak * 1e15 * seconds
  const goodFrac = s.useGood ? s.good / 100 : 1
  const delivered = rawPeak * (s.mfu / 100) * goodFrac
  const ratio = needed / delivered
  const impliedMfu = (needed / (rawPeak * goodFrac)) * 100

  const top = Math.max(needed, delivered) * 1.08
  const wNeed = R2((needed / top) * BW)
  const wDel = R2((delivered / top) * BW)

  const verdict =
    ratio > 0.9 && ratio < 1.1
      ? "closes within 10%"
      : ratio >= 1.1
        ? "the cluster could not have done this much work"
        : "the cluster had room to spare"

  const isPreset = JSON.stringify(s) === JSON.stringify(MAI2)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>compute reconciler · 6·N·D vs cluster time</span>
        <span className="text-muted-foreground/50">reasoned arithmetic</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Needed ${sci(needed)} FLOPs; the cluster delivered ${sci(delivered)} FLOPs; ratio ${ratio.toFixed(3)}.`}
        >
          <text x={BX} y={34} className="fill-muted-foreground font-mono" fontSize={11}>
            training FLOPs, same linear scale
          </text>

          <text x={BX - 12} y={74} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            needed
          </text>
          <text x={BX - 12} y={90} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            6 × N × D
          </text>
          <rect x={BX} y={62} width={BW} height={30} rx={6} fill="var(--muted)" opacity={0.45} />
          <rect x={BX} y={62} width={wNeed} height={30} rx={6} fill={ALT} />
          <text x={BX + 8} y={82} className="font-mono" fontSize={12} fontWeight={600} fill="var(--background)">
            {sci(needed)}
          </text>

          <text x={BX - 12} y={136} textAnchor="end" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>
            delivered
          </text>
          <text x={BX - 12} y={152} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>
            GPUs × peak × t × MFU{s.useGood ? " × goodput" : ""}
          </text>
          <rect x={BX} y={124} width={BW} height={30} rx={6} fill="var(--muted)" opacity={0.45} />
          <rect x={BX} y={124} width={wDel} height={30} rx={6} fill={ACCENT} />
          <text x={BX + 8} y={144} className="font-mono" fontSize={12} fontWeight={600} fill="var(--background)">
            {sci(delivered)}
          </text>

          <line x1={BX + wNeed} y1={54} x2={BX + wNeed} y2={162} stroke={ALT} strokeDasharray="3 3" strokeWidth={1.2} />

          <text x={BX} y={196} className="fill-foreground font-mono" fontSize={13} fontWeight={600}>
            needed ÷ delivered = <tspan fill={ACCENT}>{ratio.toFixed(3)}</tspan>
            <tspan className="fill-muted-foreground" fontWeight={400}>{`  · ${verdict}`}</tspan>
          </text>
          <text x={BX} y={220} className="fill-muted-foreground font-mono" fontSize={11}>
            MFU these inputs imply: <tspan className="fill-foreground">{impliedMfu.toFixed(1)}%</tspan>
            {`  · peak over the run: ${sci(rawPeak)}`}
          </text>
        </svg>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setS(MAI2)}
            aria-pressed={isPreset}
            className={
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
              (isPreset ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
            }
          >
            Microsoft&apos;s stated numbers
          </button>
          {[
            { label: "BF16 peak 2.5 PF", v: 2.5 },
            { label: "FP8 peak 5 PF", v: 5 },
          ].map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => set("peak", o.v)}
              aria-pressed={s.peak === o.v}
              className={
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                (s.peak === o.v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
              }
            >
              {o.label}
            </button>
          ))}
          <label className="ml-auto flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={s.useGood} onChange={(e) => set("useGood", e.target.checked)} />
            MFU counts only productive time (apply goodput)
          </label>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
          {(
            [
              { k: "n", label: "active params", unit: "B", min: 10, max: 200, step: 1 },
              { k: "d", label: "training tokens", unit: "T", min: 5, max: 80, step: 1 },
              { k: "gpus", label: "GPUs", unit: "", min: 2048, max: 32768, step: 512 },
              { k: "days", label: "wall-clock days", unit: "", min: 10, max: 120, step: 1 },
              { k: "mfu", label: "MFU", unit: "%", min: 5, max: 60, step: 1 },
              { k: "good", label: "goodput", unit: "%", min: 50, max: 100, step: 1 },
            ] as const
          ).map((c) => (
            <div key={c.k}>
              <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
                <span>{c.label}</span>
                <span className="text-foreground">
                  {(s[c.k] as number).toLocaleString("en-US")}
                  {c.unit}
                </span>
              </div>
              <Range
                min={c.min}
                max={c.max}
                step={c.step}
                value={s[c.k] as number}
                onChange={(e) => set(c.k, Number(e.target.value))}
                className="w-full cursor-pointer"
                accent={ACCENT}
                aria-label={c.label}
              />
            </div>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          With Microsoft&apos;s numbers and 16,384 GPUs the two bars agree to within about 5%; with exactly 16,000 GPUs,
          about 2%. Untick goodput and the cluster appears to have done about 18% more work than 6·N·D needs, so the
          21% reads most naturally as a figure over productive time. Switch the peak to FP8 and the same run reads as about 10.5% MFU, which
          is why the denominator matters.
        </p>
      </div>
    </figure>
  )
}
