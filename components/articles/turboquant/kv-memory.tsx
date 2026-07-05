"use client"

import { useState } from "react"

// The payoff, in GB. The KV cache grows linearly with context length; at long context
// it's the thing that caps how many requests fit on a GPU. TurboQuant compresses the
// full-attention KV cache ~4.4× (keys to 3 bits, values to 2–4), so the same memory
// holds a much longer context — or the same context leaves room for more. Drag the
// context length and read the cache size for fp16 vs TurboQuant, plus how much longer
// you can go inside a fixed budget. Illustrative on a 27B-class model (~0.25 MB/token).

const MB_PER_TOKEN = 0.25 // fp16 KV, ~64 layers × 8 KV heads × 128 dim × 2 (k,v) × 2 bytes
const COMPRESS = 4.41 // repo-measured compression on full-attention layers
const BUDGET_GB = 40 // a fixed VRAM slice for KV cache

const FP = "oklch(0.68 0.04 40)"
const TQ = "oklch(0.72 0.15 195)"

const W = 640
const H = 250
const PL = 48
const PR = 18
const PT = 16
const PB = 34
const MAXK = 512
const maxGB = (MAXK * 1000 * MB_PER_TOKEN) / 1000

const sx = (k: number) => PL + (k / MAXK) * (W - PL - PR)
const sy = (gb: number) => PT + (1 - Math.min(gb, maxGB) / maxGB) * (H - PT - PB)

export function KvMemory() {
  const [ctxK, setCtxK] = useState(128)

  const fp16GB = (ctxK * 1000 * MB_PER_TOKEN) / 1000
  const tqGB = fp16GB / COMPRESS
  const fp16MaxK = Math.round((BUDGET_GB * 1000) / MB_PER_TOKEN / 1000)
  const tqMaxK = Math.round(fp16MaxK * COMPRESS)

  const fpEnd = maxGB
  const tqEnd = maxGB / COMPRESS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">KV cache size vs context length · fp16 vs TurboQuant</div>

      <div className="p-4 sm:p-5">
        {/* readout */}
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">context length</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{ctxK}<span className="text-base text-muted-foreground">K tok</span></div>
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <div className="font-mono text-[10px]" style={{ color: FP }}>fp16 cache</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: FP }}>{fp16GB.toFixed(1)}<span className="text-xs text-muted-foreground"> GB</span></div>
            </div>
            <div>
              <div className="font-mono text-[10px]" style={{ color: TQ }}>TurboQuant</div>
              <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: TQ }}>{tqGB.toFixed(1)}<span className="text-xs text-muted-foreground"> GB</span></div>
            </div>
            <div>
              <div className="font-mono text-[10px] text-muted-foreground">max @ {BUDGET_GB}GB</div>
              <div className="font-mono text-xl font-semibold tabular-nums text-foreground">{fp16MaxK}K→{tqMaxK}K</div>
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`KV cache memory grows linearly with context; TurboQuant's line is ${COMPRESS}x shallower than fp16. At ${ctxK}K tokens, fp16 needs ${fp16GB.toFixed(1)} GB versus ${tqGB.toFixed(1)} GB.`}>
          {/* horizontal gridlines + GB labels */}
          {[0, 0.25, 0.5, 0.75, 1].map((g) => (
            <g key={g}>
              <line x1={PL} x2={W - PR} y1={sy(g * maxGB)} y2={sy(g * maxGB)} stroke="currentColor" className="text-border" strokeWidth={1} />
              <text x={PL - 7} y={sy(g * maxGB) + 3} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{Math.round(g * maxGB)}</text>
            </g>
          ))}
          <text x={12} y={H / 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9} transform={`rotate(-90 12 ${H / 2})`}>KV cache (GB)</text>
          {/* x ticks */}
          {[0, 128, 256, 384, 512].map((k) => (
            <text key={k} x={sx(k)} y={H - PB + 15} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{k}K</text>
          ))}
          <text x={(PL + W - PR) / 2} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>context length →</text>

          {/* the memory saved by TurboQuant (between the two lines) */}
          <path d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(fpEnd)} L ${sx(MAXK)} ${sy(tqEnd)} Z`} fill={TQ} opacity={0.08} />

          {/* budget line */}
          <line x1={PL} y1={sy(BUDGET_GB)} x2={W - PR} y2={sy(BUDGET_GB)} stroke="currentColor" className="text-muted-foreground" strokeOpacity={0.4} strokeDasharray="2 4" strokeWidth={1} />
          <text x={W - PR} y={sy(BUDGET_GB) - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>{BUDGET_GB} GB budget</text>

          {/* the two curves */}
          <path d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(fpEnd)}`} fill="none" stroke={FP} strokeWidth={2} strokeLinecap="round" />
          <path d={`M ${sx(0)} ${sy(0)} L ${sx(MAXK)} ${sy(tqEnd)}`} fill="none" stroke={TQ} strokeWidth={2.5} strokeLinecap="round" />
          <text x={sx(430)} y={sy(fpEnd * 430 / MAXK) - 6} textAnchor="end" className="font-mono" fontSize={9.5} fill={FP}>fp16</text>
          <text x={sx(470)} y={sy(tqEnd * 470 / MAXK) - 6} textAnchor="end" className="font-mono" fontSize={9.5} fill={TQ}>TurboQuant</text>

          {/* cursor */}
          <line x1={sx(ctxK)} y1={PT} x2={sx(ctxK)} y2={H - PB} stroke="currentColor" className="text-foreground/25" strokeDasharray="3 3" strokeWidth={1} />
          <circle cx={sx(ctxK)} cy={sy(fp16GB)} r={4} fill={FP} stroke="var(--background)" strokeWidth={1.5} />
          <circle cx={sx(ctxK)} cy={sy(tqGB)} r={4} fill={TQ} stroke="var(--background)" strokeWidth={1.5} />
        </svg>

        <label className="mt-2 block">
          <span className="sr-only">context length</span>
          <input type="range" min={8} max={MAXK} step={8} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full cursor-pointer accent-[oklch(0.72_0.15_195)]" aria-label="context length" />
        </label>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Both grow linearly, but TurboQuant's slope is <span className="text-foreground">~4.4× shallower</span>.
          In a fixed {BUDGET_GB} GB slice, fp16 tops out near <span className="text-foreground">{fp16MaxK}K</span> tokens;
          the compressed cache reaches <span className="text-foreground">{tqMaxK}K</span> — the same GPU, a much longer
          context. (In practice the repo reports ~1.45–2.0× usable, since prefill still allocates a full cache and only
          full-attention layers compress.)
        </p>
      </div>
    </figure>
  )
}
