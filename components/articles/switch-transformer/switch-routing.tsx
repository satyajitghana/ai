"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Switch Transformer routing, drawn as a diagram. A router scores every expert for
// each token; classic MoE (Shazeer et al. 2017) sends each token to its top-2 experts,
// while Switch simplifies to top-1 — one expert per token. Flip the toggle and watch the
// connectors collapse from two-per-token to one: fewer routed copies means less router
// math and, critically, less cross-device communication. Deterministic scores; illustrative.

const SEL = "oklch(0.60 0.15 255)" // primary route (the argmax expert)
const SEL2 = "oklch(0.72 0.15 60)" // the second-best expert (only used in top-2)

const NT = 6 // tokens
const NE = 4 // experts

// deterministic router score in [0,1] — no Math.random / Date.now
function score(t: number, e: number) {
  const s = Math.sin((t + 1) * 1.3 + (e + 1) * 2.1)
  const c = Math.cos((t + 1) * 0.7 - (e + 1) * 1.1)
  return (s * 0.6 + c * 0.4 + 1) / 2
}

// scene geometry (viewBox units)
const W = 760
const H = 330
const TX = 40
const TW = 118
const TH = 30
const ty = (t: number) => 40 + t * 48
const EX = 596
const EW = 144
const EH = 48
const ey = (e: number) => 46 + e * 66

type Mode = "top1" | "top2"

export function SwitchRouting() {
  const [mode, setMode] = useState<Mode>("top1")

  // rank experts per token by score (descending)
  const ranked = Array.from({ length: NT }, (_, t) =>
    Array.from({ length: NE }, (_, e) => e).sort((a, b) => score(t, b) - score(t, a)),
  )
  const k = mode === "top1" ? 1 : 2
  const routesPerToken = k
  const totalRoutes = NT * k

  // which experts receive at least one token (for highlight)
  const activeExperts = new Set<number>()
  for (let t = 0; t < NT; t++) for (let r = 0; r < k; r++) activeExperts.add(ranked[t][r])

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>router · one token, its expert(s)</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Six tokens on the left routed to four expert feed-forward networks on the right. In ${mode} mode each token sends ${routesPerToken} connector${routesPerToken > 1 ? "s" : ""}, for ${totalRoutes} routes total.`}
        >
          <defs>
            <marker id="sw-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL} strokeWidth={1.5} />
            </marker>
            <marker id="sw-arrow2" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={SEL2} strokeWidth={1.5} />
            </marker>
            <filter id="sw-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={TX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>tokens</text>
          <text x={EX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>experts (FFNs)</text>

          {/* connectors, drawn behind nodes */}
          {Array.from({ length: NT }, (_, t) => {
            const x1 = TX + TW
            const y1 = ty(t) + TH / 2
            return Array.from({ length: k }, (_, r) => {
              const e = ranked[t][r]
              const x2 = EX
              const y2 = ey(e) + EH / 2
              const primary = r === 0
              return (
                <path
                  key={`${t}-${r}`}
                  d={curve(x1, y1, x2, y2)}
                  fill="none"
                  stroke={primary ? SEL : SEL2}
                  strokeWidth={primary ? 1.8 : 1.4}
                  strokeDasharray={primary ? undefined : "4 3"}
                  markerEnd={`url(#${primary ? "sw-arrow" : "sw-arrow2"})`}
                  opacity={primary ? 0.85 : 0.6}
                  className="transition-opacity duration-300"
                />
              )
            })
          })}

          {/* token nodes */}
          {Array.from({ length: NT }, (_, t) => {
            const best = ranked[t][0]
            const p = score(t, best)
            return (
              <g key={t}>
                <rect x={TX} y={ty(t)} width={TW} height={TH} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#sw-soft)" />
                <text x={TX + 12} y={ty(t) + 19} className="fill-foreground font-mono" fontSize={11} fontWeight={600}>token {t + 1}</text>
                <text x={TX + TW - 10} y={ty(t) + 19} textAnchor="end" className="font-mono" fontSize={9} fill={SEL}>p={p.toFixed(2)}</text>
              </g>
            )
          })}

          {/* expert nodes */}
          {Array.from({ length: NE }, (_, e) => {
            const active = activeExperts.has(e)
            return (
              <g key={e}>
                <rect
                  x={EX}
                  y={ey(e)}
                  width={EW}
                  height={EH}
                  rx={10}
                  fill={active ? SEL : "var(--muted)"}
                  opacity={active ? 0.16 : 0.4}
                  stroke={active ? SEL : "var(--border)"}
                  strokeWidth={1.5}
                  filter={active ? "url(#sw-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={EX + EW / 2} y={ey(e) + 22} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>FFN {e + 1}</text>
                <text x={EX + EW / 2} y={ey(e) + 37} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>{active ? "active" : "idle for these tokens"}</text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">routing</span>
            {([
              ["top1", "top-1 · Switch"],
              ["top2", "top-2 · classic MoE"],
            ] as [Mode, string][]).map(([m, label]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground",
                )}
                style={mode === m ? { background: SEL } : undefined}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            <span style={{ color: SEL }}>{routesPerToken}</span> expert{routesPerToken > 1 ? "s" : ""}/token · {totalRoutes} routes · {totalRoutes} routed copies to move
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Classic MoE keeps the two best experts per token; Switch keeps only the{" "}
          <span style={{ color: SEL }}>argmax</span>. Halving the routes halves the router math and — because experts live on
          different devices — the number of token copies shuffled across the network. Switch&apos;s bet is that with a
          load-balancing loss and a capacity buffer, one expert per token is enough. See the mechanism built up in{" "}
          <a className="underline decoration-dotted underline-offset-2" href="/articles/mixture-of-experts-from-scratch">Mixture of Experts, from scratch</a>.
        </p>
      </div>
    </figure>
  )
}
