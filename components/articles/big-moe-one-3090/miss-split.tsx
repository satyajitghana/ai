"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// The per-layer split in 0xSero/dsv41-flash-offload, ct/ft_tier_cu_v.cu
// (ft_split_k). For one MoE layer of one decode step, the six routed experts
// are either resident in the VRAM mirror cache (hits) or only in pinned host
// RAM (misses). The kernel tries every k = 0..misses: the k coldest misses go to
// the CPU tier, the rest are read by the GPU zero-copy over PCIe, and it keeps
// the k with the smallest max(GPU time, CPU time). Policy constants, in ms:
//
//   t_hit 0.03  per GPU-resident expert          (DSV41_CT_THIT default)
//   t_zc  0.58  per expert read zero-copy        (DSV41_CT_TZC default)
//   cpu_a 0.11  fixed per CPU job                (DSV41_CT_A default)
//   cpu_b 0.20  per CPU expert                   (DSV41_CT_B, docker/entrypoint.sh;
//                                                 0.16 in ct_vllm.py, 0.24 before D132)
//
// The cpu_tok term (extra cost when several tokens share an expert) is zero
// at one token per step, which is what this shows.

const T_HIT = 0.03
const T_ZC = 0.58
const CPU_A = 0.11
const ROUTED = 6
const LAYERS = 40
const EXPERT_MB = 13.27

function options(misses: number, cpuB: number) {
  const hits = ROUTED - misses
  const out: { k: number; gpu: number; cpu: number; t: number }[] = []
  for (let k = 0; k <= misses; k++) {
    const gpu = T_HIT * (hits + misses - k) + T_ZC * (misses - k)
    const cpu = k > 0 ? CPU_A + cpuB * k : 0
    out.push({ k, gpu, cpu, t: Math.max(gpu, cpu) })
  }
  let best = 0
  for (let i = 1; i < out.length; i++) if (out[i].t < out[best].t - 1e-6) best = i
  return { out, best }
}

export function MissSplit() {
  const [misses, setMisses] = useState(4)
  const [cpuB, setCpuB] = useState(0.2)
  const { out, best } = options(misses, cpuB)
  const peak = Math.max(...out.map((o) => Math.max(o.gpu, o.cpu)), 0.5)
  const w = (ms: number) => `${Math.min(100, (ms / peak) * 100).toFixed(2)}%`
  const chosen = out[best]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        One MoE layer, one decode token · the split ft_split_k picks · constants from the repo
      </div>

      <div className="space-y-2.5 border-b px-4 py-3 text-xs">
        <label className="flex items-center gap-3">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">misses of 6 routed</span>
          <Range
            min={0}
            max={6}
            step={1}
            value={misses}
            onChange={(e) => setMisses(Number(e.target.value))}
            aria-label="experts that miss the VRAM cache, out of 6"
            className="w-full"
          />
          <span className="w-10 shrink-0 text-right font-mono tabular-nums">{misses}</span>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="w-40 shrink-0 font-mono text-muted-foreground">CPU ms per expert</span>
          {[0.16, 0.2, 0.24].map((b) => (
            <button
              key={b}
              type="button"
              onClick={() => setCpuB(b)}
              className={cn(
                "rounded border px-2 py-0.5 font-mono text-[11px]",
                cpuB === b ? "border-foreground/40 bg-muted" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {b.toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2.5 px-4 py-4">
        {out.map((o) => (
          <div
            key={o.k}
            className={cn(
              "rounded px-2 py-1.5 text-xs",
              o.k === best ? "bg-muted ring-1 ring-foreground/30" : ""
            )}
          >
            <div className="mb-1 flex justify-between font-mono">
              <span className={o.k === best ? "text-foreground" : "text-muted-foreground"}>
                {o.k} to CPU · {misses - o.k} over PCIe{o.k === best ? " · chosen" : ""}
              </span>
              <span className="tabular-nums">{o.t.toFixed(2)} ms</span>
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-mono text-[10px] text-muted-foreground">GPU</span>
                <div className="h-2 flex-1 rounded-sm bg-muted">
                  <div className="h-2 rounded-sm" style={{ width: w(o.gpu), background: "oklch(0.55 0.16 250)" }} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-8 shrink-0 font-mono text-[10px] text-muted-foreground">CPU</span>
                <div className="h-2 flex-1 rounded-sm bg-muted">
                  <div className="h-2 rounded-sm" style={{ width: w(o.cpu), background: "oklch(0.62 0.15 45)" }} />
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Chosen: {chosen.k} of {misses} misses on the CPU, {chosen.t.toFixed(2)} ms for this layer;
        over {LAYERS} layers that is {(chosen.t * LAYERS).toFixed(1)} ms of routed-expert time per
        token, before attention and the dense weights. Each expert is {EXPERT_MB} MB at 3.0 bits, so
        0.58 ms over PCIe is about 23 GB/s and {cpuB.toFixed(2)} ms on the CPU is about{" "}
        {(EXPERT_MB / cpuB).toFixed(0)} GB/s.
      </figcaption>
    </figure>
  )
}
