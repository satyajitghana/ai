"use client"

// The point decoder on the synthetic scene I drew with PIL (800x600, four
// shapes with known masks). Click a shape: the widget shows the three
// multimask candidates the graph returned for a click at that shape's centre,
// their IoU with the true mask, and which one the post-processing keeps
// (the highest predicted IoU). All numbers are measured (v0.6.0 point decoder
// on the encoder's features for this image, CPU).

import { useState } from "react"

type Shape = "circle" | "rect" | "triangle" | "ellipse"

const FILL: Record<Shape, string> = {
  circle: "rgb(200,40,40)",
  rect: "rgb(30,90,200)",
  triangle: "rgb(30,150,60)",
  ellipse: "rgb(230,200,30)",
}

// scene 0 (800x600), first pass of the point decoder at the shape's centre:
// `cands` is each of the 3 candidates' true IoU, `pred` the graph's own
// predicted IoU for it, `kept` the argmax of `pred` (what the post-processing
// keeps). `once` and `refined` are the true IoU of the kept mask after
// post-processing, without and with the second (mask-input) pass.
const DATA: Record<Shape, { cands: number[]; pred: number[]; kept: number; once: number; refined: number; area: number }> = {
  circle: { cands: [0.054, 0.985, 0.997], pred: [0.06, 0.513, 0.987], kept: 2, once: 0.997, refined: 0.9968, area: 25701 },
  rect: { cands: [0.031, 0.95, 0.995], pred: [0.011, 0.671, 0.985], kept: 2, once: 0.9949, refined: 0.9996, area: 60501 },
  triangle: { cands: [0.997, 0.646, 0.983], pred: [0.985, 0.456, 0.955], kept: 0, once: 0.997, refined: 0.9962, area: 22089 },
  ellipse: { cands: [0.138, 0.989, 0.997], pred: [0.193, 0.526, 0.989], kept: 2, once: 0.9968, refined: 0.9956, area: 26685 },
}

const CENTRE: Record<Shape, [number, number]> = { circle: [180, 170], rect: [520, 160], triangle: [200, 430], ellipse: [560, 430] }

export function PointLab() {
  const [sel, setSel] = useState<Shape>("circle")
  const d = DATA[sel]
  const [cx, cy] = CENTRE[sel]
  const stroke = "oklch(0.58 0.15 45)"
  const common = (s: Shape) => ({
    fill: FILL[s],
    stroke: sel === s ? stroke : "none",
    strokeWidth: 5,
    onClick: () => setSel(s),
    style: { cursor: "pointer" } as const,
    role: "button" as const,
    "aria-label": `click the ${s}`,
    tabIndex: 0,
    onKeyDown: (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") setSel(s)
    },
  })

  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        point decoder · my synthetic scene, 800x600, click a shape
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-[1.2fr_1fr]">
        <svg viewBox="0 0 800 600" className="w-full rounded border" role="img" aria-label="Four flat shapes on a noisy grey background">
          <rect width={800} height={600} fill="rgb(160,150,135)" />
          <circle cx={180} cy={170} r={90} {...common("circle")} />
          <rect x={370} y={60} width={300} height={200} {...common("rect")} />
          <polygon points="200,320 90,518 310,518" {...common("triangle")} />
          <ellipse cx={560} cy={430} rx={120} ry={70} {...common("ellipse")} />
          <circle cx={cx} cy={cy} r={9} fill="white" stroke="black" strokeWidth={3} />
        </svg>
        <div>
          <p className="font-mono text-xs text-muted-foreground">click at ({cx}, {cy}) on the {sel}, {d.area.toLocaleString("en-US")} px</p>
          <div className="mt-2 space-y-2">
            {d.cands.map((c, i) => (
              <div key={i}>
                <div className="flex justify-between font-mono text-xs">
                  <span>candidate {i}{i === d.kept ? " (kept)" : ""}</span>
                  <span>true {c.toFixed(3)} · predicted {d.pred[i].toFixed(3)}</span>
                </div>
                <div className="h-3 rounded-sm bg-muted">
                  <div className="h-3 rounded-sm" style={{ width: `${c * 100}%`, background: i === d.kept ? "oklch(0.56 0.13 150)" : "oklch(0.7 0.02 250)" }} />
                </div>
              </div>
            ))}
          </div>
          <dl className="mt-3 font-mono text-xs leading-6">
                        <div className="flex justify-between"><dt>true IoU, one pass</dt><dd>{d.once.toFixed(4)}</dd></div>
            <div className="flex justify-between"><dt>true IoU, after refine</dt><dd>{d.refined.toFixed(4)}</dd></div>
          </dl>
        </div>
      </div>
    </figure>
  )
}
