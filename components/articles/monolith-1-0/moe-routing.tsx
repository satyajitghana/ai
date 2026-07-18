"use client"

import { useState } from "react"

// Monolith 1.0's MoE layer, drawn as a field. Each layer has 128 routed experts
// (SwiGLU) plus one shared expert that is always on. A router picks the top-2 routed
// experts for each token, so 3 of 129 experts fire — the token fans to its 2 routed
// picks (which change per token) and the always-lit shared expert. Scrub the token
// index; flip sparse vs dense to see what the 32x sparsity buys back. Illustrative routing.

const ACCENT = "oklch(0.62 0.14 200)"

const COLS = 16
const ROWS = 8
const TOTAL = COLS * ROWS // 128 routed experts
const K = 2 // top-2 routed
const N_TOK = 24

const W = 760
const H = 440
const GX = 46
const GY = 54
const GW = 512
const GH = 196
const colStep = GW / (COLS - 1)
const rowStep = GH / (ROWS - 1)

const r2 = (n: number) => Math.round(n * 100) / 100

function pos(i: number): { x: number; y: number } {
  const c = i % COLS
  const r = Math.floor(i / COLS)
  return { x: r2(GX + c * colStep), y: r2(GY + r * rowStep) }
}

// deterministic top-2-of-128 from a token index (LCG, no Math.random -> SSR-safe)
function routedExperts(t: number): number[] {
  const s = new Set<number>()
  let x = (t * 2654435761 + 40503) >>> 0
  while (s.size < K) {
    x = (x * 1103515245 + 12345) >>> 0
    s.add(x % TOTAL)
  }
  return Array.from(s)
}

// shared-expert pill (right of the field), router, and token geometry
const SHX = 624
const SHY = 112
const SHW = 108
const SHH = 72
const ROUTER_Y = 322
const ROUTER_H = 30
const TOK_Y = 384
const TOK_H = 30

function up(x1: number, y1: number, x2: number, y2: number) {
  const my = r2((y1 + y2) / 2)
  return `M ${r2(x1)} ${r2(y1)} C ${r2(x1)} ${my}, ${r2(x2)} ${my}, ${r2(x2)} ${r2(y2)}`
}

export function MoeRouting() {
  const [t, setT] = useState(7)
  const [dense, setDense] = useState(false)

  const routed = routedExperts(t)
  const routedSet = new Set(routed)
  const activeTotal = dense ? TOTAL + 1 : K + 1 // routed active + shared

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>monolith moe · top-2 of 128 + 1 shared</span>
        <span className="text-muted-foreground/50">illustrative routing</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A layer of 128 routed experts plus one always-on shared expert; for token ${t} the router lights ${dense ? "all experts (dense)" : "the top-2 routed experts plus the shared expert"}.`}
        >
          <defs>
            <marker id="mono-moe-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="mono-moe-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="mono-moe-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={GX} y={30} className="fill-muted-foreground font-mono" fontSize={11}>128 routed experts (SwiGLU)</text>
          <text x={GX + GW} y={30} textAnchor="end" className="font-mono" fontSize={11} style={{ fill: ACCENT }}>
            {dense ? "129 active" : "3 active (top-2 + shared)"}
          </text>

          {/* routed-expert field */}
          {Array.from({ length: TOTAL }, (_, i) => {
            const p = pos(i)
            const on = dense || routedSet.has(i)
            const pick = !dense && routedSet.has(i)
            return (
              <circle
                key={i}
                cx={p.x}
                cy={p.y}
                r={pick ? 4 : on ? 3 : 2.4}
                fill={on ? ACCENT : "var(--muted-foreground)"}
                fillOpacity={on ? (dense ? 0.5 : 1) : 0.3}
                filter={pick ? "url(#mono-moe-soft)" : undefined}
              />
            )
          })}

          {/* fan: router -> the 2 routed picks (sparse only) */}
          {!dense &&
            routed.map((i) => {
              const p = pos(i)
              return (
                <path
                  key={`fan-${i}`}
                  d={up(W / 2, ROUTER_Y, p.x, p.y + 4)}
                  fill="none"
                  stroke={ACCENT}
                  strokeWidth={1.4}
                  strokeOpacity={0.6}
                  markerEnd="url(#mono-moe-arrow)"
                />
              )
            })}

          {/* router -> shared expert (always on, sparse view) */}
          {!dense && (
            <path
              d={up(W / 2, ROUTER_Y, SHX, SHY + SHH / 2)}
              fill="none"
              stroke={ACCENT}
              strokeWidth={1.4}
              strokeOpacity={0.6}
              markerEnd="url(#mono-moe-arrow)"
            />
          )}

          {/* shared expert — always lit, visually distinct pill */}
          <rect x={SHX} y={SHY} width={SHW} height={SHH} rx={10} fill={ACCENT} fillOpacity={0.16} stroke={ACCENT} strokeWidth={1.5} filter="url(#mono-moe-soft)" />
          <circle cx={SHX + SHW / 2} cy={SHY + 22} r={5} fill={ACCENT} />
          <text x={SHX + SHW / 2} y={SHY + 44} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>shared</text>
          <text x={SHX + SHW / 2} y={SHY + 60} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: ACCENT }}>always on</text>

          {/* router */}
          <rect x={W / 2 - 100} y={ROUTER_Y} width={200} height={ROUTER_H} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#mono-moe-soft)" />
          <text x={W / 2} y={ROUTER_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>router · top-2</text>

          {/* token -> router */}
          <path d={up(W / 2, TOK_Y, W / 2, ROUTER_Y + ROUTER_H)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#mono-moe-arrow-mut)" opacity={0.6} />

          {/* token */}
          <rect x={W / 2 - 58} y={TOK_Y} width={116} height={TOK_H} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#mono-moe-soft)" />
          <text x={W / 2} y={TOK_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>token {t}</text>
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">routing</span>
            {([["sparse (3)", false], ["dense (129)", true]] as [string, boolean][]).map(([label, v]) => (
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
            active params <span style={{ color: ACCENT }}>{dense ? "~1.57T (all experts)" : "~49.5B"}</span> of 1.57T ·{" "}
            <span className="text-foreground">{dense ? "1x" : "32x"} sparsity</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">token index (drag — the 2 routed picks change per token)</div>
          <input type="range" min={0} max={N_TOK - 1} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.14_200)]" disabled={dense} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Every token takes the <span style={{ color: ACCENT }}>shared</span> expert plus its{" "}
          <span className="text-foreground">top-2</span> routed picks — {activeTotal} of 129 experts, so a 1.57T-parameter
          layer stack activates only about <span className="text-foreground">49.5B</span> parameters per token. The shared
          expert never turns off (it carries the common computation), while the routed pair swings token to token — that
          split is why the sparsity is <span className="text-foreground">32x</span> without starving the always-needed work.
        </p>
      </div>
    </figure>
  )
}
