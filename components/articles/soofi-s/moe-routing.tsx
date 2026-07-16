"use client"

import { useState } from "react"

// A granular MoE layer in Soofi S: 128 routed experts, of which a learned sigmoid-gated
// router activates 6 per token, plus 2 shared experts that are always on. Across the
// whole network that sparsity is what turns 31.6B total parameters into just ~3.2B
// active per token — "the capacity of a 30B network at roughly the inference cost of a
// 3B one." Scrub the token to reroute; the chosen experts change, the count never does.

const ROUTED = "oklch(0.60 0.13 250)" // indigo — routed experts
const CHOSEN = "oklch(0.62 0.20 320)" // Soofi magenta — the 6 selected
const SHARED = "oklch(0.70 0.15 70)" // amber — always-on shared experts
const NROUTED = 128
const KTOP = 6
const NSHARED = 2

const COLS = 16
const ROWS = NROUTED / COLS // 8

// Deterministic per-token expert scores — no randomness.
function score(token: number, e: number) {
  const s = Math.sin((e + 1) * 0.7 + token * 1.3) + Math.cos((e + 1) * 0.31 - token * 0.5)
  return s
}

const W = 760
const H = 300
const TX = 70 // token node centre x
const TY = 150
const GRID_X = 250
const GRID_TOP = 40
const CELL = 26
const GW = COLS * CELL
const ex = (e: number) => GRID_X + (e % COLS) * CELL + CELL / 2
const ey = (e: number) => GRID_TOP + Math.floor(e / COLS) * CELL + CELL / 2

export function MoeRouting() {
  const [token, setToken] = useState(3)

  const ranked = Array.from({ length: NROUTED }, (_, e) => e).sort((a, b) => score(token, b) - score(token, a))
  const chosen = new Set(ranked.slice(0, KTOP))

  // shared-expert node positions (right of the grid)
  const shX = GRID_X + GW + 46
  const shY = (j: number) => TY - 20 + j * 40

  const curve = (x2: number, y2: number) => {
    const x1 = TX + 26
    const y1 = TY
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one MoE layer · 128 routed + 2 shared experts</span>
        <span className="text-muted-foreground/60">routing illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`For this token, a router picks ${KTOP} of ${NROUTED} routed experts plus ${NSHARED} always-on shared experts.`}>
          <defs>
            <marker id="moe-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={CHOSEN} strokeWidth={1.5} />
            </marker>
            <marker id="moe-arrow-sh" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SHARED} strokeWidth={1.5} />
            </marker>
            <filter id="moe-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* connectors to chosen routed experts */}
          {[...chosen].map((e) => (
            <path key={e} d={curve(ex(e), ey(e))} fill="none" stroke={CHOSEN} strokeWidth={1.4} markerEnd="url(#moe-arrow)" opacity={0.75} />
          ))}
          {/* connectors to shared experts */}
          {Array.from({ length: NSHARED }, (_, j) => (
            <path key={j} d={curve(shX - 15, shY(j))} fill="none" stroke={SHARED} strokeWidth={1.4} markerEnd="url(#moe-arrow-sh)" opacity={0.7} />
          ))}

          {/* routed expert grid */}
          {Array.from({ length: NROUTED }, (_, e) => {
            const isC = chosen.has(e)
            return (
              <rect
                key={e}
                x={ex(e) - CELL / 2 + 2}
                y={ey(e) - CELL / 2 + 2}
                width={CELL - 4}
                height={CELL - 4}
                rx={4}
                fill={isC ? CHOSEN : ROUTED}
                opacity={isC ? 0.95 : 0.16}
                stroke={isC ? CHOSEN : "transparent"}
                strokeWidth={1.5}
                filter={isC ? "url(#moe-soft)" : undefined}
                className="transition-all duration-200"
              />
            )
          })}
          <text x={GRID_X} y={GRID_TOP - 8} className="fill-muted-foreground font-mono" fontSize={10}>128 routed experts · {KTOP} active</text>

          {/* shared experts */}
          {Array.from({ length: NSHARED }, (_, j) => (
            <g key={j}>
              <rect x={shX - 15} y={shY(j) - 11} width={54} height={22} rx={5} fill={SHARED} opacity={0.9} filter="url(#moe-soft)" />
              <text x={shX + 12} y={shY(j) + 4} textAnchor="middle" className="fill-background font-mono" fontSize={8.5} fontWeight={600}>shared</text>
            </g>
          ))}
          <text x={shX + 12} y={shY(NSHARED - 1) + 28} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>always on</text>

          {/* token node */}
          <rect x={TX - 26} y={TY - 22} width={52} height={44} rx={8} fill="var(--background)" stroke={CHOSEN} strokeWidth={1.5} filter="url(#moe-soft)" />
          <text x={TX} y={TY - 3} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>token</text>
          <text x={TX} y={TY + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>router</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] text-muted-foreground">
          <span>
            active per token: <span style={{ color: CHOSEN }}>{KTOP}</span> routed + <span style={{ color: SHARED }}>{NSHARED}</span> shared of {NROUTED}
          </span>
          <span className="ml-auto text-foreground">~3.2B / 31.6B params (~10%)</span>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">token (drag to reroute)</div>
          <input type="range" min={0} max={40} value={token} onChange={(e) => setToken(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.20_320)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A learned, sigmoid-gated router sends each token to its top-<span className="text-foreground">6</span> of{" "}
          <span style={{ color: ROUTED }}>128</span> routed experts; <span style={{ color: SHARED }}>2 shared</span>{" "}
          experts run for every token. Drag to reroute — the <span style={{ color: CHOSEN }}>chosen set</span> changes
          token to token, but the count stays fixed. Summed over all 23 MoE layers, that is how a{" "}
          <span className="text-foreground">31.6B</span>-parameter model activates only ~<span className="text-foreground">3.2B</span>{" "}
          per token: the capacity of a 30B network at roughly the inference cost of a 3B one.
        </p>
      </div>
    </figure>
  )
}
