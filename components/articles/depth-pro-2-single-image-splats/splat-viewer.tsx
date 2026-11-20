"use client"

// Single-photo Gaussian splats, viewable in the page. Server render: the photo and a button.
// Only on "View in 3D" are three.js and Spark imported (splat-gl.ts) and the scene's .spz fetched,
// with a progress bar; nothing else downloads before that. Photo / Depth / Splat swap what the
// frame shows: the photo and the depth map are images laid over the canvas with the same crop as
// the splat's input view, so the three line up when the camera is home. The splat starts with a
// slow arc out to the edge of what one photo supports and back, then hands the camera over.

import { useCallback, useEffect, useRef, useState } from "react"

import { ArrowCounterClockwiseIcon, ArrowsInSimpleIcon, ArrowsOutSimpleIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { mediaUrl } from "@/lib/media"

import { SCENES, type SplatScene } from "./scenes"
import type { View } from "./splat-gl"

type Phase = "idle" | "loading" | "ready" | "error"
type Show = "photo" | "depth" | "splat"

const mb = (n: number) => (n / 1048576).toFixed(1)

export function SplatViewer({ start = "hall" }: { start?: string }) {
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<View | null>(null)
  const cache = useRef(new Map<string, Uint8Array>())
  const loadSeq = useRef(0)
  const [phase, setPhase] = useState<Phase>("idle")
  const [sceneId, setSceneId] = useState(start)
  const [show, setShow] = useState<Show>("photo")
  const [got, setGot] = useState(0)
  const [total, setTotal] = useState(0)
  const [stage, setStage] = useState<"download" | "build">("download")
  const [error, setError] = useState("")
  const [isFull, setIsFull] = useState(false)
  const [arcing, setArcing] = useState(false)
  const [count, setCount] = useState(0)

  const scene: SplatScene = SCENES.find((s) => s.id === sceneId) ?? SCENES[0]

  useEffect(
    () => () => {
      viewRef.current?.dispose()
      viewRef.current = null
    },
    [],
  )
  useEffect(() => {
    const onFs = () => setIsFull(document.fullscreenElement === boxRef.current)
    document.addEventListener("fullscreenchange", onFs)
    return () => document.removeEventListener("fullscreenchange", onFs)
  }, [])

  const fetchBytes = async (s: SplatScene, seq: number) => {
    const hit = cache.current.get(s.id)
    if (hit) return hit
    const res = await fetch(mediaUrl(s.splat), { mode: "cors" })
    if (!res.ok) throw new Error(`The splat did not download (HTTP ${res.status}).`)
    const size = Number(res.headers.get("content-length")) || 0
    setTotal(size)
    let out: Uint8Array
    if (res.body) {
      const reader = res.body.getReader()
      const chunks: Uint8Array[] = []
      let n = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
        n += value.length
        if (seq === loadSeq.current) setGot(n)
      }
      out = new Uint8Array(n)
      let at = 0
      for (const c of chunks) {
        out.set(c, at)
        at += c.length
      }
    } else out = new Uint8Array(await res.arrayBuffer())
    cache.current.set(s.id, out)
    return out
  }

  const open = useCallback(
    async (id: string) => {
      const s = SCENES.find((x) => x.id === id) ?? SCENES[0]
      const seq = ++loadSeq.current
      setPhase("loading")
      setStage("download")
      setGot(0)
      setTotal(0)
      setError("")
      try {
        if (!document.createElement("canvas").getContext("webgl2")) throw new Error("This browser has no WebGL2, so the splat cannot be shown here.")
        const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
        const [mod, bytes] = await Promise.all([import("./splat-gl"), fetchBytes(s, seq)])
        if (seq !== loadSeq.current) return
        setStage("build")
        await new Promise((r) => requestAnimationFrame(() => r(null)))
        const canvas = canvasRef.current
        if (!canvas) return
        if (!viewRef.current)
          viewRef.current = mod.createView(canvas, {
            reduced,
            onUser: () => setArcing(false),
            onArcEnd: () => setArcing(false),
          })
        await viewRef.current.load(bytes, s)
        if (seq !== loadSeq.current) return
        setCount(viewRef.current.count())
        setPhase("ready")
        setShow("splat")
        viewRef.current.arc(!reduced)
        setArcing(!reduced)
      } catch (e) {
        if (seq !== loadSeq.current) return
        const msg = e instanceof Error ? e.message : String(e)
        setError(/fetch|network|load failed/i.test(msg) ? "The splat could not be downloaded. Check the connection and try again." : msg)
        setPhase("error")
      }
    },
    // fetchBytes only touches refs and setters
    [],
  )

  const pick = (id: string) => {
    if (id === sceneId && phase !== "error") return
    setSceneId(id)
    if (phase === "idle") {
      setShow("photo")
      return
    }
    void open(id)
  }
  const replay = () => {
    viewRef.current?.arc(true)
    setArcing(true)
    setShow("splat")
  }
  const fullscreen = () => {
    const el = boxRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else el.requestFullscreen?.().catch(() => {})
  }

  const btn = "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
  const on = "bg-foreground text-background hover:bg-foreground/90"
  const off = "hover:bg-muted"
  const live = phase === "ready" || (phase === "loading" && viewRef.current !== null)
  const overlay = phase !== "ready" || show !== "splat"

  return (
    <figure data-splat-viewer={phase} className="not-prose my-8 overflow-hidden rounded-xl border">
      <div ref={boxRef} className="relative aspect-[4/3] w-full bg-[#0b0b0c] sm:aspect-[16/10]">
        <canvas
          ref={canvasRef}
          tabIndex={0}
          role="application"
          aria-label={`3D Gaussian splat made by SHARP from one photo: ${scene.label}. Drag to turn about the photo's own view, scroll or pinch to move in and out.`}
          className={live ? "absolute inset-0 h-full w-full touch-none outline-none focus-visible:ring-2 focus-visible:ring-ring" : "hidden"}
        />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={mediaUrl(show === "depth" && phase === "ready" ? scene.depthMap : scene.photo)}
          alt={show === "depth" && phase === "ready" ? `Depth Pro 2's depth map of the same photo, red near and blue far.` : scene.alt}
          className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${overlay ? "opacity-100" : "pointer-events-none opacity-0"}`}
          loading="lazy"
          draggable={false}
        />
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-end justify-center bg-gradient-to-t from-black/55 via-transparent to-transparent p-4 sm:items-center sm:bg-black/10">
            {phase === "loading" ? (
              <div role="status" aria-live="polite" className="flex w-64 max-w-[85%] flex-col gap-2 rounded-lg bg-background/95 px-4 py-3 shadow-md">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <span aria-hidden className="size-3.5 shrink-0 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
                  {stage === "download" ? "Downloading the splat" : "Sorting the Gaussians"}
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  {stage === "download" && total ? (
                    <div className="h-full rounded-full bg-foreground transition-[width] duration-200" style={{ width: `${Math.min(100, (got / total) * 100).toFixed(1)}%` }} />
                  ) : (
                    <div className="h-full w-1/3 animate-pulse rounded-full bg-foreground" />
                  )}
                </div>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {stage === "download" ? (total ? `${mb(Math.min(got, total))} of ${mb(total)} MB` : `${mb(got)} MB`) : "decoding the .spz"}
                </p>
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
                  onClick={() => void open(sceneId)}
                  className="rounded-lg bg-background/95 px-4 py-2 text-sm font-semibold shadow-md hover:bg-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {phase === "error" ? "Try again" : "View in 3D"}
                </button>
                {phase !== "error" && <span className="rounded bg-black/55 px-2 py-0.5 font-mono text-[11px] text-white">{`${scene.size}, WebGL2`}</span>}
              </div>
            )}
          </div>
        )}
        {phase === "ready" && (
          <div className="absolute right-2 top-2 flex gap-1.5">
            <button
              type="button"
              onClick={replay}
              disabled={arcing}
              className="grid size-8 place-items-center rounded-md border bg-background/85 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              aria-label="Play the arc again"
              title="Play the arc again"
            >
              <PlayIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                viewRef.current?.home()
                setArcing(false)
              }}
              className="grid size-8 place-items-center rounded-md border bg-background/85 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Back to the photo's own view"
              title="Back to the photo's own view"
            >
              <ArrowCounterClockwiseIcon className="size-4" />
            </button>
            {/* rendered only after a click, so reading document here cannot mismatch the server render */}
            {document.fullscreenEnabled && (
              <button
                type="button"
                onClick={fullscreen}
                className="grid size-8 place-items-center rounded-md border bg-background/85 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={isFull ? "Exit full screen" : "Full screen"}
                title={isFull ? "Exit full screen" : "Full screen"}
              >
                {isFull ? <ArrowsInSimpleIcon className="size-4" /> : <ArrowsOutSimpleIcon className="size-4" />}
              </button>
            )}
          </div>
        )}
        {phase === "ready" && show !== "splat" && (
          <span className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-0.5 font-mono text-[11px] text-white">{show === "photo" ? "the input photo" : "Depth Pro 2 depth, red near"}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t px-3 py-2.5">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Scene">
          {SCENES.map((s) => (
            <button key={s.id} type="button" aria-pressed={s.id === sceneId} onClick={() => pick(s.id)} className={`${btn} ${s.id === sceneId ? on : off}`}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1" role="group" aria-label="What to show">
          {(["photo", "depth", "splat"] as const).map((k) => (
            <button
              key={k}
              type="button"
              aria-pressed={phase === "ready" ? show === k : k === "photo"}
              disabled={phase !== "ready"}
              onClick={() => setShow(k)}
              className={`${btn} ${(phase === "ready" ? show === k : k === "photo") ? on : off}`}
            >
              {k === "photo" ? "Photo" : k === "depth" ? "Depth" : "Splat"}
            </button>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {phase === "ready" ? (
          <>
            {`${count.toLocaleString("en-US")} Gaussians from one photo. Drag to turn about the photographer's position, scroll or pinch to move. The swing is limited to a few degrees past where the scene stops holding; at its edges you see the streaks and holes behind every edge. `}
            <a href={scene.page} className="underline underline-offset-2">
              Photo: {scene.credit}
            </a>
            .
          </>
        ) : (
          <>
            {"Four CC0 photos from Wikimedia Commons, each turned into over half a million Gaussians by Apple's SHARP on an RTX 3090, with depth from Depth Pro 2. Pick a scene, then View in 3D. "}
            <a href={scene.page} className="underline underline-offset-2">
              Photo: {scene.credit}
            </a>
            .
          </>
        )}
      </figcaption>
    </figure>
  )
}
