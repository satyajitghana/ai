"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The mechanism, drawn: the probe does not cost a second forward pass. It reads the SAME
// activations the model already computed for its own next-token prediction, off a branch,
// and produces one scalar. That scalar is compared against two thresholds (Kramár et al.
// 2601.11516, §3.3.2, Eq. 2) — below t0: clear; above t1: block; in between: defer to the
// slow, expensive judge. Toggle a request to see which branch it takes.

const BLUE = "oklch(0.60 0.15 255)"
const GREEN = "oklch(0.55 0.16 155)"
const AMBER = "oklch(0.68 0.13 85)"
const RED = "oklch(0.58 0.19 25)"
const MUTED = "var(--muted-foreground)"

type Kind = "benign" | "borderline" | "malicious"
const SCORES: Record<Kind, number> = { benign: 0.12, borderline: 0.55, malicious: 0.93 }
const OUTCOME: Record<Kind, "clear" | "escalate" | "block"> = {
  benign: "clear",
  borderline: "escalate",
  malicious: "block",
}
const OUTCOME_COLOR = { clear: GREEN, escalate: AMBER, block: RED } as const

const W = 760
const H = 300

function curve(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function CascadeFlow() {
  const [kind, setKind] = useState<Kind>("borderline")
  const outcome = OUTCOME[kind]
  const score = SCORES[kind]

  const active = (o: "clear" | "escalate" | "block") => o === outcome

  // node geometry
  const req = { x: 16, y: 130, w: 92, h: 40 }
  const fwd = { x: 148, y: 96, w: 210, h: 100 }
  const probe = { x: 178, y: 240, w: 150, h: 48 }
  const scoreNode = { x: 392, y: 240, w: 78, h: 48 }
  const outcomes = {
    clear: { x: 552, y: 28, w: 190, h: 50, label: "clear", sub: `s ≤ t₀` },
    escalate: { x: 552, y: 125, w: 190, h: 50, label: "escalate to judge", sub: `t₀ < s < t₁` },
    block: { x: 552, y: 222, w: 190, h: 50, label: "block", sub: `s ≥ t₁` },
  } as const

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>where the probe sits in the forward pass</span>
        <span className="text-muted-foreground/50">two-threshold cascade</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`A ${kind} request scores ${score.toFixed(2)} and is ${outcome === "clear" ? "cleared" : outcome === "block" ? "blocked" : "escalated to the judge"}`}>
          <defs>
            <filter id="apm-flow-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            {(["clear", "escalate", "block"] as const).map((o) => (
              <marker key={o} id={`apm-arrow-${o}`} viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={active(o) ? OUTCOME_COLOR[o] : "var(--border)"} strokeWidth={1.5} />
              </marker>
            ))}
            <marker id="apm-arrow-neutral" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={BLUE} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* connectors first, behind nodes */}
          <path d={curve(req.x + req.w, req.y + req.h / 2, fwd.x, fwd.y + fwd.h / 2)} fill="none" stroke={BLUE} strokeWidth={1.5} markerEnd="url(#apm-arrow-neutral)" opacity={0.8} />
          <path d={curve(fwd.x + fwd.w * 0.35, fwd.y + fwd.h, probe.x + probe.w / 2, probe.y)} fill="none" stroke={BLUE} strokeWidth={1.5} markerEnd="url(#apm-arrow-neutral)" opacity={0.8} />
          <path d={curve(probe.x + probe.w, probe.y + probe.h / 2, scoreNode.x, scoreNode.y + scoreNode.h / 2)} fill="none" stroke={BLUE} strokeWidth={1.5} markerEnd="url(#apm-arrow-neutral)" opacity={0.8} />

          {(["clear", "escalate", "block"] as const).map((o) => {
            const t = outcomes[o]
            const on = active(o)
            return (
              <path
                key={o}
                d={curve(scoreNode.x + scoreNode.w, scoreNode.y + scoreNode.h / 2, t.x, t.y + t.h / 2)}
                fill="none"
                stroke={on ? OUTCOME_COLOR[o] : "var(--border)"}
                strokeWidth={on ? 2 : 1.5}
                markerEnd={`url(#apm-arrow-${o})`}
                opacity={on ? 0.95 : 0.45}
                className="transition-all duration-300"
              />
            )
          })}

          {/* request node */}
          <g>
            <rect x={req.x} y={req.y} width={req.w} height={req.h} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#apm-flow-soft)" />
            <text x={req.x + req.w / 2} y={req.y + req.h / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>request</text>
          </g>

          {/* forward pass node */}
          <g>
            <rect x={fwd.x} y={fwd.y} width={fwd.w} height={fwd.h} rx={10} fill="var(--background)" stroke={BLUE} strokeWidth={1.5} filter="url(#apm-flow-soft)" />
            <text x={fwd.x + fwd.w / 2} y={fwd.y + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>forward pass</text>
            <text x={fwd.x + fwd.w / 2} y={fwd.y + 44} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>one pass, N params</text>
            <text x={fwd.x + fwd.w / 2} y={fwd.y + 68} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>layer L residual stream</text>
            <text x={fwd.x + fwd.w / 2} y={fwd.y + 84} textAnchor="middle" fill={BLUE} className="font-mono" fontSize={9}>↓ tapped, not recomputed</text>
          </g>

          {/* probe node */}
          <g>
            <rect x={probe.x} y={probe.y} width={probe.w} height={probe.h} rx={8} fill="var(--background)" stroke={BLUE} strokeWidth={1.5} filter="url(#apm-flow-soft)" />
            <text x={probe.x + probe.w / 2} y={probe.y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>probe</text>
            <text x={probe.x + probe.w / 2} y={probe.y + 35} textAnchor="middle" fill={BLUE} className="font-mono" fontSize={10}>σ(w·h + b)</text>
          </g>

          {/* score node */}
          <g>
            <rect x={scoreNode.x} y={scoreNode.y} width={scoreNode.w} height={scoreNode.h} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#apm-flow-soft)" />
            <text x={scoreNode.x + scoreNode.w / 2} y={scoreNode.y + 20} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>score</text>
            <text x={scoreNode.x + scoreNode.w / 2} y={scoreNode.y + 36} textAnchor="middle" className="fill-foreground font-mono" fontSize={13} fontWeight={600}>{score.toFixed(2)}</text>
          </g>

          {/* outcome nodes */}
          {(["clear", "escalate", "block"] as const).map((o) => {
            const t = outcomes[o]
            const on = active(o)
            return (
              <g key={o}>
                <rect
                  x={t.x} y={t.y} width={t.w} height={t.h} rx={9}
                  fill={on ? OUTCOME_COLOR[o] : "var(--background)"}
                  opacity={on ? 0.14 : 1}
                  stroke={on ? OUTCOME_COLOR[o] : "var(--border)"}
                  strokeWidth={on ? 2 : 1.5}
                  filter={on ? "url(#apm-flow-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={t.x + t.w / 2} y={t.y + 21} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} fill={on ? OUTCOME_COLOR[o] : "var(--foreground)"}>{t.label}</text>
                <text x={t.x + t.w / 2} y={t.y + 37} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>{t.sub}</text>
              </g>
            )
          })}
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">try a request</span>
          {(["benign", "borderline", "malicious"] as Kind[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              aria-pressed={kind === k}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[10px] capitalize transition-colors",
                kind === k ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              style={kind === k ? { color: OUTCOME_COLOR[OUTCOME[k]] } : undefined}
            >
              {k}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px]" style={{ color: MUTED }}>
            t0 = 0.30 · t1 = 0.70
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The branch into the probe is not a second model call — it reads a vector the forward pass already produced.
          Everything expensive happens only in the <span style={{ color: AMBER }}>escalate</span> band, and only for
          requests that land there.
        </p>
      </div>
    </figure>
  )
}
