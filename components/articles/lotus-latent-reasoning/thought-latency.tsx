"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the speedup comes from, on a shared wall-clock axis. Explicit CoT decodes the
// reasoning trace token-by-token: one sequential forward pass per token, so thought
// latency scales with how much it writes. LOTUS produces the whole trace in R=6 looped
// passes over the parallel latent region, so its thought phase barely moves when the
// rationale gets long. Two modes use the paper's own measured ms/example on Llama-3B:
// compact math CoT (338.8 → 133.0 ms, 2.5×) and verbose natural-language CoT (963.6 →
// 140.8 ms, 6.9×). Drag the playhead across wall-clock time and watch LOTUS finish while
// explicit CoT is still decoding.

const ACCENT = "oklch(0.58 0.16 300)" // lotus violet — LOTUS
const BASE = "oklch(0.62 0.02 260)" // muted — explicit

type Mode = "math" | "nl"
const MODES: Record<Mode, { label: string; explicit: number; lotus: number; speedup: string; loops: number }> = {
  math: { label: "compact math CoT", explicit: 338.8, lotus: 133.0, speedup: "2.5×", loops: 6 },
  nl: { label: "natural-language CoT", explicit: 963.6, lotus: 140.8, speedup: "6.9×", loops: 6 },
}

const W = 760
const H = 172
const MX = 44
const AXIS = W - 2 * MX
const EXP_Y = 42
const LOT_Y = 96
const BARH = 30

export function ThoughtLatency() {
  const [mode, setMode] = useState<Mode>("math")
  const [frac, setFrac] = useState(0.62) // playhead position 0..1 of explicit time

  const m = MODES[mode]
  const maxT = m.explicit
  const now = frac * maxT
  const lotusFrac = m.lotus / maxT
  const px = (t: number) => MX + (t / maxT) * AXIS

  const expFill = Math.min(now, m.explicit)
  const lotFill = Math.min(now, m.lotus)
  const lotusDone = now >= m.lotus

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>thought-phase latency · Llama-3.2-3B, ms/example</span>
        <span className="text-muted-foreground/50">paper, Table 2 &amp; 3</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Wall-clock comparison: explicit CoT ${m.explicit} ms versus LOTUS ${m.lotus} ms, a ${m.speedup} thought-phase speedup`}>
          <defs>
            <filter id="tl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* baseline axis */}
          <line x1={MX} y1={H - 30} x2={W - MX} y2={H - 30} stroke="var(--border)" strokeWidth={1} />
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <g key={f}>
              <line x1={MX + f * AXIS} y1={H - 34} x2={MX + f * AXIS} y2={H - 26} stroke="var(--border)" strokeWidth={1} />
              <text x={MX + f * AXIS} y={H - 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
                {Math.round(f * maxT)}
              </text>
            </g>
          ))}
          <text x={W - MX} y={H - 14} textAnchor="end" className="fill-muted-foreground/60 font-mono" fontSize={9} dx={0} dy={-14}>
            ms
          </text>

          {/* explicit track */}
          <text x={MX} y={EXP_Y - 8} className="fill-muted-foreground font-mono" fontSize={10}>
            explicit CoT · token-by-token decode
          </text>
          <rect x={MX} y={EXP_Y} width={AXIS} height={BARH} rx={6} fill="var(--muted)" opacity={0.35} />
          <rect x={MX} y={EXP_Y} width={(expFill / maxT) * AXIS} height={BARH} rx={6} fill={BASE} opacity={0.85} className="transition-none" />
          <text x={px(m.explicit) - 6} y={EXP_Y + 20} textAnchor="end" className="font-mono" fontSize={11} fontWeight={600} fill="var(--background)">
            {m.explicit} ms
          </text>

          {/* lotus track */}
          <text x={MX} y={LOT_Y - 8} className="font-mono" fontSize={10} style={{ fill: ACCENT }}>
            LOTUS · R = {m.loops} looped passes over the latent region
          </text>
          <rect x={MX} y={LOT_Y} width={lotusFrac * AXIS} height={BARH} rx={6} fill="var(--muted)" opacity={0.35} />
          <rect x={MX} y={LOT_Y} width={(lotFill / maxT) * AXIS} height={BARH} rx={6} fill={ACCENT} opacity={0.9} filter="url(#tl-soft)" />
          {/* R pass ticks */}
          {Array.from({ length: m.loops - 1 }, (_, i) => {
            const tx = MX + ((i + 1) / m.loops) * lotusFrac * AXIS
            return <line key={i} x1={tx} y1={LOT_Y + 4} x2={tx} y2={LOT_Y + BARH - 4} stroke="var(--background)" strokeWidth={1} opacity={0.6} />
          })}
          <text x={px(m.lotus) + 8} y={LOT_Y + 20} className="font-mono" fontSize={11} fontWeight={600} style={{ fill: ACCENT }}>
            {m.lotus} ms{lotusDone ? " ✓ done" : ""}
          </text>

          {/* playhead */}
          <line x1={px(now)} y1={EXP_Y - 4} x2={px(now)} y2={LOT_Y + BARH + 4} stroke="var(--foreground)" strokeWidth={1.5} opacity={0.55} />
          <circle cx={px(now)} cy={EXP_Y - 4} r={3.5} fill="var(--foreground)" opacity={0.7} />
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">rationale</span>
            {(Object.keys(MODES) as Mode[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setMode(k)}
                aria-pressed={mode === k}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", mode === k ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={mode === k ? { background: ACCENT } : undefined}
              >
                {MODES[k].label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            thought speedup <span style={{ color: ACCENT }}>{m.speedup}</span> · at {Math.round(now)} ms:{" "}
            {lotusDone ? (
              <span style={{ color: ACCENT }}>LOTUS done</span>
            ) : (
              <span>both running</span>
            )}
            , explicit {Math.round((expFill / m.explicit) * 100)}%
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">wall-clock (drag)</div>
          <input type="range" min={0} max={1000} value={Math.round(frac * 1000)} onChange={(e) => setFrac(Number(e.target.value) / 1000)} className="w-full cursor-pointer accent-[oklch(0.58_0.16_300)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Explicit CoT&apos;s thought phase grows with how much it writes — swap the compact math chain for a verbose
          natural-language rationale and it balloons from 338.8 to 963.6 ms. LOTUS barely moves (133.0 → 140.8 ms): the trace
          is always R = 6 parallel passes, so the same mechanism buys a{" "}
          <span style={{ color: ACCENT }}>2.5×</span> speedup on math and a <span style={{ color: ACCENT }}>6.9×</span> speedup
          on natural language. (Query-prefill and answer phases are near-identical across methods; only the thought phase moves.)
        </p>
      </div>
    </figure>
  )
}
