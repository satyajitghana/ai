"use client"

// The MeetingRoom_In splat from my beast2 run, viewable in the page. Server render: a still and a
// button. Only on "View in 3D" are three.js and Spark imported (room-gl.ts) and the 1.4 MB .spz
// fetched, with a progress bar. The file is the SH0 model (245,000 splats trained), cut to the
// splats inside the room with at least 2% opacity (90,769), turned right way up and scaled to
// metres; its colour is degree 0 only.

import { useEffect, useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

import type { RoomView } from "./room-gl"

type Phase = "idle" | "loading" | "ready" | "error"

const SPZ = "/articles/3dgs-capture-pipelines/meetingroom-sh0.spz"
const STILL = "/articles/3dgs-capture-pipelines/heldout-sh3.jpg"
const mb = (n: number) => (n / 1048576).toFixed(1)

export function RoomViewer() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const viewRef = useRef<RoomView | null>(null)
  const [phase, setPhase] = useState<Phase>("idle")
  const [got, setGot] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState("")
  const [count, setCount] = useState(0)

  useEffect(
    () => () => {
      viewRef.current?.dispose()
      viewRef.current = null
    },
    [],
  )

  const start = async () => {
    if (phase === "loading" || phase === "ready") return
    setPhase("loading")
    setError("")
    try {
      const res = await fetch(mediaUrl(SPZ), { mode: "cors" })
      if (!res.ok || !res.body) throw new Error(`The splat did not download (HTTP ${res.status}).`)
      const len = Number(res.headers.get("content-length") ?? 0)
      setTotal(len)
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
      const mod = await import("./room-gl")
      if (!canvasRef.current) return
      const view = mod.createRoomView(canvasRef.current)
      viewRef.current = view
      await view.load(bytes)
      setCount(view.count())
      setPhase("ready")
    } catch (e) {
      setError(e instanceof Error ? e.message : "The viewer could not start.")
      setPhase("error")
    }
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>MeetingRoom_In as a splat: drag to look around, scroll to move</span>
        <span className="text-muted-foreground/60">trained on an RTX 3090</span>
      </div>
      <div className="relative aspect-[16/10] w-full bg-[#0b0b0c]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" aria-label="A Gaussian-splat reconstruction of a meeting room you can orbit with the mouse or a finger." />
        {phase !== "ready" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mediaUrl(STILL)}
            alt="A held-out view of the meeting room: a photo on the left and the splat's render of the same view on the right, a wooden table, grey chairs, glazed partitions with blinds and floor lights."
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        {phase !== "ready" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <button
              type="button"
              onClick={start}
              disabled={phase === "loading"}
              className="rounded-md border border-white/40 bg-black/60 px-4 py-2 font-mono text-sm text-white backdrop-blur"
            >
              {phase === "loading"
                ? total
                  ? `${mb(Math.min(got, total))} of ${mb(total)} MB`
                  : `${mb(got)} MB`
                : "View in 3D (1.4 MB)"}
            </button>
          </div>
        )}
      </div>
      <figcaption className="px-4 py-2.5 font-mono text-xs leading-relaxed text-muted-foreground">
        {phase === "error"
          ? error
          : phase === "ready"
            ? `${count.toLocaleString("en-US")} splats, degree-0 colour, metres from a coarse scale fit.`
            : "The SH0 model from my run, cut to the room and turned right way up. The still is a held-out view: photo left, render right."}
      </figcaption>
    </figure>
  )
}
