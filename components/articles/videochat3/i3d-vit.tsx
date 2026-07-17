"use client"

import { useState } from "react"

// I3D-ViT — the "inflated" 3D tokenizer, drawn as a scene. A 2D image encoder is
// inflated into a spatiotemporal one: consecutive frames are grouped into chunks of
// T=4, self-attention runs *within* each chunk (local spatiotemporal modeling), then
// a temporal pooling (×4) plus a 2×2 spatial merge (×4) collapses each chunk to a
// single motion-aware token slot — a 16× spatiotemporal compression. Drag the frame
// count and watch the output token budget collapse while chunk structure holds.
// Illustrative token math (≈64 spatial tokens/frame); the 16× ratio is the paper's.

const ACCENT = "oklch(0.58 0.13 162)"
const T = 4 // frames per chunk
const SPF = 64 // illustrative spatial tokens per frame

const W = 760
const H = 344
const MX = 32

export function I3dVit() {
  const [frames, setFrames] = useState(16)
  const nChunks = Math.max(1, Math.round(frames / T))
  const inTok = frames * SPF
  const outTok = inTok / 16

  const lane = W - 2 * MX
  const gap = 8
  const chunkW = (lane - (nChunks - 1) * gap) / nChunks
  const chunkX = (c: number) => MX + c * (chunkW + gap)

  // stage y-bands
  const chunkTop = 46
  const chunkH = 34
  const barTop = 138
  const barH = 32
  const poolTop = 200
  const poolH = 30
  const outTop = 262
  const outH = 26

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  const poolW = 372
  const poolX = W / 2 - poolW / 2

  // output token slots — one temporal slot per chunk (4 frames → 1), so the
  // number of drawn slots equals nChunks: the temporal 4:1 collapse, made visible.
  const outW = Math.min(chunkW, 30)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>I3D-ViT · frames → chunk attention → temporal pool → 16× fewer tokens</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${frames} native-resolution frames grouped into ${nChunks} chunks of ${T}; chunk-wise spatiotemporal attention then temporal pooling and 2 by 2 spatial merge collapse ${inTok} input tokens to ${outTok} output tokens, a 16 times compression`}
        >
          <defs>
            <marker id="i3d-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="i3d-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
            input · {frames} native-res frames, chunked T={T} →
          </text>

          {/* input frame chunks */}
          {Array.from({ length: nChunks }, (_, c) => {
            const x = chunkX(c)
            const tickN = 4
            const inner = 4
            const tickW = (chunkW - (tickN + 1) * inner) / tickN
            return (
              <g key={`ch-${c}`}>
                <rect
                  x={x}
                  y={chunkTop}
                  width={chunkW}
                  height={chunkH}
                  rx={6}
                  fill="var(--muted)"
                  opacity={0.35}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
                {Array.from({ length: tickN }, (_, f) => (
                  <rect
                    key={f}
                    x={x + inner + f * (tickW + inner)}
                    y={chunkTop + 8}
                    width={Math.max(tickW, 2)}
                    height={chunkH - 16}
                    rx={2}
                    fill={ACCENT}
                    opacity={0.55}
                  />
                ))}
                {/* chunk → attention connector */}
                <path
                  d={curve(x + chunkW / 2, chunkTop + chunkH, x + chunkW / 2, barTop)}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.5}
                  opacity={0.5}
                  markerEnd="url(#i3d-arrow)"
                />
              </g>
            )
          })}

          {/* I3D-ViT attention bar */}
          <rect x={MX} y={barTop} width={lane} height={barH} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#i3d-soft)" />
          <text x={W / 2} y={barTop + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            chunk-wise spatiotemporal self-attention
          </text>

          {/* bar → pool connector */}
          <path d={curve(W / 2, barTop + barH, W / 2, poolTop)} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.6} markerEnd="url(#i3d-arrow)" />

          {/* temporal pool + spatial merge node */}
          <rect x={poolX} y={poolTop} width={poolW} height={poolH} rx={8} fill={ACCENT} opacity={0.12} stroke={ACCENT} strokeWidth={1.5} />
          <text x={W / 2} y={poolTop + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5}>
            temporal pool ×4 · spatial merge 2×2 → ÷16
          </text>

          {/* pool → output connector */}
          <path d={curve(W / 2, poolTop + poolH, W / 2, outTop)} fill="none" stroke={ACCENT} strokeWidth={1.5} opacity={0.6} markerEnd="url(#i3d-arrow)" />

          {/* output token slots — one per chunk (4:1 temporal collapse) */}
          {Array.from({ length: nChunks }, (_, c) => {
            const x = chunkX(c) + chunkW / 2 - outW / 2
            return (
              <rect
                key={`out-${c}`}
                x={x}
                y={outTop}
                width={outW}
                height={outH}
                rx={5}
                fill={ACCENT}
                opacity={0.9}
                filter="url(#i3d-soft)"
                className="transition-all duration-300"
              />
            )
          })}
          <text x={MX} y={outTop + outH + 16} className="fill-muted-foreground font-mono" fontSize={10}>
            output · {nChunks} motion-aware slots · ÷16 tokens
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>input frames (drag)</span>
            <span>
              in <span style={{ color: ACCENT }}>{inTok.toLocaleString()}</span> → out{" "}
              <span style={{ color: ACCENT }}>{outTok.toLocaleString()}</span> tokens · {nChunks} chunks
            </span>
          </div>
          <input
            type="range"
            min={8}
            max={64}
            step={4}
            value={frames}
            onChange={(e) => setFrames(Number(e.target.value))}
            className="w-full cursor-pointer accent-[oklch(0.58_0.13_162)]"
          />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The tokenizer never sees frames one at a time. It groups {T} consecutive frames into a{" "}
          <span className="text-foreground">chunk</span>, runs self-attention inside the chunk so motion is modelled
          locally, then pools the chunk down to a single temporal slot — {SPF} spatial tokens per frame become{" "}
          <span style={{ color: ACCENT }}>{SPF / 16} per frame</span> after the 2×2 merge and ×4 temporal pool. A{" "}
          <span className="text-foreground">16× spatiotemporal compression</span>, and the token budget grows with the
          frame count instead of exploding with it.
        </p>
      </div>
    </figure>
  )
}
