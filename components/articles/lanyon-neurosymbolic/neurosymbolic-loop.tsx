"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Lanyon's neurosymbolic loop, drawn as one scene. A neural PROPOSER emits a
// candidate solver together with its formal spec in a domain-specific language;
// a SYMBOLIC ENGINE (exact algebra + an IEEE-754 theorem-prover) type-checks the
// proof and compiles the kernels *before* any simulation runs. A type/compile
// error routes back to the proposer to revise — the tight verify-first loop.
// Contrast the pure-LLM path below: it writes solver code token-by-token with no
// verifier gate, so a math / algorithmic / floating-point error can pass
// silently into the output. The reader drives a stage control and a "bug?"
// toggle. Illustrative; SSR-safe (deterministic, no Date/random).

const ACCENT = "oklch(0.62 0.16 250)" // neurosymbolic path
const WARN = "oklch(0.62 0.2 25)" // silent / caught error

type Stage = "propose" | "verify" | "resolve"

// scene geometry (viewBox units)
const W = 760
const H = 372

// horizontal-ish connector as a gentle cubic
const hCurve = (x1: number, y1: number, x2: number, y2: number) => {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}

export function NeurosymbolicLoop() {
  const [stage, setStage] = useState<Stage>("verify")
  const [bug, setBug] = useState(false)

  const proposeActive = stage === "propose"
  const engineActive = stage === "verify" || stage === "resolve"
  const passActive = stage === "resolve" && !bug
  const failActive = stage === "resolve" && bug
  const verifiedActive = passActive

  const readout = failActive
    ? "Same bug: the engine rejects it before the sim runs and loops it back — while the pure-LLM path ships it silently."
    : passActive
      ? "Proof type-checks and kernels compile: the solver is emitted with a machine-checked link between math and code."
      : bug
        ? "A bug is present in the candidate — advance to “resolve”."
        : "A candidate solver + its formal spec flow to the symbolic engine."

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>neurosymbolic loop · verify before you run</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Top lane: a neural proposer emits a candidate solver and formal spec to a symbolic engine (exact algebra plus an IEEE-754 theorem-prover) that type-checks and compiles before running; a failed check loops back to the proposer, a passed check emits a verified solver. Bottom lane: a pure LLM writes solver code token-by-token straight to an unverified output, where a math, algorithmic, or floating-point error can pass silently."
        >
          <defs>
            <marker id="nl-a" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="nl-w" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={WARN} strokeWidth={1.5} />
            </marker>
            <marker id="nl-m" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="nl-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- lane labels ---- */}
          <text x={44} y={38} className="fill-muted-foreground font-mono" fontSize={11}>
            neurosymbolic · verify-first
          </text>
          <text x={44} y={236} className="fill-muted-foreground font-mono" fontSize={11}>
            pure LLM · single pass
          </text>

          {/* ================= TOP LANE ================= */}

          {/* feedback arc (drawn first, behind nodes) */}
          <path
            d="M 340 122 C 340 182, 120 182, 120 114"
            fill="none"
            stroke={WARN}
            strokeWidth={1.5}
            strokeDasharray="4 3"
            markerEnd="url(#nl-w)"
            opacity={failActive ? 0.9 : 0.1}
            className="transition-all duration-300"
          />
          <text x={230} y={176} textAnchor="middle" className="font-mono" fontSize={10} fill={WARN} opacity={failActive ? 0.9 : 0.12}>
            type / compile error → revise
          </text>

          {/* forward: proposer → engine */}
          <path d={hCurve(196, 86, 300, 86)} fill="none" stroke={ACCENT} strokeWidth={1.5} markerEnd="url(#nl-a)" opacity={0.85} />
          <text x={248} y={74} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            solver + spec
          </text>

          {/* pass: engine → verified */}
          <path
            d={hCurve(496, 86, 596, 86)}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            markerEnd="url(#nl-a)"
            opacity={passActive ? 0.9 : 0.12}
            className="transition-all duration-300"
          />
          <text x={546} y={74} textAnchor="middle" className="font-mono" fontSize={9} fill={ACCENT} opacity={passActive ? 0.9 : 0.15}>
            type-checks
          </text>

          {/* proposer node */}
          <g className="transition-all duration-300" opacity={proposeActive || failActive ? 1 : 0.62}>
            <rect x={44} y={58} width={152} height={56} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={proposeActive || failActive ? 2 : 1.5} filter="url(#nl-soft)" />
            <text x={120} y={82} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Neural proposer</text>
            <text x={120} y={98} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>emits DSL spec + code</text>
          </g>

          {/* symbolic engine node */}
          <g className="transition-all duration-300">
            <rect x={300} y={50} width={196} height={72} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={engineActive ? 2 : 1.5} filter="url(#nl-soft)" />
            <rect x={300} y={50} width={196} height={72} rx={10} fill={ACCENT} opacity={engineActive ? 0.08 : 0} className="transition-all duration-300" />
            <text x={398} y={74} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Symbolic engine</text>
            <text x={398} y={91} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>exact algebra · prover</text>
            <text x={398} y={106} textAnchor="middle" className="font-mono" fontSize={9.5} fill={ACCENT}>IEEE-754 axioms</text>
          </g>

          {/* verified node */}
          <g className="transition-all duration-300" opacity={verifiedActive ? 1 : 0.4}>
            <rect x={596} y={58} width={140} height={56} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={verifiedActive ? 2 : 1.5} filter={verifiedActive ? "url(#nl-soft)" : undefined} />
            <rect x={596} y={58} width={140} height={56} rx={10} fill={ACCENT} opacity={verifiedActive ? 0.1 : 0} />
            <text x={666} y={82} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Verified solver</text>
            <text x={666} y={98} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>proof binds the code</text>
          </g>

          {/* ---- divider ---- */}
          <line x1={24} y1={210} x2={736} y2={210} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 4" />

          {/* ================= BOTTOM LANE ================= */}

          {/* llm → output */}
          <path d={hCurve(244, 300, 560, 300)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} markerEnd="url(#nl-m)" opacity={0.75} />
          <text x={402} y={288} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9}>
            generates code token-by-token · no gate
          </text>

          {/* fault burst mid-arrow */}
          <g opacity={bug ? 1 : 0} className="transition-all duration-300">
            <circle cx={402} cy={300} r={9} fill="var(--background)" stroke={WARN} strokeWidth={1.5} />
            <text x={402} y={304} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={700} fill={WARN}>!</text>
          </g>

          {/* llm node */}
          <g>
            <rect x={44} y={272} width={200} height={56} rx={10} fill="var(--background)" stroke="var(--border)" strokeWidth={1.5} filter="url(#nl-soft)" />
            <text x={144} y={296} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Frontier LLM</text>
            <text x={144} y={312} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={9.5}>reasons in tokens</text>
          </g>

          {/* output node */}
          <g className="transition-all duration-300">
            <rect x={560} y={272} width={176} height={56} rx={10} fill="var(--background)" stroke={bug ? WARN : "var(--border)"} strokeWidth={bug ? 2 : 1.5} filter="url(#nl-soft)" />
            <rect x={560} y={272} width={176} height={56} rx={10} fill={WARN} opacity={bug ? 0.08 : 0} />
            <text x={648} y={296} textAnchor="middle" className="fill-foreground font-mono" fontSize={12} fontWeight={600}>Solver code</text>
            <text x={648} y={312} textAnchor="middle" className="font-mono" fontSize={9.5} fill={bug ? WARN : "var(--muted-foreground)"}>
              {bug ? "ships a silent error" : "unverified"}
            </text>
          </g>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">stage</span>
            {(["propose", "verify", "resolve"] as Stage[]).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStage(s)}
                aria-pressed={stage === s}
                className={cn(
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                  stage === s ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">candidate</span>
            {[
              { on: false, label: "clean" },
              { on: true, label: "has bug" },
            ].map((b) => (
              <button
                key={b.label}
                type="button"
                onClick={() => setBug(b.on)}
                aria-pressed={bug === b.on}
                className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", bug === b.on ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
                style={bug === b.on ? { background: b.on ? WARN : ACCENT } : undefined}
              >
                {b.label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {failActive ? (
              <span style={{ color: WARN }}>caught ↔ shipped</span>
            ) : verifiedActive ? (
              <span style={{ color: ACCENT }}>verified</span>
            ) : (
              <span>drive the loop →</span>
            )}
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{readout}</p>
      </div>
    </figure>
  )
}
