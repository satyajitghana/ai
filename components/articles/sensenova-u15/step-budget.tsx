"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// A small, useful piece of applied engineering that came out of running the thing
// rather than reading the card.
//
// The model card's reference inference configuration is cfg_scale 4.0,
// timestep_shift 3.0, num_steps 50. The Hugging Face demo Space ships 28 instead,
// and documents why: a fixed-seed A/B found that 28 keeps composition, prompt
// adherence and text rendering intact — losing only some micro-texture in
// landscape and skin, and nothing measurable when editing — while running about
// 1.8x faster.
//
// 50/28 = 1.79, so the speedup is exactly the step ratio: flow-matching sampling
// cost is linear in steps, with no fixed overhead worth modelling. Which makes
// the step count a pure quality-versus-latency dial, and makes "how far down can
// you turn it before something breaks" a question with a real answer rather than
// a vibe.
//
// The other thing worth recording from that Space: editing prompts are screened
// on CPU by a guard model before any GPU work is scheduled, so requests to
// undress or sexualize a person in an uploaded photo are refused before they
// cost anything. Doing the check before the expensive part is the correct order
// and it is not the usual one.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const REF = 50
const SHIPPED = 28

const PRESERVED = [
  { l: "composition", note: "intact at 28" },
  { l: "prompt adherence", note: "intact at 28" },
  { l: "text rendering", note: "intact at 28 — the one most likely to break, and it does not" },
]
const LOST = [
  { l: "micro-texture in landscape", note: "the only visible loss" },
  { l: "micro-texture in skin", note: "the only visible loss" },
]

export function StepBudget() {
  const [steps, setSteps] = useState(SHIPPED)
  const speed = REF / steps
  const zone = steps >= 40 ? "reference" : steps >= 24 ? "shipped" : "below"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          cfg_scale 4.0 · timestep_shift 3.0 · num_steps is the dial
        </span>
        <span className="font-mono text-[10px]" style={{ color: zone === "below" ? WARM : GOOD }}>
          {speed.toFixed(2)}× the reference speed
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">denoise steps</span>
          <Range
            min={8}
            max={60}
            step={1}
            value={steps}
            onChange={(e) => setSteps(Number(e.target.value))}
            className="flex-1"
            aria-label="number of denoising steps"
            accent={ACCENT}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{steps}</span>
        </div>

        <div className="mt-2 flex h-7 overflow-hidden rounded-md">
          <div
            className="flex items-center justify-center"
            style={{ width: `${(24 / 60) * 100}%`, background: WARM, opacity: 0.25 }}
          >
            <span className="font-mono text-[9px] text-muted-foreground">unmeasured</span>
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${((40 - 24) / 60) * 100}%`, background: GOOD, opacity: 0.35 }}
          >
            <span className="font-mono text-[9px] text-foreground">28 — the shipped default</span>
          </div>
          <div
            className="flex items-center justify-center"
            style={{ width: `${((60 - 40) / 60) * 100}%`, background: ACCENT, opacity: 0.28 }}
          >
            <span className="font-mono text-[9px] text-foreground">50 — the card&rsquo;s reference</span>
          </div>
        </div>
        <div className="relative h-3">
          <div
            className="absolute top-0 h-3 border-l-2"
            style={{ left: `${(steps / 60) * 100}%`, borderColor: ACCENT }}
          />
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">relative latency</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              {(steps / REF).toFixed(2)}×
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">flow-matching cost is linear in steps</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">against the reference</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: speed >= 1 ? GOOD : WARM }}>
              {speed >= 1 ? `${speed.toFixed(2)}× faster` : `${(1 / speed).toFixed(2)}× slower`}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">50 ÷ {steps}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what is known here</div>
            <div className="font-mono text-sm" style={{ color: zone === "below" ? WARM : GOOD }}>
              {zone === "below" ? "nothing" : zone === "shipped" ? "A/B tested" : "the card's setting"}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {zone === "below" ? "below the tested range" : "fixed-seed comparison"}
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: GOOD }}>
              survives the cut to 28
            </div>
            <div className="mt-1 space-y-0.5">
              {PRESERVED.map((x) => (
                <div key={x.l} className="font-mono text-[10px]">
                  <span className="text-foreground">{x.l}</span>{" "}
                  <span className="text-muted-foreground">— {x.note}</span>
                </div>
              ))}
              <div className="font-mono text-[10px]">
                <span className="text-foreground">editing</span>{" "}
                <span className="text-muted-foreground">— nothing measurable lost at all</span>
              </div>
            </div>
          </div>
          <div>
            <div className="font-mono text-[9px] uppercase tracking-wide" style={{ color: WARM }}>
              does not
            </div>
            <div className="mt-1 space-y-0.5">
              {LOST.map((x) => (
                <div key={x.l} className="font-mono text-[10px]">
                  <span className="text-foreground">{x.l}</span>{" "}
                  <span className="text-muted-foreground">— {x.note}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          This is a small finding and I like it disproportionately, because it is the kind that only appears when
          someone runs the model instead of reading the card. The reference configuration says fifty steps. A
          fixed-seed A/B says twenty-eight keeps composition, prompt adherence and{" "}
          <span className="text-foreground">text rendering</span>{" "}— the capability most likely to fall apart
          first, and the one this release specifically improved — while losing only micro-texture in landscape and
          skin, and <em>nothing measurable when editing</em>.
          <br />
          <br />
          Which means the correct default depends entirely on what you are doing. Editing, where the model is
          preserving most of an existing image, has no use for the extra twenty-two steps at all. Detail-critical
          generation does. That distinction is not in the model card, and there is no reason it would be — the
          card documents what was validated, not what someone later found by looking.
        </p>
      </div>
    </figure>
  )
}
