"use client"

// Why the export splits at the image encoder: N prompts on one image, with and
// without keeping the embedding. And the resolution half: the encoder always
// sees 1008x1008, so source size changes the squeeze, not the encoder cost.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { DEVICES } from "./data"

const COLD = "oklch(0.58 0.2 25)"
const WARM = "oklch(0.56 0.13 150)"

type Kind = "point" | "box" | "text"
const KINDS: { id: Kind; label: string }[] = [
  { id: "point", label: "click" },
  { id: "box", label: "box" },
  { id: "text", label: "text" },
]

const fmtMs = (ms: number) => (ms >= 10000 ? `${(ms / 1000).toFixed(0)} s` : ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`)

export function LatencyBudget() {
  const [dev, setDev] = useState("cuda")
  const [kind, setKind] = useState<Kind>("point")
  const [n, setN] = useState(10)
  const [w, setW] = useState(2560)
  const [h, setH] = useState(1600)
  const [obj, setObj] = useState(80)

  const d = DEVICES.find((x) => x.id === dev) ?? DEVICES[0]
  const per = d[kind]
  const known = per > 0
  const warm = d.encode + n * per
  const cold = n * (d.encode + per)
  const max = Math.max(warm, cold, 1)

  const sx = 1008 / w
  const sy = 1008 / h
  const objW = obj * sx
  const objH = obj * sy
  // ViT patch grid: 1008 / 14 = 72 tokens per side.
  const patch = 14

  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        encode once, prompt many · and what the 1008 square does to your photo
      </div>
      <div className="grid gap-3 px-3 py-3 sm:grid-cols-3">
        <div>
          <label className="font-mono text-xs text-muted-foreground" htmlFor="lbdev">device</label>
          <select id="lbdev" value={dev} onChange={(e) => setDev(e.target.value)} className="mt-1 block w-full rounded border bg-background px-2 py-1 text-sm">
            {DEVICES.map((x) => (
              <option key={x.id} value={x.id}>{x.label} ({x.src})</option>
            ))}
          </select>
        </div>
        <div>
          <span className="font-mono text-xs text-muted-foreground">prompt</span>
          <div className="mt-1 flex gap-2">
            {KINDS.map((k) => (
              <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={`rounded border px-2 py-1 font-mono text-xs ${kind === k.id ? "bg-foreground text-background" : ""}`}>
                {k.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="font-mono text-xs text-muted-foreground" htmlFor="lbn">prompts on this image: {n}</label>
          <Range id="lbn" min={1} max={50} value={n} onChange={(e) => setN(Number(e.target.value))} />
        </div>
      </div>

      {known ? (
        <div className="space-y-2 px-3 pb-3">
          {[
            { name: "keep the embedding", v: warm, c: WARM },
            { name: "re-encode every prompt", v: cold, c: COLD },
          ].map((r) => (
            <div key={r.name}>
              <div className="flex justify-between font-mono text-xs"><span>{r.name}</span><span>{fmtMs(r.v)}</span></div>
              <div className="h-3 rounded-sm bg-muted"><div className="h-3 rounded-sm" style={{ width: `${(r.v / max) * 100}%`, background: r.c }} /></div>
            </div>
          ))}
          <p className="font-mono text-xs text-muted-foreground">
            ratio {(cold / warm).toFixed(1)}x · {d.src === "reported" ? "benchmark doc, dogs.jpg 2560x1600" : "my run, synthetic scene"}
          </p>
        </div>
      ) : (
        <p className="px-3 pb-3 font-mono text-xs text-muted-foreground">No number for this prompt on this device: I could not time it there.</p>
      )}

      <div className="border-t px-3 py-3">
        <p className="font-mono text-xs text-muted-foreground">source photo (the encoder input is fixed at 3x1008x1008 whatever you pick)</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="font-mono text-xs">width {w}<Range min={320} max={4000} step={40} value={w} onChange={(e) => setW(Number(e.target.value))} /></label>
          <label className="font-mono text-xs">height {h}<Range min={240} max={4000} step={40} value={h} onChange={(e) => setH(Number(e.target.value))} /></label>
          <label className="font-mono text-xs">object, {obj} px wide<Range min={10} max={400} step={5} value={obj} onChange={(e) => setObj(Number(e.target.value))} /></label>
        </div>
        <dl className="mt-3 grid gap-x-6 font-mono text-xs leading-6 sm:grid-cols-2">
          <div className="flex justify-between"><dt>scale x, y</dt><dd>{sx.toFixed(3)}, {sy.toFixed(3)}</dd></div>
          <div className="flex justify-between"><dt>aspect squeeze</dt><dd>{(Math.max(sx, sy) / Math.min(sx, sy)).toFixed(2)}x</dd></div>
          <div className="flex justify-between"><dt>object in the model</dt><dd>{objW.toFixed(0)} x {objH.toFixed(0)} px</dd></div>
          <div className="flex justify-between"><dt>in 14 px patches</dt><dd>{(objW / patch).toFixed(1)} wide</dd></div>
          <div className="flex justify-between"><dt>encoder work</dt><dd>unchanged</dd></div>
          <div className="flex justify-between"><dt>mask memory per object</dt><dd>{((w * h) / 1e6).toFixed(1)} MB bool</dd></div>
        </dl>
      </div>
    </figure>
  )
}
