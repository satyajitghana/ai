"use client"

import { useState } from "react"

// Stable LatentMoE, drawn as a field. 896 experts, only 16 lit per token (1.8%).
// A router scores the field; quantile balancing lights the top 16; the token fans to
// a handful of them. Scrub the token index and the lit set changes; toggle dense vs
// sparse to see the compute the sparsity buys back. Illustrative routing.

const ACCENT = "oklch(0.58 0.15 265)"

const COLS = 32
const ROWS = 28
const TOTAL = COLS * ROWS // 896
const K = 16 // active experts per token
const N_TOK = 24 // scrubbable tokens

const W = 760
const H = 430
const GX = 44
const GY = 48
const GW = 672
const GH = 224
const colStep = GW / (COLS - 1)
const rowStep = GH / (ROWS - 1)

function pos(i: number): { x: number; y: number } {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  return { x: Math.round((GX + c * colStep) * 100) / 100, y: Math.round((GY + r * rowStep) * 100) / 100 }
}

// deterministic 16-of-896 selection from a token index (LCG, no Math.random)
function litExperts(t: number): number[] {
  const s = new Set<number>()
  let x = (t * 1103515245 + 12345) >>> 0
  while (s.size < K) {
    x = (x * 1103515245 + 12345) >>> 0
    s.add(x % TOTAL)
  }
  return Array.from(s)
}

const ROUTER_Y = 312
const TOK_Y = 372

function up(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function LatentMoE() {
  const [t, setT] = useState(7)
  const [dense, setDense] = useState(false)

  const lit = litExperts(t)
  const litSet = new Set(lit)
  const fan = lit.slice(0, 8)
  const activePct = ((K / TOTAL) * 100).toFixed(1)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>stable latentMoE · 16 of 896 experts</span>
        <span className="text-muted-foreground/50">illustrative routing</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A field of 896 latent experts with ${dense ? "all active (dense)" : "16 active (sparse)"} for token ${t}; a router fans the token to its selected experts.`}
        >
          <defs>
            <marker id="lm-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="lm-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="lm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={GX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>
            896 latent experts
          </text>
          <text x={GX + GW} y={30} textAnchor="end" className="font-mono" fontSize={11} style={{ fill: ACCENT }}>
            {dense ? "896 active" : `${K} active (${activePct}%)`}
          </text>

          {/* expert field */}
          {Array.from({ length: TOTAL }, (_, i) => {
            const p = pos(i)
            const on = dense || litSet.has(i)
            const isFan = !dense && fan.includes(i)
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={on ? (isFan ? 3.4 : 2.9) : 2.1}
                fill={on ? ACCENT : "var(--muted-foreground)"}
                fillOpacity={on ? (dense ? 0.5 : 1) : 0.28}
              />
            )
          })}

          {/* fan from router to a few lit experts */}
          {!dense &&
            fan.map((i) => {
              const p = pos(i)
              return (
                <path
                  key={`fan-${i}`}
                  d={up(W / 2, ROUTER_Y, p.x, p.y + 3)}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.3}
                  strokeOpacity={0.55}
                  markerEnd="url(#lm-arrow)"
                />
              )
            })}

          {/* router */}
          <rect x={W / 2 - 90} y={ROUTER_Y} width={180} height={28} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#lm-soft)" />
          <text x={W / 2} y={ROUTER_Y + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            router · quantile top-{K}
          </text>

          {/* token -> router */}
          <path d={up(W / 2, TOK_Y, W / 2, ROUTER_Y + 28)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#lm-arrow-mut)" opacity={0.6} />

          {/* token */}
          <rect x={W / 2 - 54} y={TOK_Y} width={108} height={28} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#lm-soft)" />
          <text x={W / 2} y={TOK_Y + 18} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
            token {t}
          </text>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">routing</span>
            {([["sparse (16)", false], ["dense (896)", true]] as [string, boolean][]).map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => setDense(v)}
                aria-pressed={dense === v}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (dense === v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            active params <span style={{ color: ACCENT }}>{dense ? "~2.8T (all experts)" : "~50B (16 experts)"}</span> · compute{" "}
            <span className="text-foreground">{dense ? "100%" : `${activePct}% of experts`}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">token index (drag — the selected 16 change per token)</div>
          <input type="range" min={0} max={N_TOK - 1} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.15_265)]" disabled={dense} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The experts live in a learned <span style={{ color: ACCENT }}>latent</span> space; a router picks{" "}
          <span className="text-foreground">16 of 896</span> for each token — {activePct}% of the field — so a 2.8T-parameter
          model activates only about <span className="text-foreground">50B</span> parameters per token. At this sparsity, which
          16 you pick, and keeping every expert equally busy, becomes the whole ballgame — which is what{" "}
          <span style={{ color: ACCENT }}>quantile balancing</span> is for.
        </p>
      </div>
    </figure>
  )
}
