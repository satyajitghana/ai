"use client"

import { useState } from "react"

// The fixed-budget payoff, honestly. MSA attends to a fixed 2,048 tokens per query
// (top-16 blocks × 128) no matter how long the context is — so the *fraction* of the
// context each query looks at collapses as context grows: 6% at 32k, 0.2% at 1M. But
// the measured wall-clock speedup (14.2× prefill / 7.6× decode at 1M on H800) is far
// less than 1/fraction, because the Index Branch still scans every block and sparse
// memory access is irregular. Slide the context length and watch both truths.

const SEL = "oklch(0.62 0.15 250)"
const BUDGET = 2048 // 16 blocks × 128 tokens

const LENS = [
  { label: "32k", n: 32768, prefill: 1.6, decode: 1.4 },
  { label: "64k", n: 65536, prefill: 2.5, decode: 2.0 },
  { label: "128k", n: 131072, prefill: 4.1, decode: 3.0 },
  { label: "256k", n: 262144, prefill: 6.6, decode: 4.3 },
  { label: "512k", n: 524288, prefill: 9.9, decode: 5.8 },
  { label: "1M", n: 1048576, prefill: 14.2, decode: 7.6 },
] as const

export function SparsityAtScale() {
  const [i, setI] = useState(LENS.length - 1)
  const cur = LENS[i]
  const frac = (BUDGET / cur.n) * 100
  const naive = cur.n / BUDGET

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>fixed budget · a smaller slice of a bigger context</span>
        <span className="text-muted-foreground/60">measured on H800 (paper, Fig. 4)</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="mb-3 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat label="context length" value={cur.label} tokens={`${cur.n.toLocaleString()} tok`} />
          <Stat label="attended / query" value="2,048" tokens="16 blocks × 128" accent />
          <Stat label="fraction attended" value={`${frac < 1 ? frac.toFixed(2) : frac.toFixed(1)}%`} tokens={`1 / ${Math.round(naive)}`} accent />
          <Stat label="decode speedup" value={`${cur.decode}×`} tokens={`prefill ${cur.prefill}×`} />
        </div>

        {/* the shrinking slice */}
        <div className="mt-4">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">of the full context, MSA attends the blue sliver:</div>
          <div className="relative h-6 w-full overflow-hidden rounded-md bg-muted">
            <div className="h-full rounded-md transition-all duration-300" style={{ width: `${Math.max(frac, 0.35)}%`, background: SEL }} />
            <span className="absolute inset-y-0 right-2 flex items-center font-mono text-[10px] text-muted-foreground">{cur.label} context</span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">context length (drag) · {cur.label}</div>
          <input type="range" min={0} max={LENS.length - 1} value={i} onChange={(e) => setI(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.15_250)]" />
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The fraction attended falls to <span style={{ color: SEL }}>0.2% at 1M</span> — but MSA is not 500× faster.
          The measured win is <span className="text-foreground">14.2× prefill / 7.6× decode</span> at 1M, because the
          Index Branch still <em>scores every block</em> (a small linear cost) and block-sparse memory access is less
          regular than dense. The gap between the theoretical 28.4× FLOP reduction and the wall-clock number is exactly
          that overhead — and the whole advantage is a <span className="text-foreground">long-context</span> phenomenon:
          at 32k it&apos;s barely 1.6×.
        </p>
      </div>
    </figure>
  )
}

function Stat({ label, value, tokens, accent }: { label: string; value: string; tokens: string; accent?: boolean }) {
  return (
    <div>
      <div className="font-mono text-[10px] text-muted-foreground">{label}</div>
      <div className="font-mono text-lg font-semibold tabular-nums" style={{ color: accent ? "oklch(0.62 0.15 250)" : "var(--foreground)" }}>{value}</div>
      <div className="font-mono text-[9px] text-muted-foreground/70">{tokens}</div>
    </div>
  )
}
