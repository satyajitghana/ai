"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Why speculative decoding speeds anything up. A cheap draft model proposes a
// chain of k tokens; the big target model verifies all of them in ONE forward
// pass and accepts the longest prefix that matches its own distribution, then
// samples one bonus token. If the draft is good (high acceptance rate α), the
// target emits many tokens per forward pass instead of one — the whole win.
// Token i survives only if it and every token before it are accepted, so its
// probability is α^i; expected accepted length is Σ α^i, and the target's own
// forward pass adds one guaranteed token. Drag α and the draft depth k.

const ACCENT = "oklch(0.62 0.15 235)"

export function DraftVerify() {
  const [alpha, setAlpha] = useState(0.8)
  const [k, setK] = useState(7)

  // expected accepted prefix length among the k drafted tokens
  const accepted =
    alpha === 1 ? k : (alpha * (1 - Math.pow(alpha, k))) / (1 - alpha)
  const tau = accepted + 1 // + the target's guaranteed bonus token
  // one verify cycle = one target forward pass, so tokens-per-pass ≈ speedup
  const speedup = tau

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        draft &amp; verify · one target pass can emit many tokens
      </div>
      <div className="p-3 sm:p-4">
        {/* the drafted chain */}
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          draft proposes {k} tokens · each shaded by its survival probability α^i
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from({ length: k }, (_, i) => {
            const p = Math.pow(alpha, i + 1)
            return (
              <span
                key={i}
                className="flex h-8 min-w-9 items-center justify-center rounded-md font-mono text-[10px] text-white"
                style={{ background: ACCENT, opacity: 0.25 + 0.75 * p }}
                title={`token ${i + 1}: P(accepted) = ${(p * 100).toFixed(0)}%`}
              >
                d{i + 1}
              </span>
            )
          })}
          <span
            className="flex h-8 min-w-9 items-center justify-center rounded-md border border-dashed font-mono text-[10px]"
            style={{ borderColor: ACCENT, color: ACCENT }}
            title="the target's guaranteed bonus token"
          >
            +1
          </span>
        </div>

        {/* readouts */}
        <div className="mt-4 grid grid-cols-2 gap-2 font-mono sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">acceptance rate α</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{alpha.toFixed(2)}</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="text-[10px] text-muted-foreground">accepted length τ</div>
            <div className="mt-0.5 text-lg tabular-nums" style={{ color: ACCENT }}>{tau.toFixed(2)}</div>
          </div>
          <div className="col-span-2 rounded-lg border bg-muted/20 px-3 py-2 sm:col-span-1">
            <div className="text-[10px] text-muted-foreground">tokens / target pass ≈ speedup</div>
            <div className="mt-0.5 text-lg tabular-nums text-foreground">{speedup.toFixed(2)}×</div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>α — per-token acceptance rate</span>
              <span className="tabular-nums text-foreground">{alpha.toFixed(2)}</span>
            </div>
            <Range min={0.4} max={0.98} step={0.01} value={alpha} onChange={(e) => setAlpha(+e.target.value)} className="w-full" aria-label="acceptance rate" accent={ACCENT} />
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>k — draft depth</span>
              <span className="tabular-nums text-foreground">{k}</span>
            </div>
            <Range min={2} max={12} step={1} value={k} onChange={(e) => setK(+e.target.value)} className="w-full" aria-label="draft depth" accent={ACCENT} />
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Acceptance is what everything hinges on. Because a token only counts if the whole prefix
          before it was accepted, its odds decay as <span style={{ color: ACCENT }}>α^i</span> — so a
          deeper draft has sharply diminishing returns, and the real lever is pushing α up. That is
          exactly what EAGLE-3 does: a better-trained draft raises acceptance, and{" "}
          <span className="text-foreground">τ is (almost) the speedup</span>. Verification stays
          exact — the target only ever emits tokens it would have sampled itself.
        </p>
      </div>
    </figure>
  )
}
