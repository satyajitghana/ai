"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Idol request, stage by stage. Shapes, parameter counts and FLOPs are
// ours: parameter counts are summed from the safetensors headers, shapes and
// loop structure come from idol/pipeline.py and idol/models/*.py, FLOPs are
// 2 x tokens x weights plus 4 x tokens x keys x width for attention.

type Stage = {
  id: string
  label: string
  sub: string
  params: string
  shape: string
  tflops: string
  basis: "measured" | "reported" | "reasoned"
  body: string
}

const STAGES: Stage[] = [
  {
    id: "prep",
    label: "BiRefNet + crop",
    sub: "cut out, centre, 1024 px",
    params: "220.7M",
    shape: "image 1024 x 1024 x 3",
    tflops: "small",
    basis: "reported",
    body: "A background remover cuts the object out and the crop leaves 1/1.2 of the frame around it for renders, 1/1.7 for photographs (the --mode flag). Header count 220,697,543, FP16 on disk.",
  },
  {
    id: "enc",
    label: "DINOv3 + FLUX.2 VAE",
    sub: "two frozen encoders",
    params: "840.6M + 84.1M",
    shape: "4,101 tokens x (1280 | 128)",
    tflops: "about 10",
    basis: "reasoned",
    body: "DINOv3 ViT-H+/16 gives 4,096 patch tokens plus 5 special ones. The FLUX.2 VAE latent is 64 x 64 tokens of 128 channels, with 5 zero rows glued on so both streams are 4,101 long. The two are summed after a linear each. Both are gated downloads and neither is in the Idol repository.",
  },
  {
    id: "dit",
    label: "Flow DiT, 50 steps",
    sub: "24 joint blocks, width 1024",
    params: "370.6M",
    shape: "12,294 tokens: 8,192 + 4,101 + 1",
    tflops: "23.8 per pass",
    basis: "reasoned",
    body: "A rectified-flow transformer denoises 8,192 latent tokens of 16 channels plus one camera token. Each step runs a conditional and an unconditional pass (guidance 3.0), so one step is about 47.5 TFLOPs and a 50-step request about 2.38 PFLOPs.",
  },
  {
    id: "oct",
    label: "Octree decoder",
    sub: "latent to anchor points",
    params: "50.8M",
    shape: "N / 32 anchors, 8 levels",
    tflops: "up to 7",
    basis: "reasoned",
    body: "Descends an octree eight levels deep. At each level a 4-block cross-attention transformer predicts how the points in a cell split among its 8 children, and systematic resampling turns those probabilities into integer counts. Leaves become anchors at a uniformly random position inside their cell.",
  },
  {
    id: "gs",
    label: "Gaussian decoder",
    sub: "32 splats per anchor",
    params: "237.3M",
    shape: "N / 32 x 480 outputs",
    tflops: "1.1 to 103",
    basis: "reasoned",
    body: "A 16-block transformer with full self-attention over the anchors and cross-attention into the 8,192 x 16 latent. Its last layer emits 480 numbers per anchor: 32 splats x 15 values. Cost grows with the square of the anchor count.",
  },
  {
    id: "ply",
    label: "Activate + PLY",
    sub: "softplus, sigmoid, normalise",
    params: "none",
    shape: "N x 17 float32",
    tflops: "negligible",
    basis: "measured",
    body: "Raw outputs become scales, opacities and unit quaternions, the object is turned from z-up to y-up, and the standard 3DGS PLY (17 float32 properties, 68 bytes per splat) is written.",
  },
]

const TONE: Record<Stage["basis"], string> = {
  measured: "oklch(0.62 0.14 150)",
  reported: "oklch(0.60 0.15 255)",
  reasoned: "oklch(0.66 0.13 70)",
}

export function Pipeline() {
  const [sel, setSel] = useState(2)
  const s = STAGES[sel]
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one request, six stages</span>
        <span className="font-mono text-[10px] text-muted-foreground">tap a stage</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {STAGES.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-2 text-left transition-colors",
                i === sel ? "border-foreground/30 bg-muted/40" : "border-border hover:bg-muted/20",
              )}
            >
              <div className="font-mono text-[10px] text-muted-foreground">{i + 1}</div>
              <div className="text-xs font-medium leading-tight">{x.label}</div>
              <div className="mt-0.5 text-[10px] leading-tight text-muted-foreground">{x.sub}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 rounded-lg border bg-background/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-sm font-semibold">{s.label}</h4>
            <span
              className="rounded px-1.5 py-0.5 font-mono text-[10px]"
              style={{ color: TONE[s.basis], border: `1px solid ${TONE[s.basis]}` }}
            >
              {s.basis}
            </span>
          </div>
          <dl className="mt-2 grid gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">parameters</dt>
              <dd>{s.params}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">tensor</dt>
              <dd>{s.shape}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">TFLOPs</dt>
              <dd>{s.tflops}</dd>
            </div>
          </dl>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{s.body}</p>
        </div>
      </div>
    </figure>
  )
}
