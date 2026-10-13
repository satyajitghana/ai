"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// ImageNet 256x256 class-conditional rows from the RG paper's Table 2
// (arXiv 2610.12978), as reported there: FID-50K with each method's own
// guidance and sampler, parameters, training epochs and external pretrained
// models used in training. Not re-run. Rows without a parameter count in the
// table (VDM++) are left out.

type Row = { name: string; fid: number; params: number; ep: number | null; pre: string; space: "pixel" | "latent"; rg?: boolean }

const ROWS: Row[] = [
  { name: "RG-XL/16", fid: 1.55, params: 725, ep: 600, pre: "DINOv2", space: "pixel", rg: true },
  { name: "PixelDiT-XL", fid: 1.61, params: 797, ep: 320, pre: "DINOv2", space: "pixel" },
  { name: "PixelU-H/16", fid: 1.63, params: 1168, ep: 600, pre: "DINOv2", space: "pixel" },
  { name: "DeCo-XL/16", fid: 1.69, params: 682, ep: 600, pre: "DINOv2", space: "pixel" },
  { name: "RG-L/16", fid: 1.79, params: 459, ep: 600, pre: "DINOv2", space: "pixel", rg: true },
  { name: "DiP-XL/16", fid: 1.79, params: 631, ep: 600, pre: "DINOv2", space: "pixel" },
  { name: "PixelREPA-H/16", fid: 1.81, params: 953, ep: 600, pre: "DINOv2", space: "pixel" },
  { name: "EPG-XXL/16", fid: 1.81, params: 789, ep: 600, pre: "none", space: "pixel" },
  { name: "JiT-G/16", fid: 1.82, params: 2000, ep: 600, pre: "none", space: "pixel" },
  { name: "PixelGen-XL/16", fid: 1.83, params: 676, ep: 160, pre: "VGG, DINOv2", space: "pixel" },
  { name: "PixNerd-XL", fid: 1.93, params: 700, ep: 320, pre: "DINOv2", space: "pixel" },
  { name: "PixelFlow-XL", fid: 1.98, params: 677, ep: 320, pre: "none", space: "pixel" },
  { name: "Simple Diffusion", fid: 2.44, params: 2000, ep: 800, pre: "none", space: "pixel" },
  { name: "RIN", fid: 3.42, params: 410, ep: 480, pre: "none", space: "pixel" },
  { name: "FARMER", fid: 3.6, params: 1900, ep: 320, pre: "none", space: "pixel" },
  { name: "JetFormer", fid: 6.64, params: 2800, ep: null, pre: "none", space: "pixel" },
  { name: "RAE-XL", fid: 1.13, params: 839, ep: 800, pre: "RAE", space: "latent" },
  { name: "DDT-XL", fid: 1.26, params: 675, ep: 400, pre: "SD-VAE, DINOv2", space: "latent" },
  { name: "Lightning DiT", fid: 1.35, params: 675, ep: 800, pre: "VA-VAE", space: "latent" },
  { name: "REPA (SiT-XL)", fid: 1.42, params: 675, ep: 800, pre: "SD-VAE, DINOv2", space: "latent" },
  { name: "SiT-XL", fid: 2.06, params: 675, ep: 1400, pre: "SD-VAE", space: "latent" },
  { name: "DiT-XL", fid: 2.27, params: 675, ep: 1400, pre: "SD-VAE", space: "latent" },
]

const RG = "oklch(0.62 0.17 30)"
const PIX = "oklch(0.58 0.13 250)"
const LAT = "oklch(0.62 0.03 250)"

type Sort = "fid" | "params"

export function FidBoard() {
  const [sort, setSort] = useState<Sort>("fid")
  const [latent, setLatent] = useState(false)
  const [cap, setCap] = useState(true)

  const rows = ROWS.filter((r) => (latent || r.space === "pixel") && (!cap || r.fid < 2.5)).sort((a, b) =>
    sort === "fid" ? a.fid - b.fid || a.params - b.params : a.params - b.params || a.fid - b.fid,
  )
  const maxF = Math.max(...rows.map((r) => r.fid))
  const maxP = Math.max(...rows.map((r) => r.params))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">ImageNet 256×256 · FID-50K and parameters (paper, Table 2; reported)</span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(["fid", "params"] as Sort[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              aria-pressed={sort === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sort === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              sort by {k === "fid" ? "FID" : "parameters"}
            </button>
          ))}
          <label className="ml-1 flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={latent} onChange={(e) => setLatent(e.target.checked)} />
            latent-space rows
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <input type="checkbox" checked={cap} onChange={(e) => setCap(e.target.checked)} />
            hide FID above 2.5
          </label>
        </div>

        <div className="mt-3 grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-x-2 gap-y-1.5 font-mono text-[10px]">
          <span className="text-muted-foreground">model</span>
          <span className="text-muted-foreground">FID ↓</span>
          <span className="text-muted-foreground">params (M)</span>
          {rows.map((r) => {
            const c = r.rg ? RG : r.space === "pixel" ? PIX : LAT
            return (
              <div key={r.name} className="contents">
                <span className={cn("truncate", r.rg ? "font-semibold text-foreground" : "text-muted-foreground")} title={`${r.name} · ${r.ep ?? "?"} epochs · pretrained: ${r.pre}`}>
                  {r.name}
                </span>
                <div className="relative h-3.5 rounded-sm bg-muted/40">
                  <div className="h-3.5 rounded-sm" style={{ width: `${((r.fid / maxF) * 100).toFixed(2)}%`, background: c, opacity: 0.85 }} />
                  <span className="absolute inset-y-0 right-1 flex items-center tabular-nums text-foreground">{r.fid.toFixed(2)}</span>
                </div>
                <div className="relative h-3.5 rounded-sm bg-muted/40">
                  <div className="h-3.5 rounded-sm" style={{ width: `${((r.params / maxP) * 100).toFixed(2)}%`, background: c, opacity: 0.45 }} />
                  <span className="absolute inset-y-0 right-1 flex items-center tabular-nums text-foreground">{r.params}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Orange: RG. Blue: other pixel-space models. Grey: latent-space models, whose parameter counts exclude the VAE. Hover a name for
          epochs and the external models each one trained with. Each FID is as its own paper reported it, with its own sampler and
          guidance settings; RG&apos;s uses 50 Heun steps and classifier-free guidance.
        </p>
      </div>
    </figure>
  )
}
