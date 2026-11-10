"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Which past frames each frame's cross-frame attention may read. READ from the released code:
// abot_recon/modeling/streaming/core/window_mask.py blocks key frame Tk for query frame Tq when
// Tk > Tq (future) or Tq - Tk > W - 1, with W = 12 (config.py refuses any other value).
// The full-causal mode is what a StreamVGGT-style cache does: every past frame stays visible.

const N = 24
const W = 12

const MODES = [
  { id: "full", label: "Full causal cache", blurb: "every past frame stays in the cache and in the attention" },
  { id: "win", label: "ABot-Recon window", blurb: "the current frame plus the 11 before it; older keys are evicted" },
] as const

type ModeId = (typeof MODES)[number]["id"]

const visible = (mode: ModeId, q: number, k: number) => k <= q && (mode === "full" || q - k <= W - 1)

export function WindowBand() {
  const [mode, setMode] = useState<ModeId>("win")
  const [q, setQ] = useState(19)
  const meta = MODES.find((m) => m.id === mode)!
  const cell = 14
  const off = 26
  const size = off + N * cell + 4
  const held = Array.from({ length: q + 1 }, (_, k) => k).filter((k) => visible(mode, q, k)).length
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        read · window_mask.py and config.py in amap-cvlab/ABot-Recon · 24 frames shown, one cell per frame
      </div>
      <div className="flex flex-wrap gap-2 px-3 pt-3" role="tablist" aria-label="Cache policy">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="tab"
            aria-selected={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-xs transition-colors",
              mode === m.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="px-3 pt-2 text-xs text-muted-foreground">{meta.blurb}.</p>
      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr] sm:items-start">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="mx-auto w-full max-w-[22rem]"
          role="img"
          aria-label={`Attention mask, ${meta.label}: rows are query frames, columns are key frames`}
        >
          <text x={off} y={10} fontSize={9} className="fill-muted-foreground font-mono">
            key frame →
          </text>
          <text x={10} y={off + 40} fontSize={9} transform={`rotate(-90 10 ${off + 40})`} className="fill-muted-foreground font-mono">
            query frame →
          </text>
          {Array.from({ length: N }, (_, r) =>
            Array.from({ length: N }, (_, c) => {
              const on = visible(mode, r, c)
              const row = r === q
              return (
                <rect
                  key={`${r}-${c}`}
                  x={off + c * cell}
                  y={off - 10 + r * cell}
                  width={cell - 1.5}
                  height={cell - 1.5}
                  rx={2}
                  onClick={() => setQ(r)}
                  style={{
                    cursor: "pointer",
                    fill: on ? (row ? "oklch(0.62 0.17 35)" : "oklch(0.62 0.13 250)") : "var(--muted)",
                    opacity: on ? (row ? 1 : 0.55) : 1,
                  }}
                />
              )
            })
          )}
        </svg>
        <div className="space-y-3 text-sm">
          <label className="block font-mono text-xs text-muted-foreground">
            query frame <span className="text-foreground">{q}</span>
            <input
              type="range"
              min={0}
              max={N - 1}
              value={q}
              onChange={(e) => setQ(Number(e.target.value))}
              className="mt-1 block w-full"
              aria-label="Query frame"
            />
          </label>
          <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 font-mono text-xs">
            <dt className="text-muted-foreground">frames this query attends to</dt>
            <dd className="text-right tabular-nums">{held}</dd>
            <dt className="text-muted-foreground">past frames kept in the cache</dt>
            <dd className="text-right tabular-nums">{held - 1}</dd>
            <dt className="text-muted-foreground">at frame 4,660 (KITTI-02&apos;s last)</dt>
            <dd className="text-right tabular-nums">{mode === "full" ? "4,661" : "12"}</dd>
          </dl>
          <p className="text-xs text-muted-foreground">
            Click a row or drag the slider. Under the window the band stops growing at frame 11: from then on every frame
            solves the same-sized problem. Positions inside the band still carry absolute frame indices for the rotary
            embedding, which only ever sees their differences.
          </p>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        The released model refuses any window but 12. Frame-attention layers (even decoder blocks) see one frame only; only
        the 18 odd blocks read this band.
      </figcaption>
    </figure>
  )
}
