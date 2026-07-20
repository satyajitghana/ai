"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

// The controlled swap. Hold the MODEL constant; change only the orchestration
// layer — a frozen conventional production loop vs the Writer Agent Harness —
// and read off the four headline metrics. Blended across six models and 22
// locked tasks. Numbers are the paper's reported aggregates (Sayed Ali et al.,
// 2026); the scene is illustrative.

const ACCENT = "oklch(0.62 0.14 250)"
const r2 = (n: number) => Math.round(n * 100) / 100

type Mode = "loop" | "harness"

const MODELS = ["Sonnet 4.6", "Gemini 3.1", "Flash 3.5", "Qwen 3.6", "GLM 5.1", "Palmyra X6"]

type Metric = {
  key: string
  label: string
  loop: number
  harness: number
  max: number
  delta: string
  fmt: (v: number) => string
}

const METRICS: Metric[] = [
  { key: "cost", label: "cost / task", loop: 0.21, harness: 0.12, max: 0.21, delta: "−41%", fmt: (v) => `$${v.toFixed(2)}` },
  { key: "wall", label: "wall-clock / task", loop: 48, harness: 27, max: 48, delta: "−44%", fmt: (v) => `${Math.round(v)}s` },
  { key: "tokens", label: "tokens / task", loop: 14200, harness: 8800, max: 14200, delta: "−38%", fmt: (v) => `${(v / 1000).toFixed(1)}k` },
  { key: "quality", label: "completion quality", loop: 0.78, harness: 0.81, max: 0.9, delta: "+0.03", fmt: (v) => v.toFixed(2) },
]

// scene geometry (viewBox units)
const W = 760
const H = 320
const LX = 24, LW = 150, LY = 48, LH = 224 // models container
const OX = 250, OW = 172, OY = 124, OH = 72 // orchestration node
const CX = 484, CW = 252, CARDH = 64, CGAP = 8, CY0 = 20 // metric cards

const cardY = (i: number) => CY0 + i * (CARDH + CGAP)

function hcurve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${r2(x1)} ${r2(y1)} C ${r2(mx)} ${r2(y1)}, ${r2(mx)} ${r2(y2)}, ${r2(x2)} ${r2(y2)}`
}

function useAnimatedNumber(target: number, ms = 480) {
  const [val, setVal] = useState(target)
  const fromRef = useRef(target)
  useEffect(() => {
    const from = fromRef.current
    if (from === target) return
    let raf = 0
    let startTs = 0
    const step = (ts: number) => {
      if (!startTs) startTs = ts
      const p = Math.min(1, (ts - startTs) / ms)
      const e = 1 - Math.pow(1 - p, 3)
      setVal(from + (target - from) * e)
      if (p < 1) raf = requestAnimationFrame(step)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return val
}

export function ControlledSwap() {
  const [mode, setMode] = useState<Mode>("loop")
  const on = mode === "harness"

  const v0 = useAnimatedNumber(on ? METRICS[0].harness : METRICS[0].loop)
  const v1 = useAnimatedNumber(on ? METRICS[1].harness : METRICS[1].loop)
  const v2 = useAnimatedNumber(on ? METRICS[2].harness : METRICS[2].loop)
  const v3 = useAnimatedNumber(on ? METRICS[3].harness : METRICS[3].loop)
  const vals = [v0, v1, v2, v3]

  const oCenterY = OY + OH / 2
  const barW = CW - 24

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>controlled swap · model fixed, orchestration swapped</span>
        <span className="text-muted-foreground/50">6 models · 22 tasks</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Six foundation models held constant feed a swappable orchestration layer, currently the ${on ? "Writer Agent Harness" : "frozen production loop"}, which sets cost, wall-clock, tokens, and quality per task.`}>
          <defs>
            <marker id="cs-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="cs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* connectors: models -> orchestration -> each card */}
          <path d={hcurve(LX + LW, oCenterY, OX, oCenterY)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#cs-arrow)" opacity={0.7} />
          {METRICS.map((_, i) => (
            <path key={i} d={hcurve(OX + OW, oCenterY, CX, cardY(i) + CARDH / 2)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#cs-arrow)" opacity={0.55} />
          ))}

          {/* models container (held constant) */}
          <text x={LX} y={LY - 14} className="fill-muted-foreground font-mono" fontSize={10}>6 models · held constant</text>
          <rect x={LX} y={LY} width={LW} height={LH} rx={10} fill="var(--muted)" opacity={0.35} stroke="var(--border)" strokeWidth={1.5} />
          {MODELS.map((m, i) => {
            const py = 62 + i * 34
            return (
              <g key={m}>
                <rect x={LX + 8} y={py} width={LW - 16} height={26} rx={6} fill="var(--background)" stroke="var(--border)" strokeWidth={1} />
                <text x={LX + LW / 2} y={py + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>{m}</text>
              </g>
            )
          })}

          {/* orchestration node (swappable) */}
          <rect x={OX} y={OY} width={OW} height={OH} rx={12} fill={on ? ACCENT : "var(--muted)"} fillOpacity={on ? 0.14 : 0.5} stroke={on ? ACCENT : "var(--border)"} strokeWidth={1.5} filter="url(#cs-soft)" className="transition-all duration-300" />
          <text x={OX + OW / 2} y={OY + 28} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>orchestration layer</text>
          <text x={OX + OW / 2} y={OY + 49} textAnchor="middle" fontSize={13} fontWeight={600} fill={on ? ACCENT : "var(--muted-foreground)"} className="font-mono">{on ? "Writer Harness" : "production loop"}</text>

          {/* metric cards */}
          {METRICS.map((mt, i) => {
            const y = cardY(i)
            const frac = vals[i] / mt.max
            const fillW = r2(Math.max(2, frac * barW))
            return (
              <g key={mt.key}>
                <rect x={CX} y={y} width={CW} height={CARDH} rx={9} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#cs-soft)" />
                <text x={CX + 12} y={y + 21} className="fill-muted-foreground font-mono" fontSize={11}>{mt.label}</text>
                <text x={CX + CW - 12} y={y + 22} textAnchor="end" className="font-mono" fontSize={15} fontWeight={600} fill={on ? ACCENT : "var(--foreground)"}>{mt.fmt(vals[i])}</text>
                <rect x={CX + 12} y={y + 38} width={barW} height={8} rx={4} fill="var(--muted)" />
                <rect x={CX + 12} y={y + 38} width={fillW} height={8} rx={4} fill={on ? ACCENT : "var(--muted-foreground)"} className="transition-all duration-300" />
                {on ? (
                  <text x={CX + 12} y={y + 58} className="font-mono" fontSize={9} fill={ACCENT}>{mt.delta} vs loop</text>
                ) : null}
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="font-mono text-[10px] text-muted-foreground">orchestration</span>
          {(["loop", "harness"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === m ? { background: ACCENT } : undefined}
            >
              {m === "loop" ? "production loop" : "Writer harness"}
            </button>
          ))}
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            same models · same tasks · same price table
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Only the middle box changes. Flip it from the{" "}
          <span className="text-foreground">frozen production loop</span> to the{" "}
          <span style={{ color: ACCENT }}>Writer Harness</span> and, with the six models held
          constant, cost drops 41%, wall-clock 44%, and tokens 38% — while task-completion quality
          holds at parity (0.78 → 0.81). The lever is the orchestration layer, not the model.
        </p>
      </div>
    </figure>
  )
}
