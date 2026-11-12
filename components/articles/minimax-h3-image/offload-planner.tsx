"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A back-of-envelope planner for running MiniMax-H3-Image's transformer with
// per-block offload: every step, each of the 50 blocks is copied host -> GPU
// just before it runs. With one block of prefetch the copy of block i+1
// overlaps the compute of block i, so a step costs max(compute, transfer).
//
// Read from files:
//   checkpoint sizes   Comfy-Org/MiniMax-H3-Image (HF tree API, bytes):
//                      pruned W4A8 12,549,794,530; pruned INT8 20,979,314,802;
//                      pruned BF16 40,234,657,162. Original BF16 transformer
//                      66,279,032,256 (index.json total_size).
//                      Text encoders: INT8 27,141,342,152; NVFP4 15,687,142,551.
//   FLOPs per step     50 * (2N * 385,351,680 + 4N^2 * 7168), N = rows
//                      (see token-budget.tsx), prompt fixed at 512 tokens.
// Throughput presets are NVIDIA's dense BF16 tensor figures with FP32
// accumulate: RTX 3080 59.5 (GA102 whitepaper, Table 2), RTX 4090 165.2 (Ada
// whitepaper), H200 989 (half the 1,979 "with sparsity" on NVIDIA's H200 page).
// Inputs, not facts: the fraction of peak a pipeline reaches and host-link
// bandwidth (the H200 preset of 50 GB/s is an assumption). Lower bounds from
// measured runs: vLLM one H200 at 2048^2 >= ~390 TFLOPS (40%); SGLang one H200
// at 4736x3552 >= ~631 TFLOPS (64%). Default 40% is the pessimistic end.

const P_ROW = 385_351_680
const LAYERS = 50
const D_ATTN = 7168
const STEPS = 6
const TEXT = 512

type Ckpt = { key: string; label: string; bytes: number }
const CKPTS: Ckpt[] = [
  { key: "w4a8", label: "Comfy W4A8", bytes: 12_549_794_530 },
  { key: "int8", label: "Comfy INT8", bytes: 20_979_314_802 },
  { key: "bf16p", label: "Comfy BF16", bytes: 40_234_657_162 },
  { key: "bf16", label: "original BF16", bytes: 66_279_032_256 },
]
type Gpu = { key: string; label: string; vram: number; tflops: number; link: number }
const GPUS: Gpu[] = [
  { key: "3080", label: "RTX 3080 10 GB", vram: 10, tflops: 59.5, link: 25 },
  { key: "3080-12", label: "RTX 3080 12 GB", vram: 12, tflops: 59.5, link: 25 },
  { key: "4090", label: "RTX 4090", vram: 24, tflops: 165.2, link: 25 },
  { key: "h200", label: "H200", vram: 141, tflops: 989, link: 50 },
]
type Res = { key: string; label: string; rows: number }
const RES: Res[] = [
  { key: "4", label: "2048² (4 MP)", rows: 4096 },
  { key: "16", label: "4096² (16 MP)", rows: 16384 },
]

const ACCENT = "oklch(0.62 0.15 300)"
const COOL = "oklch(0.62 0.12 220)"
const HOT = "oklch(0.60 0.17 30)"

function Pills<T extends string>({
  label,
  options,
  value,
  onChange,
  fmt,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
  fmt: (v: T) => string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => onChange(o)}
          aria-pressed={value === o}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            value === o
              ? "border-foreground/30 bg-muted/50 text-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {fmt(o)}
        </button>
      ))}
    </div>
  )
}

function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  unit,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  unit: string
}) {
  return (
    <label className="flex items-center gap-3">
      <span className="w-20 shrink-0 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <Range min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} />
      <span className="w-24 shrink-0 text-right font-mono text-[11px]">
        {value} {unit}
      </span>
    </label>
  )
}

function fmtTime(s: number): string {
  if (s < 90) return `${s.toFixed(s < 10 ? 1 : 0)} s`
  return `${(s / 60).toFixed(1)} min`
}

export function OffloadPlanner() {
  const [gpuKey, setGpuKey] = useState("3080")
  const [ckptKey, setCkptKey] = useState("w4a8")
  const [resKey, setResKey] = useState("16")
  const [eff, setEff] = useState(40)
  const [link, setLink] = useState(25)
  const [ram, setRam] = useState(32)

  const gpu = GPUS.find((g) => g.key === gpuKey) ?? GPUS[0]
  const ckpt = CKPTS.find((c) => c.key === ckptKey) ?? CKPTS[0]
  const res = RES.find((r) => r.key === resKey) ?? RES[1]

  const n = res.rows + TEXT
  const flops = LAYERS * (2 * n * P_ROW + 4 * n * n * D_ATTN)
  const computeS = flops / (gpu.tflops * 1e12 * (eff / 100))
  const ckptGB = ckpt.bytes / 1e9
  const transferS = ckptGB / link
  const stepS = Math.max(computeS, transferS)
  const imageS = STEPS * stepS
  const serialS = STEPS * (computeS + transferS)

  // Rough VRAM need while streaming: two block buffers plus the largest
  // transient activations of one block (qkv, fc1 output, its gated half and a
  // few hidden-size tensors), in BF16. Not measured; an order of magnitude.
  const blockGB = ckptGB / LAYERS
  const actGB = (n * (21504 + 28672 + 14336 + 3 * 5376) * 2) / 1e9
  const vramNeed = 2 * blockGB + actGB + 1.5
  const fitsWhole = ckptGB + actGB + 1.5 <= gpu.vram
  const ramOk = ram >= ckptGB + 4

  const share = transferS / (computeS + transferS)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          {gpu.label} · {ckpt.label} · {res.label}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">reasoned estimate, transformer only</span>
      </div>

      <div className="space-y-2 p-3 sm:p-4">
        <Pills
          label="GPU"
          options={GPUS.map((g) => g.key)}
          value={gpuKey}
          onChange={(k) => {
            setGpuKey(k)
            const g = GPUS.find((x) => x.key === k)
            if (g) setLink(g.link)
          }}
          fmt={(k) => GPUS.find((g) => g.key === k)?.label ?? k}
        />
        <Pills label="weights" options={CKPTS.map((c) => c.key)} value={ckptKey} onChange={setCkptKey} fmt={(k) => CKPTS.find((c) => c.key === k)?.label ?? k} />
        <Pills label="canvas" options={RES.map((r) => r.key)} value={resKey} onChange={setResKey} fmt={(k) => RES.find((r) => r.key === k)?.label ?? k} />
        <Slider label="efficiency" min={15} max={70} step={5} value={eff} onChange={setEff} unit="% of peak" />
        <Slider label="host link" min={6} max={60} step={1} value={link} onChange={setLink} unit="GB/s" />
        <Slider label="system RAM" min={16} max={128} step={16} value={ram} onChange={setRam} unit="GB" />

        <div className="pt-3">
          <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
            <span>one step, if copies did not overlap compute</span>
            <span>copying is {(share * 100).toFixed(share < 0.1 ? 1 : 0)}% of it</span>
          </div>
          <div className="flex h-5 w-full overflow-hidden rounded-md border bg-muted/20">
            <div title="compute" style={{ width: `${((1 - share) * 100).toFixed(2)}%`, background: ACCENT }} className="h-full" />
            <div title="weight copies" style={{ width: `${(share * 100).toFixed(2)}%`, background: COOL }} className="h-full" />
          </div>
          <div className="mt-1 font-mono text-[10px] text-muted-foreground">
            <span style={{ color: ACCENT }}>■</span> compute {fmtTime(computeS)}{" "}
            <span style={{ color: COOL }}>■</span> copy all 50 blocks {fmtTime(transferS)}
          </div>
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 border-t pt-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-[10px] text-muted-foreground">six steps, overlapped</dt>
            <dd>{fmtTime(imageS)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">six steps, no prefetch</dt>
            <dd>{fmtTime(serialS)}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">VRAM, my lower bound</dt>
            <dd style={{ color: vramNeed > gpu.vram ? HOT : undefined }}>
              ~{vramNeed.toFixed(1)} of {gpu.vram} GB
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted-foreground">weights in host RAM</dt>
            <dd style={{ color: ramOk ? undefined : HOT }}>
              {ckptGB.toFixed(1)} GB {ramOk ? "fits" : "spills to disk"}
            </dd>
          </div>
        </dl>
        <p className="text-xs text-muted-foreground">
          {fitsWhole
            ? "This checkpoint fits on the card whole, so nothing needs to stream."
            : vramNeed > gpu.vram
              ? "Even my lower bound does not fit here: a real runtime would have to chunk the feed-forward or the attention heads."
              : transferS > computeS
                ? "The link is the bottleneck here: the card waits on copies."
                : "Compute is the bottleneck: with prefetch the copies hide behind it, and offloading costs almost nothing."}{" "}
          The text encoder runs before this, once per image, and needs its own 27.1 GB (INT8) or 15.7 GB (NVFP4) of RAM.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Checkpoint sizes and FLOPs are read from the release. Throughput presets are NVIDIA&apos;s dense BF16
        figures; efficiency and link speed are your assumptions. Measured H200 runs reach at least 40 to 64%
        of peak; the link defaults to a practical PCIe 4.0 x16 copy rate. The VRAM figure is two blocks plus
        one block&apos;s largest activations, a floor: SGLang measured a 10.01 GiB peak for 16 MP with offload. Compute is charged at the
        BF16 rate for every checkpoint, since Ampere has no FP8 or FP4 tensor cores. Leaves out the text
        encoder, the VAE decode and every kernel detail. Nobody has published a 3080 timing to check it against.
      </figcaption>
    </figure>
  )
}
