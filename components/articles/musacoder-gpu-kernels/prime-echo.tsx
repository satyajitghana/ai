"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// PrimeEcho: first-turn-anchored multi-turn reward, drawn as a rollout. A single sample is
// a K-turn trajectory — the model writes a kernel, MooreEval returns a score s_k and error
// feedback, the model fixes it, repeat. The trajectory reward is
//   R = α·s_1 + (1−α)·max_k s_k + b_early
// Slide α: at α=1 the reward is anchored to the FIRST turn (zero-shot quality, since that
// is what actually ships), at α=0 it rewards the best-of-turns (which invites the model to
// deliberately flub turn 1 and "fix" it later — reward hacking). b_early adds a small bonus
// for getting it right early. Deterministic scenarios; no randomness.

const ACC = "oklch(0.62 0.16 250)"
const AMBER = "oklch(0.72 0.16 60)"

const B1 = 0.15 // bonus: turn-1 success
const B2 = 0.08 // bonus: turn-1 fail, turn-2 success

// three deterministic example trajectories (per-turn scalar score s_k, from eq (2))
const SCENARIOS: { id: string; label: string; s: number[] }[] = [
  { id: "first", label: "correct on turn 1", s: [1.4, 1.4, 1.6, 1.8] },
  { id: "second", label: "fixed on turn 2", s: [-1, 1.2, 1.5, 1.6] },
  { id: "late", label: "fixed on turn 4", s: [-1, -1, -0.2, 1.3] },
]

const W = 760
const H = 250
const MX = 56
const TW = 120 // turn node width
const TH = 46
const NY = 52 // turn row y
const K = 4
const tx = (k: number) => MX + k * ((W - 2 * MX - TW) / (K - 1))

export function PrimeEcho() {
  const [alpha, setAlpha] = useState(0.75)
  const [sc, setSc] = useState(SCENARIOS[1])

  const s = sc.s
  const s1 = s[0]
  const best = Math.max(...s)
  const t1ok = s[0] >= 1
  const t2ok = !t1ok && s[1] >= 1
  const bEarly = (t1ok ? B1 : 0) + (t2ok ? B2 : 0)
  const R = alpha * s1 + (1 - alpha) * best + bEarly

  // map score to bar height within a node (score range -1..2)
  const barY = (val: number) => {
    const t = (val + 1) / 3 // 0..1
    return TH - 6 - t * (TH - 12)
  }

  const curve = (x1: number, y1: number, x2: number, y2: number) => {
    const mx = (x1 + x2) / 2
    return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>PrimeEcho · one multi-turn trajectory</span>
        <span className="text-muted-foreground/50">eq. (9), illustrative scores</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Trajectory ${sc.label}, at alpha ${alpha.toFixed(2)} the reward is ${R.toFixed(2)}`}>
          <defs>
            <marker id="pe-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="pe-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* feedback connectors between turns */}
          {Array.from({ length: K - 1 }, (_, k) => (
            <g key={k}>
              <path d={curve(tx(k) + TW, NY + TH / 2, tx(k + 1), NY + TH / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#pe-arrow)" opacity={0.5} />
              <text x={(tx(k) + TW + tx(k + 1)) / 2} y={NY - 6} textAnchor="middle" className="fill-muted-foreground/60 font-mono" fontSize={8}>feedback</text>
            </g>
          ))}

          {/* turn nodes */}
          {s.map((val, k) => {
            const ok = val >= 1
            const isBest = val === best
            const c = ok ? ACC : "var(--muted-foreground)"
            return (
              <g key={k}>
                <rect x={tx(k)} y={NY} width={TW} height={TH} rx={8} fill="var(--background)" stroke={k === 0 ? AMBER : ok ? ACC : "var(--border)"} strokeWidth={k === 0 ? 2 : 1.5} filter="url(#pe-soft)" />
                <text x={tx(k) + 10} y={NY + 16} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>turn {k + 1}{k === 0 ? " ·ships" : ""}</text>
                {/* score bar */}
                <rect x={tx(k) + 10} y={barY(Math.max(val, -1)) + NY} width={TW - 52} height={4} rx={2} fill={c} opacity={0.85} className="transition-all duration-300" />
                <text x={tx(k) + TW - 10} y={NY + TH - 9} textAnchor="end" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: c }}>{val.toFixed(1)}</text>
                {isBest && <text x={tx(k) + TW - 10} y={NY + 16} textAnchor="end" className="font-mono" fontSize={8} style={{ fill: ACC }}>max</text>}
              </g>
            )
          })}

          {/* reward assembly bar */}
          <text x={MX} y={168} className="fill-muted-foreground font-mono" fontSize={11}>trajectory reward R = α·s₁ + (1−α)·max s_k + b_early</text>
          {/* number line -1..2 */}
          {(() => {
            const RX = MX, RR = W - MX, RY = 196
            const rmin = -1, rmax = 2
            const rx = (v: number) => RX + ((v - rmin) / (rmax - rmin)) * (RR - RX)
            return (
              <g>
                <line x1={RX} y1={RY} x2={RR} y2={RY} stroke="var(--border)" strokeWidth={1.5} />
                {[-1, 0, 1, 2].map((t) => (
                  <g key={t}>
                    <line x1={rx(t)} y1={RY - 4} x2={rx(t)} y2={RY + 4} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
                    <text x={rx(t)} y={RY + 17} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>{t}</text>
                  </g>
                ))}
                <line x1={rx(0)} y1={RY - 16} x2={rx(0)} y2={RY + 16} stroke="var(--muted-foreground)" strokeDasharray="3 3" strokeWidth={1} opacity={0.5} />
                {/* ghosts for s1 and best */}
                <circle cx={rx(s1)} cy={RY} r={4} fill={AMBER} opacity={0.45} />
                <text x={rx(s1)} y={RY - 20} textAnchor="middle" className="font-mono" fontSize={8} style={{ fill: AMBER }} opacity={0.8}>s₁</text>
                <circle cx={rx(best)} cy={RY} r={4} fill={ACC} opacity={0.45} />
                <text x={rx(best)} y={RY - 20} textAnchor="middle" className="font-mono" fontSize={8} style={{ fill: ACC }} opacity={0.8}>max</text>
                {/* R marker */}
                <g className="transition-all duration-300" style={{ transform: `translateX(${rx(R) - rx(0)}px)` }}>
                  <circle cx={rx(0)} cy={RY} r={7} fill={R > 0 ? ACC : "oklch(0.58 0.17 25)"} filter="url(#pe-soft)" />
                  <rect x={rx(0) - 30} y={RY - 40} width={60} height={20} rx={6} fill="var(--background)" stroke={R > 0 ? ACC : "oklch(0.58 0.17 25)"} strokeWidth={1.5} filter="url(#pe-soft)" />
                  <text x={rx(0)} y={RY - 26} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} style={{ fill: R > 0 ? ACC : "oklch(0.58 0.17 25)" }}>R={R.toFixed(2)}</text>
                </g>
              </g>
            )
          })()}
        </svg>

        {/* scenario selector */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">trajectory</span>
          {SCENARIOS.map((x) => (
            <button key={x.id} type="button" onClick={() => setSc(x)} aria-pressed={sc.id === x.id}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", sc.id === x.id ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x.label}
            </button>
          ))}
        </div>

        <div className="mt-3">
          <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
            <span>anchor weight α = {alpha.toFixed(2)}</span>
            <span>{alpha > 0.5 ? "first-turn-anchored (PrimeEcho)" : "best-of-turns (hackable)"}</span>
          </div>
          <input type="range" min={0} max={1} step={0.05} value={alpha} onChange={(e) => setAlpha(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.16_250)]" />
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Because the <span style={{ color: AMBER }}>first turn</span> is what actually ships, PrimeEcho keeps α high, so the
          reward is anchored to zero-shot quality. Later turns still contribute through the
          <span style={{ color: ACC }}> best-of-turns</span> term — enough to give exploration signal — but not enough to make
          it worth deliberately failing turn 1 to &quot;fix&quot; it later. Drop α toward 0 on the
          <span className="text-foreground"> &quot;fixed on turn 4&quot;</span> trajectory and the reward climbs even though the
          model shipped a broken kernel first: that is exactly the multi-turn reward hacking PrimeEcho is built to prevent.
        </p>
      </div>
    </figure>
  )
}
