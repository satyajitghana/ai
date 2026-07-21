"use client"

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

// The looped Transformer drawn as a NETWORK. LOTUS gets its depth by reusing one
// weight set f_θ for R passes, not by stacking R× the parameters. Rolled, it is a
// single block with a loop-back arrow (×R). Unrolled, it is an effective R-deep
// network of *identical* blocks — same θ everywhere — with the input latents E fed
// back in at every pass (the E + h^(t-1) residual). Scrub the unroll depth and watch
// the effective depth grow while the parameter count stays at 1×.

const ACCENT = "oklch(0.58 0.16 300)" // lotus violet
const R = 6

const W = 760
const H = 340
const MX = 36

// unrolled chain geometry
const EW = 52
const BW = 72
const GAP = 18
const X0 = MX + EW + 28 // first f_θ box left edge
const bx = (i: number) => X0 + i * (BW + GAP)
const cbx = (i: number) => bx(i) + BW / 2

const MID_Y = 150 // block band top
const BH = 54
const EY = MID_Y // E node aligns with block band
const H_LABEL_Y = MID_Y + BH + 20 // h^(t) labels
const BRACKET_Y = 96 // shared-weights bracket

// smooth vertical/horizontal S-curve between two points
function link(x1: number, y1: number, x2: number, y2: number) {
  const mx = (x1 + x2) / 2
  return `M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`
}
// arc that rises above the band (used for the E-residual skip and the loop-back)
function arcOver(x1: number, y1: number, x2: number, y2: number, lift: number) {
  const my = Math.min(y1, y2) - lift
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function LoopUnroll() {
  const [unrolled, setUnrolled] = useState(true)
  const [t, setT] = useState(R)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>looped transformer · depth from weight reuse</span>
        <span className="text-muted-foreground/50">network view</span>
      </div>

      <div className="p-3 sm:p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={
            unrolled
              ? `The looped Transformer unrolled into an effective ${t}-deep network of the same shared weights, with the input latents E fed into every pass.`
              : `The looped Transformer rolled up: one shared block f_theta applied R=${R} times via a loop-back edge.`
          }
        >
          <defs>
            <marker id="lu-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
            <marker id="lu-arrow-mut" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke="var(--muted-foreground)" strokeWidth={1.2} />
            </marker>
            <filter id="lu-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
          </defs>

          {/* input latents E */}
          <g>
            <rect x={MX} y={EY} width={EW} height={BH} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#lu-soft)" />
            <text x={MX + EW / 2} y={EY + BH / 2 - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={15} fontWeight={600}>E</text>
            <text x={MX + EW / 2} y={EY + BH / 2 + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>latents</text>
          </g>

          {unrolled ? (
            <>
              {/* shared-weights bracket over the visible blocks */}
              <path
                d={`M ${bx(0)} ${BRACKET_Y + 10} C ${bx(0)} ${BRACKET_Y}, ${bx(0)} ${BRACKET_Y}, ${bx(0) + 12} ${BRACKET_Y} L ${bx(t - 1) + BW - 12} ${BRACKET_Y} C ${bx(t - 1) + BW} ${BRACKET_Y}, ${bx(t - 1) + BW} ${BRACKET_Y}, ${bx(t - 1) + BW} ${BRACKET_Y + 10}`}
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.4}
                opacity={0.6}
              />
              <text x={(bx(0) + bx(t - 1) + BW) / 2} y={BRACKET_Y - 6} textAnchor="middle" className="font-mono" fontSize={11} fontWeight={600} style={{ fill: ACCENT }}>
                shared weights θ — reused every pass (1× parameters)
              </text>

              {/* E -> first block */}
              <path d={link(MX + EW, EY + BH / 2, bx(0), MID_Y + BH / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#lu-arrow-mut)" opacity={0.6} />

              {/* the R shared blocks, left to right */}
              {Array.from({ length: R }, (_, i) => {
                const on = i < t
                return (
                  <g key={i} opacity={on ? 1 : 0.16} className="transition-opacity duration-300">
                    {/* forward edge from previous block */}
                    {i > 0 && (
                      <path
                        d={link(bx(i - 1) + BW, MID_Y + BH / 2, bx(i), MID_Y + BH / 2)}
                        fill="none"
                        stroke={ACCENT}
                        strokeWidth={1.6}
                        markerEnd="url(#lu-arrow)"
                        opacity={on ? 0.85 : 0.2}
                      />
                    )}
                    {/* E residual skip fed into this pass (E + h^(t-1)) */}
                    <path
                      d={arcOver(MX + EW / 2, EY, cbx(i), MID_Y, 60 + (i % 2) * 16)}
                      fill="none"
                      stroke="var(--muted-foreground)"
                      strokeWidth={1.1}
                      strokeDasharray="3 3"
                      markerEnd="url(#lu-arrow-mut)"
                      opacity={on ? 0.5 : 0.12}
                    />
                    {/* the shared block */}
                    <rect x={bx(i)} y={MID_Y} width={BW} height={BH} rx={9} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} filter="url(#lu-soft)" />
                    <text x={cbx(i)} y={MID_Y + BH / 2 - 2} textAnchor="middle" className="fill-foreground font-mono" fontSize={13} fontWeight={600}>f_θ</text>
                    <text x={cbx(i)} y={MID_Y + BH / 2 + 13} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={8}>pass {i + 1}</text>
                    {/* h^(t) output label */}
                    <text x={cbx(i)} y={H_LABEL_Y} textAnchor="middle" className="fill-muted-foreground/80 font-mono" fontSize={9}>
                      h{"⁽"}{i + 1}{"⁾"}
                    </text>
                  </g>
                )
              })}

              {/* readout node after the last active block */}
              <path d={link(bx(t - 1) + BW, MID_Y + BH / 2, bx(t - 1) + BW + 18, MID_Y + BH / 2)} fill="none" stroke={ACCENT} strokeWidth={1.6} markerEnd="url(#lu-arrow)" opacity={0.85} />
              <g>
                <rect x={bx(t - 1) + BW + 18} y={MID_Y + 6} width={64} height={BH - 12} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#lu-soft)" />
                <text x={bx(t - 1) + BW + 18 + 32} y={MID_Y + BH / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>readout</text>
              </g>
            </>
          ) : (
            <>
              {/* rolled: single shared block with a loop-back edge */}
              {(() => {
                const RX = W / 2 - 70
                const RW = 140
                return (
                  <g>
                    {/* E -> block */}
                    <path d={link(MX + EW, EY + BH / 2, RX, MID_Y + BH / 2)} fill="none" stroke="var(--muted-foreground)" strokeWidth={1.3} markerEnd="url(#lu-arrow-mut)" opacity={0.6} />
                    {/* loop-back arc: output back into input */}
                    <path d={arcOver(RX + RW, MID_Y, RX, MID_Y, 84)} fill="none" stroke={ACCENT} strokeWidth={1.8} markerEnd="url(#lu-arrow)" opacity={0.8} />
                    <text x={RX + RW / 2} y={MID_Y - 78} textAnchor="middle" className="font-mono" fontSize={13} fontWeight={700} style={{ fill: ACCENT }}>×R</text>
                    <text x={RX + RW / 2} y={MID_Y - 60} textAnchor="middle" className="fill-muted-foreground font-mono" fontSize={10}>h⁽ᵗ⁾ = f_θ(E + h⁽ᵗ⁻¹⁾)</text>
                    {/* the block */}
                    <rect x={RX} y={MID_Y} width={RW} height={BH} rx={10} fill="var(--background)" stroke={ACCENT} strokeWidth={1.6} filter="url(#lu-soft)" />
                    <text x={RX + RW / 2} y={MID_Y + BH / 2 + 5} textAnchor="middle" className="fill-foreground font-mono" fontSize={15} fontWeight={600}>base LM  f_θ</text>
                    {/* block -> readout */}
                    <path d={link(RX + RW, MID_Y + BH / 2, RX + RW + 40, MID_Y + BH / 2)} fill="none" stroke={ACCENT} strokeWidth={1.6} markerEnd="url(#lu-arrow)" opacity={0.85} />
                    <g>
                      <rect x={RX + RW + 40} y={MID_Y + 6} width={64} height={BH - 12} rx={8} fill="var(--muted)" stroke="var(--border)" strokeWidth={1.5} filter="url(#lu-soft)" />
                      <text x={RX + RW + 40 + 32} y={MID_Y + BH / 2 + 4} textAnchor="middle" className="fill-foreground font-mono" fontSize={11} fontWeight={600}>readout</text>
                    </g>
                  </g>
                )
              })()}
            </>
          )}
        </svg>

        {/* controls */}
        <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2">
          <div className="flex items-center gap-1.5">
            <span className="font-mono text-[10px] text-muted-foreground">view</span>
            {([["unrolled", true], ["rolled", false]] as [string, boolean][]).map(([label, v]) => (
              <button
                key={label}
                type="button"
                onClick={() => setUnrolled(v)}
                aria-pressed={unrolled === v}
                className={
                  "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors " +
                  (unrolled === v ? "border-foreground/40 text-foreground" : "border-transparent bg-muted text-muted-foreground hover:text-foreground")
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="ml-auto font-mono text-[10px] text-muted-foreground">
            effective depth <span style={{ color: ACCENT }}>{unrolled ? t : R}× layers</span> · parameters{" "}
            <span className="text-foreground">1× (shared)</span>
          </div>
        </div>

        {unrolled && (
          <div className="mt-3">
            <div className="mb-1 font-mono text-[10px] text-muted-foreground">unroll depth (drag to t = R)</div>
            <Range
              min={1}
              max={R}
              value={t}
              onChange={(e) => setT(Number(e.target.value))}
              className="w-full cursor-pointer " accent="oklch(0.58 0.16 300)" />
          </div>
        )}

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Rolled up, LOTUS is <span className="text-foreground">one</span> block with a loop-back edge. Unrolled, it is an
          effective <span style={{ color: ACCENT }}>R-deep network</span> of the <span className="text-foreground">same</span>{" "}
          weights — depth without new parameters — with the input latents <span className="font-mono">E</span> fed back into
          every pass (the <span className="font-mono">E + h⁽ᵗ⁻¹⁾</span> residual, dashed). That is what lets a 3B backbone
          reason at a depth its parameter count alone would not buy.
        </p>
      </div>
    </figure>
  )
}
