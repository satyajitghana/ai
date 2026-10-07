"use client"

import { useState } from "react"

import { mlog, mlog10, mpow } from "@/lib/dmath"

// How wide is the strip next to Re s = 1 in which zeta is known to have no
// zeros, as a function of the height t? Classical theory gives a strip whose
// width shrinks to zero as t grows: 1/(5.558691 log t) (Mossinghoff-Trudgian-
// Yang's explicit de la Vallee Poussin region) and the Vinogradov-Korobov shape
// 1/(57.54 (log t)^(2/3) (log log t)^(1/3)) (Ford 2002), which only overtakes
// the first near log t of about 10,000. The release's family 003 claims a strip
// of fixed width 1/8 at every height (zero-free for Re s > 7/8), with a
// companion claiming 1/12 (Re s > 11/12); RH would give 1/2. Below t = 3e12
// every zero has been checked to lie on the critical line (Platt-Trudgian 2021),
// so the claim only says something new above that height. Both axes are log10.
// The curves are formulas, not data: nothing here is measured.

const W = 720
const H = 300
const L = 62 // left margin
const R = 18
const T = 18
const B = 46
const PW = W - L - R
const PH = H - T - B

const TMIN = 1 // log10 t
const TMAX = 40
const MMIN = -4 // log10 margin
const MMAX = 0

const xOf = (lt: number) => L + ((lt - TMIN) / (TMAX - TMIN)) * PW
const yOf = (lm: number) => T + (1 - (lm - MMIN) / (MMAX - MMIN)) * PH

const LN10 = mlog(10)
const classical = (lt: number) => 1 / (5.558691 * lt * LN10)
const vk = (lt: number) => {
  const lnT = lt * LN10
  return 1 / (57.54 * mpow(lnT, 2 / 3) * mpow(mlog(lnT), 1 / 3))
}

function path(f: (lt: number) => number, from: number) {
  const pts: string[] = []
  for (let i = 0; i <= 120; i++) {
    const lt = from + ((TMAX - from) * i) / 120
    const lm = mlog10(f(lt))
    pts.push(`${i === 0 ? "M" : "L"} ${xOf(lt).toFixed(1)} ${yOf(Math.max(MMIN, lm)).toFixed(1)}`)
  }
  return pts.join(" ")
}

const ACCENT = "oklch(0.62 0.17 45)"
const ACCENT2 = "oklch(0.58 0.12 250)"

const fmtSmall = (x: number) => (x >= 0.01 ? x.toFixed(3) : x.toExponential(2))

export function ZeroFreeMargin() {
  const [lt, setLt] = useState(20)
  const [showCompanion, setShowCompanion] = useState(true)

  const c = classical(lt)
  const v = vk(lt)
  const best = Math.max(c, v)
  const ratio = 0.125 / best
  const verified = lt <= mlog10(3e12)
  const PLATT = mlog10(3e12)

  const hLine = (m: number) => yOf(mlog10(m))

  return (
    <figure className="not-prose my-6 rounded-lg border border-border bg-card p-4 text-sm">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">Width of the zero-free strip next to Re s = 1, by height</div>
        <label className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <input type="checkbox" checked={showCompanion} onChange={(e) => setShowCompanion(e.target.checked)} />
          show the 11/12 companion
        </label>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Log-log plot of zero-free strip width against height: classical curves fall towards zero, the claimed 1/8 is a flat line">
        {/* verified-by-computation band */}
        <rect x={xOf(TMIN)} y={T} width={xOf(PLATT) - xOf(TMIN)} height={PH} fill="var(--muted)" opacity={0.6} />
        <text x={xOf(TMIN) + 6} y={T + 14} fontSize={11} fill="var(--muted-foreground)">
          all zeros checked on Re s = 1/2 up to t = 3·10¹²
        </text>
        {/* axes */}
        <line x1={L} y1={T + PH} x2={L + PW} y2={T + PH} stroke="var(--border)" />
        <line x1={L} y1={T} x2={L} y2={T + PH} stroke="var(--border)" />
        {[1, 10, 20, 30, 40].map((k) => (
          <g key={k}>
            <line x1={xOf(k)} y1={T + PH} x2={xOf(k)} y2={T + PH + 4} stroke="var(--border)" />
            <text x={xOf(k)} y={T + PH + 17} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">
              10^{k}
            </text>
          </g>
        ))}
        <text x={L + PW / 2} y={H - 6} fontSize={11} textAnchor="middle" fill="var(--muted-foreground)">
          height t (log scale)
        </text>
        {[-4, -3, -2, -1, 0].map((k) => (
          <g key={k}>
            <line x1={L - 4} y1={yOf(k)} x2={L} y2={yOf(k)} stroke="var(--border)" />
            <text x={L - 7} y={yOf(k) + 4} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
              {k === 0 ? "1" : `10^${k}`}
            </text>
          </g>
        ))}
        <text x={14} y={T + PH / 2} fontSize={11} fill="var(--muted-foreground)" transform={`rotate(-90 14 ${T + PH / 2})`} textAnchor="middle">
          strip width 1 − σ
        </text>
        {/* RH, claimed, companion */}
        <line x1={L} x2={L + PW} y1={hLine(0.5)} y2={hLine(0.5)} stroke="var(--muted-foreground)" strokeDasharray="4 4" />
        <text x={L + PW - 4} y={hLine(0.5) - 5} fontSize={11} textAnchor="end" fill="var(--muted-foreground)">
          Riemann hypothesis: 1/2 (conjectured)
        </text>
        <line x1={L} x2={L + PW} y1={hLine(0.125)} y2={hLine(0.125)} stroke={ACCENT} strokeWidth={2.5} />
        <text x={L + PW - 4} y={hLine(0.125) - 6} fontSize={11} textAnchor="end" fill={ACCENT}>
          claimed (003): 1/8, i.e. Re s &gt; 7/8
        </text>
        {showCompanion ? (
          <>
            <line x1={L} x2={L + PW} y1={hLine(1 / 12)} y2={hLine(1 / 12)} stroke={ACCENT} strokeWidth={1.5} strokeDasharray="6 3" opacity={0.8} />
            <text x={L + PW - 4} y={hLine(1 / 12) + 14} fontSize={11} textAnchor="end" fill={ACCENT}>
              companion: 1/12, i.e. Re s &gt; 11/12
            </text>
          </>
        ) : null}
        {/* classical curves */}
        <path d={path(classical, TMIN)} fill="none" stroke={ACCENT2} strokeWidth={2} />
        <path d={path(vk, 2)} fill="none" stroke={ACCENT2} strokeWidth={1.5} strokeDasharray="2 3" />
        <text x={xOf(31)} y={yOf(mlog10(classical(31))) - 8} fontSize={11} fill={ACCENT2}>
          1/(5.558691 log t)
        </text>
        <text x={xOf(31)} y={yOf(mlog10(vk(31))) + 16} fontSize={11} fill={ACCENT2}>
          Vinogradov–Korobov shape
        </text>
        {/* cursor */}
        <line x1={xOf(lt)} x2={xOf(lt)} y1={T} y2={T + PH} stroke="var(--foreground)" strokeOpacity={0.35} />
        <circle cx={xOf(lt)} cy={yOf(mlog10(best))} r={4} fill={ACCENT2} />
        <circle cx={xOf(lt)} cy={hLine(0.125)} r={4} fill={ACCENT} />
      </svg>
      <div className="mt-2 flex items-center gap-3">
        <span className="w-28 shrink-0 text-xs text-muted-foreground">height t = 10^{lt}</span>
        <input
          type="range"
          min={TMIN}
          max={TMAX}
          step={1}
          value={lt}
          onChange={(e) => setLt(Number(e.target.value))}
          className="hg-range w-full"
          aria-label="height t, as a power of ten"
          style={{ ["--hg-fill" as string]: `${(((lt - TMIN) / (TMAX - TMIN)) * 100).toFixed(1)}%` }}
        />
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        At t = 10^{lt} the best classical strip has width {fmtSmall(best)}; the claimed strip is 0.125, about{" "}
        {ratio >= 100 ? Math.round(ratio).toLocaleString("en-US") : ratio.toFixed(1)} times wider.
        {verified
          ? " At this height every zero is already known to sit on the critical line, so the claim adds nothing here."
          : " Above 3·10¹² nothing better than the shrinking curve was known."}{" "}
        Curves are the published formulas, plotted; the flat lines are the release&apos;s claims, not verified by us.
      </figcaption>
    </figure>
  )
}
