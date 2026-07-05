"use client"

import { useState } from "react"
import { LightningIcon, TargetIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// "Multi-agent system as a model" — one OpenAI-compatible endpoint that hides a
// coordinator over a swappable pool of frontier + open agents, drawn as a scene.
// Curved connectors fan from the coordinator to the agents live in the current
// tier. Toggle the tier (Fugu vs Fugu Ultra), and click an agent to opt it out
// (the compliance lever) — the coordinator simply routes around it. Illustrative,
// not the real routing (which Sakana keeps proprietary).

type Agent = { name: string; kind: "closed" | "open"; hue: number }

const POOL: Agent[] = [
  { name: "GPT-5", kind: "closed", hue: 150 },
  { name: "Claude-4-Sonnet", kind: "closed", hue: 25 },
  { name: "Gemini-2.5-Pro", kind: "closed", hue: 255 },
  { name: "Qwen3-32B", kind: "open", hue: 295 },
  { name: "DeepSeek-R1-32B", kind: "open", hue: 200 },
  { name: "Gemma-3-27B", kind: "open", hue: 95 },
]

// base Fugu favours a lean, low-latency subset; Ultra coordinates the full pool.
const FUGU_SUBSET = new Set(["GPT-5", "Claude-4-Sonnet", "Qwen3-32B", "Gemma-3-27B"])

// scene geometry (viewBox units)
const W = 440
const H = 286
const CX = 220
const COORD_Y = 92 // coordinator centre
const COORD_H = 36
const NW = 124
const NH = 34
const COLS = [78, 220, 362]
const ROW_Y = [182, 244]
const pos = (i: number) => ({ x: COLS[i % 3], y: ROW_Y[i < 3 ? 0 : 1] })

export function FuguPool() {
  const [ultra, setUltra] = useState(false)
  const [out, setOut] = useState<Set<string>>(new Set())

  const inTier = (a: Agent) => ultra || FUGU_SUBSET.has(a.name)
  const active = (a: Agent) => inTier(a) && !out.has(a.name)
  const activeCount = POOL.filter(active).length

  const toggle = (name: string) =>
    setOut((s) => {
      const n = new Set(s)
      if (n.has(name)) n.delete(name)
      else n.add(name)
      return n
    })

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">one endpoint · a pool of agents</span>
        <div className="flex gap-1">
          {[
            { v: false, label: "fugu" },
            { v: true, label: "fugu-ultra" },
          ].map((o) => (
            <button key={o.label} type="button" onClick={() => setUltra(o.v)} aria-pressed={ultra === o.v}
              className={cn("cursor-pointer rounded-md px-2 py-1 transition-colors",
                ultra === o.v ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
          aria-label={`One endpoint routes through a coordinator to ${activeCount} live agents`}>
          <defs>
            <marker id="fp-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="fp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* endpoint */}
          <rect x={CX - 108} y={14} width={216} height={26} rx={7} fill="var(--muted)" opacity={0.45} stroke="var(--border)" strokeWidth={1.5} />
          <text x={CX} y={31} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={11}>
            POST /v1/chat · model: <tspan className="fill-foreground">{ultra ? "fugu-ultra" : "fugu"}</tspan>
          </text>
          <path d={`M ${CX} 40 C ${CX} 50, ${CX} 54, ${CX} ${COORD_Y - COORD_H / 2}`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#fp-arrow)" opacity={0.5} />

          {/* coordinator */}
          <rect x={CX - 82} y={COORD_Y - COORD_H / 2} width={164} height={COORD_H} rx={9}
            fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.5} filter="url(#fp-soft)" opacity={0.9} />
          <text x={CX} y={COORD_Y - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>coordinator</text>
          <text x={CX} y={COORD_Y + 11} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>TRINITY · Conductor</text>

          {/* row labels */}
          <text x={12} y={ROW_Y[0] + 3} className="fill-muted-foreground/70 font-mono" fontSize={8}>closed</text>
          <text x={12} y={ROW_Y[1] + 3} className="fill-muted-foreground/70 font-mono" fontSize={8}>open</text>

          {/* connectors coordinator → active agents */}
          {POOL.map((a, i) => {
            if (!active(a)) return null
            const p = pos(i)
            const sy = COORD_Y + COORD_H / 2
            const ty = p.y - NH / 2
            const my = (sy + ty) / 2
            return (
              <path key={`e-${a.name}`} d={`M ${CX} ${sy} C ${CX} ${my}, ${p.x} ${my}, ${p.x} ${ty}`}
                fill="none" stroke={`oklch(0.72 0.14 ${a.hue})`} strokeWidth={1.5} markerEnd="url(#fp-arrow)" opacity={0.55} />
            )
          })}

          {/* agent nodes */}
          {POOL.map((a, i) => {
            const p = pos(i)
            const on = active(a)
            const dimmed = !inTier(a)
            const color = `oklch(0.72 0.14 ${a.hue})`
            return (
              <g key={a.name} onClick={dimmed ? undefined : () => toggle(a.name)}
                style={{ cursor: dimmed ? "not-allowed" : "pointer" }}
                opacity={dimmed ? 0.3 : on ? 1 : 0.5}>
                <title>{dimmed ? "not in this tier" : on ? "click to opt out" : "opted out — click to re-enable"}</title>
                <rect x={p.x - NW / 2} y={p.y - NH / 2} width={NW} height={NH} rx={8}
                  fill="var(--background)" stroke={on ? color : "var(--border)"} strokeWidth={1.5}
                  strokeDasharray={!dimmed && !on ? "4 3" : undefined} filter={on ? "url(#fp-soft)" : undefined} />
                <circle cx={p.x - NW / 2 + 14} cy={p.y} r={4} fill={color} opacity={on ? 1 : 0.35} />
                <text x={p.x - NW / 2 + 26} y={p.y + 4}
                  className={on ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"} fontSize={10}
                  textDecoration={!dimmed && !on ? "line-through" : undefined}>{a.name}</text>
              </g>
            )
          })}
        </svg>

        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-[11px] text-muted-foreground">
          <span>agents live <span className="text-foreground">{activeCount}</span></span>
          <span className="flex items-center gap-1">latency{" "}
            {ultra ? <TargetIcon size={12} /> : <LightningIcon size={12} weight="fill" />}
            <span className="text-foreground">{ultra ? "higher" : "low"}</span>
          </span>
          <span className="ml-auto">billing <span className="text-foreground">single rate</span></span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {ultra
            ? "Fugu Ultra coordinates the deeper pool over more turns — built for hard, high-stakes problems where answer quality beats speed."
            : "Base Fugu favours a lean, low-latency subset for everyday tasks. Opt a model out for compliance and the coordinator simply routes around it."}
        </p>
      </div>
    </figure>
  )
}
