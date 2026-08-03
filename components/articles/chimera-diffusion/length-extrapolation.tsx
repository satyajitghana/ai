"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Zero-shot video-length extrapolation, traced from the paper's Figure 16b
// (FID % change from the 5s baseline, at each tested duration). The six
// x-positions (5, 10, 15, 20, 25, 30s) are the durations the paper actually
// evaluated; the endpoints match the reported numbers exactly (6.5% / 50.5% /
// 53.6%). All models trained only on 5-second clips, no length-specific
// fine-tuning; metrics computed on the final 5s of each generated clip.

const DURATIONS = [5, 10, 15, 20, 25, 30]

const SERIES: { key: string; label: string; color: string; values: number[] }[] = [
  { key: "chimera", label: "Chimera (KDA/MLA)", color: "oklch(0.72 0.15 195)", values: [0, -1.2, -0.8, 1.6, 4.2, 6.5] },
  { key: "wan", label: "Wan2.1-T2V-1.3B", color: "oklch(0.62 0.14 20)", values: [0, 7.2, 23.8, 38.0, 46.8, 50.5] },
  { key: "hunyuan", label: "HunyuanVideo-1.5", color: "oklch(0.6 0.12 145)", values: [0, 12.8, 21.3, 37.3, 48.4, 53.6] },
]

const W = 700
const H = 320
const padL = 44
const padR = 16
const padT = 20
const padB = 34

const r2 = (n: number) => Math.round(n * 100) / 100

export function LengthExtrapolation() {
  const [idx, setIdx] = useState(DURATIONS.length - 1)

  const duration = DURATIONS[idx]
  const yMax = 60

  const sx = (d: number) => r2(padL + ((d - 5) / (30 - 5)) * (W - padL - padR))
  const sy = (v: number) => r2(padT + (1 - v / yMax) * (H - padT - padB))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        zero-shot length extrapolation · trained on 5s, tested to 30s
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`FID percent change from the 5-second baseline as video length grows to 30 seconds. At ${duration} seconds: Chimera ${SERIES[0].values[idx].toFixed(1)}%, Wan2.1 ${SERIES[1].values[idx].toFixed(1)}%, HunyuanVideo ${SERIES[2].values[idx].toFixed(1)}%.`}
        >
          {/* gridlines */}
          {[0, 10, 20, 30, 40, 50, 60].map((v) => (
            <g key={v}>
              <line x1={padL} y1={sy(v)} x2={W - padR} y2={sy(v)} stroke="currentColor" strokeOpacity={v === 0 ? 0.25 : 0.08} />
              <text x={padL - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>
                {v}%
              </text>
            </g>
          ))}

          {/* series lines */}
          {SERIES.map((s) => (
            <polyline
              key={s.key}
              points={DURATIONS.map((d, i) => `${sx(d)},${sy(s.values[i])}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={s.key === "chimera" ? 2.4 : 1.6}
              strokeDasharray={s.key === "chimera" ? undefined : "5 3"}
              opacity={s.key === "chimera" ? 1 : 0.85}
            />
          ))}

          {/* current-duration marker + dots */}
          <line x1={sx(duration)} y1={padT} x2={sx(duration)} y2={H - padB} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
          {SERIES.map((s) => (
            <circle key={s.key} cx={sx(duration)} cy={sy(s.values[idx])} r={s.key === "chimera" ? 4.5 : 3.5} fill={s.color} />
          ))}

          {/* x ticks */}
          {DURATIONS.map((d) => (
            <text key={d} x={sx(d)} y={H - padB + 16} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
              {d}s
            </text>
          ))}
          <text x={(padL + W - padR) / 2} y={H - 4} textAnchor="middle" className="fill-muted-foreground/50 font-mono" fontSize={9}>
            generated video duration
          </text>
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {SERIES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
              <span className="inline-block h-0.5 w-3" style={{ background: s.color }} />
              {s.label}
              <span className="tabular-nums" style={{ color: s.color }}>
                {s.values[idx] >= 0 ? "+" : ""}
                {s.values[idx].toFixed(1)}%
              </span>
            </span>
          ))}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>video duration</span>
            <span className="tabular-nums text-foreground">{duration}s · {(duration / 5).toFixed(0)}× training length</span>
          </div>
          <Range
            min={0}
            max={DURATIONS.length - 1}
            step={1}
            value={idx}
            onChange={(e) => setIdx(Number(e.target.value))}
            className="w-full"
            aria-label="video duration"
            accent={SERIES[0].color}
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          None of these models were trained past 5 seconds. Push all three to 30 seconds — 6× their training length
          — with no fine-tuning, and Wan2.1 and HunyuanVideo both degrade past{" "}
          <span style={{ color: SERIES[1].color }}>+50%</span>{" "}FID. Chimera stays under{" "}
          <span style={{ color: SERIES[0].color }}>+7%</span>, and its absolute FID is the lowest of the three at
          every duration shown, not just the flattest curve.
        </p>
      </div>
    </figure>
  )
}
