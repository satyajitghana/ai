"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// Monolith 1.0's self-speculative decoding, drawn as a draft -> verify -> accept pass.
// The model drafts several tokens cheaply, then verifies all of them in ONE forward pass;
// the longest correct prefix is accepted, the first miss is corrected, the rest discarded.
// Scrub the phase; flip the domain (natural language vs code) to see why code accepts a
// longer prefix. Reported: ~2.1x decode speedup on natural language, ~2.7x on code. Illustrative.

const ACCENT = "oklch(0.62 0.14 200)"

const N = 6 // drafted tokens per pass
const DOMAINS = {
  nl: { label: "natural language", accepted: 3, speedup: "~2.1x" },
  code: { label: "code", accepted: 4, speedup: "~2.7x" },
} as const
type DomainKey = keyof typeof DOMAINS

const PHASES = ["draft", "verify", "accept"] as const

const W = 760
const H = 236
const SLOT_X0 = 48
const SLOT_PITCH = 112
const SLOT_W = 96
const SLOT_Y = 110
const SLOT_H = 40
const slotX = (i: number) => SLOT_X0 + i * SLOT_PITCH
const slotCx = (i: number) => SLOT_X0 + i * SLOT_PITCH + SLOT_W / 2

const r2 = (n: number) => Math.round(n * 100) / 100
function up(x1: number, y1: number, x2: number, y2: number) {
  const my = r2((y1 + y2) / 2)
  return `M ${r2(x1)} ${r2(y1)} C ${r2(x1)} ${my}, ${r2(x2)} ${my}, ${r2(x2)} ${r2(y2)}`
}

export function SelfSpeculative() {
  const [phase, setPhase] = useState(2)
  const [domain, setDomain] = useState<DomainKey>("code")

  const acc = DOMAINS[domain].accepted
  const showAccept = phase === 2
  const showVerify = phase >= 1

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>self-speculative decoding · draft &rarr; verify &rarr; accept</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Six drafted tokens verified in one pass; at the accept phase the first ${acc} are kept and the next is corrected (${DOMAINS[domain].label} domain).`}
        >
          <defs>
            <marker id="mono-sd-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="mono-sd-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="mono-sd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* draft model node */}
          <rect x={W / 2 - 84} y={40} width={168} height={30} rx={8} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#mono-sd-soft)" />
          <text x={W / 2} y={59} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>draft · propose 6</text>

          {/* draft -> each slot */}
          {Array.from({ length: N }, (_, i) => (
            <path
              key={`fan-${i}`}
              d={up(W / 2, 70, slotCx(i), SLOT_Y)}
              fill="none"
              stroke={phase === 0 ? ACCENT : "var(--muted-foreground)"}
              strokeWidth={1.3}
              strokeOpacity={phase === 0 ? 0.6 : 0.28}
              markerEnd={phase === 0 ? "url(#mono-sd-arrow)" : "url(#mono-sd-arrow-mut)"}
            />
          ))}

          {/* drafted-token slots */}
          {Array.from({ length: N }, (_, i) => {
            const accepted = showAccept && i < acc
            const corrected = showAccept && i === acc
            const discarded = showAccept && i > acc
            let fill = "var(--muted)"
            let fillOp = 1
            let stroke = "var(--border)"
            let dash: string | undefined
            let labelColor = "fill-foreground"
            if (accepted) { fill = ACCENT; fillOp = 0.85; stroke = ACCENT; labelColor = "fill-background" }
            else if (corrected) { fill = "var(--background)"; stroke = ACCENT; dash = "4 3" }
            else if (discarded) { fillOp = 0.4; dash = "4 3" }
            return (
              <g key={i}>
                <rect
                  x={slotX(i)}
                  y={SLOT_Y}
                  width={SLOT_W}
                  height={SLOT_H}
                  rx={7}
                  fill={fill}
                  fillOpacity={fillOp}
                  stroke={stroke}
                  strokeWidth={1.5}
                  strokeDasharray={dash}
                  filter={accepted || corrected ? "url(#mono-sd-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text x={slotCx(i)} y={SLOT_Y + 19} textAnchor="middle" className={`${labelColor} font-mono`} fontSize={10.5} fontWeight={600}>
                  {corrected ? "fix" : `t${i + 1}`}
                </text>
                <text x={slotCx(i)} y={SLOT_Y + 32} textAnchor="middle" className="font-mono" fontSize={8} style={{ fill: accepted ? "var(--background)" : corrected ? ACCENT : "var(--muted-foreground)" }}>
                  {accepted ? "kept" : corrected ? "corrected" : discarded ? "dropped" : "draft"}
                </text>
              </g>
            )
          })}

          {/* verify bracket + node */}
          {showVerify && (
            <g>
              <path
                d={`M ${slotX(0)} ${SLOT_Y + SLOT_H + 8} L ${slotX(0)} 172 L ${slotX(N - 1) + SLOT_W} 172 L ${slotX(N - 1) + SLOT_W} ${SLOT_Y + SLOT_H + 8}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
                strokeOpacity={0.7}
              />
              <path d={up(W / 2, 172, W / 2, 190)} fill="none" stroke={ACCENT} strokeWidth={1.4} strokeOpacity={0.7} markerEnd="url(#mono-sd-arrow)" />
              <rect x={W / 2 - 92} y={190} width={184} height={30} rx={8} fill={ACCENT} fillOpacity={0.14} stroke={ACCENT} strokeWidth={1.5} filter="url(#mono-sd-soft)" />
              <text x={W / 2} y={209} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>verify · 1 forward pass</text>
            </g>
          )}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">domain</span>
            {(Object.keys(DOMAINS) as DomainKey[]).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setDomain(k)}
                aria-pressed={domain === k}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (domain === k ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {DOMAINS[k].label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            keeps <span style={{ color: ACCENT }}>{acc}</span> drafts + 1 fix ·{" "}
            <span className="text-foreground">{DOMAINS[domain].speedup}</span> decode speedup
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">phase (scrub) — {PHASES[phase]}</div>
          <Range min={0} max={2} value={phase} onChange={(e) => setPhase(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.62 0.14 200)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The model drafts <span className="text-foreground">6</span> tokens cheaply, then checks all of them in one
          verification pass. It keeps the longest correct prefix, <span style={{ color: ACCENT }}>corrects</span> the first
          miss, and drops the rest — so a single expensive pass emits several tokens instead of one. Code is more
          predictable than prose, so the drafts survive verification more often: Basalt reports{" "}
          <span className="text-foreground">~2.1x</span> on natural language and <span className="text-foreground">~2.7x</span>{" "}
          on code. It is exact-decoding — the verify pass guarantees the output matches the base model token for token.
        </p>
      </div>
    </figure>
  )
}
