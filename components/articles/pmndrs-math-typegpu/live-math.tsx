"use client"

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"

import { createEngine, type Engine } from "./live-math-engine"

// pmndrs/math 0.1.0 itself, running in the reader's browser: a six-bone chain
// solved every frame by math/ik's fabrik2, standing on terrain from math/noise's
// simplex2d and fbm. Unlike the article's other widgets, which are our own code,
// every IK and noise number here comes from the library.
//
// The server renders a fixed-size shell with placeholder text: two canvases
// with a 4:3 aspect ratio, and readouts that say "—". The engine is created in
// an effect, after hydration, and it alone calls the library and draws, so no
// value the library computes (it uses Math.sin, Math.atan2, …) can reach SSR
// markup. Per-frame numbers are written straight into their spans, a few times a
// second, without re-rendering React.

const QUERY = "(prefers-reduced-motion: reduce)"
const subscribeMotion = (onChange: () => void) => {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
// the server assumes reduced motion; the browser answers for itself after hydration
const useReducedMotion = () =>
  useSyncExternalStore(
    subscribeMotion,
    () => window.matchMedia(QUERY).matches,
    () => true
  )

const ACCENT = "oklch(0.62 0.16 45)"

export function LiveMath() {
  const [seed, setSeed] = useState(7)
  const [octaves, setOctaves] = useState(5)
  const [limits, setLimits] = useState(false)
  const reduced = useReducedMotion()

  const root = useRef<HTMLElement>(null)
  const arm = useRef<HTMLCanvasElement>(null)
  const map = useRef<HTMLCanvasElement>(null)
  const status = useRef<HTMLSpanElement>(null)
  const solveNow = useRef<HTMLSpanElement>(null)
  const solveMean = useRef<HTMLSpanElement>(null)
  const solveLeft = useRef<HTMLSpanElement>(null)
  const build = useRef<HTMLSpanElement>(null)
  const terrainNow = useRef<HTMLSpanElement>(null)
  const terrainCalls = useRef<HTMLSpanElement>(null)
  const armCap = useRef<HTMLParagraphElement>(null)
  const mapCap = useRef<HTMLParagraphElement>(null)
  const engine = useRef<Engine | null>(null)

  useEffect(() => {
    const els = [root, arm, map, status, solveNow, solveMean, solveLeft, build, terrainNow, terrainCalls, armCap, mapCap]
    if (els.some((r) => !r.current)) return
    const e = createEngine(root.current!, arm.current!, map.current!, {
      status: status.current!,
      solveNow: solveNow.current!,
      solveMean: solveMean.current!,
      solveLeft: solveLeft.current!,
      build: build.current!,
      terrainNow: terrainNow.current!,
      terrainCalls: terrainCalls.current!,
      arm: armCap.current!,
      map: mapCap.current!,
    })
    const figure = root.current!
    figure.setAttribute("data-live", "")
    engine.current = e
    return () => {
      e.destroy()
      figure.removeAttribute("data-live")
      engine.current = null
    }
  }, [])
  useEffect(() => {
    engine.current?.setChain(limits)
  }, [limits])
  useEffect(() => {
    engine.current?.setTerrain(seed, octaves)
  }, [seed, octaves])
  useEffect(() => {
    engine.current?.setReduced(reduced)
  }, [reduced])

  const row = (label: string, value: ReactNode) => (
    <div key={label} className="contents">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  )

  return (
    <figure
      ref={root}
      className="group my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent"
      aria-label="pmndrs/math 0.1.0 running in your browser: a six-bone FABRIK chain reaching for a target on a noise terrain, and the heightfield that terrain is sliced from"
    >
      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="relative bg-background">
          <canvas
            ref={arm}
            width={480}
            height={360}
            tabIndex={0}
            role="application"
            aria-roledescription="IK target area"
            aria-label="Six-bone arm over a terrain slice. Left and right arrow keys move the target along the ground, up and down lift it; shift for bigger steps."
            className="block w-full cursor-crosshair outline-none focus-visible:ring-2 focus-visible:ring-foreground/40 focus-visible:ring-inset"
            style={{ aspectRatio: "4 / 3", touchAction: "pan-y" }}
          />
          <span className="pointer-events-none absolute inset-x-0 top-0 grid aspect-[4/3] place-items-center px-4 text-center font-mono text-xs text-muted-foreground group-data-[live]:hidden">
            fabrik2 runs here in your browser
          </span>
          <p ref={armCap} className="m-0 border-t px-3 py-2 font-mono text-[11px] leading-4 text-muted-foreground">
            A six-bone chain solved by fabrik2.solve, reaching for a target that sits on the terrain slice.
          </p>
        </div>
        <div className="relative bg-background">
          <canvas
            ref={map}
            width={480}
            height={360}
            role="img"
            aria-label="Shaded heightfield generated by simplex2d and fbm, with a dashed row marking the slice the arm stands on"
            className="block w-full"
            style={{ aspectRatio: "4 / 3" }}
          />
          <span className="pointer-events-none absolute inset-x-0 top-0 grid aspect-[4/3] place-items-center px-4 text-center font-mono text-xs text-muted-foreground group-data-[live]:hidden">
            simplex2d and fbm draw here in your browser
          </span>
          <p ref={mapCap} className="m-0 border-t px-3 py-2 font-mono text-[11px] leading-4 text-muted-foreground">
            Heightfield from simplex2d, shaded by its own central-difference normals; the dashed row is the slice on the left.
          </p>
        </div>
      </div>

      <div className="grid gap-x-6 gap-y-2 border-y px-4 py-3 font-mono text-xs text-muted-foreground sm:grid-cols-2">
        <label className="flex items-center gap-3">
          <span className="w-24 shrink-0">seed {seed}</span>
          <Range min={1} max={64} step={1} value={seed} onChange={(e) => setSeed(Number(e.currentTarget.value))} accent={ACCENT} aria-label="noise seed" className="w-full" />
        </label>
        <label className="flex items-center gap-3">
          <span className="w-24 shrink-0">octaves {octaves}</span>
          <Range min={1} max={8} step={1} value={octaves} onChange={(e) => setOctaves(Number(e.currentTarget.value))} accent={ACCENT} aria-label="fbm octaves" className="w-full" />
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={limits} onChange={(e) => setLimits(e.currentTarget.checked)} />
          <span className={limits ? "text-foreground" : undefined}>joint limits ±40° (setLocalJoint)</span>
        </label>
        <span>
          <span ref={status}>starts once the page&apos;s script has loaded</span>
        </span>
      </div>

      <div className="px-4 py-3">
        <div className="grid grid-cols-[minmax(0,8.5rem)_minmax(0,1fr)] gap-x-3 gap-y-1.5 font-mono text-[11px] leading-4 tabular-nums sm:grid-cols-[11rem_minmax(0,1fr)]">
          {row("chain built with", <span ref={build}>—</span>)}
          {row("every frame", "fabrik2.solve(chain, target)")}
          {row("your browser, this frame", <span ref={solveNow}>—</span>)}
          {row("mean", <span ref={solveMean}>—</span>)}
          {row("distance left", <span ref={solveLeft}>—</span>)}
          {row("terrain built with", "simplex2d.create(seed), then fbm(octave, octaves, 2, 0.5) per point")}
          {row("calls per rebuild", <span ref={terrainCalls}>—</span>)}
          {row("your browser, last rebuild", <span ref={terrainNow}>—</span>)}
        </div>
      </div>
    </figure>
  )
}
