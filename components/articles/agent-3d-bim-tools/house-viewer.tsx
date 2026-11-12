"use client"

// The beach house we built with the one-prompt method, explorable in the page.
// Server render: the poster and a button, nothing else. WebGL starts only when
// the reader clicks "Explore in 3D": then the renderer module and the .glb
// (lighting baked into three JPEG atlases, about 6 MB) are fetched, parsed by
// our own loader (house-gl.ts) and drawn with plain WebGL2.

import { useCallback, useEffect, useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

import type { Mode, Viewer } from "./house-gl"

const GLB = "/articles/agent-3d-bim-tools/house.glb"
const POSTER = "/articles/agent-3d-bim-tools/house-poster.jpg"
const DOWNLOAD = "about 6 MB"

const PLACES: { id: string; label: string }[] = [
  { id: "aerial", label: "Overview" },
  { id: "hero", label: "From the waterline" },
  { id: "boardwalk", label: "Boardwalk" },
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

export function HouseViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Viewer | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [pct, setPct] = useState(0)
  const [error, setError] = useState("")
  const [mode, setMode] = useState<Mode>("orbit")
  const [place, setPlace] = useState("aerial")

  useEffect(() => () => viewerRef.current?.dispose(), [])
  // focus the canvas once it is shown, so the keys work without another click
  useEffect(() => {
    if (phase === "ready") canvasRef.current?.focus({ preventScroll: true })
  }, [phase])

  const start = useCallback(async () => {
    if (phase === "loading" || phase === "ready") return
    setPhase("loading")
    setError("")
    try {
      const probe = document.createElement("canvas").getContext("webgl2")
      if (!probe) throw new Error("This browser has no WebGL2, so the model cannot be shown here.")
      const [{ createViewer, parseGlb }, res] = await Promise.all([import("./house-gl"), fetch(mediaUrl(GLB), { mode: "cors" })])
      if (!res.ok) throw new Error(`The model did not download (HTTP ${res.status}).`)
      const total = Number(res.headers.get("content-length")) || 0
      let buf: ArrayBuffer
      if (res.body) {
        // content-length is only a hint for the percentage: a compressed response announces fewer bytes than it yields
        const reader = res.body.getReader()
        const chunks: Uint8Array[] = []
        let got = 0
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          got += value.length
          if (total) setPct(Math.min(99, Math.round((got / total) * 100)))
        }
        const out = new Uint8Array(got)
        let at = 0
        for (const c of chunks) {
          out.set(c, at)
          at += c.length
        }
        buf = out.buffer
      } else buf = await res.arrayBuffer()
      const scene = await parseGlb(buf)
      const canvas = canvasRef.current
      if (!canvas) return
      viewerRef.current = createViewer(canvas, scene, { onMode: setMode, start: "aerial" })
      setPhase("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase("error")
    }
  }, [phase])

  const choose = (m: Mode) => {
    viewerRef.current?.setMode(m)
    setMode(m)
    canvasRef.current?.focus({ preventScroll: true })
  }
  const go = (id: string) => {
    setPlace(id)
    const outside = id === "aerial" || id === "hero" || id === "boardwalk"
    const v = viewerRef.current
    if (!v) return
    v.setMode(outside ? "orbit" : "walk")
    v.goTo(id)
    canvasRef.current?.focus({ preventScroll: true })
  }
  const fullscreen = () => {
    const el = boxRef.current
    if (!el) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else void el.requestFullscreen?.()
  }

  const btn = "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
  const on = "bg-foreground text-background hover:bg-foreground/90"

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border">
      <div ref={boxRef} className="relative aspect-[16/10] w-full bg-muted sm:aspect-video">
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(POSTER)}
            alt="A two-storey beach house with sea-glass blue siding, white trim and a dark metal roof, standing on piers behind a dune. A wraparound deck and an upstairs balcony face the sea, and a boardwalk runs down through dune grass to the sand."
            className="absolute inset-0 h-full w-full object-cover"
            loading="lazy"
          />
        )}
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label="3D model of the beach house. Orbit mode: drag to turn, scroll or pinch to zoom, shift-drag to pan, arrow keys turn. Walk mode: W A S D or arrow keys to move, drag to look, shift to run."
          className={phase === "ready" ? "absolute inset-0 h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring" : "hidden"}
        />
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/50 via-transparent to-transparent p-4 sm:items-center sm:bg-black/10">
            {phase === "loading" ? (
              <p className="rounded-md bg-background/90 px-3 py-2 font-mono text-xs" role="status">
                Loading the model{pct ? ` ${pct}%` : ""}
              </p>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <button type="button" onClick={start} className="rounded-lg bg-background/95 px-4 py-2 text-sm font-semibold shadow-md hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  Explore in 3D
                </button>
                <span className="rounded bg-black/50 px-2 py-0.5 font-mono text-[11px] text-white">{phase === "error" ? error : `${DOWNLOAD}, WebGL2`}</span>
              </div>
            )}
          </div>
        )}
        {phase === "ready" && (
          <button type="button" onClick={fullscreen} className={`absolute right-2 top-2 bg-background/85 ${btn}`} aria-label="Toggle full screen">
            Full screen
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
              {PLACES.map((p) => (
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
              setPlace("aerial")
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
          : "The beach house from our run of the one-prompt loop. Its lighting was baked in Blender, so what you see is the same late-afternoon sun from every angle. Drag to orbit, scroll or pinch to zoom, or switch to Walk and go inside."}
      </figcaption>
    </figure>
  )
}
