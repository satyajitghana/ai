"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The geometric "why" of Muon, on a 2D weight matrix.
// A momentum update M = U diag(sigma1, sigma2) V^T maps the unit ball of
// directions to an ELLIPSE: it moves the weights far along the dominant
// singular direction (sigma1) and barely at all along the weak one (sigma2).
// That anisotropy is what a raw gradient/momentum step looks like -- one
// direction dominates. Muon replaces M with U V^T: same directions, but every
// singular value is 1, so the update is ISOTROPIC -- a circle. No direction is
// starved, none dominates. Toggle to morph the ellipse back to a circle.
//
// SSR-safe: pure deterministic render (default "raw"), state-only, no timers,
// no Math.random. Geometry is computed from constants each render.

const RAW = "oklch(0.64 0.19 25)" // warm red -- the raw, lopsided step
const MUON = "oklch(0.60 0.18 275)" // indigo -- the orthogonalized step

const S1 = 1.0 // dominant singular value (normalized)
const S2 = 0.28 // weak singular value
const THETA = -25 // orientation of the singular directions (degrees)

const W = 440
const H = 290
const CX = 150
const CY = 150
const R = 92 // pixels per unit length

const rad = (d: number) => (d * Math.PI) / 180

function axis(sigma: number, deg: number) {
  const a = rad(deg)
  return { x: CX + sigma * R * Math.cos(a), y: CY + sigma * R * Math.sin(a) }
}

export function MuonStep() {
  const [mode, setMode] = useState<"raw" | "muon">("raw")
  const isMuon = mode === "muon"
  const s2 = isMuon ? 1 : S2
  const ratio = S1 / s2

  const c = isMuon ? MUON : RAW
  const u1 = axis(S1, THETA)
  const u2 = axis(s2, THETA + 90)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one step on a 2D weight matrix · the update&apos;s reach in every direction</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="A unit circle of directions; the raw update maps it to a stretched ellipse, the Muon update to a circle.">
            {/* unit circle: the input ball of directions */}
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="var(--muted-foreground)" strokeDasharray="3 4" strokeWidth={1} opacity={0.5} />
            <text x={CX} y={CY - R - 8} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={9}>
              unit ball of directions
            </text>

            {/* the update's reach: ellipse (raw) morphing to circle (Muon) */}
            <ellipse
              cx={CX}
              cy={CY}
              rx={S1 * R}
              ry={s2 * R}
              transform={`rotate(${THETA} ${CX} ${CY})`}
              fill={c}
              fillOpacity={0.14}
              stroke={c}
              strokeWidth={2}
              style={{ transition: "ry 500ms ease" }}
            />

            {/* principal singular directions */}
            <line x1={2 * CX - u1.x} y1={2 * CY - u1.y} x2={u1.x} y2={u1.y} stroke={c} strokeWidth={2} opacity={0.9} />
            <line x1={2 * CX - u2.x} y1={2 * CY - u2.y} x2={u2.x} y2={u2.y} stroke={c} strokeWidth={2} opacity={0.9} style={{ transition: "all 500ms ease" }} />
            <circle cx={u1.x} cy={u1.y} r={3.5} fill={c} />
            <circle cx={u2.x} cy={u2.y} r={3.5} fill={c} style={{ transition: "all 500ms ease" }} />

            {/* sigma labels on the axes */}
            <text x={u1.x + 8} y={u1.y - 6} className="font-mono" fontSize={11} fill={c}>
              σ₁ = {S1.toFixed(2)}
            </text>
            <text x={u2.x - 6} y={u2.y - 8} textAnchor="end" className="font-mono" fontSize={11} fill={c}>
              σ₂ = {s2.toFixed(2)}
            </text>
          </svg>

          {/* readout */}
          <div className="min-w-[9rem] space-y-3 font-mono text-xs">
            <div>
              <div className="text-[10px] text-muted-foreground">stretch σ₁/σ₂</div>
              <div className="text-lg font-medium tabular-nums" style={{ color: c }}>
                {ratio.toFixed(1)}×
              </div>
            </div>
            <div className="text-[11px] leading-5 text-muted-foreground">
              {isMuon
                ? "isotropic — every direction moves equally. This is U Vᵀ."
                : "anisotropic — the step lands almost entirely along σ₁. This is raw momentum."}
            </div>
          </div>
        </div>

        {/* controls */}
        <div className="mt-3 flex items-center gap-2">
          {(["raw", "muon"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              aria-pressed={mode === m}
              className={cn(
                "cursor-pointer rounded-md px-3 py-1.5 font-mono text-[11px] transition-colors",
                mode === m ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground"
              )}
              style={mode === m ? { background: m === "muon" ? MUON : RAW } : undefined}
            >
              {m === "raw" ? "raw momentum" : "Muon (orthogonalized)"}
            </button>
          ))}
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A raw momentum step on a 2D matrix is <span style={{ color: RAW }}>lopsided</span>: singular value σ₁ dwarfs σ₂, so
          the weights lurch far along one direction and hardly move along the other. Muon keeps the singular <em>directions</em>{" "}
          but sets every singular value to <span style={{ color: MUON }}>1</span> — the ellipse becomes a circle, and the step
          reaches equally in all directions. Same information, spectrally normalized so no single direction dominates the update.
        </p>
      </div>
    </figure>
  )
}
