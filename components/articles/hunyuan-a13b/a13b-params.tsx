"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Stored-vs-active parameter ledger for Hunyuan-A13B.
// Everything but the three MoE knobs is fixed at the shipped config.json:
// 32 layers, hidden 4096, expert FFN 3072 (SwiGLU: gate, up, down), 32 query
// heads and 8 KV heads of 128, a 128,167-token vocabulary with a tied output
// head. At 64 routed experts, top-8 and 1 shared expert the ledger reproduces
// the safetensors headers exactly: 80,393,183,232 parameters.
// Only + - * / and toFixed reach the DOM, so SSR and the client agree.

const ACC = "oklch(0.64 0.16 48)" // routed, active
const SHARED = "oklch(0.55 0.13 250)"
const ATTN = "oklch(0.62 0.09 170)"
const EMB = "oklch(0.70 0.03 260)"

const L = 32
const H = 4096
const FF = 3072
const QH = 32
const KVH = 8
const HD = 128
const VOCAB = 128167

const SHIP = { experts: 64, topk: 8, shared: 1 }

const PRECISIONS = [
  { id: "bf16", label: "BF16", bytes: 2 },
  { id: "fp8", label: "FP8", bytes: 1 },
  { id: "int4", label: "INT4", bytes: 0.5 },
] as const

const ATTN_P = H * QH * HD + 2 * H * KVH * HD + QH * HD * H // q, k, v, o
const EXPERT_P = 3 * H * FF // one SwiGLU expert
const NORM_P = 2 * H + 2 * HD // two RMSNorms + QK-norm
const EMB_P = VOCAB * H
const GIB = 1073741824

function grouped(n: number) {
  return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
}
const billions = (n: number) => (n / 1e9).toFixed(2)

export function A13bParams() {
  const [experts, setExperts] = useState(SHIP.experts)
  const [topk, setTopk] = useState(SHIP.topk)
  const [shared, setShared] = useState(SHIP.shared)
  const [prec, setPrec] = useState<(typeof PRECISIONS)[number]["id"]>("bf16")
  const [countHead, setCountHead] = useState(true)

  const k = Math.min(topk, experts)
  const router = experts * H
  const total = L * (ATTN_P + NORM_P + (shared + experts) * EXPERT_P + router) + EMB_P + H
  const activeBody = L * (ATTN_P + NORM_P + (shared + k) * EXPERT_P + router) + H
  const active = activeBody + (countHead ? EMB_P : 0)
  const bytes = PRECISIONS.find((p) => p.id === prec)!.bytes
  const isShip = experts === SHIP.experts && k === SHIP.topk && shared === SHIP.shared

  // stacked bar over *stored* parameters
  const segs = [
    { id: "emb", label: "embedding (tied head)", n: EMB_P, color: EMB },
    { id: "attn", label: "attention", n: L * ATTN_P, color: ATTN },
    { id: "shared", label: "shared experts", n: L * shared * EXPERT_P, color: SHARED },
    { id: "hot", label: `routed, active (${k} per layer)`, n: L * k * EXPERT_P, color: ACC },
    { id: "idle", label: `routed, idle (${experts - k} per layer)`, n: L * (experts - k) * EXPERT_P, color: "transparent" },
  ]

  const kvPerTok = 2 * KVH * HD * L * 2 // bytes, 16-bit cache

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>parameter ledger · stored vs read per token</span>
        <span className="text-muted-foreground/50">32 layers · hidden 4096 · expert FFN 3072</span>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>routed experts per layer</span>
              <span className="text-foreground tabular-nums">{experts}</span>
            </span>
            <Range
              min={8}
              max={128}
              step={8}
              value={experts}
              onChange={(e) => setExperts(Number(e.target.value))}
              accent={ACC}
              className="mt-1 w-full"
              aria-label="routed experts per layer"
            />
          </label>
          <label className="block">
            <span className="flex justify-between font-mono text-[11px] text-muted-foreground">
              <span>experts chosen per token (top-k)</span>
              <span className="text-foreground tabular-nums">{k}</span>
            </span>
            <Range
              min={1}
              max={16}
              step={1}
              value={topk}
              onChange={(e) => setTopk(Number(e.target.value))}
              accent={ACC}
              className="mt-1 w-full"
              aria-label="experts chosen per token"
            />
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] text-muted-foreground">shared experts</span>
          {[0, 1, 2].map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setShared(s)}
              aria-pressed={s === shared}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                s === shared ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={s === shared ? { background: SHARED } : undefined}
            >
              {s}
            </button>
          ))}
          <span className="ml-3 font-mono text-[10px] text-muted-foreground">weights</span>
          {PRECISIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPrec(p.id)}
              aria-pressed={p.id === prec}
              className={cn(
                "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                p.id === prec ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCountHead((v) => !v)}
            aria-pressed={countHead}
            className="ml-auto cursor-pointer rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground hover:text-foreground"
          >
            {countHead ? "counting the output head" : "not counting the output head"}
          </button>
        </div>

        {/* stored parameters, split by role */}
        <div>
          <div className="flex h-6 w-full overflow-hidden rounded-md border">
            {segs.map((s) => (
              <div
                key={s.id}
                title={`${s.label}: ${billions(s.n)}B`}
                style={{
                  width: `${(s.n / total) * 100}%`,
                  background:
                    s.id === "idle"
                      ? `repeating-linear-gradient(45deg, ${ACC}22, ${ACC}22 5px, transparent 5px, transparent 10px)`
                      : s.color,
                }}
              />
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
            {segs.map((s) => (
              <span key={s.id} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-2 w-2 rounded-sm border"
                  style={{ background: s.id === "idle" ? `${ACC}33` : s.color }}
                />
                {s.label} {billions(s.n)}B
              </span>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-4">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">stored</div>
            <div className="font-mono text-lg text-foreground tabular-nums">{billions(total)}B</div>
            <div className="font-mono text-[9px] text-muted-foreground">{grouped(total)}</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">read per token</div>
            <div className="font-mono text-lg tabular-nums" style={{ color: ACC }}>
              {billions(active)}B
            </div>
            <div className="font-mono text-[9px] text-muted-foreground">{((active / total) * 100).toFixed(1)}% of stored</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">weight bytes per token</div>
            <div className="font-mono text-lg text-foreground tabular-nums">{((active * bytes) / 1e9).toFixed(1)} GB</div>
            <div className="font-mono text-[9px] text-muted-foreground">batch 1 decode, weights only</div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">KV cache per token</div>
            <div className="font-mono text-lg text-foreground tabular-nums">{kvPerTok / 1024} KiB</div>
            <div className="font-mono text-[9px] text-muted-foreground">
              16-bit; {(kvPerTok * 262144) / GIB} GiB at 256K
            </div>
          </div>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          {isShip ? (
            <>
              These are the shipped settings: 64 routed experts, top-8, 1 shared. The stored total matches the
              safetensors headers to the parameter.{" "}
            </>
          ) : (
            <>
              Not the shipped model: Hunyuan-A13B uses 64 routed experts, top-8 and 1 shared.{" "}
              <button
                type="button"
                onClick={() => {
                  setExperts(SHIP.experts)
                  setTopk(SHIP.topk)
                  setShared(SHIP.shared)
                }}
                className="cursor-pointer underline underline-offset-2 hover:text-foreground"
              >
                Reset
              </button>
              .{" "}
            </>
          )}
          Stored size grows with the expert count; what a token reads grows with top-k and the shared experts. The
          output head is tied to the embedding, so it is stored once but still multiplied for every token, which is
          why counting it moves the active figure by{" "}
          <span className="text-foreground">{billions(EMB_P)}B</span>. The KV cache does not move at all: it depends
          on attention, not on experts.
        </p>
      </div>
    </figure>
  )
}
