"use client"

import { useEffect, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

// Token → expert dispatch map. A short sequence is routed token-by-token; each
// token lights exactly its top-2 experts (of 8), so the picture is mostly dark —
// that darkness is the sparsity MoE buys. The per-expert tallies underneath show
// load: some experts naturally get more traffic than others.

const EXPERTS = 8
const COLORS = Array.from(
  { length: EXPERTS },
  (_, i) => `oklch(0.72 0.13 ${(i * 45) % 360})`
)

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

// geometry
const W = 640
const H = 320
const TOK_X = 96
const EXP_X = 520
const tokY = (i: number) => 34 + i * ((H - 60) / (TOKENS.length - 1))
const expY = (i: number) => 28 + i * ((H - 56) / (EXPERTS - 1))

export function MoeRouting() {
  const [active, setActive] = useState(-1) // -1 = show all
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!playing) return
    const t = setTimeout(
      () => setActive((a) => (a + 1) % TOKENS.length),
      900
    )
    return () => clearTimeout(t)
  }, [playing, active])

  // per-expert load over the whole sequence
  const load = Array.from({ length: EXPERTS }, (_, e) =>
    TOKENS.filter((tok) => tok.experts.includes(e)).length
  )
  const maxLoad = Math.max(...load)

  const shown = (ti: number) => active === -1 || active === ti

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
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
          {/* edges */}
          {TOKENS.map((tok, ti) =>
            tok.experts.map((e, k) => {
              const y1 = tokY(ti)
              const y2 = expY(e)
              const midX = (TOK_X + EXP_X) / 2
              return (
                <path
                  key={`${ti}-${k}`}
                  d={`M ${TOK_X + 44} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${EXP_X - 16} ${y2}`}
                  fill="none"
                  stroke={COLORS[e]}
                  strokeWidth={shown(ti) ? 2 : 1}
                  style={{
                    opacity: shown(ti) ? 0.9 : 0.07,
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
                x={TOK_X - 44}
                y={tokY(ti) - 13}
                width={88}
                height={26}
                rx={6}
                fill="var(--background)"
                stroke="var(--border)"
                style={{ opacity: shown(ti) ? 1 : 0.4, transition: "opacity 0.3s" }}
              />
              <text
                x={TOK_X}
                y={tokY(ti) + 4}
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="12"
                fill="var(--foreground)"
                style={{ opacity: shown(ti) ? 1 : 0.4, transition: "opacity 0.3s" }}
              >
                {tok.t}
              </text>
            </g>
          ))}

          {/* expert nodes */}
          {Array.from({ length: EXPERTS }, (_, e) => {
            const lit = active === -1 || TOKENS[active]?.experts.includes(e)
            return (
              <g key={e}>
                <rect
                  x={EXP_X - 16}
                  y={expY(e) - 13}
                  width={108}
                  height={26}
                  rx={6}
                  fill={COLORS[e]}
                  style={{ opacity: lit ? 1 : 0.16, transition: "opacity 0.3s" }}
                />
                <text
                  x={EXP_X + 38}
                  y={expY(e) + 4}
                  textAnchor="middle"
                  fontFamily="monospace"
                  fontSize="11"
                  fill="oklch(0.2 0 0)"
                  style={{ opacity: lit ? 1 : 0.3, transition: "opacity 0.3s" }}
                >
                  expert {e}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {/* per-expert load */}
      <div className="border-t px-4 py-3">
        <div className="mb-2 font-mono text-[10px] text-muted-foreground">
          tokens routed per expert (this sequence)
        </div>
        <div className="flex items-end gap-2" style={{ height: 56 }}>
          {load.map((c, e) => (
            <div key={e} className="flex flex-1 flex-col items-center justify-end gap-1">
              <span className="font-mono text-[10px] text-muted-foreground tabular-nums">
                {c}
              </span>
              <div
                className="w-full rounded-t-sm transition-all duration-300"
                style={{
                  height: `${(c / maxLoad) * 100}%`,
                  background: COLORS[e],
                }}
              />
              <span className="font-mono text-[10px] text-muted-foreground">E{e}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t px-3 py-2">
        <button
          type="button"
          onClick={() => setPlaying((p) => !p)}
          className="flex cursor-pointer items-center gap-1 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {playing ? <PauseIcon size={13} weight="fill" /> : <PlayIcon size={13} weight="fill" />}
          {playing ? "pause" : "play"}
        </button>
        <span className="font-mono text-[11px] text-muted-foreground">
          hover a token to isolate its route
        </span>
      </div>
    </figure>
  )
}
