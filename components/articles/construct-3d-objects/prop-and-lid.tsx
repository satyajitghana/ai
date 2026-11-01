"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"

// The Yamaha CFX example in the Construct repo (examples/yamaha-cfx/scene.json), two articulations:
//   lid-open  hinge  axis +z  pivot (-0.8, 1.008, 0)      42 deg   order 0   moves: lid
//   prop-rise turn   axis +z  pivot (0.55, 0.98, 0.45)   -69 deg   order 1   moves: prop (a tube 0.99 m long, rest direction -x)
// The lid is an extrusion that starts at y = 1.008 and rises 0.022 m, so its underside is the plane through the hinge.
// Signed distance of the prop tip from that plane (positive = tip is inside the lid) is computed here exactly as the
// author of this article computed it offline in Python: rotate by the right-hand rule, project on the plane normal.
const HX = -0.8
const HY = 1.008
const PX = 0.55
const PY = 0.98
const PL = 0.99
const LID_LEN = 1.594 // lid profile runs x -0.8 .. 0.794 in the scene

function tip(propDeg: number): [number, number] {
  const t = (propDeg * Math.PI) / 180
  return [PX - PL * mcos(t), PY - PL * msin(t)]
}

function gapMm(lidDeg: number, propDeg: number): number {
  const [tx, ty] = tip(propDeg)
  const l = (lidDeg * Math.PI) / 180
  return ((tx - HX) * -msin(l) + (ty - HY) * mcos(l)) * 1000
}

// svg: x metres -> px, y metres -> px (flipped)
const S = 150
const OX = 70
const OY = 330
const X = (m: number) => OX + (m - -0.9) * S
const Y = (m: number) => OY - (m - 0.9) * S

export function PropAndLid() {
  const [lid, setLid] = useState(42)
  const [prop, setProp] = useState(-69)
  const l = (lid * Math.PI) / 180
  const ex = HX + LID_LEN * mcos(l)
  const ey = HY + LID_LEN * msin(l)
  const [tx, ty] = tip(prop)
  const g = gapMm(lid, prop)
  const verdict =
    Math.abs(g) < 2 ? "touching" : g > 0 ? `through the lid by ${g.toFixed(1)} mm` : `${(-g).toFixed(1)} mm short of the lid`
  const ok = Math.abs(g) < 2

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        yamaha-cfx · two articulations, one contact · the scene&apos;s numbers, my arithmetic
      </div>
      <div className="px-4 pt-3">
        <svg viewBox="0 0 560 360" className="w-full" role="img" aria-label={`Piano lid at ${lid} degrees, prop stick at ${prop} degrees, tip ${verdict}`}>
          <line x1={X(-0.9)} y1={Y(0.98)} x2={X(0.9)} y2={Y(0.98)} stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 4" />
          <rect x={X(-0.8)} y={Y(1.008)} width={1.6 * S} height={0.2 * S} fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.3" />
          <line x1={X(HX)} y1={Y(HY)} x2={X(ex)} y2={Y(ey)} stroke="oklch(0.62 0.15 285)" strokeWidth="5" strokeLinecap="round" />
          <line x1={X(PX)} y1={Y(PY)} x2={X(tx)} y2={Y(ty)} stroke="oklch(0.62 0.15 55)" strokeWidth="3" strokeLinecap="round" />
          <circle cx={X(HX)} cy={Y(HY)} r="4" fill="currentColor" />
          <circle cx={X(PX)} cy={Y(PY)} r="4" fill="currentColor" />
          <circle cx={X(tx)} cy={Y(ty)} r="6" fill={ok ? "oklch(0.62 0.15 150)" : "oklch(0.60 0.17 30)"} />
          <text x={X(HX) - 4} y={Y(HY) + 18} fontSize="11" fill="currentColor" fillOpacity="0.7" textAnchor="start">hinge (-0.8, 1.008)</text>
          <text x={X(PX) + 8} y={Y(PY) + 16} fontSize="11" fill="currentColor" fillOpacity="0.7">prop foot (0.55, 0.98)</text>
          <text x={X(ex) - 6} y={Y(ey) - 8} fontSize="11" fill="currentColor" fillOpacity="0.7" textAnchor="end">lid</text>
        </svg>
      </div>
      <div className="space-y-2 px-4 pb-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">lid-open</span>
          <Range min={0} max={60} step={0.5} value={lid} onChange={(e) => setLid(Number(e.target.value))} aria-label="lid-open angle" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">{lid.toFixed(1)} deg</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">prop-rise</span>
          <Range min={-90} max={0} step={0.5} value={prop} onChange={(e) => setProp(Number(e.target.value))} aria-label="prop-rise angle" className="w-full" />
          <span className="w-20 shrink-0 text-right font-mono tabular-nums">{prop.toFixed(1)} deg</span>
        </label>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-t pt-2 font-mono text-xs">
          <span className="text-muted-foreground">prop tip to the lid&apos;s underside</span>
          <span className="tabular-nums">
            {g > 0 ? "+" : ""}
            {g.toFixed(2)} mm · {verdict}
          </span>
        </div>
        <div className="flex gap-2 font-mono text-[11px]">
          <button type="button" className="rounded border px-2 py-0.5 text-muted-foreground hover:bg-muted" onClick={() => { setLid(42); setProp(-69) }}>
            the scene&apos;s 42 and -69
          </button>
          <button type="button" className="rounded border px-2 py-0.5 text-muted-foreground hover:bg-muted" onClick={() => { setLid(42); setProp(-68) }}>
            one degree short
          </button>
        </div>
      </div>
    </figure>
  )
}
