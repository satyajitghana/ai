"use client"

import { useState } from "react"

import { LINKS } from "./data-extra"
import { ACCENT, Frame, GREEN, Pill, STREAM, T } from "./viz"

// Direct-path connections, our re-implementation on Qwen3-0.6B. For a source
// neuron A in layer i and a later neuron B in layer j, the score is
// (W_gate[B] . v) * (W_up[B] . v) with v = norm_weight_j * W_down[:, A]: how
// strongly B's gate and up rows read A's write, ignoring everything between.
// |score| is z-scored within layer j; the sign is the sign of the product.
// Top: arcs for the five strongest links of a few neurons. Bottom: for 128
// random neurons of layer 16, how far downstream their 24 strongest links
// point. All measured.

const LAYERS = 28
const X0 = 28
const DX = 23.5
const IDS = Object.keys(LINKS.named)

export function ConnectionsDiagram() {
  const [id, setId] = useState(IDS[0])
  const src = Number(id.slice(1, id.indexOf("N")))
  const links = LINKS.named[id]
  const zmax = Math.max(...links.map((l) => l.z), 1)
  const histMax = Math.max(...LINKS.byDistance)
  return (
    <Frame
      label="direct-path links between neurons · Qwen3-0.6B · our re-implementation"
      right={
        <div className="flex flex-wrap gap-1">
          {IDS.map((k) => (
            <Pill key={k} active={id === k} onClick={() => setId(k)}>
              {k.replace("N", " N")}
            </Pill>
          ))}
        </div>
      }
      note={
        <>
          This is weights only: it ignores attention, the other neurons and every nonlinearity between the two
          layers, so a strong link says &quot;B reads what A writes&quot;, not &quot;A causes B&quot;. For the 128 random
          layer-16 sources the median z of a top-24 link was {LINKS.medianZ.toFixed(1)}, and{" "}
          {(LINKS.sharePos * 100).toFixed(0)} percent of those links had a positive sign.
        </>
      }
    >
      <svg viewBox="0 0 700 300" role="img" className="h-auto w-full">
        <title>
          Top: the 28 layers in a row, with arcs from the chosen source neuron to its five strongest downstream
          partners; arcs are stacked by rank and thickness shows the z-score. Bottom: a histogram of how many layers downstream the
          strongest links of 128 layer-16 neurons point.
        </title>
        {Array.from({ length: LAYERS }, (_, l) => (
          <g key={l}>
            <rect x={X0 + l * DX} y={150} width={DX - 5} height={14} rx={2} fill={l === src ? ACCENT : STREAM} fillOpacity={l === src ? 0.9 : 0.25} />
            {l % 3 === 0 && <T x={X0 + l * DX + (DX - 5) / 2} y={180} anchor="middle" size={8} opacity={0.5}>{l}</T>}
          </g>
        ))}
        {links.map((k, i) => {
          const x1 = X0 + src * DX + (DX - 5) / 2
          const x2 = X0 + k.layer * DX + (DX - 5) / 2
          const h = 36 + i * 22
          return (
            <g key={i}>
              <path
                d={`M${x1} 150 C ${x1} ${150 - h}, ${x2} ${150 - h}, ${x2} 150`}
                fill="none"
                stroke={k.sign > 0 ? GREEN : ACCENT}
                strokeWidth={1 + (k.z / zmax) * 2.5}
                strokeOpacity={0.8}
              />
              <T x={x2} y={150 - h * 0.75 - 15} anchor="middle" size={8.5} opacity={0.9}>
                L{k.layer} N{k.n}
              </T>
              <T x={x2} y={150 - h * 0.75 - 4} anchor="middle" size={8} opacity={0.6}>
                z {k.z.toFixed(1)}
              </T>
            </g>
          )
        })}
        <T x={X0} y={196} size={8.5} opacity={0.5}>layer (green arc: same-sign link, orange: opposite sign)</T>
        {/* histogram */}
        <T x={X0} y={218} size={9} opacity={0.65}>layers downstream of layer 16, share of the strongest links ({LINKS.sources} sources x {LINKS.k})</T>
        {LINKS.byDistance.map((v, d) => (
          <g key={d}>
            <rect x={X0 + d * 40} y={290 - (v / histMax) * 56} width={30} height={(v / histMax) * 56} fill={STREAM} fillOpacity={0.7} />
            <T x={X0 + d * 40 + 15} y={286 - (v / histMax) * 56} anchor="middle" size={8} opacity={0.8}>{(v * 100).toFixed(0)}%</T>
            <T x={X0 + d * 40 + 15} y={298} anchor="middle" size={8} opacity={0.5}>+{d + 1}</T>
          </g>
        ))}
      </svg>
      <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-muted-foreground">
        {links.map((k, i) => (
          <li key={i}>
            L{src} → L{k.layer} N{k.n} · z {k.z.toFixed(1)} · {k.sign > 0 ? "+" : "-"} · its lens:{" "}
            <span className="text-foreground">{k.lens.map((t) => t.replace(/\s/g, "·")).join(" ")}</span>
          </li>
        ))}
      </ul>
    </Frame>
  )
}
