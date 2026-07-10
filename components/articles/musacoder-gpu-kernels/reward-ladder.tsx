"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// MusaCoder's execution reward s(c), drawn as a ladder. The paper's core reward move is
// "correctness-first": every candidate that fails to compile/run, cheats with a PyTorch
// aten::* fallback, or is numerically wrong lands at exactly -1. A partially correct
// kernel earns a bounded shaping signal in [-0.5, 0), still negative. ONLY a fully
// correct, legal, native kernel crosses zero into positive territory — and only then does
// a speedup bonus stack on top. Pick an outcome and watch where it lands. (λ, ν_max are
// illustrative; the paper leaves them as tunable weights — see caption.)

const ACC = "oklch(0.62 0.16 250)" // positive / accent
const BAD = "oklch(0.58 0.17 25)" // negative / fail
const LAMBDA = 0.5 // illustrative performance weight
const NU_MAX = 4 // illustrative speedup clip

type Outcome = "fail" | "cheat" | "wrong" | "partial" | "correct"

const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: "fail", label: "compile / run fail" },
  { id: "cheat", label: "aten:: fallback" },
  { id: "wrong", label: "wrong (q=0)" },
  { id: "partial", label: "partial (0<q<1)" },
  { id: "correct", label: "correct + fast" },
]

function reward(o: Outcome, q: number, nu: number): number {
  if (o === "fail" || o === "cheat" || o === "wrong") return -1
  if (o === "partial") return -0.5 + 0.5 * q
  return 1 + LAMBDA * Math.min(Math.max(nu - 1, 0), NU_MAX)
}

// scene geometry
const W = 760
const H = 210
const AX = 70 // axis left
const AR = W - 40 // axis right
const AY = 96 // number-line y
const S_MIN = -1.2
const S_MAX = 3
const sx = (s: number) => AX + ((s - S_MIN) / (S_MAX - S_MIN)) * (AR - AX)

export function RewardLadder() {
  const [outcome, setOutcome] = useState<Outcome>("correct")
  const [q, setQ] = useState(0.6)
  const [nu, setNu] = useState(2.5)

  const s = reward(outcome, q, nu)
  const positive = s > 0
  const col = positive ? ACC : BAD
  const mx = sx(s)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MooreEval reward · correctness first</span>
        <span className="text-muted-foreground/50">eq. (2), illustrative weights</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Reward for a ${outcome} kernel is ${s.toFixed(2)}`}>
          <defs>
            <filter id="rl-soft" x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.16" />
            </filter>
          </defs>

          {/* negative zone tint */}
          <rect x={sx(S_MIN)} y={AY - 26} width={sx(0) - sx(S_MIN)} height={52} rx={6} fill={BAD} opacity={0.06} />
          {/* positive zone tint */}
          <rect x={sx(0)} y={AY - 26} width={sx(S_MAX) - sx(0)} height={52} rx={6} fill={ACC} opacity={0.07} />

          {/* axis line */}
          <line x1={AX} y1={AY} x2={AR} y2={AY} stroke="var(--border)" strokeWidth={1.5} />
          {[-1, -0.5, 0, 1, 2, 3].map((t) => (
            <g key={t}>
              <line x1={sx(t)} y1={AY - 5} x2={sx(t)} y2={AY + 5} stroke="var(--muted-foreground)" strokeWidth={1} opacity={0.5} />
              <text x={sx(t)} y={AY + 20} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={10}>{t}</text>
            </g>
          ))}
          {/* zero wall */}
          <line x1={sx(0)} y1={AY - 28} x2={sx(0)} y2={AY + 28} stroke="var(--muted-foreground)" strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
          <text x={sx(0)} y={AY - 34} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>the correctness wall</text>

          {/* zone labels */}
          <text x={AX + 4} y={AY + 40} className="fill-muted-foreground/70 font-mono" fontSize={9}>unusable / cheating / wrong</text>
          <text x={AR - 4} y={AY + 40} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={9}>correct · +speedup bonus →</text>

          {/* -1 floor marker (where all failures pile up) */}
          <g opacity={positive || outcome === "partial" ? 0.35 : 1}>
            <circle cx={sx(-1)} cy={AY} r={5} fill={BAD} opacity={0.5} />
          </g>

          {/* current marker */}
          <g className="transition-all duration-300" style={{ transform: `translateX(${mx - sx(s)}px)` }}>
            <line x1={mx} y1={AY - 22} x2={mx} y2={AY + 22} stroke={col} strokeWidth={1.5} />
            <circle cx={mx} cy={AY} r={7} fill={col} filter="url(#rl-soft)" />
            <rect x={Math.min(Math.max(mx - 34, AX), AR - 68)} y={AY - 58} width={68} height={22} rx={6} fill="var(--background)" stroke={col} strokeWidth={1.5} filter="url(#rl-soft)" />
            <text x={Math.min(Math.max(mx, AX + 34), AR - 34)} y={AY - 43} textAnchor="middle" className="font-mono" fontSize={12} fontWeight={700} style={{ fill: col }}>s = {s.toFixed(2)}</text>
          </g>
        </svg>

        {/* outcome selector */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">verifier verdict</span>
          {OUTCOMES.map((o) => (
            <button key={o.id} type="button" onClick={() => setOutcome(o.id)} aria-pressed={outcome === o.id}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", outcome === o.id ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {o.label}
            </button>
          ))}
        </div>

        {/* contextual sliders */}
        {outcome === "partial" && (
          <div className="mt-3">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">correctness fraction q = {q.toFixed(2)} → s = −0.5 + 0.5·q = {(-0.5 + 0.5 * q).toFixed(2)}</div>
            <input type="range" min={0.01} max={0.99} step={0.01} value={q} onChange={(e) => setQ(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.17_25)]" />
          </div>
        )}
        {outcome === "correct" && (
          <div className="mt-3">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">speedup ν = {nu.toFixed(1)}× → s = 1 + λ·min(ν−1, ν_max) = {s.toFixed(2)} <span className="text-muted-foreground/60">(λ={LAMBDA}, ν_max={NU_MAX})</span></div>
            <input type="range" min={1} max={6} step={0.1} value={nu} onChange={(e) => setNu(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.62_0.16_250)]" />
          </div>
        )}
        {(outcome === "fail" || outcome === "cheat" || outcome === "wrong") && (
          <div className="mt-3 font-mono text-[10px] text-muted-foreground">
            all three collapse to a flat <span style={{ color: BAD }}>s = −1</span> — no partial credit for code that doesn&apos;t run, cheats with a high-level fallback, or is numerically wrong.
          </div>
        )}

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The reward is a <span className="text-foreground">correctness-first hierarchy</span>. A kernel that fails to compile,
          throws at runtime, smuggles in a forbidden <span className="font-mono text-xs">aten::*</span> fallback, or is simply
          wrong all earn the same floor of <span style={{ color: BAD }}>−1</span>. Partial correctness earns a bounded,
          still-negative shaping term in <span className="font-mono text-xs">[−0.5, 0)</span>. Only a fully correct,
          <em> legal, native</em> kernel clears the wall into <span style={{ color: ACC }}>positive</span> reward — and only
          then does the clipped speedup bonus apply. That ordering is what stops the model from trading correctness for a
          flashy speedup.
        </p>
      </div>
    </figure>
  )
}
