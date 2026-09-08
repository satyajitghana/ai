"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The five drafting methods, drawn as what they actually are — a generation
// pattern (sequential chain / parallel block / hybrid) — next to the real
// measured throughput ratio on two of the post's own target models.
//
// Numbers are the post's own appendix rows, at each method's own best proposal
// length WITHIN THE TESTED SWEEP for that target model, MATH500:
//
//   gemma-4-31B-it        baseline 1,365 tok/s
//     Gemma 4 MTP  N=4  2.20x  MAL 4.41  AR 85.2%
//     EAGLE-3      N=5  2.12x  MAL 4.24  AR 64.8%
//     DFlash       N=7  2.34x  MAL 5.76  AR 68.0%
//     DSpark       N=7  2.20x  MAL 5.30  AR 61.4%
//     (native MTP: not in the post's coverage table for this target)
//
//   Qwen3.5-122B-A10B    baseline 1,446 tok/s
//     Native MTP   N=7  2.20x  MAL 5.91  AR 70.1%
//     DFlash       N=7  1.78x  MAL 4.45  AR 49.2%
//     (Gemma 4 MTP / EAGLE-3 / DSpark: not in the post's coverage table)
//
// "Not tested" cells are the post's own coverage gaps, not omissions on my part —
// worth showing as-is rather than filling in.

type Pattern = "sequential-native" | "sequential-paired" | "sequential-auto" | "parallel" | "hybrid"

type Reading = { n: number; ratio: number; mal: number; ar: number }

type Method = {
  key: string
  name: string
  pattern: Pattern
  uses: string
  gemma31: Reading | null
  qwen122: Reading | null
}

const METHODS: Method[] = [
  {
    key: "native-mtp",
    name: "Native MTP",
    pattern: "sequential-native",
    uses: "the target's own hidden state, reused through repeated MTP steps",
    gemma31: null,
    qwen122: { n: 7, ratio: 2.2, mal: 5.91, ar: 70.1 },
  },
  {
    key: "gemma4-mtp",
    name: "Gemma 4 MTP",
    pattern: "sequential-paired",
    uses: "target activations and a shared target KV cache",
    gemma31: { n: 4, ratio: 2.2, mal: 4.41, ar: 85.2 },
    qwen122: null,
  },
  {
    key: "eagle3",
    name: "EAGLE-3",
    pattern: "sequential-auto",
    uses: "fused early / mid / late target hidden states",
    gemma31: { n: 5, ratio: 2.12, mal: 4.24, ar: 64.8 },
    qwen122: null,
  },
  {
    key: "dflash",
    name: "DFlash",
    pattern: "parallel",
    uses: "fused target features, supplied as K/V in every draft layer",
    gemma31: { n: 7, ratio: 2.34, mal: 5.76, ar: 68.0 },
    qwen122: { n: 7, ratio: 1.78, mal: 4.45, ar: 49.2 },
  },
  {
    key: "dspark",
    name: "DSpark",
    pattern: "hybrid",
    uses: "the same target features, plus a lightweight Markov head",
    gemma31: { n: 7, ratio: 2.2, mal: 5.3, ar: 61.4 },
    qwen122: null,
  },
]

const GEMMA_C = "oklch(0.65 0.17 25)"
const QWEN_C = "oklch(0.6 0.15 255)"
const AXIS_MAX = 2.6

// A tiny generation-pattern glyph. Sequential chains draw one token box after
// another with an arrow between them. Parallel drops dashed arrows straight
// down from a shared context bar, with no horizontal links at all. Hybrid
// draws both — the sequential link is thin, a correction riding on top of a
// parallel pass, not the main path.
function PatternGlyph({ pattern }: { pattern: Pattern }) {
  const n = 4
  const w = 132
  const h = 46
  const boxW = 18
  const gap = (w - n * boxW) / (n - 1)
  const bx = (i: number) => i * (boxW + gap)
  const seq = pattern === "sequential-native" || pattern === "sequential-paired" || pattern === "sequential-auto"
  const parallel = pattern === "parallel" || pattern === "hybrid"
  const hybridLink = pattern === "hybrid"

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width={w} height={h} role="img" aria-hidden>
      {parallel && (
        <>
          <rect x={0} y={2} width={w} height={7} rx={3} fill="currentColor" fillOpacity={0.18} />
          {Array.from({ length: n }, (_, i) => (
            <line
              key={`d${i}`}
              x1={bx(i) + boxW / 2}
              y1={9}
              x2={bx(i) + boxW / 2}
              y2={24}
              stroke="currentColor"
              strokeOpacity={0.35}
              strokeDasharray="2,2"
            />
          ))}
        </>
      )}
      {Array.from({ length: n }, (_, i) => (
        <rect
          key={i}
          x={bx(i)}
          y={24}
          width={boxW}
          height={18}
          rx={4}
          fill={seq ? QWEN_C : GEMMA_C}
          fillOpacity={0.8}
        />
      ))}
      {seq &&
        Array.from({ length: n - 1 }, (_, i) => (
          <path
            key={`a${i}`}
            d={`M ${bx(i) + boxW} 33 L ${bx(i + 1) - 1} 33`}
            stroke="currentColor"
            strokeOpacity={0.55}
            strokeWidth={1.5}
            markerEnd="url(#mp-arrow)"
          />
        ))}
      {hybridLink &&
        Array.from({ length: n - 1 }, (_, i) => (
          <path
            key={`h${i}`}
            d={`M ${bx(i) + boxW} 38 L ${bx(i + 1) - 1} 38`}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeWidth={1}
          />
        ))}
    </svg>
  )
}

function Dot({ x, y, color, label }: { x: number; y: number; color: string; label: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={5} fill={color} />
      <title>{label}</title>
    </g>
  )
}

export function MethodPatterns() {
  const [sel, setSel] = useState<string>("dflash")
  const active = METHODS.find((m) => m.key === sel)!

  const axisW = 300
  const xFor = (r: number) => (Math.min(r, AXIS_MAX) / AXIS_MAX) * axisW

  const rowH = 58
  const H = METHODS.length * rowH + 30
  const glyphW = 160
  const W = glyphW + axisW + 40

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">generation pattern → measured throughput ratio</span>
        <span className="flex items-center gap-3 font-mono text-[10px]">
          <span className="flex items-center gap-1" style={{ color: GEMMA_C }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: GEMMA_C }} /> gemma-4-31B-it
          </span>
          <span className="flex items-center gap-1" style={{ color: QWEN_C }}>
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: QWEN_C }} /> Qwen3.5-122B-A10B
          </span>
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[560px] max-w-full">
            <title>
              Five speculative-decoding drafting methods: their generation pattern (sequential, parallel, or hybrid)
              and their measured throughput ratio over the non-speculative baseline on gemma-4-31B-it and
              Qwen3.5-122B-A10B, MATH500, at each method&rsquo;s own best tested proposal length.
            </title>
            <defs>
              <marker id="mp-arrow" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.5} />
              </marker>
            </defs>

            {/* axis */}
            <line
              x1={glyphW}
              y1={12}
              x2={glyphW}
              y2={H - 18}
              stroke="currentColor"
              strokeOpacity={0.25}
              strokeDasharray="2,3"
            />
            <text x={glyphW} y={10} fontSize={9} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace" textAnchor="middle">
              1.0x
            </text>
            {[1.5, 2, 2.5].map((t) => (
              <g key={t}>
                <line
                  x1={glyphW + xFor(t)}
                  y1={12}
                  x2={glyphW + xFor(t)}
                  y2={H - 18}
                  stroke="currentColor"
                  strokeOpacity={0.08}
                />
                <text
                  x={glyphW + xFor(t)}
                  y={H - 6}
                  fontSize={8.5}
                  textAnchor="middle"
                  fill="currentColor"
                  fillOpacity={0.45}
                  fontFamily="ui-monospace, monospace"
                >
                  {t}x
                </text>
              </g>
            ))}

            {METHODS.map((m, i) => {
              const y = 20 + i * rowH
              const isSel = m.key === sel
              return (
                <g key={m.key} onClick={() => setSel(m.key)} className="cursor-pointer" opacity={isSel ? 1 : 0.72}>
                  <rect
                    x={0}
                    y={y - 14}
                    width={W}
                    height={rowH - 6}
                    rx={8}
                    fill="currentColor"
                    fillOpacity={isSel ? 0.05 : 0}
                  />
                  <foreignObject x={0} y={y - 12} width={glyphW - 8} height={rowH - 12}>
                    <div className="flex h-full flex-col justify-center gap-1">
                      <span className="font-mono text-[11px] font-medium text-foreground">{m.name}</span>
                      <PatternGlyph pattern={m.pattern} />
                    </div>
                  </foreignObject>

                  {m.gemma31 && (
                    <Dot
                      x={glyphW + xFor(m.gemma31.ratio)}
                      y={y + 6}
                      color={GEMMA_C}
                      label={`gemma-4-31B-it: ${m.gemma31.ratio.toFixed(2)}x at N=${m.gemma31.n}`}
                    />
                  )}
                  {m.qwen122 && (
                    <Dot
                      x={glyphW + xFor(m.qwen122.ratio)}
                      y={y + 6}
                      color={QWEN_C}
                      label={`Qwen3.5-122B-A10B: ${m.qwen122.ratio.toFixed(2)}x at N=${m.qwen122.n}`}
                    />
                  )}
                  {m.gemma31 && m.qwen122 && (
                    <line
                      x1={glyphW + xFor(m.gemma31.ratio)}
                      y1={y + 6}
                      x2={glyphW + xFor(m.qwen122.ratio)}
                      y2={y + 6}
                      stroke="currentColor"
                      strokeOpacity={0.15}
                    />
                  )}
                  {!m.gemma31 && !m.qwen122 && (
                    <text
                      x={glyphW + 6}
                      y={y + 9}
                      fontSize={9.5}
                      fill="currentColor"
                      fillOpacity={0.35}
                      fontFamily="ui-monospace, monospace"
                    >
                      not tested for either target
                    </text>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setSel(m.key)}
              aria-pressed={sel === m.key}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sel === m.key
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m.name}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          <span className="text-foreground">{active.name}</span> draws on {active.uses}.{" "}
          {active.gemma31 ? (
            <>
              On gemma-4-31B-it / MATH500 its best tested setting was{" "}
              <span style={{ color: GEMMA_C }}>
                N={active.gemma31.n}: {active.gemma31.ratio.toFixed(2)}x, mean accepted length{" "}
                {active.gemma31.mal.toFixed(2)}, acceptance {active.gemma31.ar.toFixed(1)}%
              </span>
              .{" "}
            </>
          ) : null}
          {active.qwen122 ? (
            <>
              On Qwen3.5-122B-A10B / MATH500: N={active.qwen122.n},{" "}
              <span style={{ color: QWEN_C }}>
                {active.qwen122.ratio.toFixed(2)}x, MAL {active.qwen122.mal.toFixed(2)}, acceptance{" "}
                {active.qwen122.ar.toFixed(1)}%
              </span>
              .{" "}
            </>
          ) : null}
          {!active.gemma31 && !active.qwen122
            ? "Neither target model in this pair has a benchmarked checkpoint for it in the post's coverage table."
            : null}
        </p>
      </div>
    </figure>
  )
}
