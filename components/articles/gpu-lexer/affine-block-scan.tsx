"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

// gpu-lexer's recurrence, one channel, as its WebGPU kernels evaluate it.
// Each part t carries a pair (a_t, b_t) with a_t = sigmoid(gate) in (0, 1) and
// b_t = (1 - a_t) * tanh(input), and the channel's state is
// h_t = a_t * h_{t-1} + b_t. An affine map composed with an affine map is
// another affine map, (a2, b2) o (a1, b1) = (a2 * a1, a2 * b1 + b2), so a block
// of parts summarises to ONE pair however long it is. The kernel does exactly
// this: serial inside a block (hybrid_scan_blocks), a Hillis-Steele scan over
// block pairs (hybrid_scan_prefixes), then each block replays from its carried
// start. The gate and input values here are hand-picked toys, not the model's
// weights: an opening-looking quote writes +1, a closing-looking quote writes
// -1, everything else lets the state leak slowly. Values reach the DOM only
// through toFixed on +, -, * results, so lib/dmath is not needed.

type Pair = { a: number; b: number }

const PARTS = ["x", " ", "=", " ", "\"", "a", " ", "b", "\"", ";", " ", "f", "(", "\"", "c", "\"", ")", ";", " ", "y", " ", "=", " ", "1", ";"]

// Toy features: look one part left and right, as gpu-lexer's local window does.
function pairFor(i: number): Pair {
  const p = PARTS[i]
  if (p === "\"") {
    const left = PARTS[i - 1] ?? " "
    const opening = left === " " || left === "(" || left === "="
    return opening ? { a: 0.05, b: 0.95 } : { a: 0.05, b: -0.95 }
  }
  return { a: 0.9, b: 0 }
}

const compose = (first: Pair, second: Pair): Pair => ({ a: second.a * first.a, b: second.a * first.b + second.b })

export function AffineBlockScan() {
  const [block, setBlock] = useState(4)

  const m = useMemo(() => {
    const pairs = PARTS.map((_, i) => pairFor(i))
    const serial: number[] = []
    let h = 0
    for (const { a, b } of pairs) {
      h = a * h + b
      serial.push(h)
    }
    const nb = Math.ceil(PARTS.length / block)
    const summaries = Array.from({ length: nb }, (_, k) =>
      pairs.slice(k * block, (k + 1) * block).reduce(compose, { a: 1, b: 0 })
    )
    // Hillis-Steele inclusive scan over block summaries.
    let cur = summaries
    let rounds = 0
    for (let d = 1; d < nb; d *= 2) {
      const prev = cur
      cur = prev.map((s, k) => (k >= d ? compose(prev[k - d], s) : s))
      rounds++
    }
    const start = Array.from({ length: nb }, (_, k) => (k === 0 ? 0 : cur[k - 1].b))
    const scanned: number[] = []
    for (let k = 0; k < nb; k++) {
      let y = start[k]
      for (const { a, b } of pairs.slice(k * block, (k + 1) * block)) {
        y = a * y + b
        scanned.push(y)
      }
    }
    const err = scanned.reduce((mx, v, i) => Math.max(mx, Math.abs(v - serial[i])), 0)
    return { pairs, serial, summaries, start, scanned, rounds, nb, err }
  }, [block])

  const bar = (v: number) => {
    const pct = Math.min(50, Math.abs(v) * 50)
    return v >= 0 ? { left: "50%", width: `${pct.toFixed(1)}%` } : { left: `${(50 - pct).toFixed(1)}%`, width: `${pct.toFixed(1)}%` }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>gpu-lexer&apos;s affine scan, one channel: blocks → pairs → scan → replay</span>
        <span className="text-muted-foreground/60">toy gates, real algorithm</span>
      </div>

      <div className="space-y-4 p-4 sm:p-5">
        <label className="block">
          <div className="mb-1 flex items-baseline justify-between font-mono text-[11px] text-muted-foreground">
            <span>parts per block (gpu-lexer uses 32)</span>
            <span className="tabular-nums text-foreground">{block}</span>
          </div>
          <Range min={2} max={8} step={1} value={block} onChange={(e) => setBlock(Number(e.target.value))} />
        </label>

        <div className="overflow-x-auto">
          <div className="flex gap-2 pb-1">
            {Array.from({ length: m.nb }, (_, k) => (
              <div key={k} className="shrink-0 rounded-md border px-1.5 py-1.5">
                <div className="mb-1 flex gap-0.5">
                  {PARTS.slice(k * block, (k + 1) * block).map((p, j) => {
                    const i = k * block + j
                    const v = m.scanned[i]
                    return (
                      <div key={j} className="w-6 text-center">
                        <div className="font-mono text-[12px] whitespace-pre">{p === " " ? "␣" : p}</div>
                        <div className="relative mx-auto mt-0.5 h-10 w-2 rounded-sm bg-muted/60">
                          <div
                            className="absolute left-0 w-2 rounded-sm"
                            style={{
                              background: v >= 0 ? "oklch(0.7 0.16 165)" : "oklch(0.65 0.17 25)",
                              bottom: v >= 0 ? "50%" : `${(50 - Math.min(50, Math.abs(v) * 50)).toFixed(1)}%`,
                              height: bar(v).width,
                            }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="font-mono text-[10px] leading-snug text-muted-foreground">
                  <div>
                    pair: a={m.summaries[k].a.toFixed(3)} b={m.summaries[k].b.toFixed(3)}
                  </div>
                  <div className="text-foreground">starts at h={m.start[k].toFixed(3)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="font-mono text-[11px] text-muted-foreground">
          {PARTS.length} parts → {m.nb} block pairs → {m.rounds} scan round{m.rounds === 1 ? "" : "s"} → replay. Largest
          difference from a plain left-to-right loop: {m.err < 1e-12 ? "below 1e-12" : m.err.toExponential(1)}. Each
          block, however long, is summarised by two numbers per channel.
        </p>
      </div>
    </figure>
  )
}
