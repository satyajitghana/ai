"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { DISTANCES, READOUT } from "./data"

// Relative distance between the first 8 MiB of the same tensor in two
// checkpoints, ||A - B|| / ||B|| in percent (measured). "vs Qwen" compares each
// model to Qwen/Qwen3.8-27B at the revision both decision_config.json files pin.
// The delta cosine asks whether two models moved away from Qwen in the same direction.

type View = "qwen" | "d3"

export function WeightDistance() {
  const [view, setView] = useState<View>("qwen")
  const rows = DISTANCES.filter((r) => r.tensor !== "vision block 0 attn.qkv")
  const max = Math.max(...rows.map((r) => (view === "qwen" ? Math.max(r.d3, r.turbo, r.drex) : Math.max(r.turboVsD3, r.drexVsD3))))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 font-mono text-xs">
        {(
          [
            ["qwen", "distance from Qwen3.8-27B"],
            ["d3", "distance from d3"],
          ] as [View, string][]
        ).map(([v, label]) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={cn("rounded border px-2 py-0.5", view === v ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}
          >
            {label}
          </button>
        ))}
        <span className="ml-auto flex items-center gap-3 text-muted-foreground">
          {view === "qwen" && (
            <span className="flex items-center gap-1">
              <i className="inline-block h-2 w-2 rounded-sm bg-emerald-600" /> d3
            </span>
          )}
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-sm bg-sky-600" /> d3-turbo
          </span>
          <span className="flex items-center gap-1">
            <i className="inline-block h-2 w-2 rounded-sm bg-amber-500" /> Drex Max
          </span>
        </span>
      </div>
      <div className="grid gap-3 p-3">
        {rows.map((r) => {
          const bars =
            view === "qwen"
              ? [
                  { k: "d3", v: r.d3, c: "bg-emerald-600" },
                  { k: "d3-turbo", v: r.turbo, c: "bg-sky-600" },
                  { k: "Drex Max", v: r.drex, c: "bg-amber-500" },
                ]
              : [
                  { k: "d3-turbo", v: r.turboVsD3, c: "bg-sky-600" },
                  { k: "Drex Max", v: r.drexVsD3, c: "bg-amber-500" },
                ]
          return (
            <div key={r.tensor} className="grid gap-0.5 font-mono text-[11px]">
              <div className="flex justify-between">
                <span>{r.tensor}</span>
                <span className="text-muted-foreground">
                  delta cosine, Drex and d3: {r.cosDrexD3.toFixed(2)}; d3 and d3-turbo: {r.cosD3Turbo.toFixed(2)}
                </span>
              </div>
              {bars.map((b) => (
                <div key={b.k} className="flex items-center gap-2">
                  <span className="w-16 shrink-0 text-muted-foreground">{b.k}</span>
                  <span className="h-2 flex-1 rounded bg-muted">
                    <span className={cn("block h-2 rounded", b.c)} style={{ width: `${((100 * b.v) / max).toFixed(2)}%` }} />
                  </span>
                  <span className="w-14 shrink-0 text-right">{b.v.toFixed(3)}%</span>
                </div>
              ))}
            </div>
          )
        })}
        <div className="rounded border p-2 font-mono text-[11px]">
          <div className="mb-1 text-muted-foreground">Readout rows against Qwen3.8-27B&apos;s own lm_head rows at the 255 code tokens</div>
          {READOUT.map((x) => (
            <div key={x.model} className="flex justify-between">
              <span>
                {x.model} ({x.dtype})
              </span>
              <span>
                cosine {x.cosine.toFixed(4)}, moved {x.movedPct.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        Vision block 0 qkv: d3 and d3-turbo are bit-identical to Qwen (0%); Drex Max differs by 0.007%. Measured on first-8-MiB slices, not whole tensors.
      </figcaption>
    </figure>
  )
}
