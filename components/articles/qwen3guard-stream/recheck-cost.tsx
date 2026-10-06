"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Token arithmetic, not a benchmark. A generative guard can only judge a whole
// text, so using one on a stream means re-submitting the accumulated response
// every C tokens (the report's simulation uses C = 32). A streaming guard with a
// KV cache runs each response token through the backbone once. This counts
// response tokens pushed through the guard's backbone in each scheme; it ignores
// the prompt (which both read), the generative guard's own output tokens, and the
// fact that prefill is parallel and so cheaper per token than decode. Those are
// why the report's measured wall-clock gap (its Figure 9) is smaller than this
// token ratio.

const W = 680
const H = 200
const PL = 44
const PR = 10
const PT = 12
const PB = 22
const GEN = "oklch(0.58 0.14 250)"
const STREAM = "oklch(0.6 0.2 25)"

function genTokens(len: number, chunk: number) {
  // checks after chunk, 2*chunk, ..., and a last one at len if it is not a multiple
  let total = 0
  for (let end = chunk; end < len + chunk; end += chunk) total += Math.min(end, len)
  return total
}

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

export function RecheckCost() {
  const [len, setLen] = useState(2048)
  const [chunk, setChunk] = useState(32)

  const gen = genTokens(len, chunk)
  const ratio = gen / len
  const maxY = genTokens(len, chunk)
  const steps = 48
  const sx = (x: number) => PL + (x / len) * (W - PL - PR)
  const sy = (y: number) => PT + (1 - y / maxY) * (H - PT - PB)
  const genPath = Array.from({ length: steps + 1 }, (_, i) => {
    const x = (i / steps) * len
    return `${i === 0 ? "M" : "L"} ${sx(x).toFixed(1)} ${sy(genTokens(Math.max(1, Math.round(x)), chunk)).toFixed(1)}`
  }).join(" ")
  const streamPath = `M ${sx(0).toFixed(1)} ${sy(0).toFixed(1)} L ${sx(len).toFixed(1)} ${sy(len).toFixed(1)}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>response tokens through the guard backbone</span>
        <span className="text-muted-foreground/60">counted, not timed</span>
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`For a ${len}-token response checked every ${chunk} tokens, the generative guard reads ${fmt(gen)} response tokens and the streaming guard reads ${fmt(len)}, a ratio of ${ratio.toFixed(1)}.`}
        >
          <line x1={PL} x2={W - PR} y1={sy(0)} y2={sy(0)} stroke="var(--border)" />
          <line x1={PL} x2={PL} y1={PT} y2={sy(0)} stroke="var(--border)" />
          <path d={genPath} fill="none" stroke={GEN} strokeWidth={2} />
          <path d={streamPath} fill="none" stroke={STREAM} strokeWidth={2} />
          <text x={W - PR - 4} y={sy(maxY) + 12} textAnchor="end" fontSize={10} fill={GEN} className="font-mono">
            generative guard, re-run every {chunk}
          </text>
          <text x={W - PR - 4} y={sy(len) - 6} textAnchor="end" fontSize={10} fill={STREAM} className="font-mono">
            streaming guard, once per token
          </text>
          <text x={PL - 4} y={sy(maxY) + 4} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            {maxY >= 1000 ? `${Math.round(maxY / 1000)}k` : maxY}
          </text>
          <text x={PL - 4} y={sy(0) + 3} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            0
          </text>
          <text x={W - PR} y={H - 6} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
            response length so far: {len} tokens
          </text>
        </svg>

        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">response length: {len} tokens</span>
            <Range min={128} max={8192} step={64} value={len} onChange={(e) => setLen(Number(e.target.value))} className="w-full cursor-pointer" accent={STREAM} />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">re-check every {chunk} tokens</span>
            <Range min={8} max={256} step={8} value={chunk} onChange={(e) => setChunk(Number(e.target.value))} className="w-full cursor-pointer" accent={GEN} />
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-x-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">generative guard</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: GEN }}>{fmt(gen)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">streaming guard</div>
            <div className="font-mono text-xl font-semibold tabular-nums" style={{ color: STREAM }}>{fmt(len)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">ratio</div>
            <div className="font-mono text-xl font-semibold tabular-nums">{ratio.toFixed(1)}×</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The re-checking guard&apos;s work grows with the square of the length, roughly <code>L²/2C</code>; the streaming guard&apos;s grows with <code>L</code>. A smaller
          chunk catches a problem sooner and costs more; a streaming guard does not have to choose.
        </p>
      </div>
    </figure>
  )
}
