"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// MirrorPop: sequence-level off-policy masking, drawn token by token. In async RL the
// rollout policy drifts from the training policy, so each token has an importance ratio
// ρ_t. Vanilla sequence masking averages the *signed* log-ratios — and a sequence that is
// badly off-policy in both directions cancels to ~0, so it slips through the filter (the
// paper's Figure 11 "cancellation" case). MirrorPop averages the *absolute* log-ratios,
// m̄ = exp((1/L)Σ|log ρ_t|), which can only grow, and masks the sequence when that mean
// exceeds δ. Deterministic token arrays; no randomness. Toggle the two sequences and slide
// δ to see which filter catches the drift.

const POS = "oklch(0.58 0.17 25)" // ρ>1 (log-ratio positive)
const NEG = "oklch(0.60 0.14 155)" // ρ<1 (log-ratio negative)
const ACC = "oklch(0.62 0.16 250)"

// deterministic per-token log-ratios (log ρ_t)
const SEQS: { id: string; label: string; lr: number[] }[] = [
  { id: "onpolicy", label: "on-policy", lr: [0.05, -0.08, 0.1, -0.04, 0.06, -0.09, 0.03, -0.05, 0.07, -0.06, 0.04, -0.03] },
  { id: "cancel", label: "drifted, cancelling", lr: [0.9, -0.85, 0.8, -0.95, 0.7, -0.75, 0.88, -0.9, 0.82, -0.8, 0.78, -0.86] },
]

const W = 760
const H = 210
const MX = 46
const BASE = 110 // zero baseline y
const AMP = 60 // px per 1.0 log-ratio
const CW = (W - 2 * MX) / 12

export function MirrorPop() {
  const [seq, setSeq] = useState(SEQS[1])
  const [delta, setDelta] = useState(0.3)

  const lr = seq.lr
  const L = lr.length
  const meanSigned = lr.reduce((a, b) => a + b, 0) / L // vanilla statistic
  const meanAbs = lr.reduce((a, b) => a + Math.abs(b), 0) / L // MirrorPop statistic
  const geoMirror = Math.exp(meanAbs)

  const vanillaKeeps = Math.abs(meanSigned) <= delta
  const mirrorKeeps = meanAbs <= delta

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MirrorPop · off-policy sequence masking</span>
        <span className="text-muted-foreground/50">eq. (20–21), illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Sequence ${seq.label}: vanilla mean ${meanSigned.toFixed(2)}, MirrorPop mean-abs ${meanAbs.toFixed(2)}`}>
          <defs>
            <filter id="mp-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>per-token log-ratio log ρ_t · one response (L={L})</text>
          <text x={MX} y={BASE - 44} className="font-mono" fontSize={9} style={{ fill: POS }}>ρ&gt;1</text>
          <text x={MX} y={BASE + 52} className="font-mono" fontSize={9} style={{ fill: NEG }}>ρ&lt;1</text>

          {/* zero baseline */}
          <line x1={MX} y1={BASE} x2={W - MX} y2={BASE} stroke="var(--border)" strokeWidth={1.5} />

          {/* token bars */}
          {lr.map((v, t) => {
            const x = MX + t * CW + 3
            const h = Math.abs(v) * AMP
            const up = v > 0
            return (
              <g key={t}>
                <rect x={x} y={up ? BASE - h : BASE} width={CW - 6} height={h} rx={2} fill={up ? POS : NEG} opacity={0.85} className="transition-all duration-300" />
              </g>
            )
          })}

          {/* vanilla mean (signed) marker line */}
          <line x1={MX} y1={BASE - meanSigned * AMP} x2={W - MX} y2={BASE - meanSigned * AMP} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="4 3" opacity={0.8} />
          <text x={W - MX} y={BASE - meanSigned * AMP - 5} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={9}>vanilla mean = {meanSigned.toFixed(2)} (cancels)</text>

          {/* MirrorPop stat readout box */}
          <g filter="url(#mp-soft)">
            <rect x={MX} y={168} width={330} height={30} rx={7} fill="var(--background)" stroke={mirrorKeeps ? "var(--border)" : ACC} strokeWidth={1.5} />
          </g>
          <text x={MX + 12} y={187} className="fill-foreground font-mono" fontSize={11}>
            MirrorPop m̄ = (1/L)·Σ|log ρ_t| = <tspan fontWeight={700} style={{ fill: ACC }}>{meanAbs.toFixed(2)}</tspan>
            <tspan className="fill-muted-foreground"> → exp = {geoMirror.toFixed(2)}×</tspan>
          </text>

          {/* verdict chips */}
          {(() => {
            const chip = (x: number, label: string, keeps: boolean) => (
              <g>
                <rect x={x} y={168} width={185} height={30} rx={7} fill={keeps ? NEG : POS} opacity={0.12} stroke={keeps ? NEG : POS} strokeWidth={1.2} />
                <text x={x + 12} y={187} className="font-mono" fontSize={10} fontWeight={600} style={{ fill: keeps ? NEG : POS }}>
                  {label}: {keeps ? "kept ✓" : "masked ✕"}
                </text>
              </g>
            )
            return chip(W - MX - 185, "MirrorPop", mirrorKeeps)
          })()}
        </svg>

        {/* sequence selector */}
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 font-mono text-[10px] text-muted-foreground">response</span>
          {SEQS.map((x) => (
            <button key={x.id} type="button" onClick={() => setSeq(x)} aria-pressed={seq.id === x.id}
              className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", seq.id === x.id ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {x.label}
            </button>
          ))}
          <span className="ml-auto font-mono text-[10px] text-muted-foreground">
            vanilla: <span style={{ color: vanillaKeeps ? NEG : POS }}>{vanillaKeeps ? "kept" : "masked"}</span> · mirrorpop: <span style={{ color: mirrorKeeps ? NEG : POS }}>{mirrorKeeps ? "kept" : "masked"}</span>
          </span>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">threshold δ = {delta.toFixed(2)}</div>
          <Range min={0.05} max={1} step={0.05} value={delta} onChange={(e) => setDelta(Number(e.target.value))} className="w-full cursor-pointer " accent="oklch(0.62 0.16 250)" />
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          On the <span className="text-foreground">drifted, cancelling</span> response every token is far off-policy, but the
          positive and negative log-ratios average to <span className="text-foreground">≈0</span> — so the vanilla filter
          judges it on-policy and <span style={{ color: POS }}>keeps</span> a sequence it should drop. MirrorPop takes the mean
          of the <em>absolute</em> log-ratios, which each token can only push up, so the same response reads as strongly
          off-policy and gets <span style={{ color: ACC }}>masked</span> out of the gradient. It is the single component whose
          removal costs the most in the ablation (Pass@8 93.2 → 86.0).
        </p>
      </div>
    </figure>
  )
}
