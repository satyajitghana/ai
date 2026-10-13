"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How many visual tokens one image costs MiniCPM-V 4.7, and how much encoder
// work it takes to get them.
//
// This is a line-for-line port of the Hugging Face image processor the model
// card tells you to use: transformers/models/minicpmv4_6/image_processing_minicpmv4_6.py
// (MiniCPM-V 4.7 inherits it unchanged): get_sliced_grid, find_best_resize,
// get_refine_size and ensure_divide, with scale_resolution 448 and patch_size 14.
// Python's round() is half-to-even and int() truncates, so both are reproduced.
//
// Token counts follow the vision path in modular_minicpmv4_6.py:
//   16x  -> SigLIP layers 0..6 at full patch count, a 2x2 window-attention
//           merger after layer index 6 (insert_layer_id), layers 7..26 on a
//           quarter of the patches, then the outer 2x2 MLP merger.
//   4x   -> the ViT merger is skipped (use_vit_merger = downsample_mode != "4x"),
//           all 27 layers run at full patch count, then the outer 2x2 merger.
// Checked against a Python run of the same functions: a 1227x920 photo at
// max_slice_nums 9 gives a 2x3 grid, 7 crops, 7152 patches, 447 tokens at 16x,
// which is the figure the MiniCPM-V iOS app's own source quotes for a 9-slice image.

const SCALE = 448
const PATCH = 14
const LAYERS = 27
const INSERT = 6 // merger runs after this layer index, so 7 layers see full resolution

function pyRound(x: number): number {
  const f = Math.floor(x)
  const d = x - f
  if (d > 0.5) return f + 1
  if (d < 0.5) return f
  return f % 2 === 0 ? f : f + 1
}

const ensureDivide = (len: number, div: number) => Math.max(pyRound(len / div) * div, div)

function findBestResize(h: number, w: number, upscale: boolean): [number, number] {
  let hh = h
  let ww = w
  if (hh * ww > SCALE * SCALE || upscale) {
    const ar = ww / hh
    hh = Math.trunc(SCALE / Math.sqrt(ar))
    ww = Math.trunc(hh * ar)
  }
  return [ensureDivide(hh, PATCH * 4), ensureDivide(ww, PATCH * 4)]
}

function slicedGrid(h: number, w: number, maxSlices: number): [number, number] | null {
  const logRatio = mlog(w / h)
  const ratio = (w * h) / (SCALE * SCALE)
  const multiple = Math.min(Math.ceil(ratio), maxSlices)
  if (multiple <= 1) return null
  let best: [number, number] = [1, 1]
  let minErr = Infinity
  for (const n of [multiple - 1, multiple, multiple + 1]) {
    if (n === 1 || n > maxSlices) continue
    for (let rows = 1; rows <= n; rows++) {
      if (n % rows !== 0) continue
      const cols = n / rows
      const err = Math.abs(logRatio - mlog(cols / rows))
      if (err < minErr) {
        best = [rows, cols]
        minErr = err
      } else if (err === minErr && rows > best[0]) {
        best = [rows, cols]
      }
    }
  }
  return best
}

type Plan = {
  grid: [number, number] | null
  overview: [number, number]
  slice: [number, number] | null
  crops: number
  patches: number
}

function plan(h: number, w: number, maxSlices: number): Plan {
  const grid = slicedGrid(h, w, maxSlices)
  const [sh, sw] = findBestResize(h, w, grid === null)
  const overview: [number, number] = [sh / PATCH, sw / PATCH]
  let patches = overview[0] * overview[1]
  let slice: [number, number] | null = null
  let crops = 1
  if (grid) {
    const [gy, gx] = grid
    const rw = ensureDivide(w, gx)
    const rh = ensureDivide(h, gy)
    const [bh, bw] = findBestResize(rh / gy, rw / gx, true)
    slice = [bh / PATCH, bw / PATCH]
    crops += gy * gx
    patches += gy * gx * slice[0] * slice[1]
  }
  return { grid, overview, slice, crops, patches }
}

const PRESETS = [
  { id: "demo", label: "1227x920 photo", w: 1227, h: 920, note: "the parking-sign photo in OpenBMB's own demo clip" },
  { id: "phone", label: "4032x3024 phone", w: 4032, h: 3024, note: "a 12 MP phone camera frame" },
  { id: "screen", label: "1920x1080 screen", w: 1920, h: 1080, note: "a screenshot" },
  { id: "page", label: "1240x1754 page", w: 1240, h: 1754, note: "an A4 page scanned at 150 dpi" },
  { id: "small", label: "500x300 thumb", w: 500, h: 300, note: "small enough that nothing is sliced" },
]

const fmt = (n: number) => n.toLocaleString("en-US")

export function VisualTokens() {
  const [preset, setPreset] = useState(PRESETS[0].id)
  const [maxSlices, setMaxSlices] = useState(9)
  const [mode, setMode] = useState<"16x" | "4x">("16x")

  const img = PRESETS.find((p) => p.id === preset) ?? PRESETS[0]
  const p = plan(img.h, img.w, maxSlices)
  const div = mode === "16x" ? 16 : 4
  const tokens = p.patches / div
  // token-layers through the 27 SigLIP layers, in units of "patches x layers"
  const full = p.patches * LAYERS
  const vit = mode === "16x" ? p.patches * (INSERT + 1) + (p.patches / 4) * (LAYERS - INSERT - 1) : full
  const vitPct = Math.round((vit / full) * 1000) / 10

  const gy = p.grid ? p.grid[0] : 0
  const gx = p.grid ? p.grid[1] : 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one image through the MiniCPM-V 4.7 processor</span>
        <span className="font-mono text-[10px] text-muted-foreground">image_processing_minicpmv4_6.py, ported</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="image">
          {PRESETS.map((pr) => (
            <button
              key={pr.id}
              type="button"
              onClick={() => setPreset(pr.id)}
              aria-pressed={pr.id === preset}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                pr.id === preset ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {pr.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="flex min-w-[220px] flex-1 items-center gap-2 font-mono text-[11px] text-muted-foreground">
            <span className="whitespace-nowrap">max_slice_nums {maxSlices}</span>
            <Range
              min={1}
              max={36}
              step={1}
              value={maxSlices}
              onChange={(e) => setMaxSlices(Number(e.target.value))}
              aria-label="max_slice_nums"
            />
          </label>
          <div className="flex rounded-md border p-0.5" role="group" aria-label="downsample_mode">
            {(["16x", "4x"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={m === mode}
                className={cn(
                  "rounded px-2.5 py-1 font-mono text-xs transition-colors",
                  m === mode ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div>
            <p className="mb-1.5 font-mono text-[10px] text-muted-foreground">
              crops sent to the encoder ({p.crops})
            </p>
            <div className="flex items-start gap-3">
              <div
                className="flex shrink-0 items-center justify-center rounded border border-dashed bg-muted/30 font-mono text-[9px] text-muted-foreground"
                style={{ width: 56, height: Math.max(24, Math.round((56 * p.overview[0]) / p.overview[1])) }}
                title="overview"
              >
                overview
              </div>
              {p.grid ? (
                <div
                  className="grid gap-0.5"
                  style={{ gridTemplateColumns: `repeat(${gx}, minmax(0, 1fr))`, width: Math.min(220, gx * 34) }}
                >
                  {Array.from({ length: gy * gx }, (_, i) => (
                    <div
                      key={i}
                      className="rounded-sm border bg-sky-500/15"
                      style={{ aspectRatio: p.slice ? `${p.slice[1]} / ${p.slice[0]}` : "1 / 1" }}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">no slicing: the whole image is one crop</p>
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{img.note}.</p>
          </div>

          <div className="space-y-2 font-mono text-xs">
            <Row k="grid" v={p.grid ? `${gy} x ${gx} slices + overview` : "overview only"} />
            <Row k="overview patches" v={`${p.overview[0]} x ${p.overview[1]}`} />
            {p.slice && <Row k="patches per slice" v={`${p.slice[0]} x ${p.slice[1]}`} />}
            <Row k="SigLIP patches (14 px)" v={fmt(p.patches)} />
            <Row k={`tokens into the LLM (${mode})`} v={fmt(tokens)} strong />
            <Row k="encoder work vs 27 full layers" v={`${vitPct}%`} />
          </div>
        </div>

        <p className="font-mono text-[9px] leading-4 text-muted-foreground">
          16x: layers 0&ndash;6 see every patch, a 2x2 window-attention merger quarters them, layers
          7&ndash;26 run on the rest, and a 2x2 MLP merger quarters them again before the language
          model. 4x skips the in-encoder merger, so the encoder does all 27 layers at full
          resolution. Encoder work counts patch-layers only; attention inside each crop is quadratic,
          so the real saving at 16x is larger.
        </p>
      </div>
    </figure>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border/50 pb-1">
      <span className="text-[11px] text-muted-foreground">{k}</span>
      <span className={cn("text-right", strong ? "text-sm font-semibold text-foreground" : "text-foreground")}>{v}</span>
    </div>
  )
}
