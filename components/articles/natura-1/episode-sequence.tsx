"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One Natura-1 episode laid out as one token sequence, and what the attention
// mask could look like over it.
//
// What the technical blog states (naturewill.com/blog/natura-1, read
// 2026-10-13): an episode is modelled "autoregressively as one sequence of
// language, image, video, and action tokens"; "past video as memory", "future
// video" predicted; video and action trained "together using flow matching and
// joint denoising, with a separate loss formulation for each modality";
// modality-specific bias lives "only in the sequence layout and the attention
// pattern". The X thread adds "the causal structure of attention".
//
// What it does NOT state: token counts per frame, how many frames or actions
// make one step, or what attention looks like inside one step. The token
// counts below are schematic (the blog's own figure draws runs of video
// squares, each followed by one action triangle). The "within-step" cells of
// the mask are drawn hatched in the stated view because the blog does not say;
// the second view fills them, which is what block-causal world-action models
// in the open literature do, and it is labelled as a guess.
//
// Only + - * / here, so server and client print the same SVG.

const STEPS = 6
const VID_PER_STEP = 3

type Kind = "lang" | "img" | "vid" | "act"
type Tok = { kind: Kind; seg: number; step: number }

// segment 0 = language, 1 = initial image, 2.. = timesteps
function layout(): Tok[] {
  const out: Tok[] = []
  for (let i = 0; i < 3; i++) out.push({ kind: "lang", seg: 0, step: -1 })
  for (let i = 0; i < 2; i++) out.push({ kind: "img", seg: 1, step: -1 })
  for (let s = 0; s < STEPS; s++) {
    for (let i = 0; i < VID_PER_STEP; i++) out.push({ kind: "vid", seg: s + 2, step: s })
    out.push({ kind: "act", seg: s + 2, step: s })
  }
  return out
}

const TOKS = layout()
const SEGS = STEPS + 2
const SEG_LABEL = ["text", "image", ...Array.from({ length: STEPS }, (_, i) => `t${i + 1}`)]

const COLOR: Record<Kind, string> = {
  lang: "currentColor",
  img: "oklch(0.62 0.12 250)",
  vid: "oklch(0.55 0.16 255)",
  act: "oklch(0.62 0.18 30)",
}

type Mask = "stated" | "block"

export function EpisodeSequence() {
  const [now, setNow] = useState(3)
  const [mask, setMask] = useState<Mask>("stated")

  // token strip
  const W = 640
  const cell = W / TOKS.length
  const isFuture = (t: Tok) => t.step >= now

  // mask grid at segment granularity
  const G = 248
  const gc = G / SEGS
  const cellState = (q: number, k: number): "on" | "off" | "unknown" => {
    if (k < q) return "on"
    if (k > q) return "off"
    // k === q: inside one segment
    if (q < 2) return "on" // a prompt attends within itself; not at issue
    return mask === "stated" ? "unknown" : "on"
  }

  const past = Math.max(0, now)
  const future = STEPS - past

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      aria-label="One Natura-1 episode as a single sequence of language, image, video and action tokens, with a slider for the present moment and a toggle for the attention mask"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        one episode = one sequence · layout and causal mask from the blog; token counts are
        schematic
      </div>

      <div className="flex flex-col gap-2 border-b px-4 py-3 font-mono text-xs">
        <label className="flex items-center gap-2">
          <span className="w-20 shrink-0 text-muted-foreground">now</span>
          <Range
            min={0}
            max={STEPS}
            step={1}
            value={now}
            onChange={(e) => setNow(Number(e.currentTarget.value))}
            className="flex-1"
            aria-label="the present moment in the episode"
          />
          <span className="w-36 shrink-0 text-right tabular-nums">
            {past} past · {future} future
          </span>
        </label>
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="mask">
          <span className="w-20 shrink-0 text-muted-foreground">mask</span>
          {(
            [
              { key: "stated", label: "what the blog states" },
              { key: "block", label: "block-causal (a guess)" },
            ] as { key: Mask; label: string }[]
          ).map((o) => (
            <button
              key={o.key}
              type="button"
              aria-pressed={o.key === mask}
              onClick={() => setMask(o.key)}
              className={cn(
                "rounded border px-2 py-1",
                o.key === mask
                  ? "border-foreground/60 text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto px-4 pt-3">
        <svg
          viewBox={`0 0 ${W} 74`}
          width="100%"
          className="min-w-[440px]"
          role="img"
          aria-label={`Token strip: three language tokens, two image tokens, then ${STEPS} timesteps of three video tokens and one action token. The first ${past} timesteps are past, kept as memory; the remaining ${future} are future, predicted by joint flow matching.`}
        >
          {TOKS.map((t, i) => {
            const x = i * cell + 1
            const fut = isFuture(t)
            const c = COLOR[t.kind]
            if (t.kind === "act") {
              const cx = x + (cell - 2) / 2
              return (
                <polygon
                  key={i}
                  points={`${cx - 5},14 ${cx + 6},21 ${cx - 5},28`}
                  fill={fut ? "none" : c}
                  stroke={c}
                  strokeWidth={1.2}
                  strokeDasharray={fut ? "2 1.5" : undefined}
                />
              )
            }
            return (
              <rect
                key={i}
                x={x}
                y={14}
                width={cell - 2}
                height={14}
                rx={t.kind === "lang" ? 7 : 1.5}
                fill={fut ? "none" : c}
                fillOpacity={t.kind === "lang" ? 0.75 : 1}
                stroke={c}
                strokeWidth={1.2}
                strokeDasharray={fut ? "2 1.5" : undefined}
              />
            )
          })}
          {/* the present */}
          {(() => {
            const firstFuture = TOKS.findIndex((t) => t.step >= now)
            const idx = firstFuture === -1 ? TOKS.length : firstFuture
            const x = idx * cell - 0.5
            return (
              <g>
                <line x1={x} x2={x} y1={6} y2={36} stroke="currentColor" strokeWidth={1.5} />
                <text
                  x={x < W - 60 ? x + 4 : x - 4}
                  y={9}
                  textAnchor={x < W - 60 ? "start" : "end"}
                  className="fill-current font-mono text-[9px] opacity-70"
                >
                  now
                </text>
              </g>
            )
          })()}
          {SEG_LABEL.map((l, s) => {
            const first = TOKS.findIndex((t) => t.seg === s)
            const n = TOKS.filter((t) => t.seg === s).length
            return (
              <text
                key={l}
                x={first * cell + (n * cell) / 2}
                y={44}
                textAnchor="middle"
                className="fill-current font-mono text-[9px] opacity-60"
              >
                {l}
              </text>
            )
          })}
          <text x={0} y={64} className="fill-current font-mono text-[10px] opacity-70">
            filled = clean context (memory) · dashed = noised, denoised by flow matching · ■ video ▶
            action
          </text>
        </svg>
      </div>

      <div className="grid gap-4 px-4 py-3 sm:grid-cols-[auto_1fr]">
        <svg
          viewBox={`0 0 ${G + 34} ${G + 34}`}
          width={G + 34}
          className="max-w-full"
          role="img"
          aria-label={
            mask === "stated"
              ? "Attention mask by segment: each timestep sees the prompt and every earlier timestep, never a later one. Inside one timestep the pattern is not described by the blog and is hatched."
              : "Block-causal guess: each timestep sees the prompt, every earlier timestep and all tokens of its own timestep."
          }
        >
          <defs>
            <pattern id="n1-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="currentColor" strokeOpacity={0.55} strokeWidth={1.4} />
            </pattern>
          </defs>
          {SEG_LABEL.map((l, i) => (
            <g key={l}>
              <text
                x={30}
                y={34 + i * gc + gc / 2 + 3}
                textAnchor="end"
                className="fill-current font-mono text-[9px] opacity-60"
              >
                {l}
              </text>
              <text
                x={34 + i * gc + gc / 2}
                y={26}
                textAnchor="middle"
                className="fill-current font-mono text-[9px] opacity-60"
              >
                {l}
              </text>
            </g>
          ))}
          <text x={34} y={10} className="fill-current font-mono text-[9px] opacity-60">
            keys →   (rows: queries)
          </text>
          {SEG_LABEL.map((_, q) =>
            SEG_LABEL.map((__, k) => {
              const st = cellState(q, k)
              const x = 34 + k * gc + 1
              const y = 34 + q * gc + 1
              return (
                <rect
                  key={`${q}-${k}`}
                  x={x}
                  y={y}
                  width={gc - 2}
                  height={gc - 2}
                  rx={2}
                  fill={st === "on" ? "oklch(0.55 0.16 255)" : st === "unknown" ? "url(#n1-hatch)" : "none"}
                  fillOpacity={st === "on" ? (q >= 2 && q - 2 >= now ? 0.45 : 0.85) : 1}
                  stroke="currentColor"
                  strokeOpacity={st === "off" ? 0.15 : 0.35}
                />
              )
            })
          )}
        </svg>
        <div className="font-mono text-xs leading-relaxed">
          {mask === "stated" ? (
            <p className="my-0">
              <span className="text-foreground">Stated:</span>{" "}
              <span className="text-muted-foreground">
                attention is causal across the episode. A timestep reads the instruction, the
                first image and everything before it, and nothing after it. The hatched diagonal is
                the part the blog leaves out: whether the video and action tokens of one timestep
                see each other while they are denoised together.
              </span>
            </p>
          ) : (
            <p className="my-0">
              <span className="text-foreground">Guess, not stated:</span>{" "}
              <span className="text-muted-foreground">
                block-causal. Tokens inside one timestep see each other, so an action can read the
                frame it is denoised beside. Open world-action models do this; Nature Will has not
                said Natura-1 does.
              </span>
            </p>
          )}
          <p className="my-0 mt-2 text-muted-foreground">
            Paler rows are future timesteps (after <span className="text-foreground">now</span>):
            noised inputs, predicted with separate video and action losses. In training, teacher
            forcing supervises every timestep of the episode in one pass.
          </p>
        </div>
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        Layout after the blog&rsquo;s &ldquo;one sequence&rdquo; figure: language, image, then runs
        of video tokens each followed by an action. Counts per step are illustrative; Nature Will
        publishes none.
      </figcaption>
    </figure>
  )
}
