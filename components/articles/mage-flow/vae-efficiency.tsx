"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The co-design that pays for everything else. Mage-VAE is a lightweight
// pixel-diffusion tokenizer distilled from the FLUX.2-VAE latent space with
// one-step encode/decode and anchor-latent KL regularization. It matches
// FLUX.2-VAE reconstruction fidelity while using ~12× fewer encode and ~22×
// fewer decode MACs per pixel — and, with native-resolution packing + fused
// CUDA kernels, cuts per-step training from ~1.93s to ~0.78s (~2.5×).
// Numbers: Mage-Flow report.

const ACCENT = "oklch(0.62 0.17 300)"
const BASE = "oklch(0.6 0.03 260)"

const DIR = {
  encode: { flux: 12, mage: 1, label: "encode MACs / pixel" },
  decode: { flux: 22, mage: 1, label: "decode MACs / pixel" },
}

export function VaeEfficiency() {
  const [dir, setDir] = useState<keyof typeof DIR>("decode")
  const d = DIR[dir]

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-xs transition-colors",
      active ? "border-foreground/30 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
    )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Mage-VAE vs FLUX.2-VAE · same fidelity, less work</span>
        <div className="flex gap-1">
          {(Object.keys(DIR) as (keyof typeof DIR)[]).map((k) => (
            <button key={k} type="button" onClick={() => setDir(k)} className={chip(dir === k)}>{k}</button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {[
            { name: "FLUX.2-VAE", v: d.flux, c: BASE },
            { name: "Mage-VAE", v: d.mage, c: ACCENT },
          ].map((r) => (
            <div key={r.name} className="grid grid-cols-[96px_1fr_54px] items-center gap-2">
              <span className="font-mono text-[11px] text-foreground">{r.name}</span>
              <span className="h-5 overflow-hidden rounded bg-muted/40">
                <span className="block h-full rounded transition-all duration-500" style={{ width: `${(r.v / d.flux) * 100}%`, background: r.c }} />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">{r.v}×</span>
            </div>
          ))}
        </div>
        <div className="mt-2 text-center font-mono text-[11px] text-muted-foreground">
          {d.label}: <span className="tabular-nums" style={{ color: ACCENT }}>~{d.flux}× fewer</span> at matched reconstruction
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">training step time</div>
            <div className="mt-0.5 text-sm tabular-nums text-foreground">1.93s → <span style={{ color: ACCENT }}>0.78s</span></div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">end-to-end training</div>
            <div className="mt-0.5 text-sm tabular-nums" style={{ color: ACCENT }}>~2.5× faster</div>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The VAE is usually the quiet tax on high-resolution diffusion. Make it an order of magnitude cheaper — without
          losing reconstruction quality — and the whole stack&rsquo;s training and inference get cheaper with it.
        </p>
      </div>
    </figure>
  )
}
