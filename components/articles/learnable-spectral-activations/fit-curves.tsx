"use client"

import { useState } from "react"

import { FIT_RUN } from "./fit-data"

// Measured PSNR curves from one CPU run (see the article's "Running it"
// section; numbers in ./fit-data.ts are the run's own JSON, rounded). Toggle the
// x axis between optimisation steps and accumulated training seconds: the
// first is the paper's comparison, the second is the one it leaves out.

const COLORS: Record<string, string> = {
  lsa: "#c2410c",
  finer: "#0f766e",
  siren: "#2563eb",
  relupe: "#7c3aed",
  siren2k: "#2563eb",
}

export function FitCurves() {
  const [axis, setAxis] = useState<"steps" | "seconds">("steps")
  const series = FIT_RUN.series.filter((s) => axis === "seconds" || s.key !== "siren2k")

  const xOf = (s: (typeof FIT_RUN.series)[number], step: number) =>
    axis === "steps" ? step : (step * s.msPerStep) / 1000
  const xmax = Math.max(...series.map((s) => xOf(s, s.curve[s.curve.length - 1][0])))
  const ymin = 10
  const ymax = Math.ceil(Math.max(...series.flatMap((s) => s.curve.map((c) => c[1]))) / 5) * 5

  const W = 640
  const H = 300
  const pl = 44
  const pr = 12
  const pt = 12
  const pb = 34
  const sx = (x: number) => pl + (x / xmax) * (W - pl - pr)
  const sy = (y: number) => pt + ((ymax - Math.max(y, ymin)) / (ymax - ymin)) * (H - pt - pb)
  const yticks: number[] = []
  for (let y = ymin; y <= ymax; y += 5) yticks.push(y)
  const xticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * xmax)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>x axis</span>
        {(["steps", "seconds"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setAxis(k)}
            className={`rounded border px-2 py-0.5 ${axis === k ? "bg-muted text-foreground" : "hover:bg-muted"}`}
          >
            {k === "steps" ? "optimisation steps" : "training seconds (CPU)"}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="PSNR against training progress for four INR activations">
        {yticks.map((y) => (
          <g key={y}>
            <line x1={pl} y1={sy(y)} x2={W - pr} y2={sy(y)} stroke="currentColor" opacity={0.08} />
            <text x={pl - 6} y={sy(y)} textAnchor="end" dominantBaseline="middle" className="fill-current font-mono" fontSize={10} opacity={0.55}>
              {y}
            </text>
          </g>
        ))}
        {xticks.map((x, i) => (
          <text key={i} x={sx(x)} y={H - pb + 14} textAnchor="middle" className="fill-current font-mono" fontSize={10} opacity={0.55}>
            {x.toFixed(0)}
          </text>
        ))}
        <text x={W - pr} y={H - 4} textAnchor="end" className="fill-current font-mono" fontSize={10} opacity={0.6}>
          {axis === "steps" ? "step" : "seconds of training"}
        </text>
        <text x={pl} y={pt + 2} className="fill-current font-mono" fontSize={10} opacity={0.6} dominantBaseline="hanging">
          {" "}PSNR (dB)
        </text>
        {series.map((s) => (
          <path
            key={s.key}
            d={s.curve.map((c, i) => `${i === 0 ? "M" : "L"} ${sx(xOf(s, c[0])).toFixed(2)} ${sy(c[1]).toFixed(2)}`).join(" ")}
            fill="none"
            stroke={COLORS[s.key]}
            strokeWidth={s.key === "lsa" ? 2.6 : 1.8}
            strokeDasharray={s.key === "siren2k" ? "5 4" : undefined}
          />
        ))}
      </svg>
      <figcaption className="border-t px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {series.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1">
              <span className="inline-block h-[2px] w-4" style={{ background: COLORS[s.key] }} />
              {s.label}: <span className="text-foreground">{s.final.toFixed(2)} dB</span>, {s.params.toLocaleString("en-US")} params,{" "}
              {s.msPerStep.toFixed(0)} ms/step
            </span>
          ))}
        </div>
        <span className="mt-1 block">{FIT_RUN.note}</span>
      </figcaption>
    </figure>
  )
}
