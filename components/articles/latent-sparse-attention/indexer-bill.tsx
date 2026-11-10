"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One global attention layer on one H200, read off the paper's Figure 6 (layer times under each bar group) and
// Figure 2 (the indexer's share of GLM-5.3-Flash's own sparse attention), and the end-to-end rows of its Table 3.
// All REPORTED. Prefill times are for the last chunk of 32,768 queries before the given context; decode is one step
// of one request. Time to first token is the H200 rows of Table 3 (GLM with CP8, Qwen with TP8 and DCP8). The multiply-add counts are COMPUTED from the two models' config.json files and Table 2.
type Row = { ctx: string; base: number; lsa: number; x: string; share?: number; ttft?: string; blockTtft?: string }

const DATA: Record<string, Record<string, { base: string; rows: Row[] }>> = {
  glm: {
    prefill: {
      base: "its own block sparse attention",
      rows: [
        { ctx: "512k", base: 71.2, lsa: 33.7, x: "2.1", share: 67, ttft: "1.03" },
        { ctx: "1M", base: 120, lsa: 34.6, x: "3.5", share: 79, ttft: "1.09" },
        { ctx: "10M", base: 1510, lsa: 66.6, x: "22.7", share: 98, ttft: "2.24" },
      ],
    },
    decode: {
      base: "its own block sparse attention",
      rows: [
        { ctx: "512k", base: 0.193, lsa: 0.186, x: "1.0", share: 41 },
        { ctx: "1M", base: 0.239, lsa: 0.19, x: "1.3", share: 54 },
        { ctx: "10M", base: 1.15, lsa: 0.249, x: "4.6", share: 89 },
      ],
    },
  },
  qwen: {
    prefill: {
      base: "full attention",
      rows: [
        { ctx: "512k", base: 649, lsa: 154, x: "4.2", ttft: "1.03", blockTtft: "1.61" },
        { ctx: "1M", base: 1310, lsa: 160, x: "8.2", ttft: "1.51", blockTtft: "2.30" },
        { ctx: "10M", base: 13400, lsa: 185, x: "72.4", ttft: "9.21", blockTtft: "8.02" },
      ],
    },
    decode: {
      base: "full attention",
      rows: [
        { ctx: "512k", base: 0.587, lsa: 0.204, x: "2.9" },
        { ctx: "1M", base: 1.08, lsa: 0.206, x: "5.2" },
        { ctx: "10M", base: 11, lsa: 0.26, x: "42.5" },
      ],
    },
  },
}

const C_BASE = "oklch(0.58 0.13 25)"
const C_LSA = "oklch(0.6 0.14 150)"

function fmt(ms: number): string {
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`
  if (ms >= 1) return `${ms.toFixed(ms >= 100 ? 0 : 1)} ms`
  return `${Math.round(ms * 1000)} µs`
}

function Toggle<T extends string>(props: { value: T; options: { v: T; t: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {props.options.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => props.onChange(o.v)}
          className={cn(
            "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
            props.value === o.v ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
          )}
        >
          {o.t}
        </button>
      ))}
    </div>
  )
}

export function IndexerBill() {
  const [model, setModel] = useState<"glm" | "qwen">("glm")
  const [phase, setPhase] = useState<"prefill" | "decode">("prefill")
  const d = DATA[model][phase]
  // log scale shared by the three contexts of this view
  const lo = mlog10(Math.min(...d.rows.map((r) => r.lsa)) / 2)
  const hi = mlog10(Math.max(...d.rows.map((r) => r.base)) * 1.2)
  const w = (v: number) => ((mlog10(v) - lo) / (hi - lo)) * 100

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one global attention layer, one H200 · times reported by the paper (Figures 2 and 6, Table 3)
      </div>
      <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2.5">
        <Toggle
          value={model}
          onChange={setModel}
          options={[
            { v: "glm", t: "GLM-5.3-Flash" },
            { v: "qwen", t: "Qwen3.8-27B" },
          ]}
        />
        <Toggle
          value={phase}
          onChange={setPhase}
          options={[
            { v: "prefill", t: "prefill, 32,768 queries" },
            { v: "decode", t: "decode, one token" },
          ]}
        />
      </div>

      <div className="space-y-4 px-4 py-4">
        {d.rows.map((r) => (
          <div key={r.ctx} className="grid grid-cols-[3rem_1fr] items-center gap-3">
            <div className="font-mono text-sm tabular-nums">{r.ctx}</div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-3 flex-1 rounded bg-muted" role="img" aria-label={`${d.base}: ${fmt(r.base)}`}>
                  <div className="h-full rounded" style={{ width: `${w(r.base).toFixed(1)}%`, background: C_BASE }}>
                  </div>
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums">{fmt(r.base)}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 flex-1 rounded bg-muted" role="img" aria-label={`D-LSA (Flat): ${fmt(r.lsa)}`}>
                  <div className="h-full rounded" style={{ width: `${w(r.lsa).toFixed(1)}%`, background: C_LSA }} />
                </div>
                <span className="w-20 shrink-0 text-right font-mono text-[11px] tabular-nums">{fmt(r.lsa)}</span>
              </div>
              <div className="font-mono text-[10px] text-muted-foreground">
                layer {r.x}x faster
                {r.share !== undefined && <> · the indexer was {r.share}% of the baseline&apos;s time</>}
                {r.ttft !== undefined && phase === "prefill" && (
                  <>
                    {" "}
                    · whole model, time to first token: D-LSA (Flat) {r.ttft}x
                    {r.blockTtft && <>, block sparse {r.blockTtft}x</>}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 border-t px-4 py-3 font-mono text-[11px] text-muted-foreground md:grid-cols-2">
        <div>
          <span style={{ color: C_BASE }}>■</span> {d.base}
          · <span style={{ color: C_LSA }}>■</span> D-LSA (Flat).
          Log scale.
        </div>
        <div>
          {model === "glm"
            ? "Multiply-adds per query, from config.json: GLM's indexer scores T/4 pooled keys with 32 heads of 128 dims (1,024 T); D-LSA scores T/8 centroids with one 64-dim query (8 T). 128x fewer."
            : "Qwen3.8-27B has 16 full-attention layers among 64; the other 48 are linear attention, which is why a 72.4x layer is a 9.21x model."}
        </div>
      </div>
    </figure>
  )
}
