"use client"

import { useState } from "react"

// What "2B active" counts. Every number is a sum over tensor shapes in the ten
// safetensors headers of LiquidAI/LFM2.5-24B-A2B (23,971,587,712 parameters, all
// read with HTTP range requests). The embedding table is tied to the output head,
// so it is stored once; a token's embedding lookup reads one row of it, while
// the output projection multiplies by all of it.
// Only + - * / and Math.round reach the DOM.

const TOTAL = 23_971_587_712

const PARTS = [
  { id: "experts", label: "4 of 64 routed experts, 38 layers", n: 1_434_451_968, color: "#7c5cff" },
  { id: "conv", label: "30 short-conv mixers", n: 503_500_800, color: "#a78bfa" },
  { id: "dense", label: "dense FFN, layers 0-1", n: 144_703_488, color: "#c4b5fd" },
  { id: "attn", label: "10 GQA attention mixers", n: 104_857_600, color: "#0ea5e9" },
  { id: "small", label: "routers, norms, expert biases", n: 5_150_336, color: "#64748b" },
]
const HEAD = 262_144_000 // 128,000 x 2,048, tied with the embedding
const DORMANT = 21_516_779_520 // the other 60 experts in each MoE layer

const fmt = (n: number) => n.toLocaleString("en-US")
const b2 = (n: number) => Math.round(n / 10_000_000) / 100

export function ActiveLedger() {
  const [head, setHead] = useState(true)

  const body = PARTS.reduce((a, p) => a + p.n, 0)
  const active = body + (head ? HEAD : 0)
  const rows = head ? [...PARTS, { id: "head", label: "output head (tied embedding)", n: HEAD, color: "#f59e0b" }] : PARTS

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">parameters one token runs through</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured from the safetensors headers</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <label className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <input type="checkbox" checked={head} onChange={(e) => setHead(e.target.checked)} />
          <span>count the output head (the 128,000 x 2,048 matrix, tied to the embedding)</span>
        </label>

        <div>
          <div className="flex h-8 w-full overflow-hidden rounded-md border" aria-hidden>
            {rows.map((p) => (
              <div key={p.id} style={{ width: `${(p.n / active) * 100}%`, background: p.color }} title={p.label} />
            ))}
          </div>
          <div className="mt-2 grid gap-1 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
            {rows.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-1.5">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: p.color }} />
                  {p.label}
                </span>
                <span className="text-foreground">{fmt(p.n)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-2 font-mono text-[11px] sm:grid-cols-3">
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">active per token</div>
            <div className="text-lg text-foreground">{b2(active)}B</div>
            <div className="text-[10px] text-muted-foreground">{fmt(active)}</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">stored, never run for this token</div>
            <div className="text-lg text-foreground">{b2(DORMANT)}B</div>
            <div className="text-[10px] text-muted-foreground">60 idle experts x 38 layers</div>
          </div>
          <div className="rounded-lg border bg-background/60 p-2.5">
            <div className="text-muted-foreground">share of the checkpoint</div>
            <div className="text-lg text-foreground">{Math.round((active / TOTAL) * 1000) / 10}%</div>
            <div className="text-[10px] text-muted-foreground">of {fmt(TOTAL)}</div>
          </div>
        </div>

        <p className="font-mono text-[9px] leading-4 text-muted-foreground">
          With the head, the count is 2.45B, the model card&rsquo;s own &ldquo;Active parameters&rdquo; line. Without
          it, 2.19B. The name&rsquo;s &ldquo;A2B&rdquo; is the second number rounded down; the card&rsquo;s figure is the first.
        </p>
      </div>
    </figure>
  )
}
