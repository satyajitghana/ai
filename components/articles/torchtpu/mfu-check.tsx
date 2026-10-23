"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Re-derive the MFU figures in "Introducing TorchTPU" from the model configs and
// the chip's peak, and show which FLOP-accounting choices they imply.
//
// Peak: 2,307e12 bf16 FLOP/s per TPU v7 chip (torch_tpu/_internal/utils/
// hardware.py, TpuSpec.V7; two TensorCores per chip).
// Muse Glimmer 30B: examples/muse_glimmer_30b/pure_pytorch_fsdp_trainloop/
//   model_fsdp.py Config: vocab 202048, 52 layers, d 6656, ff 19968, head 128,
//   32 q heads, 2 kv heads, an attention gate as wide as q, SwiGLU, sliding
//   window 2048 on three layers in four.
// Qwen3-235B-A22B: Hugging Face config.json: d 4096, 94 layers, 64 q heads, 4
//   kv heads, head 128, 128 experts, 8 active, expert ff 1536, vocab 151936.
// Training FLOPs = 3 x forward. Forward = 2 x matmul params + attention scores
//   and values (4 x heads x head_dim x context per layer).
// Arithmetic is +, -, *, / only.

const PEAK = 2307e12

const MG = { V: 202048, L: 52, D: 6656, F: 19968, dh: 128, H: 32, KV: 2, W: 2048 }
const MG_BODY = MG.L * (MG.D * MG.H * MG.dh * 2 + MG.D * MG.KV * MG.dh * 2 + MG.H * MG.dh * MG.D + 3 * MG.D * MG.F)
const MG_HEAD = MG.V * MG.D

const QW = { V: 151936, L: 94, D: 4096, H: 64, KV: 4, dh: 128, E: 128, K: 8, Fm: 1536 }
const QW_BODY = QW.L * (QW.D * QW.H * QW.dh * 2 + QW.D * QW.KV * QW.dh * 2 + QW.K * 3 * QW.D * QW.Fm + QW.D * QW.E)
const QW_HEAD = QW.V * QW.D

// average context a query attends to, per layer kind
function mgAttn(S: number, causal: boolean) {
  const full = MG.L / 4
  const swa = MG.L - full
  const fullCtx = causal ? (S + 1) / 2 : S
  const swaCtx = causal ? (MG.W * (MG.W + 1)) / 2 / S + ((S - MG.W) * MG.W) / S : MG.W
  return 4 * MG.H * MG.dh * (full * fullCtx + swa * swaCtx)
}
function qwAttn(S: number, causal: boolean) {
  return 4 * QW.H * QW.dh * QW.L * (causal ? S / 2 : S)
}

type Claim = {
  key: string
  label: string
  sub: string
  model: "mg" | "qw"
  train: boolean
  S: number
  tpsPerChip: number
  claimed: number
  source: string
}

const CLAIMS: Claim[] = [
  { key: "p5", label: "Muse Glimmer 30B prefill", sub: "1 chip · seq 5,120 · 25.7k tok/s", model: "mg", train: false, S: 5120, tpsPerChip: 25700, claimed: 59, source: "PyTorch blog" },
  { key: "p10", label: "Muse Glimmer 30B prefill", sub: "1 chip · seq 10,240 · 22.4k tok/s", model: "mg", train: false, S: 10240, tpsPerChip: 22400, claimed: 51, source: "PyTorch blog" },
  { key: "t5", label: "Muse Glimmer 30B training", sub: "4 chips · seq 5,120 · 5.6k tok/s/chip", model: "mg", train: true, S: 5120, tpsPerChip: 5600, claimed: 38, source: "PyTorch blog" },
  { key: "t10", label: "Muse Glimmer 30B training", sub: "4 chips · seq 10,240 · 4.6k tok/s/chip", model: "mg", train: true, S: 10240, tpsPerChip: 4600, claimed: 32, source: "PyTorch blog" },
  { key: "q1", label: "Qwen3 235B MoE training", sub: "1,024 chips · 2,236 tok/s per TensorCore", model: "qw", train: true, S: 4096, tpsPerChip: 4472, claimed: 28.8, source: "PyTorch blog" },
  { key: "q1t", label: "Qwen3 235B MoE training", sub: "same 1,024 chips, other post", model: "qw", train: true, S: 4096, tpsPerChip: 4472, claimed: 32.42, source: "TorchTitan blog" },
  { key: "q8", label: "Qwen3 235B MoE training", sub: "8,192 chips · 2,104 tok/s per TensorCore", model: "qw", train: true, S: 4096, tpsPerChip: 4208, claimed: 27.1, source: "PyTorch blog" },
  { key: "q8t", label: "Qwen3 235B MoE training", sub: "same 8,192 chips, other post", model: "qw", train: true, S: 4096, tpsPerChip: 4208, claimed: 30.51, source: "TorchTitan blog" },
]

const gf = (x: number) => `${(x / 1e9).toFixed(1)}`

export function MfuCheck() {
  const [key, setKey] = useState("q1")
  const [causal, setCausal] = useState(true)
  const [head, setHead] = useState(false)
  const c = CLAIMS.find((x) => x.key === key) ?? CLAIMS[0]

  const body = c.model === "mg" ? MG_BODY : QW_BODY
  const headP = c.model === "mg" ? MG_HEAD : QW_HEAD
  // Qwen3 unties its LM head and counts it; for Muse Glimmer it is a toggle
  const params = c.model === "qw" ? body + headP : body + (head ? headP : 0)
  const attn = c.model === "mg" ? mgAttn(c.S, causal) : qwAttn(c.S, causal)
  const mult = c.train ? 3 : 1
  const matmulF = mult * 2 * params
  const attnF = mult * attn
  const perToken = matmulF + attnF
  const mfu = ((c.tpsPerChip * perToken) / PEAK) * 100
  const gap = mfu - c.claimed
  const close = gap < 1 && gap > -1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">MFU = tokens/s per chip × FLOPs per token ÷ 2,307 TFLOP/s</span>
        <span className="font-mono text-[10px] text-muted-foreground">TPU v7 · bf16 peak</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-1.5 sm:grid-cols-2" role="group" aria-label="Published claim">
          {CLAIMS.map((x) => (
            <button
              key={x.key}
              type="button"
              onClick={() => setKey(x.key)}
              aria-pressed={key === x.key}
              className={cn(
                "rounded-sm border px-2 py-1 text-left font-mono text-[11px] leading-tight",
                key === x.key ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
              )}
            >
              {x.label}{" "}
              <span className="text-muted-foreground">· {x.claimed}%</span>
              <span className="block text-[9px] text-muted-foreground">
                {x.sub} · {x.source}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setCausal(!causal)}
            aria-pressed={causal}
            className={cn(
              "rounded-sm border px-2 py-0.5 font-mono text-[10px]",
              causal ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
            )}
          >
            causal mask halves attention: {causal ? "yes" : "no"}
          </button>
          <button
            type="button"
            onClick={() => setHead(!head)}
            aria-pressed={head}
            disabled={c.model === "qw"}
            className={cn(
              "rounded-sm border px-2 py-0.5 font-mono text-[10px] disabled:opacity-40",
              head ? "bg-foreground/[0.08]" : "hover:bg-foreground/[0.04]"
            )}
          >
            count the LM head: {c.model === "qw" ? "always" : head ? "yes" : "no"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {[
            { label: "computed from the configs", v: mfu, bar: "bg-sky-500/80 dark:bg-sky-400/80" },
            { label: `claimed (${c.source})`, v: c.claimed, bar: "bg-zinc-400/90 dark:bg-zinc-500/90" },
          ].map((r) => (
            <div key={r.label}>
              <div className="mb-0.5 flex justify-between font-mono text-[11px] tabular-nums">
                <span className="text-muted-foreground">{r.label}</span>
                <span>{r.v.toFixed(1)}%</span>
              </div>
              <div className="h-4 rounded-sm bg-foreground/[0.04]">
                <div className={cn("h-4 rounded-sm", r.bar)} style={{ width: `${Math.min(100, (r.v / 70) * 100).toFixed(2)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 grid gap-x-6 gap-y-1 rounded-md border bg-background/60 p-3 font-mono text-[11px] tabular-nums sm:grid-cols-2">
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">matmul params counted</span>
            <span>{gf(params)} B</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">{c.train ? "6" : "2"} × params, GFLOP/token</span>
            <span>{gf(matmulF)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">attention, GFLOP/token</span>
            <span>{gf(attnF)}</span>
          </div>
          <div className="flex justify-between gap-2">
            <span className="text-muted-foreground">computed − claimed</span>
            <span className={close ? "text-emerald-600 dark:text-emerald-400" : ""}>
              {gap >= 0 ? "+" : ""}
              {gap.toFixed(1)} points
            </span>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Throughputs and claimed MFU are reported. The FLOP counts are mine, from the configs. Flip the causal
          toggle on either Qwen3 pair. At 8,192 chips both posts give 4,208 tokens per second per chip (the
          1,024-chip pair borrows the PyTorch post&rsquo;s rate), and the two MFUs differ only in whether a causal
          query is charged for the half of the attention matrix it never computes.
        </p>
      </div>
    </figure>
  )
}
