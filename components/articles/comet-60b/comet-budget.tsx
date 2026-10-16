"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Parameter ledger of Nemotron 3.5 Super VL and Comet 60B, summed from every
// tensor in the two BF16 safetensors headers (measured). "Active" counts what
// one text token runs: every mixer, shared expert, latent projection, router and
// norm, 22 routed experts per MoE block, and the output head. Not the embedding
// table (one row read), the MTP head, or the vision side.
// Checkpoint sizes are the repos' safetensors bytes (measured). NVIDIA has not
// published an FP8 checkpoint of the parent.

type Part = { key: string; label: string; color: string; p: number; c: number; pa: number; ca: number }

const PARTS: Part[] = [
  { key: "routed", label: "routed experts", color: "oklch(0.62 0.14 200)", p: 112_742_891_520, c: 51_002_736_640, pa: 4_844_421_120, ca: 4_383_047_680 },
  { key: "mamba", label: "Mamba-2 mixers", color: "oklch(0.58 0.12 260)", p: 4_385_438_720, c: 4_385_438_720, pa: 4_385_438_720, ca: 4_385_438_720 },
  { key: "shared", label: "shared experts", color: "oklch(0.48 0.10 200)", p: 1_761_607_680, c: 1_761_607_680, pa: 1_761_607_680, ca: 1_761_607_680 },
  { key: "latent", label: "latent proj., routers, norms", color: "oklch(0.78 0.08 200)", p: 419_815_424, c: 377_862_144, pa: 419_815_424, ca: 377_862_144 },
  { key: "attn", label: "attention mixers", color: "oklch(0.70 0.14 60)", p: 285_212_672, c: 285_212_672, pa: 285_212_672, ca: 285_212_672 },
  { key: "head", label: "output head", color: "oklch(0.60 0.02 260)", p: 536_870_912, c: 536_870_912, pa: 536_870_912, ca: 536_870_912 },
  { key: "emb", label: "embedding table", color: "oklch(0.72 0.02 260)", p: 536_870_912, c: 536_870_912, pa: 0, ca: 0 },
  { key: "mtp", label: "MTP draft head", color: "oklch(0.64 0.10 320)", p: 2_942_325_248, c: 1_397_772_544, pa: 0, ca: 0 },
  { key: "vision", label: "C-RADIO + connector", color: "oklch(0.64 0.13 25)", p: 842_362_888, c: 842_362_888, pa: 0, ca: 0 },
]

const TOT = { p: 124_453_395_976, c: 61_126_735_112 }
const ACT = { p: 12_233_366_528, c: 11_730_039_808 }

const FILES: Record<"bf16" | "fp8" | "nvfp4", { label: string; p: number | null; c: number }> = {
  bf16: { label: "BF16", p: 248.91, c: 122.26 },
  fp8: { label: "FP8", p: null, c: 66.28 },
  nvfp4: { label: "NVFP4", p: 75.01, c: 40.48 },
}

const GPUS = [
  { name: "H100 80 GB", gb: 80 },
  { name: "H200 141 GB", gb: 141 },
  { name: "B300 288 GB", gb: 288 },
]

// Expert sizes in BF16 bytes: two matrices of 1,024 × width.
const EXP_P = 5_505_024 * 2
const EXP_C = 4_980_736 * 2

const fmtB = (n: number) => (n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(0)}M`)

function touched(experts: number, batch: number) {
  // Expected distinct experts hit when `batch` tokens each pick 22 of `experts`,
  // if routing were uniform. Real routing is skewed, so the true count is lower.
  return experts * (1 - mpow(1 - 22 / experts, batch))
}

function Bar({ which, view }: { which: "p" | "c"; view: "total" | "active" }) {
  const denom = view === "total" ? TOT.p : ACT.p
  const total = view === "total" ? TOT[which] : ACT[which]
  return (
    <div>
      <div className="mb-1 flex justify-between font-mono text-[11px]">
        <span className="text-foreground">{which === "p" ? "Nemotron 3.5 Super VL" : "Comet 60B"}</span>
        <span className="text-muted-foreground">{fmtB(total)}</span>
      </div>
      <div className="flex h-5 w-full overflow-hidden rounded-md border bg-muted/30">
        {PARTS.map((part) => {
          const n = view === "total" ? (which === "p" ? part.p : part.c) : which === "p" ? part.pa : part.ca
          return (
            <div
              key={part.key}
              title={`${part.label}: ${fmtB(n)}`}
              style={{ width: `${((n / denom) * 100).toFixed(3)}%`, background: part.color }}
              className="h-full transition-all duration-300"
            />
          )
        })}
      </div>
    </div>
  )
}

export function CometBudget() {
  const [view, setView] = useState<"total" | "active">("total")
  const [fmt, setFmt] = useState<"bf16" | "fp8" | "nvfp4">("bf16")
  const [batch, setBatch] = useState(32)

  const f = FILES[fmt]
  const tp = touched(512, batch)
  const tc = touched(256, batch)
  const bp = (tp * EXP_P) / 1e9
  const bc = (tc * EXP_C) / 1e9

  const btn = (on: boolean) =>
    cn(
      "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
      on ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what halved, what did not</span>
        <span className="text-muted-foreground/60">counts measured from headers</span>
      </div>

      <div className="space-y-5 p-3 sm:p-4">
        <div>
          <div className="mb-3 flex flex-wrap gap-2">
            <button type="button" className={btn(view === "total")} aria-pressed={view === "total"} onClick={() => setView("total")}>
              stored parameters
            </button>
            <button type="button" className={btn(view === "active")} aria-pressed={view === "active"} onClick={() => setView("active")}>
              active per text token
            </button>
          </div>
          <div className="space-y-3">
            <Bar which="p" view={view} />
            <Bar which="c" view={view} />
          </div>
          <div className="mt-2 grid grid-cols-1 gap-x-4 gap-y-0.5 sm:grid-cols-3">
            {PARTS.map((part) => {
              const a = view === "total" ? part.p : part.pa
              const b = view === "total" ? part.c : part.ca
              if (a === 0 && b === 0) return null
              return (
                <div key={part.key} className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
                  <span className="inline-block h-2 w-2 shrink-0 rounded-sm" style={{ background: part.color }} />
                  <span>
                    {part.label}: {fmtB(a)}
                    {a !== b ? <span className="text-foreground"> → {fmtB(b)}</span> : " (same)"}
                  </span>
                </div>
              )
            })}
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/80">
            {view === "total"
              ? "Stored: 124.45B → 61.13B, 50.9% fewer. Only the routed experts, their routers and the MTP block shrank."
              : "Active: 12.23B → 11.73B, 4.1% fewer. Each token still visits 22 experts; each expert is 9.5% narrower."}
          </p>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">checkpoint</span>
            {(Object.keys(FILES) as (keyof typeof FILES)[]).map((k) => (
              <button key={k} type="button" className={btn(fmt === k)} aria-pressed={fmt === k} onClick={() => setFmt(k)}>
                {FILES[k].label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {(["p", "c"] as const).map((w) => {
              const gb = w === "p" ? f.p : f.c
              return (
                <div key={w} className="rounded-md border px-3 py-2 font-mono text-[11px]">
                  <div className="text-muted-foreground">{w === "p" ? "Nemotron 3.5 Super VL" : "Comet 60B"}</div>
                  <div className="text-base text-foreground">{gb === null ? "not published" : `${gb.toFixed(2)} GB`}</div>
                  {gb !== null && (
                    <div className="text-muted-foreground">
                      {GPUS.map((g) => `${g.name}: ${Math.ceil(gb / g.gb)}`).join(" · ")}{" "}
                      <span className="text-muted-foreground/60">(GPUs for weights alone)</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <label htmlFor="comet-batch" className="font-mono text-[11px] text-muted-foreground">
              tokens decoded per step
            </label>
            <Range
              id="comet-batch"
              min={1}
              max={256}
              step={1}
              value={batch}
              onChange={(e) => setBatch(Number(e.target.value))}
              className="w-56"
              aria-label="Tokens decoded per step"
            />
            <span className="font-mono text-[11px] text-foreground">{batch}</span>
          </div>
          <div className="mt-2 grid grid-cols-1 gap-2 font-mono text-[11px] sm:grid-cols-2">
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">parent, per MoE block</div>
              <div className="text-foreground">
                {tp.toFixed(0)} of 512 experts · {bp.toFixed(2)} GB read in BF16
              </div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-muted-foreground">Comet, per MoE block</div>
              <div className="text-foreground">
                {tc.toFixed(0)} of 256 experts · {bc.toFixed(2)} GB read in BF16
              </div>
            </div>
          </div>
          <p className="mt-2 font-mono text-[10px] text-muted-foreground/80">
            Reasoned, assuming uniform routing: expert weight traffic per step is {((1 - bc / bp) * 100).toFixed(0)}% lower for
            Comet. One token saves 9.5%; a busy batch touches every expert, and there are half as many to read.
          </p>
        </div>
      </div>
    </figure>
  )
}
