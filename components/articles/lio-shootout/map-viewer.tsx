"use client"

// Every system's map of one sequence, swappable in place: the harness aligned each map into the
// reference frame with its own trajectory's alignment and centred them on the same origin, so a
// switch shows the difference between two estimates, not a jump between two frames. Server render:
// the first map's top-down render and a button; WebGL starts on click; a .glb is fetched the first
// time it is chosen.

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"
import { mediaUrl } from "@/lib/media"

import { MAPS, SEQS } from "./data"
import { label } from "./labels"
import type { MapView } from "./map-gl"

export function MapViewer() {
  const seqs = SEQS.filter((s) => (MAPS[s.key] ?? []).length > 0)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const bytesRef = useRef(new Map<string, ArrayBuffer>())
  const [si, setSi] = useState(0)
  const [li, setLi] = useState(0)
  const [phase, setPhase] = useState<"idle" | "loading" | "ready" | "error">("idle")
  const [count, setCount] = useState(0)
  const [error, setError] = useState("")
  const seq = seqs[si]
  const layers = (MAPS[seq.key] ?? []).filter((m) => !m.key.startsWith("gtreplay__"))
  const layer = layers[Math.min(li, layers.length - 1)]
  const poster = layer.src.replace(/\.glb$/, "-top.png")

  useEffect(() => () => viewRef.current?.dispose(), [])

  const load = async (s: number, l: number) => {
    const L = (MAPS[seqs[s].key] ?? []).filter((m) => !m.key.startsWith("gtreplay__"))[l]
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
      setCount(await viewRef.current.show(bytes, L.src))
      setPhase("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The viewer could not start.")
      setPhase("error")
    }
  }
  const pickSeq = (s: number) => {
    if (s === si) return
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
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        {seqs.map((s, i) => (
          <button key={s.key} type="button" onClick={() => pickSeq(i)} aria-pressed={si === i}
            className={cn("cursor-pointer rounded px-2 py-1 transition-colors", si === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {s.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs">
        {layers.map((m, i) => (
          <button key={m.src} type="button" onClick={() => pickLayer(i)} aria-pressed={li === i}
            className={cn("cursor-pointer rounded border px-2 py-1 transition-colors", li === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
            {label(m.key)}
          </button>
        ))}
      </div>
      <div className="relative aspect-[16/10] w-full bg-[#0b0b0c]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full"
          aria-label={`The ${label(layer.key)} point map of ${seq.label}, coloured by height; drag to orbit, scroll to zoom.`} />
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(poster)} alt={`Top-down render of the ${label(layer.key)} map of ${seq.label}, coloured by height, with its aligned trajectory.`}
            className="absolute inset-0 h-full w-full bg-white object-contain" />
        )}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/25">
            <button type="button" onClick={() => void load(si, li)} disabled={phase === "loading"}
              className="cursor-pointer rounded-md border border-white/40 bg-black/60 px-4 py-2 font-mono text-sm text-white backdrop-blur">
              {phase === "loading" ? "loading…" : `View the map in 3D (${layer.mb} MB)`}
            </button>
          </div>
        )}
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        {phase === "error"
          ? error
          : phase === "ready"
            ? `${count.toLocaleString("en-US")} points on a ${layer.voxel === null ? "–" : (layer.voxel * 100).toFixed(0)} cm grid. Switch systems to compare maps in one frame.`
            : "Each map is the system's registered scans in the reference frame, thinned to fit a small download; colour is height."}
      </figcaption>
    </figure>
  )
}
