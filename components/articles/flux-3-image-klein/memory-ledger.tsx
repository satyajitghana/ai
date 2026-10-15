"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What has to sit in GPU memory to run FLUX 3 Image Klein, component by
// component, against a card.
//
// Byte counts are the Hugging Face file sizes (API listing, 2026-10-15):
//   black-forest-labs/flux-3-image-klein @ 8454017
//     model.safetensors                 11,097,404,512  distilled DiT, BF16
//     variants/fp8r/model.safetensors    6,270,949,144
//     variants/nvfp4/model.safetensors   5,277,674,144
//     text_encoder/*  (2 shards)          8,875,719,344  Qwen3-VL-4B-Instruct, BF16
//     ae.safetensors                       336,211,292  autoencoder, FP32
//   black-forest-labs/flux-3-image-klein-comfy @ 3700a10
//     flux3_image_klein_sd_int8_convrot   5,827,874,779
//     qwen3vl_4b_int8_convrot             4,858,559,240
//     qwen3.5_9b_..._upsampler_int8       9,748,113,996
//   black-forest-labs/flux-3-image-klein-pup: 9,409,813,744 BF16 parameters
//     (Hub safetensors metadata), so 18,819,627,488 bytes.
//
// Weights only. Activations, the attention workspace, the CUDA context and
// the allocator's slack are not here; the "reported peak" line is the
// reference code's own nvidia-smi figure (B200, 1024 x 1024, no upsampler)
// so the gap between the two is visible, not modelled.
//
// Plain +, -, *, / and toFixed only.

type Opt = { key: string; label: string; bytes: number; note: string }

const DIT: Opt[] = [
  { key: "bf16", label: "BF16", bytes: 11_097_404_512, note: "root model.safetensors" },
  { key: "fp8", label: "FP8", bytes: 6_270_949_144, note: "variants/fp8r; Ada, Hopper, Blackwell" },
  { key: "nvfp4", label: "NVFP4", bytes: 5_277_674_144, note: "variants/nvfp4; Blackwell only" },
  { key: "int8", label: "INT8", bytes: 5_827_874_779, note: "ComfyUI file; any RTX" },
]
const TE: Opt[] = [
  { key: "bf16", label: "BF16", bytes: 8_875_719_344, note: "as shipped, all 36 layers + vision tower" },
  { key: "int8", label: "INT8", bytes: 4_858_559_240, note: "ComfyUI file" },
]
const PUP: Opt[] = [
  { key: "off", label: "off", bytes: 0, note: "--no-pup: write the full caption yourself" },
  { key: "int8", label: "INT8", bytes: 9_748_113_996, note: "ComfyUI file" },
  { key: "bf16", label: "BF16", bytes: 18_819_627_488, note: "flux-3-image-klein-pup, Qwen3.5-9B" },
]
const AE = 336_211_292

// reference README, Memory table, distilled --no-pup: GB per DiT precision
const PEAK: Record<string, number> = { bf16: 31, fp8: 26, nvfp4: 25 }

const CARDS = [8, 12, 16, 24, 32, 80]

const COLORS = { dit: "#b48cff", te: "#3ad1ff", ae: "#7cf29a", pup: "#ffc23a" }

const gb = (b: number) => (b / 1e9).toFixed(2)

function Pick({ opts, value, onChange, label }: { opts: Opt[]; value: string; onChange: (k: string) => void; label: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-28 text-muted-foreground">{label}</span>
      {opts.map((o) => (
        <button
          key={o.key}
          type="button"
          onClick={() => onChange(o.key)}
          className={cn("rounded border px-2 py-0.5", o.key === value ? "bg-foreground text-background" : "hover:bg-muted")}
          aria-pressed={o.key === value}
          title={o.note}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function MemoryLedger() {
  const [dit, setDit] = useState("int8")
  const [te, setTe] = useState("int8")
  const [pup, setPup] = useState("off")
  const [swap, setSwap] = useState(true)
  const [card, setCard] = useState(8)

  const d = DIT.find((o) => o.key === dit) ?? DIT[0]
  const t = TE.find((o) => o.key === te) ?? TE[0]
  const p = PUP.find((o) => o.key === pup) ?? PUP[0]

  // Stages run in order: upsampler -> text encoder -> DiT steps -> autoencoder decode.
  // Swapping keeps only the stage that is running; the autoencoder stays with the DiT
  // because it also encodes the reference images before sampling starts.
  const stages = [
    { key: "pup", label: "upsample", parts: p.bytes ? [{ k: "pup", b: p.bytes }] : [] },
    { key: "te", label: "encode text", parts: [{ k: "te", b: t.bytes }] },
    { key: "dit", label: "sample + decode", parts: [{ k: "dit", b: d.bytes }, { k: "ae", b: AE }] },
  ].filter((s) => s.parts.length > 0)

  const all = [
    ...(p.bytes ? [{ k: "pup", b: p.bytes }] : []),
    { k: "te", b: t.bytes },
    { k: "dit", b: d.bytes },
    { k: "ae", b: AE },
  ]
  const total = all.reduce((s, x) => s + x.b, 0)
  const stageSum = stages.map((s) => s.parts.reduce((a, x) => a + x.b, 0))
  const peak = swap ? Math.max(...stageSum) : total
  const budget = card * 1e9
  const scale = Math.max(total, budget, 1) * 1.05
  const fits = peak <= budget

  const refPeak = !swap && pup === "off" && te === "bf16" ? PEAK[dit] : undefined

  const bar = (parts: { k: string; b: number }[], key: string, label: string, dim = false) => (
    <div key={key} className="flex items-center gap-2">
      <span className="w-32 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 rounded bg-muted">
        <div className="flex h-full" style={{ opacity: dim ? 0.45 : 1 }}>
          {parts.map((x, i) => (
            <div
              key={i}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${((x.b * 100) / scale).toFixed(2)}%`, background: COLORS[x.k as keyof typeof COLORS] }}
              title={`${x.k} ${gb(x.b)} GB`}
            />
          ))}
        </div>
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-500" style={{ left: `${((budget * 100) / scale).toFixed(2)}%` }} />
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums">{gb(parts.reduce((s, x) => s + x.b, 0))} GB</span>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border" aria-label="FLUX 3 Image Klein weight memory by component and precision">
      <div className="space-y-2 border-b px-4 py-3 font-mono text-xs">
        <Pick label="DiT (distilled)" opts={DIT} value={dit} onChange={setDit} />
        <Pick label="text encoder" opts={TE} value={te} onChange={setTe} />
        <Pick label="prompt upsampler" opts={PUP} value={pup} onChange={setPup} />
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-28 text-muted-foreground">residency</span>
          <button type="button" onClick={() => setSwap(false)} className={cn("rounded border px-2 py-0.5", !swap ? "bg-foreground text-background" : "hover:bg-muted")} aria-pressed={!swap}>
            all resident
          </button>
          <button type="button" onClick={() => setSwap(true)} className={cn("rounded border px-2 py-0.5", swap ? "bg-foreground text-background" : "hover:bg-muted")} aria-pressed={swap}>
            one stage at a time
          </button>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-28 text-muted-foreground">card</span>
          {CARDS.map((c) => (
            <button key={c} type="button" onClick={() => setCard(c)} className={cn("rounded border px-2 py-0.5", c === card ? "bg-foreground text-background" : "hover:bg-muted")} aria-pressed={c === card}>
              {c} GB
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2 px-4 py-3 font-mono text-xs">
        {swap
          ? stages.map((s, i) => bar(s.parts, s.key, s.label, stageSum[i] !== peak))
          : bar(all, "all", "everything")}
        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
          {(["pup", "te", "dit", "ae"] as const).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[k] }} />
              {k === "pup" ? "upsampler" : k === "te" ? "Qwen3-VL-4B" : k === "dit" ? "DiT" : "autoencoder"}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-0.5 bg-red-500" /> {card} GB card
          </span>
        </div>
      </div>

      <div className="border-t px-4 py-3 text-sm">
        <p>
          Peak weights: <strong className="tabular-nums">{gb(peak)} GB</strong> {swap ? "(the largest stage)" : "(all components at once)"}.{" "}
          {fits ? (
            <span className="text-emerald-600 dark:text-emerald-400">
              Fits a {card} GB card with {gb(budget - peak)} GB left for activations and the runtime.
            </span>
          ) : (
            <span className="text-red-600 dark:text-red-400">
              Over a {card} GB card by {gb(peak - budget)} GB before a single activation.
            </span>
          )}
        </p>
        {refPeak !== undefined ? (
          <p className="mt-1 text-xs text-muted-foreground">
            The reference README reports {refPeak} GB peak for this configuration on a B200 at 1024 × 1024, so about{" "}
            {(refPeak - total / 1e9).toFixed(1)} GB of the real peak is not weights.
          </p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">
            Pick all resident, BF16 text encoder and no upsampler to compare with the peaks the reference README
            reports (31, 26 and 25 GB for BF16, FP8 and NVFP4).
          </p>
        )}
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        File sizes from the Hugging Face listings of the three repositories (measured); weights only. Activations
        are not modelled.
      </figcaption>
    </figure>
  )
}
