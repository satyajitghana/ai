"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { mediaUrl } from "@/lib/media"

import type { MapView } from "./map-gl"

// The maps the runs built, in 3D. Server render: a poster (the oblique render) and a
// button. WebGL starts only on click; each .glb is fetched the first time its tab is chosen.

export type MapLayer = { label: string; src: string; note: string; mb: string }
export type MapScene = { label: string; poster: string; posterAlt: string; layers: MapLayer[] }

export function MapViewer({ scenes, caption }: { scenes: MapScene[]; caption: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const bytesRef = useRef(new Map<string, ArrayBuffer>())
  const [si, setSi] = useState(0)
  const [li, setLi] = useState(0)
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [count, setCount] = useState(0)
  const [error, setError] = useState("")
  const sc = scenes[si]
  const layer = sc.layers[Math.min(li, sc.layers.length - 1)]

  useEffect(() => () => viewRef.current?.dispose(), [])

  const load = async (s: number, l: number) => {
    const L = scenes[s].layers[l]
    setPhase("loading")
    setError("")
    try {
      let bytes = bytesRef.current.get(L.src)
      if (!bytes) {
        const res = await fetch(mediaUrl(L.src), { mode: "cors" })
        if (!res.ok) throw new Error(`The map did not download (HTTP ${res.status}).`)
        bytes = await res.arrayBuffer()
        bytesRef.current.set(L.src, bytes)
      }
      if (!viewRef.current) {
        const mod = await import("./map-gl")
        if (!canvasRef.current) return
        viewRef.current = mod.createMapView(canvasRef.current)
      }
      const n = await viewRef.current.show(bytes, L.src)
      setCount(n)
      setPhase("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The viewer could not start.")
      setPhase("error")
    }
  }

  const pickScene = (s: number) => {
    if (s === si) return
    // a new sequence is a new frame: start the viewer afresh
    viewRef.current?.dispose()
    viewRef.current = null
    setSi(s)
    setLi(0)
    if (phase === "ready" || phase === "loading") void load(s, 0)
  }
  const pickLayer = (l: number) => {
    setLi(l)
    if (phase === "ready" || phase === "loading") void load(si, l)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <div className="flex gap-1">
          {scenes.map((s, i) => (
            <button key={s.label} type="button" onClick={() => pickScene(i)} aria-pressed={si === i}
              className={cn("cursor-pointer rounded px-2 py-1 transition-colors", si === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {s.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {sc.layers.map((L, i) => (
            <button key={L.src} type="button" onClick={() => pickLayer(i)} aria-pressed={li === i}
              className={cn("cursor-pointer rounded border px-2 py-1 transition-colors", li === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
              {L.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full bg-[#0b0b0c]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label={`The ${layer.label} point map of ${sc.label}, coloured by height, which you can orbit with the mouse or a finger.`} />
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(sc.poster)} alt={sc.posterAlt} className="absolute inset-0 h-full w-full object-contain" />
        )}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button type="button" onClick={() => void load(si, li)} disabled={phase === "loading"}
              className="rounded-md border border-white/40 bg-black/60 px-4 py-2 font-mono text-sm text-white backdrop-blur">
              {phase === "loading" ? "loading…" : `View the map in 3D (${layer.mb})`}
            </button>
          </div>
        )}
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        {phase === "error" ? error : phase === "ready" ? `${count.toLocaleString("en-US")} points. ${layer.note}` : caption}
      </figcaption>
    </figure>
  )
}
