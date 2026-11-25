"use client"

import { useState } from "react"

// skia-wasm against canvaskit-wasm, from skia-wasm's BENCHMARK.md at commit fd1625e
// (measured by its author on 23 November 2026). Milliseconds of main-thread time per
// frame, four synthetic 1024x1024 scenes. On the phone at full clock the author also
// split each frame into recording (the drawing calls) and submit (for skia-wasm:
// Graphite's snap, insert and submit; for CanvasKit: flush). The sustained and laptop
// rows are totals only. The 16.7 ms line is 1000/60, one frame at 60 Hz.

type Scene = "rects" | "shader" | "paths" | "images"
type Device = "phone" | "hot" | "laptop"

const SCENES: { id: Scene; name: string; calls?: string }[] = [
  { id: "rects", name: "10,000 rounded rects", calls: "30,667 WebGPU calls a frame for skia-wasm against 4 WebGL calls for CanvasKit (counted on the laptop)" },
  { id: "shader", name: "1,000 shader rects" },
  { id: "paths", name: "200 animated paths" },
  { id: "images", name: "2,000 images", calls: "7,918 WebGPU calls a frame against 250 WebGL calls (counted on the laptop)" },
]

const DEVICES: { id: Device; name: string; note: string }[] = [
  { id: "phone", name: "Phone, first seconds", note: "Galaxy S25 Edge, Chrome 158, cores at 4.47 GHz" },
  { id: "hot", name: "Phone, sustained", note: "the same phone kept hot, cores limited to 1.69 GHz (images at 1.96 GHz)" },
  { id: "laptop", name: "Laptop", note: "M5 Max, Chrome 157" },
]

// [record, submit] where the author split it; otherwise [total]
const DATA: Record<Device, Record<Scene, { ck: number[]; sw: number[] }>> = {
  phone: {
    rects: { ck: [10.0, 0.28], sw: [9.74, 17.8] },
    shader: { ck: [1.62, 1.69], sw: [1.02, 1.75] },
    paths: { ck: [1.32, 0.3], sw: [0.38, 0.63] },
    images: { ck: [1.88, 0.12], sw: [1.76, 3.8] },
  },
  hot: {
    rects: { ck: [21.4], sw: [51.2] },
    shader: { ck: [7.6], sw: [5.7] },
    paths: { ck: [3.5], sw: [2.0] },
    images: { ck: [4.3], sw: [9.8] },
  },
  laptop: {
    rects: { ck: [6.38], sw: [14.41] },
    shader: { ck: [2.13], sw: [1.71] },
    paths: { ck: [1.09], sw: [0.65] },
    images: { ck: [1.55], sw: [3.31] },
  },
}

const BUDGET = 1000 / 60
const REC = "oklch(0.62 0.12 250)"
const SUB = "oklch(0.66 0.16 40)"
const TOT = "oklch(0.6 0.05 250)"

const ms = (v: number) => (v >= 10 ? v.toFixed(1) : v.toFixed(2))

export function FrameSplit() {
  const [scene, setScene] = useState<Scene>("rects")
  const [device, setDevice] = useState<Device>("phone")
  const row = DATA[device][scene]
  const split = device === "phone"
  const max = Math.max(BUDGET, ...[row.ck, row.sw].map((a) => a.reduce((x, y) => x + y, 0))) * 1.08
  const pct = (v: number) => `${(v / max) * 100}%`
  const sc = SCENES.find((s) => s.id === scene)!
  const dv = DEVICES.find((d) => d.id === device)!

  const bar = (label: string, parts: number[]) => {
    const total = parts.reduce((x, y) => x + y, 0)
    return (
      <div className="grid grid-cols-[7.5rem_1fr] items-center gap-3">
        <span className="font-mono text-[11px] text-muted-foreground">{label}</span>
        <div className="relative h-7">
          <div className="absolute inset-y-0 left-0 flex" style={{ width: pct(total) }}>
            {parts.map((p, i) => (
              <div
                key={i}
                className="h-full first:rounded-l-sm last:rounded-r-sm"
                style={{ width: `${(p / total) * 100}%`, background: !split ? TOT : i === 0 ? REC : SUB }}
                title={split ? `${i === 0 ? "record" : "submit"} ${ms(p)} ms` : `${ms(p)} ms`}
              />
            ))}
          </div>
          <span className="absolute top-1/2 -translate-y-1/2 pl-2 font-mono text-[11px]" style={{ left: pct(total) }}>
            {ms(total)} ms
          </span>
        </div>
      </div>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {SCENES.map((s) => (
          <button
            key={s.id}
            type="button"
            aria-pressed={s.id === scene}
            onClick={() => setScene(s.id)}
            className={`rounded-md px-2 py-1 ${s.id === scene ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            {s.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2 font-mono text-[11px]">
        {DEVICES.map((d) => (
          <button
            key={d.id}
            type="button"
            aria-pressed={d.id === device}
            onClick={() => setDevice(d.id)}
            className={`rounded-md px-2 py-1 ${d.id === device ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
          >
            {d.name}
          </button>
        ))}
      </div>
      <div className="relative grid gap-3 px-4 py-4 pr-16">
        <div className="pointer-events-none absolute inset-y-2 left-[calc(1rem+7.5rem+0.75rem)] right-16">
          <div className="absolute inset-y-0 border-l border-dashed border-foreground/40" style={{ left: pct(BUDGET) }}>
            <span className="absolute -top-0.5 left-1 whitespace-nowrap font-mono text-[10px] text-muted-foreground">60 fps budget</span>
          </div>
        </div>
        <div className="h-2" />
        {bar("canvaskit-wasm", row.ck)}
        {bar("skia-wasm", row.sw)}
        <div className="flex flex-wrap gap-x-4 gap-y-1 pl-[8.25rem] font-mono text-[11px] text-muted-foreground">
          {split ? (
            <>
              <span>
                <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: REC }} />
                record: the drawing calls
              </span>
              <span>
                <span className="mr-1 inline-block size-2.5 rounded-sm align-middle" style={{ background: SUB }} />
                submit: snap, insert, submit (CanvasKit: flush)
              </span>
            </>
          ) : (
            <span>totals only: the author split record and submit on the cool phone</span>
          )}
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-[13px] leading-relaxed text-muted-foreground">
        Main-thread milliseconds per frame for <strong className="text-foreground">{sc.name}</strong>, {dv.note}. {sc.calls ? `${sc.calls}. ` : ""}
        Pick the rect scene on the cool phone: the recording costs about the same in both libraries, and the whole difference is the submit, where this build of
        Graphite issues one draw per item. All figures are from skia-wasm&apos;s BENCHMARK.md (commit fd1625e); the 60 fps line is 1000/60 ms.
      </figcaption>
    </figure>
  )
}
