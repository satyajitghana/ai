"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { ABLATIONS, JOINT16_R, SOLVE8 } from "./real-data"

// The released block on real photos. MEASURED: my re-implementation of Solv3R's inference path (encoder, block,
// camera decoding) loading the released 469 MB checkpoint, fp32, PyTorch 2.14.1 on 2 CPU threads, eight 504 x 336
// drone photos from the repo's examples/data/park (every fifth of 39) and sixteen for the joint run. The camera
// column is the mean pairwise relative-rotation disagreement with the released block's own 64-call solve: it says
// how far a solve is from where the trained block ends up, not how far it is from the truth (the park set has no
// ground-truth poses).

const GAMMA = 0.02
const W = 560
const H = 220
const PAD = { l: 44, r: 12, t: 12, b: 28 }
const LO = -3
const HI = 0
const sx = (k: number) => PAD.l + ((k - 1) / 63) * (W - PAD.l - PAD.r)
const sy = (r: number) => {
  const v = Math.min(HI, Math.max(LO, mlog10(Math.max(r, 1e-6))))
  return PAD.t + ((HI - v) / (HI - LO)) * (H - PAD.t - PAD.b)
}
const path = (r: readonly number[]) => r.map((v, i) => `${i ? "L" : "M"}${sx(i + 1).toFixed(1)},${sy(v).toFixed(1)}`).join("")

const TICKS: [number, string][] = [
  [0.001, "0.001"],
  [0.01, "0.01"],
  [0.1, "0.1"],
  [1, "1"],
]

const C_REL = "oklch(0.58 0.15 255)"
const C_16 = "oklch(0.62 0.10 200)"
const C_ABL = "oklch(0.64 0.17 40)"

type Key = keyof typeof ABLATIONS

const LABEL: Record<Key, string> = {
  none: "as released",
  no_injection: "drop the injection",
  no_rescale: "drop the RMS rescale",
  unit_gates: "gates set to 1",
}

function firstBelow(r: readonly number[]) {
  for (let i = 3; i < r.length; i++) if (r[i] < GAMMA) return i + 1
  return null
}

export function SolveTrace() {
  const [key, setKey] = useState<Key>("none")
  const abl = ABLATIONS[key]
  const stop8 = firstBelow(SOLVE8.r)
  const stopA = firstBelow(abl.r)
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        the released block on 8 real photos · relative state update r<sup>k</sup> per call, log scale · measured on CPU
      </div>
      <div className="flex flex-wrap gap-1.5 px-4 pt-3">
        {(Object.keys(LABEL) as Key[]).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setKey(k)}
            className={cn(
              "rounded-full border px-2.5 py-1 font-mono text-[11px]",
              k === key ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {LABEL[k]}
          </button>
        ))}
      </div>
      <div className="px-2 pt-2">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Relative state update per solver call">
          {TICKS.map(([v, label]) => (
            <g key={label}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(v)} y2={sy(v)} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PAD.l - 6} y={sy(v) + 3} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
                {label}
              </text>
            </g>
          ))}
          {[1, 16, 32, 48, 64].map((k) => (
            <text key={k} x={sx(k)} y={H - 10} textAnchor="middle" className="fill-muted-foreground font-mono text-[9px]">
              {k}
            </text>
          ))}
          <text x={W - PAD.r} y={H - 1} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
            solver call
          </text>
          <line x1={PAD.l} x2={W - PAD.r} y1={sy(GAMMA)} y2={sy(GAMMA)} stroke="currentColor" strokeDasharray="4 3" strokeOpacity={0.5} />
          <text x={W - PAD.r} y={sy(GAMMA) - 4} textAnchor="end" className="fill-muted-foreground font-mono text-[9px]">
            γ = 0.02
          </text>
          <path d={path(JOINT16_R)} fill="none" stroke={C_16} strokeWidth={1.5} strokeDasharray="2 2" />
          <path d={path(SOLVE8.r)} fill="none" stroke={C_REL} strokeWidth={2} />
          {key !== "none" && <path d={path(abl.r)} fill="none" stroke={C_ABL} strokeWidth={2} />}
        </svg>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 px-4 pb-2 font-mono text-[11px] text-muted-foreground">
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: C_REL }} />8 views, as released
        </span>
        <span>
          <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: C_16 }} />
          16 views, as released (48 calls)
        </span>
        {key !== "none" && (
          <span>
            <span className="mr-1 inline-block h-0.5 w-4 align-middle" style={{ background: C_ABL }} />8 views, {LABEL[key]}
          </span>
        )}
      </div>
      <div className="overflow-x-auto border-t px-4 py-2.5">
        <table className="w-full font-mono text-[11px] tabular-nums">
          <thead className="text-muted-foreground">
            <tr>
              <th className="text-left font-normal">camera disagreement with the released 64-call solve, mean °</th>
              {abl.rot.map(([k]) => (
                <th key={k} className="text-right font-normal">
                  call {k}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>{LABEL[key]}</td>
              {abl.rot.map(([k, d]) => (
                <td key={k} className="text-right">
                  {d < 0.005 ? "0" : d.toFixed(2)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
        <div className="pt-2 font-mono text-[11px] text-muted-foreground">
          r<sup>k</sup> first under γ (from call 4, the release&apos;s rule): as released at call{" "}
          <b className="text-foreground">{stop8 ?? "never"}</b>
          {key !== "none" && (
            <>
              ; {LABEL[key]} {stopA ? "at call " : ""}
              <b className="text-foreground">{stopA ?? "never within 64"}</b>
            </>
          )}
          . State RMS at call 64: <b className="text-foreground">{abl.rms64.toFixed(3)}</b> (target 0.852).
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-relaxed text-muted-foreground">
        Measured: my re-implementation of the inference path, loading the released weights, fp32 on 2 CPU threads, about
        2.3 s a call for 8 views. The ablations remove a part <i>at inference</i> from a block that was trained with it,
        which is a harsher test than the paper&apos;s retrained ablations (Table 4); they show what each part is doing in
        this checkpoint, not what a model trained without it would do. No ground truth: the camera row measures
        agreement with the released block&apos;s own answer.
      </figcaption>
    </figure>
  )
}
