"use client"

import { useState } from "react"

// The 3-second question. FLOPs are derived from config.json (see the article):
// 47.52 TFLOPs per denoiser step with guidance, ~10 TFLOPs for the encoders,
// the Gaussian decoder's quadratic cost, the octree decoder's. GPU times are
// the model card's own "Across GPUs" table (262,144 Gaussians, 50 steps).
// Implied rate = our FLOPs / their time, so it is only as good as our count.

const GPUS = [
  { name: "B300", t: 3.4 },
  { name: "B200", t: 3.6 },
  { name: "H200", t: 6.6 },
  { name: "H100", t: 6.7 },
  { name: "RTX 5090", t: 14.1 },
  { name: "A100", t: 16.3 },
  { name: "L40S", t: 16.6 },
  { name: "RTX 4090", t: 19.1 },
  { name: "RTX 3080", t: 46.2 },
  { name: "L4", t: 54.6 },
]

const D = 1024
const STEP_TF = 47.522
const ENC_TF = 10

function gsTF(anchors: number) {
  const lin = 3 * D * D + D * D + 8 * D * D + D * D + D * D
  const per = 2 * anchors * lin + 4 * anchors * anchors * D + 4 * anchors * 8192 * D
  return (16 * per + 2 * anchors * D * 480) / 1e12
}
function octTF(anchors: number) {
  const lin = 10 * D * D
  return (4 * (2 * anchors * lin + 4 * anchors * 8192 * D)) / 1e12
}
export function totalTF(steps: number, gaussians: number) {
  const a = gaussians / 32
  return steps * STEP_TF + gsTF(a) + octTF(a) + ENC_TF
}

function r1(x: number) {
  return Math.round(x * 10) / 10
}

export function Roofline() {
  const [gi, setGi] = useState(7)
  const [steps, setSteps] = useState(50)
  const [g, setG] = useState(1048576)
  const gpu = GPUS[gi]
  const ref = totalTF(50, 262144)
  const rate = ref / gpu.t
  const mine = totalTF(steps, g)
  const t = mine / rate
  const ok = t <= 3
  const maxSteps = (() => {
    let s = 0
    while (s < 50 && totalTF(s + 1, g) / rate <= 3) s += 1
    return s
  })()
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">can this GPU do it in 3 seconds?</span>
        <span className="font-mono text-[10px] text-muted-foreground">reasoned: our FLOP count over their timings</span>
      </div>
      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="GPU">
          {GPUS.map((x, i) => (
            <button
              key={x.name}
              type="button"
              onClick={() => setGi(i)}
              aria-pressed={i === gi}
              className={`cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] ${
                i === gi ? "border-foreground/40 bg-muted/50" : "border-border hover:bg-muted/20"
              }`}
            >
              {x.name}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block font-mono text-xs">
            <div className="flex justify-between">
              <span>sampling steps</span>
              <span>{steps}</span>
            </div>
            <input
              type="range"
              min={1}
              max={50}
              value={steps}
              onChange={(e) => setSteps(Number(e.target.value))}
              className="mt-2 w-full cursor-pointer"
              aria-label="Sampling steps"
            />
          </label>
          <label className="block font-mono text-xs">
            <div className="flex justify-between">
              <span>Gaussians</span>
              <span>{g === 1048576 ? "1,048,576" : g === 262144 ? "262,144" : String(g)}</span>
            </div>
            <input
              type="range"
              min={32768}
              max={1048576}
              step={32768}
              value={g}
              onChange={(e) => setG(Number(e.target.value))}
              className="mt-2 w-full cursor-pointer"
              aria-label="Number of Gaussians"
            />
          </label>
        </div>
        <dl className="grid grid-cols-2 gap-3 font-mono text-[11px] sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">work</dt>
            <dd className="text-sm">{r1(mine)} TFLOPs</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">implied rate on {gpu.name}</dt>
            <dd className="text-sm">{r1(rate)} TFLOP/s</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">predicted time</dt>
            <dd className="text-sm" style={{ color: ok ? "oklch(0.62 0.14 150)" : "oklch(0.62 0.17 30)" }}>
              {r1(t)} s
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">steps that fit in 3 s</dt>
            <dd className="text-sm">{maxSteps === 0 ? "none" : maxSteps}</dd>
          </div>
        </dl>
        <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
          The time scales the card&apos;s own {gpu.t} s by our FLOP ratio, so it assumes the GPU stays as busy at other
          settings. The split at {steps} steps and {g === 1048576 ? "1,048,576" : g} Gaussians: denoiser{" "}
          {r1(steps * STEP_TF)}, decoders {r1(gsTF(g / 32) + octTF(g / 32))}, encoders {ENC_TF} TFLOPs.
        </p>
      </div>
    </figure>
  )
}
