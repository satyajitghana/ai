"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"

// Sparse GQA explorer for Step 5 Preview. The geometry is read from the
// released config.json (stepfun-ai/Step-5-Preview): 92 layers, 23 of them
// full attention with the sparse indexer and 69 sliding-window layers (window
// 512); 64 query heads in 4 KV groups, head_dim 192; indexer proxy_dim 256,
// 16 indexer heads, region_block_size 8, topk 512 regions. Byte and FLOP
// formulas are my arithmetic on that config (reasoned), batch 1, BF16 K/V,
// FP8 region summaries as the reference kernel stores them. Which regions a
// group picks is learned; the pattern drawn here is a deterministic stand-in.
// Arithmetic is + - * / and integer hashing; the one log goes through dmath.

const LAYERS = 92
const FULL = 23
const SWA = 69
const WINDOW = 512
const HEADS = 64
const GROUPS = 4
const HEAD_DIM = 192
const PROXY = 256
const IDX_HEADS = 16

const KV_TOKEN_LAYER = 2 * GROUPS * HEAD_DIM * 2 // K and V, BF16: 3,072 bytes
const KV_TOKEN_GROUP = 2 * HEAD_DIM * 2 // one group's K and V: 768 bytes
const ATTN_FLOP_KEY = HEADS * HEAD_DIM * 4 // QK and PV, multiply-add = 2: 49,152
const IDX_FLOP_REGION = IDX_HEADS * PROXY * 2 // weighted-ReLU scores: 8,192
const SUMMARY_BYTES = PROXY // one FP8 summary per region per layer

const CTX_EXP = [12, 13, 14, 15, 16, 17, 18, 19, 20] // 4K .. 1M tokens
const BLOCKS = [1, 4, 8, 16, 32]
const BUDGETS = [2048, 4096, 8192]
const CELLS = 64

function pow2(e: number) {
  let v = 1
  for (let i = 0; i < e; i++) v *= 2
  return v
}

function fmtTok(t: number) {
  if (t >= 1048576) return `${t / 1048576}M`
  return `${t / 1024}K`
}

function fmtBytes(b: number) {
  if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GiB`
  if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MiB`
  return `${(b / 1024).toFixed(1)} KiB`
}

function fmtFlop(f: number) {
  if (f >= 1e12) return `${(f / 1e12).toFixed(2)} TFLOP`
  if (f >= 1e9) return `${(f / 1e9).toFixed(2)} GFLOP`
  return `${(f / 1e6).toFixed(1)} MFLOP`
}

// small integer hash, identical on every engine
function hash(a: number, b: number) {
  let h = Math.imul(a + 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x27d4eb2f, 0xc2b2ae35)
  h ^= h >>> 15
  h = Math.imul(h, 0x2c1b3c6d)
  h ^= h >>> 12
  return (h >>> 0) / 4294967296
}

// Spread one group's selected regions over CELLS spans of history: a stand-in
// pattern with a few "hot" spans per group and more weight near the end.
function groupPattern(group: number, regions: number, picks: number) {
  const per = regions / CELLS
  const out = new Array<number>(CELLS).fill(0)
  if (picks >= regions) return out.map(() => 1)
  const w = Array.from({ length: CELLS }, (_, c) => {
    const r = hash(group * 131 + 7, c)
    const hot = r > 0.86 ? 6 : r > 0.7 ? 2 : 0.25
    return hot + (c / CELLS) * (c / CELLS) * 3
  })
  let left = picks
  const open = new Set<number>(Array.from({ length: CELLS }, (_, c) => c))
  for (let pass = 0; pass < 8 && left > 0.5 && open.size > 0; pass++) {
    let total = 0
    open.forEach((c) => (total += w[c]))
    let used = 0
    open.forEach((c) => {
      const give = (left * w[c]) / total
      const room = per - out[c] * per
      const take = Math.min(give, room)
      out[c] += take / per
      used += take
      if (out[c] >= 0.999) open.delete(c)
    })
    left -= used
  }
  return out
}

function Seg({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  options: readonly { v: number; name: string }[]
}) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="w-32 shrink-0 text-xs text-muted-foreground">{label}</span>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => onChange(o.v)}
          aria-pressed={value === o.v}
          className={
            "rounded-md border px-2 py-0.5 text-xs transition-colors " +
            (value === o.v ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:bg-muted/40")
          }
        >
          {o.name}
        </button>
      ))}
    </div>
  )
}

export function SparseGqaExplorer() {
  const [ci, setCi] = useState(CTX_EXP.length - 1)
  const [block, setBlock] = useState(8)
  const [budget, setBudget] = useState(4096)

  const L = pow2(CTX_EXP[ci])
  const regions = L / block
  const picks = Math.min(regions, budget / block)
  const seen = Math.min(L, budget + block) // selected regions plus the current one

  // resident cache (reasoned)
  const denseKv = LAYERS * KV_TOKEN_LAYER * L
  const swaKv = SWA * KV_TOKEN_LAYER * Math.min(L, WINDOW)
  const fullKv = FULL * KV_TOKEN_LAYER * L
  const summaries = FULL * SUMMARY_BYTES * regions
  const stepKv = swaKv + fullKv + summaries

  // bytes read per decoded token (reasoned)
  const denseRead = denseKv
  const readIdx = summaries
  const readSel = FULL * GROUPS * KV_TOKEN_GROUP * seen
  const stepRead = swaKv + readIdx + readSel

  // attention-side FLOPs per decoded token (reasoned)
  const denseFlop = LAYERS * ATTN_FLOP_KEY * L
  const fSwa = SWA * ATTN_FLOP_KEY * Math.min(L, WINDOW)
  const fSel = FULL * ATTN_FLOP_KEY * seen
  const fIdx = FULL * IDX_FLOP_REGION * regions
  const stepFlop = fSwa + fSel + fIdx
  const weightsFlop = 2 * 26583227840 // measured active parameters without the embedding lookup

  const swaCells = Array.from({ length: CELLS }, (_, c) => {
    const lo = (c * L) / CELLS
    const hi = ((c + 1) * L) / CELLS
    const from = Math.max(lo, L - WINDOW)
    return hi <= from ? 0 : (hi - from) / (hi - lo)
  })
  const groups = Array.from({ length: GROUPS }, (_, g) => groupPattern(g, regions, picks))

  const parts = [
    { k: "swa", label: "sliding layers", v: fSwa, cls: "bg-sky-500/70" },
    { k: "sel", label: "sparse attention", v: fSel, cls: "bg-emerald-500/70" },
    { k: "idx", label: "indexer", v: fIdx, cls: "bg-amber-500/80" },
    { k: "w", label: "weights (27B active)", v: weightsFlop, cls: "bg-muted-foreground/40" },
  ]
  const partTotal = parts.reduce((s, p) => s + p.v, 0)
  const ratio = (a: number, b: number) => {
    const r = a / b
    return r >= 10 ? `${r.toFixed(0)}x` : `${r.toFixed(1)}x`
  }
  // log-scaled bar for "fraction of dense read", from 1e-4 to 1
  const fracBar = (x: number) => {
    const lg = mlog10(Math.max(x, 1e-4))
    return `${(((lg + 4) / 4) * 100).toFixed(2)}%`
  }

  const cell = (v: number, tone: string) => ({
    background: v <= 0 ? "transparent" : tone,
    opacity: v <= 0 ? 1 : 0.18 + 0.82 * v,
  })

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="space-y-2">
        <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className="w-32 shrink-0">Context length</span>
          <Range
            min={0}
            max={CTX_EXP.length - 1}
            step={1}
            value={ci}
            onChange={(ev) => setCi(Number(ev.target.value))}
            className="min-w-0 flex-1"
            aria-label="Context length"
          />
          <span className="w-12 text-right font-mono text-foreground">{fmtTok(L)}</span>
        </label>
        <Seg
          label="Block size B"
          value={block}
          onChange={setBlock}
          options={BLOCKS.map((b) => ({ v: b, name: b === 8 ? "8 (shipped)" : String(b) }))}
        />
        <Seg
          label="Token budget k"
          value={budget}
          onChange={setBudget}
          options={BUDGETS.map((b) => ({ v: b, name: b === 4096 ? "4,096 (shipped)" : b.toLocaleString("en-US") }))}
        />
      </div>

      <div className="mt-4 space-y-1">
        <div className="flex items-baseline justify-between text-[11px] text-muted-foreground">
          <span>oldest token</span>
          <span>
            each cell = {L / CELLS >= 1024 ? fmtTok(L / CELLS) : `${L / CELLS} tokens`} of history; the query is at the right edge
          </span>
          <span>newest</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-24 shrink-0 text-[11px] text-muted-foreground">sliding layer</span>
          <div className="grid flex-1 gap-px" style={{ gridTemplateColumns: `repeat(${CELLS}, minmax(0, 1fr))` }}>
            {swaCells.map((v, c) => (
              <div key={c} className="h-3 rounded-[1px] border border-border/40" style={cell(v, "rgb(14 165 233)")} />
            ))}
          </div>
        </div>
        {groups.map((row, g) => (
          <div key={g} className="flex items-center gap-2">
            <span className="w-24 shrink-0 text-[11px] text-muted-foreground">sparse, KV group {g + 1}</span>
            <div className="grid flex-1 gap-px" style={{ gridTemplateColumns: `repeat(${CELLS}, minmax(0, 1fr))` }}>
              {row.map((v, c) => (
                <div key={c} className="h-3 rounded-[1px] border border-border/40" style={cell(v, "rgb(16 185 129)")} />
              ))}
            </div>
          </div>
        ))}
        <p className="pt-1 text-[11px] text-muted-foreground">
          {picks >= regions
            ? `At ${fmtTok(L)} the budget covers all ${regions.toLocaleString("en-US")} regions: sparse attention is dense attention here.`
            : `Each group keeps ${picks.toLocaleString("en-US")} of ${regions.toLocaleString("en-US")} regions (${((picks / regions) * 100).toFixed(2)}%), plus the region the query sits in. Which ones is learned; this pattern is a stand-in.`}
        </p>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[420px] text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-1 pr-2 font-normal">per sequence, batch 1</th>
              <th className="py-1 pr-2 text-right font-normal">dense GQA, 92 full layers</th>
              <th className="py-1 pr-2 text-right font-normal">Step 5 layout</th>
              <th className="py-1 text-right font-normal">saving</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            <tr className="border-t">
              <td className="py-1 pr-2 font-sans">KV cache held</td>
              <td className="py-1 pr-2 text-right">{fmtBytes(denseKv)}</td>
              <td className="py-1 pr-2 text-right">{fmtBytes(stepKv)}</td>
              <td className="py-1 text-right">{ratio(denseKv, stepKv)}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1 pr-2 font-sans">KV bytes read per new token</td>
              <td className="py-1 pr-2 text-right">{fmtBytes(denseRead)}</td>
              <td className="py-1 pr-2 text-right">{fmtBytes(stepRead)}</td>
              <td className="py-1 text-right">{ratio(denseRead, stepRead)}</td>
            </tr>
            <tr className="border-t">
              <td className="py-1 pr-2 font-sans">attention FLOPs per new token</td>
              <td className="py-1 pr-2 text-right">{fmtFlop(denseFlop)}</td>
              <td className="py-1 pr-2 text-right">{fmtFlop(stepFlop)}</td>
              <td className="py-1 text-right">{ratio(denseFlop, stepFlop)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-3">
        <div className="mb-1 text-[11px] text-muted-foreground">
          Step 5 bytes read as a share of dense (log scale, 0.01% to 100%):{" "}
          <span className="font-mono text-foreground">{((stepRead / denseRead) * 100).toFixed(2)}%</span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded bg-muted/40">
          <div className="h-full bg-primary/70" style={{ width: fracBar(stepRead / denseRead) }} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[11px] text-muted-foreground">Where one decoded token&apos;s FLOPs go</div>
        <div className="flex h-5 w-full overflow-hidden rounded border bg-background">
          {parts.map((p) => (
            <div key={p.k} className={p.cls} style={{ width: `${((p.v / partTotal) * 100).toFixed(2)}%` }} title={`${p.label}: ${fmtFlop(p.v)}`} />
          ))}
        </div>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {parts.map((p) => (
            <span key={p.k} className="inline-flex items-center gap-1">
              <span className={`inline-block h-2.5 w-2.5 rounded-sm ${p.cls}`} />
              {p.label} <span className="font-mono text-foreground">{fmtFlop(p.v)}</span>
            </span>
          ))}
        </div>
      </div>

      <figcaption className="mt-3 text-xs text-muted-foreground">
        Geometry from Step 5 Preview&apos;s <code>config.json</code> (measured); bytes and FLOPs are my arithmetic on it
        (reasoned): BF16 K/V, FP8 region summaries, batch 1, multiply-add counted as two FLOPs. The dense column is the
        same heads and groups with full attention on all 92 layers. Real kernels add overheads this ignores.
      </figcaption>
    </figure>
  )
}
