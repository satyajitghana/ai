"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// The architecture, animated — the "two towers" made literal, now as a composed SVG scene.
// A single diffusion LM has to be two things at once: a causal reader of clean context AND a
// bidirectional denoiser of the noisy block — conflicting jobs. TwoTower splits them into two
// stacks of layers. The LEFT tower is the FROZEN pretrained autoregressive model: it reads the
// clean context and never gets a gradient. The RIGHT tower is the TRAINABLE denoiser: it refines
// the current block bidirectionally. The load-bearing detail is LAYER-ALIGNED cross-attention —
// denoiser layer i reads context layer i, drawn as a curved connector between aligned layers — so
// as a forward pass sweeps up the towers, each aligned arrow lights and the masked block resolves
// in parallel. When the block is done it commits into the context tower and the next block begins.

const LAYERS = 5 // representative; the real model is 52 layers
const FINAL = ["the", "warm", "mat", "."]
const REVEAL = [1, 3, 0, 2] // parallel, non-causal denoise order
const CONTEXT = ["The", "cat", "sat", "on"]

const FROZEN = "oklch(0.62 0.13 230)"
const TRAIN = "oklch(0.72 0.15 150)"

// scene geometry (viewBox units)
const W = 760
const H = 448
const NODE_W = 132
const NODE_H = 32
const PITCH = 45
const TOP_Y = 46
const LX = 158 // frozen tower center x
const RX = 602 // denoiser tower center x
const rowY = (r: number) => TOP_Y + r * PITCH // r = 0 top (L5) … 4 bottom (L1)
const BASE_Y = 344
const BASE_H = 62

export function TwoTower() {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(true)

  const CYCLE = LAYERS + 3
  const step = t % CYCLE
  const block = 2 + Math.floor(t / CYCLE)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setT((x) => (x + 1) % (CYCLE * 1000)), 720)
    return () => clearInterval(id)
  }, [playing, CYCLE])

  const active = Math.min(step, LAYERS - 1) // active layer index, 0 = bottom
  const reached = step >= LAYERS - 1
  const resolvedCount = reached ? Math.min(step - (LAYERS - 2), FINAL.length) : 0
  const isResolved = (i: number) => REVEAL.indexOf(i) < resolvedCount

  // rows top→bottom: r=0 renders L5, r=4 renders L1
  const rows = Array.from({ length: LAYERS }, (_, r) => r)

  // vertical S-curve (residual stream up a tower)
  const vCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }
  // horizontal arched connector (layer-aligned cross-attention)
  const hCurve = (x1: number, y: number, x2: number) => {
    const mx = (x1 + x2) / 2
    const bow = 15
    return `M ${x1} ${y} C ${mx} ${y - bow}, ${mx} ${y - bow}, ${x2} ${y}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>TwoTower · a forward pass sweeps up · layer-aligned cross-attention</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Two towers of ${LAYERS} layers: a frozen autoregressive context tower on the left and a trainable denoiser tower on the right, joined by layer-aligned cross-attention. A forward pass sweeps up both and block ${block} resolves in parallel.`}>
          <defs>
            <marker id="tt-arr-t" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={TRAIN} strokeWidth={1.5} />
            </marker>
            <marker id="tt-arr-f" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={FROZEN} strokeWidth={1.5} />
            </marker>
            <filter id="tt-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* tower headers */}
          <g className="font-mono">
            <SnowflakeGlyph x={LX - 58} y={26} color={FROZEN} />
            <text x={LX - 44} y={30} fontSize={11} fill={FROZEN}>frozen AR context tower</text>
            <circle cx={RX - 60} cy={26} r={3.5} fill={TRAIN} />
            <text x={RX - 50} y={30} fontSize={11} fill={TRAIN}>trainable denoiser tower</text>
          </g>

          {/* within-tower residual connectors (drawn behind nodes) */}
          {[1, 2, 3, 4].map((L) => {
            const r = LAYERS - L // row of layer L
            const yBottom = rowY(r) // top of layer L
            const yTop = rowY(r - 1) + NODE_H // bottom of layer L+1
            const lit = active >= L
            return (
              <g key={`v${L}`}>
                <path d={vCurve(LX, yBottom, LX, yTop)} fill="none" stroke={lit ? FROZEN : "var(--border)"} strokeWidth={1.5} opacity={lit ? 0.9 : 0.5} markerEnd={lit ? "url(#tt-arr-f)" : undefined} className="transition-all duration-300" />
                <path d={vCurve(RX, yBottom, RX, yTop)} fill="none" stroke={lit ? TRAIN : "var(--border)"} strokeWidth={1.5} opacity={lit ? 0.9 : 0.5} markerEnd={lit ? "url(#tt-arr-t)" : undefined} className="transition-all duration-300" />
              </g>
            )
          })}

          {/* layer-aligned cross-attention connectors: frozen layer i → denoiser layer i */}
          {rows.map((r) => {
            const L = LAYERS - r
            const yc = rowY(r) + NODE_H / 2
            const a = L - 1
            const lit = reached || a < active
            return (
              <path
                key={`x${r}`}
                d={hCurve(LX + NODE_W / 2, yc, RX - NODE_W / 2)}
                fill="none"
                stroke={lit ? TRAIN : "var(--border)"}
                strokeWidth={1.5}
                strokeDasharray={lit ? undefined : "3 3"}
                opacity={lit ? 0.9 : 0.5}
                markerEnd={lit ? "url(#tt-arr-t)" : undefined}
                className="transition-all duration-300"
              />
            )
          })}

          {/* the two towers of layers */}
          {rows.map((r) => {
            const L = LAYERS - r
            const a = L - 1
            const y = rowY(r)
            const on = a <= active
            const isActive = a === active
            const armed = reached || a < active
            return (
              <g key={`row${r}`}>
                {/* frozen (context) layer */}
                <rect x={LX - NODE_W / 2} y={y} width={NODE_W} height={NODE_H} rx={8} fill={on ? FROZEN : "var(--background)"} opacity={on ? 0.92 : 1} stroke={FROZEN} strokeWidth={isActive ? 2.5 : 1.5} filter={on ? "url(#tt-soft)" : undefined} className="transition-all duration-300" />
                <text x={LX} y={y + 20} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={on ? "var(--background)" : FROZEN}>context L{L}</text>

                {/* denoiser (trainable) layer */}
                <rect x={RX - NODE_W / 2} y={y} width={NODE_W} height={NODE_H} rx={8} fill={armed ? TRAIN : "var(--background)"} opacity={armed ? 0.92 : 1} stroke={TRAIN} strokeWidth={isActive ? 2.5 : 1.5} filter={armed ? "url(#tt-soft)" : undefined} className="transition-all duration-300" />
                <text x={RX} y={y + 20} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={armed ? "var(--background)" : TRAIN}>denoise L{L}</text>
              </g>
            )
          })}

          {/* feed connectors: base → bottom layer (L1) */}
          <path d={vCurve(LX, BASE_Y, LX, rowY(LAYERS - 1) + NODE_H)} fill="none" stroke={FROZEN} strokeWidth={1.5} opacity={0.7} markerEnd="url(#tt-arr-f)" />
          <path d={vCurve(RX, BASE_Y, RX, rowY(LAYERS - 1) + NODE_H)} fill="none" stroke={TRAIN} strokeWidth={1.5} opacity={0.7} markerEnd="url(#tt-arr-t)" />

          {/* bases: clean committed context (left) vs the noisy block being denoised (right) */}
          <g>
            <rect x={LX - 128} y={BASE_Y} width={256} height={BASE_H} rx={9} fill="var(--muted)" opacity={0.25} stroke={FROZEN} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} />
            {CONTEXT.map((w, i) => {
              const cw = 54
              const gap = 6
              const totalW = CONTEXT.length * cw + (CONTEXT.length - 1) * gap
              const x0 = LX - totalW / 2 + i * (cw + gap)
              return (
                <g key={i}>
                  <rect x={x0} y={BASE_Y + 10} width={cw} height={22} rx={5} fill={FROZEN} opacity={0.92} />
                  <text x={x0 + cw / 2} y={BASE_Y + 25} textAnchor="middle" className="font-mono" fontSize={10} fill="var(--background)">{w}</text>
                </g>
              )
            })}
            <text x={LX} y={BASE_Y + BASE_H - 6} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">clean context · committed blocks · KV + Mamba state</text>
          </g>

          <g>
            <rect x={RX - 128} y={BASE_Y} width={256} height={BASE_H} rx={9} fill="var(--muted)" opacity={0.25} stroke={TRAIN} strokeWidth={1} strokeDasharray="4 3" strokeOpacity={0.5} />
            {FINAL.map((w, i) => {
              const r = isResolved(i)
              const cw = 54
              const gap = 6
              const totalW = FINAL.length * cw + (FINAL.length - 1) * gap
              const x0 = RX - totalW / 2 + i * (cw + gap)
              return (
                <g key={i}>
                  <rect x={x0} y={BASE_Y + 10} width={cw} height={22} rx={5} fill={r ? TRAIN : "transparent"} opacity={r ? 0.92 : 1} stroke={r ? "none" : TRAIN} strokeWidth={1.2} strokeDasharray={r ? undefined : "3 2"} className="transition-all duration-300" />
                  <text x={x0 + cw / 2} y={BASE_Y + 25} textAnchor="middle" className="font-mono" fontSize={10} fill={r ? "var(--background)" : TRAIN}>{r ? w : "▩"}</text>
                </g>
              )
            })}
            <text x={RX} y={BASE_Y + BASE_H - 6} textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)">block {block} · denoised in parallel · bidirectional</text>
          </g>
        </svg>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Two stacks of layers, two jobs. A forward pass sweeps up both towers; at each level the
          denoiser layer <span style={{ color: TRAIN }}>cross-attends</span> to the{" "}
          <span style={{ color: FROZEN }}>aligned frozen layer</span> for what&apos;s already decided, and
          the masked block resolves in parallel rather than left-to-right. When the block is done it
          commits into the context tower and the next block begins — <em>autoregressive across blocks,
          diffusion within one</em>. The frozen tower keeps the pretrained model&apos;s causal reading
          intact; the denoiser specializes in refinement. Neither role compromises the other — which a
          single shared network can&apos;t avoid.
        </p>
      </div>
    </figure>
  )
}

// tiny snowflake glyph so the SVG header needs no HTML overlay
function SnowflakeGlyph({ x, y, color }: { x: number; y: number; color: string }) {
  return (
    <g stroke={color} strokeWidth={1.2} strokeLinecap="round" transform={`translate(${x} ${y - 4})`}>
      <line x1={0} y1={-4} x2={0} y2={4} />
      <line x1={-3.5} y1={-2} x2={3.5} y2={2} />
      <line x1={-3.5} y1={2} x2={3.5} y2={-2} />
    </g>
  )
}
