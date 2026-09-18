"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"
import { mexp } from "@/lib/dmath"

// Step 6/7 of the worked example: softmax over ONLY the 4 candidate logits,
// then argmax + confidence. Logits are illustrative (chosen to land on the
// secretly-two-token MEDIUM, at a realistic BF16 magnitude — real committed
// logits in openjev's results/raw/*.json sit in roughly this 15-28 range) —
// not a captured trace. Dragging temperature is the same operation a
// temperature-scaling calibration fit performs on real held-out logits later
// in the article, so this doubles as a hands-on preview of that idea.

const ACCENT = "oklch(0.72 0.15 195)"

const CANDIDATES = [
  { name: "HIGH", tokenId: 90219, logit: 21.4 },
  { name: "MEDIUM", tokenId: 44, logit: 24.8 },
  { name: "LOW", tokenId: 9441, logit: 19.1 },
  { name: "NONE", tokenId: 45425, logit: 15.7 },
] as const

function subsetSoftmax(logits: number[], temperature: number) {
  const t = Math.max(temperature, 1e-4)
  const scaled = logits.map((z) => z / t)
  const m = Math.max(...scaled)
  const exps = scaled.map((z) => mexp(z - m))
  const sum = exps.reduce((a, b) => a + b, 0)
  return exps.map((e) => e / sum)
}

export function SubsetSoftmax({ locked = false }: { locked?: boolean }) {
  const [temperature, setTemperature] = useState(1)
  const t = locked ? 1 : temperature
  const probs = subsetSoftmax(CANDIDATES.map((c) => c.logit), t)
  const winnerIdx = probs.indexOf(Math.max(...probs))

  return (
    <div className="my-4 overflow-hidden rounded-lg border">
      <div className="border-b bg-muted/30 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
        softmax over exactly 4 logits — nothing else in the vocab is even read
      </div>
      <div className="space-y-1.5 p-3">
        {CANDIDATES.map((c, i) => {
          const p = probs[i]
          const win = i === winnerIdx
          return (
            <div key={c.name} className="flex items-center gap-2">
              <span
                className={cn(
                  "w-20 shrink-0 font-mono text-[11px]",
                  win ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {c.name}
              </span>
              <div className="relative h-4 flex-1 rounded-sm bg-muted/40">
                <div
                  className="absolute inset-y-0 left-0 rounded-sm transition-[width]"
                  style={{ width: `${p * 100}%`, background: win ? ACCENT : "oklch(0.62 0.02 260)" }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {(p * 100).toFixed(1)}%
              </span>
            </div>
          )
        })}
      </div>

      {!locked ? (
        <div className="border-t px-3 py-2.5">
          <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
            <span>temperature T</span>
            <span className="tabular-nums text-foreground">{t.toFixed(2)}</span>
          </div>
          <Range
            min={0.2}
            max={3}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(+e.target.value)}
            className="w-full"
            aria-label="temperature"
            accent={ACCENT}
          />
          <p className="mt-2 text-[11px] leading-5 text-muted-foreground">
            T {"<"} 1 sharpens toward a single winner; T {">"} 1 flattens the four probabilities
            toward each other. This is exactly the knob temperature scaling tunes on held-out
            data — drag it low and the model looks falsely certain; drag it high and it looks
            falsely unsure. Neither is the model getting smarter, only better- or worse-labeled.
          </p>
        </div>
      ) : (
        <div className="border-t px-3 py-2.5 font-mono text-[11px]">
          <span className="text-muted-foreground">argmax → </span>
          <span className="font-medium text-foreground">{CANDIDATES[winnerIdx].name}</span>
          <span className="text-muted-foreground"> · confidence </span>
          <span className="font-medium" style={{ color: ACCENT }}>
            {(probs[winnerIdx] * 100).toFixed(1)}%
          </span>
          <span className="text-muted-foreground">
            {" "}
            — a valid conditional probability under the model{"’"}s own distribution.
            Whether it matches how often {"“"}MEDIUM{"”"} is actually correct is a
            separate question, answered later, not here.
          </span>
        </div>
      )}
    </div>
  )
}
