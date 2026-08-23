"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog2 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Why the weights never leave flash.
//
// A CQ-quantized [out, in] matrix stores 2-bit codebook indices plus one fp16 L2
// norm per 128-element group, and reconstruction needs a Walsh-Hadamard
// transform: w_group = (codebook[idx] * norm) @ H.
//
// H is symmetric and orthogonal, so (unit·H)·x  ==  unit·(H·x). The transform can
// move off the weights and onto the activation — and the activation is shared by
// every output row, so the cost drops by exactly a factor of `out`.
//
// That is the whole reason a 13.7 MB model runs on a chip with 512 KB of RAM:
// the packed bytes are read in place from memory-mapped flash and never expanded.
//
// mlog2 rather than Math.log2 so the bar geometry serializes identically on
// server and client (see lib/dmath).

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

const PRESETS = [
  { label: "the engine's 512×512 matvec", out: 512, inn: 512, g: 128 },
  { label: "the 8192×512 logits head", out: 8192, inn: 512, g: 128 },
] as const

const fmtBytes = (b: number) =>
  b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : b >= 1e3 ? `${(b / 1e3).toFixed(1)} KB` : `${b} B`

export function HadamardTrick() {
  const [out, setOut] = useState(512)
  const [inn, setInn] = useState(512)
  const g = 128

  const groups = Math.ceil(inn / g)
  const addsPerGroup = g * mlog2(g) // fast WHT butterfly: n log2 n

  // Transform the weights: every output row needs its own transform.
  const naiveAdds = out * groups * addsPerGroup
  // Transform the activation: once, shared by every row.
  const smartAdds = groups * addsPerGroup
  const ratio = naiveAdds / smartAdds

  // What the two approaches have to hold in RAM.
  const packedBytes = (out * inn * 2) / 8 + out * groups * 2 // 2-bit indices + fp16 norms
  const expandedBytes = out * inn * 4 // fp32

  const SRAM = 512 * 1024

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">(unit·H)·x ≡ unit·(H·x)</span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          {Math.round(ratio).toLocaleString()}× fewer adds
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2">
          {[
            {
              l: "transform the weights",
              sub: `${out.toLocaleString()} rows × ${groups} groups × ${addsPerGroup} adds`,
              v: naiveAdds,
              c: WARM,
            },
            {
              l: "transform the activation",
              sub: `${groups} groups × ${addsPerGroup} adds, shared by every row`,
              v: smartAdds,
              c: GOOD,
            },
          ].map((x) => (
            <div key={x.l}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="font-mono text-[11px] text-foreground">{x.l}</span>
                <span className="font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                  {x.v.toLocaleString()} adds
                </span>
              </div>
              <div className="mt-1 h-4 rounded-sm bg-muted/40">
                <div
                  className="h-4 rounded-sm"
                  style={{ width: `${Math.max(0.4, (x.v / naiveAdds) * 100)}%`, background: x.c }}
                />
              </div>
              <div className="mt-0.5 font-mono text-[9px] text-muted-foreground">{x.sub}</div>
            </div>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            { l: "output rows", v: out, set: setOut, min: 64, max: 8192, step: 64 },
            { l: "input dim", v: inn, set: setInn, min: 128, max: 2048, step: 128 },
          ].map((s) => (
            <div key={s.l} className="flex items-center gap-2">
              <span className="w-20 shrink-0 font-mono text-[10px] text-muted-foreground">{s.l}</span>
              <Range
                min={s.min}
                max={s.max}
                step={s.step}
                value={s.v}
                onChange={(e) => s.set(Number(e.target.value))}
                className="flex-1"
                aria-label={s.l}
                accent={ACCENT}
              />
              <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {s.v.toLocaleString()}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => { setOut(p.out); setInn(p.inn) }}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                out === p.out && inn === p.inn
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">packed, in flash</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>{fmtBytes(packedBytes)}</div>
            <div className="font-mono text-[9px] text-muted-foreground">read in place, never copied</div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">if expanded to fp32</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: WARM }}>{fmtBytes(expandedBytes)}</div>
            <div className="font-mono text-[9px] text-muted-foreground">
              {expandedBytes > SRAM ? `${(expandedBytes / SRAM).toFixed(1)}× the whole SRAM` : "fits in SRAM"}
            </div>
          </div>
          <div className="rounded-lg border bg-muted/20 px-3 py-2">
            <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">saving factor</div>
            <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>{Math.round(ratio).toLocaleString()}×</div>
            <div className="font-mono text-[9px] text-muted-foreground">exactly the row count</div>
          </div>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag the row count and watch the ratio track it exactly. That is not a coincidence —{" "}
          <span className="text-foreground">the saving is precisely the number of output rows</span>, because the
          activation transform is computed once and reused by every row, while a weight-side transform has to be
          redone for each. The identity is what makes the choice available; the sharing is what makes it worth
          taking.
          <br />
          <br />
          The second consequence matters more on this hardware. Because nothing is ever reconstructed, the 2-bit
          indices are read straight off memory-mapped flash by the dot product. The model is never{" "}
          <em>loaded</em>{" "}at all — <span className="text-foreground">startup is 48 ms</span>, and 13.7 MB of
          weights coexist with 512 KB of RAM without contradiction.
        </p>
      </div>
    </figure>
  )
}
