"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One training iteration of fused-zipnerf, as the code runs it (Trainer.training_iteration, Renderer.render_rays_training,
// Trainer.compute_gradients). Every stage names the file that holds it. Byte counts per sample are read from the kernels'
// output pointers; the shapes come from zipnerf_garden.yaml (64 / 64 / 32 samples per ray; grids of 6, 8 and 10 levels;
// 1, 1 and 4 features per level). READ from source, not profiled: no GPU was available to time any stage.

type Kind = "rtc" | "kernel" | "gemm" | "optim"

const KIND_COLOR: Record<Kind, string> = {
  rtc: "oklch(0.62 0.16 285)",
  kernel: "oklch(0.62 0.15 150)",
  gemm: "oklch(0.64 0.16 60)",
  optim: "oklch(0.60 0.15 20)",
}
const KIND_LABEL: Record<Kind, string> = {
  rtc: "runtime-compiled (NVRTC), shapes baked in",
  kernel: "ahead-of-time CUDA kernel",
  gemm: "cuBLASLt GEMM chain, fused epilogues",
  optim: "single-launch optimizer",
}

type Stage = {
  id: string
  short: string
  kind: Kind
  dir: "fwd" | "bwd"
  where: string
  fuses: string
  writes: string
  note: string
}

const STAGES: Stage[] = [
  {
    id: "rays",
    short: "rays",
    kind: "kernel",
    dir: "fwd",
    where: "sampling/src/sampling_api.cu  generate_rays_kernel",
    fuses: "Random pixel choice, ray generation, the first 64 jittered intervals and the direction encoding, in one kernel. The pixels of every training view already sit on the GPU as uint8.",
    writes: "origins, directions, radii, target rgb, encoded directions, sdist and tdist of level 0",
    note: "Every random number is a hash of (seed, stream, index) in random.cuh, so no kernel stores one and the backward regenerates the same values instead of reading them back.",
  },
  {
    id: "p0",
    short: "proposal 0",
    kind: "rtc",
    dir: "fwd",
    where: "featurization/rtc/featurize_forward.cu, grid 0: 6 levels x 1 feature",
    fuses: "Six-point multisampling of each conical frustum, scene contraction, the corner lookups of 6 levels, the per-level downweight, the average over the six points, and the 12 -> 64 -> 1 density MLP. One thread per interval.",
    writes: "raw_density (4 B) and, in training, the 12 fp32 features (48 B) kept for the backward. Inference writes only the 4 B.",
    note: "The MLP weights (64 x 12 + 64 + 64 + 1 = 897 floats) are copied into shared memory once per block. The kernel's own comment says it is bound by L2 requests.",
  },
  {
    id: "r1",
    short: "resample",
    kind: "kernel",
    dir: "fwd",
    where: "sampling_api.cu  composite_and_resample_kernel",
    fuses: "Density activation, compositing into 64 weights, annealed resampling into the next level's 64 intervals, and the conversion back to metric distance. One thread per ray.",
    writes: "weights, sdist and tdist of the next level",
    note: "The anneal is Schlick's bias of iteration / 25,000 with slope 10, so proposal weights are sharpened as training goes on.",
  },
  {
    id: "p1",
    short: "proposal 1",
    kind: "rtc",
    dir: "fwd",
    where: "featurize_forward.cu, grid 1: 8 levels x 1 feature",
    fuses: "The same kernel compiled with 8 levels baked in: 16 features -> 64 -> 1.",
    writes: "raw_density (4 B) and 16 fp32 features (64 B) in training",
    note: "A second compile of the same source with different #define constants. The cache key hashes the source text and the compiler options.",
  },
  {
    id: "r2",
    short: "resample",
    kind: "kernel",
    dir: "fwd",
    where: "composite_and_resample_kernel",
    fuses: "As above, ending with the 32 intervals of the final level.",
    writes: "weights, sdist and tdist of the final level",
    note: "Three levels, three different interval counts: 64, 64, 32 per ray. At 65,536 rays that is 10,485,760 intervals per iteration.",
  },
  {
    id: "nf",
    short: "NeRF features",
    kind: "rtc",
    dir: "fwd",
    where: "featurize_forward.cu, grid 2: 10 levels x 4 features, MLP width 0",
    fuses: "The same lookup for 10 levels, with no MLP. It writes straight into the buffers the first GEMM reads, including the encoded view direction and the bias lane.",
    writes: "fp16 features (56 columns, 112 B) plus the direction block (64 B) into the GEMM input rows",
    note: "The 50 output features are padded to 56 so GEMM operands stay aligned.",
  },
  {
    id: "mlp",
    short: "NeRF MLP",
    kind: "gemm",
    dir: "fwd",
    where: "mlp/src/nerf_mlp.cu  NerfMlp::forward",
    fuses: "Six fp16 GEMMs (density, combined, skip, two view layers, rgb) with bias and ReLU applied in the epilogue. The 256-wide bottleneck only feeds linear maps, so it is folded into the weights of the layers that read it.",
    writes: "8 fp16 outputs per sample (raw density, three rgb logits, padding); ReLU bitmasks in training",
    note: "The 227,556 MLP parameters are repacked to fp16 on every iteration (pack_kernel) and the best cuBLASLt algorithm is chosen by timing candidates once per problem shape.",
  },
  {
    id: "loss",
    short: "final + losses",
    kind: "kernel",
    dir: "fwd",
    where: "sampling_api.cu  train_final_kernel",
    fuses: "Compositing of the final level, the Charbonnier colour loss, the distortion loss, both interlevel losses against the blurred final weights, and every gradient they produce, in one thread per ray.",
    writes: "gradients of the final raw outputs, gradients of the two proposals' raw densities, four warp-reduced loss sums",
    note: "This is where forward turns into backward: the kernel returns gradients, not a loss tensor to differentiate.",
  },
  {
    id: "mlpb",
    short: "MLP backward",
    kind: "gemm",
    dir: "bwd",
    where: "nerf_mlp.cu  NerfMlp::backward",
    fuses: "Epilogues apply dReLU and reduce bias gradients; weight gradients are fp32. The fp16 output gradient carries a static loss scale of 1024.",
    writes: "fp16 feature gradient (to the featurizer), fp32 parameter gradients",
    note: "Analytic gradients throughout: there is no autograd graph.",
  },
  {
    id: "fb",
    short: "grid scatter",
    kind: "rtc",
    dir: "bwd",
    where: "featurization/rtc/featurize_backward.cu",
    fuses: "Recomputes the multisample positions and corner weights instead of reading stored ones, then scatters the feature gradient into the grid gradient.",
    writes: "atomic adds into the 59.9 M-parameter NeRF grid gradient (vector red.global.add.v4.f32 on sm_90 and newer)",
    note: "Recomputation trades a few hundred flops per interval for not storing 48 corner weights and rows per level.",
  },
  {
    id: "pb",
    short: "proposal backward",
    kind: "rtc",
    dir: "bwd",
    where: "featurize_backward_mlp.cu (run for both proposal levels)",
    fuses: "Recomputes the fused MLP from the stored fp32 features, scatters its input gradient into the grid, and reduces the MLP parameter gradients per block in shared memory before one atomic add per block.",
    writes: "grid gradients and the 897 / 1,153 MLP parameter gradients",
    note: "The only place the stored fp32 proposal features are read back.",
  },
  {
    id: "adam",
    short: "Adam",
    kind: "optim",
    dir: "bwd",
    where: "optimizer/src/optimizer_api.cu  adam_step_kernel",
    fuses: "One launch over every buffer: unscale, nan_to_num, the Adam update, the grid regulariser, and the per-level scale-feature magnitudes. Gradients are zeroed in the same pass.",
    writes: "parameters, moments, the per-level magnitudes the next iteration's featurizers read",
    note: "77.5 M parameters, so one pass over about 0.31 GB of fp32 weights plus the moments and gradients.",
  },
]

export function PipelineMap() {
  const [sel, setSel] = useState("p0")
  const stage = STAGES.find((s) => s.id === sel) ?? STAGES[0]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one training iteration · read from the source, not profiled
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 border-b px-4 py-2">
        {(Object.keys(KIND_COLOR) as Kind[]).map((k) => (
          <span key={k} className="flex items-center gap-1.5 font-mono text-[11px] text-muted-foreground">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: KIND_COLOR[k] }} aria-hidden />
            {KIND_LABEL[k]}
          </span>
        ))}
      </div>
      <ol className="flex flex-wrap items-stretch gap-1.5 px-4 py-3" aria-label="Stages of one training iteration">
        {STAGES.map((s, i) => (
          <li key={s.id} className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setSel(s.id)}
              aria-pressed={sel === s.id}
              className={cn(
                "rounded border px-2 py-1 text-left font-mono text-[11px] leading-tight transition-colors",
                sel === s.id ? "border-foreground/50 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
              )}
              style={{ borderLeft: `4px solid ${KIND_COLOR[s.kind]}` }}
            >
              <span className="block text-[9px] uppercase tracking-wide opacity-70">
                {i + 1} · {s.dir === "fwd" ? "forward" : "backward"}
              </span>
              {s.short}
            </button>
            {i < STAGES.length - 1 && (
              <span className="font-mono text-xs text-muted-foreground" aria-hidden>
                →
              </span>
            )}
          </li>
        ))}
      </ol>
      <div className="space-y-2 border-t px-4 py-3 text-sm" aria-live="polite">
        <div className="font-mono text-[11px] text-muted-foreground">{stage.where}</div>
        <p>
          <span className="font-semibold">What it fuses. </span>
          {stage.fuses}
        </p>
        <p>
          <span className="font-semibold">What it writes. </span>
          {stage.writes}
        </p>
        <p className="text-muted-foreground">{stage.note}</p>
      </div>
    </figure>
  )
}
