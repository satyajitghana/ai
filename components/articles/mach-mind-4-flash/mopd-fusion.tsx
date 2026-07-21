"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// MOPD — Multi-Teacher On-Policy Distillation, drawn as a real diagram. After the base
// model is SFT'd and split into domain RL experts, MOPD fuses them into ONE student.
// The naive alternative — mix all the domain rewards into a single RL objective — makes
// the gradients collide, so a gain on one capability is offset by a regression on
// another (the paper's "see-saw degradation"). MOPD instead routes each sample to its
// own frozen domain teacher and does a token-level reverse-KL distillation on the
// student's own rollouts, so every domain is supervised independently and none decays.
// Flip the mode and scrub the training step. Capability curves are illustrative of the
// mechanism, not measured numbers.

const DOMAINS = [
  { key: "reason", label: "Reasoning", sub: "frozen RL expert", color: "oklch(0.60 0.15 255)" },
  { key: "general", label: "General", sub: "frozen RL expert", color: "oklch(0.62 0.16 305)" },
  { key: "agent", label: "Agent", sub: "frozen RL expert", color: "oklch(0.58 0.14 155)" },
] as const

const W = 760
const H = 342
const COLX = [150, 380, 610]
const TNODE_W = 186
const TNODE_H = 46
const TNODE_Y = 34
const S_W = 240
const S_H = 46
const S_CX = 380
const S_Y = 152
const MIX_CX = 380
const MIX_Y = 106
const MIX_W = 150
const MIX_H = 30
const BASE_Y = 320 // capability baseline
const BAR_MAX = 86
const BAR_W = 46

type Mode = "mopd" | "mixed"

const clamp = (x: number, lo = 0.4, hi = 0.98) => Math.min(hi, Math.max(lo, x))

// Illustrative capability curves as a function of training progress p in [0,1].
function caps(mode: Mode, p: number): number[] {
  if (mode === "mopd") {
    // all three domains climb together — no domain is starved of gradient.
    const off = [0.0, -0.015, -0.03]
    return DOMAINS.map((_, i) => clamp(0.62 + 0.34 * Math.pow(p, 0.6) + off[i]))
  }
  // mixed reward: a slowly rising mean, but the domains oscillate out of phase —
  // whenever one peaks another troughs. The weakest capability stays weak.
  const base = 0.66 + 0.13 * p
  const osc = 0.17
  return [0, 2.094, 4.189].map((ph) => clamp(base + osc * Math.sin(p * 6.2 + ph)))
}

export function MopdFusion() {
  const [mode, setMode] = useState<Mode>("mopd")
  const [step, setStep] = useState(72)
  const p = step / 100
  const c = caps(mode, p)
  const weakest = Math.min(...c)

  // curved connector between two points (smooth vertical S)
  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const my = (y1 + y2) / 2
    return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>fusing the domain experts · one student, many teachers</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Three frozen domain experts supervise one student. In ${mode} mode at training step ${step}, the weakest of the three capabilities is ${(weakest * 100).toFixed(0)} percent.`}
        >
          <defs>
            {DOMAINS.map((d) => (
              <marker key={d.key} id={`mopd-arr-${d.key}`} viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
                <path d="M0,-4L6,0L0,4" fill="none" stroke={d.color} strokeWidth={1.5} />
              </marker>
            ))}
            <marker id="mopd-arr-gray" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="mopd-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* connectors (behind nodes) */}
          {mode === "mopd"
            ? DOMAINS.map((d, i) => (
                <path
                  key={d.key}
                  d={curve(COLX[i], TNODE_Y + TNODE_H, S_CX + (i - 1) * 66, S_Y)}
                  fill="none"
                  stroke={d.color}
                  strokeWidth={1.8}
                  markerEnd={`url(#mopd-arr-${d.key})`}
                  opacity={0.85}
                />
              ))
            : (
              <>
                {DOMAINS.map((d, i) => (
                  <path
                    key={d.key}
                    d={curve(COLX[i], TNODE_Y + TNODE_H, MIX_CX + (i - 1) * 44, MIX_Y)}
                    fill="none"
                    stroke={d.color}
                    strokeWidth={1.6}
                    markerEnd={`url(#mopd-arr-${d.key})`}
                    opacity={0.6}
                  />
                ))}
                <path
                  d={curve(MIX_CX, MIX_Y + MIX_H, S_CX, S_Y)}
                  fill="none"
                  stroke="var(--muted-foreground)"
                  strokeWidth={2}
                  markerEnd="url(#mopd-arr-gray)"
                  opacity={0.8}
                />
              </>
            )}

          {/* teacher nodes */}
          {DOMAINS.map((d, i) => (
            <g key={d.key}>
              <rect x={COLX[i] - TNODE_W / 2} y={TNODE_Y} width={TNODE_W} height={TNODE_H} rx={9} fill="var(--background)" stroke={d.color} strokeWidth={1.5} filter="url(#mopd-soft)" />
              <text x={COLX[i]} y={TNODE_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>{d.label} expert</text>
              <text x={COLX[i]} y={TNODE_Y + 35} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>{d.sub}</text>
            </g>
          ))}

          {/* mixed-reward collision node */}
          {mode === "mixed" && (
            <g>
              <rect x={MIX_CX - MIX_W / 2} y={MIX_Y} width={MIX_W} height={MIX_H} rx={7} fill="var(--muted)" stroke="var(--muted-foreground)" strokeWidth={1.3} opacity={0.9} />
              <text x={MIX_CX} y={MIX_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>Σ mixed reward</text>
            </g>
          )}

          {/* student node */}
          <g>
            <rect x={S_CX - S_W / 2} y={S_Y} width={S_W} height={S_H} rx={9} fill="var(--background)" stroke="var(--foreground)" strokeWidth={1.6} filter="url(#mopd-soft)" />
            <text x={S_CX} y={S_Y + 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Student · one shared policy</text>
            <text x={S_CX} y={S_Y + 35} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
              {mode === "mopd" ? "token-level reverse-KL, per routed teacher" : "one gradient from all rewards at once"}
            </text>
          </g>

          {/* capability bars */}
          {DOMAINS.map((d, i) => {
            const h = c[i] * BAR_MAX
            const isWeak = c[i] === weakest
            return (
              <g key={d.key}>
                <rect x={COLX[i] - BAR_W / 2} y={BASE_Y - BAR_MAX} width={BAR_W} height={BAR_MAX} rx={5} fill="var(--muted)" opacity={0.28} />
                <rect x={COLX[i] - BAR_W / 2} y={BASE_Y - h} width={BAR_W} height={h} rx={5} fill={d.color} opacity={mode === "mixed" && isWeak ? 0.95 : 0.82} className="transition-all duration-300" stroke={mode === "mixed" && isWeak ? d.color : "transparent"} strokeWidth={1.5} />
                <text x={COLX[i]} y={BASE_Y - h - 5} textAnchor="middle" className="fill-foreground font-mono" fontSize={10} fontWeight={600}>{(c[i] * 100).toFixed(0)}</text>
                <text x={COLX[i]} y={BASE_Y + 14} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>{d.label}</text>
              </g>
            )
          })}
          <text x={S_CX} y={BASE_Y + 14} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>capability after fusion →</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">fusion</span>
            {([["mopd", "MOPD (routed)"], ["mixed", "mixed reward"]] as [Mode, string][]).map(([m, lbl]) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  mode === m ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {lbl}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            weakest capability{" "}
            <span className={cn(mode === "mixed" ? "text-foreground" : "")} style={mode === "mopd" ? { color: DOMAINS[0].color } : undefined}>
              {(weakest * 100).toFixed(0)}
            </span>
            {" "}/ 100
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">training progress (drag)</div>
          <Range min={0} max={100} value={step} onChange={(e) => setStep(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.60 0.15 255)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {mode === "mopd" ? (
            <>
              Each sample is <span className="text-foreground">routed to one frozen teacher</span> and the student is pulled toward
              it with a token-level reverse-KL on its <span className="text-foreground">own</span> rollouts. Every domain gets its
              own clean gradient, so all three capabilities climb together — the weakest one never gets starved.
            </>
          ) : (
            <>
              Summing every domain's reward into <span className="text-foreground">one objective</span> makes the gradients collide.
              Watch the bars: as training proceeds, a gain on one capability shows up as a{" "}
              <span className="text-foreground">regression on another</span> — the paper's <em>see-saw degradation</em>. The
              weakest capability stays stuck.
            </>
          )}
        </p>
      </div>
    </figure>
  )
}
