"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10, mpow } from "@/lib/dmath"

// The RoomTSC paper's budget for a phonon-mediated 300 K superconductor, on the plane of
// hydrogen number density (rho_H) and scattering strength per proton (h).
//
//   eta_H = rho_H * h                         (paper, eq. 6; a definition)
//   asymptote = 136.5 K * sqrt(eta_H)         (Allen-Dynes large-coupling limit, eq. 5, Phi = 1)
//   Tc = Phi * asymptote                      (Phi: efficiency, below one in every solution they computed)
//
// Lines: eta_H = 4.83 eV/A^2 is the floor (300 K at Phi = 1); the band 8.7 to 12 is a single
// Einstein mode at lambda = 4 down to 2 (their Table 2, which I re-solved); the dashed line is
// what 300 K needs at the efficiency on the slider, (300 / (136.5 Phi))^2.
// The vertical line at 0.090 per A^3 is the densest hydrogen they find in a compound stable at
// 1 atm and room temperature (TiH2, Mg2FeH6). The horizontal line at 36.6 eV A is one proton
// in an electron gas (their Table 5).
// Presets: rho_H and eta_H from the paper's Tables 6 and 8 and section on the census; h = eta_H / rho_H.

const K = 136.5
const FLOOR = 4.83

type Preset = { name: string; rho: number; h: number; where: string }

const PRESETS: Preset[] = [
  { name: "census median", rho: 0.057, h: 7.5, where: "the middle of 4,619 hydrides calculated at 1 atm" },
  { name: "PdH", rho: 0.058, h: 7.2, where: "1 atm; exists, superconducts at 8 to 9 K" },
  { name: "Mg₂IrH₆", rho: 0.083, h: 28, where: "1 atm, release value; never made (Mg₂IrH₅ forms)" },
  { name: "KPtH₆", rho: 0.068, h: 82, where: "1 atm; the largest η_H in the census, harmonic, untested" },
  { name: "CaH₆", rho: 0.28, h: 24, where: "150 GPa; measured 215 K at 172 GPa" },
  { name: "LaH₁₀", rho: 0.353, h: 25.2, where: "250 GPa; measured 250 K at 170 GPa" },
  { name: "H₃S", rho: 0.231, h: 43.7, where: "220 GPa; measured 203 K at 155 GPa" },
  { name: "MgH₆", rho: 0.399, h: 33.9, where: "300 GPa; calculated only" },
]

const W = 680
const H = 360
const L = 52
const R = 14
const T = 14
const B = 40
const RHO = [0.01, 0.5]
const HH = [2, 100]

const lx = (rho: number) => L + ((mlog10(rho) - mlog10(RHO[0])) / (mlog10(RHO[1]) - mlog10(RHO[0]))) * (W - L - R)
const ly = (h: number) => T + (1 - (mlog10(h) - mlog10(HH[0])) / (mlog10(HH[1]) - mlog10(HH[0]))) * (H - T - B)

// slider position (0..1000) <-> log value
const toLog = (v: number, lo: number, hi: number) => mpow(10, mlog10(lo) + (v / 1000) * (mlog10(hi) - mlog10(lo)))
const fromLog = (x: number, lo: number, hi: number) => Math.round(((mlog10(x) - mlog10(lo)) / (mlog10(hi) - mlog10(lo))) * 1000)

// the iso-eta curve h = eta / rho, clipped to the frame
function iso(eta: number) {
  const pts: string[] = []
  for (let i = 0; i <= 40; i++) {
    const rho = toLog(i * 25, RHO[0], RHO[1])
    const h = eta / rho
    if (h < HH[0] || h > HH[1]) continue
    pts.push(`${pts.length === 0 ? "M" : "L"}${lx(rho).toFixed(1)},${ly(h).toFixed(1)}`)
  }
  return pts.join("")
}

function band(lo: number, hi: number) {
  const top: string[] = []
  const bot: string[] = []
  for (let i = 0; i <= 40; i++) {
    const rho = toLog(i * 25, RHO[0], RHO[1])
    const a = Math.min(HH[1], Math.max(HH[0], hi / rho))
    const b = Math.min(HH[1], Math.max(HH[0], lo / rho))
    top.push(`${lx(rho).toFixed(1)},${ly(a).toFixed(1)}`)
    bot.unshift(`${lx(rho).toFixed(1)},${ly(b).toFixed(1)}`)
  }
  return `M${top.join("L")}L${bot.join("L")}Z`
}

export function HopfieldBudget() {
  const [rhoV, setRhoV] = useState(fromLog(0.068, RHO[0], RHO[1]))
  const [hV, setHV] = useState(fromLog(82, HH[0], HH[1]))
  const [phi, setPhi] = useState(0.5)

  const rho = toLog(rhoV, RHO[0], RHO[1])
  const h = toLog(hV, HH[0], HH[1])
  const eta = rho * h
  const asym = K * Math.sqrt(eta)
  const tc = phi * asym
  const need = mpow(300 / (K * phi), 2)

  const pick = (p: Preset) => {
    setRhoV(fromLog(p.rho, RHO[0], RHO[1]))
    setHV(fromLog(p.h, HH[0], HH[1]))
  }
  const whatIf = () => {
    setRhoV(fromLog(0.353, RHO[0], RHO[1]))
    setHV(fromLog(82, HH[0], HH[1]))
  }

  const rhoTicks = [0.01, 0.02, 0.05, 0.1, 0.2, 0.5]
  const hTicks = [2, 5, 10, 20, 50, 100]
  const ok = tc >= 300

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        η_H = ρ_H × h · Tc = Φ × 136.5 K × √η_H · move the point, or pick a compound
      </figcaption>
      <div className="mb-2 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button key={p.name} type="button" onClick={() => pick(p)} className="rounded-md border border-border px-2 py-0.5 font-mono text-xs">
            {p.name}
          </button>
        ))}
        <button type="button" onClick={whatIf} className="rounded-md border border-dashed border-border px-2 py-0.5 font-mono text-xs">
          what if: KPtH₆&apos;s h at LaH₁₀&apos;s density
        </button>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Log-log plane of hydrogen density against scattering strength per proton. Curves of constant Hopfield parameter run diagonally down to the right. The shaded band between 8.7 and 12 electron-volts per square angstrom is what a 300 K transition needs with one phonon mode; the floor at 4.83 is the minimum at perfect efficiency. Compounds at one atmosphere sit left of a vertical line at 0.090 atoms per cubic angstrom; the megabar hydrides CaH6, LaH10, H3S and MgH6 sit far to the right, at four to seven times the density, inside or near the band. KPtH6 at one atmosphere has the highest scattering strength, 82, but its density keeps it below the band."
      >
        <path d={band(8.7, 12)} fill="oklch(0.7 0.12 40 / 0.18)" />
        {rhoTicks.map((t) => (
          <g key={t}>
            <line x1={lx(t)} x2={lx(t)} y1={T} y2={H - B} stroke="var(--border)" strokeWidth={0.6} />
            <text x={lx(t)} y={H - B + 14} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
              {t}
            </text>
          </g>
        ))}
        {hTicks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={ly(t)} y2={ly(t)} stroke="var(--border)" strokeWidth={0.6} />
            <text x={L - 6} y={ly(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {t}
            </text>
          </g>
        ))}
        <text x={(L + W - R) / 2} y={H - 6} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
          hydrogen density ρ_H, atoms per Å³ (log)
        </text>
        <text x={12} y={(T + H - B) / 2} fontSize={10} className="fill-muted-foreground font-mono" transform={`rotate(-90 12 ${(T + H - B) / 2})`} textAnchor="middle">
          h, eV Å per proton (log)
        </text>
        <line x1={lx(0.09)} x2={lx(0.09)} y1={T} y2={H - B} stroke="var(--foreground)" strokeWidth={1} strokeDasharray="2 3" opacity={0.6} />
        <text x={lx(0.09) - 4} y={H - B - 6} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
          densest stable at 1 atm, 0.090
        </text>
        <line x1={L} x2={W - R} y1={ly(36.6)} y2={ly(36.6)} stroke="var(--foreground)" strokeWidth={0.8} strokeDasharray="5 3" opacity={0.45} />
        <text x={L + 4} y={ly(36.6) - 4} fontSize={9} className="fill-muted-foreground font-mono">
          one proton in an electron gas, 36.6
        </text>
        <path d={iso(FLOOR)} fill="none" stroke="oklch(0.58 0.2 25)" strokeWidth={1.4} />
        <path d={iso(need)} fill="none" stroke="oklch(0.55 0.15 255)" strokeWidth={1.4} strokeDasharray="6 4" />
        <text x={lx(0.42)} y={ly(Math.min(95, 12 / 0.42)) - 6} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
          8.7 to 12: one mode
        </text>
        {PRESETS.map((p) => (
          <g key={p.name} style={{ cursor: "pointer" }} onClick={() => pick(p)}>
            <circle cx={lx(p.rho)} cy={ly(p.h)} r={3.6} fill={p.rho > 0.2 ? "oklch(0.68 0.15 65)" : "oklch(0.55 0.15 255)"} stroke="var(--background)" />
            <text x={lx(p.rho) + 6} y={ly(p.h) + 3} fontSize={9} className="fill-foreground font-mono">
              {p.name}
            </text>
          </g>
        ))}
        <circle cx={lx(rho)} cy={ly(h)} r={7} fill="none" stroke="var(--foreground)" strokeWidth={2} />
      </svg>

      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="font-mono text-xs">
          ρ_H = {rho.toFixed(3)} Å⁻³
          <Range min={0} max={1000} value={rhoV} onChange={(e) => setRhoV(Number(e.target.value))} aria-label="hydrogen density" className="w-full" />
        </label>
        <label className="font-mono text-xs">
          h = {h.toFixed(1)} eV Å
          <Range min={0} max={1000} value={hV} onChange={(e) => setHV(Number(e.target.value))} aria-label="scattering strength per proton" className="w-full" />
        </label>
        <label className="font-mono text-xs">
          efficiency Φ = {phi.toFixed(2)}
          <Range min={20} max={100} value={Math.round(phi * 100)} onChange={(e) => setPhi(Number(e.target.value) / 100)} aria-label="efficiency" className="w-full" />
        </label>
      </div>
      <div className="mt-2 rounded-md border border-border p-2 font-mono text-xs">
        η_H = {eta.toFixed(2)} eV/Å² · asymptote {Math.round(asym)} K · at Φ {phi.toFixed(2)}:{" "}
        <span style={{ color: ok ? "oklch(0.55 0.16 150)" : "oklch(0.58 0.2 25)" }}>Tc ≈ {Math.round(tc)} K</span> · 300 K at this Φ needs η_H ≥ {need.toFixed(1)}
        <div className="mt-1 text-muted-foreground">
          Published hydride spectra sit at Φ of 0.35 to 0.58; a single mode reaches 0.75 at λ = 4. Red line: the 4.83 floor (Φ = 1). Dashed: what 300 K needs at your Φ.
        </div>
      </div>
    </figure>
  )
}
