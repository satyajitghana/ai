"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Why a continuous DDPM can't get the same free lunch. MD4's forward process decides,
// per voxel, whether to mask it — a fixed voxel is simply excluded from that decision,
// at every t, so there is nothing to reconcile. A continuous DDPM's forward process adds
// noise to EVERY position according to one global schedule x_t = a(t) x0 + b(t) eps; if
// you clamp a "fixed" voxel to its clean embedding mid-sampling anyway, the model is
// still conditioned on seeing noise amplitude b(t) there, and gets 0 instead. That gap
// is a real train/inference mismatch, not a cosmetic one — closing it needs extra
// machinery (RePaint-style re-noise-and-resample), which the paper flags as unresolved.
// Schedule shape (b(t) = sin(pi t/2)) mirrors the paper's own cosine-family
// parameterization; illustrative, not the fitted coefficients.

type Mode = "md4" | "ddpm"

const ACCENT = "oklch(0.66 0.16 200)"
const WARN = "oklch(0.64 0.18 25)"

const bOfT = (t: number) => Math.sin((Math.PI / 2) * t)
const pMaskOfT = (t: number) => Math.sin((Math.PI / 2) * t)

export function ScheduleMismatch() {
  const [mode, setMode] = useState<Mode>("md4")
  const [t, setT] = useState(0.55)

  const fixedMaskProb = 0 // by construction, in both formulations, this is what MD4 gives you
  const freeMaskProb = pMaskOfT(t)
  const expectedNoise = bOfT(t)
  const actualNoiseAtFixed = 0 // clamped to the clean value regardless of t
  const mismatch = mode === "md4" ? 0 : expectedNoise - actualNoiseAtFixed

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">holding one voxel fixed, two ways</span>
        <div className="flex gap-1">
          {(
            [
              { v: "md4" as Mode, label: "MD4 (masked)" },
              { v: "ddpm" as Mode, label: "DDPM (continuous)" },
            ]
          ).map((o) => (
            <button
              key={o.v}
              type="button"
              onClick={() => setMode(o.v)}
              aria-pressed={mode === o.v}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 transition-colors",
                mode === o.v ? "text-background" : "text-muted-foreground hover:text-foreground"
              )}
              style={mode === o.v ? { background: mode === "ddpm" ? WARN : ACCENT } : undefined}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-4">
          <div className="mb-1 flex items-center justify-between font-mono text-xs text-muted-foreground">
            <span>process position t</span>
            <span className="tabular-nums text-foreground">{t.toFixed(2)}</span>
          </div>
          <Range
            min={0}
            max={1}
            step={0.01}
            value={t}
            onChange={(e) => setT(parseFloat(e.target.value))}
            className="w-full cursor-pointer"
            aria-label="process position t"
            accent={mode === "ddpm" ? WARN : ACCENT}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="w-52 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {mode === "md4" ? "P(mask) at the fixed voxel" : "noise the schedule expects there"}
            </span>
            <div className="relative h-4 flex-1 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-200"
                style={{
                  width: `${(mode === "md4" ? fixedMaskProb : expectedNoise) * 100}%`,
                  background: mode === "md4" ? ACCENT : WARN,
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {(mode === "md4" ? fixedMaskProb : expectedNoise).toFixed(2)}
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="w-52 shrink-0 text-right font-mono text-[11px] text-muted-foreground">
              {mode === "md4" ? "P(mask), an ordinary free voxel" : "noise actually there (clamped clean)"}
            </span>
            <div className="relative h-4 flex-1 rounded-sm bg-muted/30">
              <div
                className="absolute inset-y-0 left-0 rounded-sm transition-all duration-200"
                style={{
                  width: `${(mode === "md4" ? freeMaskProb : actualNoiseAtFixed) * 100}%`,
                  background: "oklch(0.62 0.02 260)",
                }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-xs tabular-nums text-foreground">
              {(mode === "md4" ? freeMaskProb : actualNoiseAtFixed).toFixed(2)}
            </span>
          </div>
        </div>

        <div
          className="mt-3 rounded-md border px-3 py-2 font-mono text-xs"
          style={{ borderColor: mismatch > 0.01 ? WARN : ACCENT }}
        >
          schedule mismatch at the fixed voxel:{" "}
          <span style={{ color: mismatch > 0.01 ? WARN : ACCENT }}>{mismatch.toFixed(2)}</span>
          {mismatch > 0.01 ? " — needs RePaint-style resampling to reconcile" : " — nothing to reconcile"}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "md4" ? (
            <>
              MD4 masks each voxel independently, so a user-fixed voxel just has its
              masking probability locked to 0, for every t — it was never a candidate for
              corruption. An ordinary free voxel still follows the real schedule,
              p<sub>mask</sub>(t) = sin(πt/2), climbing toward 1 as t → 1. There is no
              conflict between the two, at any point in the process — that is the entire
              reason inpainting falls out for free.
            </>
          ) : (
            <>
              DDPM&rsquo;s forward process adds noise to <em>every</em>{" "}position on one
              global schedule — clean voxels aren&rsquo;t a special case the model was
              trained to expect. Clamp the fixed voxel to its clean embedding mid-sampling
              and the model still assumes it should see noise amplitude b(t) there; it
              sees 0 instead. That gap grows with t and is exactly the distribution the
              network never saw during training — closing it needs extra machinery
              (RePaint-style re-noise-and-resample), which the paper notes but does not
              fully solve.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
