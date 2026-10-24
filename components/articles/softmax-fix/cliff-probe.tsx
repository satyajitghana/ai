"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mexp, mlog, mlog10, mlog1p } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Softmax Collapse, computed in your browser one rounding at a time.
//
// Three classes, target logit 0, two non-target logits at -(m + ln 2), so the
// logit margin m = z_t - LSE_{j != t} z_j is exactly the slider value. Every
// arithmetic step is rounded to the chosen format: fp32 with Math.fround,
// bf16 by rounding an fp32 to its top 16 bits (round to nearest even), fp64 by
// doing nothing. The standard path is the textbook one: shift by the max,
// sum the exponentials left to right starting from e^0 = 1, then q_t = 1/sum
// and g_t = q_t - 1. The fixed path never forms 1 + e^-m: the loss is
// softplus(-m), each non-target gradient is exp(z_j - z_t - loss), and the
// target gradient is minus their sum. Summing left to right is also what
// PyTorch's CPU kernel measured as for three classes (cliff 15.95 in fp32).

type Fmt = "bf16" | "fp32" | "fp64"

const F32 = new Float32Array(1)
const U32 = new Uint32Array(F32.buffer)

function bf16(x: number): number {
  if (!Number.isFinite(x) || x === 0) return x
  F32[0] = x
  const u = U32[0]
  const lsb = (u >>> 16) & 1
  U32[0] = ((u + 0x7fff + lsb) >>> 16) << 16
  return F32[0]
}

const R: Record<Fmt, (x: number) => number> = {
  bf16: (x) => bf16(Math.fround(x)),
  fp32: (x) => Math.fround(x),
  fp64: (x) => x,
}

const LN2 = 0.6931471805599453
const EPS = 1e-8

type Result = { loss: number; gt: number; gj: number; sum: number }

function standard(m: number, f: Fmt): Result {
  const r = R[f]
  const a = r(mexp(r(-(m + LN2)))) // e^{z_j - z_max}, each non-target
  const denom = r(r(1 + a) + a) // 1 + a + a, left to right
  const qt = r(1 / denom)
  const gt = r(qt - 1)
  const gj = r(a / denom)
  const loss = r(mlog(denom))
  const sum = r(r(gt + gj) + gj)
  return { loss: Math.abs(loss), gt, gj, sum }
}

function fixed(m: number, f: Fmt): Result {
  const r = R[f]
  const o = r(-(m + LN2)) // z_j - z_t, both non-targets equal
  // LSE over the non-targets: max + log(sum exp(o - max)) = o + log 2
  const lse = r(o + r(mlog(2)))
  const mm = r(-lse)
  const loss = r(mlog1p(r(mexp(r(-mm))))) // softplus(-m)
  const gj = r(mexp(r(r(o) - loss)))
  const gt = r(-r(gj + gj))
  const sum = r(r(gt + gj) + gj)
  return { loss, gt, gj, sum }
}

// The paper's c_d: where 1 + e^-m rounds to 1 (ln 2^8, ln 2^24, ln 2^53).
const CLIFF: Record<Fmt, number> = { bf16: 5.55, fp32: 16.64, fp64: 36.74 }

function firstZero(f: Fmt): number {
  for (let i = 0; i <= 900; i++) {
    if (standard(i / 20, f).gt === 0) return i / 20
  }
  return 45
}

function fmt(x: number): string {
  if (x === 0) return "0"
  return x.toExponential(3)
}

const STD = "oklch(0.66 0.17 40)"
const FIX = "oklch(0.60 0.15 255)"

export function CliffProbe() {
  const [m, setM] = useState(17.3)
  const [f, setF] = useState<Fmt>("fp32")

  const s = standard(m, f)
  const x = fixed(m, f)
  const stepStd = Math.abs(s.gt) / (Math.abs(s.gt) + EPS)
  const stepFix = Math.abs(x.gt) / (Math.abs(x.gt) + EPS)

  // |g_t| on a log axis from m = 0 to 45, both paths, in the chosen format.
  const W = 640
  const H = 190
  const PL = 44
  const PR = 12
  const PT = 10
  const PB = 26
  const MMAX = 45
  const YMIN = -20
  const sx = (v: number) => PL + (v / MMAX) * (W - PL - PR)
  const sy = (lg: number) => PT + ((0 - Math.max(YMIN, lg)) / (0 - YMIN)) * (H - PT - PB)

  const here = useMemo(() => firstZero(f), [f])

  const paths = useMemo(() => {
    const std: string[] = []
    const fix: string[] = []
    let penUp = true
    for (let i = 0; i <= 450; i++) {
      const mv = i / 10
      const a = Math.abs(standard(mv, f).gt)
      const b = Math.abs(fixed(mv, f).gt)
      const ya = a > 0 ? sy(mlog10(a)) : sy(YMIN)
      std.push(`${penUp ? "M" : "L"}${sx(mv).toFixed(1)},${ya.toFixed(1)}`)
      penUp = false
      fix.push(`${i === 0 ? "M" : "L"}${sx(mv).toFixed(1)},${(b > 0 ? sy(mlog10(b)) : sy(YMIN)).toFixed(1)}`)
    }
    return { std: std.join(""), fix: fix.join("") }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [f])

  const rows: { k: string; a: string; b: string }[] = [
    { k: "loss  −log q_t", a: fmt(s.loss), b: fmt(x.loss) },
    { k: "g_t  (target)", a: fmt(s.gt), b: fmt(x.gt) },
    { k: "g_j  (each other)", a: fmt(s.gj), b: fmt(x.gj) },
    { k: "Σ g  (should be 0)", a: fmt(s.sum), b: fmt(x.sum) },
    { k: "Adam step |g_t|/(|g_t|+ε)", a: stepStd.toFixed(3), b: stepFix.toFixed(3) },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">three classes, every operation rounded to {f}</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          paper&apos;s c ≈ {CLIFF[f]} · this sum hits 0 at m = {here.toFixed(2)}
        </span>
      </div>
      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          {(["bf16", "fp32", "fp64"] as Fmt[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setF(k)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                f === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {k}
            </button>
          ))}
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <span className="shrink-0 font-mono text-[10px] text-muted-foreground">margin m</span>
            <Range min={0} max={45} step={0.05} value={m} onChange={(e) => setM(Number(e.target.value))} className="flex-1" aria-label="logit margin" accent={FIX} />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{m.toFixed(2)}</span>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full" role="img" aria-label={`Target-logit gradient magnitude against logit margin in ${f}: the standard path drops to exactly zero at ${here.toFixed(2)}, the fixed path keeps decaying as e to the minus m`}>
          {[0, -5, -10, -15, -20].map((t) => (
            <g key={t}>
              <line x1={PL} x2={W - PR} y1={sy(t)} y2={sy(t)} className="stroke-border" strokeWidth="0.6" />
              <text x={PL - 6} y={sy(t) + 3} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {t === -20 ? "0 / tiny" : `1e${t}`}
              </text>
            </g>
          ))}
          {[0, 10, 20, 30, 40].map((t) => (
            <text key={t} x={sx(t)} y={H - 8} textAnchor="middle" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
              {t}
            </text>
          ))}
          <line x1={sx(here)} x2={sx(here)} y1={PT} y2={H - PB} stroke={STD} strokeDasharray="3 3" strokeWidth="1" />
          <line x1={sx(18.42)} x2={sx(18.42)} y1={PT} y2={H - PB} className="stroke-muted-foreground" strokeDasharray="1 3" strokeWidth="1" />
          <text x={sx(18.42) + 3} y={PT + 9} className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
            log(1/ε) = 18.42
          </text>
          <path d={paths.fix} fill="none" stroke={FIX} strokeWidth="2.4" />
          <path d={paths.std} fill="none" stroke={STD} strokeWidth="1.6" />
          <line x1={sx(m)} x2={sx(m)} y1={PT} y2={H - PB} className="stroke-foreground" strokeWidth="1" opacity="0.6" />
          <text x={W - PR} y={H - 8} textAnchor="end" className="fill-muted-foreground" style={{ fontSize: 9, fontFamily: "var(--font-mono)" }}>
            margin m →
          </text>
        </svg>
        <div className="mt-1 flex flex-wrap gap-3 font-mono text-[9px] text-muted-foreground">
          <span style={{ color: STD }}>— standard: q_t − 1</span>
          <span style={{ color: FIX }}>— fixed: −e^(−m) / (1 + e^(−m))</span>
          <span>y axis: |g_t|, log scale</span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] font-mono text-[11px]">
            <thead>
              <tr className="text-muted-foreground">
                <th className="py-1 text-left font-normal">at m = {m.toFixed(2)}, {f}</th>
                <th className="py-1 text-right font-normal" style={{ color: STD }}>standard</th>
                <th className="py-1 text-right font-normal" style={{ color: FIX }}>fixed</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.k} className="border-t border-border/60">
                  <td className="py-1 text-muted-foreground">{r.k}</td>
                  <td className="py-1 text-right tabular-nums">{r.a}</td>
                  <td className="py-1 text-right tabular-nums">{r.b}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Past the cliff the standard target gradient is exactly zero while the other two stay positive, so the
          row no longer sums to zero and Adam&apos;s normalised step for that logit falls from about 1 to 0 in one
          rounding. The fixed column never adds 1 to e^(−m), so its step fades smoothly near log(1/ε) instead.
        </p>
      </div>
    </figure>
  )
}
