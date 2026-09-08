"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two DART README tables, cross-checked against the paper (arXiv 2603.11441,
// Table 5 "Backbone distillation comparison"), all COCO val2017, 80 classes,
// 1008px:
//
//  - "Student backbone speed (3 classes, 1008px, TRT FP16)": BB(ms), Pipelined
//    FPS, COCO AP for the four distilled students + the self-distilled
//    ViT-H-Pruned-16 (same architecture family, 16 of 32 blocks removed and
//    the remainder retrained against the full backbone's features).
//  - The full ViT-H/14 teacher isn't in that table -- it's read from Table 2
//    instead (4 classes, the abstract's own headline point), so it's plotted
//    at a different N than the other five rows and marked as such below.
//
// Every row except "ViT-H (teacher)" involved training something: either
// self-distillation (Pruned-16 keeps ViT-H's architecture, retrains the
// surviving blocks) or adapter distillation (the four students swap in a
// wholly different backbone architecture, training only a lightweight
// projection layer while the encoder-decoder stays frozen -- see the
// article's "training-free, except when it isn't" section). DART's
// *training-free* claim covers the SAM3-to-multi-class-detector conversion
// itself, i.e. the ViT-H point on this chart; every other point on it bought
// its speed with some amount of training.
//
// One more inconsistency, not otherwise used in this component: the README's
// own "Quick Start" section attaches different FPS numbers to some of these
// same backbones inline -- "RepViT-M2.3 (38.7 AP, 30.2 FPS)" -- than the
// dedicated Benchmarks section's 55.8 FPS used here. This component uses the
// Benchmarks section throughout because it states its protocol (3 classes,
// 1008px, TRT FP16) and ships a reproduction script
// (scripts/benchmark_all_students.py); the Quick Start figures don't state
// either.

type Backbone = {
  name: string
  params: string
  ap: number
  bbMs: number
  fps: number
  n: number
  trained: boolean
}

const BACKBONES: Backbone[] = [
  { name: "ViT-H (teacher)", params: "439M", ap: 55.8, bbMs: 53.2, fps: 15.8, n: 4, trained: false },
  { name: "ViT-H Pruned-16", params: "220M", ap: 53.6, bbMs: 26.6, fps: 37.6, n: 3, trained: true },
  { name: "RepViT-M2.3", params: "8.2M", ap: 38.7, bbMs: 13.6, fps: 55.8, n: 3, trained: true },
  { name: "TinyViT-21M", params: "21M", ap: 30.1, bbMs: 12.0, fps: 57.8, n: 3, trained: true },
  { name: "EfficientViT-L2", params: "9.2M", ap: 21.7, bbMs: 10.6, fps: 62.5, n: 3, trained: true },
  { name: "EfficientViT-L1", params: "5.3M", ap: 16.3, bbMs: 10.4, fps: 64.2, n: 3, trained: true },
]

const TEACHER = "oklch(0.62 0.15 255)"
const TRAINED = "oklch(0.62 0.19 35)"

const AP_MAX = 60
const FPS_MAX = 70

export function StudentTradeoff() {
  const [selected, setSelected] = useState(5) // EfficientViT-L1 -- the extreme end of the tradeoff

  const teacher = BACKBONES[0]
  const row = BACKBONES[selected]
  const apRatio = row.ap / teacher.ap
  const fpsRatio = row.fps / teacher.fps

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">DART README, &ldquo;Student backbone speed&rdquo; + Table 2 (COCO val2017, 80 classes, 1008px)</span>
        <span className="font-mono text-[10px] text-muted-foreground">click a backbone</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {BACKBONES.map((b, i) => (
            <button
              key={b.name}
              type="button"
              onClick={() => setSelected(i)}
              className={cn(
                "block w-full cursor-pointer rounded-lg border px-2.5 py-2 text-left transition-colors",
                selected === i ? "border-foreground/25 bg-muted/40" : "border-transparent hover:bg-muted/20",
              )}
            >
              <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                <span className="text-foreground">
                  {b.name} <span className="text-muted-foreground">({b.params})</span>
                </span>
                <span className="text-muted-foreground">{b.n} cls</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">AP</span>
                  <div className="h-3.5 flex-1 rounded bg-muted/20">
                    <div
                      className="h-3.5 rounded"
                      style={{ width: `${(b.ap / AP_MAX) * 100}%`, background: b.trained ? TRAINED : TEACHER, opacity: 0.85 }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{b.ap.toFixed(1)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">FPS</span>
                  <div className="h-3.5 flex-1 rounded bg-muted/20">
                    <div
                      className="h-3.5 rounded"
                      style={{ width: `${(b.fps / FPS_MAX) * 100}%`, background: b.trained ? TRAINED : TEACHER, opacity: 0.5 }}
                    />
                  </div>
                  <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums">{b.fps.toFixed(1)}</span>
                </div>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          <span>
            <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: TEACHER }} /> training-free (frozen SAM3, no distillation)
          </span>
          <span>
            <span className="inline-block h-2 w-2 rounded-sm align-middle" style={{ background: TRAINED }} /> trained (self- or adapter-distilled)
          </span>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          {selected === 0 ? (
            <>
              This is the training-free point: SAM3&rsquo;s own ViT-H/14 weights, no adapter, no
              distillation, run at{" "}
              <span className="text-foreground">
                {teacher.fps.toFixed(1)} FPS at {teacher.n} classes
              </span>
              . Everything else on this list bought speed by training something.
            </>
          ) : (
            <>
              <span className="text-foreground">{row.name}</span> reaches{" "}
              <span style={{ color: TRAINED }}>{fpsRatio.toFixed(1)}&times; the teacher&rsquo;s FPS</span>{" "}
              at <span style={{ color: TRAINED }}>{(apRatio * 100).toFixed(0)}% of its AP</span> ({row.ap.toFixed(1)}{" "}
              vs {teacher.ap.toFixed(1)}) &mdash; and it gets there by training an adapter for an
              entirely different backbone architecture ({row.params} vs the teacher&rsquo;s 439M), while
              the encoder-decoder that does the actual detecting stays frozen. &ldquo;64 FPS at 16.3
              AP&rdquo; and &ldquo;15.8 FPS at 55.8 AP&rdquo; are both real DART numbers. They describe
              different products.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
