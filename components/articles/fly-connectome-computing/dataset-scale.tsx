"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Every number below is real and independently verified (primary papers,
// Google's announcement, or the project's own README/code) — nothing here is
// interpolated or computed at runtime. Log-scale bar widths are precomputed
// literals, not runtime Math.log10, so there is nothing for server/client to
// disagree about. The point of the toggle is not to compute a number; it's to
// show that "neurons" and "synapses" are two totally different scales, and
// that even ONE dataset (MaleCNS) gets reported at three different sizes
// depending on who's counting what.

type Row = { label: string; value: string; pct: number; note: string; group: "dataset" | "project" }

const NEURONS: Row[] = [
  { label: "fly-brain-escape circuit", value: "4,296", pct: 10.55, note: "a deliberately extracted sub-circuit, not the whole dataset", group: "project" },
  { label: "MANC", value: "23,000", pct: 22.70, note: "male nerve cord only — no brain at all", group: "dataset" },
  { label: "Hemibrain", value: "25,000", pct: 23.30, note: "female, ~half the central brain, no VNC or optic lobes", group: "dataset" },
  { label: "BANC", value: "114,000", pct: 34.28, note: "female brain + cord, missing the lamina and retina", group: "dataset" },
  { label: "FlyWire / FAFB", value: "139,255", pct: 35.73, note: "female whole brain, no ventral nerve cord", group: "dataset" },
  { label: "flycoinrh (retained)", value: "165,122", pct: 36.96, note: "MaleCNS after this project's own filtering", group: "project" },
  { label: "MaleCNS", value: "166,691", pct: 37.03, note: "male whole CNS, incl. sensory axons — Berg et al. / Google", group: "dataset" },
  { label: "FLM (retained nodes)", value: "166,700", pct: 37.03, note: "the same MaleCNS release, a different project's filter", group: "project" },
]

const SYNAPSES: Row[] = [
  { label: "fly-brain-escape circuit", value: "149,232", pct: 4.35, note: "synapses inside the sub-circuit only", group: "project" },
  { label: "flycoinrh", value: "10,228,000", pct: 50.24, note: "“signed connections” after this project's own threshold", group: "project" },
  { label: "Hemibrain", value: "20,000,000", pct: 57.53, note: "the paper's headline figure; also reported as 64M PSDs + 9.5M T‑bars", group: "dataset" },
  { label: "FLM", value: "25,582,938", pct: 60.20, note: "“directed connections” — same MaleCNS release, different filter", group: "project" },
  { label: "MaleCNS (presynapses)", value: "46,000,000", pct: 66.57, note: "the paper's own presynaptic-site count", group: "dataset" },
  { label: "FlyWire / FAFB", value: "50,000,000", pct: 67.47, note: "chemical synapses, whole female brain", group: "dataset" },
  { label: "BANC", value: "108,000,000", pct: 75.84, note: "synaptic connections, brain + cord", group: "dataset" },
  { label: "MaleCNS (Google's number)", value: "125,000,000", pct: 77.42, note: "the announcement's “synaptic connections” — a third figure for the same release", group: "dataset" },
  { label: "MaleCNS (PSDs)", value: "312,000,000", pct: 87.35, note: "postsynaptic densities — a fourth figure, same paper", group: "dataset" },
]

export function DatasetScale() {
  const [metric, setMetric] = useState<"neurons" | "synapses">("neurons")
  const rows = metric === "neurons" ? NEURONS : SYNAPSES

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          reported dataset sizes, log scale &mdash; every value verified, none interpolated
        </span>
        <div className="flex gap-1 font-mono text-xs">
          {(["neurons", "synapses"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMetric(m)}
              className={cn(
                "cursor-pointer rounded px-2 py-1 transition-colors",
                metric === m
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-pressed={metric === m}
            >
              {m === "neurons" ? "neurons" : "synapses / connections"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-4">
        {rows.map((row) => (
          <div key={row.label + metric}>
            <div className="mb-1 flex items-baseline justify-between gap-3">
              <span
                className={cn(
                  "font-mono text-[12px]",
                  row.group === "project" ? "text-muted-foreground" : "font-medium text-foreground"
                )}
              >
                {row.label}
              </span>
              <span className="font-mono text-[12px] tabular-nums text-foreground">{row.value}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${row.pct}%`,
                  background:
                    row.group === "project" ? "var(--muted-foreground)" : "oklch(0.62 0.15 205)",
                  opacity: row.group === "project" ? 0.55 : 0.9,
                }}
              />
            </div>
            <div className="mt-1 font-mono text-[11px] leading-4 text-muted-foreground">{row.note}</div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground">
        Blue bars are the five primary datasets; grey bars are downstream projects re-filtering the
        same release. Notice MaleCNS alone appears four times in the synapse view (46M / 125M / 312M,
        plus two more from downstream projects) &mdash; presynaptic sites, postsynaptic densities and a
        rounded press figure are three different counts of the same electron-microscopy volume.
      </div>
    </figure>
  )
}
