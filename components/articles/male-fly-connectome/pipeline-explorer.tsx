"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The MaleCNS pipeline, stage by stage: what each stage does, who does it
// (machines, people or both), the numbers the paper reports for it, and how
// big its output is on one shared log scale. Every value is a literal taken
// from Berg et al. (Cell 2026) or its bioRxiv v2 preprint, or read from the
// public volume metadata (gs://flyem-male-cns/em/em-clahe-jpeg/info), and each
// is tagged reported / measured / reasoned exactly as the article tags it.
// Bar widths are precomputed literals: (log10(v) - 1) / 14 * 100 for a scale
// running 10 to 10^15, so nothing is computed at render time and server and
// client cannot disagree.

type Tag = "reported" | "measured" | "reasoned"
type Who = "people" | "machines" | "both"
type Fact = { k: string; v: string; tag: Tag }
type Stage = { id: string; name: string; who: Who; what: string; facts: Fact[]; out: string[] }

const STAGES: Stage[] = [
  {
    id: "sample",
    name: "Sample",
    who: "people",
    what: "Hundreds of five-day-old males were dissected with brain, neck connective and nerve cord still joined, then fixed and stained for electron microscopy. 44 were screened by X-ray CT and one, Z0720-07m, was kept.",
    facts: [
      { k: "specimens screened by X-ray CT", v: "44", tag: "reported" },
      { k: "specimens imaged", v: "1", tag: "reported" },
    ],
    out: [],
  },
  {
    id: "slabs",
    name: "Hot-knife slabs",
    who: "people",
    what: "The CNS is too big to mill as one FIB-SEM block, so a heated, oil-lubricated diamond knife cuts it into 20 µm slabs: the nerve cord across its long axis, the brain sagittally.",
    facts: [
      { k: "brain slabs (sagittal)", v: "35", tag: "reported" },
      { k: "nerve-cord slabs (transverse)", v: "31", tag: "reported" },
      { k: "slab thickness", v: "20 µm", tag: "reported" },
    ],
    out: ["slabs"],
  },
  {
    id: "image",
    name: "eFIB-SEM imaging",
    who: "machines",
    what: "A gallium ion beam mills 8 nm off a slab face and a scanning electron beam images the fresh surface; repeat. Seven machines ran in parallel for about 13 months.",
    facts: [
      { k: "voxel", v: "8 × 8 × 8 nm", tag: "reported" },
      { k: "image volume", v: "160 teravoxels", tag: "reported" },
      { k: "volume / of which tissue", v: "0.082 / 0.054 mm³", tag: "reported" },
      { k: "raw size at one byte per voxel", v: "about 160 TB", tag: "reasoned" },
    ],
    out: ["voxels"],
  },
  {
    id: "align",
    name: "Align and stitch",
    who: "both",
    what: "Slabs are stitched within the brain and within the nerve cord. The brain is tilted back 18 degrees to square it with the axes, then joined to the cord at the neck by one non-rigid transform that absorbs a roughly 25 degree mismatch and fades out away from the cut.",
    facts: [
      { k: "aligned volume, bounding box", v: "94,088 × 78,317 × 134,576 voxels", tag: "measured" },
      { k: "share of that box actually imaged", v: "about 16%", tag: "reasoned" },
    ],
    out: [],
  },
  {
    id: "seg",
    name: "Segmentation",
    who: "machines",
    what: "Google's flood-filling networks grow one object at a time from a seed voxel. Run three times, on the right hemisphere, the left hemisphere and the nerve cord, and merged across the overlaps by shared voxel counts.",
    facts: [
      { k: "method", v: "flood-filling networks", tag: "reported" },
      { k: "orphan fragments still unattached at the end", v: "84.6 million", tag: "reported" },
    ],
    out: ["orph"],
  },
  {
    id: "syn",
    name: "Synapses and transmitters",
    who: "machines",
    what: "One network finds presynaptic T-bars, a second finds their postsynaptic partners. A ResNet50 looks at a cube around each T-bar and scores 7 transmitters.",
    facts: [
      { k: "presynapses (T-bars)", v: "46 million", tag: "reported" },
      { k: "postsynapses", v: "312 million", tag: "reported" },
      { k: "precision / recall, synapse as a unit", v: "0.82 / 0.81", tag: "reported" },
      { k: "hand-labelled validation", v: "114 cubes, 2,303 T-bars", tag: "reported" },
    ],
    out: ["pre", "post"],
  },
  {
    id: "proof",
    name: "Proofreading",
    who: "people",
    what: "29 proofreaders over 3 years attach cell bodies, cleave false merges, trace backbones, rule on merge proposals, link orphan fragments and review whole neurons. A model trained on their decisions, AutoProof, adds the small fragments nobody reached.",
    facts: [
      { k: "estimated effort", v: "44 person-years", tag: "reported" },
      { k: "manual merges / cleaves", v: "4,117,544 / 147,212", tag: "reported" },
      { k: "AutoProof merges, auto-accepted", v: "about 200k (about 4 person-years)", tag: "reported" },
    ],
    out: ["neurons"],
  },
  {
    id: "type",
    name: "Typing and graph",
    who: "both",
    what: "Every neuron gets a superclass, hemilineage and cell type from morphology and connectivity, cross-matched against FlyWire, hemibrain and MANC. What falls out is a graph.",
    facts: [
      { k: "neurons", v: "166,700", tag: "reported" },
      { k: "cell types", v: "11,710", tag: "reported" },
      { k: "neurons matched to an earlier dataset", v: "97.9%", tag: "reported" },
      { k: "connections / edges between proofread neurons", v: "124.2M / 25.6M", tag: "reported" },
    ],
    out: ["conn", "edges", "types"],
  },
]

// One log scale, 10 to 10^15. width = (log10(v) - 1) / 14 * 100, precomputed.
const LADDER = [
  { id: "voxels", label: "voxels imaged", value: "160 trillion", pct: 94.32 },
  { id: "post", label: "postsynapses detected", value: "312 million", pct: 53.53 },
  { id: "conn", label: "connections, both sides proofread", value: "124.2 million", pct: 50.67 },
  { id: "orph", label: "orphan fragments left over", value: "84.6 million", pct: 49.48 },
  { id: "pre", label: "presynapses detected", value: "46 million", pct: 47.59 },
  { id: "edges", label: "neuron-to-neuron edges", value: "25.6 million", pct: 45.77 },
  { id: "neurons", label: "neurons", value: "166,700", pct: 30.16 },
  { id: "types", label: "cell types", value: "11,710", pct: 21.92 },
  { id: "slabs", label: "slabs", value: "66", pct: 5.85 },
]

// Proofreading labour by protocol: bioRxiv v2, Figure S9f (shares as printed).
// Person-years are share x 44, rounded to one decimal: reasoned, not reported.
const EFFORT = [
  { name: "orphan linking", pct: 41, py: "18.0", color: "oklch(0.72 0.15 75)" },
  { name: "neuron review", pct: 28, py: "12.3", color: "oklch(0.62 0.19 10)" },
  { name: "cleaving", pct: 14, py: "6.2", color: "oklch(0.52 0.14 310)" },
  { name: "focused merging", pct: 8, py: "3.5", color: "oklch(0.55 0.13 255)" },
  { name: "cell-body fibre linking", pct: 5, py: "2.2", color: "oklch(0.7 0.02 250)" },
  { name: "backbone tracing", pct: 4, py: "1.8", color: "oklch(0.65 0.14 150)" },
]

const WHO: Record<Who, { label: string; color: string }> = {
  machines: { label: "machines", color: "oklch(0.62 0.15 205)" },
  people: { label: "people", color: "oklch(0.68 0.16 40)" },
  both: { label: "machines + people", color: "oklch(0.6 0.08 120)" },
}

const TAG: Record<Tag, string> = {
  reported: "text-muted-foreground",
  measured: "text-sky-700 dark:text-sky-300",
  reasoned: "text-amber-700 dark:text-amber-300",
}

export function PipelineExplorer() {
  const [active, setActive] = useState(2)
  const [unit, setUnit] = useState<"pct" | "py">("pct")
  const stage = STAGES[active]
  const who = WHO[stage.who]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        from one fly to one graph &mdash; pick a stage
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2 font-mono text-xs" role="group" aria-label="pipeline stage">
        {STAGES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setActive(i)}
            aria-pressed={active === i}
            className={cn(
              "cursor-pointer rounded px-2 py-1 transition-colors",
              active === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
            )}
          >
            {i + 1}. {s.name}
          </button>
        ))}
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[1.1fr_1fr]">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className="font-heading text-base font-semibold">{stage.name}</span>
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[11px] text-white"
              style={{ background: who.color }}
            >
              {who.label}
            </span>
          </div>
          <p className="text-[13px] leading-6 text-muted-foreground">{stage.what}</p>
          <dl className="mt-3 space-y-2">
            {stage.facts.map((f) => (
              <div key={f.k} className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-dashed pb-1">
                <dt className="text-[12px] text-muted-foreground">{f.k}</dt>
                <dd className="font-mono text-[12px] tabular-nums text-foreground">
                  {f.v}
                  <span className={cn("ml-2 text-[10px] uppercase tracking-wide", TAG[f.tag])}>{f.tag}</span>
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div>
          <div className="mb-2 font-mono text-[11px] text-muted-foreground">
            output sizes, one log scale (10 to 10¹⁵); this stage lit
          </div>
          <div className="space-y-1.5">
            {LADDER.map((row) => {
              const lit = stage.out.includes(row.id)
              return (
                <div key={row.id}>
                  <div className="flex items-baseline justify-between gap-2 font-mono text-[11px]">
                    <span className={lit ? "font-medium text-foreground" : "text-muted-foreground"}>{row.label}</span>
                    <span className={cn("tabular-nums", lit ? "text-foreground" : "text-muted-foreground")}>{row.value}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full transition-opacity"
                      style={{
                        width: `${row.pct}%`,
                        background: lit ? "oklch(0.62 0.15 205)" : "var(--muted-foreground)",
                        opacity: lit ? 0.95 : 0.35,
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            where the 44 person-years of proofreading went, by protocol
          </span>
          <div className="flex gap-1 font-mono text-[11px]" role="group" aria-label="effort unit">
            {(["pct", "py"] as const).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => setUnit(u)}
                aria-pressed={unit === u}
                className={cn(
                  "cursor-pointer rounded px-2 py-0.5 transition-colors",
                  unit === u ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {u === "pct" ? "share (reported)" : "person-years (reasoned)"}
              </button>
            ))}
          </div>
        </div>
        <div className="flex h-4 overflow-hidden rounded" aria-hidden>
          {EFFORT.map((e) => (
            <div key={e.name} style={{ width: `${e.pct}%`, background: e.color }} />
          ))}
        </div>
        <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-[11px] sm:grid-cols-3">
          {EFFORT.map((e) => (
            <li key={e.name} className="flex items-center gap-1.5">
              <span className="size-2 shrink-0 rounded-full" style={{ background: e.color }} aria-hidden />
              <span className="text-muted-foreground">{e.name}</span>
              <span className="ml-auto tabular-nums text-foreground">
                {unit === "pct" ? `${e.pct}%` : e.py}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <figcaption className="border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground">
        Sources: Berg et al., Cell 2026 (counts, methods) and its bioRxiv v2 preprint, Figure S9f
        (effort shares). The bounding box is read from the public volume metadata; the 16% and the
        person-year split are my arithmetic. Orange is people, blue is machines, olive is both.
      </figcaption>
    </figure>
  )
}
