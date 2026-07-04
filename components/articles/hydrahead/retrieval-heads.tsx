"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// The interpretability finding that motivates head-wise hybridization, drawn as a
// diagram. Heads in the SAME layer, reading the SAME input, do different jobs — so
// each head node fans curved connectors up to the tokens it actually attends (arrow
// weight ∝ attention). Some reach far back to a specific token (the "needle"), which
// only full attention can do faithfully; others attend locally or diffusely, which
// linear attention approximates fine. HydraHead keeps FA only for the retrieval heads.
// Cycles through heads; click to pin one; degrades to a static first head.

const N = 20 // tokens; the query is the last one, the "needle" sits early
const NEEDLE = 3

type Head = { name: string; kind: string; fa: boolean; weights: number[] }

function build(): Head[] {
  const q = N - 1
  const local = Array.from({ length: N }, (_, i) => Math.exp(-((q - i) ** 2) / 6))
  const retrieval = Array.from({ length: N }, (_, i) => (i === NEEDLE ? 1 : 0.04 * Math.exp(-((q - i) ** 2) / 40)))
  const induction = Array.from({ length: N }, (_, i) => (i === 11 ? 0.9 : i === 12 ? 0.5 : 0.03))
  const diffuse = Array.from({ length: N }, () => 0.5 + 0.001)
  const norm = (w: number[]) => {
    const s = w.reduce((a, b) => a + b, 0)
    return w.map((x) => x / s)
  }
  return [
    { name: "head 2", kind: "retrieval — reaches back to the needle token", fa: true, weights: norm(retrieval) },
    { name: "head 5", kind: "local — attends to its neighbours", fa: false, weights: norm(local) },
    { name: "head 6", kind: "induction — copies from a matched earlier token", fa: true, weights: norm(induction) },
    { name: "head 9", kind: "diffuse — spreads attention broadly", fa: false, weights: norm(diffuse) },
  ]
}

const HEADS = build()
const FA = "oklch(0.64 0.18 25)"
const LA = "oklch(0.60 0.13 205)"
const GOLD = "oklch(0.75 0.15 85)"

// scene geometry (fixed viewBox)
const W = 760
const H = 236
const MX = 26
const BW = 20
const STEP = (W - 2 * MX - BW) / (N - 1)
const tokX = (i: number) => MX + i * STEP
const tokCx = (i: number) => tokX(i) + BW / 2
const TY = 44
const TH = 28
const HY = 174 // head node row
const HH = 46
const HNW = 150
const HGAP = 24
const headX = (k: number) => (W - (HEADS.length * HNW + (HEADS.length - 1) * HGAP)) / 2 + k * (HNW + HGAP)
const headCx = (k: number) => headX(k) + HNW / 2

const vcurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function RetrievalHeads() {
  const [i, setI] = useState(0)
  const [playing, setPlaying] = useState(true)

  useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setI((x) => (x + 1) % HEADS.length), 2600)
    return () => clearInterval(id)
  }, [playing])

  const h = HEADS[i]
  const max = Math.max(...h.weights)
  const c = h.fa ? FA : LA

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one layer · heads do different jobs</span>
        <button type="button" onClick={() => setPlaying((p) => !p)} className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground">
          {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${h.name}: ${h.kind}. ${h.fa ? "Retrieval-critical, keeps full attention." : "Short-range, linear attention is enough."}`}>
          <defs>
            <marker id="rh-arrow-fa" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={FA} strokeWidth={1.5} />
            </marker>
            <marker id="rh-arrow-la" viewBox="0 -5 10 10" markerWidth="6" markerHeight="6" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={LA} strokeWidth={1.5} />
            </marker>
            <filter id="rh-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>token sequence · attention of {h.name} →</text>

          {/* connectors: selected head → tokens it attends (weight ∝ opacity/width) */}
          {h.weights.map((w, t) => {
            const rel = w / max
            if (rel < 0.08) return null
            const strong = rel > 0.6
            return (
              <path
                key={t}
                d={vcurve(headCx(i), HY, tokCx(t), TY + TH)}
                fill="none"
                stroke={c}
                strokeWidth={1 + rel * 1.8}
                markerEnd={strong ? `url(#${h.fa ? "rh-arrow-fa" : "rh-arrow-la"})` : undefined}
                opacity={0.16 + rel * 0.72}
              />
            )
          })}

          {/* token nodes */}
          {Array.from({ length: N }).map((_, t) => {
            const rel = h.weights[t] / max
            const isNeedle = t === NEEDLE
            const isQuery = t === N - 1
            return (
              <g key={t}>
                <rect
                  x={tokX(t)}
                  y={TY}
                  width={BW}
                  height={TH}
                  rx={5}
                  fill={rel > 0.08 ? c : "var(--muted)"}
                  opacity={rel > 0.08 ? 0.2 + rel * 0.7 : 0.28}
                  stroke={isNeedle ? GOLD : isQuery ? "var(--foreground)" : "transparent"}
                  strokeWidth={isNeedle || isQuery ? 1.8 : 0}
                  className="transition-all duration-300"
                />
                {(isNeedle || isQuery) && (
                  <text x={tokCx(t)} y={TY + TH + 12} textAnchor="middle" className="font-mono" fontSize={9} fill={isNeedle ? GOLD : "var(--muted-foreground)"}>{isNeedle ? "needle" : "query"}</text>
                )}
              </g>
            )
          })}

          {/* head nodes */}
          {HEADS.map((hd, k) => {
            const sel = k === i
            const hc = hd.fa ? FA : LA
            return (
              <g key={hd.name} className="cursor-pointer" onClick={() => { setPlaying(false); setI(k) }}>
                <rect x={headX(k)} y={HY} width={HNW} height={HH} rx={9} fill={sel ? hc : "var(--background)"} opacity={sel ? 0.95 : 1} stroke={hc} strokeWidth={1.5} filter={sel ? "url(#rh-soft)" : undefined} className="transition-all duration-300" />
                <text x={headCx(k)} y={HY + 20} textAnchor="middle" className={sel ? "fill-background font-mono" : "fill-foreground font-mono"} fontSize={12} fontWeight={600}>{hd.name}</text>
                <text x={headCx(k)} y={HY + 35} textAnchor="middle" className="font-mono" fontSize={9.5} fill={sel ? "var(--background)" : hc} opacity={sel ? 0.85 : 1}>{hd.fa ? "full attention" : "linear attention"}</text>
              </g>
            )
          })}
        </svg>

        {/* verdict — every head's box overlaid in one grid cell so the region sizes to
            the tallest and the page never reflows as heads cycle */}
        <div className="mt-3 grid">
          {HEADS.map((hd, k) => {
            const hc = hd.fa ? FA : LA
            return (
              <div
                key={hd.name}
                aria-hidden={k !== i}
                className={cn(
                  "col-start-1 row-start-1 rounded-md bg-muted/40 px-3 py-2.5 transition-opacity duration-300",
                  k === i ? "opacity-100" : "pointer-events-none opacity-0"
                )}
                style={{ borderColor: hc, background: `${hc.replace(")", " / 0.08)")}` }}
              >
                <div className="font-mono text-xs">
                  <span className="text-foreground">{hd.name}</span>
                  <span className="text-muted-foreground"> · {hd.kind}</span>
                </div>
                <div className="mt-1 font-mono text-[11px]" style={{ color: hc }}>
                  {hd.fa ? "→ retrieval-critical: keep FULL attention" : "→ short-range: LINEAR attention is enough"}
                </div>
              </div>
            )
          })}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same layer, same input — yet these heads specialize. Only the ones that reach far
          back for a specific token genuinely need full attention; the local and diffuse heads
          lose almost nothing under linear attention. That split is the whole basis for
          hybridizing per head instead of per layer.
        </p>
      </div>
    </figure>
  )
}
