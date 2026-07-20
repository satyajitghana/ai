"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// KAT-Coder-V2.5 — the SWE data-scaling flywheel. On hard repository tasks the raw
// rollout pass rate is near zero, so there is nothing to learn from. The fix is a
// two-stage recovery loop: (1) inject process-level HINTS to lift near-misses into
// passing trajectories (pass rate ~0% → ~20%), then (2) REPLAY the same tasks hint-free
// and keep only the trajectories that genuinely recover — so the final training data
// carries no hint leakage and stays faithful to the original distribution. A
// process-score FILTER then down-weights exploitative / low-quality behaviors. Drag the
// hint strength and step the stages to watch failed rollouts become verified patches.
// Illustrative: the recovery threshold is stylized, not measured.

const FAIL = "oklch(0.62 0.02 260)" // muted grey — failed
const NEAR = "oklch(0.72 0.13 65)" // amber — near-miss
const PASS = "oklch(0.58 0.13 150)" // green — passing / verified

const N = 24
const COLS = 8
const ROWS = 3

// deterministic latent "recoverability" per trajectory, spread across [0,1]
const rec = (i: number) => (Math.sin(i * 2.399 + 0.7) + 1) / 2

type Stage = "rollout" | "hint-boost" | "replay" | "filter"
const STAGES: Stage[] = ["rollout", "hint-boost", "replay", "filter"]
const STAGE_LABEL: Record<Stage, string> = {
  rollout: "1 · rollout",
  "hint-boost": "2 · hint-boost",
  replay: "3 · hint-free replay",
  filter: "4 · process filter",
}

const W = 760
const H = 168

// classify a trajectory at the current stage + hint strength → color + state
function classify(i: number, stage: Stage, h: number): { fill: string; ring: boolean; dropped: boolean } {
  const r = rec(i)
  const passHint = r >= 1 - 0.24 * h
  const recovers = r >= 0.84 // survives hint-free replay
  const exploit = i % 11 === 3 // a couple of exploitative trajectories the filter catches
  if (stage === "rollout") return { fill: r > 0.55 ? NEAR : FAIL, ring: false, dropped: false }
  if (stage === "hint-boost") return { fill: passHint ? PASS : r > 0.55 ? NEAR : FAIL, ring: passHint, dropped: false }
  if (stage === "replay") {
    if (passHint && recovers) return { fill: PASS, ring: true, dropped: false }
    if (passHint && !recovers) return { fill: NEAR, ring: false, dropped: true } // hint-dependent → dropped
    return { fill: r > 0.55 ? NEAR : FAIL, ring: false, dropped: false }
  }
  // filter
  if (passHint && recovers && !exploit) return { fill: PASS, ring: true, dropped: false }
  if (passHint && recovers && exploit) return { fill: FAIL, ring: false, dropped: true }
  return { fill: r > 0.55 ? NEAR : FAIL, ring: false, dropped: r >= 1 - 0.24 * h && !recovers }
}

export function DataFlywheel() {
  const [stage, setStage] = useState<Stage>("hint-boost")
  const [h, setH] = useState(1)

  const passCount = Array.from({ length: N }, (_, i) => classify(i, stage, h)).filter((c) => c.fill === PASS).length
  const passPct = Math.round((passCount / N) * 100)

  // grid geometry
  const gx0 = 40
  const gy0 = 66
  const cw = 34
  const ch = 30
  const cellX = (i: number) => gx0 + (i % COLS) * cw
  const cellY = (i: number) => gy0 + Math.floor(i / COLS) * ch

  // stage pipeline nodes across the top
  const stageX = (k: number) => 78 + k * 168

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>data flywheel · near-misses → verified patches, no hint leakage</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`Stage ${STAGE_LABEL[stage]}. ${passCount} of ${N} trajectories (${passPct}%) are passing / verified at the current hint strength.`}
        >
          <defs>
            <marker id="fw-arr" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="fw-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* stage pipeline */}
          {STAGES.map((s, k) => {
            const active = s === stage
            return (
              <g key={s}>
                {k < STAGES.length - 1 && (
                  <path d={`M ${stageX(k) + 62} 30 C ${stageX(k) + 90} 30, ${stageX(k + 1) - 90} 30, ${stageX(k + 1) - 62} 30`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} markerEnd="url(#fw-arr)" opacity={0.5} />
                )}
                {k === STAGES.length - 1 && (
                  // flywheel return arc back to stage 1
                  <path d={`M ${stageX(k)} 44 C ${stageX(k)} 150, ${stageX(0)} 150, ${stageX(0)} 44`} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} strokeDasharray="3 3" markerEnd="url(#fw-arr)" opacity={0.4} />
                )}
              </g>
            )
          })}

          {/* trajectory dots (drawn under the last-stage return arc is fine) */}
          {Array.from({ length: N }, (_, i) => {
            const c = classify(i, stage, h)
            return (
              <g key={i}>
                <rect
                  x={cellX(i)}
                  y={cellY(i)}
                  width={cw - 8}
                  height={ch - 8}
                  rx={5}
                  fill={c.fill}
                  opacity={c.dropped ? 0.18 : c.fill === FAIL ? 0.4 : 0.9}
                  stroke={c.ring ? PASS : "transparent"}
                  strokeWidth={1.8}
                  filter={c.ring ? "url(#fw-soft)" : undefined}
                  className="transition-all duration-300"
                />
                {c.dropped && (
                  <path
                    d={`M ${cellX(i) + 5} ${cellY(i) + 5} l ${cw - 18} ${ch - 18} M ${cellX(i) + cw - 13} ${cellY(i) + 5} l ${-(cw - 18)} ${ch - 18}`}
                    stroke="var(--muted-foreground)"
                    strokeWidth={1.2}
                    opacity={0.5}
                  />
                )}
              </g>
            )
          })}
        </svg>

        {/* stage buttons over the SVG stage row (as HTML for crisp text) */}
        <div className="-mt-2 flex flex-wrap items-center justify-between gap-1.5">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStage(s)}
              aria-pressed={stage === s}
              className={cn(
                "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                stage === s ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {STAGE_LABEL[s]}
            </button>
          ))}
        </div>

        {/* hint strength + pass-rate readout */}
        <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>process-hint strength (drag)</span>
              <span>
                pass rate{" "}
                <span style={{ color: PASS }}>{passPct}%</span>
                {stage === "rollout" ? " · hints off" : ""}
              </span>
            </div>
            <Range
              min={0}
              max={100}
              value={Math.round(h * 100)}
              onChange={(e) => setH(Number(e.target.value) / 100)}
              disabled={stage === "rollout"}
              className="w-full cursor-pointer  disabled:opacity-40" accent="oklch(0.58 0.13 150)" />
          </div>
          <div className="flex items-center gap-3 font-mono text-[10px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: FAIL, opacity: 0.5 }} /> failed</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NEAR }} /> near-miss</span>
            <span className="flex items-center gap-1"><span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: PASS }} /> verified</span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Stage 1, the raw rollout, has essentially <span className="text-foreground">no passing trajectories</span> — a dead
          gradient. Stage 2 injects <span style={{ color: PASS }}>process-level hints</span> that recover near-misses,
          lifting the pass rate from ~0% to about 20%. But hint-conditioned trajectories would teach the model to expect
          hints it will never get at test time, so stage 3 <span className="text-foreground">replays the same tasks
          hint-free</span> and keeps only the ones that still recover (the crossed-out cells are hint-dependent and
          discarded — no leakage). Stage 4’s process-score filter then drops exploitative or unstable trajectories. What
          survives is a small set of <span style={{ color: PASS }}>verified patches</span> that look like ordinary,
          hint-free work.
        </p>
      </div>
    </figure>
  )
}
