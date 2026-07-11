"use client"

import { useState } from "react"

// The two numbers you must quote together. "Runs on 25 GB of RAM" is true — but only
// because ~370 GB of experts live on fast disk. Left: the RAM budget, to scale within
// 25 GB (9.9 GB resident int4 core + an auto-sized LRU expert cache + a safety headroom
// the engine keeps from MemAvailable so it never OOM-kills). Right: the 370 GB of experts
// on disk, drawn as 25-GB blocks so the ~15× gap is visible. Slide the cache size.

const CORE = "oklch(0.62 0.15 250)" // resident dense core
const CACHE = "oklch(0.64 0.14 158)" // LRU expert cache
const SAFE = "oklch(0.72 0.16 55)" // safety headroom
const DISK = "oklch(0.55 0.02 260)"

const RAM_TOTAL = 25 // GB budget shown
const CORE_GB = 9.9
const DISK_GB = 370

const W = 760
const H = 250
const MX = 36
const BARX = 150
const BARW = W - BARX - MX
const RAMY = 54
const DISKY = 150
const BARH = 40
const gbToPx = BARW / RAM_TOTAL

export function MemoryBudget() {
  const [cacheGB, setCacheGB] = useState(6)
  const safeGB = Math.max(RAM_TOTAL - CORE_GB - cacheGB, 0)
  const residentGB = CORE_GB + cacheGB

  const seg = (gb: number, fromGB: number) => ({ x: BARX + fromGB * gbToPx, w: gb * gbToPx })
  const s1 = seg(CORE_GB, 0)
  const s2 = seg(cacheGB, CORE_GB)
  const s3 = seg(safeGB, CORE_GB + cacheGB)

  // disk drawn as 25-GB blocks so the scale gap reads visually
  const blocks = Math.round(DISK_GB / RAM_TOTAL) // ~15
  const blockGap = 3
  const blockW = (BARW - (blocks - 1) * blockGap) / blocks

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the two numbers, together · RAM vs disk</span>
        <span className="text-muted-foreground/50">to scale</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`RAM budget of 25 GB holds a 9.9 GB resident core, a ${cacheGB} GB expert cache and ${safeGB.toFixed(1)} GB safety headroom, while 370 GB of experts stay on disk`}>
          <defs>
            <filter id="mb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.12" />
            </filter>
          </defs>

          {/* RAM bar */}
          <text x={MX} y={RAMY - 12} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>RAM · ~25 GB</text>
          <rect x={BARX} y={RAMY} width={BARW} height={BARH} rx={7} fill="var(--muted)" opacity={0.25} stroke="var(--border)" strokeWidth={1} />
          <rect x={s1.x} y={RAMY} width={s1.w} height={BARH} rx={0} fill={CORE} opacity={0.9} filter="url(#mb-soft)" />
          <rect x={s2.x} y={RAMY} width={s2.w} height={BARH} fill={CACHE} opacity={0.85} className="transition-all duration-200" />
          <rect x={s3.x} y={RAMY} width={s3.w} height={BARH} fill={SAFE} opacity={0.4} className="transition-all duration-200" />
          {/* segment labels */}
          <text x={s1.x + s1.w / 2} y={RAMY + BARH / 2 + 4} textAnchor="middle" className="fill-background font-mono" fontSize={9} fontWeight={600}>9.9</text>
          {cacheGB >= 3 && <text x={s2.x + s2.w / 2} y={RAMY + BARH / 2 + 4} textAnchor="middle" className="fill-background font-mono" fontSize={9} fontWeight={600}>{cacheGB}</text>}
          {safeGB >= 3 && <text x={s3.x + s3.w / 2} y={RAMY + BARH / 2 + 4} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{safeGB.toFixed(0)}</text>}

          {/* RAM legend */}
          <g fontSize={9} className="font-mono">
            <rect x={BARX} y={RAMY + BARH + 12} width={9} height={9} rx={2} fill={CORE} opacity={0.9} />
            <text x={BARX + 14} y={RAMY + BARH + 20} className="fill-muted-foreground">int4 dense core (resident)</text>
            <rect x={BARX + 172} y={RAMY + BARH + 12} width={9} height={9} rx={2} fill={CACHE} opacity={0.85} />
            <text x={BARX + 186} y={RAMY + BARH + 20} className="fill-muted-foreground">LRU expert cache</text>
            <rect x={BARX + 316} y={RAMY + BARH + 12} width={9} height={9} rx={2} fill={SAFE} opacity={0.4} />
            <text x={BARX + 330} y={RAMY + BARH + 20} className="fill-muted-foreground">safety headroom</text>
          </g>

          {/* DISK bar */}
          <text x={MX} y={DISKY - 12} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>disk · ~370 GB</text>
          {Array.from({ length: blocks }, (_, i) => (
            <rect key={i} x={BARX + i * (blockW + blockGap)} y={DISKY} width={blockW} height={BARH} rx={3} fill={DISK} opacity={0.55} />
          ))}
          <text x={BARX + BARW / 2} y={DISKY + BARH + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>21,504 int4 experts · ~19 MB each · each block ≈ 25 GB (one RAM)</text>
        </svg>

        <div className="mt-2">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">LRU expert cache · {cacheGB} GB</div>
          <input type="range" min={2} max={13} value={cacheGB} onChange={(e) => setCacheGB(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.64_0.14_158)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Resident footprint here is <span className="text-foreground">{residentGB.toFixed(1)} GB</span> of the ~25 GB budget; the
          engine auto-sizes the cache from free memory and keeps <span style={{ color: SAFE }}>{safeGB.toFixed(1)} GB</span> in
          reserve so it never OOM-kills. But the model is <span className="text-foreground">~15× larger than the RAM</span> — those
          370 GB have to sit on fast NVMe. Quote &ldquo;25 GB of RAM&rdquo; without &ldquo;plus 370 GB of disk&rdquo; and you have
          only half the picture.
        </p>
      </div>
    </figure>
  )
}
