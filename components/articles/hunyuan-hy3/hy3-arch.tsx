"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Hy3 forward-pass walk-through. One decoder block, plus the shared MTP draft head.
// Four stages, each a different view of the same 295B-A21B MoE layer:
//   embed — hidden 4096, vocab 120,832, RMSNorm
//   attn  — GQA: 64 query heads share 8 KV heads (head_dim 128)
//   moe   — router keeps top-8 of 192 experts → 21B active of 295B total
//   mtp   — one multi-token-prediction layer drafts tokens for speculative decode
// First render is deterministic (stage "attn"); no timers, no randomness. The
// "active" expert set is a fixed pseudo-ranking, so SSR and client agree exactly.

const HY = "oklch(0.60 0.19 258)" // Hunyuan blue
const MUT = "var(--muted-foreground)"

type Stage = "embed" | "attn" | "moe" | "mtp"

const STAGES: { id: Stage; label: string; sub: string }[] = [
  { id: "embed", label: "1 · embed", sub: "hidden 4096" },
  { id: "attn", label: "2 · GQA", sub: "64 q / 8 kv" },
  { id: "moe", label: "3 · MoE", sub: "top-8 / 192" },
  { id: "mtp", label: "4 · MTP", sub: "draft head" },
]

// Deterministic router score in [0,1) — no Math.random, so SSR === client.
function routerScore(e: number) {
  const s = Math.sin((e + 1) * 12.9898) * 43758.5453
  return s - Math.floor(s)
}
// Fixed top-8 experts of 192 (bounded sort, pure).
const RANKED = Array.from({ length: 192 }, (_, e) => e).sort(
  (a, b) => routerScore(b) - routerScore(a)
)
const ACTIVE = new Set(RANKED.slice(0, 8))

const READOUT: Record<Stage, { active: string; total: string; note: string }> = {
  embed: {
    active: "—",
    total: "120,832 × 4096",
    note: "token → 4096-d embedding, RMSNorm; same tied space at the output head",
  },
  attn: {
    active: "8 KV heads read",
    total: "64 query heads",
    note: "grouped-query attention: 8 query heads share each KV head → 8× smaller KV cache than full MHA",
  },
  moe: {
    active: "21B active",
    total: "295B total",
    note: "router scores 192 experts, keeps top-8; only those 8 FFNs run this token (~7% of the pool)",
  },
  mtp: {
    active: "3.8B draft",
    total: "1 MTP layer",
    note: "one multi-token-prediction layer proposes the next token; the main model verifies it (speculative decode)",
  },
}

export function Hy3Arch() {
  const [stage, setStage] = useState<Stage>("attn")
  const r = READOUT[stage]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>Hy3 decoder block · one token, one forward pass</span>
        <span className="text-muted-foreground/50">295B-A21B</span>
      </div>

      {/* stage selector */}
      <div className="flex flex-wrap gap-1.5 px-3 pt-3">
        {STAGES.map((s) => {
          const on = s.id === stage
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => setStage(s.id)}
              aria-pressed={on}
              className={cn(
                "cursor-pointer rounded-md px-2.5 py-1.5 text-left font-mono text-[10px] transition-colors",
                on ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={on ? { background: HY } : undefined}
            >
              <div>{s.label}</div>
              <div className={cn("text-[9px]", on ? "text-background/70" : "text-muted-foreground/60")}>
                {s.sub}
              </div>
            </button>
          )
        })}
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox="0 0 760 260" className="w-full" role="img" aria-label={`Hy3 architecture, stage ${stage}`}>
          <defs>
            <filter id="hy3-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- stage: embed ---- */}
          {stage === "embed" && (
            <g>
              <text x={30} y={28} className="fill-muted-foreground font-mono" fontSize={11}>
                token id → embedding table → 4096-d hidden
              </text>
              <rect x={30} y={54} width={90} height={40} rx={6} fill="var(--muted)" opacity={0.4} />
              <text x={75} y={78} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                token
              </text>
              <path d="M120 74 H190" stroke={MUT} strokeWidth={1.5} markerEnd="url(#hy3-a)" />
              {Array.from({ length: 16 }, (_, i) => (
                <rect
                  key={i}
                  x={196 + i * 20}
                  y={54}
                  width={16}
                  height={40}
                  rx={2}
                  fill={HY}
                  opacity={0.25 + 0.5 * routerScore(i * 7)}
                />
              ))}
              <text x={196} y={112} className="fill-muted-foreground font-mono" fontSize={9}>
                4096 dims (16 shown) · vocab 120,832 · RMSNorm
              </text>
            </g>
          )}

          {/* ---- stage: attn (GQA) ---- */}
          {stage === "attn" && (
            <g>
              <text x={30} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
                grouped-query attention · 8 KV heads, 8 query heads each = 64
              </text>
              {Array.from({ length: 8 }, (_, g) => {
                const gx = 30 + g * 91
                return (
                  <g key={g}>
                    {/* KV head */}
                    <rect x={gx} y={44} width={76} height={22} rx={4} fill={HY} opacity={0.85} />
                    <text x={gx + 38} y={59} textAnchor="middle" className="fill-background font-mono" fontSize={9}>
                      kv{g}
                    </text>
                    {/* 8 query heads sharing it */}
                    {Array.from({ length: 8 }, (_, q) => (
                      <rect
                        key={q}
                        x={gx + q * 9.2}
                        y={92}
                        width={7}
                        height={26}
                        rx={1.5}
                        fill={HY}
                        opacity={0.3}
                      />
                    ))}
                    <path d={`M${gx + 38} 66 V92`} stroke={HY} strokeWidth={1} opacity={0.4} />
                  </g>
                )
              })}
              <text x={30} y={140} className="fill-muted-foreground font-mono" fontSize={9}>
                head_dim 128 · one KV projection feeds 8 query heads → the KV cache is 8× smaller than full MHA
              </text>
            </g>
          )}

          {/* ---- stage: moe ---- */}
          {stage === "moe" && (
            <g>
              <text x={30} y={24} className="fill-muted-foreground font-mono" fontSize={11}>
                router scores 192 experts → keeps top-8 (the lit cells)
              </text>
              {Array.from({ length: 192 }, (_, e) => {
                const col = e % 24
                const row = Math.floor(e / 24)
                const on = ACTIVE.has(e)
                return (
                  <rect
                    key={e}
                    x={30 + col * 29.5}
                    y={40 + row * 15}
                    width={26}
                    height={12}
                    rx={2}
                    fill={on ? HY : "var(--muted-foreground)"}
                    opacity={on ? 0.95 : 0.14}
                    filter={on ? "url(#hy3-soft)" : undefined}
                  />
                )
              })}
              <text x={30} y={168} className="fill-muted-foreground font-mono" fontSize={9}>
                8 of 192 experts run this token · 21B active of 295B total (~7% activation)
              </text>
            </g>
          )}

          {/* ---- stage: mtp ---- */}
          {stage === "mtp" && (
            <g>
              <text x={30} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
                main stack (80 layers) → 1 MTP layer drafts the next token
              </text>
              <rect x={30} y={48} width={220} height={44} rx={6} fill="var(--muted)" opacity={0.4} />
              <text x={140} y={75} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                80 decoder layers
              </text>
              <path d="M250 70 H320" stroke={HY} strokeWidth={1.5} markerEnd="url(#hy3-a)" />
              <rect x={326} y={48} width={150} height={44} rx={6} fill={HY} opacity={0.85} filter="url(#hy3-soft)" />
              <text x={401} y={70} textAnchor="middle" className="fill-background font-mono" fontSize={10}>
                MTP layer
              </text>
              <text x={401} y={84} textAnchor="middle" className="fill-background/70 font-mono" fontSize={8}>
                3.8B
              </text>
              <path d="M476 70 H540" stroke={MUT} strokeWidth={1.5} strokeDasharray="4 3" markerEnd="url(#hy3-a)" />
              <rect x={546} y={48} width={170} height={44} rx={6} fill="var(--muted)" opacity={0.3} stroke={HY} strokeWidth={1} />
              <text x={631} y={70} textAnchor="middle" className="fill-foreground font-mono" fontSize={9}>
                drafted token
              </text>
              <text x={631} y={84} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>
                verified by main model
              </text>
              <text x={30} y={124} className="fill-muted-foreground font-mono" fontSize={9}>
                speculative decode: vLLM (mtp) / SGLang (EAGLE) accept the draft when it matches
              </text>
            </g>
          )}

          <marker id="hy3-a" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
            <path d="M0,-4L6,0L0,4" fill="none" stroke={MUT} strokeWidth={1.5} />
          </marker>
        </svg>

        {/* readout */}
        <div className="mt-2 grid grid-cols-2 gap-3 border-t pt-3 sm:grid-cols-3">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">this stage runs</div>
            <div className="font-mono text-sm" style={{ color: HY }}>
              {r.active}
            </div>
          </div>
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">out of</div>
            <div className="font-mono text-sm text-foreground">{r.total}</div>
          </div>
          <div className="col-span-2 sm:col-span-1">
            <div className="font-mono text-[10px] text-muted-foreground">context length</div>
            <div className="font-mono text-sm text-foreground">256K native</div>
          </div>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{r.note}</p>
      </div>
    </figure>
  )
}
