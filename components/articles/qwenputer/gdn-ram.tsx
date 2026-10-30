"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A six-row slice of one Gated DeltaNet head's state, with the delta rule written out in float64:
//   decay:  S <- S * g
//   write:  S <- S + beta * k (v - k^T S)       (k is the unit-length key)
//   read:   out = q^T S                          (q is the unit-length query)
// With a one-hot key and beta = 1 a write replaces exactly one row. Move beta below 1, let the gate fade the state,
// or smear the key over two rows and the memory stops being RAM. This is a JavaScript model of the recurrence,
// not the model: the measured counterpart (transformers' torch_recurrent_gated_delta_rule, fp32) is in the tables
// of the article.

const N = 6
const IDLE = 100
const GATES = [
  { t: "1.0 (never fades)", v: 1 },
  { t: "0.999", v: 0.999 },
  { t: "0.99", v: 0.99 },
]

function unitKey(addr: number, smear: number): number[] {
  const k = new Array<number>(N).fill(0)
  k[addr] = 1
  if (smear > 0) k[(addr + 1) % N] = smear
  const n = Math.sqrt(k.reduce((a, x) => a + x * x, 0))
  return k.map((x) => x / n)
}

export function GdnRam() {
  const [S, setS] = useState<number[]>(new Array(N).fill(0))
  const [want, setWant] = useState<(number | null)[]>(new Array(N).fill(null))
  const [addr, setAddr] = useState(2)
  const [val, setVal] = useState(200)
  const [beta, setBeta] = useState(1)
  const [smear, setSmear] = useState(0)
  const [gate, setGate] = useState(1)
  const [msg, setMsg] = useState("Write a value to a row, then read it back.")

  const write = () => {
    const k = unitKey(addr, smear)
    const pred = k.reduce((a, x, i) => a + x * S[i], 0)
    setS(S.map((s, i) => s + beta * k[i] * (val - pred)))
    setWant(want.map((w, i) => (i === addr ? val : w)))
    setMsg(`wrote ${val} to row ${addr} with beta ${beta.toFixed(2)}`)
  }
  const read = () => {
    const k = unitKey(addr, smear)
    const out = k.reduce((a, x, i) => a + x * S[i], 0)
    const w = want[addr]
    const err = w == null ? null : out - w
    setMsg(
      `read row ${addr}: ${out.toFixed(3)}` +
        (w == null ? " (nothing written there yet)" : ` · expected ${w} · error ${err! >= 0 ? "+" : ""}${err!.toFixed(3)}`)
    )
  }
  const idle = () => {
    const f = mpow(gate, IDLE)
    setS(S.map((s) => s * f))
    setMsg(`${IDLE} idle tokens at gate ${gate}: every row is multiplied by ${f.toFixed(4)}`)
  }
  const reset = () => {
    setS(new Array(N).fill(0))
    setWant(new Array(N).fill(null))
    setMsg("Cleared.")
  }

  const scale = Math.max(255, ...S.map((s) => Math.abs(s)))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        gated delta rule as RAM · six rows of one head&apos;s state · float64 model of the recurrence
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div className="space-y-2.5 text-xs">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 font-mono text-muted-foreground">address</span>
            {Array.from({ length: N }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setAddr(i)}
                aria-pressed={addr === i}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  addr === i ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                row {i}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-muted-foreground">value</span>
            <Range min={0} max={255} step={1} value={val} onChange={(e) => setVal(Number(e.target.value))} aria-label="value to write" className="w-full" />
            <span className="w-10 text-right font-mono tabular-nums">{val}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-muted-foreground">write beta</span>
            <Range min={0.1} max={1} step={0.05} value={beta} onChange={(e) => setBeta(Number(e.target.value))} aria-label="write strength beta" className="w-full" />
            <span className="w-10 text-right font-mono tabular-nums">{beta.toFixed(2)}</span>
          </label>
          <label className="flex items-center gap-2">
            <span className="w-20 shrink-0 font-mono text-muted-foreground">key smear</span>
            <Range min={0} max={1} step={0.05} value={smear} onChange={(e) => setSmear(Number(e.target.value))} aria-label="how much of the key leaks onto the next row" className="w-full" />
            <span className="w-10 text-right font-mono tabular-nums">{smear.toFixed(2)}</span>
          </label>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 font-mono text-muted-foreground">gate</span>
            {GATES.map((g) => (
              <button
                key={g.t}
                type="button"
                onClick={() => setGate(g.v)}
                aria-pressed={gate === g.v}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  gate === g.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {g.t}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {[
              { t: "write", f: write },
              { t: "read back", f: read },
              { t: `idle ${IDLE} tokens`, f: idle },
              { t: "clear", f: reset },
            ].map((b) => (
              <button key={b.t} type="button" onClick={b.f} className="rounded border px-2.5 py-1 font-mono text-[11px] hover:bg-muted">
                {b.t}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          {S.map((s, i) => {
            const w = want[i]
            const stale = w != null && Math.abs(s - w) > 0.5
            return (
              <div key={i} className="flex items-center gap-2 text-[11px]">
                <span className={cn("w-10 font-mono", i === addr ? "text-foreground" : "text-muted-foreground")}>row {i}</span>
                <div className="relative h-3 flex-1 overflow-hidden rounded bg-muted" role="img" aria-label={`row ${i} holds ${s.toFixed(2)}`}>
                  <div
                    className="h-full"
                    style={{
                      width: `${Math.min(100, (Math.abs(s) / scale) * 100).toFixed(1)}%`,
                      background: s < 0 ? "oklch(0.60 0.17 30)" : stale ? "oklch(0.70 0.15 80)" : "oklch(0.62 0.15 190)",
                    }}
                  />
                </div>
                <span className="w-16 text-right font-mono tabular-nums">{s.toFixed(2)}</span>
                <span className="w-14 text-right font-mono tabular-nums text-muted-foreground">{w == null ? "—" : `want ${w}`}</span>
              </div>
            )
          })}
        </div>
      </div>
      <div className="border-t px-4 py-2.5 font-mono text-[11px] text-muted-foreground" role="status" aria-live="polite">
        {msg}
      </div>
    </figure>
  )
}
