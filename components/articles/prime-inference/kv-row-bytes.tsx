"use client"

// One MLA cache row in FP8 and in NVFP4, byte by byte, and what that does to a
// long agent session.
//
// Row layouts, from Prime Intellect's post ("Prime Inference", 2 Oct 2026):
//   FP8    512-value latent at 1 byte + 64-value rope part at 1 byte = 576 B
//   NVFP4  512 values at 4 bits = 256 B, one FP8 scale per 16 values = 32 B,
//          rope part kept in FP8 = 64 B  -> 352 B
// The post states 576 and 352 and the 4-bit + per-16 FP8 scale format; the
// split into 256 + 32 + 64 is my reconstruction and adds up exactly.
//
// 78 attention layers per token is GLM-5.3's config.json (num_hidden_layers).
// The per-decoder capacities (1.09M tokens FP8, 1.63M NVFP4, same memory
// budget, indexer and other state unchanged) are the post's.
//
// Only +, -, *, / and Math.floor; lib/dmath is not needed.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

const LAYERS = 78
const CAP_FP8 = 1_090_000
const CAP_FP4 = 1_630_000

const FP8_ROW = [
  { label: "latent · 512 × 1 B", bytes: 512, tone: "a" },
  { label: "rope · 64 B", bytes: 64, tone: "r" },
] as const

const FP4_ROW = [
  { label: "latent · 512 × 4 bit", bytes: 256, tone: "a" },
  { label: "scales · 32", bytes: 32, tone: "s" },
  { label: "rope · 64 B", bytes: 64, tone: "r" },
] as const

const TONE: Record<string, string> = {
  a: "fill-sky-500/70 stroke-sky-600",
  s: "fill-amber-400/80 stroke-amber-600",
  r: "fill-foreground/20 stroke-foreground/50",
}

function fmt(n: number, d = 0) {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })
}

export function KvRowBytes() {
  const [ktok, setKtok] = useState(146)
  const tokens = ktok * 1000

  const W = 860
  const left = 96
  const right = 820
  const px = (b: number) => (b / 576) * (right - left)

  const gbFp8 = (tokens * LAYERS * 576) / 1e9
  const gbFp4 = (tokens * LAYERS * 352) / 1e9
  const sessFp8 = Math.floor(CAP_FP8 / tokens)
  const sessFp4 = Math.floor(CAP_FP4 / tokens)

  const rows = [
    { name: "FP8", total: 576, parts: FP8_ROW, y: 34 },
    { name: "NVFP4", total: 352, parts: FP4_ROW, y: 96 },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one MLA cache row (one token, one layer) · GLM-5.3, 78 attention layers
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${W} 150`}
          className="w-full min-w-[640px]"
          role="img"
          aria-label="Two byte bars on the same scale. The FP8 row is 576 bytes: a 512-byte latent and a 64-byte rotary part. The NVFP4 row is 352 bytes: the same 512 latent values packed at four bits into 256 bytes, 32 bytes of FP8 scales (one per 16 values), and the 64-byte rotary part kept in FP8."
        >
          {rows.map((r) => {
            let x = left
            return (
              <g key={r.name}>
                <text
                  x={left - 12}
                  y={r.y + 22}
                  textAnchor="end"
                  className="fill-foreground font-mono"
                  style={{ fontSize: 13 }}
                >
                  {r.name}
                </text>
                {r.parts.map((p) => {
                  const w = px(p.bytes)
                  const g = (
                    <g key={p.label}>
                      <rect
                        x={x}
                        y={r.y}
                        width={w}
                        height={34}
                        rx={2}
                        className={TONE[p.tone]}
                        strokeWidth={1}
                      />
                      {w > 70 ? (
                        <text
                          x={x + w / 2}
                          y={r.y + 21}
                          textAnchor="middle"
                          className="fill-foreground font-mono"
                          style={{ fontSize: 10.5 }}
                        >
                          {p.label}
                        </text>
                      ) : null}
                    </g>
                  )
                  x += w
                  return g
                })}
                <text
                  x={left + px(r.total) + 8}
                  y={r.y + 22}
                  className="fill-foreground font-mono"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  {r.total} B
                </text>
              </g>
            )
          })}
          <text
            x={left + px(256) + 2}
            y={146}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9.5 }}
          >
            32 B of scales + 64 B of rope: 96 of the 352 bytes are not the latent
          </text>
        </svg>
      </div>

      <div className="border-t px-3 py-3 sm:px-4">
        <label className="flex flex-wrap items-center gap-3 font-mono text-xs text-muted-foreground">
          <span className="whitespace-nowrap">session context</span>
          <Range
            min={16}
            max={256}
            step={2}
            value={ktok}
            onChange={(e) => setKtok(Number(e.target.value))}
            className="min-w-[160px] flex-1 cursor-pointer"
            aria-label="Session context length in thousands of tokens"
          />
          <span className="w-16 text-right text-foreground">{ktok}K tok</span>
        </label>

        <div className="mt-3 grid grid-cols-1 gap-2 font-mono text-xs sm:grid-cols-3">
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">latent KV for this session</div>
            <div className="mt-1 text-foreground">
              FP8 {fmt(gbFp8, 2)} GB &rarr; NVFP4 {fmt(gbFp4, 2)} GB
            </div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">
              full sessions per decoder (reported capacity)
            </div>
            <div className="mt-1 text-foreground">
              FP8 {sessFp8} &rarr; NVFP4 {sessFp4}
            </div>
          </div>
          <div className="rounded border px-3 py-2">
            <div className="text-muted-foreground">ratio</div>
            <div className="mt-1 text-foreground">
              rows {fmt(576 / 352, 2)}&times; · capacity {fmt(CAP_FP4 / CAP_FP8, 2)}&times;
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Bytes per row are the post&rsquo;s; the 256&thinsp;+&thinsp;32&thinsp;+&thinsp;64
        split is my reconstruction from its stated format (reasoned). Session
        size is tokens &times; 78 layers &times; row bytes and counts only the
        MLA latent, not the sparse indexer&rsquo;s keys. The session count divides
        the post&rsquo;s reported per-decoder capacity (1.09M and 1.63M tokens)
        by the slider, which is why it moves by less than the row ratio: the
        indexer and other per-token state did not shrink.
      </figcaption>
    </figure>
  )
}
