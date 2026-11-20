"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// GRPO with a pass/fail reward, one prompt at a time. A group of G replies is sampled;
// each reply's advantage is its reward minus the group mean, divided by the group's
// standard deviation. If every reply passes, or every reply fails, the deviation is zero
// and the prompt teaches nothing. With solve rate p, that happens with probability
// p^G + (1 - p)^G.
//
// The presets are rates from the quark report (Table 4): 0% (the harness that never
// produced a valid call), 2.6% (all 15 harnesses over their first 100 steps), 22% (the top
// of the early harnesses' starting range), 42% (the bottom of the late-added harnesses'
// starting range) and 64.5% (all 15 over the last 100 steps). quark's group size is not
// published, so G is a free control here.

const PRESETS = [
  { label: "never valid", p: 0 },
  { label: "all 15, first steps", p: 0.026 },
  { label: "early harness, best start", p: 0.22 },
  { label: "late harness, worst start", p: 0.42 },
  { label: "all 15, last steps", p: 0.645 },
]
const GROUPS = [2, 4, 8, 16, 32]

// mulberry32: a deterministic sample, the same on the server and in the browser
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function GroupSignal() {
  const [pp, setPp] = useState(26) // tenths of a percent
  const [gi, setGi] = useState(2)
  const [draw, setDraw] = useState(1)

  const p = pp / 1000
  const G = GROUPS[gi]
  const zero = mpow(p, G) + mpow(1 - p, G)
  const signal = 1 - zero

  const r = rng(draw * 7919 + G * 131 + pp)
  const rewards: number[] = Array.from({ length: G }, () => (r() < p ? 1 : 0))
  const k = rewards.reduce((s, x) => s + x, 0)
  const mean = k / G
  const sd = Math.sqrt(mean * (1 - mean))
  const adv = rewards.map((x) => (sd > 0 ? (x - mean) / sd : 0))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>GRPO · when a group of replies teaches anything</span>
        <span className="text-muted-foreground/60">pass/fail reward, one prompt</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Solve-rate presets from the report">
          <span className="w-full font-mono text-[11px] uppercase tracking-wide text-muted-foreground sm:w-20">report</span>
          {PRESETS.map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setPp(Math.round(o.p * 1000))}
              aria-pressed={pp === Math.round(o.p * 1000)}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                pp === Math.round(o.p * 1000)
                  ? "border-foreground bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label} · {(o.p * 100).toFixed(1)}%
            </button>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>solve rate p</span>
              <span className="text-foreground">{(p * 100).toFixed(1)}%</span>
            </div>
            <Range
              min={0}
              max={1000}
              step={1}
              value={pp}
              onChange={(e) => setPp(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Solve rate"
            />
          </div>
          <div>
            <div className="flex justify-between font-mono text-xs text-muted-foreground">
              <span>group size G (not published)</span>
              <span className="text-foreground">{G}</span>
            </div>
            <Range
              min={0}
              max={GROUPS.length - 1}
              value={gi}
              onChange={(e) => setGi(Number(e.target.value))}
              className="w-full cursor-pointer"
              aria-label="Group size"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between font-mono text-xs">
            <span>
              one sampled group: {k} of {G} pass
            </span>
            <button
              type="button"
              onClick={() => setDraw((d) => d + 1)}
              className="rounded-md border px-2.5 py-1 text-muted-foreground hover:text-foreground"
            >
              sample again
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {rewards.map((x, i) => (
              <div
                key={i}
                className="flex w-12 flex-col items-center rounded-md border p-1 font-mono text-[10px]"
                title={`reply ${i + 1}: ${x ? "pass" : "fail"}, advantage ${adv[i].toFixed(2)}`}
              >
                <span
                  className="mb-1 inline-block size-4 rounded-full"
                  style={{ background: x ? "oklch(0.66 0.15 150)" : "oklch(0.62 0.17 25)" }}
                />
                <span className={cn(adv[i] === 0 ? "text-muted-foreground" : "text-foreground")}>
                  {adv[i] > 0 ? "+" : ""}
                  {adv[i].toFixed(2)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {sd === 0
              ? "Every reply got the same reward, so every advantage is zero: this prompt contributes no gradient this step."
              : "Passing replies are pushed up and failing ones down, scaled so the group's advantages have mean zero and unit spread."}
          </p>
        </div>

        <div>
          <div className="mb-1 flex justify-between font-mono text-xs">
            <span>chance a group carries any signal</span>
            <span className="font-semibold">{(signal * 100).toFixed(1)}%</span>
          </div>
          <div className="h-5 w-full overflow-hidden rounded-md border bg-muted/30">
            <div className="h-full" style={{ width: `${(signal * 100).toFixed(2)}%`, background: "oklch(0.66 0.15 150)" }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            1 − p<sup>G</sup> − (1 − p)<sup>G</sup>. At 0% it is zero for any G: a harness the model never solves once is never trained.
          </p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        A toy of the advantage rule the model card names (GRPO, group-relative advantages, no KL term), with a binary reward. The rates are the
        report&apos;s; the sampled replies are simulated, and quark&apos;s real group size, batch and learning rate are not published.
      </figcaption>
    </figure>
  )
}
