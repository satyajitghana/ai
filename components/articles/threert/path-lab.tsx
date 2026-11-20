"use client"

// A path tracer in flatland, stepped by hand. The room is two-dimensional, the image is a row of 64 pixels, and every
// ray of the last sample of one pixel is drawn. "Offline" traces full paths; "live (cache)" does what ThreeRT's
// real-time kernel does: direct light at the camera hit, one bounce, then the light a grid cell has learned.

import { useCallback, useEffect, useRef, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import {
  CACHE_WARM, CAM, CELLS, LAMP, PIXELS, SEGS, cacheValue, newCache, pixelDir, reference, relErr, rng, sample, toCss,
  type Cache, type RGB, type Sample,
} from "./flatland"

const W = 720
const ROOM = 300 // px per room unit
const RX = 30, RY = 20 // room's top-left in the SVG
const STRIP_Y = RY + ROOM + 34
const PX = (W - 60) / PIXELS
const H = STRIP_Y + 2 * 26 + 40
const f2 = (v: number) => v.toFixed(2)
const sx = (x: number) => RX + x * ROOM
const sy = (y: number) => RY + (1 - y) * ROOM
const DEPTH_COL = ["#f59e0b", "#38bdf8", "#a78bfa", "#f472b6", "#34d399", "#f87171", "#fbbf24", "#60a5fa", "#c084fc"]

type State = { acc: RGB[]; spp: number; last: Sample | null; cache: Cache }
type View = { img: RGB[]; spp: number; last: Sample | null; cells: { k: number; css: string; warm: boolean }[]; warm: number }

const EMPTY: View = { img: Array.from({ length: PIXELS }, () => [0, 0, 0] as RGB), spp: 0, last: null, cells: [], warm: 0 }

// n more samples of every pixel, added in place; the last one of `pix` keeps its rays.
function accumulate(s0: State, r: () => number, n: number, pix: number, bounces: number, live: boolean) {
  for (let k = 0; k < n; k++) {
    for (let i = 0; i < PIXELS; i++) {
      const rec = i === pix && k === n - 1
      const s = sample(i, r, bounces, live, s0.cache, rec)
      s0.acc[i][0] += s.rgb[0]
      s0.acc[i][1] += s.rgb[1]
      s0.acc[i][2] += s.rgb[2]
      if (rec) s0.last = s
    }
  }
  s0.spp += n
}

// What the render needs, copied out of the mutable accumulation.
function snapshot(s: State): View {
  const img = s.acc.map((c) => [c[0] / s.spp, c[1] / s.spp, c[2] / s.spp] as RGB)
  const cells: View["cells"] = []
  let warm = 0
  for (let c = 0; c < s.cache.n.length; c++) if (s.cache.n[c] >= CACHE_WARM) warm++
  for (let k = 0; k < CELLS * CELLS; k++) {
    let best = -1, n = 0
    for (let f = 0; f < 4; f++) if (s.cache.n[k * 4 + f] > n) { n = s.cache.n[k * 4 + f]; best = k * 4 + f }
    if (best >= 0) cells.push({ k, css: toCss(cacheValue(s.cache, best)), warm: n >= CACHE_WARM })
  }
  return { img, spp: s.spp, last: s.last, cells, warm }
}

const fresh = (): State => ({ acc: Array.from({ length: PIXELS }, () => [0, 0, 0] as RGB), spp: 0, last: null, cache: newCache() })

export function PathLab() {
  const [bounces, setBounces] = useState(3)
  const [live, setLive] = useState(false)
  const [pix, setPix] = useState(40)
  const [run, setRun] = useState(false)
  const [ref, setRef] = useState<RGB[] | null>(null)
  // The accumulation lives in a ref (it is mutated sample by sample); `tick` re-renders.
  const stRef = useRef<State | null>(null)
  const [view, setView] = useState<View>(EMPTY)
  const rngRef = useRef(rng(1))

  useEffect(() => {
    // the reference is computed after hydration: 1,024 samples a pixel, paths of up to eight bounces, no cache
    const id = setTimeout(() => setRef(reference(1024)), 30)
    return () => clearTimeout(id)
  }, [])

  const reset = useCallback(() => {
    rngRef.current = rng(1)
    stRef.current = fresh()
    setView(EMPTY)
  }, [])

  const step = useCallback(
    (n: number) => {
      const s0 = stRef.current ?? (stRef.current = fresh())
      accumulate(s0, rngRef.current, n, pix, bounces, live)
      if (s0.spp >= 1024) setRun(false)
      setView(snapshot(s0))
    },
    [bounces, live, pix],
  )

  // one sample on mount, so the image row and a path are there before the first click
  const stepOnce = useRef(step)
  useEffect(() => {
    stepOnce.current = step
  }, [step])
  useEffect(() => {
    const id = setTimeout(() => stepOnce.current(1), 60)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    if (!run) return
    let raf = 0
    const tick = () => {
      step(1)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [run, step])

  const { img, spp, last, cells, warm } = view
  const err = ref && spp ? relErr(img, ref) : null

  const change = (fn: () => void) => {
    fn()
    reset()
  }

  // the pixel's view ray, for the marker
  const pd = pixelDir(pix, 0.5)
  const cell = last?.cacheCell ?? null

  return (
    <figure className="not-prose my-8 rounded-xl border">
      <div className="px-3 pt-3 sm:px-4">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`A flatland room lit by a ceiling lamp, traced at ${spp} samples a pixel; relative error against the reference ${err === null ? "not yet measured" : f2(err)}.`}>
          {/* the room is dark in both themes, so its lamp, walls and rays read the same */}
          <rect x={RX - 14} y={RY - 26} width={ROOM + 28} height={ROOM + 40} rx={8} fill="#0b1020" />
          {/* cache cells, shaded by what they hold (live mode) */}
          {live && cells.map((c) => (
            <rect key={c.k} x={f2(sx((c.k % CELLS) / CELLS))} y={f2(sy((Math.floor(c.k / CELLS) + 1) / CELLS))} width={f2(ROOM / CELLS)} height={f2(ROOM / CELLS)} fill={c.css} opacity={c.warm ? 0.55 : 0.2} />
          ))}
          {live && cell !== null && (
            <rect x={f2(sx((Math.floor(cell / 4) % CELLS) / CELLS))} y={f2(sy((Math.floor(cell / 4 / CELLS) + 1) / CELLS))} width={f2(ROOM / CELLS)} height={f2(ROOM / CELLS)} fill="none" stroke="#f59e0b" strokeWidth={2.5} />
          )}
          {/* the room */}
          {SEGS.map((g, i) => (
            <line key={i} x1={f2(sx(g.a[0]))} y1={f2(sy(g.a[1]))} x2={f2(sx(g.b[0]))} y2={f2(sy(g.b[1]))} stroke={g.emit ? "#fde68a" : `rgb(${g.albedo.map((v) => Math.round(255 * Math.sqrt(v))).join(",")})`} strokeWidth={g.emit ? 7 : 4} strokeLinecap="round" />
          ))}
          <rect x={f2(sx(0.56))} y={f2(sy(0.34))} width={f2(0.22 * ROOM)} height={f2(0.34 * ROOM)} fill="#334155" />
          <text x={f2(sx((LAMP[0] + LAMP[1]) / 2))} y={RY - 6} textAnchor="middle" fill="#cbd5e1" className="font-mono text-[11px]">lamp</text>
          {/* the selected pixel's last sample */}
          {last?.rays.map((r, k) => (
            <line key={k} x1={f2(sx(r.from[0]))} y1={f2(sy(r.from[1]))} x2={f2(sx(r.to[0]))} y2={f2(sy(r.to[1]))}
              stroke={r.kind === "path" ? DEPTH_COL[r.depth % DEPTH_COL.length] : r.kind === "shadow" ? "#fde047" : "#ef4444"}
              strokeWidth={r.kind === "path" ? 2.2 : 1.2} strokeDasharray={r.kind === "path" ? undefined : "4 4"} />
          ))}
          {last?.cacheP && <circle cx={f2(sx(last.cacheP[0]))} cy={f2(sy(last.cacheP[1]))} r={6} fill="none" stroke="#f59e0b" strokeWidth={2} />}
          {/* camera */}
          <line x1={f2(sx(CAM[0]))} y1={f2(sy(CAM[1]))} x2={f2(sx(CAM[0] + pd[0] * 0.12))} y2={f2(sy(CAM[1] + pd[1] * 0.12))} stroke="#e2e8f0" strokeWidth={1.5} />
          <circle cx={f2(sx(CAM[0]))} cy={f2(sy(CAM[1]))} r={6} fill="#e2e8f0" />
          {/* legend */}
          <g className="font-mono text-[11px]">
            <text x={RX + ROOM + 24} y={RY + 16} className="fill-muted-foreground">pixel {pix}, last sample</text>
            {[["camera ray", DEPTH_COL[0]], ["bounce 1", DEPTH_COL[1]], ["bounce 2", DEPTH_COL[2]], ["bounce 3+", DEPTH_COL[3]]].map(([t, c], k) => (
              <g key={t}>
                <line x1={RX + ROOM + 24} x2={RX + ROOM + 50} y1={RY + 38 + k * 18} y2={RY + 38 + k * 18} stroke={c} strokeWidth={2.2} />
                <text x={RX + ROOM + 58} y={RY + 42 + k * 18} className="fill-muted-foreground">{t}</text>
              </g>
            ))}
            <line x1={RX + ROOM + 24} x2={RX + ROOM + 50} y1={RY + 110} y2={RY + 110} stroke="#fde047" strokeDasharray="4 4" />
            <text x={RX + ROOM + 58} y={RY + 114} className="fill-muted-foreground">shadow ray, lamp seen</text>
            <line x1={RX + ROOM + 24} x2={RX + ROOM + 50} y1={RY + 128} y2={RY + 128} stroke="#ef4444" strokeDasharray="4 4" />
            <text x={RX + ROOM + 58} y={RY + 132} className="fill-muted-foreground">shadow ray, blocked</text>
            {live && (
              <>
                <rect x={RX + ROOM + 24} y={RY + 142} width={26} height={12} fill="none" stroke="#f59e0b" strokeWidth={2} />
                <text x={RX + ROOM + 58} y={RY + 152} className="fill-muted-foreground">cache cell read</text>
                <text x={RX + ROOM + 24} y={RY + 178} className="fill-muted-foreground">cells warm: {warm}</text>
              </>
            )}
            <text x={RX + ROOM + 24} y={RY + 220} className="fill-foreground text-[13px]">{spp} spp</text>
            <text x={RX + ROOM + 24} y={RY + 240} className="fill-foreground text-[13px]">error vs reference: {err === null ? "–" : `${(err * 100).toFixed(1)}%`}</text>
          </g>
          {/* the image, and the reference under it */}
          <text x={30} y={STRIP_Y - 6} className="fill-muted-foreground font-mono text-[11px]">this image</text>
          {img.map((c, i) => (
            <rect key={i} x={f2(30 + i * PX)} y={STRIP_Y} width={f2(PX + 0.4)} height={22} fill={spp ? toCss(c) : "transparent"} onClick={() => setPix(i)} style={{ cursor: "pointer" }} />
          ))}
          <rect x={f2(30 + pix * PX)} y={STRIP_Y - 2} width={f2(PX)} height={26} fill="none" className="stroke-foreground" strokeWidth={1.5} />
          <text x={30} y={STRIP_Y + 40} className="fill-muted-foreground font-mono text-[11px]">reference (1,024 spp, 8 bounces)</text>
          {ref?.map((c, i) => <rect key={i} x={f2(30 + i * PX)} y={STRIP_Y + 46} width={f2(PX + 0.4)} height={22} fill={toCss(c)} />)}
        </svg>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-t px-3 py-3 text-sm sm:px-4">
        <div className="flex gap-2">
          <button type="button" className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted" onClick={() => step(1)}>+1 spp</button>
          <button type="button" className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted" onClick={() => step(16)}>+16</button>
          <button type="button" className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted" onClick={() => setRun((v) => !v)}>{run ? "pause" : "run"}</button>
          <button type="button" className="rounded-md border px-2.5 py-1 font-mono text-xs hover:bg-muted" onClick={reset}>reset</button>
        </div>
        <label className="flex items-center gap-2">
          <span className="font-mono text-xs">bounces {bounces}</span>
          <Range min={0} max={6} step={1} value={bounces} onChange={(e) => change(() => setBounces(Number(e.target.value)))} className="w-28" />
        </label>
        <div className="flex overflow-hidden rounded-md border font-mono text-xs">
          {[["offline", false], ["live (cache)", true]].map(([t, v]) => (
            <button key={String(t)} type="button" className={`px-2.5 py-1 ${live === v ? "bg-foreground text-background" : "hover:bg-muted"}`} onClick={() => change(() => setLive(v as boolean))}>{t as string}</button>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">click a pixel to watch its paths</span>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground sm:px-4">
        A two-dimensional room and a one-row image, traced in your browser. Offline: every sample is a full path, with a shadow ray to the lamp at each vertex. Live: the camera hit gets its shadow ray, the path bounces once, and the light there is read from a grid cell that other samples trained (the orange square). Error is the relative RMS of luminance against the reference row.
      </figcaption>
    </figure>
  )
}

