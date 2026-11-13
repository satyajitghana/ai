"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// The pair-free pipeline, stepped. Every count in the captions is read from the paper's text (arXiv 2610.28954,
// Sections 3-4 and Appendix A): 14,000 image pairs per modality, 389,854 real videos, 180.54M trainable adapter
// parameters, 12,183 optimisation steps at global batch 32.

type Box = { id: string; x: number; y: number; w: number; label: string; sub?: string; tone: "img" | "net" | "vid" | "ctl" }

const BOXES: Box[] = [
  { id: "pairs", x: 8, y: 14, w: 132, label: "image pairs", sub: "14,000 per modality", tone: "img" },
  { id: "r2c", x: 176, y: 14, w: 120, label: "DINO-R2C", sub: "real image to coarse", tone: "net" },
  { id: "real", x: 8, y: 98, w: 132, label: "real videos", sub: "389,854 clips", tone: "vid" },
  { id: "pseudo", x: 176, y: 98, w: 120, label: "pseudo-coarse", sub: "frame by frame", tone: "ctl" },
  { id: "rae", x: 332, y: 98, w: 120, label: "decode, re-encode", sub: "RGB bottleneck", tone: "net" },
  { id: "c2r", x: 488, y: 98, w: 128, label: "C2R# adapters", sub: "180.54M trained", tone: "net" },
  { id: "coarse", x: 332, y: 182, w: 120, label: "actual coarse", sub: "game, blockout, anime", tone: "vid" },
  { id: "out", x: 488, y: 182, w: 128, label: "photoreal video", sub: "Wan 2.2, frozen", tone: "vid" },
]

const LINKS: { a: string; b: string; step: number[] }[] = [
  { a: "pairs", b: "r2c", step: [0] },
  { a: "real", b: "r2c", step: [1] },
  { a: "r2c", b: "pseudo", step: [1] },
  { a: "pseudo", b: "rae", step: [2] },
  { a: "rae", b: "c2r", step: [2] },
  { a: "real", b: "c2r", step: [2] },
  { a: "coarse", b: "c2r", step: [3] },
  { a: "c2r", b: "out", step: [3] },
]

const ACTIVE: string[][] = [
  ["pairs", "r2c"],
  ["real", "r2c", "pseudo"],
  ["pseudo", "rae", "c2r", "real"],
  ["coarse", "c2r", "out"],
]

const STEPS = [
  {
    t: "1. Teach the bridge on images",
    s: "reported",
    b: "The only paired supervision is a stack of still images: a realistic picture and its coarse twin. 14,000 pairs for each of four coarse looks, 1280 by 720. A DINOv3 network learns to predict the DINO features of the coarse twin from the realistic image.",
  },
  {
    t: "2. Run it on any real video",
    s: "reported",
    b: "Apply that network to every frame of an ordinary real video. The result is a pseudo-coarse video that is paired, by construction, with the real one it came from. 389,854 clips are processed this way, on the fly, during training.",
  },
  {
    t: "3. Train the generator backwards",
    s: "reported",
    b: "Decode the predicted features to pixels with a frozen decoder, re-encode them with DINO, and use that as the control. Train only the adapters on a frozen Wan 2.2 to regenerate the real video from it. The target is always the real clip, so the generator never sees a pseudo-coarse frame as an answer.",
  },
  {
    t: "4. Drop the bridge at inference",
    s: "reported",
    b: "The bridge and the decoder are discarded. A real game render, blockout or animation goes through the same frozen DINO encoder and drives the same adapters. This is the one place where the stand-in is swapped for the real thing, and the paper's own limitations section says that is where it can fail.",
  },
]

const FILL: Record<Box["tone"], string> = {
  img: "oklch(0.93 0.05 80)",
  net: "oklch(0.92 0.05 255)",
  vid: "oklch(0.93 0.05 150)",
  ctl: "oklch(0.93 0.06 25)",
}

export function PairFlow() {
  const [step, setStep] = useState(0)
  const on = new Set(ACTIVE[step])
  const by = Object.fromEntries(BOXES.map((b) => [b.id, b]))
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap gap-2" role="tablist" onKeyDown={tablistKeys()} aria-label="Pipeline stage">
        {STEPS.map((s, i) => (
          <button
            key={s.t}
            role="tab"
            aria-selected={i === step}
            tabIndex={i === step ? 0 : -1}
            onClick={() => setStep(i)}
            className={cn(
              "rounded-md border px-3 py-1 text-sm",
              i === step ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {i + 1}
          </button>
        ))}
      </div>
      <svg viewBox="0 0 624 240" className="w-full" role="img" aria-label="Pair-free coarse-to-real pipeline, four stages">
        <defs>
          <marker id="pf-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto">
            <path d="M0 0L8 4L0 8z" fill="currentColor" />
          </marker>
        </defs>
        {LINKS.map((l) => {
          const a = by[l.a]
          const b = by[l.b]
          const live = l.step.includes(step)
          const horiz = Math.abs(a.y - b.y) < 4
          const x1 = horiz ? a.x + a.w : a.x + a.w / 2
          const y1 = horiz ? a.y + 22 : a.y + 44
          const x2 = horiz ? b.x : b.x + b.w / 2
          const y2 = horiz ? b.y + 22 : b.y
          // real -> c2r runs under the row; draw it as a bent path above the row instead
          if (l.a === "real" && l.b === "c2r") {
            return (
              <path
                key={l.a + l.b}
                d={`M${a.x + a.w / 2} ${a.y + 44} L${a.x + a.w / 2} 160 L552 160 L552 ${b.y + 44}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={live ? 2 : 1}
                strokeDasharray="5 4"
                opacity={live ? 0.9 : 0.15}
                markerEnd="url(#pf-arrow)"
              />
            )
          }
          const vert = !horiz
          const d =
            vert && l.a === "coarse"
              ? `M${a.x + a.w} ${a.y + 22} L520 ${a.y + 22} L520 ${b.y + 44}`
              : vert
                ? `M${a.x + a.w / 2} ${a.y + 44} L${b.x + b.w / 2} ${b.y}`
                : `M${x1} ${y1} L${x2} ${y2}`
          return (
            <path
              key={l.a + l.b}
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={live ? 2 : 1}
              opacity={live ? 0.9 : 0.15}
              markerEnd="url(#pf-arrow)"
            />
          )
        })}
        {BOXES.map((b) => (
          <g key={b.id} opacity={on.has(b.id) ? 1 : 0.28}>
            <rect x={b.x} y={b.y} width={b.w} height={44} rx={6} fill={FILL[b.tone]} stroke="oklch(0.4 0.02 260)" strokeWidth={on.has(b.id) ? 1.6 : 0.8} />
            <text x={b.x + b.w / 2} y={b.y + 19} textAnchor="middle" fontSize={12} fontWeight={600} fill="oklch(0.25 0.02 260)">
              {b.label}
            </text>
            <text x={b.x + b.w / 2} y={b.y + 34} textAnchor="middle" fontSize={9.5} fill="oklch(0.25 0.02 260)" opacity={0.8}>
              {b.sub}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="mt-3 text-sm leading-relaxed">
        <strong>{STEPS[step].t}.</strong> <span className="font-mono text-xs uppercase text-muted-foreground">{STEPS[step].s}</span>
        <br />
        {STEPS[step].b}
      </figcaption>
    </figure>
  )
}
