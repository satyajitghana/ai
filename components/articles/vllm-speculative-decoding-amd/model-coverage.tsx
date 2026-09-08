"use client"

import { useState } from "react"

// One drafting method (DFlash), the post's own peak measured throughput ratio
// on MATH500 for every target model it was benchmarked against, at that
// model's best proposal length within the tested sweep {3, 7, 11, 15}.
//
// Source: the appendix's per-model / per-method / per-dataset tables.
// MiniMax-M3-MXFP8 has no DFlash row in the post's coverage table at all —
// shown as untested, not as zero.
const MODELS: {
  key: string
  label: string
  ratio: number | null
  n: number | null
  mal: number | null
  ar: number | null
  baseline: number | null
}[] = [
  { key: "gemma26", label: "gemma-4-26B-A4B-it", ratio: 2.87, n: 7, mal: 5.26, ar: 60.9, baseline: 2181 },
  { key: "kimi", label: "Kimi-K2.5", ratio: 2.68, n: 7, mal: 5.38, ar: 62.6, baseline: 310 },
  { key: "gemma31", label: "gemma-4-31B-it", ratio: 2.34, n: 7, mal: 5.76, ar: 68.0, baseline: 1365 },
  { key: "qwen366_35a3b", label: "Qwen3.6-35B-A3B", ratio: 2.06, n: 7, mal: 5.82, ar: 68.8, baseline: 2235 },
  { key: "qwen35_122a10b", label: "Qwen3.5-122B-A10B", ratio: 1.78, n: 7, mal: 4.45, ar: 49.2, baseline: 1446 },
  { key: "qwen35_27b", label: "Qwen3.5-27B", ratio: 1.65, n: 11, mal: 6.98, ar: 54.3, baseline: 1500 },
  { key: "qwen36_27b", label: "Qwen3.6-27B", ratio: 1.59, n: 11, mal: 6.86, ar: 53.3, baseline: 1514 },
  { key: "qwen3_8b", label: "Qwen3-8B", ratio: 1.1, n: 15, mal: 7.52, ar: 43.5, baseline: 3530 },
  { key: "minimax", label: "MiniMax-M3-MXFP8", ratio: null, n: null, mal: null, ar: null, baseline: null },
]

const HIGH = "oklch(0.6 0.15 255)"
const LOW = "oklch(0.68 0.13 85)"
const MUTED = "oklch(0.62 0.03 250)"

export function ModelCoverage() {
  const [hover, setHover] = useState<string | null>(null)
  const active = MODELS.find((m) => m.key === hover) ?? null

  const W = 700
  const rowH = 30
  const H = MODELS.length * rowH + 26
  const labelW = 168
  const barMaxW = W - labelW - 92
  const axisMax = 3 // room past the 2.87x max

  const xFor = (r: number) => (r / axisMax) * barMaxW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">DFlash · peak measured ratio · MATH500</span>
        <span className="font-mono text-[10px] text-muted-foreground">hover a bar for N / MAL / acceptance</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              DFlash&rsquo;s peak measured throughput ratio over the non-speculative baseline on MATH500, for every
              target model the post benchmarked it against, sorted from largest to smallest gain. MiniMax-M3-MXFP8
              has no DFlash checkpoint tested in the post.
            </title>

            {/* baseline reference at 1.0x */}
            <line
              x1={labelW + xFor(1)}
              y1={8}
              x2={labelW + xFor(1)}
              y2={H - 16}
              stroke="currentColor"
              strokeOpacity={0.3}
              strokeDasharray="2,3"
            />
            <text x={labelW + xFor(1)} y={7} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              1.0x
            </text>
            {[2, 3].map((t) => (
              <text
                key={t}
                x={labelW + xFor(t)}
                y={H - 4}
                fontSize={8.5}
                textAnchor="middle"
                fill="currentColor"
                fillOpacity={0.4}
                fontFamily="ui-monospace, monospace"
              >
                {t}x
              </text>
            ))}

            {MODELS.map((m, i) => {
              const y = 16 + i * rowH
              const isHover = hover === m.key
              const untested = m.ratio == null
              const color = untested ? MUTED : m.ratio! >= 2 ? HIGH : LOW
              return (
                <g
                  key={m.key}
                  onMouseEnter={() => setHover(m.key)}
                  onMouseLeave={() => setHover(null)}
                  className={untested ? undefined : "cursor-pointer"}
                >
                  <rect x={0} y={y - 3} width={W} height={rowH - 4} rx={6} fill="currentColor" fillOpacity={isHover ? 0.05 : 0} />
                  <text x={labelW - 10} y={y + rowH / 2 - 8} fontSize={10.5} textAnchor="end" fill="currentColor" fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                    {m.label}
                  </text>
                  {untested ? (
                    <>
                      <rect
                        x={labelW}
                        y={y + 2}
                        width={xFor(1)}
                        height={12}
                        rx={3}
                        fill="none"
                        stroke={MUTED}
                        strokeOpacity={0.35}
                        strokeDasharray="2,2"
                      />
                      <text x={labelW + xFor(1) + 8} y={y + 12} fontSize={9.5} fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                        not benchmarked with DFlash
                      </text>
                    </>
                  ) : (
                    <>
                      <rect x={labelW} y={y + 2} width={xFor(m.ratio!)} height={12} rx={3} fill={color} fillOpacity={isHover ? 0.95 : 0.8} />
                      <text
                        x={labelW + xFor(m.ratio!) + 8}
                        y={y + 12}
                        fontSize={10}
                        fill="currentColor"
                        fillOpacity={0.85}
                        fontFamily="ui-monospace, monospace"
                        fontWeight={isHover ? 600 : 400}
                      >
                        {m.ratio!.toFixed(2)}x
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex min-h-[2.5rem] items-center rounded-md border border-dashed px-3 py-1.5 font-mono text-[11px] text-muted-foreground">
          {active && active.ratio != null ? (
            <span>
              <span className="text-foreground">{active.label}</span> — N={active.n}, mean accepted length{" "}
              {active.mal!.toFixed(2)}, acceptance {active.ar!.toFixed(1)}%, baseline {active.baseline!.toLocaleString("en-US")} tok/s
            </span>
          ) : active ? (
            <span>{active.label} has no DFlash speculator tested in the post&rsquo;s coverage table.</span>
          ) : (
            <span>Nine target models, one method, one dataset. The gap between the top and bottom rows is the point.</span>
          )}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same method, same benchmark, <span className="text-foreground">2.6x of spread</span>. DFlash&rsquo;s peak
          climbs to <span style={{ color: HIGH }}>2.87x</span> on gemma-4-26B-A4B-it and only{" "}
          <span style={{ color: LOW }}>1.10x</span> on Qwen3-8B — and the Qwen3.6 pair shows the same split inside
          one model family: <span style={{ color: LOW }}>1.59x</span> on the 27B dense model,{" "}
          <span style={{ color: HIGH }}>2.06x</span> on the 35B-A3B mixture-of-experts variant. A drafting method is
          not a single number; it is a number that depends on what it is drafting for.
        </p>
      </div>
    </figure>
  )
}
