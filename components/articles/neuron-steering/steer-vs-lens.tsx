"use client"

import { mlog10 } from "@/lib/dmath"

import { STEER } from "./data-extra"
import { ACCENT, Frame, GREEN, STREAM, T, VIOLET } from "./viz"

// Our re-run on Qwen3-0.6B. For a random sample of neurons in five layers we
// pushed each by +/-0.8 of the residual norm on four short contexts and kept
// (a) the KL divergence of the next-token distribution and (b) how many of the
// 12 tokens whose log-probability rose most are also in the neuron's logit
// lens (the 12 tokens its column promotes). All measured.

const X0 = 60

export function SteerVsLens() {
  const kmax = Math.max(...STEER.map((s) => s.medianKl), 1)
  const yK = (v: number) => 130 - (mlog10(Math.max(v, 0.01)) - -2) / (mlog10(kmax) + 2) * 100
  return (
    <Frame
      label="what a push does versus what the column spells · Qwen3-0.6B · measured"
      note={
        <>
          Left: the median KL of the next-token distribution after a push of 0.8 of the residual norm, by layer (log
          scale). Right: of the 12 tokens whose probability rose most, how many appear among the 12 the column
          promotes. The logit lens is a direct-path readout, so overlap is the share of the effect that goes straight
          to the output. In the repository&apos;s model the same push-size KL is reported to fall with depth, 10.3 at
          layer 0 to about 0.4 over layers 24 to 30, with a rise to 1.4 at the last layer (reported).
        </>
      }
    >
      <svg viewBox="0 0 700 190" role="img" className="h-auto w-full">
        <title>
          Two charts over five layers. Left, bars of the median KL divergence caused by a push. Right, paired bars of
          the mean overlap, out of 12, between the tokens a push raises and the tokens the logit lens lists, for
          positive and negative pushes.
        </title>
        {STEER.map((s, i) => {
          const x = X0 + i * 56
          return (
            <g key={s.layer}>
              <rect x={x} y={yK(s.medianKl)} width={36} height={130 - yK(s.medianKl)} fill={VIOLET} fillOpacity={0.7} />
              <T x={x + 18} y={yK(s.medianKl) - 4} anchor="middle" size={8.5} opacity={0.85}>{s.medianKl.toFixed(2)}</T>
              <T x={x + 18} y={146} anchor="middle" size={9} opacity={0.6}>L{s.layer}</T>
            </g>
          )
        })}
        <line x1={X0 - 6} y1={130} x2={X0 + 5 * 56} y2={130} stroke="currentColor" strokeOpacity={0.3} />
        <T x={X0 - 6} y={14} size={9} opacity={0.65}>median KL, log scale</T>
        {STEER.map((s, i) => {
          const x = X0 + 330 + i * 56
          const h = (v: number) => (v / 12) * 100
          return (
            <g key={s.layer}>
              <rect x={x} y={130 - h(s.overlapUp)} width={16} height={h(s.overlapUp)} fill={GREEN} fillOpacity={0.8} />
              <rect x={x + 18} y={130 - h(s.overlapDown)} width={16} height={h(s.overlapDown)} fill={ACCENT} fillOpacity={0.8} />
              <T x={x + 17} y={146} anchor="middle" size={9} opacity={0.6}>L{s.layer}</T>
            </g>
          )
        })}
        <line x1={X0 + 324} y1={130} x2={X0 + 330 + 5 * 56} y2={130} stroke="currentColor" strokeOpacity={0.3} />
        <T x={X0 + 324} y={14} size={9} opacity={0.65}>overlap with the logit lens, of 12</T>
        <rect x={X0 + 324} y={168} width={8} height={8} fill={GREEN} />
        <T x={X0 + 336} y={176} size={8.5} opacity={0.8}>push up</T>
        <rect x={X0 + 396} y={168} width={8} height={8} fill={ACCENT} />
        <T x={X0 + 408} y={176} size={8.5} opacity={0.8}>push down</T>
        <T x={X0} y={176} size={8.5} fill={STREAM} opacity={0.9}>{STEER[0].n} pushes per layer</T>
      </svg>
    </Frame>
  )
}
