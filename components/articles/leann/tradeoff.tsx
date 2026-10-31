"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"

import { FAISS, LEANN } from "./data"

// Recall@10 against cost for the same 20,000-chunk corpus. Left axis is recall; the x axis is either the number of
// vectors a query had to look at (distance computations for the stored-vector index, embedded texts for LEANN: the two
// should be close, and are) or seconds per query (log scale, drawn with a precomputed table, no Math.log).

type Mode = "work" | "time"
const W = 560
const H = 260
const PAD = { l: 44, r: 16, t: 14, b: 38 }

const TICKS_TIME = [0.0002, 0.001, 0.01, 0.1, 1, 10, 100]
const TICKS_TIME_LBL = ["0.2 ms", "1 ms", "10 ms", "0.1 s", "1 s", "10 s", "100 s"]

function pos(v: number, lo: number, hi: number, a: number, b: number): number {
  return a + ((v - lo) / (hi - lo)) * (b - a)
}

export function Tradeoff() {
  const [mode, setMode] = useState<Mode>("work")
  const lo = mlog10(0.0002)
  const hi = mlog10(100)
  const px = (x: number) => (mode === "work" ? pos(x, 0, 3000, PAD.l, W - PAD.r) : pos(mlog10(x), lo, hi, PAD.l, W - PAD.r))
  const py = (r: number) => pos(r, 0.7, 1, H - PAD.b, PAD.t)

  const fx = FAISS.map((p) => ({ x: mode === "work" ? p.ndis : p.lat_ms / 1000, r: p.recall, ef: p.ef }))
  const lx = LEANN.map((p) => ({ x: mode === "work" ? p.texts : p.sec, r: p.recall, ef: p.ef }))

  return (
    <figure className="not-prose my-8 rounded-lg border bg-card p-4 text-card-foreground">
      <div className="mb-2 flex gap-2" role="group" aria-label="X axis">
        {(["work", "time"] as const).map((m) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => setMode(m)} className={`rounded border px-2.5 py-1 font-mono text-xs ${mode === m ? "border-foreground bg-foreground text-background" : "text-muted-foreground"}`}>
            {m === "work" ? "vectors touched" : "seconds per query"}
          </button>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Recall at 10 against cost for a stored-vector HNSW index and for LEANN">
        {[0.7, 0.8, 0.9, 1].map((r) => (
          <g key={r}>
            <line x1={PAD.l} x2={W - PAD.r} y1={py(r)} y2={py(r)} stroke="currentColor" strokeOpacity={0.12} />
            <text x={PAD.l - 6} y={py(r) + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.7}>
              {r.toFixed(1)}
            </text>
          </g>
        ))}
        {mode === "work"
          ? [0, 1000, 2000, 3000].map((t) => (
              <text key={t} x={px(t)} y={H - 20} textAnchor="middle" fontSize={10} fill="currentColor" opacity={0.7}>
                {t.toLocaleString("en-US")}
              </text>
            ))
          : TICKS_TIME.map((t, i) => (
              <text key={t} x={px(t)} y={H - 20} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.7}>
                {TICKS_TIME_LBL[i]}
              </text>
            ))}
        <polyline fill="none" stroke="oklch(0.62 0.12 250)" strokeWidth={1.6} points={fx.map((p) => `${px(p.x).toFixed(1)},${py(p.r).toFixed(1)}`).join(" ")} />
        <polyline fill="none" stroke="oklch(0.62 0.17 35)" strokeWidth={1.6} points={lx.map((p) => `${px(p.x).toFixed(1)},${py(p.r).toFixed(1)}`).join(" ")} />
        {fx.map((p) => (
          <circle key={`f${p.ef}`} cx={px(p.x)} cy={py(p.r)} r={3.5} fill="oklch(0.62 0.12 250)">
            <title>{`stored vectors, ef ${p.ef}: recall ${p.r.toFixed(3)}`}</title>
          </circle>
        ))}
        {lx.map((p) => (
          <circle key={`l${p.ef}`} cx={px(p.x)} cy={py(p.r)} r={3.5} fill="oklch(0.62 0.17 35)">
            <title>{`LEANN, ef ${p.ef}: recall ${p.r.toFixed(3)}`}</title>
          </circle>
        ))}
        <text x={PAD.l + 6} y={PAD.t + 10} fontSize={10} fill="oklch(0.62 0.12 250)">
          stored-vector HNSW (faiss)
        </text>
        <text x={PAD.l + 6} y={PAD.t + 24} fontSize={10} fill="oklch(0.62 0.17 35)">
          LEANN, recompute on every visit
        </text>
        <text x={14} y={H / 2} fontSize={10} fill="currentColor" opacity={0.7} transform={`rotate(-90 14 ${H / 2})`} textAnchor="middle">
          recall@10
        </text>
      </svg>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        Points are efSearch 16, 32, 64 and 128. Measured on this corpus; hover a point for its value.
      </figcaption>
    </figure>
  )
}
