"use client"

import { useRef, useState, type PointerEvent } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Plan an outpaint for Qwen-Image-2.1 with ausboss's LoRA: pick a canvas size,
// drag the kept picture around inside it, and read off what the model is
// actually handed.
//
// Nothing here is measured. The rules come from three places:
//
// - The card: pad with flat gray #808080 to a canvas that is a multiple of 32,
//   target ~1 MP for v1 and 1-2 MP for v2; v2 trained on kept shares of
//   45-93 % (median ~74 %); v1 also saw small windows at 12-30 %; under ~15 %
//   "invents a lot".
// - diffusers' QwenImage21Pipeline: `multiple_of = vae_scale_factor * 2` = 32,
//   and `calculate_dimensions()` rounds each side to the nearest 32.
// - The transformer: patch_size 1 on a 16x VAE, so an H x W image is exactly
//   (H/16) x (W/16) latent tokens, and each vision-language image slot stands
//   for 2 x 2 of them (`_IMG_TOKENS_PER_SLOT = 4`). The padded canvas goes in as
//   the condition image AND sets the output size, so the target has the same
//   token count as the condition.
//
// Arithmetic is + - * / Math.sqrt Math.round only, all
// exact under IEEE-754, so no lib/dmath wrapper is needed.

const ASPECTS = [
  { label: "1:1", w: 1, h: 1 },
  { label: "4:3", w: 4, h: 3 },
  { label: "3:2", w: 3, h: 2 },
  { label: "16:9", w: 16, h: 9 },
  { label: "3:4", w: 3, h: 4 },
  { label: "2:3", w: 2, h: 3 },
] as const

const GRID = 32 // canvas multiple: 16x VAE times a 2x2 vision slot
const TOKEN_PX = 16 // one latent token covers 16 x 16 pixels

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const fmt = (n: number) => n.toLocaleString("en-US")

type Band = { label: string; tone: string; note: string }

function bandOf(share: number): Band {
  if (share < 0.15)
    return {
      label: "beyond the card's limit",
      tone: "text-red-700 dark:text-red-400",
      note: "under ~15 % kept, the card says results invent a lot and vary by seed",
    }
  if (share < 0.45)
    return {
      label: "v1 territory",
      tone: "text-amber-700 dark:text-amber-400",
      note: "below v2's training range; v1 also trained small windows at 12-30 % kept",
    }
  if (share <= 0.93)
    return {
      label: "inside v2's range",
      tone: "text-emerald-700 dark:text-emerald-400",
      note: "v2 trained on 45-93 % kept, median about 74 %",
    }
  return {
    label: "a sliver",
    tone: "text-muted-foreground",
    note: "above 93 %: less extension than anything v2 trained on",
  }
}

export function PaddingPlanner() {
  const [mp, setMp] = useState(1.0)
  const [aspect, setAspect] = useState(1)
  const [keptW, setKeptW] = useState(0.8)
  const [keptH, setKeptH] = useState(0.8)
  const [px, setPx] = useState(0.5)
  const [py, setPy] = useState(0.5)
  const drag = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const ar = ASPECTS[aspect].w / ASPECTS[aspect].h
  const rawW = Math.sqrt(mp * 1e6 * ar)
  const rawH = rawW / ar
  const W = Math.max(GRID, Math.round(rawW / GRID) * GRID)
  const H = Math.max(GRID, Math.round(rawH / GRID) * GRID)

  const kw = Math.max(TOKEN_PX, Math.round(keptW * W))
  const kh = Math.max(TOKEN_PX, Math.round(keptH * H))
  const x = Math.round(px * (W - kw))
  const y = Math.round(py * (H - kh))
  const pad = { left: x, right: W - x - kw, top: y, bottom: H - y - kh }

  const share = (kw * kh) / (W * H)
  const zoom = 1 / Math.sqrt(share)
  const band = bandOf(share)

  const cols = W / TOKEN_PX
  const rows = H / TOKEN_PX
  const tokens = cols * rows
  const slots = tokens / 4

  const onDown = (ev: PointerEvent<SVGRectElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId)
    drag.current = { x: ev.clientX, y: ev.clientY, px, py }
  }
  const onMove = (ev: PointerEvent<SVGRectElement>) => {
    const d = drag.current
    const svg = ev.currentTarget.ownerSVGElement
    if (!d || !svg) return
    const r = svg.getBoundingClientRect()
    const scale = W / r.width
    const dx = (ev.clientX - d.x) * scale
    const dy = (ev.clientY - d.y) * scale
    if (W > kw) setPx(clamp(d.px + dx / (W - kw), 0, 1))
    if (H > kh) setPy(clamp(d.py + dy / (H - kh), 0, 1))
  }
  const onUp = () => {
    drag.current = null
  }

  const gridLines: number[] = []
  for (let g = GRID; g < W; g += GRID) gridLines.push(g)
  const gridRows: number[] = []
  for (let g = GRID; g < H; g += GRID) gridRows.push(g)

  // band positions on a 0-100 % share axis
  const meter = (v: number) => `${(v * 100).toFixed(2)}%`

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="Padding planner: canvas rounding, kept share and token counts for a Qwen-Image-2.1 outpaint"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">target canvas</span>
          <Range
            min={1}
            max={2}
            step={0.05}
            value={mp}
            onChange={(e) => setMp(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="target canvas megapixels"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {mp.toFixed(2)} MP{" "}
            <span className="text-muted-foreground">(v2 trained at 1-2 MP)</span>
          </span>
        </label>
        <div>
          <span className="font-mono text-xs text-muted-foreground">canvas aspect</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {ASPECTS.map((a, i) => (
              <button
                key={a.label}
                type="button"
                onClick={() => setAspect(i)}
                aria-pressed={aspect === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  aspect === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">kept picture, width</span>
          <Range
            min={0.2}
            max={1}
            step={0.01}
            value={keptW}
            onChange={(e) => setKeptW(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="kept picture width as a fraction of the canvas"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {fmt(kw)} px <span className="text-muted-foreground">of {fmt(W)}</span>
          </span>
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">kept picture, height</span>
          <Range
            min={0.2}
            max={1}
            step={0.01}
            value={keptH}
            onChange={(e) => setKeptH(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="kept picture height as a fraction of the canvas"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            {fmt(kh)} px <span className="text-muted-foreground">of {fmt(H)}</span>
          </span>
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">placement, left to right</span>
          <Range
            min={0}
            max={1}
            step={0.01}
            value={px}
            onChange={(e) => setPx(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="horizontal placement of the kept picture"
          />
        </label>
        <label className="block">
          <span className="font-mono text-xs text-muted-foreground">placement, top to bottom</span>
          <Range
            min={0}
            max={1}
            step={0.01}
            value={py}
            onChange={(e) => setPy(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="vertical placement of the kept picture"
          />
        </label>
      </div>

      <div className="grid gap-4 px-4 py-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <svg
            viewBox={`0 0 ${W} ${H}`}
            className="block h-auto max-h-[360px] w-full"
            role="img"
            aria-label={`A ${W} by ${H} canvas in flat gray with the kept picture, ${kw} by ${kh}, drawn inside it`}
            style={{ touchAction: "none" }}
          >
            <rect x={0} y={0} width={W} height={H} fill="#808080" />
            {gridLines.map((g) => (
              <line key={`c${g}`} x1={g} y1={0} x2={g} y2={H} stroke="#000" strokeOpacity={0.12} strokeWidth={W / 700} />
            ))}
            {gridRows.map((g) => (
              <line key={`r${g}`} x1={0} y1={g} x2={W} y2={g} stroke="#000" strokeOpacity={0.12} strokeWidth={W / 700} />
            ))}
            <defs>
              <linearGradient id="pp-sky" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0" stopColor="#f59e0b" />
                <stop offset="0.62" stopColor="#fbbf24" />
                <stop offset="0.63" stopColor="#1f2937" />
                <stop offset="1" stopColor="#111827" />
              </linearGradient>
            </defs>
            <rect
              x={x}
              y={y}
              width={kw}
              height={kh}
              fill="url(#pp-sky)"
              stroke="#fff"
              strokeWidth={W / 250}
              className="cursor-grab active:cursor-grabbing"
              onPointerDown={onDown}
              onPointerMove={onMove}
              onPointerUp={onUp}
              onPointerCancel={onUp}
            />
          </svg>
          <p className="mt-2 mb-0 font-mono text-xs text-muted-foreground">
            drag the picture · faint lines are the 32 px grid, one vision slot = 2 x 2 latent tokens
          </p>
        </div>

        <div className="font-mono text-sm">
          <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
            <span className="text-muted-foreground">canvas asked</span>
            <span className="tabular-nums">
              {rawW.toFixed(1)} x {rawH.toFixed(1)}
            </span>
            <span className="text-muted-foreground">on the 32 grid</span>
            <span className="tabular-nums">
              {fmt(W)} x {fmt(H)}{" "}
              <span className="text-muted-foreground">= {((W * H) / 1e6).toFixed(3)} MP</span>
            </span>
            <span className="text-muted-foreground">gray, L R T B</span>
            <span className="tabular-nums">
              {pad.left} {pad.right} {pad.top} {pad.bottom} px
            </span>
            <span className="text-muted-foreground">latent grid</span>
            <span className="tabular-nums">
              {cols} x {rows}
            </span>
            <span className="text-muted-foreground">condition image</span>
            <span className="tabular-nums">{fmt(tokens)} tokens</span>
            <span className="text-muted-foreground">target image</span>
            <span className="tabular-nums">{fmt(tokens)} tokens</span>
            <span className="text-muted-foreground">vision slots</span>
            <span className="tabular-nums">{fmt(slots)} in the prompt</span>
          </div>

          <div className="mt-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs text-muted-foreground">kept share of the canvas</span>
              <span className={cn("tabular-nums", band.tone)}>{(share * 100).toFixed(1)}%</span>
            </div>
            <div className="relative mt-2 h-4 overflow-hidden rounded-sm bg-muted/60">
              <div
                className="absolute inset-y-0 bg-amber-400/30"
                style={{ left: meter(0.12), width: meter(0.3 - 0.12) }}
                title="v1 small windows, 12-30 %"
              />
              <div
                className="absolute inset-y-0 bg-emerald-500/30"
                style={{ left: meter(0.45), width: meter(0.93 - 0.45) }}
                title="v2 training range, 45-93 %"
              />
              <div className="absolute inset-y-0 w-0.5 bg-foreground" style={{ left: meter(share) }} />
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
              <span>0%</span>
              <span>v1 12-30</span>
              <span>v2 45-93</span>
              <span>100%</span>
            </div>
            <p className={cn("mt-2 mb-0 text-xs", band.tone)}>
              {band.label}: <span className="text-muted-foreground">{band.note}</span>
            </p>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Derived, not measured. The canvas is the asked size rounded to the nearest multiple of 32
        on each side, as diffusers&apos; pipeline does; the card&apos;s padding node also works on
        a multiple of 32. It goes in
        as the condition image and sets the output size, so both are {fmt(tokens)} latent tokens
        and the denoiser carries {fmt(2 * tokens)} image tokens where text-to-image at the same
        size carries {fmt(tokens)}. The kept share is {(share * 100).toFixed(1)}%; framing the
        picture evenly on all sides to the same share is a {zoom.toFixed(2)}x zoom-out in each
        direction.
      </figcaption>
    </figure>
  )
}
