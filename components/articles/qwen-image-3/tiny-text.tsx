"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// "Authentic Details", the small-text claim. Rendering legible glyphs is the
// hard part of image generation — most models smear text below ~20px. The blog
// claims Qwen-Image-3.0 keeps text legible down to 10px. This won't render the
// model's actual glyphs (that's the whole trick), but it shows what 10px real
// type looks like at typical display scale, and where legibility usually falls
// off. Drag the size; the marker sits at the model's claimed 10px floor.

const ACCENT = "oklch(0.62 0.19 300)"
const SAMPLE =
  "Theorem 3.1. For a finite group G and prime p dividing |G|, every p-subgroup lies in a Sylow p-subgroup."

function verdict(px: number): { label: string; color: string } {
  if (px >= 10) return { label: "legible", color: "oklch(0.62 0.13 150)" }
  if (px >= 8) return { label: "marginal", color: "oklch(0.7 0.14 70)" }
  return { label: "smears", color: "oklch(0.62 0.2 20)" }
}

export function TinyText() {
  const [px, setPx] = useState(10)
  const v = verdict(px)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        authentic details · legible text is the hard mode of image generation
      </div>
      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-background p-4">
          <p
            className="text-foreground"
            style={{ fontSize: `${px}px`, lineHeight: 1.35, maxWidth: "48ch" }}
          >
            {SAMPLE}
          </p>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">rendered size</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{px}px</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">typical legibility</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: v.color }}>{v.label}</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>font size</span>
            <span className="tabular-nums text-foreground">{px}px</span>
          </div>
          <Range
            min={6}
            max={32}
            step={1}
            value={px}
            onChange={(e) => setPx(+e.target.value)}
            className="w-full"
            aria-label="font size in pixels"
            accent={ACCENT}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>6px</span>
            <span style={{ color: ACCENT }}>10px · claimed floor</span>
            <span>32px</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The claim is a <span style={{ color: ACCENT }}>10px</span> floor — legible LaTeX subscripts,
          theorem numbers, and newspaper body copy. That&rsquo;s where most generators still turn text
          into texture, so it&rsquo;s the right thing to be sceptical of and the right thing to test.
        </p>
      </div>
    </figure>
  )
}
