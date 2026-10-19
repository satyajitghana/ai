"use client"

import { useState } from "react"

// Per-species accuracy of the released ConvNeXtV2-Base x3 model (256 px),
// computed from results/oof/convnextv2_256_random.npz in the FOR20K repo:
// every tree of the 17,707-tree public set predicted by the fold model that
// did not train on it. Columns: species, trees, recall (accuracy within the
// species), number of source datasets the species occurs in, the source
// dataset holding most of its trees, and how many species that source holds.
// Measured by us from the released files; no model was re-run for this chart.
const ROWS: [string, number, number, number, string, number][] = [
  ["Corylus avellana", 48, 1.000, 1, "Calders_2022", 6],
  ["Picea glauca", 164, 1.000, 1, "UBC_2022", 2],
  ["Pinus radiata", 97, 1.000, 1, "FORinstance_SCION", 1],
  ["Populus tremuloides", 108, 0.991, 1, "Xi_2020a", 3],
  ["Eucalyptus miniata", 280, 0.982, 1, "Luck", 1],
  ["Pinus contorta", 322, 0.975, 1, "Xi_2020a", 3],
  ["Pinus resinosa", 168, 0.970, 1, "Xi_2020b", 2],
  ["Acer saccharum", 110, 0.964, 1, "Xi_2020b", 2],
  ["Pinus sylvestris", 3296, 0.957, 13, "Saarinen_2021", 1],
  ["Picea abies", 1983, 0.949, 12, "Weiser_2022b", 15],
  ["Pseudotsuga menziesii", 658, 0.944, 5, "Weiser_2022b", 15],
  ["Acer pseudoplatanus", 576, 0.936, 3, "Calders_2022", 6],
  ["Populus deltoides", 58, 0.931, 1, "Xi_2020a", 3],
  ["Quercus rubra", 160, 0.931, 3, "Weiser_2022b", 15],
  ["Quercus faginea", 1014, 0.930, 1, "Owen_2021", 5],
  ["Fagus sylvatica", 2482, 0.926, 5, "BlueCat_b", 3],
  ["Betula pendula", 735, 0.898, 9, "Puliti_b", 3],
  ["Quercus robur", 195, 0.892, 8, "Frey_2022", 6],
  ["Quercus petraea", 361, 0.884, 2, "Weiser_2022b", 15],
  ["Pinus nigra", 464, 0.881, 1, "Owen_2021", 5],
  ["Abies alba", 119, 0.874, 7, "Puliti_a", 4],
  ["Acer campestre", 1240, 0.821, 3, "BlueCat_a", 9],
  ["Quercus ilex", 299, 0.806, 1, "Owen_2021", 5],
  ["Larix decidua", 94, 0.766, 5, "Weiser_2022b", 15],
  ["Prunus avium", 42, 0.738, 1, "Weiser_2022b", 15],
  ["Carpinus betulus", 1243, 0.722, 3, "BlueCat_a", 9],
  ["Crataegus monogyna", 229, 0.712, 2, "BlueCat_a", 9],
  ["Pinus pinaster", 103, 0.709, 1, "Owen_2021", 5],
  ["Fraxinus angustifolia", 107, 0.682, 1, "BlueCat_a", 9],
  ["Tilia cordata", 444, 0.644, 1, "BlueCat_a", 9],
  ["Ulmus laevis", 278, 0.554, 1, "BlueCat_a", 9],
  ["Euonymus europaeus", 104, 0.548, 1, "BlueCat_a", 9],
  ["Fraxinus excelsior", 126, 0.397, 5, "Calders_2022", 6],
]

// Same trees, two models: the random-split model, and one trained without the
// tree's own (source, species) cell. Recomputed by us from the released
// convnextv2_256_source_holdout.npz with the repo's support rule (at least 50
// same-LiDAR training trees and 20 held-out trees per cell).
const GAP: [string, number, number, number][] = [
  ["Pinus sylvestris", 3048, 0.961, 0.691],
  ["Picea abies", 1983, 0.949, 0.546],
  ["Betula pendula", 210, 0.91, 0.248],
  ["Quercus robur", 182, 0.923, 0.357],
  ["Fagus sylvatica", 44, 0.932, 0.341],
  ["Pseudotsuga menziesii", 43, 0.93, 0.698],
  ["Fraxinus excelsior", 32, 0.125, 0.0],
  ["Acer pseudoplatanus", 24, 0.792, 0.0],
]

const btn = (on: boolean) =>
  `rounded border px-2 py-0.5 font-mono text-xs ${on ? "border-primary bg-primary/10 text-foreground" : "text-muted-foreground hover:text-foreground"}`

const NARROW = "#2A9D8F" // main source holds 3 species or fewer
const MIXED = "#C77D2E" // main source holds more

export function SpeciesBars() {
  const [tab, setTab] = useState<"species" | "source">("species")
  const [sort, setSort] = useState<"acc" | "trees">("acc")
  const rows = [...ROWS].sort((a, b) => (sort === "acc" ? b[2] - a[2] : b[1] - a[1]))

  return (
    <div className="my-8 rounded-md border bg-muted/30 p-4 sm:p-5">
      <div className="font-mono text-xs tracking-wide text-muted-foreground uppercase">
        Where the 256 px model is right, by species (measured from the released out-of-fold predictions)
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
        <button type="button" className={btn(tab === "species")} onClick={() => setTab("species")}>
          33 species, random split
        </button>
        <button type="button" className={btn(tab === "source")} onClick={() => setTab("source")}>
          8 species, unseen source
        </button>
        {tab === "species" && (
          <span className="ml-auto flex items-center gap-1.5">
            <span className="text-muted-foreground">Sort</span>
            <button type="button" className={btn(sort === "acc")} onClick={() => setSort("acc")}>
              accuracy
            </button>
            <button type="button" className={btn(sort === "trees")} onClick={() => setSort("trees")}>
              trees
            </button>
          </span>
        )}
      </div>

      {tab === "species" ? (
        <>
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: NARROW }} />
              its main source holds 3 species or fewer
            </span>
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: MIXED }} />
              its main source holds 4 to 15 species
            </span>
          </div>
          <div className="mt-2 space-y-0.5">
            {rows.map(([sp, n, acc, nsrc, src, k]) => (
              <div key={sp} className="grid grid-cols-[minmax(0,10.5rem)_1fr_3.2rem] items-center gap-2 text-xs">
                <span className="truncate italic" title={`${src}, ${k} species; occurs in ${nsrc} source(s)`}>
                  {sp}
                </span>
                <span className="relative h-3 rounded-sm bg-muted">
                  <span
                    className="absolute inset-y-0 left-0 rounded-sm"
                    style={{ width: `${(acc * 100).toFixed(1)}%`, background: k <= 3 ? NARROW : MIXED }}
                  />
                  <span className="absolute inset-y-0 right-1 font-mono text-[10px] leading-3 text-muted-foreground">
                    n={n}
                  </span>
                </span>
                <span className="text-right font-mono tabular-nums">{(acc * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Overall accuracy 88.6%, mean per-species accuracy 84.6%. The eight best species, all at 96.4% or above,
            each occur in a single source dataset; six of the ten weakest come from one dense mixed forest,
            BlueCat_a, which holds nine species.
          </p>
        </>
      ) : (
        <>
          <div className="mt-3 space-y-2">
            {GAP.map(([sp, n, a, b]) => (
              <div key={sp} className="text-xs">
                <div className="flex justify-between">
                  <span className="italic">{sp}</span>
                  <span className="font-mono text-muted-foreground tabular-nums">n={n}</span>
                </div>
                {(
                  [
                    ["random split", a, NARROW],
                    ["unseen source", b, MIXED],
                  ] as [string, number, string][]
                ).map(([lab, v, c]) => (
                  <div key={lab} className="grid grid-cols-[6.5rem_1fr_3.2rem] items-center gap-2">
                    <span className="text-muted-foreground">{lab}</span>
                    <span className="relative h-2.5 rounded-sm bg-muted">
                      <span
                        className="absolute inset-y-0 left-0 rounded-sm"
                        style={{ width: `${(v * 100).toFixed(1)}%`, background: c }}
                      />
                    </span>
                    <span className="text-right font-mono tabular-nums">{(v * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            5,566 trees, scored twice. Tree-weighted: 94.8% to 60.2%. Species mean: 81.5% to 36.0%. The species is
            still in training from other sources, with at least 50 trees of the same LiDAR type.
          </p>
        </>
      )}
    </div>
  )
}
