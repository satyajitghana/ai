"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The unification, drawn as a map. One root — G(n) = exp(nωL) with the exact
// relative law — forks into two families, and each known positional scheme drops
// out as a specific generator. Click any node to see which generator it is, its
// closed form, and whether GRAPE *recovers* it exactly or *extends* past it.
// This is the paper's central claim: RoPE, ALiBi and FoX are all one construction.

const MUL = "oklch(0.58 0.15 255)" // multiplicative — blue
const ADD = "oklch(0.62 0.17 18)" // additive — rose

const W = 760
const H = 300

type NodeKey = "rope" | "learned" | "alibi" | "fox" | "gated"

type Info = {
  name: string
  fam: "mul" | "add"
  kind: "recovers" | "extends"
  gen: string
  form: string
  blurb: string
}

const INFO: Record<NodeKey, Info> = {
  rope: {
    name: "RoPE",
    fam: "mul",
    kind: "recovers",
    gen: "d/2 commuting rank-2 skew generators on canonical coordinate pairs, log-uniform spectrum",
    form: "G(n) = blockdiag(R₂(nθ₁), …, R₂(nθ_d/2))",
    blurb: "Rotary embeddings are exactly commuting Multiplicative GRAPE with the canonical basis (Prop. 3.1).",
  },
  learned: {
    name: "Learned bases",
    fam: "mul",
    kind: "extends",
    gen: "learned commuting subspaces (O(d)/head) or a compact non-commuting mixture (O(rd)/head)",
    form: "L = Σ θᵢ Lᵢ  →  cross-subspace coupling",
    blurb: "GRAPE lets the rotation planes and spectrum be learned, capturing coupling RoPE's fixed basis can't.",
  },
  alibi: {
    name: "ALiBi",
    fam: "add",
    kind: "recovers",
    gen: "rank-1 nilpotent A_h = −β_h e_{d+2} e_{d+1}ᵀ in a GL(d+2) lift",
    form: "q̃ᵢᵀk̃ⱼ = qᵢᵀkⱼ + (j − i)·β_h",
    blurb: "The head-slope linear bias is a rank-1 unipotent action — an exact special case (Additive GRAPE).",
  },
  fox: {
    name: "Forgetting Transformer",
    fam: "add",
    kind: "recovers",
    gen: "path product of per-token unipotent factors (I + log f_ℓ · E)",
    form: "b_h(t,j) = Σ_{ℓ=j+1}^{t} log f_{ℓ,h}",
    blurb: "FoX's cumulative forget-gate bias is an exact instance of Path-Integral Additive GRAPE.",
  },
  gated: {
    name: "Content-gated / Path-integral",
    fam: "add",
    kind: "extends",
    gen: "content-dependent slopes via softplus gates on q and k; endpoint-dependent edge potentials",
    form: "b = (j − i)·ω·[softplus(vᵀqᵢ) + softplus(uᵀkⱼ)]",
    blurb: "GRAPE-A-QK/AP derive a learnable, content-adaptive decay from first principles — the strongest variant.",
  },
}

// node geometry (viewBox units)
type Box = { x: number; y: number; w: number; h: number }
const rootBox: Box = { x: W / 2 - 118, y: 18, w: 236, h: 46 }
const mulBox: Box = { x: 96, y: 112, w: 200, h: 40 }
const addBox: Box = { x: 464, y: 112, w: 200, h: 40 }
const leaves: Record<NodeKey, Box> = {
  rope: { x: 40, y: 210, w: 122, h: 40 },
  learned: { x: 174, y: 210, w: 150, h: 40 },
  alibi: { x: 400, y: 210, w: 96, h: 40 },
  fox: { x: 506, y: 210, w: 96, h: 40 },
  gated: { x: 612, y: 210, w: 108, h: 40 },
}
const mid = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 })
const bot = (b: Box) => ({ x: b.x + b.w / 2, y: b.y + b.h })
const top = (b: Box) => ({ x: b.x + b.w / 2, y: b.y })

function link(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function FamilyMap() {
  const [sel, setSel] = useState<NodeKey>("rope")
  const info = INFO[sel]
  const selFam = info.fam

  const leafColor = (k: NodeKey) => (INFO[k].fam === "mul" ? MUL : ADD)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one framework · click a scheme</span>
        <span className="text-muted-foreground/50">RoPE · ALiBi · FoX</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Taxonomy: G(n)=exp(nωL) forks into Multiplicative (recovers RoPE, extends to learned bases) and Additive (recovers ALiBi and FoX, extends to content-gated forms)">
          <defs>
            <marker id="grape-fm-mul" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUL} strokeWidth={1.5} />
            </marker>
            <marker id="grape-fm-add" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ADD} strokeWidth={1.5} />
            </marker>
            <filter id="grape-fm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* connectors root → branches */}
          <path d={link(bot(rootBox).x - 30, bot(rootBox).y, top(mulBox).x, top(mulBox).y)} fill="none" stroke={MUL} strokeWidth={1.5} markerEnd="url(#grape-fm-mul)" opacity={0.7} />
          <path d={link(bot(rootBox).x + 30, bot(rootBox).y, top(addBox).x, top(addBox).y)} fill="none" stroke={ADD} strokeWidth={1.5} markerEnd="url(#grape-fm-add)" opacity={0.7} />

          {/* connectors branch → leaves */}
          {(["rope", "learned"] as NodeKey[]).map((k) => (
            <path key={k} d={link(bot(mulBox).x, bot(mulBox).y, top(leaves[k]).x, top(leaves[k]).y)} fill="none" stroke={MUL} strokeWidth={1.5} markerEnd="url(#grape-fm-mul)" opacity={sel === k ? 0.95 : 0.4} />
          ))}
          {(["alibi", "fox", "gated"] as NodeKey[]).map((k) => (
            <path key={k} d={link(bot(addBox).x, bot(addBox).y, top(leaves[k]).x, top(leaves[k]).y)} fill="none" stroke={ADD} strokeWidth={1.5} markerEnd="url(#grape-fm-add)" opacity={sel === k ? 0.95 : 0.4} />
          ))}

          {/* root */}
          <g>
            <rect x={rootBox.x} y={rootBox.y} width={rootBox.w} height={rootBox.h} rx={10} fill="var(--background)" stroke="var(--muted-foreground)" strokeWidth={1.5} filter="url(#grape-fm-soft)" />
            <text x={mid(rootBox).x} y={rootBox.y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>G(n) = exp(n ω L)</text>
            <text x={mid(rootBox).x} y={rootBox.y + 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>relative law: G(t−s) = G(s)⁻¹G(t)</text>
          </g>

          {/* branch: multiplicative */}
          <g>
            <rect x={mulBox.x} y={mulBox.y} width={mulBox.w} height={mulBox.h} rx={9} fill="var(--background)" stroke={MUL} strokeWidth={selFam === "mul" ? 2 : 1.5} filter="url(#grape-fm-soft)" />
            <text x={mid(mulBox).x} y={mulBox.y + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600} style={{ fill: MUL }}>Multiplicative · SO(d)</text>
            <text x={mid(mulBox).x} y={mulBox.y + 31} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>rank-2 skew → rotation</text>
          </g>

          {/* branch: additive */}
          <g>
            <rect x={addBox.x} y={addBox.y} width={addBox.w} height={addBox.h} rx={9} fill="var(--background)" stroke={ADD} strokeWidth={selFam === "add" ? 2 : 1.5} filter="url(#grape-fm-soft)" />
            <text x={mid(addBox).x} y={addBox.y + 17} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600} style={{ fill: ADD }}>Additive · GL(d+k)</text>
            <text x={mid(addBox).x} y={addBox.y + 31} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>rank-1 nilpotent → shear</text>
          </g>

          {/* leaves */}
          {(Object.keys(leaves) as NodeKey[]).map((k) => {
            const b = leaves[k]
            const c = leafColor(k)
            const active = sel === k
            return (
              <g key={k} style={{ cursor: "pointer" }} onClick={() => setSel(k)}>
                <rect x={b.x} y={b.y} width={b.w} height={b.h} rx={8}
                  fill={active ? c : "var(--muted)"} opacity={active ? 0.95 : 0.5}
                  stroke={c} strokeWidth={active ? 2 : 1.25} filter={active ? "url(#grape-fm-soft)" : undefined}
                  className="transition-all duration-200" />
                <text x={mid(b).x} y={b.y + 18} textAnchor="middle" fontSize={10.5} fontWeight={600}
                  className="font-mono" style={{ fill: active ? "var(--background)" : "var(--foreground)" }}>{INFO[k].name.length > 16 ? INFO[k].name.split(" ")[0] : INFO[k].name}</text>
                <text x={mid(b).x} y={b.y + 31} textAnchor="middle" fontSize={8} className="font-mono"
                  style={{ fill: active ? "var(--background)" : "var(--muted-foreground)" }}>{INFO[k].kind === "recovers" ? "exact" : "extension"}</text>
              </g>
            )
          })}
        </svg>

        {/* detail panel */}
        <div className="mt-2 rounded-lg border bg-muted/20 p-3">
          <div className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: selFam === "mul" ? MUL : ADD }} />
            <span className="font-mono text-sm font-medium text-foreground">{info.name}</span>
            <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              {info.kind === "recovers" ? "recovered exactly" : "GRAPE extension"}
            </span>
            <span className="ml-auto font-mono text-[10px] text-muted-foreground">{selFam === "mul" ? "SO(d)" : "GL(d+k)"}</span>
          </div>
          <div className="mt-2 overflow-x-auto rounded-md bg-background/60 px-3 py-2 font-mono text-xs text-foreground">{info.form}</div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            <span className="text-foreground/80">generator: </span>{info.gen}. {info.blurb}
          </p>
        </div>
      </div>
    </figure>
  )
}
