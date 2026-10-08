"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { macos, mcos, mpow, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// How LayerRoPE builds one layer's norm gain from the shared gain vector.
//
//   gamma_l = gamma (complex-Hadamard) e^{r(l)} e^{i theta(l,j)}
//   r(l)       = alpha_mag + beta_mag log(l+1)          -> multiplier m0 (l+1)^beta_mag
//   theta(l)   = exp(alpha_rot + beta_rot log(l+1))     -> angle t0 (l+1)^beta_rot
//   theta(l,j) = theta(l) * b0^(-2j/d),  b0 = 100       (paper, Section 3 and Appendix D.1)
//
// Channel pair (gamma_2j, gamma_2j+1) is read as one complex number, scaled and
// rotated. The shared gamma is drawn at all-ones (the usual RMSNorm init; the
// paper does not print the learned vector), so pair j becomes
// m * sqrt(2) * (cos(45deg + theta_j), sin(45deg + theta_j)).
//
// Site constants: slopes are printed in the paper's Figures 20 and 21 for the
// 1.3B Pre-Norm + LayerRoPE model; layer-0 multipliers and angles are read off
// those plots by eye. d = 2048 (the 1.3B width, Table 5).
//
// The right panel is measured: LLaMA-2 7B's MLP-input RMSNorm weights
// (post_attention_layernorm, all 32 layers, NousResearch/Llama-2-7b-hf
// safetensors read by HTTP range request). RMS of the gain vector per layer, and
// the true angle in R^4096 between layer l's vector and layer 0's.

type SiteK = { name: string; m0: number; bm: number; t0: number; br: number }

const SITES: SiteK[] = [
  { name: "attention read", m0: 0.75, bm: -0.14, t0: 50, br: -0.77 },
  { name: "attention write", m0: 0.45, bm: 0.76, t0: 41, br: -0.76 },
  { name: "MLP read", m0: 0.78, bm: -0.16, t0: 49, br: -1.09 },
  { name: "MLP write", m0: 0.72, bm: 0.56, t0: 40, br: -0.82 },
]

const D = 2048
const B0 = 100
const PAIRS = [0, 256, 512, 1023] // j, of d/2 = 1024 pairs
const DEG = Math.PI / 180

const LLAMA_RMS = [
  0.056, 0.103, 0.136, 0.172, 0.187, 0.198, 0.212, 0.224, 0.228, 0.234, 0.237, 0.245, 0.252, 0.26, 0.271, 0.281, 0.299,
  0.318, 0.336, 0.347, 0.36, 0.373, 0.387, 0.399, 0.412, 0.424, 0.438, 0.451, 0.461, 0.474, 0.478, 0.428,
]
const LLAMA_ANG = [
  0, 11.0, 11.9, 12.0, 11.7, 11.9, 11.9, 11.8, 11.7, 11.7, 11.8, 11.8, 11.8, 11.8, 11.9, 11.9, 11.9, 12.0, 12.1, 12.0, 12.1,
  12.1, 12.1, 12.1, 12.1, 12.1, 12.0, 12.0, 12.0, 12.0, 11.9, 12.3,
]

function Dial({ j, theta, m, color }: { j: number; theta: number; m: number; color: string }) {
  const R = 46
  const c = 56
  const sc = R / 2.2 // gain units to px; sqrt(2)*m up to ~2.2 shown
  const phi = (45 + theta) * DEG
  const len = Math.min(Math.SQRT2 * m, 2.2)
  const x = c + len * sc * mcos(phi)
  const yv = c - len * sc * msin(phi)
  const x0 = c + Math.SQRT2 * sc * mcos(45 * DEG)
  const y0 = c - Math.SQRT2 * sc * msin(45 * DEG)
  const g0 = Math.SQRT2 * m * mcos(phi)
  const g1 = Math.SQRT2 * m * msin(phi)
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox="0 0 112 112" className="w-24" role="img" aria-label={`pair ${j} rotated ${theta.toFixed(1)} degrees`}>
        <circle cx={c} cy={c} r={R} fill="none" stroke="var(--border)" />
        <line x1={c - R} x2={c + R} y1={c} y2={c} stroke="var(--border)" />
        <line x1={c} x2={c} y1={c - R} y2={c + R} stroke="var(--border)" />
        <line x1={c} y1={c} x2={x0} y2={y0} stroke="var(--muted-foreground)" strokeDasharray="2 2" />
        <line x1={c} y1={c} x2={x} y2={yv} stroke={color} strokeWidth={2.4} strokeLinecap="round" />
        <circle cx={x} cy={yv} r={3} fill={color} />
      </svg>
      <span className="font-mono text-[10px] text-muted-foreground">pair j={j}</span>
      <span className="font-mono text-[10px] tabular-nums text-foreground">&theta;={theta.toFixed(1)}&deg;</span>
      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
        gains {g0.toFixed(2)}, {g1.toFixed(2)}
      </span>
    </div>
  )
}

export function GainRotor() {
  const [site, setSite] = useState(2)
  const [l, setL] = useState(0)
  const s = SITES[site]

  const m = s.m0 * mpow(l + 1, s.bm)
  const thL = s.t0 * mpow(l + 1, s.br)
  const thj = (j: number) => thL * mpow(B0, (-2 * j) / D)

  // angle between gamma_l and the shared gamma (all-ones) in R^d: arccos(mean_j cos theta_j)
  const vecAngle = useMemo(() => {
    let acc = 0
    for (let j = 0; j < D / 2; j++) acc += mcos(thL * mpow(B0, (-2 * j) / D) * DEG)
    return macos(acc / (D / 2)) / DEG
  }, [thL])

  const accent = "oklch(0.58 0.2 20)"

  // LLaMA panel geometry
  const PW = 300
  const PH = 150
  const px = (i: number) => 30 + (i / 31) * (PW - 40)
  const pyR = (v: number) => 120 - (v / 0.5) * 100
  const pyA = (a: number) => 120 - (a / 15) * 100
  let dR = ""
  let dA = ""
  LLAMA_RMS.forEach((v, i) => (dR += (i ? "L " : "M ") + px(i).toFixed(1) + " " + pyR(v).toFixed(1) + " "))
  LLAMA_ANG.forEach((v, i) => (dA += (i ? "L " : "M ") + px(i).toFixed(1) + " " + pyA(v).toFixed(1) + " "))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1.5 border-b px-4 py-2.5">
        <span className="mr-2 font-mono text-xs text-muted-foreground">LayerRoPE gain at</span>
        {SITES.map((st, i) => (
          <button
            key={st.name}
            type="button"
            onClick={() => setSite(i)}
            aria-pressed={site === i}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              site === i ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {st.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-3 sm:p-4 md:grid-cols-[1fr_auto]">
        <div className="space-y-3">
          <div className="flex flex-wrap justify-around gap-2">
            {PAIRS.map((j) => (
              <Dial key={j} j={j} theta={thj(j)} m={m} color={accent} />
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px] text-muted-foreground">layer</span>
            <Range min={0} max={23} step={1} value={l} onChange={(e) => setL(Number((e.target as HTMLInputElement).value))} aria-label="layer" className="grow" accent={accent} />
            <span className="w-8 shrink-0 text-right font-mono text-[11px] tabular-nums">{l}</span>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-[11px] tabular-nums sm:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
              <div className="text-muted-foreground">magnitude e^r</div>
              <div className="text-foreground">{m.toFixed(3)}</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
              <div className="text-muted-foreground">base angle &theta;(l)</div>
              <div className="text-foreground">{thL.toFixed(1)}&deg;</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
              <div className="text-muted-foreground">angle of &gamma;_l vs &gamma;</div>
              <div className="text-foreground">{vecAngle.toFixed(1)}&deg;</div>
            </div>
            <div className="rounded-lg border bg-muted/20 px-2 py-1.5">
              <div className="text-muted-foreground">slopes mag / rot</div>
              <div className="text-foreground">
                {s.bm >= 0 ? "+" : ""}
                {s.bm} / {s.br}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="font-mono text-[11px] text-muted-foreground">measured: LLaMA-2 7B, MLP-input norm</div>
          <svg viewBox={`0 0 ${PW} ${PH}`} className="w-full max-w-[300px]" role="img" aria-label="LLaMA-2 7B MLP norm gain RMS and angle to layer 0 across 32 layers">
            {[0, 0.25, 0.5].map((g) => (
              <g key={g}>
                <line x1={30} x2={PW - 10} y1={pyR(g)} y2={pyR(g)} stroke="var(--border)" strokeDasharray="2 3" />
                <text x={26} y={pyR(g) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                  {g}
                </text>
              </g>
            ))}
            <text x={PW - 8} y={pyA(15) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
              15&deg;
            </text>
            <path d={dR} fill="none" stroke="oklch(0.55 0.13 245)" strokeWidth={2} />
            <path d={dA} fill="none" stroke={accent} strokeWidth={2} strokeDasharray="4 2" />
            <text x={px(16)} y={pyR(0.3) - 8} className="fill-muted-foreground font-mono text-[9px]">
              RMS of &gamma;_l
            </text>
            <text x={px(9)} y={pyA(12) - 6} className="fill-muted-foreground font-mono text-[9px]">
              angle to layer 0
            </text>
            {[0, 8, 16, 24, 31].map((i) => (
              <text key={i} x={px(i)} y={136} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
                {i}
              </text>
            ))}
          </svg>
          <div className="max-w-[300px] text-[11px] leading-snug text-muted-foreground">
            RMS grows about 8&times; and fits (l+1)<sup>0.55</sup>; the direction turns 11&deg; from layer 0 to 1 and
            barely moves after that (12.3&deg; at most, between any pair of layers).
          </div>
        </div>

        <p className="text-[12px] leading-snug text-muted-foreground md:col-span-2">
          Each dial is one channel pair of the shared gain, drawn from all-ones (dashed). LayerRoPE scales every pair by
          the same e<sup>r(l)</sup> and rotates pair j by &theta;(l)&middot;100<sup>&minus;2j/d</sup>, so the first
          pair turns by the full base angle and the last by about a hundredth of it. Rotating (1, 1) moves gain from
          one channel of the pair to the other; past 45&deg; the first channel&apos;s gain goes negative. Slopes are
          the paper&apos;s learned 1.3B values (Figures 20 and 21); layer-0 values are read off those plots.
        </p>
      </div>
    </figure>
  )
}
