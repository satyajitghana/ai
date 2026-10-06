"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What an IC-LoRA actually feeds the LTX-2 transformer: one sequence holding
// the target's noisy tokens and the reference's clean tokens, and the
// self-attention mask over it.
//
// From the LTX-2 repo (ltx-core and ltx-pipelines, read, not run):
// - The video VAE compresses 32x in height and width and 8x in time, and the
//   patchifier uses patch size 1, so W x H x F pixels become
//   (W/32) * (H/32) * (1 + (F-1)/8) tokens.
// - VideoConditionByReferenceLatent appends the reference tokens with
//   denoise strength 0 (kept clean) and the same position grid as the target
//   when the downscale factor is 1.
// - With conditioning attention strength s = 1 no mask is built at all: every
//   token attends to every token. With s < 1, build_attention_mask writes s
//   into the target<->reference blocks, 0 between two different references,
//   and 1 inside each reference; the float mask becomes an additive log(s)
//   bias on the attention logits.
// - The reference image at frame index -1 is drawn here as one latent frame of
//   the canvas: an assumption, labelled as such.

type Canvas = { label: string; w: number; h: number; note: string }
const CANVASES: Canvas[] = [
  { label: "960 x 544", w: 960, h: 544, note: "the trained tile" },
  { label: "1440 x 1088", w: 1440, h: 1088, note: "the 4:3 canvas, untiled" },
  { label: "1920 x 1088", w: 1920, h: 1088, note: "the 16:9 canvas, untiled" },
]
const FRAMES = [49, 97]

const fmt = (n: number) => n.toLocaleString("en-US")

type Seg = { id: string; label: string; n: number; fill: string; sub: string }

export function IcSequence() {
  const [ci, setCi] = useState(0)
  const [fi, setFi] = useState(1)
  const [img, setImg] = useState(false)
  const [s, setS] = useState(1)

  const c = CANVASES[ci]
  const F = FRAMES[fi]
  const perFrame = (c.w / 32) * (c.h / 32)
  const latFrames = 1 + (F - 1) / 8
  const N = perFrame * latFrames
  const M = N
  const K = img ? perFrame : 0
  const L = N + M + K

  const segs: Seg[] = [
    { id: "t", label: "target", n: N, fill: "#f59e0b", sub: "noisy, sigma from the sampler, loss here" },
    { id: "r", label: "archive clip", n: M, fill: "#0ea5e9", sub: "clean, timestep 0, no loss" },
  ]
  if (img) segs.push({ id: "i", label: "reference image", n: K, fill: "#8b5cf6", sub: "clean, frame index -1" })

  const masked = s < 1
  // mask value for (row segment, col segment)
  const cell = (a: string, b: string): number => {
    if (!masked) return 1
    if (a === b) return 1
    if (a === "t" || b === "t") return s
    return 0 // two different references never see each other once a mask exists
  }

  const bias = s > 0 ? mlog(s) : -Infinity
  const pairRatio = (L * L) / (N * N)
  const tokRatio = L / N

  // geometry of the mask matrix, segment sizes in proportion
  const size = 240
  const offs: number[] = []
  let acc = 0
  for (const g of segs) {
    offs.push(acc)
    acc += (g.n / L) * size
  }

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="IC-LoRA token sequence and self-attention mask for the LTX-2 transformer"
    >
      <div className="grid gap-4 border-b px-4 py-4 sm:grid-cols-2">
        <div>
          <span className="font-mono text-xs text-muted-foreground">canvas</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {CANVASES.map((cv, i) => (
              <button
                key={cv.label}
                type="button"
                onClick={() => setCi(i)}
                aria-pressed={ci === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  ci === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {cv.label}
              </button>
            ))}
          </div>
          <p className="mt-1 mb-0 font-mono text-xs text-muted-foreground">{c.note}</p>
        </div>
        <div>
          <span className="font-mono text-xs text-muted-foreground">frames per window</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {FRAMES.map((f, i) => (
              <button
                key={f}
                type="button"
                onClick={() => setFi(i)}
                aria-pressed={fi === i}
                className={cn(
                  "rounded-sm border px-2.5 py-1 font-mono text-xs",
                  fi === i
                    ? "border-foreground/40 bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {f}
              </button>
            ))}
            <label className="ml-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
              <input type="checkbox" checked={img} onChange={() => setImg((v) => !v)} />
              add a reference image
            </label>
          </div>
        </div>
        <label className="block sm:col-span-2">
          <span className="font-mono text-xs text-muted-foreground">
            conditioning attention strength s
          </span>
          <Range
            min={0}
            max={1}
            step={0.05}
            value={s}
            onChange={(e) => setS(Number(e.target.value))}
            className="mt-2 w-full"
            aria-label="conditioning attention strength"
          />
          <span className="mt-1 block font-mono text-sm tabular-nums">
            s = {s.toFixed(2)}{" "}
            <span className="text-muted-foreground">
              {masked
                ? `, logit bias ${Number.isFinite(bias) ? bias.toFixed(3) : "-inf"} on target-reference pairs`
                : ", no mask is built: full attention"}
            </span>
          </span>
        </label>
      </div>

      <div className="px-4 py-4">
        <span className="font-mono text-xs text-muted-foreground">one sequence, {fmt(L)} tokens</span>
        <div className="mt-2 flex h-8 w-full overflow-hidden rounded-sm border">
          {segs.map((g) => (
            <div
              key={g.id}
              className="flex items-center justify-center overflow-hidden px-1 font-mono text-[11px] whitespace-nowrap text-white"
              style={{ width: `${((g.n / L) * 100).toFixed(2)}%`, background: g.fill }}
              title={`${g.label}: ${fmt(g.n)} tokens`}
            >
              {g.label}
            </div>
          ))}
        </div>
        <ul className="mt-2 mb-0 list-none space-y-0.5 p-0 font-mono text-xs">
          {segs.map((g) => (
            <li key={g.id} className="m-0 p-0">
              <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: g.fill }} />
              {g.label}: <span className="tabular-nums">{fmt(g.n)}</span> tokens{" "}
              <span className="text-muted-foreground">· {g.sub}</span>
            </li>
          ))}
        </ul>

        <div className="mt-4 grid gap-4 md:grid-cols-[auto_minmax(0,1fr)]">
          <svg
            viewBox={`-60 -24 ${size + 64} ${size + 28}`}
            className="block h-auto w-full max-w-[320px]"
            role="img"
            aria-label={
              masked
                ? `Self-attention mask: target and references see each other at weight ${s.toFixed(2)}${img ? ", the two references are blocked from each other" : ""}`
                : "Self-attention mask: every token sees every token"
            }
          >
            <text x={size / 2} y={-10} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>
              keys
            </text>
            <text x={-50} y={size / 2} fontSize={10} fill="currentColor" opacity={0.7}>
              queries
            </text>
            {segs.map((ra, i) =>
              segs.map((cb, j) => {
                const v = cell(ra.id, cb.id)
                const w = (cb.n / L) * size
                const h = (ra.n / L) * size
                return (
                  <g key={`${ra.id}${cb.id}`}>
                    <rect
                      x={offs[j]}
                      y={offs[i]}
                      width={w}
                      height={h}
                      fill="#0ea5e9"
                      fillOpacity={0.08 + 0.72 * v}
                      stroke="currentColor"
                      strokeOpacity={0.35}
                      strokeWidth={0.75}
                    />
                    {w > 22 && h > 14 ? (
                      <text
                        x={offs[j] + w / 2}
                        y={offs[i] + h / 2 + 3.5}
                        textAnchor="middle"
                        fontSize={10}
                        fill="currentColor"
                      >
                        {v === 1 ? "1" : v === 0 ? "0" : v.toFixed(2)}
                      </text>
                    ) : null}
                  </g>
                )
              })
            )}
            {segs.map((g, i) => (
              <rect key={`l${g.id}`} x={-8} y={offs[i]} width={5} height={(g.n / L) * size} fill={g.fill} />
            ))}
            {segs.map((g, j) => (
              <rect key={`t${g.id}`} x={offs[j]} y={-6} width={(g.n / L) * size} height={4} fill={g.fill} />
            ))}
          </svg>

          <div className="grid content-start grid-cols-[auto_1fr] gap-x-4 gap-y-1 font-mono text-sm">
            <span className="text-muted-foreground">latent grid</span>
            <span className="tabular-nums">
              {c.w / 32} x {c.h / 32} x {latFrames}
            </span>
            <span className="text-muted-foreground">tokens in linear layers</span>
            <span className="tabular-nums">{tokRatio.toFixed(2)}x the target alone</span>
            <span className="text-muted-foreground">attention pairs</span>
            <span className="tabular-nums">{pairRatio.toFixed(2)}x the target alone</span>
            <span className="text-muted-foreground">positions</span>
            <span>reference token (t, h, w) sits on target token (t, h, w)</span>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Token counts reasoned from the LTX-2 code: a 32x, 32x, 8x VAE and patch size 1. The restore
        card runs 960 x 544 tiles of 97 frames with the clip at downscale factor 1, so the reference
        is as long as the target. The mask rule is read from ltx-core&apos;s build_attention_mask; the
        reference image&apos;s token count is an assumption (one latent frame of the canvas).
      </figcaption>
    </figure>
  )
}
