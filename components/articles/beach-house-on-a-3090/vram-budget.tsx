"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What has to sit in a 24 GB RTX 3090's memory to run each model we tried,
// component by component, at each precision and residency policy.
//
// Parameter counts are ours, summed from the safetensors headers on the
// Hugging Face Hub (HTTP range reads of every shard, 2026-11-12 and 2026-11-13):
//   black-forest-labs/FLUX.2-klein-4B          DiT 3,875,544,576  Qwen3-4B 4,022,468,096  VAE 84,046,371
//   Tongyi-MAI/Z-Image-Turbo                   DiT 6,154,908,736  Qwen3-4B 4,022,468,096  VAE 83,819,683
//   Qwen/Qwen-Image-2.1                        DiT 7,115,124,736  Qwen3-VL-8B 8,767,123,696  VAE 337,740,404
//   kandinskylab/Kandinsky-6.0-Lite-distill-5s DiT 3,177,988,112  Qwen2.5-VL-7B 8,292,166,656 + CLIP 123,060,480
//                                              video VAE 246,478,803 + audio VAE 427,768,554 + vocoder 122,155,368
//   kandinskylab/Kandinsky-6.0-Pro-distill-5s  DiT 30,139,423,760, the same encoders and decoders as Lite
// Bytes per parameter: BF16 2, FP8/INT8 1, NF4 about 0.516 (4 bits plus
// double-quantised block scales). Weights only: the "measured" line is our own
// torch.cuda.max_memory_allocated() on the RTX 3090 for the configuration
// we actually ran (see MEASURED), so the gap between the bar and the line is
// activations, the VAE decode and allocator slack, not a model.
//
// Plain +, -, *, / and toFixed only.

type Part = { key: "te" | "dit" | "vae"; label: string; params: number }
type Model = { id: string; label: string; parts: Part[]; tokens: string }

const MODELS: Model[] = [
  {
    id: "klein",
    label: "FLUX.2 klein 4B",
    tokens: "4,096 image tokens at 1024²",
    parts: [
      { key: "te", label: "Qwen3-4B", params: 4_022_468_096 },
      { key: "dit", label: "DiT", params: 3_875_544_576 },
      { key: "vae", label: "VAE", params: 84_046_371 },
    ],
  },
  {
    id: "zimage",
    label: "Z-Image-Turbo",
    tokens: "4,096 image tokens at 1024²",
    parts: [
      { key: "te", label: "Qwen3-4B", params: 4_022_468_096 },
      { key: "dit", label: "DiT", params: 6_154_908_736 },
      { key: "vae", label: "VAE", params: 83_819_683 },
    ],
  },
  {
    id: "qwen",
    label: "Qwen-Image-2.1",
    tokens: "4,096 image tokens at 1024²",
    parts: [
      { key: "te", label: "Qwen3-VL-8B", params: 8_767_123_696 },
      { key: "dit", label: "DiT", params: 7_115_124_736 },
      { key: "vae", label: "VAE", params: 337_740_404 },
    ],
  },
  {
    id: "kandinsky",
    label: "Kandinsky 6 Lite distill",
    tokens: "50,220 video tokens for 121 frames at 864 × 480",
    parts: [
      { key: "te", label: "Qwen2.5-VL-7B + CLIP", params: 8_292_166_656 + 123_060_480 },
      { key: "dit", label: "DiT", params: 3_177_988_112 },
      { key: "vae", label: "VAEs + vocoder", params: 246_478_803 + 427_768_554 + 122_155_368 },
    ],
  },
  {
    id: "kandinsky-pro",
    label: "Kandinsky 6 Pro distill",
    tokens: "50,220 video tokens for 121 frames at 864 × 480",
    parts: [
      { key: "te", label: "Qwen2.5-VL-7B + CLIP", params: 8_292_166_656 + 123_060_480 },
      { key: "dit", label: "DiT", params: 30_139_423_760 },
      { key: "vae", label: "VAEs + vocoder", params: 246_478_803 + 427_768_554 + 122_155_368 },
    ],
  },
]

const PREC = [
  { id: "bf16", label: "BF16", bpp: 2 },
  { id: "fp8", label: "FP8 / INT8 (1 byte)", bpp: 1 },
  { id: "nf4", label: "NF4", bpp: 0.516 },
] as const
type PrecId = (typeof PREC)[number]["id"]

// Our runs. Peak allocated GiB, whole call, per model and policy; filled from runs.jsonl.
const MEASURED: Record<string, { policy: Policy; te: PrecId; dit: PrecId; gib: number; note: string }[]> = {
  klein: [
    { policy: "resident", te: "bf16", dit: "bf16", gib: 17.26, note: "resident, 1024 x 1024, 4 steps" },
    { policy: "resident", te: "bf16", dit: "fp8", gib: 13.67, note: "resident, DiT stored FP8 and computed in BF16" },
    { policy: "stage", te: "bf16", dit: "bf16", gib: 7.8, note: "diffusers model offload, 1024 x 1024" },
  ],
  zimage: [
    { policy: "resident", te: "bf16", dit: "bf16", gib: 21.5, note: "resident, 1024 x 1024, 9 steps" },
    { policy: "stage", te: "bf16", dit: "bf16", gib: 11.95, note: "diffusers model offload, 1024 x 1024" },
  ],
  qwen: [{ policy: "stage", te: "bf16", dit: "bf16", gib: 16.43, note: "diffusers model offload, 1024 x 1024, 40 steps; the peak is the encoder's stage" }],
  kandinsky: [{ policy: "stage", te: "bf16", dit: "bf16", gib: 23.16, note: "module offload, 121 frames; nvidia-smi for the whole board, not allocated" }],
  "kandinsky-pro": [],
}

type Policy = "resident" | "stage"

const COLORS = { te: "#3ad1ff", dit: "#b48cff", vae: "#7cf29a" }
const CARD_GIB = 24_576 / 1024 // nvidia-smi total on the RTX 3090, MiB
const GIB = 1024 * 1024 * 1024

const gib = (b: number) => (b / GIB).toFixed(2)

function Seg<T extends string>({ label, opts, value, onChange }: { label: string; opts: readonly { id: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-1">
      <span className="w-28 shrink-0 text-muted-foreground">{label}</span>
      {opts.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          aria-pressed={o.id === value}
          className={cn("rounded border px-2 py-0.5", o.id === value ? "bg-foreground text-background" : "hover:bg-muted")}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function VramBudget() {
  const [mid, setMid] = useState("qwen")
  const [te, setTe] = useState<PrecId>("bf16")
  const [dit, setDit] = useState<PrecId>("bf16")
  const [policy, setPolicy] = useState<Policy>("stage")

  const m = MODELS.find((x) => x.id === mid) ?? MODELS[0]
  const bpp = (k: Part["key"]) => (k === "te" ? PREC.find((p) => p.id === te)!.bpp : k === "dit" ? PREC.find((p) => p.id === dit)!.bpp : 2)
  const bytes = m.parts.map((p) => ({ ...p, b: p.params * bpp(p.key) }))
  const total = bytes.reduce((s, x) => s + x.b, 0)
  // One stage at a time: the text encoder runs alone, then the DiT runs with
  // the VAE waiting beside it for the decode.
  const stages = [
    { id: "encode", label: "encode the prompt", parts: bytes.filter((x) => x.key === "te") },
    { id: "sample", label: "denoise + decode", parts: bytes.filter((x) => x.key !== "te") },
  ]
  const stageSum = stages.map((s) => s.parts.reduce((a, x) => a + x.b, 0))
  const peak = policy === "stage" ? Math.max(...stageSum) : total
  const card = CARD_GIB * GIB
  const scale = Math.max(total, card) * 1.04
  const fits = peak <= card
  const runs = (MEASURED[m.id] ?? []).filter((r) => r.policy === policy && r.te === te && r.dit === dit)

  const bar = (parts: typeof bytes, key: string, label: string, dim = false) => (
    <div key={key} className="flex items-center gap-2">
      <span className="w-36 shrink-0 text-muted-foreground">{label}</span>
      <div className="relative h-5 flex-1 rounded bg-muted">
        <div className="flex h-full" style={{ opacity: dim ? 0.45 : 1 }}>
          {parts.map((x) => (
            <div
              key={x.key}
              className="h-full first:rounded-l last:rounded-r"
              style={{ width: `${((x.b * 100) / scale).toFixed(2)}%`, background: COLORS[x.key] }}
              title={`${x.label} ${gib(x.b)} GiB`}
            />
          ))}
        </div>
        <div className="absolute top-[-3px] bottom-[-3px] w-0.5 bg-red-500" style={{ left: `${((card * 100) / scale).toFixed(2)}%` }} />
        {runs.map((r, i) => (
          <div
            key={i}
            className="absolute top-[-5px] bottom-[-5px] w-0.5 bg-amber-500"
            style={{ left: `${((r.gib * GIB * 100) / scale).toFixed(2)}%` }}
            title={`measured ${r.gib.toFixed(2)} GiB`}
          />
        ))}
      </div>
      <span className="w-20 shrink-0 text-right tabular-nums">{gib(parts.reduce((s, x) => s + x.b, 0))} GiB</span>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border" aria-label="Weight memory per component against a 24 GB RTX 3090, by precision and residency">
      <div className="space-y-2 border-b px-4 py-3 font-mono text-xs">
        <Seg label="model" opts={MODELS.map((x) => ({ id: x.id, label: x.label }))} value={mid} onChange={setMid} />
        <Seg label="text encoder" opts={PREC} value={te} onChange={setTe} />
        <Seg label="DiT" opts={PREC} value={dit} onChange={setDit} />
        <Seg
          label="residency"
          opts={[
            { id: "resident" as Policy, label: "all resident" },
            { id: "stage" as Policy, label: "one stage at a time" },
          ]}
          value={policy}
          onChange={setPolicy}
        />
      </div>
      <div className="space-y-2 px-4 py-3 font-mono text-xs">
        {policy === "stage" ? stages.map((s, i) => bar(s.parts, s.id, s.label, stageSum[i] !== peak)) : bar(bytes, "all", "everything")}
        <div className="flex flex-wrap gap-3 pt-1 text-[11px] text-muted-foreground">
          {m.parts.map((p) => (
            <span key={p.key} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: COLORS[p.key] }} />
              {p.label}
            </span>
          ))}
          <span className="flex items-center gap-1">
            <span className="inline-block h-2.5 w-0.5 bg-red-500" /> the card, {CARD_GIB.toFixed(2)} GiB
          </span>
          {runs.length > 0 && (
            <span className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-0.5 bg-amber-500" /> our measured peak
            </span>
          )}
        </div>
      </div>
      <div className="border-t px-4 py-3 text-sm">
        <p>
          Peak weights: <strong className="tabular-nums">{gib(peak)} GiB</strong>{" "}
          {policy === "stage" ? "(the larger stage)" : "(every component at once)"}.{" "}
          {fits ? (
            <span className="text-emerald-600 dark:text-emerald-400">{gib(card - peak)} GiB left for the CUDA context, activations and the decode.</span>
          ) : (
            <span className="text-red-600 dark:text-red-400">Over the card by {gib(peak - card)} GiB before a single activation.</span>
          )}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          {m.tokens}.{" "}
          {runs.length > 0
            ? runs.map((r) => `Measured: ${r.gib.toFixed(2)} GiB peak allocated (${r.note}).`).join(" ")
            : "No run of ours at exactly this setting; the line appears where we measured one."}
        </p>
      </div>
    </figure>
  )
}
