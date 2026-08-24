"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The arithmetic that motivates the whole paper.
//
// A model suite is normally N independent training runs, and you pay for all N.
// If the sub-models are strictly nested — theta_1 subset theta_2 subset ... —
// the parameters you train are just the largest one, and every smaller exit comes
// out of the same run.
//
//   independent   = sum of the suite sizes
//   nested        = the largest size alone
//
// The paper's own opening example is a {1B, 8B, 30B, 70B} suite: 109B trained
// parameters as four runs, 70B as one. Their actual 3B suite is 5.2B against
// 3.2B, which is where the -38% headline comes from.
//
// Training compute follows the same ratio to first order, since forward FLOPs
// scale with activated parameters and both suites see the same 35B tokens. The
// measured figure is 36% rather than 38% because each exit also runs its own LM
// head and the junction adds a little. Stated the other way, as the paper's
// Table 2 does: the token-matched Vanilla baseline burns 57% more compute for the
// same 35B tokens.
//
// Sizes are editable because the saving is entirely a function of the shape of
// the suite, and that shape is a design decision people make casually.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PRESETS = [
  { label: "the paper's 3B suite", sizes: [0.5, 1.51, 3.19] },
  { label: "its own opening example", sizes: [1, 8, 30, 70] },
  { label: "a Llama-shaped suite", sizes: [1, 3, 8, 70, 405] },
  { label: "two sizes only", sizes: [1.5, 8] },
] as const

const fmt = (b: number) => (b >= 1 ? `${b.toFixed(b < 10 ? 2 : 0)}B` : `${Math.round(b * 1000)}M`)

export function SuiteLedger() {
  const [sizes, setSizes] = useState<number[]>([0.5, 1.51, 3.19])

  const independent = sizes.reduce((a, b) => a + b, 0)
  const nested = Math.max(...sizes)
  const saving = 1 - nested / independent
  const extra = independent / nested - 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          θ₁ ⊂ θ₂ ⊂ … ⊂ θ_M — every exit is a prefix of the next
        </span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          −{(saving * 100).toFixed(0)}% parameters trained
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setSizes([...p.sizes])}
              aria-pressed={sizes.length === p.sizes.length && sizes.every((s, i) => s === p.sizes[i])}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                sizes.length === p.sizes.length && sizes.every((s, i) => s === p.sizes[i])
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 space-y-3">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] text-foreground">
                {sizes.length} independent runs
              </span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: WARM }}>
                {fmt(independent)} trained
              </span>
            </div>
            <div className="mt-1 flex h-6 gap-[2px]">
              {sizes.map((s, i) => (
                <div
                  key={i}
                  className="flex h-6 items-center justify-center rounded-sm"
                  style={{ width: `${(s / independent) * 100}%`, background: WARM, opacity: 0.9 - i * 0.1 }}
                  title={`${fmt(s)} — its own run, its own data pass, its own optimizer state`}
                >
                  {(s / independent) * 100 > 12 ? (
                    <span className="font-mono text-[9px] text-[#0c0a09]">{fmt(s)}</span>
                  ) : null}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-mono text-[10px] text-foreground">one nested run</span>
              <span className="font-mono text-[10px] tabular-nums" style={{ color: GOOD }}>
                {fmt(nested)} trained
              </span>
            </div>
            <div className="mt-1 flex h-6 gap-[2px]">
              {sizes
                .slice()
                .sort((a, b) => a - b)
                .map((s, i, arr) => {
                  const inc = i === 0 ? s : s - arr[i - 1]
                  return (
                    <div
                      key={i}
                      className="flex h-6 items-center justify-center rounded-sm"
                      style={{ width: `${(inc / independent) * 100}%`, background: GOOD, opacity: 0.9 - i * 0.12 }}
                      title={`+${fmt(inc)} of new blocks, reaching the ${fmt(s)} exit`}
                    >
                      {(inc / independent) * 100 > 12 ? (
                        <span className="font-mono text-[9px] text-[#0c0a09]">+{fmt(inc)}</span>
                      ) : null}
                    </div>
                  )
                })}
              <div
                className="h-6 rounded-sm border border-dashed"
                style={{ width: `${(1 - nested / independent) * 100}%`, borderColor: "currentColor", opacity: 0.3 }}
              />
            </div>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {sizes.map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-14 shrink-0 font-mono text-[10px] text-muted-foreground">exit {i + 1}</span>
              <input
                type="number"
                min={0.05}
                step={0.05}
                value={s}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  if (!Number.isFinite(v) || v <= 0) return
                  setSizes((prev) => prev.map((x, j) => (j === i ? v : x)))
                }}
                aria-label={`size of exit ${i + 1} in billions of parameters`}
                className="w-24 rounded-md border bg-transparent px-2 py-1 font-mono text-[10px] tabular-nums text-foreground"
              />
              <span className="font-mono text-[9px] text-muted-foreground">B params</span>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">independent suite</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>
              {fmt(independent)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{sizes.length} runs, {sizes.length} data passes</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">nested suite</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
              {fmt(nested)}
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">one run, distillation included</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">what the old way costs</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>
              +{(extra * 100).toFixed(0)}%
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">to get the same set of exits</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The saving is entirely a function of the shape of the suite, and it grows with how many mid-sized models
          you ship. Two sizes buys you little. The paper&rsquo;s{" "}
          <span className="font-mono text-[11px] text-foreground">{"{1B, 8B, 30B, 70B}"}</span>{" "}example turns
          109B trained parameters into 70B; a five-size Llama-shaped ladder does better still, because everything
          below the top is being paid for twice under the usual arrangement.
          <br />
          <br />
          Training compute tracks the same ratio, since both suites see the same tokens and forward cost scales
          with activated parameters. The measured figure is 36% rather than 38% — each exit still runs its own LM
          head. Read the other way round, which is how the results table does it:{" "}
          <span className="text-foreground">the token-matched baseline burns 57% more compute</span>{" "}to reach the
          same three checkpoints, and gets no distillation for it.
        </p>
      </div>
    </figure>
  )
}
