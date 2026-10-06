"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Kolibri-1's parameter budget, computed from its config.json rather than
// typed in: every count below is a product of the config's own fields. With
// top-k at 6 and the input embedding excluded (the report's convention), the
// active total is 3,457,570,560, 2,560 short of the model card's
// 3,457,573,120; the total, 78,103,074,560, matches the card and the
// safetensors headers exactly. Integer arithmetic only, so SSR and client agree.

const HIDDEN = 2560
const LAYERS = 50
const VOCAB = 128000
const Q_HEADS = 48
const KV_HEADS = 4
const HEAD_DIM = 128
const EXPERTS = 384
const EXPERT_HIDDEN = 512
const TOPK_DEFAULT = 6

const EMBED = VOCAB * HIDDEN
const HEAD = VOCAB * HIDDEN
// q, k, v, o projections + per-head q/k RMSNorm scales
const ATTN_LAYER =
  HIDDEN * Q_HEADS * HEAD_DIM +
  2 * HIDDEN * KV_HEADS * HEAD_DIM +
  Q_HEADS * HEAD_DIM * HIDDEN +
  2 * HEAD_DIM
const EXPERT = 3 * HIDDEN * EXPERT_HIDDEN // SwiGLU: gate, up, down
const ROUTER_LAYER = EXPERTS * HIDDEN + EXPERTS // router weights + balancing bias
const NORMS = LAYERS * 4 * HIDDEN + HIDDEN // four sandwich norms per block + final

type Group = { key: string; label: string; total: number; active: number; color: string }

function groups(topk: number, countEmbed: boolean): Group[] {
  return [
    { key: "routed", label: "Routed experts", total: LAYERS * EXPERTS * EXPERT, active: LAYERS * topk * EXPERT, color: "#d97706" },
    { key: "attn", label: "Attention", total: LAYERS * ATTN_LAYER, active: LAYERS * ATTN_LAYER, color: "#0f766e" },
    { key: "shared", label: "Shared expert", total: LAYERS * EXPERT, active: LAYERS * EXPERT, color: "#f59e0b" },
    { key: "head", label: "LM head", total: HEAD, active: HEAD, color: "#6366f1" },
    { key: "embed", label: "Input embedding", total: EMBED, active: countEmbed ? EMBED : 0, color: "#94a3b8" },
    { key: "router", label: "Routers + norms", total: LAYERS * ROUTER_LAYER + NORMS, active: LAYERS * ROUTER_LAYER + NORMS, color: "#e11d48" },
  ]
}

const fmtB = (n: number) => `${(n / 1e9).toFixed(n >= 1e10 ? 1 : 2)}B`
const fmtInt = (n: number) => n.toLocaleString("en-US")

function Bar({ title, items, value, total }: { title: string; items: { key: string; v: number; color: string; label: string }[]; value: number; total: number }) {
  return (
    <div className="mt-3">
      <div className="mb-1 flex items-baseline justify-between font-mono text-xs text-muted-foreground">
        <span>{title}</span>
        <span>
          <strong className="text-foreground">{fmtB(value)}</strong>
          {" "}({fmtInt(value)})
        </span>
      </div>
      <div className="flex h-6 w-full overflow-hidden rounded-md border" role="img" aria-label={`${title}: ${items.filter((i) => i.v > 0).map((i) => `${i.label} ${((i.v / total) * 100).toFixed(1)} percent`).join(", ")}`}>
        {items.map((it) =>
          it.v > 0 ? (
            <div key={it.key} style={{ width: `${((it.v / total) * 100).toFixed(3)}%`, background: it.color }} title={`${it.label}: ${fmtB(it.v)}`} />
          ) : null,
        )}
      </div>
    </div>
  )
}

export function ParamBudget() {
  const [topk, setTopk] = useState(TOPK_DEFAULT)
  const [countEmbed, setCountEmbed] = useState(false)
  const gs = groups(topk, countEmbed)
  const total = gs.reduce((s, g) => s + g.total, 0)
  const active = gs.reduce((s, g) => s + g.active, 0)
  const attn = gs.find((g) => g.key === "attn")!

  return (
    <figure className="my-8 rounded-xl border bg-gradient-to-b from-muted/15 to-transparent p-3 sm:p-4">
      <div className="font-mono text-xs uppercase tracking-wide text-muted-foreground">Kolibri-1 parameter budget, from config.json</div>

      <Bar title="Total (stored)" items={gs.map((g) => ({ key: g.key, v: g.total, color: g.color, label: g.label }))} value={total} total={total} />
      <Bar title={`Active per token (top-${topk})`} items={gs.map((g) => ({ key: g.key, v: g.active, color: g.color, label: g.label }))} value={active} total={active} />

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
        {gs.map((g) => (
          <span key={g.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: g.color }} />
            {g.label}
          </span>
        ))}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-muted-foreground">
          Routed experts per token: <strong className="font-mono text-foreground">{topk}</strong> of {EXPERTS}
          {topk === TOPK_DEFAULT ? " (as shipped)" : ""}
          <Range min={1} max={12} step={1} value={topk} onChange={(e) => setTopk(Number(e.target.value))} aria-label="routed experts per token" className="mt-1 w-full" />
        </label>
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={countEmbed} onChange={(e) => setCountEmbed(e.target.checked)} />
          Count the input embedding as active (the report does not: it is a row lookup, not a matmul)
        </label>
      </div>

      <figcaption className="mt-3 grid gap-x-6 gap-y-1 font-mono text-xs text-muted-foreground sm:grid-cols-3">
        <span>
          active / total: <strong className="text-foreground">{((active / total) * 100).toFixed(2)}%</strong>
        </span>
        <span>
          attention share of active: <strong className="text-foreground">{((attn.active / active) * 100).toFixed(1)}%</strong>
        </span>
        <span>
          one expert: <strong className="text-foreground">{fmtInt(EXPERT)}</strong>
        </span>
      </figcaption>
    </figure>
  )
}
