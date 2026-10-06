"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Per head, per layer: how many numbers each answer keeps, and how many a
// softmax KV cache keeps after T tokens. The bar scale is logarithmic,
// because the interesting comparisons span four orders of magnitude.
// Spotlight is the odd one out: its stored size depends on how many lattice
// cells training learns to allocate, which Percepta has not reported, so the
// widget shows what one token touches (9 cells) and says the rest is unknown.

const DS = [64, 128, 256]
const NHA_M = 64

const r2 = (n: number) => Math.round(n * 100) / 100

function fmt(n: number): string {
  if (n >= 1e9) return `${r2(n / 1e9)}G`
  if (n >= 1e6) return `${r2(n / 1e6)}M`
  if (n >= 1e4) return `${Math.round(n / 1e3)}k`
  return n.toLocaleString("en-US")
}

function fmtTokens(n: number): string {
  if (n >= 1048576) return `${r2(n / 1048576)}M`
  if (n >= 1024) return `${r2(n / 1024)}k`
  return `${n}`
}

type Row = { id: string; label: string; formula: string; value: number; color: string; grows?: boolean; note?: string }

export function StateLedger() {
  const [tExp, setTExp] = useState(15) // T = 2^tExp
  const [di, setDi] = useState(1)
  const [j, setJ] = useState(4)
  const [e, setE] = useState(8)
  const [w, setW] = useState(32)

  const T = 2 ** tExp
  const d = DS[di]

  const rows: Row[] = [
    { id: "kv", label: "softmax KV cache", formula: "2·d·T", value: 2 * d * T, color: "oklch(0.6 0.17 25)", grows: true },
    { id: "gdn", label: "linear attn / DeltaNet / GDN", formula: "d²", value: d * d, color: "oklch(0.62 0.03 260)" },
    { id: "swila", label: `SwiLA, J = ${j}`, formula: "J·d²", value: j * d * d, color: "oklch(0.58 0.15 265)" },
    { id: "tri", label: `triadic, E = ${e}`, formula: "d·E·d", value: e * d * d, color: "oklch(0.62 0.16 45)" },
    { id: "nha", label: `NHA, m = ${NHA_M}, w = ${w}`, formula: "2·(m+w)·d", value: 2 * (NHA_M + w) * d, color: "oklch(0.6 0.12 160)" },
    {
      id: "spot",
      label: "Spotlight, touched per token",
      formula: "9·d²",
      value: 9 * d * d,
      color: "oklch(0.55 0.1 300)",
      note: "stored total: unreported",
    },
  ]

  const maxV = Math.max(...rows.map((r) => r.value), 2 * 256 * 2 ** 20)
  const minV = 64 * 64
  const lo = mlog10(minV / 2)
  const hi = mlog10(maxV)
  const width = (v: number) => r2(Math.max(1.5, ((mlog10(v) - lo) / (hi - lo)) * 100))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">numbers kept per head, per layer · log scale</span>
        <div className="flex gap-1">
          {DS.map((v, i) => (
            <button
              key={v}
              type="button"
              onClick={() => setDi(i)}
              aria-pressed={i === di}
              className={`cursor-pointer rounded-full border px-2 py-0.5 font-mono text-[11px] transition-colors ${
                i === di ? "border-foreground/40 text-foreground" : "border-transparent text-muted-foreground hover:border-foreground/25"
              }`}
            >
              d={v}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2.5">
          {rows.map((r) => {
            const crossover = r.grows ? null : Math.ceil(r.value / (2 * d))
            return (
              <div key={r.id}>
                <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 font-mono text-[11px]">
                  <span className="text-foreground">
                    {r.label} <span className="text-muted-foreground">{r.formula}</span>
                  </span>
                  <span className="text-muted-foreground">
                    <span className="tabular-nums text-foreground">{fmt(r.value)}</span> numbers
                    {crossover !== null ? <> · = KV cache at {fmtTokens(crossover)} tokens</> : null}
                    {r.note ? <> · {r.note}</> : null}
                  </span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-muted/40">
                  <div className="h-full rounded-full" style={{ width: `${width(r.value)}%`, background: r.color }} />
                </div>
              </div>
            )
          })}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Slider label="sequence length T" value={tExp} min={9} max={20} onChange={setTExp} shown={`${fmtTokens(T)} tokens`} />
          <Slider label="SwiLA mixtures J" value={j} min={1} max={8} onChange={setJ} shown={`${j}`} />
          <Slider label="triadic second key E" value={e} min={1} max={16} onChange={setE} shown={`${e}`} />
          <Slider label="NHA window w" value={w} min={0} max={256} step={16} onChange={setW} shown={`${w}`} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every fixed-state answer equals some KV cache length: divide its numbers by the 2·d a cache stores per token.
          At d = 128 a DeltaNet head is worth 64 tokens of one KV head; a triadic head at E = 8 is worth 512. These are
          per head, so a model with grouped-query attention, which shares one KV head across several query heads, moves
          the crossover further out. The SwiLA row uses one d for every mixture; the paper instead shrinks each
          mixture&rsquo;s d so that J·d² matches a DeltaNet budget.
        </p>
      </div>
    </figure>
  )
}

function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
  shown,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
  shown: string
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="tabular-nums text-foreground">{shown}</span>
      </div>
      <Range min={min} max={max} step={step} value={value} onChange={(ev) => onChange(+ev.target.value)} className="w-full" aria-label={label} />
    </div>
  )
}
