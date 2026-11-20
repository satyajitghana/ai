"use client"

// A working cluster-LOD demo: a procedural rock is clustered, simplified into a DAG and drawn
// as 25 copies, each with its own cut, chosen every frame by projected error in pixels.
// Server render: a poster and a button. Nothing heavy loads until the click: then
// ./engine (three.js, OrbitControls, meshoptimizer's WASM) is imported, the DAG is built in
// the page, and the canvas takes over.

import { useCallback, useEffect, useRef, useState } from "react"

import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr"

import { Range } from "@/components/articles/ui/range"
import { mediaUrl } from "@/lib/media"

import type { Demo, DemoInfo, DemoStats, Mode } from "./engine"
import { LEVEL_COLORS } from "./palette"

const POSTER = "/articles/three-nanite/demo-poster.jpg"
const TAUS = [0.5, 1, 1.5, 2, 3, 4, 6, 8, 12, 16]

const fmt = (n: number) => Math.round(n).toLocaleString("en-US")

export function NaniteDemo() {
  const boxRef = useRef<HTMLDivElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)
  const demoRef = useRef<Demo | null>(null)
  const cancelRef = useRef({ cancelled: false })
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [progress, setProgress] = useState({ msg: "", frac: 0 })
  const [error, setError] = useState("")
  const [tauI, setTauI] = useState(1)
  const [mode, setMode] = useState<Mode>("clusters")
  const [frozen, setFrozen] = useState(false)
  const [stats, setStats] = useState<DemoStats | null>(null)
  const [info, setInfo] = useState<DemoInfo | null>(null)
  const [isFull, setIsFull] = useState(false)

  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === boxRef.current)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  // pause the render loop while the demo is off screen
  useEffect(() => {
    const el = boxRef.current
    if (!el || phase !== "ready") return
    const io = new IntersectionObserver(([e]) => demoRef.current?.setActive(e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [phase])

  useEffect(() => {
    const cancel = cancelRef.current
    return () => {
      cancel.cancelled = true
      demoRef.current?.dispose()
      demoRef.current = null
    }
  }, [])

  const start = useCallback(async () => {
    if (!hostRef.current) return
    setPhase("loading")
    setError("")
    // one signal object for the component's life, so unmount cancels a build in progress
    const signal = cancelRef.current
    signal.cancelled = false
    // a phone gets a 330k-triangle rock, a wider screen a 1.3M one
    const big = window.innerWidth >= 768
    try {
      const { createDemo } = await import("./engine")
      const demo = await createDemo(
        hostRef.current,
        { subdiv: big ? 8 : 7 },
        (msg, frac) => setProgress({ msg, frac }),
        setStats,
        signal,
      )
      if (!demo || signal.cancelled) {
        demo?.dispose()
        return
      }
      demoRef.current = demo
      demo.setTau(TAUS[tauI])
      demo.setMode(mode)
      setInfo(demo.info)
      setPhase("ready")
    } catch (e) {
      if (signal.cancelled) return
      setError(e instanceof Error ? e.message : String(e))
      setPhase("error")
    }
  }, [tauI, mode])

  const fullscreen = () => {
    const el = boxRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  const btn = "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const on = "bg-foreground text-background"
  const off = "hover:bg-muted"
  const tau = TAUS[tauI]

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border" data-nanite-demo={phase}>
      <div ref={boxRef} className="relative aspect-[4/3] w-full bg-[#1b1f27] sm:aspect-video">
        <div
          ref={hostRef}
          role="application"
          aria-label="Cluster LOD demo: 25 procedural rocks. Drag to orbit, scroll or pinch to zoom."
          className={phase === "ready" ? "absolute inset-0" : "absolute inset-0 opacity-0"}
        />
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(POSTER)}
            alt="Twenty-five grey rocks on a dark ground, each painted in patches of colour, one patch per triangle cluster: small patches on the near rocks, large ones on the far rocks."
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/60 via-black/10 to-transparent p-4 sm:items-center">
            {phase === "loading" ? (
              <div role="status" aria-live="polite" className="flex w-72 max-w-[85%] flex-col gap-2 rounded-lg bg-background/95 px-4 py-3 shadow-md">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                  Building the cluster DAG
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.round(progress.frac * 100)}%` }} />
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">{progress.msg || "loading three.js"}</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {phase === "error" && (
                  <p role="alert" className="max-w-xs rounded-md bg-background/95 px-3 py-2 text-center text-xs text-red-700 shadow-md dark:text-red-400">
                    {error}
                  </p>
                )}
                <button
                  type="button"
                  onClick={start}
                  className="rounded-lg bg-background/95 px-4 py-2 text-sm font-semibold shadow-md hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {phase === "error" ? "Try again" : "Run it"}
                </button>
                <span className="rounded bg-black/55 px-2 py-0.5 text-center font-mono text-[11px] text-white">
                  1.3M-triangle rock x 25 (330k on a phone), built in your browser
                </span>
              </div>
            )}
          </div>
        )}
        {phase === "ready" && stats && (
          <div
            className="pointer-events-none absolute left-2 top-2 rounded-md bg-black/60 px-2 py-1.5 font-mono text-[11px] leading-snug text-white sm:text-xs"
            aria-live="off"
            data-tris={Math.round(stats.tris)}
            data-clusters={stats.clusters}
          >
            <div>
              <span className="text-white/60">scene </span>
              {fmt(stats.sourceTris)} tris
            </div>
            <div>
              <span className="text-white/60">drawn </span>
              <span className="font-semibold text-amber-300">{fmt(stats.tris)}</span> tris, {fmt(stats.clusters)} clusters
            </div>
            <div data-frame-line>
              <span className="text-white/60">frame </span>
              {stats.frameMs.toFixed(1)} ms<span className="text-white/60"> cut </span>
              {stats.cutMs.toFixed(1)} ms
            </div>
            {stats.capped && <div className="text-red-300">draw list full: some clusters skipped</div>}
            {!stats.multiDraw && <div className="text-amber-200">no WEBGL_multi_draw: one draw call per cluster</div>}
          </div>
        )}
        {/* rendered only after a click, so reading document here cannot mismatch the server render; iPhone Safari has no element full screen */}
        {phase === "ready" && document.fullscreenEnabled && (
          <button
            type="button"
            onClick={fullscreen}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-md border border-white/20 bg-black/50 text-white transition-colors hover:bg-black/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isFull ? "Exit full screen" : "Full screen"}
            title={isFull ? "Exit full screen" : "Full screen"}
          >
            {isFull ? <ArrowsInSimpleIcon className="size-4" /> : <ArrowsOutSimpleIcon className="size-4" />}
          </button>
        )}
        {phase === "ready" && mode === "levels" && (
          <div className="pointer-events-none absolute bottom-2 left-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 font-mono text-[10px] text-white">
            <span className="text-white/70">level</span>
            <span>0</span>
            {LEVEL_COLORS.slice(0, info ? info.levels : 8).map((c) => (
              <span key={c} className="inline-block h-2.5 w-2 first:rounded-l-sm last:rounded-r-sm sm:w-2.5" style={{ background: c }} />
            ))}
            <span>{info ? info.levels - 1 : ""}</span>
            <span className="text-white/70">(source to coarsest)</span>
          </div>
        )}
      </div>
      {phase === "ready" && (
        <div className="flex flex-col gap-2.5 border-t px-3 py-2.5 sm:flex-row sm:flex-wrap sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-2 font-mono text-xs text-muted-foreground">
            <span className="shrink-0">error τ</span>
            <Range
              min={0}
              max={TAUS.length - 1}
              step={1}
              value={tauI}
              aria-label="Demo error threshold in pixels"
              aria-valuetext={`${tau} pixels`}
              onChange={(e) => {
                const i = Number(e.target.value)
                setTauI(i)
                demoRef.current?.setTau(TAUS[i])
              }}
              className="min-w-0 flex-1"
            />
            <span className="w-12 shrink-0 text-right text-foreground">{tau} px</span>
          </label>
          <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Colour by">
            {(["shaded", "clusters", "levels"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={mode === m}
                data-mode={m}
                onClick={() => {
                  setMode(m)
                  demoRef.current?.setMode(m)
                }}
                className={`${btn} ${mode === m ? on : off}`}
              >
                {m}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={frozen}
              data-freeze
              onClick={() => {
                setFrozen(!frozen)
                demoRef.current?.setFrozen(!frozen)
              }}
              className={`${btn} ${frozen ? on : off}`}
              title="Keep the current cut while you move the camera"
            >
              {frozen ? "cut frozen" : "freeze cut"}
            </button>
          </div>
        </div>
      )}
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {info
          ? `One rock of ${fmt(info.rockTris)} triangles became ${fmt(info.clusters)} clusters in ${fmt(info.groups)} groups over ${info.levels} levels, built here in ${fmt(info.buildMs)} ms. Every copy picks its own cut each frame. Drag to orbit, scroll or pinch to zoom; freeze the cut and fly around to see what was chosen for the old viewpoint.`
          : "A dense procedural rock, clustered and simplified into a crack-free DAG in your browser, then drawn as 25 copies that each choose their own cut by projected error. Nothing loads until you press Run it."}
      </figcaption>
    </figure>
  )
}
