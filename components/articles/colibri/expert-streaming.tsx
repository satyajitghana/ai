"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Colibri's three-tier memory, drawn as a real scene. A 744B MoE routes each token
// to only a few experts per layer. Colibri keeps the int4 dense core RESIDENT in RAM,
// holds a small LRU cache of hot experts in RAM, and leaves the other ~21,500 experts
// on disk. Route a token: experts already in RAM are a HIT (fast); the rest are a MISS —
// a disk fetch on the critical path of that token. Scrub the token, size the cache,
// toggle hot-expert pinning, and watch the LRU fill and evict. Illustrative: one MoE
// layer, a 30-expert window; the real model has 256 experts across 75 layers.

const ACCENT = "oklch(0.62 0.15 250)" // structure / router
const HIT = "oklch(0.64 0.14 158)" // served from RAM (fast)
const MISS = "oklch(0.72 0.16 55)" // disk fetch (slow, critical path)

const N = 30 // experts shown (window into 21,504)
const COLS = 10
const K = 6 // routed experts / token (shown)
const MAXT = 24 // token scrub cap
const PIN_P = 4 // hottest experts pinned when pinning is on
const MB_PER_EXPERT = 19 // int4 expert ≈ 19 MB
const NVME_GBPS = 1 // ~1 GB/s NVMe
const LAYERS = 75 // real MoE layers (for the full-token extrapolation)

// deterministic score: persistent popularity (base) + per-token wobble. No RNG.
function base(e: number) {
  return Math.cos(e * 0.55) * 0.8 + Math.sin(e * 0.17) * 0.3
}
function score(t: number, e: number) {
  return base(e) + Math.sin(e * 1.7 + t * 0.9) * 0.5
}
function routeAt(t: number) {
  return Array.from({ length: N }, (_, e) => e)
    .sort((a, b) => score(t, b) - score(t, a))
    .slice(0, K)
}
// the PIN_P persistently-hottest experts (by base popularity, token-independent)
const PINNED = Array.from({ length: N }, (_, e) => e)
  .sort((a, b) => base(b) - base(a))
  .slice(0, PIN_P)
const PINNED_SET = new Set(PINNED)

type Sim = { cache: number[]; routed: { e: number; kind: "hit" | "miss" | "pin" }[]; misses: number }

function simulate(upto: number, cacheSize: number, pinning: boolean): Sim {
  let cache: number[] = [] // MRU first
  let routed: Sim["routed"] = []
  for (let t = 0; t <= Math.min(upto, MAXT); t++) {
    const picks = routeAt(t)
    routed = []
    for (const e of picks) {
      if (pinning && PINNED_SET.has(e)) {
        routed.push({ e, kind: "pin" })
        continue
      }
      const idx = cache.indexOf(e)
      if (idx >= 0) {
        cache = [e, ...cache.slice(0, idx), ...cache.slice(idx + 1)]
        routed.push({ e, kind: "hit" })
      } else {
        cache = [e, ...cache]
        if (cache.length > cacheSize) cache = cache.slice(0, cacheSize)
        routed.push({ e, kind: "miss" })
      }
    }
  }
  const misses = routed.filter((r) => r.kind === "miss").length
  return { cache, routed, misses }
}

// scene geometry
const W = 760
const H = 366
const MX = 40
// disk grid (top)
const CW = 46
const CH = 26
const GAPX = (W - 2 * MX - COLS * CW) / (COLS - 1)
const DY = 46
const cellX = (e: number) => MX + (e % COLS) * (CW + GAPX)
const cellY = (e: number) => DY + Math.floor(e / COLS) * (CH + 12)
// router (bottom)
const RY = 314
const RX = W / 2
// cache slots (RAM band)
const SLOTY = 214
const SLOTW = 44
const SLOTH = 28

export function ExpertStreaming() {
  const [t, setT] = useState(8)
  const [cacheSize, setCacheSize] = useState(8)
  const [pinning, setPinning] = useState(false)

  const { cache, routed, misses } = simulate(t, cacheSize, pinning)
  const hits = routed.filter((r) => r.kind !== "miss").length
  const cacheSet = new Set(cache)
  const routedMap = new Map(routed.map((r) => [r.e, r.kind]))

  // latency readout — one layer, then extrapolated to the full token
  const layerMB = misses * MB_PER_EXPERT
  const layerSec = layerMB / 1024 / NVME_GBPS
  const tokenGB = (misses * MB_PER_EXPERT * LAYERS) / 1024

  // cache slot centres
  const slotCX = (i: number) => {
    const total = cacheSize
    const span = W - 2 * MX - 176 // leave room for the resident-core box on the left
    const startX = MX + 176 + 14
    const step = total > 1 ? (span - SLOTW) / (total - 1) : 0
    return startX + i * step + SLOTW / 2
  }

  const curve = (x2: number, y2: number) => {
    const my = (RY + y2) / 2
    return `M ${RX} ${RY} C ${RX} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>three-tier memory · one MoE layer, one token</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Token ${t} routes to ${K} experts in one MoE layer; ${hits} are served from the RAM cache and ${misses} are fetched from disk on the critical path`}>
          <defs>
            <marker id="cs-hit" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={HIT} strokeWidth={1.5} />
            </marker>
            <marker id="cs-miss" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MISS} strokeWidth={1.5} />
            </marker>
            <filter id="cs-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* tier labels */}
          <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>disk · 21,504 experts · ~370 GB</text>
          <text x={MX} y={192} className="fill-muted-foreground font-mono" fontSize={11}>RAM · resident int4 core + LRU expert cache</text>

          {/* connectors: router -> experts (drawn behind nodes) */}
          {routed.map((r) => {
            if (r.kind === "pin") {
              // pinned experts live in RAM; short hit-style connector to their disk cell dimmed
              return null
            }
            const x2 = cellX(r.e) + CW / 2
            const y2 = cellY(r.e) + CH
            const isMiss = r.kind === "miss"
            return (
              <path
                key={`c-${r.e}`}
                d={curve(x2, y2)}
                fill="none"
                stroke={isMiss ? MISS : HIT}
                strokeWidth={1.5}
                strokeDasharray={isMiss ? "0" : "3 3"}
                markerEnd={`url(#${isMiss ? "cs-miss" : "cs-hit"})`}
                opacity={isMiss ? 0.9 : 0.55}
              />
            )
          })}

          {/* disk grid */}
          {Array.from({ length: N }, (_, e) => {
            const kind = routedMap.get(e)
            const inCache = cacheSet.has(e)
            const isPinned = pinning && PINNED_SET.has(e)
            let fill = "var(--muted)"
            let op = 0.28
            let stroke = "transparent"
            if (kind === "miss") { fill = MISS; op = 0.9; stroke = MISS }
            else if (kind === "hit") { fill = HIT; op = 0.85; stroke = HIT }
            else if (kind === "pin") { fill = HIT; op = 0.5; stroke = HIT }
            else if (inCache) { op = 0.16 }
            return (
              <g key={e}>
                <rect x={cellX(e)} y={cellY(e)} width={CW} height={CH} rx={5} fill={fill} opacity={op} stroke={stroke} strokeWidth={1.4} filter={kind ? "url(#cs-soft)" : undefined} className="transition-all duration-300" />
                {(inCache || isPinned) && !kind && (
                  <circle cx={cellX(e) + CW - 6} cy={cellY(e) + 6} r={2.4} fill={isPinned ? ACCENT : HIT} opacity={0.8} />
                )}
              </g>
            )
          })}

          {/* RAM band: resident core box */}
          <g>
            <rect x={MX} y={SLOTY - 8} width={150} height={SLOTH + 16} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#cs-soft)" />
            <text x={MX + 75} y={SLOTY + 6} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>int4 dense core</text>
            <text x={MX + 75} y={SLOTY + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>9.9 GB · resident</text>
          </g>

          {/* LRU cache slots */}
          {Array.from({ length: cacheSize }, (_, i) => {
            const e = cache[i]
            const has = e !== undefined
            const kind = has ? routedMap.get(e) : undefined
            const cx = slotCX(i)
            let stroke = "var(--border)"
            let fill = "var(--muted)"
            let op = has ? 0.4 : 0.18
            if (kind === "hit") { fill = HIT; op = 0.85; stroke = HIT }
            else if (kind === "miss") { fill = MISS; op = 0.8; stroke = MISS }
            return (
              <g key={i}>
                <rect x={cx - SLOTW / 2} y={SLOTY} width={SLOTW} height={SLOTH} rx={5} fill={fill} opacity={op} stroke={stroke} strokeWidth={1.4} className="transition-all duration-300" />
                {has && <text x={cx} y={SLOTY + SLOTH + 11} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>e{e}</text>}
              </g>
            )
          })}

          {/* router node */}
          <g>
            <rect x={RX - 96} y={RY} width={192} height={40} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#cs-soft)" />
            <text x={RX} y={RY + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>router · token {t}</text>
            <text x={RX} y={RY + 31} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>picks top-{K} of 256 experts</text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">pin hot experts</span>
            <button type="button" onClick={() => setPinning((p) => !p)} aria-pressed={pinning}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", pinning ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {pinning ? `on · ${PIN_P} pinned` : "off"}
            </button>
          </div>
          <div className="ml-auto flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span><span style={{ color: HIT }}>{hits}</span> hit</span>
            <span><span style={{ color: MISS }}>{misses}</span> miss</span>
            <span>cache {cache.length}/{cacheSize}</span>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">token (drag)</div>
            <input type="range" min={0} max={MAXT} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.15_250)]" />
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">LRU cache size · {cacheSize} experts</div>
            <input type="range" min={4} max={14} value={cacheSize} onChange={(e) => setCacheSize(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.15_250)]" />
          </div>
        </div>

        {/* latency readout */}
        <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
          this layer, this token: <span style={{ color: MISS }}>{misses} disk fetch{misses === 1 ? "" : "es"}</span> ×19 MB ={" "}
          <span className="text-foreground">{layerMB} MB</span> → ~{layerSec.toFixed(2)} s at ~1 GB/s NVMe.{" "}
          Across all {LAYERS} layers a cold token reads <span className="text-foreground">~{tokenGB.toFixed(1)} GB</span> from disk — that read is the critical path.
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The dense core never leaves RAM; the routed experts do. A <span style={{ color: HIT }}>hit</span> is served from the
          in-RAM LRU cache (or a <span style={{ color: ACCENT }}>pinned</span> hot expert) at memory speed. A{" "}
          <span style={{ color: MISS }}>miss</span> is a disk fetch that <span className="text-foreground">blocks the token</span> until
          the ~19 MB expert arrives. Grow the cache or pin the hottest experts and misses fall — the engine literally gets faster the
          more you use it. But every uncached expert a token needs is another read the NVMe has to finish first.
        </p>
      </div>
    </figure>
  )
}
