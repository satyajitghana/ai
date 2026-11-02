"use client"

// Ray error of OmniRay, UniK3D and Depth Anything 3 on the five benchmark
// examples that the OmniRay project page ships as point clouds. The four clouds
// of an example (ground truth + three methods) are sampled at the same pixels,
// so the ray of pixel i is the unit vector of point i in each cloud and the
// per-pixel angle to the ground-truth ray is exact. We measured it with
// public/articles/omniray/code/demo_metrics.py. ONE image per camera, picked by
// the authors for the page: an illustration, not a benchmark. The white ticks
// are the paper's Table 4 values (reported), macro-averaged over each camera's
// whole test set.

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { DEMO } from "./data"

const METHODS = [
  { key: "omniray", label: "OmniRay", cls: "fill-emerald-500/80" },
  { key: "unik3d", label: "UniK3D", cls: "fill-amber-500/80" },
  { key: "da3", label: "Depth Anything 3", cls: "fill-rose-500/80" },
] as const

const LO = -2 // 0.01 degrees
const HI = 2.3 // 200 degrees
const W = 580
const X0 = 150
const X1 = 480
const x = (deg: number) => X0 + ((Math.min(Math.max(mlog10(Math.max(deg, 1e-2)), LO), HI) - LO) / (HI - LO)) * (X1 - X0)
const fmt = (d: number) => (d >= 10 ? d.toFixed(1) : d >= 1 ? d.toFixed(2) : d.toFixed(3))

export function DemoClouds() {
  const groupH = 62
  const H = DEMO.length * groupH + 40

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>mean ray error on the project page&apos;s own examples</span>
        <span className="text-muted-foreground/60">one image per camera, measured by us</span>
      </div>
      <div className="p-4 sm:p-5">
        <div className="overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[540px]" role="img">
            <title>
              {"Mean angular error of the predicted ray field, in degrees on a log scale, for each camera example. " +
                DEMO.map((d) => `${d.label}: OmniRay ${fmt(d.omniray)}, UniK3D ${fmt(d.unik3d)}, Depth Anything 3 ${fmt(d.da3)}`).join("; ")}
            </title>
            {[-2, -1, 0, 1, 2].map((e) => (
              <g key={e}>
                <line x1={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} x2={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} y1={4} y2={H - 26} className="stroke-border" strokeDasharray="1 4" />
                <text x={X0 + ((e - LO) / (HI - LO)) * (X1 - X0)} y={H - 12} textAnchor="middle" fontSize={9} className="fill-muted-foreground font-mono">
                  {e === 0 ? "1°" : e < 0 ? `${10 ** e}°` : `${10 ** e}°`}
                </text>
              </g>
            ))}
            {DEMO.map((d, i) => {
              const y0 = 8 + i * groupH
              return (
                <g key={d.id}>
                  <text x={X0 - 10} y={y0 + 22} textAnchor="end" fontSize={11} className="fill-foreground font-mono">
                    {d.label}
                  </text>
                  {d.heldOut && (
                    <text x={X0 - 10} y={y0 + 35} textAnchor="end" fontSize={9} className="fill-muted-foreground font-mono">
                      withheld from training
                    </text>
                  )}
                  {METHODS.map((m, j) => {
                    const v = d[m.key]
                    const y = y0 + j * 17
                    const paper = d.paper[m.key]
                    return (
                      <g key={m.key}>
                        <rect x={X0} y={y} width={Math.max(x(v) - X0, 1.5)} height={12} rx={2} className={m.cls} />
                        <rect x={x(paper) - 1.25} y={y - 2} width={2.5} height={16} className="fill-foreground" />
                        <text x={Math.max(x(v), X0) + 6} y={y + 10} fontSize={9.5} className="fill-foreground font-mono">
                          {`${fmt(v)}°`}
                        </text>
                      </g>
                    )
                  })}
                </g>
              )
            })}
          </svg>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-muted-foreground">
          {METHODS.map((m) => (
            <span key={m.key} className="flex items-center gap-1.5">
              <span className={cn("inline-block h-2.5 w-4 rounded-sm", m.cls.replace("fill-", "bg-"))} />
              {m.label}
            </span>
          ))}
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-0.5 bg-foreground" />
            paper, Table 4 (reported)
          </span>
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Bars: mean angle between each pixel&apos;s predicted ray and its ground-truth ray, from the example clouds on the project page. Ticks: the paper&apos;s macro-average over each
          camera&apos;s test set. The two disagree where a single picked example is easier or harder than the average.
        </p>
      </div>
    </figure>
  )
}
