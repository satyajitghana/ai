"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number in this component is reconstructed from config.json and checked
// against the byte count in model.safetensors.index.json. Nothing is taken from
// the model card except as a target to hit.
//
// The point of doing it this way: a card that says "2.4T total, 95B activated"
// is a claim. The weight index is a measurement. When the reconstruction lands
// on the measurement you have learned that you understand the architecture — and
// you get the intermediate quantities (the MTP block's cost, the routed-expert
// share) that the card never breaks out.
//
// Only + - * / here, all exact in float64 at these magnitudes, so no lib/dmath.

type Spec = {
  id: string
  label: string
  H: number
  L: number
  nFull: number
  vocab: number
  // attention
  nq: number
  nkv: number
  hd: number
  // gated deltanet
  lqk: number
  lv: number
  lhd: number
  conv: number
  // ffn / moe
  moe: boolean
  ffn: number // dense intermediate, or expert intermediate when moe
  experts: number
  active: number
  // ground truth
  indexBytes: number
  cardTotal: string
  cardActive: string
}

const SPECS: Spec[] = [
  {
    id: "max",
    label: "Qwen3.8-2.4T-A95B",
    H: 8192, L: 92, nFull: 23, vocab: 248320,
    nq: 64, nkv: 4, hd: 256,
    lqk: 16, lv: 128, lhd: 128, conv: 4,
    moe: true, ffn: 2048, experts: 512, active: 10,
    indexBytes: 4892365451008,
    cardTotal: "2.4T in total", cardActive: "95B activated",
  },
  {
    id: "b27",
    label: "Qwen3.8-27B",
    H: 5120, L: 64, nFull: 16, vocab: 248320,
    nq: 24, nkv: 4, hd: 256,
    lqk: 16, lv: 48, lhd: 128, conv: 4,
    moe: false, ffn: 17408, experts: 0, active: 0,
    indexBytes: 55562855904,
    cardTotal: "27B", cardActive: "27B (dense)",
  },
]

// One expert / one dense FFN: gate + up + down.
const ffnParams = (inter: number, H: number) => 3 * inter * H

// q_proj is [2·nq·hd, H] — the output gate is fused into it, which is why the
// shape is twice what num_attention_heads × head_dim would suggest.
const attnParams = (s: Spec) =>
  2 * s.nq * s.hd * s.H + 2 * (s.nkv * s.hd * s.H) + s.H * (s.nq * s.hd)

// Gated DeltaNet: in_proj_qkv + in_proj_z + in_proj_a + in_proj_b + conv1d + out_proj.
const gdnParams = (s: Spec) => {
  const qkv = (2 * s.lqk + s.lv) * s.lhd
  return qkv * s.H + s.lv * s.lhd * s.H + 2 * (s.lv * s.H) + qkv * s.conv + s.H * (s.lv * s.lhd)
}

function reconstruct(s: Spec) {
  const one = ffnParams(s.ffn, s.H)
  const perLayerFfn = s.moe ? s.experts * one + one + s.experts * s.H + s.H : one
  const perLayerActive = s.moe ? s.active * one + one + s.experts * s.H + s.H : one
  const att = attnParams(s)
  const gdn = gdnParams(s)
  const emb = s.vocab * s.H
  const nLin = s.L - s.nFull

  const backbone = s.L * perLayerFfn + s.nFull * att + nLin * gdn + 2 * emb
  const activeCount = s.L * perLayerActive + s.nFull * att + nLin * gdn + 2 * emb
  const mtp = att + perLayerFfn + 2 * s.H * s.H
  // The 27B also carries a 27-block SigLIP-shaped vision tower.
  const vision = s.id === "b27" ? 465_698_800 : 0

  const total = backbone + mtp + vision
  const actual = s.indexBytes / 2
  const routed = s.moe ? s.experts * one * (s.L + 1) : 0

  return {
    total, activeCount, mtp, vision, actual, routed,
    residual: actual - total,
    rows: [
      { k: `${s.L} × ${s.moe ? "MoE block" : "FFN block"}`, v: s.L * perLayerFfn, note: s.moe ? `${s.experts} experts × ${s.ffn} + 1 shared + router` : `intermediate ${s.ffn.toLocaleString()}` },
      { k: `${s.nFull} × gated attention`, v: s.nFull * att, note: `${s.nq}Q / ${s.nkv}KV heads, head dim ${s.hd}, gate fused into q_proj` },
      { k: `${nLin} × Gated DeltaNet`, v: nLin * gdn, note: `${s.lv}V / ${s.lqk}QK heads, head dim ${s.lhd}, conv ${s.conv}` },
      { k: "embed + lm_head", v: 2 * emb, note: `${s.vocab.toLocaleString()} × ${s.H.toLocaleString()}, untied` },
      { k: "MTP block", v: mtp, note: "a full extra layer plus a fusion projection" },
      ...(vision ? [{ k: "vision tower", v: vision, note: "27 blocks, hidden 1152, patch 16 — shipped separately as mmproj" }] : []),
    ],
  }
}

const fmt = (n: number) => (n >= 1e12 ? `${(n / 1e12).toFixed(3)}T` : n >= 1e9 ? `${(n / 1e9).toFixed(2)}B` : `${(n / 1e6).toFixed(0)}M`)

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

export function ParamLedger() {
  const [sel, setSel] = useState(0)
  const [row, setRow] = useState(0)
  const [mode, setMode] = useState<"total" | "active" | "fp8">("total")
  const s = SPECS[sel]
  const r = reconstruct(s)
  const max = Math.max(...r.rows.map((x) => x.v))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">parameters, rebuilt from config.json</span>
        <span className="font-mono text-[10px]" style={{ color: GOOD }}>
          checked against the weight index
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {SPECS.map((x, i) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setSel(i)}
              aria-pressed={i === sel}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                i === sel ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {x.label}
            </button>
          ))}
          <span className="grow" />
          {(["total", "active", "fp8"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={m === mode}
              disabled={m !== "total" && !s.moe}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                m === mode ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "total" ? "all weights" : m === "active" ? "active / token" : "what FP8 touches"}
            </button>
          ))}
        </div>

        {mode === "total" ? (
          <>
            <div className="mt-3 space-y-1">
              {r.rows.map((x, i) => (
                <button
                  key={x.k}
                  type="button"
                  onClick={() => setRow(i)}
                  aria-pressed={i === row}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-2 rounded-md border px-1.5 py-1 text-left transition-colors",
                    i === row ? "border-foreground/30 bg-muted/40" : "border-transparent hover:bg-muted/20",
                  )}
                >
                  <span className="w-40 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.k}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${Math.max(0.4, (x.v / max) * 100)}%`, background: ACCENT }} />
                  </div>
                  <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: ACCENT }}>
                    {fmt(x.v)}
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-1.5 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-[10px] leading-5">
              <span className="text-foreground">{r.rows[Math.min(row, r.rows.length - 1)].k}</span>
              <span className="text-muted-foreground"> — {r.rows[Math.min(row, r.rows.length - 1)].note}</span>
            </div>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">reconstructed</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: ACCENT }}>{fmt(r.total)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">from config.json alone</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">actual</div>
                <div className="font-mono text-sm tabular-nums text-foreground">{fmt(r.actual)}</div>
                <div className="font-mono text-[9px] text-muted-foreground">index bytes ÷ 2 (all bf16)</div>
              </div>
              <div className="rounded-lg border bg-muted/20 px-3 py-2">
                <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">residual</div>
                <div className="font-mono text-sm tabular-nums" style={{ color: GOOD }}>
                  {Math.abs(r.residual / r.actual * 100) < 0.01 ? "<0.01%" : `${(Math.abs(r.residual) / r.actual * 100).toFixed(2)}%`}
                </div>
                <div className="font-mono text-[9px] text-muted-foreground">
                  {s.moe ? "layernorms, unaccounted" : "my vision-merger estimate"}
                </div>
              </div>
            </div>
          </>
        ) : mode === "active" ? (
          <div className="mt-3 space-y-2">
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
              <div className="font-mono text-[11px]" style={{ color: ACCENT }}>
                {fmt(r.activeCount)} per token · the card says {s.cardActive}
              </div>
              <div className="mt-1 text-sm leading-6 text-muted-foreground">
                Routed experts drop from {s.experts} to {s.active} and everything else runs every token: the shared
                expert, the router, all {s.nFull} attention layers, all {s.L - s.nFull} Gated DeltaNet layers, and both
                embedding matrices. Counting the untied {(s.vocab * s.H / 1e9).toFixed(2)}B embed and{" "}
                {(s.vocab * s.H / 1e9).toFixed(2)}B lm_head is what closes the gap to 95B — leave them out and you get
                91.2B, which is not the number on the card.
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-right font-mono text-[10px] text-muted-foreground">active</span>
              <div className="h-4 flex-1 rounded-sm bg-muted/40">
                <div className="h-4 rounded-sm" style={{ width: `${(r.activeCount / r.actual) * 100}%`, background: ACCENT }} />
              </div>
              <span className="w-20 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
                {((r.activeCount / r.actual) * 100).toFixed(1)}%
              </span>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              sparsity {(r.actual / r.activeCount).toFixed(1)}× — one token touches {fmt(r.activeCount)} of {fmt(r.actual)}
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            <div className="space-y-1.5">
              {[
                { k: "routed experts → FP8", v: r.routed, c: WARM },
                { k: "everything else stays bf16", v: r.actual - r.routed, c: ACCENT },
              ].map((x) => (
                <div key={x.k} className="flex items-center gap-2">
                  <span className="w-48 shrink-0 truncate text-right font-mono text-[10px] text-foreground">{x.k}</span>
                  <div className="h-4 flex-1 rounded-sm bg-muted/40">
                    <div className="h-4 rounded-sm" style={{ width: `${Math.max(0.6, (x.v / r.actual) * 100)}%`, background: x.c }} />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: x.c }}>
                    {fmt(x.v)} · {((x.v / r.actual) * 100).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg border bg-muted/20 px-3 py-2.5 text-sm leading-6 text-muted-foreground">
              <span className="font-mono text-[11px] text-foreground">
                {(((r.routed + (r.actual - r.routed) * 2) / 1024 ** 4)).toFixed(2)} TiB predicted · 2.27 TiB published
              </span>
              <br />
              The FP8 checkpoint&rsquo;s <span className="font-mono text-foreground">modules_to_not_convert</span> list
              spares every attention projection, every Gated DeltaNet projection, the shared expert, both gates,
              lm_head, embed_tokens and the whole MTP block. Take the routed experts to one byte, leave the other{" "}
              {((r.actual - r.routed) / 1e9).toFixed(0)}B at two, and the arithmetic lands on the size vLLM publishes.
            </div>
          </div>
        )}
      </div>
    </figure>
  )
}
