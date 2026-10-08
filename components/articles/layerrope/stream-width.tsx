"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// A TOY residual stream. Every layer has two sublayers (attention, MLP). Each
// sublayer reads the stream through a normalisation (unit RMS), multiplies by a
// read gain a(l), runs a block that is held to unit gain, multiplies by a write
// gain b(l) and adds the result back. Writes are assumed independent of the
// stream, so variances add:
//
//   Var(h_l) = Var(h_{l-1}) + sum over sublayers of (a(l) * b(l))^2,  Var(h_0) = 0.4
//
// Var(h_0) = 0.4 is the input variance in LayerRoPE's Figure 1(a). The real
// stream grows much faster than this (575 at layer 24 for the 1.3B Pre-Norm
// model, same figure) because the blocks' own weights grow during training;
// the toy holds them fixed so only the schedule moves.
//
// Schedules: Pre-Norm has no depth factor (a = b = 1). Layer-Norm Scaling
// multiplies the read by 1/sqrt(l+1) (Sun et al. 2025). LayerRoPE's magnitude
// factor is e^{r(l)} = e^alpha (l+1)^beta at each site. The "learned" preset
// uses the 1.3B Pre-Norm + LayerRoPE slopes printed in the paper's Figure 20
// (attention read -0.14, write +0.76; MLP read -0.16, write +0.56); the layer-0
// multipliers (0.75, 0.45, 0.78, 0.72) are read off that plot by eye. Those
// slopes were learned by a 24-layer model; using them past layer 23 is an
// extrapolation, which the readout says.

type Site = { a0: number; ba: number; b0: number; bb: number }
type Sched = { attn: Site; mlp: Site }

const V0 = 0.4

const PRESETS: { id: string; name: string; color: string; sched: Sched | "lns" }[] = [
  {
    id: "pre",
    name: "Pre-Norm",
    color: "oklch(0.55 0.13 245)",
    sched: { attn: { a0: 1, ba: 0, b0: 1, bb: 0 }, mlp: { a0: 1, ba: 0, b0: 1, bb: 0 } },
  },
  { id: "lns", name: "Layer-Norm Scaling", color: "oklch(0.6 0.13 165)", sched: "lns" },
  {
    id: "lrope",
    name: "LayerRoPE, learned (1.3B)",
    color: "oklch(0.58 0.2 20)",
    sched: { attn: { a0: 0.75, ba: -0.14, b0: 0.45, bb: 0.76 }, mlp: { a0: 0.78, ba: -0.16, b0: 0.72, bb: 0.56 } },
  },
]

const DEPTHS = [24, 48, 96, 192, 384, 512]

function gains(s: Sched | "lns", l: number, custom: { br: number; bw: number } | null) {
  if (custom) {
    const a = mpow(l + 1, custom.br)
    const b = mpow(l + 1, custom.bw)
    return [a * b, a * b, a]
  }
  if (s === "lns") {
    const a = 1 / Math.sqrt(l + 1)
    return [a, a, a]
  }
  const aa = s.attn.a0 * mpow(l + 1, s.attn.ba)
  const ab = s.attn.b0 * mpow(l + 1, s.attn.bb)
  const ma = s.mlp.a0 * mpow(l + 1, s.mlp.ba)
  const mb = s.mlp.b0 * mpow(l + 1, s.mlp.bb)
  return [aa * ab, ma * mb, ma]
}

function run(s: Sched | "lns", L: number, custom: { br: number; bw: number } | null) {
  const v: number[] = [V0]
  const upd: number[] = []
  let V = V0
  let lastRead = 1
  for (let l = 0; l < L; l++) {
    const [ga, gm, read] = gains(s, l, custom)
    const add = ga * ga + gm * gm
    upd.push(Math.sqrt(add / V))
    V += add
    v.push(V)
    lastRead = read
  }
  return { v, upd, lastRead }
}

const W = 720
const H = 300
const PL = 50
const PR = 700
const PT = 16
const PB = 140
const P2T = 178
const P2B = 262

export function StreamWidth() {
  const [li, setLi] = useState(0)
  const [custom, setCustom] = useState(false)
  const [br, setBr] = useState(-0.15)
  const [bw, setBw] = useState(0.65)
  const L = DEPTHS[li]

  const runs = useMemo(
    () =>
      PRESETS.map((p) => ({
        ...p,
        r: run(p.sched, L, null),
      })),
    [L]
  )
  const mine = useMemo(() => (custom ? run("lns", L, { br, bw }) : null), [custom, L, br, bw])

  const all = [...runs.map((r) => r.r.v), ...(mine ? [mine.v] : [])]
  const vmax = Math.max(...all.map((v) => v[v.length - 1]))
  const lmin = mlog10(0.3)
  const lmax = Math.max(mlog10(vmax) + 0.15, 1.2)
  const x = (l: number) => PL + (l / L) * (PR - PL)
  const y = (v: number) => PB - ((mlog10(v) - lmin) / (lmax - lmin)) * (PB - PT)
  const umax = 1.6
  const yu = (u: number) => P2B - (Math.min(u, umax) / umax) * (P2B - P2T)

  const step = Math.max(1, Math.floor(L / 120))
  const pathV = (v: number[]) => {
    let d = ""
    for (let l = 0; l <= L; l += step) d += (l === 0 ? "M " : "L ") + x(l).toFixed(1) + " " + y(v[l]).toFixed(1) + " "
    d += "L " + x(L).toFixed(1) + " " + y(v[L]).toFixed(1)
    return d
  }
  const pathU = (u: number[]) => {
    let d = ""
    for (let l = 0; l < L; l += step) d += (l === 0 ? "M " : "L ") + x(l + 1).toFixed(1) + " " + yu(u[l]).toFixed(1) + " "
    return d
  }

  const decades: number[] = []
  for (let k = Math.ceil(lmin); k <= Math.floor(lmax); k++) decades.push(k)

  const pre = runs[0].r
  const shown = mine
    ? [{ id: "you", name: `your schedule (read ${br.toFixed(2)}, write ${bw >= 0 ? "+" : ""}${bw.toFixed(2)})`, color: "oklch(0.62 0.17 300)", r: mine }]
    : []
  const rows = [...runs, ...shown]

  // sqrt(2k+1): the late-layer relative update a power-law write schedule buys over a flat one
  const k = custom ? br + bw : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">toy residual stream &middot; variance across depth</span>
        <button
          type="button"
          onClick={() => setCustom((c) => !c)}
          aria-pressed={custom}
          className={cn(
            "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
            custom ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          set your own slopes
        </button>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Toy residual-stream variance and per-layer relative update against depth">
          {decades.map((dk) => (
            <g key={dk}>
              <line x1={PL} x2={PR} y1={y(mpow(10, dk))} y2={y(mpow(10, dk))} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={PL - 6} y={y(mpow(10, dk)) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {dk === 0 ? "1" : `1e${dk}`}
              </text>
            </g>
          ))}
          <text x={PL} y={PT - 4} className="fill-muted-foreground font-mono text-[10px]">
            Var(h) of the stream, log scale
          </text>
          {rows.map((r) => (
            <path key={r.id} d={pathV(r.r.v)} fill="none" stroke={r.color} strokeWidth={r.id === "pre" ? 1.6 : 2.2} />
          ))}

          {[0, 0.5, 1, 1.5].map((g) => (
            <g key={g}>
              <line x1={PL} x2={PR} y1={yu(g)} y2={yu(g)} stroke="var(--border)" strokeDasharray="2 3" />
              <text x={PL - 6} y={yu(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[10px]">
                {g}
              </text>
            </g>
          ))}
          <text x={PL} y={P2T - 6} className="fill-muted-foreground font-mono text-[10px]">
            relative update: size of layer l&apos;s write / size of the stream it lands on
          </text>
          {rows.map((r) => (
            <path key={`u${r.id}`} d={pathU(r.r.upd)} fill="none" stroke={r.color} strokeWidth={r.id === "pre" ? 1.4 : 1.9} />
          ))}
          {[0, 0.25, 0.5, 0.75, 1].map((f) => (
            <text key={f} x={x(Math.round(f * L))} y={P2B + 16} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
              {Math.round(f * L)}
            </text>
          ))}
          <text x={(PL + PR) / 2} y={P2B + 32} textAnchor="middle" className="fill-muted-foreground font-mono text-[10px]">
            layer l
          </text>
          {L > 24 ? (
            <line x1={x(24)} x2={x(24)} y1={PT} y2={P2B} stroke="var(--foreground)" strokeDasharray="3 3" opacity={0.25} />
          ) : null}
        </svg>

        <div className="flex items-center gap-3">
          <span className="shrink-0 font-mono text-[11px] text-muted-foreground">layers</span>
          <Range
            min={0}
            max={DEPTHS.length - 1}
            step={1}
            value={li}
            onChange={(e) => setLi(Number((e.target as HTMLInputElement).value))}
            aria-label="number of layers"
            className="grow"
          />
          <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums text-foreground">{L}</span>
        </div>

        {custom ? (
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">read slope</span>
              <Range min={-1} max={0.5} step={0.01} value={br} onChange={(e) => setBr(Number((e.target as HTMLInputElement).value))} aria-label="read slope" className="grow" />
              <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums">{br.toFixed(2)}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="w-24 shrink-0 font-mono text-[11px] text-muted-foreground">write slope</span>
              <Range min={-0.5} max={1.2} step={0.01} value={bw} onChange={(e) => setBw(Number((e.target as HTMLInputElement).value))} aria-label="write slope" className="grow" />
              <span className="w-12 shrink-0 text-right font-mono text-[11px] tabular-nums">{bw.toFixed(2)}</span>
            </div>
          </div>
        ) : null}

        <div className="space-y-1.5" role="list" aria-label="end-of-stack readout">
          {rows.map((r) => {
            const vL = r.r.v[L]
            const uL = r.r.upd[L - 1]
            return (
              <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 font-mono text-[11px]" role="listitem">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: r.color }} />
                <span className="min-w-44 grow text-foreground">{r.name}</span>
                <span className="tabular-nums text-muted-foreground">
                  Var(h<sub>{L}</sub>) <span className="text-foreground">{vL < 1000 ? vL.toFixed(1) : vL.toExponential(1)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  &times;Pre <span className="text-foreground">{(vL / pre.v[L]).toFixed(2)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  last update <span className="text-foreground">{uL.toFixed(3)}</span>
                </span>
                <span className="tabular-nums text-muted-foreground">
                  last read gain <span className="text-foreground">{r.r.lastRead.toFixed(2)}</span>
                </span>
              </div>
            )
          })}
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground">
          A toy, not a measurement. Each block is held at unit gain and its write is assumed independent of the stream, so
          the only thing that changes between lines is the depth schedule on the read and write gains. The learned slopes
          come from LayerRoPE&apos;s 24-layer 1.3B model (paper, Figure 20); past the dashed line at layer 24 they are
          extrapolated.
          {k != null ? (
            <>
              {" "}
              With per-layer write size growing as (l+1)<sup>{k.toFixed(2)}</sup>, a late layer&apos;s relative update
              ends up about {Math.sqrt(Math.max(0, 2 * k + 1)).toFixed(2)}&times; Pre-Norm&apos;s at the same depth: it
              still shrinks like 1/&radic;l, just from a higher start.
            </>
          ) : null}
          {" "}
          In a model this simple, turning the read down and the write up are the same knob; the paper&apos;s reason to
          split them lives in the nonlinear blocks (attention logits grow with the square of the read gain), which the toy
          leaves out.
        </p>
      </div>
    </figure>
  )
}
