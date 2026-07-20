"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// KAT-Coder-V2.5 — asymmetric actor–critic PPO with hindsight-augmented value
// estimation. In a long-horizon agentic trajectory the reward is sparse (it lands
// only at the end, when tests pass). The ACTOR sees only the normal harness state
// s_t, so it stays identical between training and deployment. The CRITIC is given a
// privileged hindsight context c_t — final reward, test outcomes, coverage, patch
// diffs, and later turns — which the actor never sees. That extra information sharpens
// the value estimate V(s_t, c_t), shrinking the variance of the advantage that trains
// the actor. Scrub the current turn; toggle hindsight to watch the estimate tighten.
// Curved arrows carry future information *backward in time* into the critic only.
// Illustrative: value/variance curves are stylized, not measured.

const ACT = "oklch(0.58 0.14 250)" // actor / present
const HIND = "oklch(0.58 0.13 150)" // hindsight / privileged future
const NT = 12 // turns shown

// stylized value + uncertainty over the trajectory (deterministic, bounded)
const vAt = (t: number) => {
  const x = t / (NT - 1)
  return Math.min(0.98, Math.max(0.05, 0.18 + 0.66 * x + 0.05 * Math.sin(t * 1.3)))
}
const uOff = (t: number) => 0.07 + 0.32 * (1 - t / (NT - 1)) // no hindsight: guess from present
const uOn = 0.045 // hindsight: outcome is (partly) observed

// scene geometry (viewBox units)
const W = 760
const H = 348
const MX = 42
const STRIP_Y = 40
const CW = (W - 2 * MX) / NT // turn cell width

export function HindsightCritic() {
  const [t, setT] = useState(5)
  const [hind, setHind] = useState(true)

  const u = hind ? uOn : uOff(t)
  const v = vAt(t)
  const cellX = (i: number) => MX + i * CW + CW / 2

  // value track (bottom): maps value 0..1 to x
  const trackX0 = MX + 150
  const trackX1 = W - MX
  const vx = (val: number) => trackX0 + val * (trackX1 - trackX0)
  const trackY = 300

  // hindsight sources: future turns + final reward feed the critic's hindsight box
  const critX = MX + 150
  const critY = 220
  const hindBoxX = critX + 210
  const hindBoxY = critY - 12

  const backCurve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1 - 34}, ${mx} ${y2 - 34}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>asymmetric PPO · the critic peeks at the future, the actor never does</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A ${NT}-turn agentic trajectory. Current turn ${t}. Hindsight is ${hind ? "on" : "off"}; the critic's value estimate uncertainty is ${(u * 2 * 100).toFixed(0)} percent wide.`}
        >
          <defs>
            <marker id="hc-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACT} strokeWidth={1.5} />
            </marker>
            <marker id="hc-arr-h" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={HIND} strokeWidth={1.5} />
            </marker>
            <filter id="hc-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* trajectory strip */}
          <text x={MX} y={22} className="fill-muted-foreground font-mono" fontSize={11}>
            trajectory · one agentic turn per cell →
          </text>
          {Array.from({ length: NT }, (_, i) => {
            const isCur = i === t
            const isFuture = i > t
            const isReward = i === NT - 1
            return (
              <g key={i}>
                <rect
                  x={MX + i * CW + 3}
                  y={STRIP_Y}
                  width={CW - 6}
                  height={26}
                  rx={5}
                  fill={isReward ? HIND : isCur ? ACT : "var(--muted)"}
                  opacity={isReward ? 0.85 : isCur ? 0.9 : isFuture ? 0.5 : 0.28}
                  stroke={isCur ? ACT : "transparent"}
                  strokeWidth={1.5}
                  filter={isCur ? "url(#hc-soft)" : undefined}
                  className="transition-all duration-300"
                />
                <text
                  x={cellX(i)}
                  y={STRIP_Y + 17}
                  textAnchor="middle"
                  className={cn("font-mono", isReward || isCur ? "fill-background" : "fill-muted-foreground")}
                  fontSize={isReward ? 8.5 : 9}
                >
                  {isReward ? "R" : i}
                </text>
              </g>
            )
          })}

          {/* backward hindsight arrows: from future turns + reward into the hindsight box */}
          {hind &&
            [t + 2, t + 4, NT - 1].filter((i) => i > t && i < NT).map((i, k) => (
              <path
                key={k}
                d={backCurve(cellX(i), STRIP_Y + 26, hindBoxX + 96, hindBoxY)}
                fill="none"
                stroke={HIND}
                strokeWidth={1.5}
                strokeDasharray="3 3"
                markerEnd="url(#hc-arr-h)"
                opacity={0.75}
              />
            ))}

          {/* shared state node */}
          <g>
            <rect x={MX} y={critY - 30} width={110} height={54} rx={8} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#hc-soft)" />
            <text x={MX + 55} y={critY - 10} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>state sₜ</text>
            <text x={MX + 55} y={critY + 6} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>visible harness</text>
            <text x={MX + 55} y={critY + 18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>context</text>
          </g>

          {/* actor lane (top) */}
          <path d={`M ${MX + 110} ${critY - 12} C ${MX + 130} ${140}, ${critX + 40} ${140}, ${critX + 90} ${140}`} fill="none" stroke={ACT} strokeWidth={1.5} markerEnd="url(#hc-arr)" opacity={0.85} />
          <g>
            <rect x={critX + 90} y={122} width={190} height={40} rx={8} fill="var(--background)" stroke={ACT} strokeWidth={1.5} filter="url(#hc-soft)" />
            <text x={critX + 185} y={140} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>actor π_θ(aₜ | sₜ)</text>
            <text x={critX + 185} y={154} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8.5}>present only · train = deploy</text>
          </g>

          {/* critic lane (bottom) */}
          <path d={`M ${MX + 110} ${critY + 6} C ${MX + 130} ${critY + 6}, ${critX + 20} ${critY + 6}, ${critX + 40} ${critY + 6}`} fill="none" stroke={ACT} strokeWidth={1.5} markerEnd="url(#hc-arr)" opacity={0.7} />
          {hind && (
            <path d={`M ${hindBoxX} ${critY + 6} C ${hindBoxX - 18} ${critY + 6}, ${critX + 138} ${critY + 6}, ${critX + 120} ${critY + 6}`} fill="none" stroke={HIND} strokeWidth={1.5} markerEnd="url(#hc-arr-h)" opacity={0.8} />
          )}
          <g>
            <rect x={critX + 40} y={critY - 14} width={80} height={40} rx={8} fill="var(--background)" stroke={hind ? HIND : "var(--border)"} strokeWidth={1.5} filter="url(#hc-soft)" />
            <text x={critX + 80} y={critY + 3} textAnchor="middle" className="fill-foreground font-mono" fontSize={10.5} fontWeight={600}>critic</text>
            <text x={critX + 80} y={critY + 17} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>V(sₜ{hind ? ", cₜ" : ""})</text>
          </g>

          {/* hindsight context box */}
          <g opacity={hind ? 1 : 0.28} className="transition-opacity duration-300">
            <rect x={hindBoxX} y={hindBoxY - 12} width={96} height={48} rx={8} fill={hind ? "color-mix(in oklab, oklch(0.58 0.13 150) 12%, var(--background))" : "var(--muted)"} stroke={hind ? HIND : "var(--border)"} strokeWidth={1.5} filter="url(#hc-soft)" />
            <text x={hindBoxX + 48} y={hindBoxY + 5} textAnchor="middle" className="fill-foreground font-mono" fontSize={9.5} fontWeight={600}>hindsight cₜ</text>
            <text x={hindBoxX + 48} y={hindBoxY + 18} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>reward · tests</text>
            <text x={hindBoxX + 48} y={hindBoxY + 28} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={7.5}>coverage · later turns</text>
          </g>

          {/* value + uncertainty readout */}
          <text x={MX} y={trackY - 22} className="fill-muted-foreground font-mono" fontSize={10}>critic value estimate V &amp; its uncertainty band</text>
          <line x1={trackX0} y1={trackY} x2={trackX1} y2={trackY} stroke="var(--border)" strokeWidth={1.5} />
          {[0, 0.5, 1].map((g) => (
            <g key={g}>
              <line x1={vx(g)} y1={trackY - 5} x2={vx(g)} y2={trackY + 5} stroke="var(--border)" strokeWidth={1} />
              <text x={vx(g)} y={trackY + 18} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>{g}</text>
            </g>
          ))}
          {/* band */}
          <rect x={vx(Math.max(0, v - u))} y={trackY - 12} width={vx(Math.min(1, v + u)) - vx(Math.max(0, v - u))} height={24} rx={4} fill={hind ? HIND : ACT} opacity={0.16} className="transition-all duration-300" />
          <line x1={vx(v)} y1={trackY - 14} x2={vx(v)} y2={trackY + 14} stroke={hind ? HIND : ACT} strokeWidth={2} className="transition-all duration-300" />
          <text x={vx(v)} y={trackY - 20} textAnchor="middle" className="fill-foreground font-mono" fontSize={9} fontWeight={600}>V≈{v.toFixed(2)}</text>
          <text x={trackX1} y={trackY - 20} textAnchor="end" className={cn("font-mono")} fontSize={9} fill={hind ? HIND : ACT}>±{u.toFixed(2)}</text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">critic hindsight</span>
            {[true, false].map((h) => (
              <button
                key={String(h)}
                type="button"
                onClick={() => setHind(h)}
                aria-pressed={hind === h}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  hind === h ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {h ? "on (asymmetric)" : "off (symmetric)"}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            advantage variance{" "}
            <span style={{ color: hind ? HIND : ACT }}>{hind ? "low" : "high"}</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">current turn t (drag)</div>
          <Range
            min={0}
            max={NT - 2}
            value={t}
            onChange={(e) => setT(Number(e.target.value))}
            className="w-full cursor-pointer " accent="oklch(0.58 0.14 250)" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The <span style={{ color: ACT }}>actor</span> only ever reads the visible state <span className="font-mono">sₜ</span>,
          so it behaves identically in training and deployment. The <span style={{ color: HIND }}>critic</span> is fed a
          privileged <span style={{ color: HIND }}>hindsight context cₜ</span> — the eventual reward, test outcomes, coverage,
          patch diffs, and later turns — which flows <em>backward in time</em> (dashed arrows) and never touches the actor.
          Turn hindsight off and the value estimate has to be guessed from the present: its uncertainty band balloons early in
          the trajectory, far from the sparse end-of-episode reward. That extra variance is exactly what destabilizes
          long-horizon credit assignment.
        </p>
      </div>
    </figure>
  )
}
