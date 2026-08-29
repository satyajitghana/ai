"use client"

import { Fragment, useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Built directly from FastVideo's source, not from the announcement -- this
// diagram exists because "up to 14x on NVIDIA Blackwell GPU" undersells how
// specific the actual dispatch is. Scope: the tile-64 VSA-H3 forward, the
// geometry FastH3 is trained on and ships with
// (checkpoint_metadata.json's tile_size, read in the main text).
//
// The two hand-written CUDA kernels are genuinely different source, not one
// kernel recompiled per architecture:
//   - fastvideo-kernel/csrc/attention/block_sparse_h100.cu -- ThunderKittens,
//     Hopper wgmma + TMA, guarded to compile only under __CUDA_ARCH_FEAT_SM90_ALL.
//   - fastvideo-kernel/csrc/attention/block_sparse_sm100a.cu +
//     block_sparse_kernel_sm100a.cuh -- tcgen05.mma warp-specialized kernel,
//     TMA tensor maps, cluster-launch-control scheduling. CMakeLists.txt is
//     explicit about why: "-arch=sm_100a is NOT enough -- it emits a plain
//     sm_100 target and ptxas rejects every tcgen05 / setmaxnreg instruction."
//
// Build-time gating (fastvideo-kernel/CMakeLists.txt):
//   - ENABLE_TK_KERNELS: AUTO, on only when TORCH_CUDA_ARCH_LIST/live GPU
//     matches 9.0a/90a/sm_90a. Else: "ThunderKittens kernels: DISABLED
//     (will use Triton fallbacks at runtime)" -- the project's own words.
//   - ENABLE_VSA_SM100A: on only when the arch list matches
//     10.0a/100a/sm_100a explicitly; builds block_sparse_sm100a.cu +
//     block_sparse_blk128_sm100a.cu (64- and 128-token blocks).
//
// Runtime dispatch:
//   - fastvideo_kernel/block_sparse_attn.py's block_sparse_attn_from_indices:
//     default (no env vars) is "use the compiled Hopper TK op if the device
//     reports sm_90 capability, else Triton." There is no equivalent
//     automatic branch for sm_100a in this generic dispatcher.
//   - fastvideo/attention/backends/video_sparse_attn_h3.py: the sm_100a
//     forward is reached ONLY via the explicit opt-in
//     FASTVIDEO_VSA_SM100A=1, and only for the no-grad (inference) forward --
//     "Grad-tracking forwards and every backward stay on Triton unchanged,"
//     in the module's own words, because the sm_100a kernel returns no
//     gradient path at all.
//
// FastVideo's own reproduction script defaults this switch ON:
// examples/inference/basic/basic_fasth3.py's --vsa-kernel flag defaults to
// "sm100a", and profile_environment() sets FASTVIDEO_VSA_SM100A="1"
// accordingly for the "all" profile documented as the fastest measured
// four-GPU recipe -- so the benchmarked path below is a script default, not
// something that happens automatically from having a Blackwell GPU.

type PassKind = "train" | "infer"
type Kernel = "hopper" | "blackwell" | "triton"

type Row = {
  key: string
  label: string
  sub: string
  train: Kernel
  infer: Kernel
  note: { train: string; infer: string }
}

const ROWS: Row[] = [
  {
    key: "hopper",
    label: "Hopper build",
    sub: "sm_90a in TORCH_CUDA_ARCH_LIST",
    train: "hopper",
    infer: "hopper",
    note: {
      train:
        "block_sparse_attn_sm90 is a real autograd op (fwd + bwd) -- the generic dispatcher prefers it whenever the compiled extension has it and the device reports sm_90.",
      infer: "Same op, no-grad call. No env var needed: this is the dispatcher's unconditional default on sm_90 hardware.",
    },
  },
  {
    key: "bw-off",
    label: "Blackwell build",
    sub: "FASTVIDEO_VSA_SM100A unset (default)",
    train: "triton",
    infer: "triton",
    note: {
      train: "No sm_90 op exists in a Blackwell-only build (Hopper kernels are compiled out entirely), so the dispatcher's only path is Triton.",
      infer: "Same default path -- the sm_100a kernel is opt-in only, so an unset env var means Triton runs even on Blackwell hardware.",
    },
  },
  {
    key: "bw-on",
    label: "Blackwell build",
    sub: "FASTVIDEO_VSA_SM100A=1",
    train: "triton",
    infer: "blackwell",
    note: {
      train: "The sm_100a kernel has no backward pass at all -- every gradient-tracking call stays on Triton regardless of this switch.",
      infer: "This is the one cell the switch actually changes: the no-grad forward now runs the hand-written tcgen05 kernel instead of Triton.",
    },
  },
  {
    key: "other",
    label: "Other GPU",
    sub: "e.g. A100, RTX 4090, or no matching build",
    train: "triton",
    infer: "triton",
    note: {
      train: "Neither hand-written kernel targets this architecture, so Triton is the only op the dispatcher can select.",
      infer: "Same reasoning as training -- there is no sm_90 or sm_100a match to prefer over Triton here.",
    },
  },
]

const HOPPER = "oklch(0.60 0.15 255)"
const BLACKWELL = "oklch(0.55 0.16 155)"
const TRITON = "oklch(0.62 0.03 250)"

const KERNEL_META: Record<Kernel, { label: string; color: string }> = {
  hopper: { label: "Hopper CUDA (ThunderKittens)", color: HOPPER },
  blackwell: { label: "Blackwell CUDA (tcgen05)", color: BLACKWELL },
  triton: { label: "Triton", color: TRITON },
}

export function KernelRouting() {
  const [pass, setPass] = useState<PassKind>("infer")
  const [rowIdx, setRowIdx] = useState(2) // default: the opt-in Blackwell row, inference column

  const row = ROWS[rowIdx]
  const activeKernel = row[pass]
  const note = row.note[pass]

  const cells = useMemo(
    () =>
      ROWS.map((r, i) => ({
        r,
        i,
        train: KERNEL_META[r.train],
        infer: KERNEL_META[r.infer],
      })),
    [],
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">tile-64 VSA-H3 forward, kernel dispatch by build and grad mode</span>
        <div className="flex gap-1.5">
          {(
            [
              ["train", "Training (fwd+bwd)"],
              ["infer", "Inference (fwd only)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setPass(k)}
              aria-pressed={pass === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                pass === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <div className="min-w-[520px]">
            <div className="grid grid-cols-[1.6fr_1fr_1fr] gap-px overflow-hidden rounded-lg border bg-border text-[10.5px]">
              <div className="bg-muted/30 px-2.5 py-2 font-mono text-muted-foreground">build / switch</div>
              <div
                className={cn(
                  "px-2.5 py-2 text-center font-mono transition-colors",
                  pass === "train" ? "bg-muted/50 text-foreground" : "bg-muted/30 text-muted-foreground",
                )}
              >
                training
              </div>
              <div
                className={cn(
                  "px-2.5 py-2 text-center font-mono transition-colors",
                  pass === "infer" ? "bg-muted/50 text-foreground" : "bg-muted/30 text-muted-foreground",
                )}
              >
                inference
              </div>

              {cells.map(({ r, i, train, infer }) => (
                <Fragment key={r.key}>
                  <button
                    type="button"
                    onClick={() => setRowIdx(i)}
                    aria-pressed={rowIdx === i}
                    className={cn(
                      "cursor-pointer bg-background px-2.5 py-2 text-left transition-colors hover:bg-muted/20",
                      rowIdx === i && "bg-muted/20",
                    )}
                  >
                    <div className="font-mono text-foreground">{r.label}</div>
                    <div className="font-mono text-[9px] text-muted-foreground">{r.sub}</div>
                  </button>
                  <div
                    className={cn(
                      "flex items-center justify-center bg-background px-1.5 py-2 text-center font-mono transition-colors",
                      rowIdx === i && pass === "train" && "ring-2 ring-inset",
                    )}
                    style={rowIdx === i && pass === "train" ? { boxShadow: `inset 0 0 0 2px ${train.color}` } : undefined}
                  >
                    <span style={{ color: train.color }}>{train.label}</span>
                  </div>
                  <div
                    className={cn(
                      "flex items-center justify-center bg-background px-1.5 py-2 text-center font-mono transition-colors",
                      rowIdx === i && pass === "infer" && "ring-2 ring-inset",
                    )}
                    style={rowIdx === i && pass === "infer" ? { boxShadow: `inset 0 0 0 2px ${infer.color}` } : undefined}
                  >
                    <span style={{ color: infer.color }}>{infer.label}</span>
                  </div>
                </Fragment>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <div className="mb-1 font-mono text-[10px]" style={{ color: KERNEL_META[activeKernel].color }}>
            {row.label} ({row.sub}) &middot; {pass === "train" ? "training" : "inference"} &rarr; {KERNEL_META[activeKernel].label}
          </div>
          <p className="text-[12.5px] leading-5 text-muted-foreground">{note}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Click a row and toggle the pass to see the one cell that actually moves: the{" "}
          <span style={{ color: BLACKWELL }}>Blackwell tcgen05 kernel</span> only appears for the opt-in row&rsquo;s
          inference column — everywhere else, and every training column regardless of hardware, resolves to{" "}
          <span style={{ color: TRITON }}>Triton</span> or the{" "}
          <span style={{ color: HOPPER }}>Hopper ThunderKittens kernel</span>. FastVideo&rsquo;s own reproduction
          script (<code>basic_fasth3.py</code>) sets <code>FASTVIDEO_VSA_SM100A=1</code> as part of its default
          profile — the switch that makes the announced Blackwell numbers reachable is a script default, not
          something a Blackwell GPU triggers on its own, and it never touches the DMD2 training run that produced
          the checkpoint in the first place.
        </p>
      </div>
    </figure>
  )
}
