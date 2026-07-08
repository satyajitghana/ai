"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Why RL entropy collapses, and how top-p "sampling distribution replay" holds it.
//
// Three tokens with logits x1 > x2 >> x3. Sampling the junk token x3 on an off-track
// rollout carries NEGATIVE advantage, and its policy-gradient on the logits is
//   ∇log p3 = [-p1, -p2, p1+p2]   →   Δx = |Â|·[p1, p2, -(p1+p2)]  (since Â<0)
// so the already-dominant token's logit rises MORE than the runner-up: the distribution
// sharpens and entropy bleeds every step. Top-p replay masks x3 out of the sampling set,
// so it never becomes an optimization target — entropy stays put.
//
// SSR-safe: distribution at a given step is recomputed from base logits in a bounded
// for-loop (step ≤ MAX). No timers, no Math.random; first render is deterministic.

const KEPT = "oklch(0.68 0.14 235)" // in the top-p keep-set — blue
const CUT = "oklch(0.62 0.19 25)" // excluded from keep-set — red
const GAUGE = "oklch(0.70 0.15 160)" // entropy gauge — teal-green

const X0 = [1.8, 1.0, -0.6] // base logits: x1 > x2 >> x3
const K = 0.55 // η·|Â| — update scale
const MAX = 6
const TOP_P = 0.9
const NAMES = ["A", "B", "C"]
const LN3 = Math.log(3)

function softmax(x: number[]) {
  const m = Math.max(...x)
  const e = x.map((v) => Math.exp(v - m))
  const s = e.reduce((a, b) => a + b, 0)
  return e.map((v) => v / s)
}

function entropy(p: number[]) {
  let h = 0
  for (const pi of p) if (pi > 0) h -= pi * Math.log(pi)
  return h
}

// Apply the "sample junk token, Â<0" collapse update `step` times (bounded by MAX).
function logitsAtStep(step: number) {
  let x = [...X0]
  const n = Math.max(0, Math.min(step, MAX))
  for (let s = 0; s < n; s++) {
    const p = softmax(x)
    x = [x[0] + K * p[0], x[1] + K * p[1], x[2] - K * (p[0] + p[1])]
  }
  return x
}

// which indices fall inside the top-p keep-set (sorted desc, cumulate to TOP_P)
function keepSet(p: number[]) {
  const order = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0])
  const keep = new Set<number>()
  let cum = 0
  for (const [v, i] of order) {
    keep.add(i)
    cum += v
    if (cum >= TOP_P) break
  }
  return keep
}

export function EntropyCollapse() {
  const [replay, setReplay] = useState(false)
  const [step, setStep] = useState(0)

  const x = replay ? X0 : logitsAtStep(step)
  const p = softmax(x)
  const keep = keepSet(p)
  const H = entropy(p)
  const hNorm = H / LN3

  // gradient on the logits for the "sample C, Â<0" update (display only)
  const grad = [K * p[0], K * p[1], -K * (p[0] + p[1])]

  const collapsed = hNorm < 0.25
  const atMax = step >= MAX

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>policy entropy · 3-token toy softmax</span>
        <label className="flex cursor-pointer items-center gap-2">
          <span className={cn(replay ? "text-foreground" : "text-muted-foreground/70")}>top-p replay</span>
          <button
            type="button"
            role="switch"
            aria-checked={replay}
            onClick={() => setReplay((r) => !r)}
            className={cn(
              "relative h-4 w-7 cursor-pointer rounded-full transition-colors",
              replay ? "bg-[oklch(0.68_0.14_235)]" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-background transition-all",
                replay ? "left-3.5" : "left-0.5"
              )}
            />
          </button>
        </label>
      </div>

      <div className="p-3 sm:p-4">
        {/* token rows */}
        <div className="space-y-2.5">
          {p.map((pi, i) => {
            const inKeep = keep.has(i)
            const masked = replay && !inKeep
            const color = inKeep ? KEPT : CUT
            return (
              <div key={i} className="flex items-center gap-3">
                <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                  token {NAMES[i]}
                </span>
                <div className="relative h-6 flex-1">
                  <div className="absolute inset-0 rounded bg-muted/40" />
                  <div
                    className={cn("absolute top-0 left-0 h-6 rounded transition-all duration-300", masked && "opacity-30")}
                    style={{
                      width: `${Math.max(pi * 100, 1)}%`,
                      background: color,
                      backgroundImage: masked
                        ? "repeating-linear-gradient(45deg,transparent,transparent 3px,rgba(0,0,0,0.25) 3px,rgba(0,0,0,0.25) 6px)"
                        : undefined,
                    }}
                  />
                  <span
                    className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[11px] tabular-nums text-foreground"
                    style={{ left: `${Math.min(pi * 100, 82)}%` }}
                  >
                    {(pi * 100).toFixed(1)}%
                  </span>
                </div>
                {/* gradient arrow for the sample-C update */}
                <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums">
                  {masked ? (
                    <span style={{ color: CUT }}>masked</span>
                  ) : (
                    <span style={{ color: grad[i] >= 0 ? KEPT : CUT }}>
                      {grad[i] >= 0 ? "▲" : "▼"} {Math.abs(grad[i]).toFixed(2)}
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        {/* keep-set / threshold note */}
        <div className="mt-3 font-mono text-[10px] text-muted-foreground">
          top-p = {TOP_P} keep-set: {Array.from(keep).sort().map((i) => NAMES[i]).join(", ")}
          {keep.size < 3 ? (
            <span>
              {" "}
              · <span style={{ color: CUT }}>{NAMES.filter((_, i) => !keep.has(i)).join(", ")} excluded</span>
            </span>
          ) : null}
          {keep.size === 1 ? <span> · keep-set size 1 → gradient zeroed</span> : null}
        </div>

        {/* entropy gauge */}
        <div className="mt-4 rounded-md bg-muted/40 px-3 py-2.5">
          <div className="flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>policy entropy H / ln 3</span>
            <span className="tabular-nums" style={{ color: collapsed ? CUT : GAUGE }}>
              {H.toFixed(3)} nats · {(hNorm * 100).toFixed(0)}%{collapsed ? " · collapsing" : ""}
            </span>
          </div>
          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${hNorm * 100}%`, background: collapsed ? CUT : GAUGE }}
            />
          </div>
        </div>

        {/* controls */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={replay || atMax}
            onClick={() => setStep((s) => Math.min(s + 1, MAX))}
            className={cn(
              "cursor-pointer rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors",
              replay || atMax
                ? "cursor-not-allowed bg-muted text-muted-foreground/50"
                : "bg-foreground text-background hover:opacity-90"
            )}
          >
            sample C, apply update (Â&lt;0)
          </button>
          <button
            type="button"
            onClick={() => setStep(0)}
            className="cursor-pointer rounded-md bg-muted px-3 py-1.5 font-mono text-[11px] text-muted-foreground transition-colors hover:text-foreground"
          >
            reset
          </button>
          <span className="font-mono text-[10px] text-muted-foreground">
            step {step} / {MAX}
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {replay ? (
            <>
              With <span className="text-foreground">top-p replay</span> on, token{" "}
              <span style={{ color: CUT }}>C</span> sits outside the keep-set, so it is never sampled and never becomes an
              optimization target. The collapse update can&apos;t fire — entropy holds. The trainer renormalizes over the{" "}
              <span className="text-foreground">same recorded mask</span> the sampler used, so train/inference divergence
              stays bounded instead of blowing up.
            </>
          ) : (
            <>
              Each step samples the junk token <span style={{ color: CUT }}>C</span> on an off-track rollout (negative
              advantage). The update pushes the dominant token <span style={{ color: KEPT }}>A</span> up more than the
              runner-up <span style={{ color: KEPT }}>B</span> and pushes <span style={{ color: CUT }}>C</span> down — the
              distribution <span className="text-foreground">sharpens</span> and entropy bleeds. Flip{" "}
              <span className="text-foreground">top-p replay</span> on to cut this path.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
