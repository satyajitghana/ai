"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why the repository is 57 GB for a model whose parts add to about 12B
// parameters: it ships twice, once per runtime.
//
// The decomposition that convinced me these are the same model in two formats:
//   flowmatching_vae.pth   2,457.1M params (9.83 GB / 4 bytes, fp32)
//   transformer/           2,431.9M
//   condition_encoder/        25.2M
//   2,431.9 + 25.2       = 2,457.1M   exact
//
// So the single .pth is the diffusers transformer and condition encoder bundled
// together. Sizes from the HF tree API; parameter counts from safetensors
// headers or from bytes / dtype width.

type Part = { name: string; gb: number; note: string }

const DIFFUSERS: Part[] = [
  { name: "language_model/", gb: 17.17, note: "Qwen3ForCausalLM, 8.584B, BF16" },
  { name: "transformer/", gb: 9.73, note: "Flow matching, 2,431.9M, F32" },
  { name: "rvq_depth_decoder/", gb: 1.29, note: "Local LLM, 646.0M, BF16" },
  { name: "vocoder/", gb: 0.22, note: "54.2M, F32" },
  { name: "condition_encoder/", gb: 0.1, note: "25.2M, F32" },
  { name: "tokenizer/ + scheduler/", gb: 0.02, note: "Qwen2Tokenizer + FlowMatchEulerDiscreteScheduler" },
]

const SGLANG: Part[] = [
  { name: "qwen_7B/", gb: 18.48, note: "AbabForCausalLM — MiniMax's own family, not Qwen, despite the folder name. Same shape as language_model/: 36 layers, hidden 4096, vocab 200,000." },
  { name: "flowmatching_vae.pth", gb: 9.83, note: "2,457.1M at fp32 = transformer (2,431.9M) + condition_encoder (25.2M), exactly" },
  { name: "dav.pth", gb: 0.49, note: "123.0M at fp32 — the Flow-VAE decoder the card names" },
]

const A = "oklch(0.60 0.15 255)"
const B = "oklch(0.68 0.13 85)"

export function TwoLayouts() {
  const [sel, setSel] = useState<{ side: "d" | "s"; i: number }>({ side: "s", i: 0 })

  const dTotal = DIFFUSERS.reduce((a, p) => a + p.gb, 0)
  const sTotal = SGLANG.reduce((a, p) => a + p.gb, 0)
  const scale = Math.max(dTotal, sTotal)
  const active = sel.side === "d" ? DIFFUSERS[sel.i] : SGLANG[sel.i]

  const stack = (parts: Part[], side: "d" | "s", color: string, label: string, total: number) => (
    <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="font-mono text-[11px] text-foreground">{label}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{total.toFixed(2)} GB</span>
      </div>
      <div className="mt-1.5 flex h-4 overflow-hidden rounded-sm bg-muted/40">
        {parts.map((p, i) => (
          <button
            key={p.name}
            type="button"
            aria-label={p.name}
            onClick={() => setSel({ side, i })}
            className="cursor-pointer border-r border-background/40 last:border-r-0"
            style={{
              width: `${(p.gb / scale) * 100}%`,
              background: color,
              opacity: sel.side === side && sel.i === i ? 1 : 0.55,
            }}
          />
        ))}
      </div>
      <div className="mt-1.5 space-y-0.5">
        {parts.map((p, i) => (
          <button
            key={p.name}
            type="button"
            onClick={() => setSel({ side, i })}
            className={cn(
              "flex w-full cursor-pointer items-baseline justify-between gap-2 rounded px-1 py-0.5 text-left transition-colors",
              sel.side === side && sel.i === i ? "bg-muted/50" : "hover:bg-muted/25",
            )}
          >
            <span className="truncate font-mono text-[10px] text-muted-foreground">{p.name}</span>
            <span className="shrink-0 font-mono text-[10px] tabular-nums text-foreground">{p.gb.toFixed(2)}</span>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one model, shipped twice</span>
        <span className="font-mono text-[10px] text-muted-foreground">57.35 GB repository</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-2 sm:grid-cols-2">
          {stack(SGLANG, "s", B, "SGLang-Omni layout", sTotal)}
          {stack(DIFFUSERS, "d", A, "diffusers layout", dTotal)}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px] text-foreground">
            {active.name} · {active.gb.toFixed(2)} GB
          </div>
          <div className="mt-1 text-sm leading-6 text-muted-foreground">{active.note}</div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The repository is 57 GB for a system whose parameters total roughly 12B, because it contains the whole
          model twice — once laid out for SGLang-Omni, which the card recommends, and once as a diffusers modular
          pipeline. The clue that these are the same weights rather than two models is arithmetic:{" "}
          <span className="font-mono text-foreground">flowmatching_vae.pth</span>{" "}is 2,457.1M parameters, and the
          diffusers transformer plus condition encoder come to 2,431.9M + 25.2M. That is not an approximation, it
          is the same total. The folder named{" "}
          <span className="font-mono text-foreground">qwen_7B</span>{" "}is the odd one out: it holds an{" "}
          <span className="font-mono text-foreground">AbabForCausalLM</span>, MiniMax&rsquo;s own architecture, at
          the same 8.58B shape as the Qwen3-derived copy beside it — a directory named after one model family
          containing another.
        </p>
      </div>
    </figure>
  )
}
