"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mcos, msin } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// The comparison step of autocad-image-redraw (scripts/compare_redraw.py), on a toy plan.
// The script registers the CAD preview onto the source image with a homography fitted to
// hand-picked anchor pairs (at least four), then measures, for every CAD edge pixel, the
// distance to the nearest source edge, and the reverse: median, 95th percentile, and the share
// within 3, 5 and 10 px. Its metrics.json always says "status": "pass"; no threshold is applied.
// Here the source is the plan's centrelines and distances are exact point-to-segment distances
// at the sketch's 0.15 px per mm, sampled every 20 mm, so there is no Canny double edge. The four
// anchors are the outer corners, so registration is the fit that maps the redraw's corners onto
// the sketch's; for this toy that fit is a scale in x and y.

type P = [number, number]
type Line = P[]

const PX_PER_MM = 0.15
const STEP = 20

function arc(cx: number, cy: number, r: number, a0: number, a1: number, n: number): Line {
  const out: Line = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push([cx + r * mcos(a), cy + r * msin(a)])
  }
  return out
}

const HALF_PI = 1.5707963267949
const PI = 3.14159265358979

function plan(wallX: number, door: boolean, s: number): Line[] {
  const L: Line[] = [
    [[0, 0], [6000, 0], [6000, 4200], [0, 4200], [0, 0]],
    [[wallX, 0], [wallX, 1500]],
    [[wallX, 2400], [wallX, 4200]],
    [[1200, 4100], [2700, 4100], [2700, 4300], [1200, 4300], [1200, 4100]],
    arc(5200, 800, 200, 0, 2 * PI, 48),
  ]
  if (door) {
    L.push([[wallX, 1500], [wallX - 900, 1500]])
    L.push(arc(wallX, 1500, 900, HALF_PI, PI, 24))
  }
  return L.map((l) => l.map(([x, y]) => [x * s, y * s] as P))
}

function samples(lines: Line[]): P[] {
  const out: P[] = []
  for (const l of lines) {
    for (let i = 0; i + 1 < l.length; i++) {
      const [x0, y0] = l[i]
      const [x1, y1] = l[i + 1]
      const len = Math.sqrt((x1 - x0) * (x1 - x0) + (y1 - y0) * (y1 - y0))
      const n = Math.max(1, Math.round(len / STEP))
      for (let k = 0; k < n; k++) out.push([x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n])
    }
  }
  return out
}

function nearest(p: P, lines: Line[]): number {
  let best = Infinity
  for (const l of lines) {
    for (let i = 0; i + 1 < l.length; i++) {
      const [ax, ay] = l[i]
      const [bx, by] = l[i + 1]
      const dx = bx - ax
      const dy = by - ay
      const qq = dx * dx + dy * dy
      let t = qq > 0 ? ((p[0] - ax) * dx + (p[1] - ay) * dy) / qq : 0
      t = Math.max(0, Math.min(1, t))
      const ex = ax + t * dx - p[0]
      const ey = ay + t * dy - p[1]
      const d2 = ex * ex + ey * ey
      if (d2 < best) best = d2
    }
  }
  return Math.sqrt(best)
}

function stats(d: number[]) {
  const s = [...d].sort((a, b) => a - b)
  const q = (f: number) => {
    const i = f * (s.length - 1)
    const lo = Math.floor(i)
    const hi = Math.min(s.length - 1, lo + 1)
    return s[lo] + (s[hi] - s[lo]) * (i - lo)
  }
  const within = (t: number) => d.filter((v) => v <= t).length / d.length
  return { median: q(0.5), p95: q(0.95), w3: within(3), w5: within(5), w10: within(10) }
}

const SOURCE = plan(3600, true, 1)
const SOURCE_SAMPLES = samples(SOURCE)
const pct = (v: number) => `${(v * 100).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
const px = (v: number) => `${v.toLocaleString("en-US", { maximumFractionDigits: 1 })} px`

export function RedrawDiff() {
  const [scaleErr, setScaleErr] = useState(3)
  const [wall, setWall] = useState(0)
  const [door, setDoor] = useState(true)
  const [registered, setRegistered] = useState(true)
  const [tol, setTol] = useState(5)

  const r = useMemo(() => {
    const s = 1 + scaleErr / 100
    let cad = plan(3600 + wall, door, s)
    if (registered) cad = cad.map((l) => l.map(([x, y]) => [x / s, y / s] as P))
    const cs = samples(cad)
    const c2s = cs.map((p) => nearest(p, SOURCE) * PX_PER_MM)
    const s2c = SOURCE_SAMPLES.map((p) => nearest(p, cad) * PX_PER_MM)
    return { cad, a: stats(c2s), b: stats(s2c) }
  }, [scaleErr, wall, door, registered])

  const ok = r.a.p95 <= tol && r.b.p95 <= tol
  const S = 0.075
  const X0 = 40
  const Y0 = 30
  const top = 4650
  const path = (l: Line) => l.map(([x, y], i) => `${i ? "L" : "M"} ${(X0 + x * S).toFixed(2)} ${(Y0 + (top - y) * S).toFixed(2)}`).join(" ")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>redraw against source: what the edge metrics can see</span>
        <span className="text-muted-foreground/60">toy plan, compare_redraw.py&apos;s metric</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="grid gap-3 font-mono text-[11px] text-muted-foreground sm:grid-cols-2">
          <label className="block">
            <span className="flex justify-between">
              <span>every length off by</span>
              <span className="text-foreground">{`${scaleErr > 0 ? "+" : ""}${scaleErr}%`}</span>
            </span>
            <Range aria-label="Uniform scale error in percent" min={-6} max={6} step={1} value={scaleErr} onChange={(e) => setScaleErr(Number(e.target.value))} className="mt-1 w-full" />
          </label>
          <label className="block">
            <span className="flex justify-between">
              <span>interior wall moved</span>
              <span className="text-foreground">{`${wall > 0 ? "+" : ""}${wall} mm`}</span>
            </span>
            <Range aria-label="Interior wall offset in millimetres" min={-600} max={600} step={50} value={wall} onChange={(e) => setWall(Number(e.target.value))} className="mt-1 w-full" />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {[
            { on: registered, set: () => setRegistered(!registered), label: registered ? "registered on 4 corners" : "raw overlay, no registration" },
            { on: !door, set: () => setDoor(!door), label: door ? "door drawn" : "door left out" },
          ].map((b) => (
            <button
              key={b.label}
              type="button"
              aria-pressed={b.on}
              onClick={b.set}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                b.on ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {b.label}
            </button>
          ))}
          <span className="ml-2 font-mono text-[11px] text-muted-foreground">tolerance</span>
          {[3, 5, 10].map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={tol === t}
              onClick={() => setTol(t)}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                tol === t ? "border-foreground/30 bg-muted/50 text-foreground" : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {`${t} px`}
            </button>
          ))}
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
          <svg viewBox="0 0 540 400" className="w-full" role="img" aria-label="The source plan in red and the redraw in blue, overlaid">
            {SOURCE.map((l, i) => (
              <path key={`s${i}`} d={path(l)} fill="none" stroke="oklch(0.6 0.2 25)" strokeWidth={3} strokeOpacity={0.55} strokeLinejoin="round" />
            ))}
            {r.cad.map((l, i) => (
              <path key={`c${i}`} d={path(l)} fill="none" stroke="oklch(0.5 0.17 255)" strokeWidth={1.4} strokeLinejoin="round" />
            ))}
            <text x={40} y={392} fontSize={11} className="fill-muted-foreground font-mono">
              red: source sketch · blue: redraw
            </text>
          </svg>
          <div className="font-mono text-[11px]">
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-left text-muted-foreground">
                  <th className="pb-1 font-normal" />
                  <th className="pb-1 text-right font-normal">CAD to source</th>
                  <th className="pb-1 text-right font-normal">source to CAD</th>
                </tr>
              </thead>
              <tbody>
                {[
                  ["median", px(r.a.median), px(r.b.median)],
                  ["p95", px(r.a.p95), px(r.b.p95)],
                  ["within 3 px", pct(r.a.w3), pct(r.b.w3)],
                  ["within 5 px", pct(r.a.w5), pct(r.b.w5)],
                  ["within 10 px", pct(r.a.w10), pct(r.b.w10)],
                ].map(([k, a, b]) => (
                  <tr key={k} className="border-t border-border/60">
                    <td className="py-1 text-muted-foreground">{k}</td>
                    <td className="py-1 text-right">{a}</td>
                    <td className="py-1 text-right">{b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className={cn("mt-3 rounded-md border px-3 py-2", ok ? "border-border" : "border-red-500/50 bg-red-500/5")}>
              <div className="text-foreground">{`p95 within ${tol} px both ways: ${ok ? "yes" : "no"}`}</div>
              <div className="mt-0.5 text-muted-foreground">{`compare_redraw.py writes "status": "pass" either way`}</div>
            </div>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {registered && scaleErr !== 0 && wall === 0 && door
                ? "Registered on the corners, a redraw that is wrong everywhere by the same factor scores like a perfect one. The fit absorbs it."
                : !door
                  ? "A missing door barely moves CAD to source: every CAD edge still lies on a source edge. Only the reverse direction sees the hole."
                  : "A local error, like a wall in the wrong place, shows up in the p95 and the coverage, because registration cannot fix one wall without moving the rest."}
            </p>
          </div>
        </div>
      </div>
    </figure>
  )
}
