"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"

// Table 2 of the paper (arXiv 2610.28954): 300 coarse control videos (100 game renders, 100 geometry blockouts,
// 100 stylized animations), every score averaged over 300 videos per method. Numbers are copied from the paper's
// text, not re-run. "rep." = fine-tuned by the authors on the same pseudo-paired videos as C2R#.
const METHODS = [
  "C2R original",
  "Editto Global",
  "Editto Sim2Real",
  "Editto Sim2Real (rep.)",
  "VACE 2.2",
  "VACE 2.2 (rep.)",
  "C2R#",
] as const

type Metric = { id: string; label: string; up: boolean; note: string; v: number[] }

const METRICS: Metric[] = [
  { id: "tech", label: "DOVER technical", up: true, note: "learned technical-quality score", v: [0.2647, 0.2648, 0.2288, 0.2504, 0.2599, 0.2487, 0.2841] },
  { id: "aes", label: "DOVER aesthetic", up: true, note: "learned aesthetic score", v: [0.8033, 0.77, 0.7124, 0.7589, 0.7768, 0.7117, 0.8169] },
  { id: "rq", label: "VEFX rendering quality", up: true, note: "learned editing-quality judge", v: [3.5082, 3.4876, 2.6722, 3.1011, 3.411, 2.9695, 3.5679] },
  { id: "if", label: "VEFX instruction following", up: true, note: "learned editing-quality judge", v: [2.8467, 2.9035, 1.4108, 1.7402, 2.5446, 2.4918, 3.1823] },
  { id: "ee", label: "VEFX edit exclusivity", up: true, note: "learned editing-quality judge", v: [2.3468, 2.3637, 1.6995, 2.245, 2.3182, 2.5334, 2.5923] },
  { id: "bg", label: "VBench background consistency", up: true, note: "temporal consistency", v: [0.9259, 0.9338, 0.9254, 0.9283, 0.9354, 0.9272, 0.9343] },
  { id: "dino", label: "DINO displacement", up: false, note: "control alignment, lower is better", v: [0.0226, 0.0189, 0.0196, 0.0111, 0.0135, 0.0114, 0.0147] },
  { id: "flow", label: "Flow agreement", up: true, note: "control alignment", v: [0.6041, 0.6897, 0.5986, 0.7314, 0.7466, 0.7347, 0.6588] },
  { id: "cam", label: "Camera-pose error", up: false, note: "control alignment, lower is better", v: [0.1733, 0.1634, 0.1788, 0.1574, 0.1491, 0.1549, 0.16] },
  { id: "real", label: "VLM realism, 0-100", up: true, note: "judged by a Qwen model", v: [75.5, 66.77, 52.62, 58.52, 61.88, 51.96, 74.17] },
]

function fmt(v: number) {
  return v >= 10 ? v.toFixed(2) : v < 0.1 ? v.toFixed(4) : v.toFixed(4)
}

export function TableExplorer() {
  const [mi, setMi] = useState(9)
  const m = METRICS[mi]
  const lo = Math.min(...m.v)
  const hi = Math.max(...m.v)
  const order = m.v.map((v, i) => ({ v, i })).sort((a, b) => (m.up ? b.v - a.v : a.v - b.v))
  const rank = new Map(order.map((o, r) => [o.i, r + 1]))
  const norm = (v: number) => (hi === lo ? 1 : 0.12 + 0.88 * (m.up ? (v - lo) / (hi - lo) : (hi - v) / (hi - lo)))
  const ours = rank.get(6) ?? 0
  return (
    <figure className="not-prose my-8 rounded-lg border border-border p-4">
      <div className="mb-3 flex flex-wrap gap-1.5" role="tablist" onKeyDown={tablistKeys()} aria-label="Metric">
        {METRICS.map((x, i) => (
          <button
            key={x.id}
            role="tab"
            aria-selected={i === mi}
            tabIndex={i === mi ? 0 : -1}
            onClick={() => setMi(i)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs",
              i === mi ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="space-y-1.5">
        {METHODS.map((name, i) => (
          <div key={name} className="grid grid-cols-[9.5rem_1fr_4.5rem] items-center gap-2 text-sm sm:grid-cols-[12rem_1fr_5rem]">
            <span className={cn("truncate", i === 6 && "font-semibold")}>{name}</span>
            <div className="h-4 rounded-sm bg-muted">
              <div
                className="h-4 rounded-sm"
                style={{
                  width: `${Math.round(norm(m.v[i]) * 100)}%`,
                  background: i === 6 ? "oklch(0.62 0.17 255)" : "oklch(0.7 0.03 255)",
                }}
              />
            </div>
            <span className="text-right font-mono text-xs tabular-nums">
              {fmt(m.v[i])} <span className="text-muted-foreground">#{rank.get(i)}</span>
            </span>
          </div>
        ))}
      </div>
      <figcaption className="mt-3 text-sm leading-relaxed">
        <strong>{m.label}</strong> ({m.up ? "higher" : "lower"} is better; {m.note}). C2R# ranks <strong>#{ours}</strong> of 7 on it. Bar length is
        scaled between the worst and best method on this metric only, so a short bar is not a bad score on an absolute scale.{" "}
        <span className="font-mono text-xs uppercase text-muted-foreground">reported</span>
      </figcaption>
    </figure>
  )
}
