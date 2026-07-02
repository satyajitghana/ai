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

export function KvMemory() {
  const [ctxK, setCtxK] = useState(128)

  const fp16GB = (ctxK * 1000 * MB_PER_TOKEN) / 1000
  const tqGB = fp16GB / COMPRESS
  const fp16MaxK = Math.round((BUDGET_GB * 1000) / MB_PER_TOKEN / 1000)
  const tqMaxK = Math.round(fp16MaxK * COMPRESS)

  const W = 600
  const H = 220
  const padL = 46
  const padR = 16
  const padT = 14
  const padB = 34
  const MAXK = 512
  const maxGB = (MAXK * 1000 * MB_PER_TOKEN) / 1000
  const sx = (k: number) => padL + (k / MAXK) * (W - padL - padR)
  const sy = (gb: number) => padT + (1 - Math.min(gb, maxGB) / maxGB) * (H - padT - padB)

  const line = (comp: number) => `${sx(0)},${sy(0)} ${sx(MAXK)},${sy(maxGB / comp)}`

  const FP = "oklch(0.7 0.04 40)"
  const TQ = "oklch(0.72 0.15 195)"

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">KV cache size vs context length · fp16 vs TurboQuant</div>
      <div className="p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="KV cache memory grows linearly with context; TurboQuant's line is 4.4x shallower than fp16.">
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          <line x1={padL} y1={padT} x2={padL} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" />
          {[0, 128, 256, 384, 512].map((k) => (
            <text key={k} x={sx(k)} y={H - padB + 14} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">{k}K</text>
          ))}
          <text x={12} y={H / 2} textAnchor="middle" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.45" transform={`rotate(-90 12 ${H / 2})`}>KV cache (GB)</text>
          {/* budget line */}
          <line x1={padL} y1={sy(BUDGET_GB)} x2={W - padR} y2={sy(BUDGET_GB)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="2 4" />
          <text x={W - padR} y={sy(BUDGET_GB) - 4} textAnchor="end" fontFamily="monospace" fontSize="9" fill="currentColor" fillOpacity="0.5">{BUDGET_GB} GB budget</text>

          <polyline points={line(1)} fill="none" stroke={FP} strokeWidth="2" />
          <polyline points={line(COMPRESS)} fill="none" stroke={TQ} strokeWidth="2.5" />
          <text x={sx(430)} y={sy(maxGB * 430 / MAXK) - 6} textAnchor="end" fontFamily="monospace" fontSize="9.5" fill={FP}>fp16</text>
          <text x={sx(470)} y={sy((maxGB / COMPRESS) * 470 / MAXK) - 6} textAnchor="end" fontFamily="monospace" fontSize="9.5" fill={TQ}>TurboQuant</text>

          {/* cursor */}
          <line x1={sx(ctxK)} y1={padT} x2={sx(ctxK)} y2={H - padB} stroke="currentColor" strokeOpacity="0.2" strokeDasharray="3 3" />
          <circle cx={sx(ctxK)} cy={sy(fp16GB)} r="4" fill={FP} />
          <circle cx={sx(ctxK)} cy={sy(tqGB)} r="4" fill={TQ} />
        </svg>

        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>context length</span>
            <span className="tabular-nums text-foreground">{ctxK}K tokens</span>
          </div>
          <input type="range" min={8} max={MAXK} step={8} value={ctxK} onChange={(e) => setCtxK(+e.target.value)} className="w-full accent-foreground" aria-label="context length" />
        </div>

        <div className="mt-3 grid grid-cols-3 gap-px overflow-hidden rounded-md border bg-border font-mono text-xs">
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">fp16 cache</div>
            <div className="font-medium" style={{ color: FP }}>{fp16GB.toFixed(1)} GB</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">TurboQuant cache</div>
            <div className="font-medium" style={{ color: TQ }}>{tqGB.toFixed(1)} GB</div>
          </div>
          <div className="bg-background px-3 py-2">
            <div className="text-[10px] text-muted-foreground">max context @ {BUDGET_GB}GB</div>
            <div className="font-medium text-foreground">{fp16MaxK}K → {tqMaxK}K</div>
          </div>
        </div>

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
