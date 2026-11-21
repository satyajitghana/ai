"use client"

// A beach house built with the one-prompt method, explorable in the page. With
// no props it is the first house (Opus 5.5's); `src`, `poster`, `places` and the
// other optional props point the same viewer at another build of the brief.
// Server render: the poster and a button, nothing else. WebGL starts only when
// the reader clicks "Explore in 3D": then the renderer module and the .glb
// (lighting baked into three JPEG atlases, about 6 MB) are fetched, parsed by
// our own loader (house-gl.ts) and drawn with plain WebGL2.

import { useCallback, useEffect, useRef, useState } from "react"

import { ArrowsInSimpleIcon, ArrowsOutSimpleIcon } from "@phosphor-icons/react/dist/ssr"

import { mediaUrl } from "@/lib/media"

import type { Mode, Viewer } from "./house-gl"

const GLB = "/articles/agent-3d-bim-tools/house.glb"
const POSTER = "/articles/agent-3d-bim-tools/house-poster.jpg"
const DOWNLOAD = "about 6 MB"

const POSTER_ALT =
  "A two-storey beach house with sea-glass blue siding, white trim and a dark metal roof, standing on piers behind a dune. A wraparound deck and an upstairs balcony face the sea, and a boardwalk runs down through dune grass to the sand."
const CAPTION =
  "The beach house from our run of the one-prompt loop. Its lighting was baked in Blender, so what you see is the same late-afternoon sun from every angle. Drag to orbit, scroll or pinch to zoom, or switch to Walk and go inside."

/** One entry of the "Go to" list: `id` is a view name stored in the .glb (scene.extras.views). */
export type HousePlace = { id: string; label: string; /** seen from outside: shown in Orbit rather than Walk */ outside?: boolean }

export type HouseViewerProps = {
  /** site path of the .glb (goes through mediaUrl). Default: the first house. */
  src?: string
  /** site path of the poster shown before WebGL starts */
  poster?: string
  posterAlt?: string
  /** what the canvas is called for screen readers, e.g. "the beach house" */
  label?: string
  /** the size note under the button, e.g. "about 6 MB" */
  download?: string
  /** the "Go to" list; ids must be views in the .glb */
  places?: HousePlace[]
  /** the view the camera starts at and "Reset view" returns to */
  start?: string
  /** the view the walker is dropped at when Walk is chosen from outside (default: the .glb's "walk", else "deck") */
  walkStart?: string
  /** the orbit-mode caption */
  caption?: string
}

const PLACES: HousePlace[] = [
  { id: "aerial", label: "Overview", outside: true },
  { id: "hero", label: "From the waterline", outside: true },
  { id: "boardwalk", label: "Boardwalk", outside: true },
  { id: "deck", label: "Front deck" },
  { id: "living", label: "Living room" },
  { id: "kitchen", label: "Kitchen and dining" },
  { id: "stair", label: "Top of the stairs" },
  { id: "master", label: "Main bedroom" },
  { id: "bed2", label: "Twin bedroom" },
  { id: "bath", label: "Bathroom" },
  { id: "balcony", label: "Balcony" },
]

type Phase = "idle" | "loading" | "ready" | "error"
/** what the loader is doing: the download, then decoding the atlases and building the buffers */
type Stage = "download" | "build"

const mb = (n: number) => (n / 1048576).toFixed(1)
/** "about 6 MB" → bytes, the size to show progress against when the response has no content-length */
const expectedBytes = (s: string) => {
  const m = /([\d.]+)\s*MB/i.exec(s)
  return m ? Number(m[1]) * 1048576 : 0
}

export function HouseViewer({
  src = GLB,
  poster = POSTER,
  posterAlt = POSTER_ALT,
  label = "the beach house",
  download = DOWNLOAD,
  places = PLACES,
  start: startView = "aerial",
  walkStart,
  caption = CAPTION,
}: HouseViewerProps = {}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [got, setGot] = useState(0)
  const [total, setTotal] = useState(0)
  const [stage, setStage] = useState<Stage>("download")
  const [isFull, setIsFull] = useState(false)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<Mode>("orbit")
  const [place, setPlace] = useState(startView)

  useEffect(() => () => viewerRef.current?.dispose(), [])
  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === boxRef.current)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])
  // focus the canvas once it is shown, so the keys work without another click
  useEffect(() => {
    if (phase === "ready") canvasRef.current?.focus({ preventScroll: true })
  }, [phase])

  const start = useCallback(async () => {
    if (phase === "loading" || phase === "ready") return
    setPhase("loading")
    setStage("download")
    setGot(0)
    setTotal(0)
    setError("")
    try {
      const probe = document.createElement("canvas").getContext("webgl2")
      if (!probe) throw new Error("This browser has no WebGL2, so the model cannot be shown here.")
      const [{ createViewer, parseGlb }, res] = await Promise.all([import("./house-gl"), fetch(mediaUrl(src), { mode: "cors" })])
      if (!res.ok) throw new Error(`The model did not download (HTTP ${res.status}).`)
      // content-length is missing when the CDN compresses on the fly; fall back to the size we know
      const size = Number(res.headers.get("content-length")) || expectedBytes(download)
      setTotal(size)
      let buf: ArrayBuffer
      if (res.body) {
        // content-length is only a hint for the percentage: a compressed response announces fewer bytes than it yields
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let n = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          n += value.length
          setGot(n)
        }
        const out = new Uint8Array(n)
        let at = 0
        for (const c of chunks) {
          out.set(c, at)
          at += c.length
        }
        buf = out.buffer
      } else buf = await res.arrayBuffer()
      setStage("build")
      // let the "Preparing" state paint before the atlases are decoded
      await new Promise((r) => requestAnimationFrame(() => r(null)))
      const scene = await parseGlb(buf)
      const canvas = canvasRef.current
      if (!canvas) return
      viewerRef.current = createViewer(canvas, scene, { onMode: setMode, start: startView, walkStart })
      setPhase("ready")
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      // a fetch that never got a response (offline, blocked, CORS) only says "Failed to fetch"
      setError(/fetch|network|load failed/i.test(msg) ? "The model could not be downloaded. Check the connection and try again." : msg)
      setPhase("error")
    }
  }, [phase, src, startView, walkStart, download])

  const choose = (m: Mode) => {
    viewerRef.current?.setMode(m)
    setMode(m)
    canvasRef.current?.focus({ preventScroll: true })
  }
  const go = (id: string) => {
    setPlace(id)
    const outside = places.find((p) => p.id === id)?.outside ?? false
    const v = viewerRef.current
    if (!v) return
    v.setMode(outside ? "orbit" : "walk")
    v.goTo(id)
    canvasRef.current?.focus({ preventScroll: true })
  }
  const fullscreen = () => {
    const el = boxRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  const btn = "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const on = "bg-foreground text-background hover:bg-foreground/90"

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border">
      <div ref={boxRef} className="relative aspect-[16/10] w-full bg-muted sm:aspect-video">
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(poster)}
            alt={posterAlt}
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`3D model of ${label}. Orbit mode: drag to turn, scroll or pinch to zoom, shift-drag to pan, arrow keys turn. Walk mode: W A S D or arrow keys to move, drag to look, shift to run.`}
          className={phase === "ready" ? "absolute inset-0 h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring" : "hidden"}
        />
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent p-4 sm:items-center sm:bg-black/10">
            {phase === "loading" ? (
              <div role="status" aria-live="polite" className="flex w-64 max-w-[80%] flex-col gap-2 rounded-lg bg-background/95 px-4 py-3 shadow-md">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                  {stage === "download" ? "Downloading the model" : "Preparing the scene"}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  {stage === "download" && total ? (
                    <div className="h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.min(100, (got / total) * 100).toFixed(1)}%` }} />
                  ) : (
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-foreground" />
                  )}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {stage === "download" ? (total ? `${mb(Math.min(got, total))} of ${mb(total)} MB` : `${mb(got)} MB`) : "decoding textures"}
                </p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                {phase === "error" && (
                  <p role="alert" className="max-w-xs rounded-md bg-background/95 px-3 py-2 text-center text-xs text-red-700 shadow-md dark:text-red-400">
                    {error}
                  </p>
                )}
                <button type="button" onClick={start} className="rounded-lg bg-background/95 px-4 py-2 text-sm font-semibold shadow-md hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  {phase === "error" ? "Try again" : "Explore in 3D"}
                </button>
                {phase !== "error" && <span className="rounded bg-black/50 px-2 py-0.5 font-mono text-[11px] text-white">{`${download}, WebGL2`}</span>}
              </div>
            )}
          </div>
        )}
        {/* rendered only after a click, so reading document here cannot mismatch the server render; iPhone Safari has no element full screen */}
        {phase === "ready" && document.fullscreenEnabled && (
          <button
            type="button"
            onClick={fullscreen}
            className="absolute right-2 top-2 grid size-8 place-items-center rounded-md border bg-background/85 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={isFull ? "Exit full screen" : "Full screen"}
            title={isFull ? "Exit full screen" : "Full screen"}
          >
            {isFull ? <ArrowsInSimpleIcon className="size-4" /> : <ArrowsOutSimpleIcon className="size-4" />}
          </button>
        )}
      </div>
      {phase === "ready" && (
        <div className="flex flex-wrap items-center gap-2 border-t px-3 py-2.5">
          <div className="flex gap-1" role="group" aria-label="Camera mode">
            <button type="button" aria-pressed={mode === "orbit"} onClick={() => choose("orbit")} className={`${btn} ${mode === "orbit" ? on : ""}`}>
              Orbit
            </button>
            <button type="button" aria-pressed={mode === "walk"} onClick={() => choose("walk")} className={`${btn} ${mode === "walk" ? on : ""}`}>
              Walk
            </button>
          </div>
          <label className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
            Go to
            <select value={place} onChange={(e) => go(e.target.value)} className="rounded-md border bg-background px-1.5 py-1 font-mono text-xs text-foreground">
              {places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              viewerRef.current?.reset()
              setPlace(startView)
            }}
            className={btn}
          >
            Reset view
          </button>
        </div>
      )}
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {mode === "walk" && phase === "ready"
          ? "Walk: W A S D or the arrow keys to move, drag to look, Shift to run. On a phone, drag from the lower left to move. Stairs and the deck steps climb as you walk into them."
          : caption}
      </figcaption>
    </figure>
  )
}
