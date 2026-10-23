"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { BINS, calibrate, confidence, decode, draws, gauss } from "@/components/articles/d3-turbo/box-math"

// How d3-turbo turns four edge distributions into one box and one confidence.
// The maths is box-math.ts, a port of the repository's d3_compose.py, checked
// against the Python. The edge distributions here are synthetic Gaussian bumps,
// not model output: the widget shows what the decoder does with a given spread,
// not how spread the model's real answers are.

const SIZES = [0.06, 0.1, 0.16, 0.25, 0.4, 0.6]
const SPREADS = [0.005, 0.01, 0.02, 0.035, 0.05, 0.075, 0.1]
const SHOWN = 64
const PX = 240

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

export function BoxConfidence() {
  const [si, setSi] = useState(2)
  const [di, setDi] = useState(2)
  const [crossed, setCrossed] = useState(false)
  const size = SIZES[si]
  const sd = SPREADS[di]

  const r = useMemo(() => {
    const lo = 0.5 - size / 2
    const hi = 0.5 + size / 2
    const spec: [number, number][] = crossed
      ? [[0.5 + 0.01, sd], [0.5 - 0.01, sd], [lo, sd], [hi, sd]]
      : [[lo, sd], [hi, sd], [lo, sd], [hi, sd]]
    const edges = spec.map(([m, s]) => gauss(m, s))
    const box = decode(edges)
    const { share, hits } = confidence(edges, box)
    const sample = draws(edges).slice(0, SHOWN)
    return { box, share, hits, sample, cal: calibrate(share) }
  }, [size, sd, crossed])

  const s = (v: number) => Math.round(v * PX * 10) / 10

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one Box answer: four 128-bin edge distributions, decoded the way d3_compose.py decodes them
      </div>
      <div className="grid gap-4 p-3 sm:grid-cols-[auto_1fr]">
        <svg
          viewBox={`0 0 ${PX} ${PX}`}
          width={PX}
          height={PX}
          className="mx-auto max-w-full rounded border bg-muted/30"
          role="img"
          aria-label={`A ${pct(size)} box with edge spread ${pct(sd)}; ${pct(r.share)} of draws reach IoU 0.5`}
        >
          {r.sample.map(([t, b, l, rt], i) =>
            t < b && l < rt ? (
              <rect
                key={i}
                x={s(l)}
                y={s(t)}
                width={s(rt - l)}
                height={s(b - t)}
                fill="none"
                strokeWidth={0.6}
                className={r.hits[i] ? "stroke-sky-500/40" : "stroke-rose-500/50"}
              />
            ) : null,
          )}
          <rect
            x={s(r.box.left)}
            y={s(r.box.top)}
            width={Math.max(1, s(r.box.right - r.box.left))}
            height={Math.max(1, s(r.box.bottom - r.box.top))}
            fill="none"
            strokeWidth={2}
            className="stroke-foreground"
          />
        </svg>
        <div className="grid content-start gap-2 font-mono text-[11px]">
          <label className="flex items-center gap-2">
            <span className="w-36 shrink-0">box side: {pct(size)}</span>
            <Range min={0} max={SIZES.length - 1} step={1} value={si} onChange={(e) => setSi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <span className="w-36 shrink-0">edge spread: {pct(sd)}</span>
            <Range min={0} max={SPREADS.length - 1} step={1} value={di} onChange={(e) => setDi(Number(e.target.value))} />
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={crossed} onChange={(e) => setCrossed(e.target.checked)} />
            <span>top and bottom cross (the model puts the top below the bottom)</span>
          </label>
          <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1">
            <span className="text-muted-foreground">decoded box</span>
            <span>
              {r.box.top.toFixed(3)} / {r.box.bottom.toFixed(3)} / {r.box.left.toFixed(3)} / {r.box.right.toFixed(3)}
            </span>
            <span className="text-muted-foreground">draws at IoU ≥ 0.5</span>
            <span>
              {r.hits.filter(Boolean).length} of {r.hits.length} = {r.share.toFixed(3)}
            </span>
            <span className="text-muted-foreground">calibrated confidence</span>
            <span className="font-semibold">{r.cal.toFixed(3)}</span>
          </div>
          <p className="mt-2 text-muted-foreground">
            Outlines: {SHOWN} of the 512 draws, blue when the draw overlaps the reported box at IoU 0.5 or more,
            red when it does not. One bin is 1/{BINS} of the image.
          </p>
        </div>
      </div>
    </figure>
  )
}
