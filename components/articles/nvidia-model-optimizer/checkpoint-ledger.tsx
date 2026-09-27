"use client"

import { useState } from "react"
import { cn } from "@/lib/utils"

// Where the bytes of two published NVFP4 checkpoints go, next to their
// sources. Every NVFP4 figure is the sum of tensor sizes read from the
// safetensors headers (HTTP range requests, no weights downloaded), grouped by
// tensor name. DeepSeek-R1's source is measured the same way from
// deepseek-ai/DeepSeek-R1. Llama-3.3-70B's BF16 source is gated, so its bar is
// computed: the FP4 checkpoint's parameter count per group, times 2 bytes.

type Seg = { key: string; label: string; gb: number; params: number }
type Bar = { name: string; how: string; segs: Seg[] }
type Model = { title: string; bars: [Bar, Bar] }

const COLORS: Record<string, string> = {
  moe: "oklch(0.64 0.17 145)",
  mlp: "oklch(0.64 0.17 145)",
  attn: "oklch(0.62 0.15 255)",
  mtp: "oklch(0.66 0.16 300)",
  emb: "oklch(0.70 0.15 60)",
  rest: "oklch(0.60 0.02 250)",
}

const MODELS: Record<"r1" | "llama", Model> = {
  r1: {
    title: "DeepSeek-R1",
    bars: [
      {
        name: "deepseek-ai/DeepSeek-R1 (FP8)",
        how: "measured",
        segs: [
          { key: "moe", label: "routed experts", gb: 654.068, params: 653.909 },
          { key: "attn", label: "attention projections", gb: 11.416, params: 11.413 },
          { key: "mtp", label: "MTP layer 61", gb: 15.424, params: 13.463 },
          { key: "emb", label: "embeddings + lm_head", gb: 3.707, params: 1.853 },
          { key: "rest", label: "shared experts, dense MLPs, router, norms", gb: 3.959, params: 3.851 },
        ],
      },
      {
        name: "nvidia/DeepSeek-R1-FP4",
        how: "measured",
        segs: [
          { key: "moe", label: "routed experts", gb: 367.824, params: 653.909 },
          { key: "attn", label: "attention projections", gb: 22.827, params: 11.413 },
          { key: "mtp", label: "MTP layer 61", gb: 26.927, params: 13.463 },
          { key: "emb", label: "embeddings + lm_head", gb: 3.707, params: 1.853 },
          { key: "rest", label: "shared experts, dense MLPs, router, norms", gb: 2.321, params: 3.851 },
        ],
      },
    ],
  },
  llama: {
    title: "Llama-3.3-70B-Instruct",
    bars: [
      {
        name: "BF16 source",
        how: "computed, 2 bytes a parameter",
        segs: [
          { key: "mlp", label: "MLP projections", gb: 112.743, params: 56.371 },
          { key: "attn", label: "attention projections", gb: 24.159, params: 12.08 },
          { key: "emb", label: "embeddings + lm_head", gb: 4.203, params: 2.101 },
          { key: "rest", label: "norms", gb: 0.003, params: 0.001 },
        ],
      },
      {
        name: "nvidia/Llama-3.3-70B-Instruct-FP4",
        how: "measured",
        segs: [
          { key: "mlp", label: "MLP projections", gb: 31.709, params: 56.371 },
          { key: "attn", label: "attention projections", gb: 6.795, params: 12.08 },
          { key: "emb", label: "embeddings + lm_head", gb: 4.203, params: 2.101 },
          { key: "rest", label: "norms", gb: 0.003, params: 0.001 },
        ],
      },
    ],
  },
}

// the whole-file totals, from the exact byte and parameter counts
const TOTALS: Record<"r1" | "llama", { src: string; fp4: string; bitsSrc: string; bitsFp4: string; ratio: string }> = {
  r1: { src: "688.57", fp4: "423.61", bitsSrc: "8.05", bitsFp4: "4.95", ratio: "1.63" },
  llama: { src: "141.11", fp4: "42.71", bitsSrc: "16", bitsFp4: "4.84", ratio: "3.30" },
}

const W = 720
const H = 150
const BX = 12
const BW = 696

const bits = (s: Seg) => (s.params > 0 ? (s.gb * 8) / s.params : 0)

export function CheckpointLedger() {
  const [m, setM] = useState<"r1" | "llama">("r1")
  const model = MODELS[m]
  const t = TOTALS[m]
  const max = model.bars[0].segs.reduce((a, s) => a + s.gb, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where the bytes go · source vs NVFP4 checkpoint</span>
        <span className="text-muted-foreground/50">from safetensors headers</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-2 flex items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">model</span>
          {(["r1", "llama"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setM(k)}
              aria-pressed={m === k}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1 font-mono text-[10px] transition-colors",
                m === k ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {MODELS[k].title}
            </button>
          ))}
        </div>

        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`${model.title}: ${t.src} GB in the source, ${t.fp4} GB in the NVFP4 checkpoint, ${t.ratio} times smaller; ${t.bitsFp4} bits per weight overall.`}
        >
          {model.bars.map((bar, bi) => {
            const y = 26 + bi * 66
            let x = BX
            const total = bar.segs.reduce((a, s) => a + s.gb, 0)
            return (
              <g key={bar.name}>
                <text x={BX} y={y - 7} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                  {bar.name}
                </text>
                <text x={BX + BW} y={y - 7} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
                  {total.toFixed(2)} GB · {bar.how}
                </text>
                <rect x={BX} y={y} width={BW} height={30} rx={6} fill="var(--muted)" opacity={0.25} />
                {bar.segs.map((s) => {
                  const w = (s.gb / max) * BW
                  const sx = x
                  x += w
                  return (
                    <g key={s.key}>
                      <rect x={sx} y={y} width={Math.max(w, 0)} height={30} fill={COLORS[s.key]} opacity={0.85} className="transition-all duration-300" />
                      {w > 70 ? (
                        <text x={sx + 6} y={y + 19} className="font-mono" fontSize={10} fill="var(--background)">
                          {s.label.split(",")[0]}
                        </text>
                      ) : null}
                    </g>
                  )
                })}
              </g>
            )
          })}
        </svg>

        <div className="mt-1 overflow-x-auto">
          <table className="w-full font-mono text-[11px]">
            <thead>
              <tr className="text-left text-muted-foreground">
                <th className="py-1 pr-3 font-normal">tensors</th>
                <th className="py-1 pr-3 font-normal">params (B)</th>
                <th className="py-1 pr-3 font-normal">source GB</th>
                <th className="py-1 pr-3 font-normal">NVFP4 GB</th>
                <th className="py-1 font-normal">bits / weight</th>
              </tr>
            </thead>
            <tbody>
              {model.bars[1].segs.map((s, i) => (
                <tr key={s.key} className="border-t border-border/60">
                  <td className="py-1 pr-3">
                    <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: COLORS[s.key] }} />
                    {s.label}
                  </td>
                  <td className="py-1 pr-3 text-foreground">{s.params < 0.01 ? "<0.01" : s.params.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-foreground">{model.bars[0].segs[i].gb < 0.01 ? "<0.01" : model.bars[0].segs[i].gb.toFixed(2)}</td>
                  <td className="py-1 pr-3 text-foreground">{s.gb < 0.01 ? "<0.01" : s.gb.toFixed(2)}</td>
                  <td className="py-1 text-foreground">{s.params < 0.01 ? "16" : bits(s).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {model.title}: <span className="text-foreground">{t.src} GB</span>{" "}in the source at {t.bitsSrc} bits a
          weight, <span className="text-foreground">{t.fp4} GB</span>{" "}in the NVFP4 checkpoint at{" "}
          <span className="text-foreground">{t.bitsFp4}</span>, a <span className="text-foreground">{t.ratio}×</span>{" "}
          shrink.{" "}
          {m === "r1"
            ? "The routed experts go from 8 bits to 4.5 and carry the whole saving. Attention and the MTP layer were FP8 in DeepSeek's release and are BF16 in NVIDIA's, so those two groups grow by about 23 GB."
            : "Every linear layer except lm_head is NVFP4 at 4.5 bits, attention included. The embeddings and lm_head stay BF16, which is why the file averages 4.84 bits and not 4.5."}
        </p>
      </div>
    </figure>
  )
}
