"use client"

// SpatialScout scores a predicted centre by moving a box to it and taking the
// 3D IoU with the reference box. The agent only ever submits a point; the box
// comes from the benchmark. Box sizes below are MEASURED from the released
// ground_truth.json files (median-volume instance of each category, or a real
// same-group pair from one scene). The IoU is the scorer's own formula
// (spatialscout/evaluation/iou.py: box_iou) on axis-aligned boxes:
//   I = prod_a max(0, overlap_a),  IoU = I / (V_pred + V_ref - I)
// Two variants are switchable: the 1 cm minimum side the paper describes
// (Appendix B.2, absent from the released code), and scoring a perfect centre
// under a sibling's ID, which the released code does by moving the SUBMITTED
// id's box rather than the candidate target's.
//
// SSR-safe: plain state, no effects. Only + - * / min max abs sqrt are used.

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

type V3 = [number, number, number]
type Preset = { key: string; label: string; size: V3; sibling?: V3; note: string }

const PRESETS: Preset[] = [
  { key: "sofa", label: "Sofa", size: [0.7698, 1.9353, 1.0061], note: "median sofa" },
  {
    key: "chair",
    label: "Chair",
    size: [0.457, 0.53, 1.0421],
    sibling: [0.5779, 0.5331, 1.0421],
    note: "ithor_kitchen_16, two chairs in one group",
  },
  {
    key: "painting",
    label: "Painting",
    size: [0.874, 0.0292, 0.8404],
    sibling: [1.6229, 0.0295, 0.9947],
    note: "ithor_living_room_204, two paintings in one group",
  },
  { key: "mug", label: "Mug", size: [0.11, 0.0893, 0.1031], note: "median mug" },
  {
    key: "phone",
    label: "Phone",
    size: [0.18, 0.0885, 0.0095],
    sibling: [0.147, 0.0774, 0.0098],
    note: "procthor_train_4306, two phones in one group",
  },
  { key: "card", label: "Credit card", size: [0.0845, 0.0532, 0.0006], note: "median credit card, 0.6 mm thick" },
]

const AXES = ["x", "y", "z"] as const
const OK = "oklch(0.62 0.14 150)"
const MID = "oklch(0.7 0.13 75)"
const BAD = "oklch(0.6 0.17 25)"
const REF = "oklch(0.58 0.13 250)"

// overlap length of [-a/2, a/2] and [d - b/2, d + b/2]
function overlap(a: number, b: number, d: number) {
  return Math.max(0, Math.min(a / 2, d + b / 2) - Math.max(-a / 2, d - b / 2))
}

function fmtLen(m: number) {
  if (m >= 0.1) return `${(m * 100).toFixed(1)} cm`
  return `${(m * 1000).toFixed(1)} mm`
}

export function OverlapLab() {
  const [pi, setPi] = useState(2)
  const [d, setD] = useState<V3>([0, 0, 0])
  const [floor, setFloor] = useState(false)
  const [sib, setSib] = useState(false)

  const p = PRESETS[pi]
  const fl = (v: V3): V3 => (floor ? (v.map((s) => Math.max(s, 0.01)) as V3) : v)
  const ref = fl(p.size)
  const pred = fl(sib && p.sibling ? p.sibling : p.size)
  const dm = d.map((v) => v / 1000) as V3

  const ov = [0, 1, 2].map((a) => overlap(ref[a], pred[a], dm[a]))
  const inter = ov[0] * ov[1] * ov[2]
  const vRef = ref[0] * ref[1] * ref[2]
  const vPred = pred[0] * pred[1] * pred[2]
  const union = vRef + vPred - inter
  const iou = union > 0 ? inter / union : 0
  const err = Math.sqrt(dm[0] * dm[0] + dm[1] * dm[1] + dm[2] * dm[2])
  const color = iou > 0.9 ? OK : iou > 0.5 ? MID : iou > 0 ? MID : BAD

  // two views: plan (x, y) and elevation (x, z), scaled to fit
  const view = (ax: number, ay: number) => {
    const W = 150
    const H = 110
    const span = Math.max(
      ref[ax] + Math.abs(dm[ax]) + pred[ax],
      ref[ay] + Math.abs(dm[ay]) + pred[ay],
      0.0001,
    )
    const k = (Math.min(W, H) - 16) / span
    const cx = W / 2
    const cy = H / 2
    const r = (w: number, h: number, ox: number, oy: number) => ({
      x: (cx + (ox - w / 2) * k).toFixed(2),
      y: (cy - (oy + h / 2) * k).toFixed(2),
      w: Math.max(w * k, 0.6).toFixed(2),
      h: Math.max(h * k, 0.6).toFixed(2),
    })
    const a = r(ref[ax], ref[ay], 0, 0)
    const b = r(pred[ax], pred[ay], dm[ax], dm[ay])
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`${AXES[ax]}-${AXES[ay]} view of the two boxes`}>
        <rect x={a.x} y={a.y} width={a.w} height={a.h} fill={REF} fillOpacity={0.18} stroke={REF} strokeWidth={1} />
        <rect x={b.x} y={b.y} width={b.w} height={b.h} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={1} strokeDasharray="3 2" />
        <text x={4} y={H - 4} fontSize={8} className="fill-muted-foreground font-mono">
          {AXES[ax]}–{AXES[ay]}
        </text>
      </svg>
    )
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>one target · predicted centre = true centre + offset</span>
        <span className="text-muted-foreground/70">box sizes measured from ground_truth.json</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Object">
          {PRESETS.map((q, i) => (
            <button
              key={q.key}
              type="button"
              onClick={() => {
                setPi(i)
                setD([0, 0, 0])
                if (!q.sibling) setSib(false)
              }}
              className={`rounded-md border px-2.5 py-1 font-mono text-[11px] ${i === pi ? "border-foreground/40 bg-muted" : "text-muted-foreground"}`}
              aria-pressed={i === pi}
            >
              {q.label}
            </button>
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[10px] text-muted-foreground">
          {p.label}: {p.size.map((s) => fmtLen(s)).join(" × ")} · {p.note}
        </p>

        <div className="mt-4 grid gap-2">
          {AXES.map((ax, a) => (
            <label key={ax} className="grid grid-cols-[1.25rem_1fr_4.5rem] items-center gap-3 font-mono text-xs">
              <span>{ax}</span>
              <Range
                min={-200}
                max={200}
                step={1}
                value={d[a]}
                onChange={(e) => {
                  const nd = [...d] as V3
                  nd[a] = Number(e.target.value)
                  setD(nd)
                }}
                aria-label={`Offset along ${ax} in millimetres`}
              />
              <span className="text-right tabular-nums">{d[a]} mm</span>
            </label>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px]">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={floor} onChange={(e) => setFloor(e.target.checked)} />
            1 cm minimum side (paper, not in released code)
          </label>
          <label className={`flex items-center gap-1.5 ${p.sibling ? "" : "opacity-40"}`}>
            <input type="checkbox" checked={sib} disabled={!p.sibling} onChange={(e) => setSib(e.target.checked)} />
            submitted under the sibling&apos;s ID (released code)
          </label>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[1fr_1fr_1.1fr]">
          <div className="rounded-lg border bg-background/60 p-1.5">{view(0, 1)}</div>
          <div className="rounded-lg border bg-background/60 p-1.5">{view(0, 2)}</div>
          <div className="col-span-2 grid content-start gap-1.5 font-mono text-xs sm:col-span-1">
            <div className="text-2xl tabular-nums" style={{ color }}>
              {(iou * 100).toFixed(1)}%
            </div>
            <div className="text-muted-foreground">3D IoU · centre error {fmtLen(err)}</div>
            <div className="mt-1 flex gap-1.5">
              {[0, 0.5, 0.9].map((t) => (
                <span
                  key={t}
                  className="rounded border px-1.5 py-0.5 text-[10px]"
                  style={iou > t ? { borderColor: OK, color: OK } : { opacity: 0.45 }}
                >
                  &gt;{t}
                </span>
              ))}
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
              single-axis slack for &gt;0.9 is side/19: {AXES.map((ax, a) => `${ax} ${fmtLen(ref[a] / 19)}`).join(", ")}
            </div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        The solid box is the reference, the dashed one is where the prediction puts it. A painting 2.9 cm thick
        leaves 1.5 mm of slack front-to-back for IoU &gt; 0.9. Ticking the sibling box drops the painting to 45% at
        zero offset, below the 0.5 line even though the centre is exact.
      </figcaption>
    </figure>
  )
}
