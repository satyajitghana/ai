"use client"

import { useState } from "react"

import { mlog10, mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { AUTHORS_STEER, PER_LAYER, RUN, type Row } from "./data"

// Two checks from the neuron-lens write-up, re-run on Qwen3-0.6B (this site's measurements, on CPU) beside the
// authors' own Qwen3-8B numbers (reported, not re-run). Every plotted number comes from data.ts, which is generated
// from the run's JSON files. Depth is relative (layer / number of layers) so a 28-layer and a 36-layer model share an axis.

type Tab = "steer" | "input" | "dose"

const DESC: Record<Tab, string> = {
  steer:
    "Median correlation between a lens read of a neuron write and the measured steering effect, by relative depth, for the plain logit lens, a J-lens style read and a mismatched control, with the authors' Qwen3-8B curves dashed.",
  input:
    "Share of a neuron's top firing tokens found in the top 10 tokens of an input-side read, by relative depth, for a K-lens style read, a plain embedding projection, a J-lens style read and a mismatched control.",
  dose: "Correlation between the J-lens style read and the steering effect against the size of the push relative to the residual stream, for three doses, one line per sampled layer.",
}

const BLUE = "oklch(0.60 0.15 255)"
const AMBER = "oklch(0.70 0.15 75)"
const GREEN = "oklch(0.62 0.14 150)"
const BROWN = "oklch(0.55 0.08 50)"
const GREY = "oklch(0.55 0 0)"

const W = 720
const H = 330
const X0 = 54
const X1 = 690
const Y0 = 20
const Y1 = 276

const xDepth = (d: number) => X0 + d * (X1 - X0)

type Pt = { x: number; y: number | null; label: string }

function line(points: Pt[]) {
  return points.filter((p) => p.y !== null).map((p) => `${p.x.toFixed(1)},${(p.y as number).toFixed(1)}`).join(" ")
}

export function DepthChecks() {
  const [tab, setTab] = useState<Tab>("steer")
  const [hover, setHover] = useState<number | null>(null)
  const rows: Row[] = PER_LAYER
  const nL = RUN.layersTotal

  const yR = (r: number) => Y0 + ((1 - r) / 1.15) * (Y1 - Y0) // r from -0.15 to 1
  const yShare = (s: number) => Y1 - Math.min(1, s / 0.6) * (Y1 - Y0)

  const series = (get: (r: Row) => number | null, y: (v: number) => number): Pt[] =>
    rows.map((r) => {
      const v = get(r)
      return { x: xDepth((r.layer ?? 0) / nL), y: v === null ? null : y(v), label: r.name }
    })

  const authors = (get: (a: (typeof AUTHORS_STEER)[number]) => number): Pt[] =>
    AUTHORS_STEER.map((a) => ({ x: xDepth(a.layer / 36), y: yR(get(a)), label: `L${a.layer}` }))

  const hoverRow = hover === null ? null : rows[hover]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Qwen3-0.6B, {RUN.sampledNeurons} random neurons, both poles · measured · authors&rsquo; Qwen3-8B dashed (reported)
        </span>
        <div className="flex flex-wrap gap-1">
          {(
            [
              ["steer", "write read vs steering"],
              ["input", "input-side read vs firings"],
              ["dose", "why: the dose"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setTab(k)}
              aria-pressed={tab === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tab === k ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3 sm:p-4">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" className="h-auto w-full">
          <title>{DESC[tab]}</title>
          {/* axes */}
          <line x1={X0} y1={Y1} x2={X1} y2={Y1} stroke="currentColor" strokeOpacity={0.3} />
          <line x1={X0} y1={Y0} x2={X0} y2={Y1} stroke="currentColor" strokeOpacity={0.3} />
          {tab !== "dose" &&
            [0, 0.25, 0.5, 0.75, 1].map((d) => (
              <g key={d}>
                <line x1={xDepth(d)} y1={Y1} x2={xDepth(d)} y2={Y1 + 4} stroke="currentColor" strokeOpacity={0.4} />
                <text x={xDepth(d)} y={Y1 + 16} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                  {d}
                </text>
              </g>
            ))}
          {tab !== "dose" && (
            <text x={(X0 + X1) / 2} y={Y1 + 32} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65}>
              relative depth (layer / number of layers)
            </text>
          )}

          {tab === "steer" && (
            <g>
              {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                <g key={r}>
                  <line x1={X0} y1={yR(r)} x2={X1} y2={yR(r)} stroke="currentColor" strokeOpacity={0.1} />
                  <text x={X0 - 8} y={yR(r) + 3} textAnchor="end" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                    {r}
                  </text>
                </g>
              ))}
              <text x={14} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65} transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}>
                median Pearson r
              </text>
              {/* authors */}
              <polyline points={line(authors((a) => a.J))} fill="none" stroke={BLUE} strokeWidth={1.8} strokeDasharray="5 4" strokeOpacity={0.7} />
              <polyline points={line(authors((a) => a.logit))} fill="none" stroke={AMBER} strokeWidth={1.8} strokeDasharray="5 4" strokeOpacity={0.7} />
              {authors((a) => a.J).map((p) => (
                <circle key={"aj" + p.label} cx={p.x} cy={p.y as number} r={3} fill="none" stroke={BLUE} strokeOpacity={0.7} />
              ))}
              {authors((a) => a.logit).map((p) => (
                <circle key={"al" + p.label} cx={p.x} cy={p.y as number} r={3} fill="none" stroke={AMBER} strokeOpacity={0.7} />
              ))}
              {/* ours */}
              <polyline points={line(series((r) => r.rCtrl, yR))} fill="none" stroke={GREY} strokeWidth={2} />
              <polyline points={line(series((r) => r.rLogit, yR))} fill="none" stroke={AMBER} strokeWidth={2.4} />
              <polyline points={line(series((r) => r.rJ, yR))} fill="none" stroke={BLUE} strokeWidth={2.4} />
              {series((r) => r.rJ, yR).map((p, i) => p.y !== null && <circle key={"j" + i} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.8} fill={BLUE} />)}
              {series((r) => r.rLogit, yR).map((p, i) => p.y !== null && <circle key={"l" + i} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.8} fill={AMBER} />)}
              {series((r) => r.rCtrl, yR).map((p, i) => p.y !== null && <circle key={"c" + i} cx={p.x} cy={p.y} r={3} fill={GREY} />)}
            </g>
          )}

          {tab === "input" && (
            <g>
              {[0, 0.1, 0.2, 0.3, 0.4, 0.5].map((s) => (
                <g key={s}>
                  <line x1={X0} y1={yShare(s)} x2={X1} y2={yShare(s)} stroke="currentColor" strokeOpacity={0.1} />
                  <text x={X0 - 8} y={yShare(s) + 3} textAnchor="end" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                    {Math.round(s * 100)}%
                  </text>
                </g>
              ))}
              <text x={14} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65} transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}>
                firing tokens in the read&rsquo;s top 10
              </text>
              {/* authors, reported: S-lens read, top 10 */}
              <rect x={xDepth(1 / 36)} y={yShare(0.09)} width={xDepth(8 / 36) - xDepth(1 / 36)} height={yShare(0.02) - yShare(0.09)} fill={GREEN} fillOpacity={0.14} stroke={GREEN} strokeDasharray="5 4" strokeOpacity={0.7} />
              <circle cx={xDepth(0)} cy={yShare(0.4)} r={5} fill="none" stroke={GREEN} strokeWidth={1.8} />
              <text x={xDepth(0) + 10} y={yShare(0.4) + 3} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={GREEN}>
                authors, S-lens, L0: 40%
              </text>
              <text x={xDepth(8 / 36) + 6} y={yShare(0.055)} fontSize={9.5} fontFamily="ui-monospace, monospace" fill={GREEN}>
                authors, S-lens, L1–L8: 2–9%
              </text>
              {/* ours */}
              <polyline points={line(series((r) => r.ctrlK10, yShare))} fill="none" stroke={GREY} strokeWidth={2} />
              <polyline points={line(series((r) => r.naive10, yShare))} fill="none" stroke={BROWN} strokeWidth={2.2} />
              <polyline points={line(series((r) => r.j10, yShare))} fill="none" stroke={BLUE} strokeWidth={2.2} />
              <polyline points={line(series((r) => r.k10, yShare))} fill="none" stroke={GREEN} strokeWidth={2.6} />
              {series((r) => r.k10, yShare).map((p, i) => p.y !== null && <circle key={"k" + i} cx={p.x} cy={p.y} r={hover === i ? 5.5 : 3.8} fill={GREEN} />)}
              {series((r) => r.naive10, yShare).map((p, i) => p.y !== null && <circle key={"n" + i} cx={p.x} cy={p.y} r={3.2} fill={BROWN} />)}
              {series((r) => r.j10, yShare).map((p, i) => p.y !== null && <circle key={"jj" + i} cx={p.x} cy={p.y} r={3.2} fill={BLUE} />)}
              {series((r) => r.ctrlK10, yShare).map((p, i) => p.y !== null && <circle key={"ck" + i} cx={p.x} cy={p.y} r={2.6} fill={GREY} />)}
            </g>
          )}

          {tab === "dose" && (
            <g>
              {[-2, -1.5, -1, -0.5, 0, 0.5, 1].map((e) => {
                const x = X0 + ((e + 2.2) / 3.6) * (X1 - X0)
                return (
                  <g key={e}>
                    <line x1={x} y1={Y1} x2={x} y2={Y1 + 4} stroke="currentColor" strokeOpacity={0.4} />
                    <text x={x} y={Y1 + 16} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                      {e === 0 ? "1×" : e > 0 ? `${Math.round(mpow(10, e))}×` : `${mpow(10, e).toFixed(2)}×`}
                    </text>
                  </g>
                )
              })}
              <text x={(X0 + X1) / 2} y={Y1 + 32} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65}>
                size of the push relative to the residual stream (median norm at that layer, log scale)
              </text>
              {[0, 0.25, 0.5, 0.75, 1].map((r) => (
                <g key={r}>
                  <line x1={X0} y1={yR(r)} x2={X1} y2={yR(r)} stroke="currentColor" strokeOpacity={0.1} />
                  <text x={X0 - 8} y={yR(r) + 3} textAnchor="end" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.6}>
                    {r}
                  </text>
                </g>
              ))}
              <text x={14} y={(Y0 + Y1) / 2} textAnchor="middle" fontSize={10} fontFamily="ui-monospace, monospace" fill="currentColor" fillOpacity={0.65} transform={`rotate(-90 14 ${(Y0 + Y1) / 2})`}>
                median r of the J-style read
              </text>
              {rows.map((r, i) => {
                const pts: Pt[] = (
                  [
                    [r.rel, r.rJ],
                    [r.rel4, r.rJ4],
                    [r.rel16, r.rJ16],
                  ] as const
                )
                  .filter(([a, b]) => a !== null && b !== null && (a as number) > 0)
                  .map(([a, b]) => ({ x: X0 + ((mlog10(a as number) + 2.2) / 3.6) * (X1 - X0), y: yR(b as number), label: r.name }))
                const hue = 255 - (i / Math.max(1, rows.length - 1)) * 215
                const c = `oklch(0.62 0.15 ${hue.toFixed(0)})`
                return (
                  <g key={r.name}>
                    <polyline points={line(pts)} fill="none" stroke={c} strokeWidth={hover === i ? 3 : 1.8} strokeOpacity={hover === null || hover === i ? 0.9 : 0.35} />
                    {pts.map((p, j) => (
                      <circle key={j} cx={p.x} cy={p.y as number} r={hover === i ? 5 : 3.4} fill={c} fillOpacity={hover === null || hover === i ? 1 : 0.4} />
                    ))}
                  </g>
                )
              })}
            </g>
          )}

          {/* hover columns */}
          {tab !== "dose" &&
            rows.map((r, i) => (
              <rect
                key={r.name}
                x={xDepth((r.layer ?? 0) / nL) - 14}
                y={Y0}
                width={28}
                height={Y1 - Y0}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`layer ${r.layer}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
          {tab === "dose" &&
            rows.map((r, i) => (
              <rect
                key={r.name}
                x={X1 + 6}
                y={Y0 + i * 18}
                width={30}
                height={16}
                rx={3}
                fill="transparent"
                tabIndex={0}
                role="button"
                aria-label={`layer ${r.layer}`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            ))}
        </svg>

        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
          {tab === "steer" && (
            <>
              <Key color={BLUE} label="J-style read of the write (ours)" />
              <Key color={AMBER} label="plain logit lens (ours)" />
              <Key color={GREY} label="another neuron's read (control)" />
              <Key color={BLUE} label="J-lens, Qwen3-8B (authors)" hollow />
              <Key color={AMBER} label="logit lens, Qwen3-8B (authors)" hollow />
            </>
          )}
          {tab === "input" && (
            <>
              <Key color={GREEN} label="K-style read of the read direction (ours)" />
              <Key color={BROWN} label="embedding projection (ours)" />
              <Key color={BLUE} label="J-style read of the read direction (ours)" />
              <Key color={GREY} label="another neuron's K read (control)" />
              <Key color={GREEN} label="S-lens, Qwen3-8B (authors)" hollow />
            </>
          )}
          {tab === "dose" && <span>one line per sampled layer, dots at 1×, 4× and 16× the typical top activation; hover or focus a layer to isolate it</span>}
        </div>

        <p className="mt-2 min-h-[2.5rem] text-sm text-muted-foreground">
          {hoverRow ? (
            <>
              <span className="font-mono text-foreground">{hoverRow.name}</span> · {hoverRow.poles} poles
              {tab === "steer" && hoverRow.rJ !== null && <> · r(J-style) {hoverRow.rJ.toFixed(2)}, r(logit lens) {hoverRow.rLogit?.toFixed(2)}, control {hoverRow.rCtrl?.toFixed(2)} · push {hoverRow.rel?.toFixed(2)}× the residual</>}
              {tab === "input" && hoverRow.k10 !== null && <> · K {(hoverRow.k10 * 100).toFixed(0)}%, embedding {((hoverRow.naive10 ?? 0) * 100).toFixed(0)}%, J {((hoverRow.j10 ?? 0) * 100).toFixed(0)}%, control {((hoverRow.ctrlK10 ?? 0) * 100).toFixed(0)}%</>}
              {tab === "dose" && hoverRow.rJ !== null && <> · r {hoverRow.rJ?.toFixed(2)} at 1×, {hoverRow.rJ4?.toFixed(2)} at 4×, {hoverRow.rJ16?.toFixed(2)} at 16×</>}
            </>
          ) : (
            "Hover or focus a point for its numbers."
          )}
        </p>
      </div>
    </figure>
  )
}

function Key({ color, label, hollow }: { color: string; label: string; hollow?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={hollow ? { border: `2px solid ${color}` } : { background: color }} />
      {label}
    </span>
  )
}
