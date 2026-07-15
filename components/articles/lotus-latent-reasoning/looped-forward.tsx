"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// LOTUS's core move, drawn as a diagram. A padded latent region — K blocks of c
// learnable ⟨lat⟩ tokens between ⟨BoT⟩ and ⟨EoT⟩ — is pushed through the SAME base
// LM f_θ for R iterations: h^(t) = f_θ(E + h^(t-1) | Q). Every block is refined in
// PARALLEL on each pass, so the whole reasoning trace takes R sequential passes, not
// one-per-token. At the final iteration the base LM head reads each latent position
// out to its gold CoT-step token (the parallel supervision). Scrub the iteration and
// watch the latents sharpen, then read out. Illustrative tokens.

const ACCENT = "oklch(0.58 0.16 300)" // lotus violet
const GOLD = "oklch(0.72 0.14 70)" // readout warm
const R = 6
const K = 6

// one short, illustrative gold CoT chain — one step per block
const STEPS = ["24 + 18", "= 42", "42 × 3", "= 126", "126 − 6", "= 120"]

const W = 760
const H = 360
const MX = 40
const AREA = W - 2 * MX
const BW = 96
const GAP = (AREA - K * BW) / (K - 1)
const bx = (i: number) => MX + i * (BW + GAP)
const cxb = (i: number) => bx(i) + BW / 2

const GOLD_Y = 40
const GOLD_H = 30
const HID_Y = 128
const HID_H = 40
const F_Y = 210
const F_H = 42
const IN_Y = 292
const IN_H = 30

function up(x1: number, y1: number, x2: number, y2: number) {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function LoopedForward() {
  const [t, setT] = useState(3)

  const revealed = t >= R
  // refinement: faint at t=0, full at t=R
  const sharp = 0.14 + 0.86 * (t / R)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>looped padded transformer · one thought phase</span>
        <span className="text-muted-foreground/50">illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`K=${K} latent blocks refined in parallel over R=${R} iterations of the base LM, then read out to gold chain-of-thought tokens; currently at iteration ${t}`}
        >
          <defs>
            <marker id="lf-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="lf-arrow-gold" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={GOLD} strokeWidth={1.5} />
            </marker>
            <marker id="lf-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="lf-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* row labels */}
          <text x={MX} y={26} className="fill-muted-foreground font-mono" fontSize={11}>
            gold CoT step tokens (one step per block)
          </text>

          {/* readout connectors: hidden -> gold, only at final iteration */}
          {revealed &&
            Array.from({ length: K }, (_, i) => (
              <path
                key={`ro-${i}`}
                d={up(cxb(i), HID_Y, cxb(i), GOLD_Y + GOLD_H)}
                fill="none"
                stroke={GOLD}
                strokeWidth={1.5}
                markerEnd="url(#lf-arrow-gold)"
                opacity={0.9}
              />
            ))}

          {/* gold CoT tokens */}
          {Array.from({ length: K }, (_, i) => (
            <g key={`g-${i}`} opacity={revealed ? 1 : 0.18} className="transition-opacity duration-300">
              <rect x={bx(i)} y={GOLD_Y} width={BW} height={GOLD_H} rx={7} fill="var(--muted)" stroke={revealed ? GOLD : "var(--border)"} strokeWidth={1.5} filter={revealed ? "url(#lf-soft)" : undefined} />
              <text x={cxb(i)} y={GOLD_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>
                {revealed ? STEPS[i] : "?"}
              </text>
            </g>
          ))}

          {/* f_head label */}
          <text x={MX} y={HID_Y - 12} className="fill-muted-foreground font-mono" fontSize={10}>
            {revealed ? "f_head reads each position → gold token" : "latent hidden states h(t) · refined in parallel"}
          </text>

          {/* hidden-state blocks h^(t) */}
          {Array.from({ length: K }, (_, i) => (
            <g key={`h-${i}`}>
              <rect x={bx(i)} y={HID_Y} width={BW} height={HID_H} rx={7} fill={ACCENT} opacity={sharp} stroke={ACCENT} strokeWidth={1.5} filter="url(#lf-soft)" className="transition-all duration-300" />
              {/* c sub-cells hint */}
              {Array.from({ length: 5 }, (_, j) => (
                <rect key={j} x={bx(i) + 8 + j * ((BW - 16) / 5)} y={HID_Y + 8} width={(BW - 16) / 5 - 3} height={HID_H - 16} rx={2} fill="var(--background)" opacity={0.25 + 0.5 * (t / R)} />
              ))}
              <text x={cxb(i)} y={HID_Y + HID_H + 12} textAnchor="middle" className="fill-muted-foreground/70 font-mono" fontSize={8}>
                block {i + 1} · c=25
              </text>
            </g>
          ))}

          {/* connectors: f_theta -> hidden */}
          {Array.from({ length: K }, (_, i) => (
            <path key={`fh-${i}`} d={up(cxb(i), F_Y, cxb(i), HID_Y + HID_H)} fill="none" stroke={ACCENT} strokeWidth={1.4} markerEnd="url(#lf-arrow)" opacity={0.5} />
          ))}

          {/* base LM f_theta */}
          <g>
            <rect x={MX} y={F_Y} width={AREA} height={F_H} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#lf-soft)" />
            <text x={W / 2} y={F_Y + 26} textAnchor="middle" className="fill-foreground font-mono" fontSize={13} fontWeight={600}>
              base LM  f_θ   (weights reused every pass)
            </text>
          </g>

          {/* loop-back arrow on the left: hidden -> back into f_theta */}
          <path
            d={`M ${MX - 10} ${HID_Y + HID_H / 2} C ${MX - 34} ${HID_Y + 30}, ${MX - 34} ${F_Y - 6}, ${MX - 10} ${F_Y + F_H / 2}`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.6}
            markerEnd="url(#lf-arrow)"
            opacity={0.75}
          />
          <text x={MX - 30} y={(HID_Y + HID_H / 2 + F_Y + F_H / 2) / 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600} transform={`rotate(-90 ${MX - 30} ${(HID_Y + HID_H / 2 + F_Y + F_H / 2) / 2})`} style={{ fill: ACCENT }}>
            ×R
          </text>

          {/* connectors: input -> f_theta */}
          {[0, 1, 2, 3, 4].map((i) => {
            const cols = [MX + 24, MX + 90, W / 2 - 10, W - MX - 90, W - MX - 24]
            return <path key={`if-${i}`} d={up(cols[i], IN_Y, cols[i], F_Y + F_H)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} markerEnd="url(#lf-arrow-mut)" opacity={0.4} />
          })}

          {/* input sequence */}
          {[
            { x: MX, w: 48, label: "Q" },
            { x: MX + 62, w: 52, label: "BoT" },
            { x: W / 2 - 70, w: 140, label: "⟨lat⟩ … K·c", muted: true },
            { x: W - MX - 114, w: 52, label: "EoT" },
            { x: W - MX - 52, w: 52, label: "A" },
          ].map((n, i) => (
            <g key={`in-${i}`}>
              <rect x={n.x} y={IN_Y} width={n.w} height={IN_H} rx={6} fill="var(--muted)" opacity={n.muted ? 0.55 : 0.85} stroke="var(--border)" strokeWidth={1} />
              <text x={n.x + n.w / 2} y={IN_Y + 19} textAnchor="middle" className="fill-foreground font-mono" fontSize={10}>
                {n.label}
              </text>
            </g>
          ))}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="font-mono text-[11px] text-muted-foreground">
            iteration <span style={{ color: ACCENT }}>t = {t}</span> of R = {R}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            forward passes so far: <span style={{ color: ACCENT }}>{t}</span> · positions per pass:{" "}
            <span className="text-foreground">{K}×25 = 150</span>
          </div>
        </div>

        <div className="mt-3">
          <div className="mb-1 font-mono text-[10px] text-muted-foreground">loop iteration (drag to t = R for readout)</div>
          <input type="range" min={0} max={R} value={t} onChange={(e) => setT(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.58_0.16_300)]" />
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The reasoning trace is not decoded token-by-token. All <span className="text-foreground">{K}×25 = 150</span> latent
          positions are refined <span style={{ color: ACCENT }}>together</span> on every pass, and the whole thought phase is
          just <span style={{ color: ACCENT }}>R = {R}</span> loops of the same weights. At the final iteration the base LM head
          reads each position out to its <span style={{ color: GOLD }}>gold CoT-step token</span> — that readout is exactly what
          the step loss supervises.
        </p>
      </div>
    </figure>
  )
}
