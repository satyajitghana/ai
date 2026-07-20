"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// Token → expert dispatch map, drawn as a composed bipartite scene. A short sequence
// is routed token-by-token; each token's two chosen experts (of 8) are joined by
// curved connectors — accent for its first choice, amber for its second — and every
// other expert stays dark. That darkness is the sparsity MoE buys. Scrub or hover a
// token to isolate its route; the SVG bars underneath show per-expert load: some
// experts naturally get more traffic than others.

const ACCENT = "oklch(0.60 0.15 255)"
const AMBER = "oklch(0.72 0.15 60)"
const EXPERTS = 8

// Deterministic top-2 assignment per token (what a trained router might pick).
const TOKENS: { t: string; experts: [number, number] }[] = [
  { t: "The", experts: [5, 0] },
  { t: "quick", experts: [2, 5] },
  { t: "brown", experts: [5, 1] },
  { t: "fox", experts: [3, 6] },
  { t: "jumps", experts: [0, 2] },
  { t: "over", experts: [5, 4] },
  { t: "the", experts: [5, 0] },
  { t: "dog", experts: [6, 3] },
]

// ── scene geometry (viewBox units) ─────────────────────────────────────────
const W = 640
const H = 328
const TOK_CX = 92
const TOK_W = 84
const EXP_CX = 556
const EXP_W = 96
const tokY = (i: number) => 28 + i * ((H - 48) / (TOKENS.length - 1))
const expY = (i: number) => 28 + i * ((H - 48) / (EXPERTS - 1))

export function MoeRouting() {
  const [active, setActive] = useState(-1) // -1 = show all
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(() => setActive((a) => (a + 1) % TOKENS.length), 900)
    return () => clearTimeout(t)
  }, [playing, active])

  // per-expert load over the whole sequence
  const load = Array.from({ length: EXPERTS }, (_, e) =>
    TOKENS.filter((tok) => tok.experts.includes(e)).length
  )
  const maxLoad = Math.max(...load)

  const shown = (ti: number) => active === -1 || active === ti

  const edge = (ti: number, e: number) => {
    const y1 = tokY(ti)
    const y2 = expY(e)
    const x1 = TOK_CX + TOK_W / 2
    const x2 = EXP_CX - EXP_W / 2 - 4
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>token → top-2 expert routing</span>
        <span>{active === -1 ? "all tokens" : `token: "${TOKENS[active].t}"`}</span>
      </div>

      <div className="overflow-x-auto px-2 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Each token is connected to two of eight experts; most expert slots stay dark."
        >
          <defs>
            <marker id="moe-d-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="moe-d-arrow-b" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={AMBER} strokeWidth={1.5} />
            </marker>
            <filter id="moe-d-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* edges (behind nodes) */}
          {TOKENS.map((tok, ti) =>
            tok.experts.map((e, k) => {
              const on = shown(ti)
              const second = k === 1
              return (
                <path
                  key={`${ti}-${k}`}
                  d={edge(ti, e)}
                  fill="none"
                  stroke={second ? AMBER : ACCENT}
                  strokeWidth={on ? 1.75 : 1}
                  markerEnd={on ? `url(#moe-d-arrow${second ? "-b" : ""})` : undefined}
                  style={{
                    opacity: on ? 0.9 : 0.06,
                    transition: "opacity 0.3s, stroke-width 0.3s",
                  }}
                />
              )
            })
          )}

          {/* token nodes */}
          {TOKENS.map((tok, ti) => (
            <g
              key={ti}
              onMouseEnter={() => {
                setPlaying(false)
                setActive(ti)
              }}
              onMouseLeave={() => setActive(-1)}
              style={{ cursor: "pointer" }}
            >
              <rect
                x={TOK_CX - TOK_W / 2}
                y={tokY(ti) - 13}
                width={TOK_W}
                height={26}
                rx={7}
                fill="var(--background)"
                stroke={shown(ti) ? ACCENT : "var(--border)"}
                strokeWidth={1.5}
                filter={shown(ti) ? "url(#moe-d-soft)" : undefined}
                style={{ opacity: shown(ti) ? 1 : 0.45, transition: "opacity 0.3s" }}
              />
              <text
                x={TOK_CX}
                y={tokY(ti) + 4}
                textAnchor="middle"
                className="fill-foreground font-mono"
                fontSize={12}
                style={{ opacity: shown(ti) ? 1 : 0.45, transition: "opacity 0.3s" }}
              >
                {tok.t}
              </text>
            </g>
          ))}

          {/* expert nodes */}
          {Array.from({ length: EXPERTS }, (_, e) => {
            const t = active === -1 ? undefined : TOKENS[active]
            const role = t ? (t.experts[0] === e ? 0 : t.experts[1] === e ? 1 : -1) : 2
            const lit = role !== -1
            const fill = role === 1 ? AMBER : role === -1 ? "var(--muted)" : ACCENT
            return (
              <g key={e}>
                <rect
                  x={EXP_CX - EXP_W / 2}
                  y={expY(e) - 13}
                  width={EXP_W}
                  height={26}
                  rx={7}
                  fill={fill}
                  opacity={lit ? (role === 2 ? 0.55 : 0.95) : 0.16}
                  filter={lit && role !== 2 ? "url(#moe-d-soft)" : undefined}
                  style={{ transition: "opacity 0.3s" }}
                />
                <text
                  x={EXP_CX}
                  y={expY(e) + 4}
                  textAnchor="middle"
                  fontSize={11}
                  fontWeight={600}
                  className={cn("font-mono", lit ? "fill-background" : "fill-muted-foreground")}
                  style={{ opacity: lit ? 1 : 0.5, transition: "opacity 0.3s" }}
                >
                  expert {e}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* per-expert load — SVG bars */}
      <div className="border-t px-4 py-3">
        <div className="mb-1 font-mono text-[10px] text-muted-foreground">
          tokens routed per expert (this sequence)
        </div>
        <svg viewBox="0 0 640 92" className="w-full" role="img" aria-label="Bar chart of how many tokens each of the 8 experts handled across the sequence.">
          <line x1={8} y1={74} x2={632} y2={74} stroke="var(--border)" strokeWidth={1} />
          {load.map((c, e) => {
            const bw = 60
            const gap = (632 - 8 - EXPERTS * bw) / (EXPERTS - 1)
            const x = 8 + e * (bw + gap)
            const h = (c / maxLoad) * 52
            const highlight = active !== -1 && TOKENS[active]?.experts.includes(e)
            return (
              <g key={e}>
                <text x={x + bw / 2} y={74 - h - 5} textAnchor="middle" fontSize={11} className="fill-muted-foreground font-mono tabular-nums">
                  {c}
                </text>
                <rect
                  x={x}
                  y={74 - h}
                  width={bw}
                  height={Math.max(h, 0.5)}
                  rx={4}
                  fill={ACCENT}
                  opacity={0.28 + 0.6 * (c / maxLoad)}
                  stroke={highlight ? ACCENT : "transparent"}
                  strokeWidth={1.5}
                  className="transition-all duration-300"
                />
                <text x={x + bw / 2} y={88} textAnchor="middle" fontSize={10} fontWeight={600} className="fill-muted-foreground font-mono">
                  E{e}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* controls */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t px-3 py-2.5">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
        <div className="flex flex-1 items-center gap-2">
          <span className="font-mono text-[10px] text-muted-foreground">token</span>
          <Range
            min={-1}
            max={TOKENS.length - 1}
            value={active}
            onChange={(e) => {
              setPlaying(false)
              setActive(Number(e.target.value))
            }}
            className="w-full min-w-24 max-w-56 cursor-pointer "
            aria-label="scrub token" accent="oklch(0.60 0.15 255)" />
        </div>
        <button
          type="button"
          onClick={() => {
            setPlaying(false)
            setActive(-1)
          }}
          aria-pressed={active === -1}
          className={cn(
            "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
            active === -1 ? "text-foreground" : "text-muted-foreground hover:text-foreground"
          )}
          style={active === -1 ? { background: "var(--muted)" } : undefined}
        >
          all tokens
        </button>
      </div>
    </figure>
  )
}
