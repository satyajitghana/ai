"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Interactive architecture ↔ code map of the sparse-MoE language model, drawn as a
// composed SVG scene. Tap a block in the flow and its actual forward() code appears
// alongside. The MoE block carries a live router → experts fan-out (top-2 of 8 lit,
// curved connectors only to the chosen experts) so the one line that swaps a dense
// FFN for experts reads as the centre of the model.

const ACCENT = "oklch(0.60 0.15 255)"
const EXPERTS = 8
const ACTIVE = new Set([2, 5]) // the two experts this token routes to

type StageId = "embed" | "attn" | "moe" | "head"

const STAGES: Record<
  StageId,
  { label: string; shape: string; code: string; note: string }
> = {
  embed: {
    label: "token + position embeddings",
    shape: "(B, T) → (B, T, C)",
    code: `tok_emb = self.token_embedding_table(idx)      # (B,T,C)
pos_emb = self.position_embedding_table(arange(T))  # (T,C)
x = tok_emb + pos_emb`,
    note: "Tokens become vectors; positions are added so order carries.",
  },
  attn: {
    label: "self-attention + residual",
    shape: "(B, T, C) → (B, T, C)",
    code: `x = x + self.sa(self.ln1(x))   # multi-head attention`,
    note: "Each token mixes in earlier tokens. Identical to a dense transformer — MoE leaves attention alone.",
  },
  moe: {
    label: "sparse MoE + residual",
    shape: "(B, T, C) → (B, T, C)",
    code: `x = x + self.smoe(self.ln2(x))   # <- was a single MLP

# inside SparseMoE.forward:
gates, idx = self.router(x)            # pick top-2 of 8
for i, expert in enumerate(self.experts):
    mask = (idx == i).any(-1)          # tokens routed here
    out[mask] += gates[mask, i] * expert(x[mask])`,
    note: "The whole idea, in one swapped line. A router sends each token to 2 of 8 expert MLPs; their gated outputs are summed.",
  },
  head: {
    label: "final norm → LM head",
    shape: "(B, T, C) → (B, T, vocab)",
    code: `x = self.ln_f(x)
logits = self.lm_head(x)   # (B,T,vocab_size)`,
    note: "Project back to vocabulary logits — the next-token distribution.",
  },
}

// ── scene geometry (viewBox units) ─────────────────────────────────────────
const W = 320
const H = 452
const CX = 160
const NW = 208 // node width
const NX = CX - NW / 2
const NH = 40

// node vertical positions (top-y)
const Y = { embed: 40, attn: 128, moe: 200, head: 356 } as const
const ROUTER_Y = 256
const EXP_Y = 300
const EXP_H = 26

// experts row
const EX0 = 34
const EXW = 24
const EXGAP = (W - 2 * EX0 - EXPERTS * EXW) / (EXPERTS - 1)
const exx = (i: number) => EX0 + i * (EXW + EXGAP)

function vcurve(y1: number, y2: number, x = CX) {
  const my = (y1 + y2) / 2
  return `M ${x} ${y1} C ${x} ${my}, ${x} ${my}, ${x} ${y2}`
}

export function MoeArchitecture() {
  const [selected, setSelected] = useState<StageId>("moe")
  const stage = STAGES[selected]

  const Node = ({
    id,
    top,
    title,
    sub,
    badge,
  }: {
    id: StageId
    top: number
    title: string
    sub?: string
    badge?: string
  }) => {
    const active = selected === id
    return (
      <g
        role="button"
        tabIndex={0}
        aria-pressed={active}
        aria-label={title}
        onClick={() => setSelected(id)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            setSelected(id)
          }
        }}
        style={{ cursor: "pointer" }}
        className="transition-all"
      >
        <rect
          x={NX}
          y={top}
          width={NW}
          height={NH}
          rx={9}
          fill={active ? "color-mix(in oklab, var(--background), var(--foreground) 5%)" : "var(--background)"}
          stroke={active || id === "moe" ? ACCENT : "var(--border)"}
          strokeWidth={active ? 2 : 1.5}
          filter={active || id === "moe" ? "url(#moe-arch-soft)" : undefined}
        />
        <text
          x={sub ? NX + 14 : CX}
          y={sub ? top + 17 : top + 24}
          textAnchor={sub ? "start" : "middle"}
          className="fill-foreground font-mono"
          fontSize={11}
          fontWeight={600}
        >
          {title}
        </text>
        {sub ? (
          <text x={NX + 14} y={top + 30} className="fill-muted-foreground font-mono" fontSize={9}>
            {sub}
          </text>
        ) : null}
        {badge ? (
          <>
            <rect x={NX + NW - 58} y={top + 11} width={48} height={18} rx={5} fill="var(--muted)" />
            <text
              x={NX + NW - 34}
              y={top + 23}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              {badge}
            </text>
          </>
        ) : null}
      </g>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        sparse-MoE language model — tap a block to read its code
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-2">
        {/* flow diagram */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Vertical model flow: embeddings, transformer block (attention then sparse MoE, repeated 8 times), final norm and LM head. The MoE block routes a token to 2 of 8 experts."
        >
          <defs>
            <marker id="moe-arch-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <marker id="moe-arch-arrow-a" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <filter id="moe-arch-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* dashed transformer-block frame around attn + moe + fanout */}
          <rect
            x={18}
            y={112}
            width={W - 36}
            height={224}
            rx={12}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.2}
            strokeDasharray="4 4"
          />
          <rect x={30} y={104} width={126} height={16} fill="var(--background)" />
          <text x={36} y={116} className="fill-muted-foreground font-mono" fontSize={9}>
            transformer block × 8
          </text>

          {/* stage connectors */}
          <text x={CX} y={18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            idx (B, T)
          </text>
          <path d={vcurve(24, Y.embed)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          <path d={vcurve(Y.embed + NH, Y.attn)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          <path d={vcurve(Y.attn + NH, Y.moe)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          <path d={vcurve(EXP_Y + EXP_H, Y.head)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          <path d={vcurve(Y.head + NH, H - 12)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          <text x={CX} y={H - 2} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            logits (B, T, vocab)
          </text>

          {/* router → experts fan-out (inside moe) */}
          <path d={vcurve(Y.moe + NH, ROUTER_Y)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#moe-arch-arrow)" />
          {[...ACTIVE].map((i) => {
            const x2 = exx(i) + EXW / 2
            const y1 = ROUTER_Y + 24
            const my = (y1 + EXP_Y) / 2
            return (
              <path
                key={i}
                d={`M ${CX} ${y1} C ${CX} ${my}, ${x2} ${my}, ${x2} ${EXP_Y}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.5}
                markerEnd="url(#moe-arch-arrow-a)"
                opacity={0.85}
              />
            )
          })}

          {/* router pill */}
          <g>
            <rect x={CX - 40} y={ROUTER_Y} width={80} height={24} rx={7} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#moe-arch-soft)" />
            <text x={CX} y={ROUTER_Y + 16} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>
              router
            </text>
          </g>

          {/* expert pills */}
          {Array.from({ length: EXPERTS }, (_, i) => {
            const on = ACTIVE.has(i)
            return (
              <g key={i}>
                <rect
                  x={exx(i)}
                  y={EXP_Y}
                  width={EXW}
                  height={EXP_H}
                  rx={6}
                  fill={on ? ACCENT : "var(--muted)"}
                  opacity={on ? 0.9 : 0.4}
                  stroke={on ? ACCENT : "transparent"}
                  strokeWidth={1.5}
                  filter={on ? "url(#moe-arch-soft)" : undefined}
                />
                <text
                  x={exx(i) + EXW / 2}
                  y={EXP_Y + 17}
                  textAnchor="middle"
                  fontSize={9}
                  fontWeight={600}
                  className={on ? "fill-background font-mono" : "fill-muted-foreground font-mono"}
                >
                  {i}
                </text>
              </g>
            )
          })}
          <text x={CX} y={EXP_Y + EXP_H + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            8 experts · 2 lit
          </text>

          {/* stage nodes (drawn last so they sit above connectors) */}
          <Node id="embed" top={Y.embed} title="embeddings" sub="token + position" />
          <Node id="attn" top={Y.attn} title="ln → attention" sub="+ residual" />
          <Node id="moe" top={Y.moe} title="ln → sparse MoE" sub="+ residual" badge="top-2 / 8" />
          <Node id="head" top={Y.head} title="final norm → LM head" sub="→ logits" />
        </svg>

        {/* code panel */}
        <div className="flex min-h-[300px] flex-col rounded-lg border bg-muted/30">
          <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs">
            <span className="font-medium">{stage.label}</span>
            <span className="text-muted-foreground">{stage.shape}</span>
          </div>
          <pre className="flex-1 overflow-x-auto px-3 py-3 font-mono text-[11px] leading-5">
            {stage.code}
          </pre>
          <p className="border-t px-3 py-2 text-xs leading-5 text-muted-foreground">
            {stage.note}
          </p>
        </div>
      </div>

      <div className="border-t px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
        {(["embed", "attn", "moe", "head"] as StageId[]).map((id, n) => (
          <button
            key={id}
            type="button"
            onClick={() => setSelected(id)}
            aria-pressed={selected === id}
            className={cn(
              "cursor-pointer rounded px-1.5 py-0.5 transition-colors",
              selected === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              n > 0 && "ml-1"
            )}
            style={selected === id ? { background: "var(--muted)" } : undefined}
          >
            {id}
          </button>
        ))}
      </div>
    </figure>
  )
}
