"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// "Rich Content", horizontal expansion. The headline demo is a 3×3 grid where
// every cell is its own dense infographic; the blog notes the full grid takes a
// ~3.7k-token prompt, and Qwen-Image-3.0 raises the instruction ceiling to 4.5k
// (Qwen-Image-2.0 sat around ~1k). So the real lever behind "more stuff in one
// image" is how long a prompt the model will still honour. Drag the budget and
// watch how many complex cells you can actually describe.

const ACCENT = "oklch(0.62 0.19 300)"
const PER_CELL = 411 // ~3.7k tokens ÷ 9 dense cells, from the blog's own example
const V2 = 1000 // Qwen-Image-2.0's practical instruction length

const CELLS = [
  "tunnel-safety comic",
  "spatial-geometry lesson",
  "“Chu Shi Biao” analysis",
  "projectile motion",
  "parasitology explainer",
  "right-chest-pain diagram",
  "Sylow theorems",
  "bank internal-control",
  "cell DNA structure",
]

export function PromptBudget() {
  const [tokens, setTokens] = useState(3700)
  const cells = Math.min(9, Math.floor(tokens / PER_CELL))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        prompt budget → how much you can pack into one image
      </div>
      <div className="p-3 sm:p-4">
        {/* the 3×3 grid filling in as the budget grows */}
        <div className="mx-auto grid max-w-[280px] grid-cols-3 gap-1.5">
          {CELLS.map((label, i) => {
            const on = i < cells
            return (
              <div
                key={i}
                className="flex aspect-square items-center justify-center rounded-md border p-1 text-center font-mono text-[7px] leading-tight transition-colors sm:text-[8px]"
                style={
                  on
                    ? { background: ACCENT, borderColor: ACCENT, color: "white" }
                    : { borderStyle: "dashed", color: "var(--muted-foreground)", opacity: 0.5 }
                }
              >
                {on ? label : "—"}
              </div>
            )
          })}
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 font-mono">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">prompt budget</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{(tokens / 1000).toFixed(1)}k</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">dense cells describable</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>{cells}<span className="text-sm text-muted-foreground">/9</span></div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">vs Qwen-Image-2.0</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{(tokens / V2).toFixed(1)}×</div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>instruction length (tokens)</span>
            <span className="tabular-nums text-foreground">{tokens}</span>
          </div>
          <Range
            min={300}
            max={4500}
            step={100}
            value={tokens}
            onChange={(e) => setTokens(+e.target.value)}
            className="w-full"
            aria-label="prompt token budget"
            accent={ACCENT}
          />
          <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
            <span>0.3k</span>
            <span>3.7k · full grid</span>
            <span>4.5k · ceiling</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The point isn&rsquo;t the grid — it&rsquo;s that &ldquo;how much you can draw&rdquo; is gated by
          &ldquo;how long an instruction the model will still follow.&rdquo; Push the ceiling from ~1k to{" "}
          <span style={{ color: ACCENT }}>4.5k tokens</span> and a single pass can hold nine unrelated
          infographics without them bleeding into each other.
        </p>
      </div>
    </figure>
  )
}
