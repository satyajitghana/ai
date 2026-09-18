"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The flagship diagram for this article: which state lives in DAO (the
// "computable world engine") versus what JING (the generative renderer) ever
// sees. Drawn as one directed loop, in XGEN's own labels from the product
// page's <div class="chapter-path"> — GLOBAL STATE → RULE VALIDATION → STATE
// UPDATE → OBSERVER FILTER — with the crossing into JING drawn as a real
// boundary, not a soft gradient: DAO is dashed (described, no public code as
// of writing), JING is solid (public weights + inference code). Click a node
// for what it actually does, per the site's own copy plus what the released
// code confirms or doesn't.

const DAO = "oklch(0.55 0.07 250)" // slate-blue — symbolic / computable
const JING_C = "oklch(0.70 0.16 45)" // warm amber — generative / perceptual

type Node = {
  key: string
  label: string
  side: "dao" | "jing"
  detail: string
  tag?: string
}

const NODES: Node[] = [
  {
    key: "global",
    label: "GLOBAL STATE",
    side: "dao",
    detail:
      "The single ground truth for the whole world — every position, object, and character DAO is tracking. It persists whether or not any observer is currently looking at it, which is the thing most video world models can't claim.",
  },
  {
    key: "rule",
    label: "RULE VALIDATION",
    side: "dao",
    detail:
      "Checks a proposed action against DAO's rules before it's allowed to change anything. This is an authoritative server rejecting an illegal move — not a renderer deciding what merely looks plausible.",
  },
  {
    key: "update",
    label: "STATE UPDATE",
    side: "dao",
    detail:
      "Commits the action's consequences into the global state. In the server/client framing this is the physics tick: what actually happened, independent of any one observer's video feed.",
  },
  {
    key: "filter",
    label: "OBSERVER FILTER",
    side: "dao",
    detail:
      "Crops the freshly updated global state down to what one observer — human or agent — can currently perceive, then packages it as a JING PROMPT (XGEN's own term for the handoff). This is exactly the area-of-interest filter an authoritative multiplayer server runs before it sends a client its next update.",
  },
  {
    key: "jing",
    label: "JING",
    side: "jing",
    tag: "4-step diffusion",
    detail:
      "Takes only the filtered slice — the action, reference images, and observation history — and renders first-person video and audio for this observer alone. JING never sees the global state, only whatever DAO decided this observer gets to see.",
  },
]

export function StateSplit() {
  const [k, setK] = useState("filter")
  const active = NODES.find((n) => n.key === k) ?? NODES[0]

  const W = 780
  const H = 400
  const ROW0 = 70
  const PITCH = 62
  const NODE_W = 220
  const NODE_H = 40

  const daoX = 30
  const daoW = 440
  const jingX = 528
  const jingW = 222
  const nodeCx = daoX + daoW / 2
  const jingCx = jingX + jingW / 2
  const jingY = ROW0 + 3 * PITCH // level with OBSERVER FILTER

  const rowY = (i: number) => ROW0 + i * PITCH
  const daoNodes = NODES.filter((n) => n.side === "dao")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-1 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>what DAO holds vs. what JING renders</span>
        <span className="text-muted-foreground/50">click a stage</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A loop: DAO's Global State, Rule Validation, State Update, and Observer Filter stages feed a boundary crossing into JING, which renders video and audio for one observer; that observer's next action returns to Global State. DAO is drawn dashed (no public code); JING is drawn solid (public weights and code)."
        >
          <defs>
            <marker id="ss-arr-dao" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={DAO} strokeWidth={1.5} />
            </marker>
            <marker id="ss-arr-jing" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="6" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={JING_C} strokeWidth={1.5} />
            </marker>
            <filter id="ss-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.18" />
            </filter>
          </defs>

          {/* region backgrounds */}
          <rect
            x={daoX} y={24} width={daoW} height={H - 48} rx={14}
            fill="none" stroke={DAO} strokeWidth={1.4} strokeDasharray="5 4" opacity={0.55}
          />
          <text x={daoX + 14} y={16} className="font-mono" fontSize={11} fill={DAO} fontWeight={600}>
            DAO · 道 — computable world engine
          </text>
          <text x={daoX + 14} y={H - 16} className="font-mono" fontSize={9.5} fill={DAO} opacity={0.8}>
            described on xgenlabs.ai — no public code, weights, or API
          </text>

          <rect
            x={jingX} y={24} width={jingW} height={H - 48} rx={14}
            fill={JING_C} opacity={0.06} stroke={JING_C} strokeWidth={1.6}
          />
          <text x={jingX + 14} y={16} className="font-mono" fontSize={11} fill={JING_C} fontWeight={600}>
            JING · 镜
          </text>
          <text x={jingX + 14} y={H - 16} className="font-mono" fontSize={9.5} fill={JING_C} opacity={0.85}>
            public weights + inference code
          </text>

          {/* DAO cycle arrows: global -> rule -> update -> filter */}
          {[0, 1, 2].map((i) => (
            <line
              key={`arr${i}`}
              x1={nodeCx} y1={rowY(i) + NODE_H}
              x2={nodeCx} y2={rowY(i + 1)}
              stroke={DAO} strokeWidth={1.5} opacity={0.75} markerEnd="url(#ss-arr-dao)"
            />
          ))}

          {/* crossing arrow: filter -> jing */}
          <line
            x1={nodeCx + NODE_W / 2} y1={jingY + NODE_H / 2}
            x2={jingCx - 60} y2={jingY + NODE_H / 2}
            stroke={JING_C} strokeWidth={1.6} opacity={0.9} markerEnd="url(#ss-arr-jing)"
          />
          <text
            x={(nodeCx + NODE_W / 2 + jingCx - 60) / 2} y={jingY + NODE_H / 2 - 8}
            textAnchor="middle" className="font-mono" fontSize={9} fill="var(--muted-foreground)"
          >
            → JING PROMPT →
          </text>

          {/* return arrow: jing -> global (the observer's action re-enters the world) */}
          <path
            d={`M ${jingCx} ${jingY + NODE_H} C ${jingCx} ${H - 34}, ${nodeCx} ${H - 34}, ${nodeCx - 40} ${rowY(0) + NODE_H / 2}`}
            fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} strokeDasharray="4 3" opacity={0.55}
            markerEnd="url(#ss-arr-dao)"
          />
          <text x={nodeCx - 150} y={H - 40} className="font-mono" fontSize={9} fill="var(--muted-foreground)">
            action → re-enters the world
          </text>

          {/* DAO nodes */}
          {daoNodes.map((n, i) => {
            const on = n.key === k
            return (
              <g key={n.key} onClick={() => setK(n.key)} className="cursor-pointer">
                <rect
                  x={nodeCx - NODE_W / 2} y={rowY(i)} width={NODE_W} height={NODE_H} rx={9}
                  fill={on ? DAO : "var(--background)"} opacity={on ? 0.92 : 1}
                  stroke={DAO} strokeWidth={on ? 1.6 : 1.2} strokeDasharray={on ? undefined : "4 3"}
                  filter={on ? "url(#ss-soft)" : undefined}
                  className="transition-all duration-200"
                />
                <text
                  x={nodeCx} y={rowY(i) + NODE_H / 2 + 4} textAnchor="middle"
                  className="pointer-events-none font-mono" fontSize={11.5}
                  fill={on ? "var(--background)" : "var(--foreground)"}
                >
                  {n.label}
                </text>
              </g>
            )
          })}

          {/* JING node */}
          <g onClick={() => setK("jing")} className="cursor-pointer">
            <rect
              x={jingCx - NODE_W / 2 + 20} y={jingY} width={NODE_W - 40} height={NODE_H} rx={9}
              fill={k === "jing" ? JING_C : "var(--background)"} opacity={k === "jing" ? 0.95 : 1}
              stroke={JING_C} strokeWidth={k === "jing" ? 1.8 : 1.3}
              filter={k === "jing" ? "url(#ss-soft)" : undefined}
              className="transition-all duration-200"
            />
            <text
              x={jingCx} y={jingY + NODE_H / 2 + 4} textAnchor="middle"
              className="pointer-events-none font-mono" fontSize={12}
              fill={k === "jing" ? "var(--background)" : "var(--foreground)"}
              fontWeight={600}
            >
              JING
            </text>
          </g>
        </svg>

        {/* stage selector, for touch/keyboard */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {NODES.map((n) => (
            <button
              key={n.key}
              type="button"
              onClick={() => setK(n.key)}
              aria-pressed={active.key === n.key}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                active.key === n.key
                  ? "border-foreground/40 text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {n.label}
            </button>
          ))}
        </div>

        {/* detail panel */}
        <div className="mt-3 rounded-lg border bg-muted/20 p-3">
          <div className="mb-1 flex items-center gap-2 font-mono text-[10px] tracking-wide uppercase" style={{ color: active.side === "dao" ? DAO : JING_C }}>
            <span>{active.side === "dao" ? "DAO" : "JING"}</span>
            {active.tag ? <span className="text-muted-foreground">· {active.tag}</span> : null}
          </div>
          <p className="text-sm leading-6 text-muted-foreground">{active.detail}</p>
        </div>
      </div>
    </figure>
  )
}
