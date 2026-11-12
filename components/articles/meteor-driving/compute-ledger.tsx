"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Where a driving network's parameters live, and where its compute goes.
// V26: the measured cost table in tier4/METEOR docs/ARCHITECTURE.md (v26, 43.50M
// params, ~3,100 GFLOPs per 8-camera frame), stage by stage as printed.
// V157: my count of the released checkpoint AutowareFoundation/meteor
// meteor_v157.pt, read from its zip directory and pickle metadata with a stub
// unpickler (no code executed), grouped by module prefix. Learnable tensors only,
// BatchNorm running statistics excluded: 54,060,013 in total, all fp32.
// The per-frame compute for the rate slider is REPRODUCE.md's 3,405 GFLOP for
// the v52 graph, which is the architecture v157 uses.

const V26: { name: string; params: number; gflops: number }[] = [
  { name: "Backbone + FPN (8 cams)", params: 21.66, gflops: 475 },
  { name: "Depth decoder", params: 3.29, gflops: 1093 },
  { name: "BEV lane seg head", params: 1.16, gflops: 933 },
  { name: "2D seg head", params: 4.18, gflops: 219 },
  { name: "2D det head", params: 2.85, gflops: 219 },
  { name: "3D det head", params: 2.06, gflops: 121 },
  { name: "Occupancy head", params: 0.7, gflops: 55 },
  { name: "E2E head", params: 4.04, gflops: 37 },
  { name: "Temporal fuse", params: 0.18, gflops: 42 },
  { name: "Agent traj + stationary", params: 0.41, gflops: 26 },
  { name: "Context + IPM", params: 0.02, gflops: 6 },
]

const V157: [string, number][] = [
  ["Image backbone (ResNet-34)", 21284672],
  ["Refiner", 5034875],
  ["E2E planner", 4521408],
  ["BEV lane decoder", 4193937],
  ["2D segmentation", 4184373],
  ["3D boxes", 3721098],
  ["2D detection", 2849834],
  ["Lane graph", 2641561],
  ["Traffic light", 1118676],
  ["Unknown objects", 1064674],
  ["Depth head", 918790],
  ["Occupancy + flow", 695842],
  ["Agent forecast + stop flag", 688998],
  ["FPN neck", 384960],
  ["Optional inputs", 369525],
  ["Temporal fuse", 204868],
  ["Risk field", 166466],
  ["Context", 15456],
]

const MODELS = [
  { id: "meteor", label: "METEOR v157 (released)", params: 54060013 },
  { id: "claim", label: "the post's 16M", params: 16000000 },
  { id: "autoe2e", label: "AutoE2E v1.0", params: 79906522 },
] as const

const BYTES = { fp32: 4, fp16: 2, int8: 1 } as const
type Prec = keyof typeof BYTES

const A = "oklch(0.62 0.14 250)"
const B = "oklch(0.7 0.14 60)"

const fmtMB = (b: number) => (b >= 1e9 ? `${(b / 1e9).toFixed(2)} GB` : `${Math.round(b / 1e6)} MB`)

export function ComputeLedger() {
  const [view, setView] = useState<"v26" | "v157">("v26")
  const [prec, setPrec] = useState<Prec>("int8")
  const [hz, setHz] = useState(15)

  const tp = V26.reduce((a, r) => a + r.params, 0)
  const tg = V26.reduce((a, r) => a + r.gflops, 0)
  const t157 = V157.reduce((a, r) => a + r[1], 0)
  const tflops = (3405 * hz) / 1000

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5">
        {(
          [
            ["v26", "params vs compute (v26 table)"],
            ["v157", "params by module (v157 checkpoint)"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setView(id)}
            aria-pressed={view === id}
            className={`rounded-md border px-2 py-0.5 font-mono text-xs ${view === id ? "bg-foreground text-background" : "text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="p-3 sm:p-4">
        {view === "v26" ? (
          <div className="space-y-1.5">
            <div className="flex gap-4 font-mono text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: A }} /> share of parameters
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2 w-3 rounded-sm" style={{ background: B }} /> share of GFLOPs
              </span>
            </div>
            {V26.map((r) => {
              const pp = (r.params / tp) * 100
              const pg = (r.gflops / tg) * 100
              return (
                <div key={r.name} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-2 text-xs sm:grid-cols-[13rem_1fr]">
                  <span className="truncate font-mono text-[11px]">{r.name}</span>
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1">
                      <div className="h-2 rounded-sm" style={{ width: `${Math.max(pp, 0.4).toFixed(2)}%`, background: A }} />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{r.params.toFixed(2)}M</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="h-2 rounded-sm" style={{ width: `${Math.max(pg, 0.4).toFixed(2)}%`, background: B }} />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{r.gflops} G</span>
                    </div>
                  </div>
                </div>
              )
            })}
            <p className="pt-2 font-mono text-[11px] text-muted-foreground">
              The rows sum to {tp.toFixed(2)}M parameters and {tg.toLocaleString("en-US")} GFLOPs per 8-camera frame (the
              table&apos;s own total line says 43.50M and about 3,100). The backbone holds{" "}
              {((21.66 / tp) * 100).toFixed(0)}% of the weights and {((475 / tg) * 100).toFixed(0)}% of the compute; the depth
              decoder and the BEV lane head hold {(((3.29 + 1.16) / tp) * 100).toFixed(0)}% of the weights and{" "}
              {(((1093 + 933) / tg) * 100).toFixed(0)}% of the compute.
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {V157.map(([name, n]) => (
              <div key={name} className="grid grid-cols-[minmax(0,10rem)_1fr] items-center gap-2 text-xs sm:grid-cols-[13rem_1fr]">
                <span className="truncate font-mono text-[11px]">{name}</span>
                <div className="flex items-center gap-1">
                  <div className="h-2 rounded-sm" style={{ width: `${Math.max((n / t157) * 100, 0.4).toFixed(2)}%`, background: A }} />
                  <span className="font-mono text-[10px] tabular-nums text-muted-foreground">{(n / 1e6).toFixed(2)}M</span>
                </div>
              </div>
            ))}
            <p className="pt-2 font-mono text-[11px] text-muted-foreground">
              Total {t157.toLocaleString("en-US")} learnable values. The E2E planner is{" "}
              {((4521408 / t157) * 100).toFixed(1)}% of the network (its 0.11M residual refiner sits inside &quot;Refiner&quot;).
            </p>
          </div>
        )}

        <div className="mt-4 grid gap-3 border-t pt-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex flex-wrap items-center gap-1">
              <span className="mr-1 font-mono text-[11px] text-muted-foreground">weights at</span>
              {(Object.keys(BYTES) as Prec[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPrec(p)}
                  aria-pressed={prec === p}
                  className={`rounded-md border px-2 py-0.5 font-mono text-xs ${prec === p ? "bg-foreground text-background" : "text-muted-foreground"}`}
                >
                  {p}
                </button>
              ))}
            </div>
            <ul className="space-y-0.5 font-mono text-[11px]">
              {MODELS.map((m) => (
                <li key={m.id} className="flex justify-between gap-2">
                  <span className={m.id === "claim" ? "text-muted-foreground italic" : undefined}>{m.label}</span>
                  <span className="tabular-nums">{fmtMB(m.params * BYTES[prec])}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <label className="mb-1 block font-mono text-[11px] text-muted-foreground">
              frame rate: <span className="text-foreground">{hz} Hz</span>
            </label>
            <Range min={5} max={30} step={1} value={hz} onChange={(e) => setHz(Number(e.target.value))} aria-label="frame rate in Hz" />
            <p className="mt-1 font-mono text-[11px]">
              3,405 GFLOP per frame x {hz} Hz = <span className="font-semibold">{tflops.toFixed(1)} TFLOP/s</span> sustained
            </p>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The v26 bars are the repository&apos;s own measured table (an earlier 43.50M version of the network). The v157 bars
        are my count of the released checkpoint&apos;s tensors. Weight sizes and the per-second compute are my arithmetic:
        parameters times bytes, and the repository&apos;s per-frame GFLOP figure for the full-width v52 graph times the rate,
        an upper bound for v157, whose half-width depth head removes about 785 GFLOP. Neither counts activations, which
        at 800x500 BEV resolution are most of the memory traffic.
      </figcaption>
    </figure>
  )
}
