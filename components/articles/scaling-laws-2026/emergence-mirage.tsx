"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// One model, one smooth climb, two scorecards.
//
// Wei et al. (arXiv:2206.07682) reported abilities that are absent in small
// models and appear abruptly past a scale threshold. Schaeffer, Miranda and
// Koyejo (arXiv:2304.15004) pointed out that an all-or-nothing metric
// manufactures exactly that shape out of a smooth underlying improvement: if a
// task needs k tokens all correct and per-token accuracy p rises smoothly, the
// score p^k stays pinned near zero and then leaps.
//
// Nothing here is fitted to a real eval. Per-token accuracy is a smooth curve
// in log-compute by construction, which is the point: the cliff below is
// produced entirely by the grading, from an input that never jumps.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"

export function EmergenceMirage() {
  const [k, setK] = useState(24)
  const [tokenAcc, setTokenAcc] = useState(true)

  const W = 700
  const H = 200
  const X0 = 52
  const X1 = 660
  const Y0 = 18
  const Y1 = 158
  const LO = 18 // 10^18 FLOPs
  const HI = 26

  // per-token accuracy: a smooth, unremarkable climb in log-compute
  // The ceiling matters: if per-token accuracy tops out at 0.96 then p^24 tops
  // out at 0.38 and the all-or-nothing curve never gets to show its cliff.
  const p = (logc: number) => 0.30 + 0.698 / (1 + mpow(10, -(logc - 22.0) * 0.85))
  const exact = (logc: number) => mpow(p(logc), k)

  const PX = (logc: number) => X0 + ((logc - LO) / (HI - LO)) * (X1 - X0)
  const PY = (v: number) => Y1 - v * (Y1 - Y0)

  const line = (f: (l: number) => number) => {
    let d = ""
    for (let i = 0; i <= 120; i++) {
      const lc = LO + ((HI - LO) * i) / 120
      d += `${i === 0 ? "M" : "L"} ${PX(lc).toFixed(2)} ${PY(f(lc)).toFixed(2)} `
    }
    return d
  }

  // where the all-or-nothing score crosses 5% and 50% — the apparent "threshold"
  const crossing = (target: number) => {
    for (let i = 0; i <= 400; i++) {
      const lc = LO + ((HI - LO) * i) / 400
      if (exact(lc) >= target) return lc
    }
    return null
  }
  const c05 = crossing(0.05)
  const c50 = crossing(0.5)
  const width = c05 !== null && c50 !== null ? c50 - c05 : null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          per-token accuracy p, and the all-or-nothing score p<sup>k</sup>
        </span>
        <span className="font-mono text-[10px]" style={{ color: WARM }}>
          {width !== null ? `5% → 50% inside ${width.toFixed(1)} orders of magnitude` : "never reaches 50%"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              Two curves against training compute. The per-token accuracy rises as a smooth ramp
              across the whole range. The all-or-nothing score, which requires every one of k tokens
              to be right, stays flat near zero and then rises steeply — from the same underlying
              curve.
            </title>

            <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.25} />
            {[0, 0.5, 1].map((v) => (
              <g key={v}>
                <line x1={X0 - 4} y1={PY(v)} x2={X1} y2={PY(v)} stroke="currentColor" strokeOpacity={0.1} />
                <text x={X0 - 7} y={PY(v) + 3} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
                  {v.toFixed(1)}
                </text>
              </g>
            ))}
            {Array.from({ length: HI - LO + 1 }, (_, i) => LO + i).map((lc) => (
              <g key={lc}>
                <line x1={PX(lc)} y1={Y1} x2={PX(lc)} y2={Y1 + 4} stroke="currentColor" strokeOpacity={0.25} />
                <text x={PX(lc)} y={Y1 + 14} fontSize={7.5} textAnchor="middle" fill="currentColor" fillOpacity={0.4} fontFamily="ui-monospace, monospace">
                  10<tspan fontSize={6} dy={-3}>{lc}</tspan>
                </text>
              </g>
            ))}
            <text x={(X0 + X1) / 2} y={H - 4} fontSize={8.5} textAnchor="middle" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              training compute (FLOPs)
            </text>

            {tokenAcc ? (
              <>
                <path d={line(p)} fill="none" stroke={GOOD} strokeWidth={2.2} strokeDasharray="5 3" />
                <text x={PX(19.2)} y={PY(p(19.2)) - 8} fontSize={9} fill={GOOD} fontFamily="ui-monospace, monospace">
                  per-token accuracy — no jump anywhere
                </text>
              </>
            ) : null}

            <path d={line(exact)} fill="none" stroke={ACCENT} strokeWidth={2.6} />
            <text
              x={X1 - 4}
              y={PY(exact(HI)) - 12}
              fontSize={9}
              textAnchor="end"
              fill={ACCENT}
              fontFamily="ui-monospace, monospace"
            >
              {`score — all ${k} tokens right`}
            </text>

            {c05 !== null && c50 !== null ? (
              <g>
                <line x1={PX(c05)} y1={Y0} x2={PX(c05)} y2={Y1} stroke={WARM} strokeDasharray="2 3" strokeOpacity={0.7} />
                <line x1={PX(c50)} y1={Y0} x2={PX(c50)} y2={Y1} stroke={WARM} strokeDasharray="2 3" strokeOpacity={0.7} />
                <text x={(PX(c05) + PX(c50)) / 2} y={PY(0.75)} fontSize={8.5} textAnchor="middle" fill={WARM} fontFamily="ui-monospace, monospace">
                  the &ldquo;phase transition&rdquo;
                </text>
              </g>
            ) : null}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-2">
          <div className="flex items-center gap-2">
            <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              tokens, all right
            </span>
            <Range
              min={1}
              max={60}
              step={1}
              value={k}
              onChange={(e) => setK(Number(e.target.value))}
              className="flex-1"
              aria-label="how many tokens the metric requires to be simultaneously correct"
              accent={ACCENT}
            />
            <span className="w-8 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">{k}</span>
          </div>
          <button
            type="button"
            onClick={() => setTokenAcc((v) => !v)}
            aria-pressed={tokenAcc}
            className={cn(
              "w-fit cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              tokenAcc
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {tokenAcc ? "hide the underlying skill" : "show the underlying skill"}
          </button>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Drag <span className="font-mono text-[11px] text-foreground">k</span>{" "}to 1 and the two
          curves are the same curve. Drag it to 40 and the score sits at zero for four orders of
          magnitude and then detonates — while the dashed line, the thing the model is actually
          getting better at, climbs at exactly the same unremarkable rate the whole way.
          <br />
          <br />
          <span className="text-foreground">
            Nothing in the model changed between those two pictures. The metric did.
          </span>{" "}
          That is the Stanford argument in one control, and it won a NeurIPS 2023 best-paper award
          for it. It does not prove no ability is ever discontinuous — it shows that the standard
          evidence for discontinuity is also what you would see if nothing discontinuous happened,
          which means the evidence cannot tell them apart.
        </p>
      </div>
    </figure>
  )
}
