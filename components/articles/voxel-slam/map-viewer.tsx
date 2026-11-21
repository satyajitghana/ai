"use client"

// Voxel-SLAM's maps from the shootout runs, viewable in the page. Server render: a still (the
// harness's oblique render of the same map) and a button. Only on "View in 3D" are three.js and the
// GLTF loader imported (map-gl.ts) and the .glb fetched, with a progress bar. Each .glb is the run's
// accumulated map (every scan's deskewed points, placed by that run's poses), cut to a voxel grid
// and coloured by height. Switching between the odometry-only and the full-SLAM map of the same
// sequence keeps the camera, so the difference is where you are looking.

import { useEffect, useRef, useState } from "react"

import { MAPS, type MapEntry } from "@/components/articles/voxel-slam/data"
import { mediaUrl } from "@/lib/media"
import { cn } from "@/lib/utils"

import type { MapView } from "./map-gl"

type Phase = "idle" | "loading" | "ready" | "error"
const mb = (n: number) => (n / 1048576).toFixed(1)

export function MapViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<MapView | null>(null)
  const seqs = Array.from(new Set(MAPS.map((m) => m.seq)))
  const [seq, setSeq] = useState(seqs[0])
  const inSeq = MAPS.filter((m) => m.seq === seq)
  const [key, setKey] = useState(inSeq[0]?.key ?? "")
  const entry: MapEntry | undefined = MAPS.find((m) => m.key === key) ?? inSeq[0]
  const [phase, setPhase] = useState<Phase>("idle")
  const [got, setGot] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [count, setCount] = useState(0)
  const [size, setSize] = useState(1.6)

  useEffect(
    () => () => {
      viewRef.current?.dispose()
      viewRef.current = null
    },
    [],
  )

  const load = async (m: MapEntry) => {
    setPhase("loading")
    setError("")
    setGot(0)
    try {
      const res = await fetch(mediaUrl(m.glb), { mode: "cors" })
      if (!res.ok || !res.body) throw new Error(`The map did not download (HTTP ${res.status}).`)
      setTotal(Number(res.headers.get("content-length") ?? 0))
      const reader = res.body.getReader()
      const parts: Uint8Array[] = []
      let n = 0
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        parts.push(value)
        n += value.length
        setGot(n)
      }
      const bytes = new Uint8Array(n)
      let o = 0
      for (const p of parts) {
        bytes.set(p, o)
        o += p.length
      }
      if (!viewRef.current) {
        const mod = await import("./map-gl")
        if (!canvasRef.current) return
        viewRef.current = mod.createMapView(canvasRef.current)
      }
      const pts = await viewRef.current.load(bytes.buffer)
      viewRef.current.setPointSize(size)
      setCount(pts)
      setPhase("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The viewer could not start.")
      setPhase("error")
    }
  }

  const pick = (m: MapEntry) => {
    setKey(m.key)
    if (phase === "ready" || phase === "error") void load(m)
  }
  const pickSeq = (s: string) => {
    setSeq(s)
    const first = MAPS.find((m) => m.seq === s)
    if (first) pick(first)
  }

  if (!entry) return null

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 font-mono text-xs">
        <div className="flex gap-1">
          {seqs.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => pickSeq(s)}
              aria-pressed={seq === s}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                seq === s ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {MAPS.find((m) => m.seq === s)?.seqLabel ?? s}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {inSeq.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => pick(m)}
              aria-pressed={entry.key === m.key}
              className={cn(
                "cursor-pointer rounded border px-2 py-1 transition-colors",
                entry.key === m.key ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      <div className="relative aspect-[16/10] w-full bg-[#0b0b0c]">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full"
          aria-label="A LiDAR point-cloud map you can orbit with the mouse or a finger: drag to rotate, scroll or pinch to zoom, right-drag to pan."
        />
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={mediaUrl(entry.still)} alt={entry.alt} className="absolute inset-0 h-full w-full object-contain" />
        )}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button
              type="button"
              onClick={() => load(entry)}
              disabled={phase === "loading"}
              className="rounded-md border border-white/40 bg-black/60 px-4 py-2 font-mono text-sm text-white backdrop-blur"
            >
              {phase === "loading"
                ? total
                  ? `${mb(Math.min(got, total))} of ${mb(total)} MB`
                  : `${mb(got)} MB`
                : `View in 3D (${entry.mb} MB)`}
            </button>
          </div>
        )}
        {phase === "ready" && (
          <div className="absolute bottom-2 right-2 flex gap-1 font-mono text-[11px]">
            {[1, 1.6, 2.5].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setSize(s)
                  viewRef.current?.setPointSize(s)
                }}
                className={cn("rounded border border-white/30 bg-black/60 px-2 py-0.5 text-white", size === s && "border-white")}
              >
                {s}px
              </button>
            ))}
            <button type="button" onClick={() => viewRef.current?.home()} className="rounded border border-white/30 bg-black/60 px-2 py-0.5 text-white">
              reset view
            </button>
          </div>
        )}
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        {phase === "error" ? error : phase === "ready" ? `${count.toLocaleString("en-US")} points. ${entry.caption}` : entry.caption}
      </figcaption>
    </figure>
  )
}
