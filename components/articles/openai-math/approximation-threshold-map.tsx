"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What the theoretical-CS families in openai/math would change about the
// "how good can a polynomial-time algorithm be?" map, for six problems an
// engineer meets. Each bar is one problem's guarantee axis. Green: a
// polynomial-time algorithm achieves it. Red: NP-hard (assuming P != NP, no
// polynomial-time algorithm does). Grey: nobody knew. The numeric rows are to
// scale on the axis shown; the schematic rows (marked) only order the regimes.
//
// Sources for "before" (all pre-release): Goemans-Williamson 1995 (0.87856);
// Hastad 2001 + Trevisan-Sorkin-Sudan-Williamson (16/17 ~ 0.9412 NP-hard);
// Khot-Minzer-Safra 2018 (Vertex Cover sqrt 2 - eps); Arora-Rao-Vazirani
// (O(sqrt log n) sparsest cut); Barto-Bulin-Krokhin-Oprsal (5 colours NP-hard);
// Kawarabayashi-Thorup-Yoneda 2024 and Bansal-Huang-Lee (arXiv 2602.05904,
// about n^0.195 colours);
// Jain-Mahdian-Saberi 2002 (k-median 1+2/e hardness); Cohen-Addad et al.,
// arXiv 2503.10972 (k-median 2+eps); Hoberg-Rothvoss 2017 (OPT + O(log OPT)).
// "After" is what families 102, 106, 117, 118 and 125 claim; none of it is
// independently verified.

type Zone = "hard" | "open" | "easy"
type Seg = [from: number, to: number, zone: Zone]
type Tick = [at: number, label: string]

type Problem = {
  name: string
  family: string
  axis: string
  schematic?: boolean
  ticks: Tick[]
  before: Seg[]
  after: Seg[]
  beforeNote: string
  afterNote: string
}

// Max-Cut axis: ratio r in [0.5, 1] -> (r - 0.5) * 200.
// Vertex Cover axis: factor f in [1, 2.2] -> (f - 1) / 1.2 * 100.
// k-median axis: factor f in [1, 2.5] -> (f - 1) / 1.5 * 100.
const PROBLEMS: Problem[] = [
  {
    name: "Max-Cut",
    family: "102",
    axis: "fraction of the best cut you are guaranteed",
    ticks: [
      [0, "0.5"],
      [75.71, "0.878"],
      [88.24, "16/17"],
      [100, "1"],
    ],
    before: [
      [0, 75.71, "easy"],
      [75.71, 88.24, "open"],
      [88.24, 100, "hard"],
    ],
    after: [
      [0, 75.71, "easy"],
      [75.71, 100, "hard"],
    ],
    beforeNote: "Goemans–Williamson reaches 0.878; NP-hardness started only at 16/17. The UGC made 0.878 optimal, conditionally.",
    afterNote: "Anything above 0.878 is NP-hard on unweighted graphs, so random-hyperplane rounding is the end of the road.",
  },
  {
    name: "Vertex Cover",
    family: "102",
    axis: "approximation factor (smaller is better)",
    ticks: [
      [0, "1"],
      [34.52, "√2"],
      [83.33, "2"],
      [100, "2.2"],
    ],
    before: [
      [0, 34.52, "hard"],
      [34.52, 83.33, "open"],
      [83.33, 100, "easy"],
    ],
    after: [
      [0, 83.33, "hard"],
      [83.33, 100, "easy"],
    ],
    beforeNote: "Take both ends of a maximal matching and you are within 2; the 2-to-2 theorem made √2 − ε NP-hard.",
    afterNote: "Every factor below 2 is NP-hard: the matching trick from the textbook is optimal.",
  },
  {
    name: "k-median",
    family: "125",
    axis: "approximation factor (smaller is better)",
    ticks: [
      [0, "1"],
      [49.05, "1 + 2/e"],
      [66.67, "2"],
      [100, "2.5"],
    ],
    before: [
      [0, 49.05, "hard"],
      [49.05, 66.67, "open"],
      [66.67, 100, "easy"],
    ],
    after: [
      [0, 49.05, "hard"],
      [49.05, 100, "easy"],
    ],
    beforeNote: "Hard below 1 + 2/e ≈ 1.736 since 2002; the best algorithm reached 2 + ε.",
    afterNote: "The algorithm side moves: 1 + 2/e + ε is achievable, so the threshold is exact.",
  },
  {
    name: "Uniform Sparsest Cut",
    family: "117",
    axis: "approximation factor",
    schematic: true,
    ticks: [
      [0, "1"],
      [60, "any constant"],
      [80, "O(√log n)"],
    ],
    before: [
      [0, 80, "open"],
      [80, 100, "easy"],
    ],
    after: [
      [0, 60, "hard"],
      [60, 80, "open"],
      [80, 100, "easy"],
    ],
    beforeNote: "Arora–Rao–Vazirani get O(√log n); no constant factor was known to be NP-hard (only conditional results).",
    afterNote: "Every constant factor is NP-hard, by a direct reduction that does not use the UGC paper.",
  },
  {
    name: "Colouring a 3-colourable graph",
    family: "106",
    axis: "colours used",
    schematic: true,
    ticks: [
      [0, "3"],
      [22, "5"],
      [60, "any constant"],
      [80, "≈ n^0.195"],
    ],
    before: [
      [0, 22, "hard"],
      [22, 80, "open"],
      [80, 100, "easy"],
    ],
    after: [
      [0, 60, "hard"],
      [60, 80, "open"],
      [80, 100, "easy"],
    ],
    beforeNote: "Five colours was the NP-hardness record until Fei–Minzer–Wang (14 Sep 2026) proved every constant; algorithms need about n^0.195 colours.",
    afterNote: "Every constant is NP-hard, and so is finding an independent set of any fixed fraction of the vertices.",
  },
  {
    name: "Bin packing",
    family: "118",
    axis: "bins used",
    schematic: true,
    ticks: [
      [0, "OPT"],
      [60, "OPT + any c"],
      [80, "OPT + O(log OPT)"],
    ],
    before: [
      [0, 8, "hard"],
      [8, 80, "open"],
      [80, 100, "easy"],
    ],
    after: [
      [0, 60, "hard"],
      [60, 80, "open"],
      [80, 100, "easy"],
    ],
    beforeNote: "Exact is NP-hard; Hoberg–Rothvoss reach OPT + O(log OPT); OPT + 1 was conjectured possible.",
    afterNote: "OPT + c is NP-hard for every fixed c, and the configuration LP can be off by any number of bins.",
  },
]

const ZONE_CLASS: Record<Zone, string> = {
  hard: "bg-rose-500/70 dark:bg-rose-400/70",
  open: "bg-zinc-400/30 dark:bg-zinc-500/40",
  easy: "bg-emerald-500/70 dark:bg-emerald-400/70",
}
const ZONE_LABEL: Record<Zone, string> = { hard: "NP-hard", open: "unknown", easy: "achieved" }

function Bar({ segs, ticks }: { segs: Seg[]; ticks: Tick[] }) {
  return (
    <div className="relative mt-1 pb-5">
      <div className="relative h-4 overflow-hidden rounded-sm">
        {segs.map(([from, to, zone]) => (
          <div
            key={`${from}-${zone}`}
            title={ZONE_LABEL[zone]}
            className={cn("absolute inset-y-0 transition-all duration-500", ZONE_CLASS[zone])}
            style={{ left: `${from}%`, width: `${to - from}%` }}
          />
        ))}
      </div>
      {ticks.map(([at, label], i) => (
        <div
          key={label}
          className="absolute top-4 flex flex-col items-center text-[10px] leading-tight text-muted-foreground"
          style={{
            left: `${at}%`,
            transform: i === 0 ? "none" : at >= 99 ? "translateX(-100%)" : "translateX(-50%)",
          }}
        >
          <span className="h-1.5 w-px bg-foreground/40" />
          <span className="whitespace-nowrap">{label}</span>
        </div>
      ))}
    </div>
  )
}

export function ApproximationThresholdMap() {
  const [after, setAfter] = useState(true)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-muted-foreground">show</span>
        <button
          type="button"
          aria-pressed={!after}
          onClick={() => setAfter(false)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs",
            !after ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground",
          )}
        >
          before the release
        </button>
        <button
          type="button"
          aria-pressed={after}
          onClick={() => setAfter(true)}
          className={cn(
            "rounded-full border px-2.5 py-0.5 text-xs",
            after ? "border-foreground/60 bg-foreground/10" : "border-border text-muted-foreground",
          )}
        >
          if the release is right
        </button>
        <span className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
          {(["easy", "open", "hard"] as Zone[]).map((z) => (
            <span key={z} className="flex items-center gap-1">
              <span className={cn("inline-block h-2.5 w-2.5 rounded-sm", ZONE_CLASS[z])} />
              {ZONE_LABEL[z]}
            </span>
          ))}
        </span>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {PROBLEMS.map((p) => (
          <div key={p.name}>
            <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
              <span className="font-medium">{p.name}</span>
              <span className="text-xs text-muted-foreground">
                {p.axis}
                {p.schematic ? " · schematic, not to scale" : ""} · family {p.family}
              </span>
            </div>
            <Bar segs={after ? p.after : p.before} ticks={p.ticks} />
            <p className="text-xs text-muted-foreground">{after ? p.afterNote : p.beforeNote}</p>
          </div>
        ))}
      </div>

      <figcaption className="mt-4 text-xs text-muted-foreground">
        Green is what a polynomial-time algorithm already guarantees, red is NP-hard, grey is open. &ldquo;Before&rdquo;
        uses only published results; &ldquo;after&rdquo; is what families 102, 106, 117, 118 and 125 of openai/math
        claim, unreviewed. Hardness means no polynomial-time algorithm unless P = NP; it says nothing about how well
        heuristics do on the instances you actually have.
      </figcaption>
    </figure>
  )
}
