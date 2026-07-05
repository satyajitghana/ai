"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where the compute budget goes, made draggable. The native sampler spends its whole
// budget on full-resolution diffusion steps. MrFlow re-allocates: most steps at low
// resolution (cheap structure), a single pixel-space SR pass for the resolution climb,
// and a few high-resolution refine steps (polish). Drag the (n_lr, n_hr) config and watch
// total compute — and the honest quality tradeoff — move. Compute is schematic: an HR
// step ≈ 4× an LR step at 2× linear resolution; SR ≈ 1 LR step. Speedup is the honest
// derived number; the quality note is qualitative, not a benchmarked score.

const LR_C = "oklch(0.66 0.14 155)" // low-res diffusion (latent)
const SR_C = "oklch(0.70 0.15 55)" // pixel SR
const HR_C = "oklch(0.55 0.16 200)" // high-res refine
const NAT_C = "oklch(0.55 0.03 260)" // native full-res steps

const LR_COST = 1
const SR_COST = 1
const HR_COST = 4
const NATIVE_STEPS = 20
const NATIVE = NATIVE_STEPS * HR_COST // 80

// ── geometry ──
const W = 680
const H = 210
const X0 = 34
const UPX = (W - X0 - 12) / NATIVE // px per compute unit
const BH = 30
const NAT_Y = 52
const MRF_Y = 128

function divisions(x: number, y: number, w: number, step: number, color: string) {
  const lines: React.ReactNode[] = []
  for (let cx = x + step; cx < x + w - 0.5; cx += step) {
    lines.push(<line key={cx} x1={cx} y1={y} x2={cx} y2={y + BH} stroke={color} strokeWidth={0.8} opacity={0.35} />)
  }
  return lines
}

export function ConfigSplit() {
  const [nLr, setNLr] = useState(12)
  const [nHr, setNHr] = useState(1)

  const cost = nLr * LR_COST + SR_COST + nHr * HR_COST
  const speedup = NATIVE / cost

  const lrW = nLr * LR_COST * UPX
  const srW = SR_COST * UPX
  const hrW = nHr * HR_COST * UPX

  // qualitative, honest quality read
  const undercooked = nLr < 8
  const unrefined = nHr === 0
  const quality =
    unrefined
      ? { tone: "warn", text: "no HR refine — SR artifacts left uncleaned" }
      : undercooked
        ? { tone: "warn", text: "too few LR steps — structure undercooked" }
        : nHr >= 2 && nLr >= 12
          ? { tone: "good", text: "conservative — closest to native quality" }
          : { tone: "ok", text: "balanced — near native on forgiving models" }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the budget · (n_lr, n_hr) config</span>
        <span className="text-muted-foreground/60">compute schematic · illustrative</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="mb-3 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
          <div>
            <div className="font-mono text-[10px] text-muted-foreground">config ({nLr}, {nHr})</div>
            <div className="font-mono text-2xl font-semibold tabular-nums text-foreground">{cost}u</div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[10px] text-muted-foreground">vs native {NATIVE}u</div>
            <div className="font-mono text-2xl font-semibold tabular-nums" style={{ color: HR_C }}>{speedup.toFixed(1)}×</div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Native uses 20 full-resolution steps for 80 compute units; MrFlow config ${nLr}, ${nHr} uses ${cost} units for a ${speedup.toFixed(1)}× speedup.`}>
          <defs>
            <filter id="cs-soft" x="-20%" y="-40%" width="140%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.2" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* native track */}
          <text x={X0} y={NAT_Y - 8} className="fill-muted-foreground font-mono" fontSize={10}>native · 20 full-resolution steps</text>
          <rect x={X0} y={NAT_Y} width={NATIVE * UPX} height={BH} rx={6} fill={NAT_C} opacity={0.22} stroke={NAT_C} strokeWidth={1} />
          {divisions(X0, NAT_Y, NATIVE * UPX, HR_COST * UPX, NAT_C)}
          <text x={X0 + NATIVE * UPX + 6} y={NAT_Y + BH / 2 + 3} className="font-mono" fontSize={10} fontWeight={600} style={{ fill: NAT_C }}>80u</text>

          {/* MrFlow track */}
          <text x={X0} y={MRF_Y - 8} className="fill-muted-foreground font-mono" fontSize={10}>MrFlow · {nLr} LR steps + SR + {nHr} HR step{nHr === 1 ? "" : "s"}</text>
          {/* LR segment */}
          <g filter="url(#cs-soft)">
            <rect x={X0} y={MRF_Y} width={lrW} height={BH} rx={5} fill={LR_C} opacity={0.85} />
          </g>
          {divisions(X0, MRF_Y, lrW, LR_COST * UPX, "var(--background)")}
          {/* SR segment */}
          <rect x={X0 + lrW + 2} y={MRF_Y} width={srW} height={BH} rx={3} fill={SR_C} opacity={0.9} filter="url(#cs-soft)" />
          {/* HR segment */}
          {hrW > 0 && (
            <>
              <rect x={X0 + lrW + srW + 4} y={MRF_Y} width={hrW} height={BH} rx={5} fill={HR_C} opacity={0.9} filter="url(#cs-soft)" />
              {divisions(X0 + lrW + srW + 4, MRF_Y, hrW, HR_COST * UPX, "var(--background)")}
            </>
          )}
          <text x={X0 + lrW + srW + hrW + (hrW > 0 ? 4 : 2) + 6} y={MRF_Y + BH / 2 + 3} className="font-mono" fontSize={10} fontWeight={600} style={{ fill: HR_C }}>{cost}u</text>

          {/* segment role labels */}
          <text x={X0 + lrW / 2} y={MRF_Y + BH + 15} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: LR_C }}>structure (LR)</text>
          <text x={X0 + lrW + srW / 2} y={MRF_Y + BH + 27} textAnchor="middle" className="font-mono" fontSize={8} style={{ fill: SR_C }}>SR</text>
          {hrW > 0 && (
            <text x={X0 + lrW + srW + 4 + hrW / 2} y={MRF_Y + BH + 15} textAnchor="middle" className="font-mono" fontSize={9} style={{ fill: HR_C }}>polish (HR)</text>
          )}
        </svg>

        {/* controls */}
        <div className="mt-2 space-y-3">
          <div>
            <div className="mb-1 flex items-center justify-between font-mono text-[10px] text-muted-foreground">
              <span>n_lr · low-res steps</span>
              <span className="text-foreground">{nLr}</span>
            </div>
            <input type="range" min={4} max={16} value={nLr} onChange={(e) => setNLr(Number(e.target.value))} className="w-full cursor-pointer accent-[oklch(0.66_0.14_155)]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">n_hr · refine steps</span>
            {[0, 1, 2, 3].map((h) => (
              <button key={h} type="button" onClick={() => setNHr(h)} aria-pressed={nHr === h}
                className={cn("cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors", nHr === h ? "border-foreground/40 text-foreground" : "text-muted-foreground hover:text-foreground")}>
                {h}
              </button>
            ))}
            <span className={cn("ml-auto rounded-md px-2 py-1 font-mono text-[10px]", quality.tone === "warn" ? "text-destructive" : quality.tone === "good" ? "text-foreground" : "text-muted-foreground")}>
              {quality.text}
            </span>
          </div>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Speedup is the honest part: fewer, cheaper steps mean less compute, full stop. Quality is the
          <span className="text-foreground"> config-dependent</span> part. Strip the refine steps to zero and the SR
          network&apos;s artifacts survive; starve the LR stage and the composition never sets. The advertised
          &ldquo;within 1% of native&rdquo; lives at the conservative end of this slider — the aggressive end is where
          the real degradation shows up.
        </p>
      </div>
    </figure>
  )
}
