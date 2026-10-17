"use client"

// One real 3DCodeVerse Harness run, round by round: what the code was, what
// the measurement gates found, how the score was computed from the judge's
// criteria and then capped by those measurements, and what the next round
// changed.
//
// Source: the dataset's own harness logs, 3dcodeverse_harness/bench/ablations/
// loop_w6.tar.zst on huggingface.co/datasets/ilabai/3dcodeverse, run
// `cage_tj_ss2` (rounds/r00.json..r02.json and the run's git history). Gate
// messages, fix hints, criterion scores, caps and code lines are copied from
// those files (MEASURED by reading them). The weighted criterion mean is
// REASONED: my arithmetic with the weights in the repo's
// judges/rubrics/static_object_v1.yaml. Nothing here was re-run.
//
// SSR-safe: plain state, no effects, no browser APIs. Bar widths are + - * /
// only.

import { useState } from "react"

type Finding = { gate: string; part: string; text: string; cap: string }
type Diff = { file: string; lines: string[] }
type Round = {
  key: string
  label: string
  kind: string
  mean: number
  penalty: number
  cap: number
  capWhy: string
  findings: Finding[]
  diffs: Diff[]
  diffNote: string
  next: string
  cost: string
}

const WEIGHTS = [
  ["intent", 0.22],
  ["structure", 0.18],
  ["detail", 0.16],
  ["proportions", 0.12],
  ["assembly", 0.12],
  ["materials", 0.1],
  ["craft", 0.1],
] as const

const ROUNDS: Round[] = [
  {
    key: "r00",
    label: "round 0",
    kind: "baseline: plan, then one single-shot generation",
    mean: 0.806,
    penalty: 0.18,
    cap: 0.6,
    capWhy: "floating_part ≤ 0.60",
    findings: [
      {
        gate: "connectivity",
        part: "TrapezeSwing",
        text: "part 'TrapezeSwing' is floating: nearest supported part is 'CageDomeCrown' at 98.2 mm",
        cap: "≤ 0.60",
      },
      {
        gate: "connectivity",
        part: "StandCentralPole",
        text: "'StandCentralPole' and 'StandTripodBase' interpenetrate by ≈17.5 mm (7% of surface samples inside)",
        cap: "≤ 0.70",
      },
      {
        gate: "contract",
        part: "StandCraneArm",
        text: "size 2.5×34.3×23.2 vs planned 12.0×33.0×24.0 cm (worst 7.9× tolerance)",
        cap: "≤ 0.75",
      },
    ],
    diffs: [
      {
        file: "src/parts/trapeze_swing.js",
        lines: [
          "  // SwivelLoop: 12 mm brass swivel eyelet connecting apex to roof hook at (0, 1.280, 0)",
          "  swivelGeo.translate(0, 1.285, 0);",
        ],
      },
    ],
    diffNote:
      "The swing's top eyelet ends at y = 1.285 m. Nothing reaches the crown, so the connectivity gate measures a 98.2 mm gap.",
    next:
      "3 gate tasks with numeric fix hints, e.g. translate 'TrapezeSwing' by (-0.0092, +0.0975, -0.0076) m (threejs frame: Y-up, +Z front), plus the judge's own instructions.",
    cost: "289 s, $0.16",
  },
  {
    key: "r01",
    label: "round 1",
    kind: "refine: fix agent applies the tasks, file by file",
    mean: 0.877,
    penalty: 0.08,
    cap: 0.7,
    capWhy: "penetration_error ≤ 0.70",
    findings: [
      {
        gate: "connectivity",
        part: "StandCraneArm",
        text: "'StandCraneArm' and 'StandCentralPole' interpenetrate by ≈10.8 mm (4% of surface samples inside)",
        cap: "≤ 0.70",
      },
      {
        gate: "contract",
        part: "TrapezeSwing",
        text: "size 14.0×33.5×2.8 vs planned 15.0×22.0×3.0 cm (worst 5.2× tolerance)",
        cap: "≤ 0.75",
      },
    ],
    diffs: [
      {
        file: "src/parts/trapeze_swing.js",
        lines: [
          "-  swivelGeo.translate(0, 1.285, 0);",
          "+  // Suspension chain links extending up to CageDomeCrown ceiling (~1.39 m)",
          "+  const startY = 1.266;",
          "+  const numLinks = 7;",
          "+  topAnchorRing.translate(0, 1.392, 0);",
        ],
      },
      {
        file: "src/parts/stand_central_pole.js",
        lines: ["-  const poleCenterY = 0.815;", "+  const poleCenterY = 0.829;"],
      },
    ],
    diffNote:
      "A seven-link chain now hangs the swing from the crown, and the pole moves up 14 mm out of the tripod. Both round-0 connectivity errors are gone. But the chain makes the swing 33.5 cm tall against a planned 22.0, and the raised pole now runs 10.8 mm into the crane arm.",
    next: "2 gate tasks (crane arm overlap, swing size) plus the judge's instructions.",
    cost: "213 s, $0.27",
  },
  {
    key: "r02",
    label: "round 2",
    kind: "refine: the last round the budget allows",
    mean: 0.867,
    penalty: 0.15,
    cap: 0.6,
    capWhy: "floating_part ≤ 0.60",
    findings: [
      {
        gate: "connectivity",
        part: "TrapezeSwing",
        text: "part 'TrapezeSwing' is floating: nearest supported part is 'CageDomeCrown' at 16.2 mm",
        cap: "≤ 0.60",
      },
    ],
    diffs: [
      {
        file: "src/parts/stand_crane_arm.js",
        lines: [
          "-  socketMesh.position.set(0, 1.365, -0.200);",
          "+  socketMesh.position.set(0, 1.372, -0.200);",
        ],
      },
      {
        file: "src/parts/trapeze_swing.js",
        lines: [
          "-  const startY = 1.266;",
          "-  topAnchorRing.translate(0, 1.392, 0);",
          "+  // Top suspension ring: centered at (0, 1.275, 0), rotated Y by PI/2",
          "+  topRing.translate(0, 1.275, 0);",
        ],
      },
    ],
    diffNote:
      "The crane-arm socket moves up 7 mm and that overlap clears. To bring the swing back to its planned height, the fix agent drops the chain to three links ending at 1.275 m. That is 16.2 mm short of the crown, so round 0's defect is back, smaller.",
    next: "None: the run has spent its 2 refinement rounds.",
    cost: "406 s, $0.21",
  },
]

const ACCENT = "oklch(0.58 0.13 250)"
const THRESHOLD = 0.72

function pct(x: number) {
  return `${(x * 100).toFixed(1)}%`
}

function ScoreBar({ r }: { r: Round }) {
  const uncapped = r.mean - r.penalty
  const final = Math.min(uncapped, r.cap)
  return (
    <div className="space-y-1.5 font-mono text-[11px]">
      <div className="relative h-5 rounded bg-muted/60">
        <div
          className="absolute inset-y-0 left-0 rounded bg-foreground/15"
          style={{ width: pct(r.mean) }}
          title="weighted criterion mean"
        />
        <div
          className="absolute inset-y-0 left-0 rounded bg-foreground/30"
          style={{ width: pct(uncapped) }}
          title="after defect penalties"
        />
        <div
          className="absolute inset-y-0 left-0 rounded"
          style={{ width: pct(final), background: ACCENT }}
          title="after the measured cap"
        />
        <div
          className="absolute inset-y-[-3px] w-px bg-foreground"
          style={{ left: pct(THRESHOLD) }}
          title="pass threshold"
        />
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
        <span>criteria mean {r.mean.toFixed(3)}</span>
        <span>
          − defects {r.penalty.toFixed(2)} = {uncapped.toFixed(3)}
        </span>
        <span>
          cap {r.capWhy} →{" "}
          <b className="text-foreground">{final.toFixed(2)}</b>
        </span>
        <span>pass needs {THRESHOLD.toFixed(2)}</span>
      </div>
    </div>
  )
}

export function RefineLoop() {
  const [i, setI] = useState(0)
  const done = i === ROUNDS.length
  const r = ROUNDS[Math.min(i, ROUNDS.length - 1)]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>&ldquo;an ornate victorian birdcage on a stand with a swing and two seed cups&rdquo;</span>
        <span className="text-muted-foreground/70">three.js · run cage_tj_ss2 · measured from the logs</span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Refinement round">
          {[...ROUNDS.map((x) => x.label), "select"].map((label, k) => {
            const on = k === i
            return (
              <button
                key={label}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setI(k)}
                className={
                  "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors " +
                  (on ? "text-background" : "bg-background/50 text-muted-foreground hover:text-foreground")
                }
                style={on ? { background: ACCENT, borderColor: ACCENT } : undefined}
              >
                {label}
              </button>
            )
          })}
        </div>

        {!done ? (
          <div className="mt-4 space-y-4">
            <p className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
              {r.kind} · {r.cost}
            </p>

            <div>
              <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">
                code going into this round
              </p>
              {r.diffs.map((d) => (
                <div key={d.file} className="mb-2 overflow-x-auto rounded-md border bg-background/60">
                  <div className="border-b px-2.5 py-1 font-mono text-[10.5px] text-muted-foreground">
                    {d.file}
                  </div>
                  <pre className="px-2.5 py-1.5 font-mono text-[11px] leading-5">
                    {d.lines.map((ln, k) => (
                      <div
                        key={k}
                        className={
                          ln.startsWith("+")
                            ? "text-emerald-700 dark:text-emerald-400"
                            : ln.startsWith("-")
                              ? "text-rose-700 dark:text-rose-400"
                              : "text-foreground/80"
                        }
                      >
                        {ln}
                      </div>
                    ))}
                  </pre>
                </div>
              ))}
              <p className="text-sm leading-relaxed text-muted-foreground">{r.diffNote}</p>
            </div>

            <div>
              <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">
                execute → measure: gate errors
              </p>
              <ul className="space-y-1.5">
                {r.findings.map((f) => (
                  <li key={f.gate + f.part} className="rounded-md border bg-background/60 px-2.5 py-1.5 text-[12.5px] leading-snug">
                    <span className="font-mono text-[10.5px] text-muted-foreground">
                      {f.gate} · {f.part} · cap {f.cap}
                    </span>
                    <br />
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="mb-1.5 font-mono text-[11px] text-muted-foreground">
                judge → score, computed in code
              </p>
              <ScoreBar r={r} />
            </div>

            <p className="text-sm leading-relaxed">
              <span className="font-mono text-[11px] text-muted-foreground">refine → </span>
              {r.next}
            </p>
          </div>
        ) : (
          <div className="mt-4 space-y-3 text-sm leading-relaxed">
            <div className="grid grid-cols-3 gap-2 font-mono text-xs">
              {ROUNDS.map((x) => {
                const s = Math.min(x.mean - x.penalty, x.cap)
                const best = x.key === "r01"
                return (
                  <div
                    key={x.key}
                    className={"rounded-md border px-2.5 py-2 " + (best ? "text-background" : "bg-background/60")}
                    style={best ? { background: ACCENT, borderColor: ACCENT } : undefined}
                  >
                    <div>{x.label}</div>
                    <div className="text-base">{s.toFixed(2)}</div>
                  </div>
                )
              })}
            </div>
            <p>
              No round reached the {THRESHOLD.toFixed(2)} pass line. The selector ranks judged
              rounds by score and commits <code>restore best round r01</code>, so the deliverable is
              round 1, with its crane-arm overlap still in it.
            </p>
            <p className="text-muted-foreground">
              Every score here equals its cap. The judge&apos;s own criteria, weighted, put round 2
              (0.867) above round 0 (0.806), but the measured floating swing pins both at 0.60.
            </p>
          </div>
        )}
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-5 text-muted-foreground">
        Weights {WEIGHTS.map(([k, w]) => `${k} ${w}`).join(", ")}. Criterion scores, penalties, caps,
        gate text and code lines are from the run&apos;s round records and git history; the means are my
        arithmetic. A dev ablation from August 2026 with Gemini 3.6 Flash generating single-shot and
        Gemini 3.1 Pro judging, not one of the paper&apos;s evaluation runs.
      </figcaption>
    </figure>
  )
}
