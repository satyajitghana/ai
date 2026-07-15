"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// GRAPE's one idea, drawn as a diagram. A position n acts on a query/key vector
// through a single group action G(n) = exp(n ω L). Which *kind* of generator L you
// pick decides the family:
//   • rank-2 skew  L = ab^T − ba^T   → G(n) is a ROTATION in SO(d)   (Multiplicative; recovers RoPE)
//   • rank-1 nilpotent A, A² = 0     → G(n) = I + nωA is a SHEAR/translation in GL (Additive; recovers ALiBi, FoX)
// Left: the plane the generator acts on — a rotation sweeps the vector around a
// norm-preserving circle; a shear slides it along an axis (norm not preserved).
// Right: the resulting *relative* score factor over offset m = j − i — the thing
// both families share: attention depends only on the offset. Scrub position, flip
// the family. Deterministic; illustrative.

const ROT = "oklch(0.58 0.15 255)" // multiplicative — blue
const ADD = "oklch(0.62 0.17 18)" // additive — rose

const W = 760
const H = 366
const N = 12 // positions shown

// left plane
const OX = 208
const OY = 196
const AX = 132 // axis half-length
const R = 96 // query vector length (= circle radius)
const THETA0 = 0.62 // base query angle (radians, up-right)
const OMEGA_S = 0.2 // rotation per position (rad) for multiplicative
const DX = 8.4 // shear px per position for additive
const BIAS_STEP = 0.088 // logit bias per position for additive

// right sparkline
const SX = 486
const SW = 250
const SY0 = 84
const SH = 190
const YMAX = 1.12
const YMIN = -1.18

type Mode = "mult" | "add"

export function GeneratorAction() {
  const [n, setN] = useState(6)
  const [mode, setMode] = useState<Mode>("mult")
  const accent = mode === "mult" ? ROT : ADD

  // base query endpoint
  const q0x = OX + R * Math.cos(THETA0)
  const q0y = OY - R * Math.sin(THETA0)

  // transformed endpoint under G(n)
  let gx: number, gy: number
  if (mode === "mult") {
    const a = THETA0 + n * OMEGA_S
    gx = OX + R * Math.cos(a)
    gy = OY - R * Math.sin(a)
  } else {
    gx = q0x + n * DX // shear along +x
    gy = q0y
  }

  // score-factor sparkline: f(m) over m = 0..N
  const fx = (m: number) => SX + (m / N) * SW
  const fy = (v: number) => SY0 + (1 - (v - YMIN) / (YMAX - YMIN)) * SH
  // rotation factor uses the same swept angle so it lines up with the plane
  const rot = (m: number) => Math.cos(m * OMEGA_S)
  const add = (m: number) => -(m * BIAS_STEP)
  const curveF = (m: number) => (mode === "mult" ? rot(m) : add(m))

  const pts = Array.from({ length: N + 1 }, (_, m) => `${fx(m)},${fy(curveF(m))}`).join(" ")
  const curV = curveF(n)

  // swept arc (multiplicative) from THETA0 to THETA0 + nΩ
  const arcEnd = THETA0 + n * OMEGA_S
  const arcR = R + 16
  const largeArc = n * OMEGA_S > Math.PI ? 1 : 0
  const arcPath =
    `M ${OX + arcR * Math.cos(THETA0)} ${OY - arcR * Math.sin(THETA0)} ` +
    `A ${arcR} ${arcR} 0 ${largeArc} 0 ${OX + arcR * Math.cos(arcEnd)} ${OY - arcR * Math.sin(arcEnd)}`

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one action · G(n) = exp(n ω L)</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Position ${n} acting through G(n) as a ${mode === "mult" ? "rotation in SO(d)" : "shear in GL"}; right panel shows the relative score factor over offset`}>
          <defs>
            <marker id="grape-ga-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={accent} strokeWidth={1.5} />
            </marker>
            <marker id="grape-ga-base" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.5} />
            </marker>
            <filter id="grape-ga-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* ---- left: the plane ---- */}
          <text x={OX - AX} y={40} className="fill-muted-foreground font-mono" fontSize={11}>
            {mode === "mult" ? "feature plane · SO(d) rotation" : "feature plane · GL shear"}
          </text>

          {/* axes */}
          <line x1={OX - AX} y1={OY} x2={OX + AX} y2={OY} stroke="var(--border)" strokeWidth={1} />
          <line x1={OX} y1={OY - AX} x2={OX} y2={OY + AX} stroke="var(--border)" strokeWidth={1} />

          {/* norm circle (only meaningful for rotation, faded for shear) */}
          <circle cx={OX} cy={OY} r={R} fill="none" stroke={mode === "mult" ? accent : "var(--border)"} strokeWidth={1} strokeDasharray="3 4" opacity={mode === "mult" ? 0.5 : 0.35} />

          {/* swept arc for rotation */}
          {mode === "mult" && n > 0 && (
            <path d={arcPath} fill="none" stroke={accent} strokeWidth={1.5} opacity={0.55} />
          )}
          {/* shear guide */}
          {mode === "add" && n > 0 && (
            <line x1={q0x} y1={q0y} x2={gx} y2={gy} stroke={accent} strokeWidth={1.5} strokeDasharray="2 3" opacity={0.6} />
          )}

          {/* base query vector q */}
          <line x1={OX} y1={OY} x2={q0x} y2={q0y} stroke="var(--muted-foreground)" strokeWidth={1.75} markerEnd="url(#grape-ga-base)" opacity={0.55} />
          <text x={q0x + 6} y={q0y - 4} className="fill-muted-foreground font-mono" fontSize={10}>q</text>

          {/* transformed vector G(n)q */}
          <line x1={OX} y1={OY} x2={gx} y2={gy} stroke={accent} strokeWidth={2.25} markerEnd="url(#grape-ga-arrow)" />
          <circle cx={gx} cy={gy} r={3.5} fill={accent} filter="url(#grape-ga-soft)" />
          <text x={gx + 7} y={gy - 5} className="fill-foreground font-mono" fontSize={10} fontWeight={600}>G({n})q</text>

          {/* isometry / non-isometry readout */}
          <text x={OX - AX} y={OY + AX + 22} className="fill-muted-foreground font-mono" fontSize={10}>
            {mode === "mult" ? "‖G(n)q‖ = ‖q‖  (norm-preserving)" : "G(n)q = q + nω·shift  (adds a bias)"}
          </text>

          {/* ---- right: the relative score factor ---- */}
          <text x={SX} y={40} className="fill-muted-foreground font-mono" fontSize={11}>relative factor vs offset m = j − i</text>

          {/* frame */}
          <line x1={SX} y1={SY0} x2={SX} y2={SY0 + SH} stroke="var(--border)" strokeWidth={1} />
          <line x1={SX} y1={fy(0)} x2={SX + SW} y2={fy(0)} stroke="var(--border)" strokeWidth={1} />
          <text x={SX - 6} y={fy(1) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>+1</text>
          <text x={SX - 6} y={fy(0) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>0</text>
          <text x={SX - 6} y={fy(-1) + 3} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>−1</text>
          <text x={SX + SW} y={SY0 + SH + 14} textAnchor="end" className="fill-muted-foreground/70 font-mono" fontSize={8}>{N}</text>
          <text x={SX} y={SY0 + SH + 14} className="fill-muted-foreground/70 font-mono" fontSize={8}>0</text>

          {/* curve */}
          <polyline points={pts} fill="none" stroke={accent} strokeWidth={2} />
          {/* marker */}
          <line x1={fx(n)} y1={SY0} x2={fx(n)} y2={SY0 + SH} stroke={accent} strokeWidth={1} strokeDasharray="2 3" opacity={0.5} />
          <circle cx={fx(n)} cy={fy(curV)} r={4} fill={accent} filter="url(#grape-ga-soft)" />

          <text x={SX} y={SY0 + SH + 30} className="fill-muted-foreground font-mono" fontSize={10}>
            {mode === "mult" ? "cos(m ω s) — oscillates, exact & relative" : "−(m ω·slope) — monotonic distance penalty"}
          </text>
        </svg>

        {/* controls */}
        <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">family</span>
            <button type="button" onClick={() => setMode("mult")} aria-pressed={mode === "mult"}
              className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", mode === "mult" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
              style={mode === "mult" ? { background: ROT } : undefined}>
              multiplicative
            </button>
            <button type="button" onClick={() => setMode("add")} aria-pressed={mode === "add"}
              className={cn("cursor-pointer rounded-md px-2 py-1 font-mono text-[10px] transition-colors", mode === "add" ? "text-background" : "bg-muted text-muted-foreground hover:text-foreground")}
              style={mode === "add" ? { background: ADD } : undefined}>
              additive
            </button>
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            {mode === "mult" ? "generator L = ab⊤ − ba⊤ ∈ 𝖘𝖔(d)" : "generator A, A² = 0 ∈ 𝖌𝖑(d+1)"}
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">position n (drag)</div>
          <input type="range" min={0} max={N} value={n} onChange={(e) => setN(Number(e.target.value))} className="w-full cursor-pointer" style={{ accentColor: accent }} />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Same law, two generators. Pick a <span style={{ color: ROT }}>rank-2 skew</span> generator and G(n)
          is a rotation: the vector sweeps a norm-preserving circle and the relative score factor is a clean{" "}
          <span style={{ color: ROT }}>cosine</span> of the offset — that is exactly RoPE. Pick a{" "}
          <span style={{ color: ADD }}>rank-1 nilpotent</span> generator and G(n) = I + nωA is a shear that
          translates the feature and injects a <span style={{ color: ADD }}>linear-in-offset bias</span> into the
          logit — that is exactly ALiBi. Both obey the same relative law, so attention depends only on m = j − i.
        </p>
      </div>
    </figure>
  )
}
