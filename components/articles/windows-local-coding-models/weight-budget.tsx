"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// How big are a model's weights at a given number of bits per weight, and which
// of the machines Microsoft named can hold them?
//
//   weight bytes = parameters x bits per weight / 8
//
// That is the whole model: it ignores the KV cache, the speculative drafter,
// the runtime and the OS, which is exactly why the "documented" ticks matter.
// Microsoft's own numbers for MAI Code 1.1 Flash (Command Line post): 53 GB
// quantized at about 3.3 bits per weight, 75.5 GB peak at 256K context. The
// demo video's install dialog says 22 GB. The parameter counts are the ones in
// the Windows Experience post (137B total, 284B, "over 70 billion").
//
// Capacities: RTX Spark PCs ship with 64 GB or 128 GB of unified memory; the
// Command Line Task Manager screenshot of a 128 GB Surface Laptop Ultra shows
// 110 GB of GPU memory (74.9 dedicated + 35.5 shared, rounded by Windows).
// Only + - * / are used, so no dmath wrappers are needed.

type Model = { id: string; label: string; params: number; note: string }

const MODELS: Model[] = [
  { id: "mai", label: "MAI Code 1.1 Flash", params: 137, note: "137B total, 6.8B active" },
  { id: "dsv4", label: "DeepSeek V4 Flash", params: 284, note: "284B" },
  { id: "nemo", label: "upcoming Nemotron", params: 70, note: "“over 70 billion”, so a floor" },
]

type Tier = { label: string; gb: number; note: string }

const TIERS: Tier[] = [
  { label: "RTX Spark PC, 64 GB", gb: 64, note: "total unified memory; the GPU can address less" },
  { label: "RTX Spark PC, 128 GB", gb: 110, note: "110 GB GPU memory in Microsoft's Task Manager screenshot" },
  { label: "Demo-video PC, 24 GB VRAM", gb: 24, note: "the machine in the MAI demo, plus 64 GB RAM" },
]

const MARKS = [
  { gb: 22, label: "22 GB: demo install dialog" },
  { gb: 53, label: "53 GB: Command Line, ~3.3 bpw" },
  { gb: 75.5, label: "75.5 GB: peak at 256K" },
]

const SCALE = 160 // GB at the right edge

const ACCENT = "oklch(0.62 0.14 250)"
const OK = "oklch(0.58 0.14 155)"
const BAD = "oklch(0.62 0.17 30)"

function pct(gb: number) {
  return Math.min(100, (gb / SCALE) * 100)
}

export function WeightBudget() {
  const [modelId, setModelId] = useState("mai")
  const [bits, setBits] = useState(3.3)
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0]

  const gb = (model.params * bits) / 8 // decimal GB, since params are in billions
  const gib = (gb * 1e9) / (1024 * 1024 * 1024)
  const bf16 = (model.params * 16) / 8
  const saved = 1 - gb / bf16

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Weights only: params x bits / 8</span>
        <span className="text-muted-foreground/60">KV cache, drafter and OS not included</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model">
          {MODELS.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModelId(m.id)}
              aria-pressed={modelId === m.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
                modelId === m.id ? "border-foreground/40 bg-muted/50 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {m.label}
            </button>
          ))}
        </div>

        <label className="block font-mono text-[11px] text-muted-foreground">
          <span className="flex justify-between">
            <span>bits per weight</span>
            <span className="text-foreground">{bits.toFixed(1)}</span>
          </span>
          <Range
            min={1}
            max={16}
            step={0.1}
            value={bits}
            accent={ACCENT}
            onChange={(e) => setBits(Number(e.target.value))}
            className="mt-1.5 w-full"
            aria-label="Bits per weight"
          />
        </label>

        <div className="grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border p-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">weights</div>
            <div className="text-xl font-semibold tabular-nums">{gb.toFixed(1)} GB</div>
            <div className="font-mono text-[10px] text-muted-foreground">{gib.toFixed(1)} GiB</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">vs BF16 ({bf16.toFixed(0)} GB)</div>
            <div className="text-xl font-semibold tabular-nums">{saved >= 0 ? `-${(saved * 100).toFixed(0)}%` : "larger"}</div>
            <div className="font-mono text-[10px] text-muted-foreground">{model.note}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="font-mono text-[10px] text-muted-foreground">22 GB would need</div>
            <div className="text-xl font-semibold tabular-nums">{((22 * 8) / model.params).toFixed(2)} bpw</div>
            <div className="font-mono text-[10px] text-muted-foreground">for this parameter count</div>
          </div>
        </div>

        <div className="space-y-2.5">
          {TIERS.map((t) => {
            const fits = gb <= t.gb
            return (
              <div key={t.label}>
                <div className="flex flex-wrap justify-between gap-x-3 font-mono text-[10.5px]">
                  <span className="text-foreground">{t.label}</span>
                  <span style={{ color: fits ? OK : BAD }}>{fits ? `fits, ${(t.gb - gb).toFixed(1)} GB left` : "weights alone do not fit"}</span>
                </div>
                <div className="relative mt-1 h-3.5 rounded bg-muted/60">
                  <div className="absolute inset-y-0 left-0 rounded border border-foreground/25" style={{ width: `${pct(t.gb)}%` }} />
                  <div
                    className="absolute inset-y-0.5 left-0 rounded-sm transition-[width] duration-200"
                    style={{ width: `${pct(gb)}%`, background: fits ? OK : BAD, opacity: 0.75 }}
                  />
                </div>
                <div className="mt-0.5 text-[10.5px] text-muted-foreground">{t.note}</div>
              </div>
            )
          })}
        </div>

        {modelId === "mai" && (
          <div className="relative h-14 border-t pt-1">
            {MARKS.map((m, i) => (
              <div key={m.gb} className="absolute top-0" style={{ left: `${pct(m.gb)}%` }}>
                <div className="h-2 w-px bg-foreground/60" />
                <div
                  className="whitespace-nowrap font-mono text-[9.5px] text-muted-foreground"
                  style={{ transform: `translateX(-15%) translateY(${i * 13}px)` }}
                >
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-between font-mono text-[9.5px] text-muted-foreground/70">
          <span>0 GB</span>
          <span>{SCALE} GB</span>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Parameter counts from Microsoft&apos;s Windows Experience post; 53 GB and 75.5 GB from the Command Line post; 22 GB
        from the demo video. DGX Station for Windows, with up to 748 GB of coherent memory, is off the right edge for every
        setting.
      </figcaption>
    </figure>
  )
}
