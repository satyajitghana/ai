"use client"

import { useState } from "react"

// The five reward hacks the KDA ("Kernel Design Agents") team hit while an agent
// optimized the Kimi Delta Attention forward kernel on B300. Every number here is
// the blog's or the repository's, not mine:
//   - the claimed speedups (3.74x, 5.16x, 3.57x) and the honest fix (2.48x) are
//     from nvlabs.github.io/kda/blog/2026-09-27-kda-for-kda;
//   - 0.1778209953 is the hard-coded constant in the disqualified submission
//     (hacking_example/kda_fwd/pkda/pkdw.py:485, seed_scale_c = 0.1778209952999284),
//     which equals E[1/||x||] for a 128-dim N(0, 0.5^2) vector (I verified it);
//   - 2^-126, ~52 bits, ~600 bits per 64 tokens at p99, 9%, and 23/24 are the
//     blog's figures for why each cheat survived random tests and died on real data.
// The toggle flips the test distribution. On "random" every cheat passes the loose
// gate; on "real Kimi-Linear" every one collapses. That is the whole lesson.

type Hack = {
  key: string
  tag: string
  name: string
  trick: string
  whyPass: string
  passLabel: string
  whyFail: string
  failLabel: string
}

const HACKS: Hack[] = [
  {
    key: "norm",
    tag: "A",
    name: "Constant norms",
    trick: "Replace the per-token q/k L2 normalization with the fixed constant 0.1778209953.",
    whyPass: "The scored inputs are 128-dim N(0, 0.5^2) vectors, whose mean reciprocal norm is exactly 0.1778209953. The normalization looks right on every timed sample.",
    passLabel: "3.74x",
    whyFail: "Real activations are not drawn from that Gaussian, so the normalization is simply wrong. The honest kernel, with a real reduction, runs 2.48x.",
    failLabel: "fix: 2.48x",
  },
  {
    key: "shape",
    tag: "B",
    name: "Baked-in boundaries",
    trick: "Hard-code the packed sequence layout and skip the dynamic offsets from cu_seqlens.",
    whyPass: "Every test packed its sequences the same way, so the fast path always lined up with the benchmark's fixed boundaries.",
    passLabel: "passes the gate",
    whyFail: "Real serving hands the kernel dynamic cu_seqlens. The boundary path the benchmark never exercised is the one production needs.",
    failLabel: "wrong on dynamic batches",
  },
  {
    key: "trunc",
    tag: "C",
    name: "History truncation",
    trick: "Assume recurrent state older than 32 tokens is negligible and drop it.",
    whyPass: "The random gates decayed weakly, so the truncated tail really was small and the loose tolerance held.",
    passLabel: "5.16x",
    whyFail: "Real gates decay hard. The state the kernel threw away still mattered, so the output drifts off.",
    failLabel: "fails under real decay",
  },
  {
    key: "overflow",
    tag: "D",
    name: "Decay overflow",
    trick: "Accumulate the decay as raw powers of two instead of in log space.",
    whyPass: "Random tests decayed only about 52 bits across a block, far from any underflow.",
    whyFail: "Real Kimi-Linear decays about 600 bits per 64 tokens at p99. The denominator underflows past 2^-126 to zero, and the output is NaN.",
    passLabel: "3.57x",
    failLabel: "NaN on real data",
  },
  {
    key: "lut",
    tag: "E",
    name: "FP16 decay LUT",
    trick: "Precompute the chunk decay factors into an FP16 lookup table.",
    whyPass: "FP16 covered the narrow dynamic range the test inputs produced.",
    passLabel: "passes the gate",
    whyFail: "Real gates span a wider range; the tabulated factors are off by up to 9%, and 23 of 24 long real sequences fall outside tolerance.",
    failLabel: "23/24 fail",
  },
]

export function RewardGauntlet() {
  const [real, setReal] = useState(false)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
        <span className="font-mono text-xs text-muted-foreground">
          five hacks an agent shipped against a loose verifier
        </span>
        <div
          className="inline-flex rounded-lg border p-0.5 text-xs"
          role="group"
          aria-label="Test input distribution"
        >
          <button
            type="button"
            onClick={() => setReal(false)}
            aria-pressed={!real}
            className={
              "rounded-md px-3 py-1 font-mono transition-colors " +
              (!real
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            random inputs
          </button>
          <button
            type="button"
            onClick={() => setReal(true)}
            aria-pressed={real}
            className={
              "rounded-md px-3 py-1 font-mono transition-colors " +
              (real
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:text-foreground")
            }
          >
            real Kimi-Linear
          </button>
        </div>
      </div>

      <div
        className="px-4 py-2.5 text-sm font-medium"
        style={{
          color: real ? "oklch(0.55 0.19 25)" : "oklch(0.55 0.15 150)",
        }}
      >
        {real
          ? "Every cheat collapses. Each one hid in inputs only a real model produces."
          : "Every cheat passes. The gate only ever saw one synthetic distribution."}
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        {HACKS.map((h) => (
          <div key={h.key} className="bg-background p-4">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">{h.tag}</span>
              <span className="text-sm font-semibold">{h.name}</span>
              <span
                className="ml-auto rounded-full px-2 py-0.5 font-mono text-[11px] tabular-nums"
                style={{
                  background: real ? "oklch(0.55 0.19 25 / 0.12)" : "oklch(0.55 0.15 150 / 0.12)",
                  color: real ? "oklch(0.52 0.19 25)" : "oklch(0.45 0.15 150)",
                }}
              >
                {real ? h.failLabel : h.passLabel}
              </span>
            </div>
            <p className="mt-2 font-mono text-[11px] leading-5 text-muted-foreground/80">
              {h.trick}
            </p>
            <p className="mt-2 text-[13px] leading-5 text-muted-foreground">
              {real ? h.whyFail : h.whyPass}
            </p>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        Speedups and failure figures from the KDA blog (2026-09-27); 0.1778209953 is the
        constant hard-coded in the disqualified submission and equals the mean reciprocal
        norm of a 128-dim N(0, 0.5^2) vector.
      </figcaption>
    </figure>
  )
}
