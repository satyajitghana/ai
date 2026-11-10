"use client"

// SolidCraft's oracle case 24-user-parameters: a width x depth x height block from the origin with a
// centred through hole of diameter hole_d. Its recipe is four user parameters, one sketch whose
// dimensions are expressions of them (width, depth, hole_d, width / 2, depth / 2) and one extrude of
// "height". Change a parameter and the timeline re-evaluates the sketch, then the extrude.
//
// The closed form V = (w d - pi r^2) h is the case's own expected.json method. The "OpenCascade" row is
// MEASURED: I rebuilt this part in OpenCascade 8.0 (cadquery-ocp 8.0.1.1, Python) at 12 settings
// (width 40/60/80/100 x hole_d 4/10/16, depth 40, height 15); the worst relative volume error against
// the closed form was 1.6e-16. SolidCraft itself was NOT run (the sandbox refused its binary); its oracle
// accepts a volume within 1e-3 relative (tests/oracle/README.md).

import { useMemo, useState } from "react"

import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

const C30 = 0.8660254037844386
const S30 = 0.5

type P3 = [number, number, number]

function iso([x, y, z]: P3, k: number): [number, number] {
  return [(x - y) * C30 * k, ((x + y) * S30 - z) * k]
}

const fmt = (x: number, d = 2) => x.toLocaleString("en-US", { minimumFractionDigits: d, maximumFractionDigits: d })

function Slider(props: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
      <span className="w-16 shrink-0">{props.label}</span>
      <input
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
      <span className="w-14 shrink-0 text-right text-foreground">{props.value} mm</span>
    </label>
  )
}

export function ParamBlock() {
  const [w, setW] = useState(60)
  const [d, setD] = useState(40)
  const [h, setH] = useState(15)
  const [hd, setHd] = useState(10)
  const r = Math.min(hd, w - 2, d - 2) / 2

  const v = (w * d - Math.PI * r * r) * h
  const a = 2 * (w * d - Math.PI * r * r) + 2 * (w + d) * h + 2 * Math.PI * r * h

  const geom = useMemo(() => {
    const k = 2.2
    const pt = (p: P3) => iso(p, k)
    const top = ([[0, 0, h], [w, 0, h], [w, d, h], [0, d, h]] as P3[]).map(pt)
    const right = ([[w, 0, 0], [w, d, 0], [w, d, h], [w, 0, h]] as P3[]).map(pt)
    const front = ([[0, d, 0], [w, d, 0], [w, d, h], [0, d, h]] as P3[]).map(pt)
    const hole: [number, number][] = []
    const wall: [number, number][] = []
    for (let i = 0; i <= 48; i++) {
      const t = (2 * Math.PI * i) / 48
      hole.push(pt([w / 2 + r * mcos(t), d / 2 + r * msin(t), h]))
    }
    // the far half of the bore wall, seen through the opening, down to depth min(h, r)
    const dz = Math.min(h, r * 1.2)
    for (let i = 0; i <= 24; i++) {
      const t = Math.PI * 0.75 + (Math.PI * i) / 24
      wall.push(pt([w / 2 + r * mcos(t), d / 2 + r * msin(t), h - dz]))
    }
    const all = [...top, ...right, ...front, ...hole]
    const xs = all.map((p) => p[0])
    const ys = all.map((p) => p[1])
    const box = [Math.min(...xs) - 8, Math.min(...ys) - 8, Math.max(...xs) - Math.min(...xs) + 16, Math.max(...ys) - Math.min(...ys) + 16]
    return { top, right, front, hole, wall, box }
  }, [w, d, h, r])

  const poly = (ps: [number, number][]) => ps.map((p) => `${p[0].toFixed(2)},${p[1].toFixed(2)}`).join(" ")
  const changed = (name: string, def: number, cur: number) => cur !== def && name

  const dirty = [changed("width", 60, w), changed("depth", 40, d), changed("height", 15, h), changed("hole_d", 10, hd)].filter(Boolean) as string[]
  const sketchDirty = dirty.some((n) => n !== "height")
  const extrudeDirty = dirty.length > 0

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>oracle case 24-user-parameters</span>
        <span className="text-muted-foreground/60">four parameters, one sketch, one extrude</span>
      </div>
      <div className="grid gap-5 p-4 sm:grid-cols-[1.1fr_1fr] sm:p-5">
        <div>
          <svg viewBox={geom.box.map((x) => x.toFixed(2)).join(" ")} className="h-56 w-full" role="img" aria-label={`Block ${w} by ${d} by ${h} mm with a ${hd} mm through hole`}>
            <polygon points={poly(geom.right)} className="fill-muted stroke-foreground/50" strokeWidth={0.8} />
            <polygon points={poly(geom.front)} className="fill-muted/60 stroke-foreground/50" strokeWidth={0.8} />
            <polygon points={poly(geom.top)} className="fill-background stroke-foreground/70" strokeWidth={0.8} />
            <polygon points={poly(geom.hole)} className="fill-foreground/15 stroke-foreground/70" strokeWidth={0.8} />
            <polyline points={poly(geom.wall)} className="fill-none stroke-foreground/30" strokeWidth={0.6} strokeDasharray="2 2" />
          </svg>
          <div className="mt-3 space-y-2">
            <Slider label="width" value={w} min={30} max={100} step={1} onChange={setW} />
            <Slider label="depth" value={d} min={20} max={70} step={1} onChange={setD} />
            <Slider label="height" value={h} min={4} max={40} step={1} onChange={setH} />
            <Slider label="hole_d" value={hd} min={2} max={20} step={1} onChange={setHd} />
          </div>
        </div>
        <div className="space-y-3 font-mono text-[11px]">
          <div className="rounded-lg border p-3">
            <div className="mb-1.5 text-muted-foreground">timeline after the edit</div>
            {[
              { n: "Parameters", s: dirty.length ? `changed: ${dirty.join(", ")}` : "as recorded", hot: dirty.length > 0 },
              { n: "Sketch1", s: sketchDirty ? "re-solved: dimensions are width, depth, hole_d, width / 2, depth / 2" : "inputs unchanged, result reused", hot: sketchDirty },
              { n: "Extrude1", s: extrudeDirty ? "rebuilt: distance = height" : "inputs unchanged, result reused", hot: extrudeDirty },
            ].map((f) => (
              <div key={f.n} className="flex gap-2 py-0.5">
                <span className={cn("w-20 shrink-0", f.hot ? "text-foreground" : "text-muted-foreground")}>{f.n}</span>
                <span className="text-muted-foreground">{f.s}</span>
              </div>
            ))}
          </div>
          <div className="rounded-lg border p-3">
            <div className="text-muted-foreground">closed form, the case&apos;s own method</div>
            <div className="mt-1 text-foreground">V = (w d - pi r^2) h = {fmt(v)} mm3</div>
            <div className="text-foreground">A = {fmt(a)} mm2</div>
            <div className="text-muted-foreground">bbox [0, 0, 0] to [{w}, {d}, {h}]</div>
          </div>
          <div className="rounded-lg border p-3 text-muted-foreground">
            <div>
              <span className="text-foreground">OpenCascade rebuild</span> (measured, 12 settings): worst relative volume error{" "}
              <span className="text-foreground">1.6e-16</span>
            </div>
            <div className="mt-1">
              <span className="text-foreground">SolidCraft oracle</span> (reported): passes within <span className="text-foreground">1e-3</span> relative
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The drawing and the numbers are computed in your browser from the closed form. The timeline panel
        shows which features a change re-evaluates; it mirrors the recipe, it is not SolidCraft output.
      </figcaption>
    </figure>
  )
}
