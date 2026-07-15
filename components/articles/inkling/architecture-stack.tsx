"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Inkling's backbone in one scene: a 66-layer stack whose attention alternates
// sliding-window and global layers at a 5:1 ratio (8 KV heads), and, inside every
// layer, a sparse MoE feed-forward that routes each token to 6 of 256 experts plus
// 2 shared experts that are always on. Scrub the layer to see its attention type;
// the router fans curved arrows to exactly the experts that fire for it. Which 6
// light up is illustrative; the counts (66 layers, 5:1, 256+2, 6 active) are real.

const INK = "oklch(0.58 0.16 285)"
const GLOB = "oklch(0.70 0.13 55)"
const SHARE = "oklch(0.64 0.13 190)"

const NLAYERS = 66
const isGlobal = (i: number) => i % 6 === 5 // 5 sliding-window : 1 global

const W = 760
const H = 430
const MX = 42

// layer strip
const SY = 66
const SH = 22
const cellW = (W - 2 * MX) / NLAYERS

// expert grid (32 cells shown, standing in for 256)
const COLS = 8
const ROWS = 4
const GX0 = 412
const GY0 = 150
const EW = 30
const EH = 26
const STEPX = 38
const STEPY = 34
const gx = (c: number) => GX0 + c * STEPX
const gy = (r: number) => GY0 + r * STEPY

// router node
const RX = 352
const RY = 214
const RW = 96
const RH = 40

function activeExperts(layer: number) {
  const s = new Set<number>()
  let k = 0
  while (s.size < 6 && k < 40) {
    s.add((((layer * 7 + k * 11) % 32) + 32) % 32)
    k++
  }
  return s
}

const curve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

type Focus = "attention" | "experts"

export function ArchitectureStack() {
  const [layer, setLayer] = useState(17)
  const [focus, setFocus] = useState<Focus>("experts")

  const glob = isGlobal(layer)
  const active = activeExperts(layer)
  const attDim = focus === "experts" ? 0.5 : 1
  const expDim = focus === "attention" ? 0.42 : 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>architecture · 66 layers · MoE + hybrid attention</span>
        <span className="text-muted-foreground/60">counts real · routing illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Layer ${layer + 1} of 66 uses ${glob ? "global" : "sliding-window"} attention; its router sends the token to 6 of 256 experts plus 2 shared experts`}>
          <defs>
            <marker id="ink-arch-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={INK} strokeWidth={1.5} />
            </marker>
            <marker id="ink-arch-shared" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SHARE} strokeWidth={1.5} />
            </marker>
            <filter id="ink-arch-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- layer strip (attention pattern) ---- */}
          <text x={MX} y={SY - 12} className="fill-muted-foreground font-mono" fontSize={11}>attention per layer · sliding-window : global = 5 : 1 →</text>
          {Array.from({ length: NLAYERS }, (_, i) => {
            const g = isGlobal(i)
            const sel = i === layer
            return (
              <rect
                key={i}
                x={MX + i * cellW + 0.6}
                y={SY}
                width={cellW - 1.2}
                height={SH}
                rx={2}
                fill={g ? GLOB : INK}
                opacity={sel ? 1 : g ? 0.55 : 0.28}
                stroke={sel ? "var(--foreground)" : "transparent"}
                strokeWidth={sel ? 1.5 : 0}
              />
            )
          })}
          {/* legend */}
          <g transform={`translate(${MX}, ${SY + SH + 16})`}>
            <rect x={0} y={-9} width={11} height={11} rx={2} fill={INK} opacity={0.75} />
            <text x={16} y={0} className="fill-muted-foreground font-mono" fontSize={10}>sliding-window</text>
            <rect x={118} y={-9} width={11} height={11} rx={2} fill={GLOB} opacity={0.85} />
            <text x={134} y={0} className="fill-muted-foreground font-mono" fontSize={10}>global (1 of every 6)</text>
            <text x={W - 2 * MX} y={0} textAnchor="end" className="fill-foreground font-mono" fontSize={10}>layer {layer + 1}/66 · {glob ? "global" : "sliding-window"} · 8 KV heads</text>
          </g>

          {/* ---- selected-layer detail: attention block -> router -> experts ---- */}
          <g opacity={attDim} className="transition-opacity duration-300">
            <rect x={54} y={192} width={170} height={64} rx={10} fill="var(--background)" stroke={glob ? GLOB : INK} strokeWidth={1.5} filter="url(#ink-arch-soft)" />
            <text x={139} y={216} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>{glob ? "global attention" : "sliding-window attn"}</text>
            <text x={139} y={232} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>rel. pos. emb · 8 KV heads</text>
            <text x={139} y={246} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>short conv after K/V</text>
            {/* attention -> router */}
            <path d={curve(224, 224, RX, RY + RH / 2)} fill="none" stroke={INK} strokeWidth={1.5} markerEnd="url(#ink-arch-arrow)" opacity={0.8} />
          </g>

          {/* router */}
          <g className="transition-opacity duration-300">
            <rect x={RX} y={RY} width={RW} height={RH} rx={9} fill="var(--background)" stroke={INK} strokeWidth={1.5} filter="url(#ink-arch-soft)" />
            <text x={RX + RW / 2} y={RY + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>router</text>
            <text x={RX + RW / 2} y={RY + 30} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>sigmoid · top-6</text>
          </g>

          {/* ---- expert grid ---- */}
          <g opacity={expDim} className="transition-opacity duration-300">
            <text x={GX0} y={GY0 - 12} className="fill-muted-foreground font-mono" fontSize={11}>256 routed experts (32 shown) · 6 active →</text>
            {Array.from({ length: COLS * ROWS }, (_, idx) => {
              const c = idx % COLS
              const r = Math.floor(idx / COLS)
              const on = active.has(idx)
              return (
                <rect
                  key={idx}
                  x={gx(c)}
                  y={gy(r)}
                  width={EW}
                  height={EH}
                  rx={5}
                  fill={on ? INK : "var(--muted)"}
                  opacity={on ? 0.92 : 0.3}
                  stroke={on ? INK : "transparent"}
                  strokeWidth={1.5}
                  filter={on ? "url(#ink-arch-soft)" : undefined}
                  className="transition-all duration-300"
                />
              )
            })}
            {/* router -> active experts */}
            {[...active].map((idx) => {
              const c = idx % COLS
              const r = Math.floor(idx / COLS)
              return (
                <path
                  key={idx}
                  d={curve(RX + RW, RY + RH / 2, gx(c), gy(r) + EH / 2)}
                  fill="none"
                  stroke={INK}
                  strokeWidth={1.5}
                  markerEnd="url(#ink-arch-arrow)"
                  opacity={0.6}
                />
              )
            })}

            {/* shared experts */}
            <text x={GX0} y={GY0 + ROWS * STEPY + 6} className="fill-muted-foreground font-mono" fontSize={10}>2 shared experts · always on</text>
            {[0, 1].map((i) => (
              <g key={i}>
                <rect x={GX0 + i * STEPX} y={GY0 + ROWS * STEPY + 14} width={EW} height={EH} rx={5} fill={SHARE} opacity={0.9} stroke={SHARE} strokeWidth={1.5} filter="url(#ink-arch-soft)" />
                <path d={curve(RX + RW, RY + RH / 2, GX0 + i * STEPX, GY0 + ROWS * STEPY + 14 + EH / 2)} fill="none" stroke={SHARE} strokeWidth={1.5} markerEnd="url(#ink-arch-shared)" opacity={0.55} />
              </g>
            ))}
          </g>

          <text x={MX} y={H - 10} className="fill-muted-foreground font-mono" fontSize={10}>975B total · 41B active/token · auxiliary-loss-free load balancing</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">focus</span>
            {(["attention", "experts"] as Focus[]).map((f) => (
              <button key={f} type="button" onClick={() => setFocus(f)} aria-pressed={focus === f}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", focus === f ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {f}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            layer <span style={{ color: glob ? GLOB : INK }}>{layer + 1}</span> · {glob ? "global" : "sliding-window"}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">layer index (drag)</div>
          <input type="range" min={0} max={NLAYERS - 1} value={layer} onChange={(e) => setLayer(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_285)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Two sparsities stack. Down the depth, five <span style={{ color: INK }}>sliding-window</span> layers (cheap,
          local) pass for every one <span style={{ color: GLOB }}>global</span> layer (exact, full-range) — a 5:1
          hybrid that keeps 1M-token attention affordable, the same
          local/global idea as <a className="underline decoration-foreground/30 underline-offset-4" href="/articles/minimax-sparse-attention">MiniMax MSA</a> and{" "}
          <a className="underline decoration-foreground/30 underline-offset-4" href="/articles/mimo-v2-flash">MiMo-V2-Flash</a>. Inside each
          layer, the <a className="underline decoration-foreground/30 underline-offset-4" href="/articles/mixture-of-experts-from-scratch">mixture-of-experts</a> FFN
          routes the token to just 6 of 256 experts, with 2{" "}
          <span style={{ color: SHARE }}>shared</span> experts always on — so only 41B of 975B parameters do work per
          token.
        </p>
      </div>
    </figure>
  )
}
