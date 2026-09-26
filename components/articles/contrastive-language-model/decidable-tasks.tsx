// What a best-of-4 verifier can and cannot change on the 38 held-out DeepSWE tasks.
//
// Measured from the public evaluation rollouts
// (tarsur385/deepswe-prm-embeddings-8k, metadata columns only: task_id, reward),
// filtered to heldout_tasks.json from Contrastive-LM/deepswe-clm-heads-8k:
// 151 Opus 5 rollouts, 37 tasks with four and one with three. 21 tasks pass on
// every rollout, 4 fail on every rollout, 13 are mixed. A selector can only
// matter on the 13. Random picking expects 7.0 of them (the sum of their pass
// fractions); the CLM head's 31/38 and Jev's 27/38 are the release's numbers,
// which after the 21 free tasks are 10 and 6 of the 13.
//
// Server-rendered SVG, no JS.

const TASKS = 38
const ALL_PASS = 21
const MIXED = 13
const ALL_FAIL = 4

const ROWS: { label: string; got: number; note: string; kind: "measured" | "reported" }[] = [
  { label: "oracle (any rollout passes)", got: 13, note: "34/38 = 89.5%", kind: "measured" },
  { label: "CLM head, fine-tuned", got: 10, note: "31/38 = 81.6%", kind: "reported" },
  { label: "random pick (pass@1)", got: 7, note: "28/38 = 73.7%", kind: "measured" },
  { label: "Jev as verifier", got: 6, note: "27/38 = 71.1%", kind: "reported" },
]

const W = 760
const CELL = 17
const GAP = 3
const X0 = 16
const LABEL_W = 210

const PASS = "oklch(0.62 0.13 150)"
const FAIL = "oklch(0.60 0.17 25)"
const MIX = "oklch(0.68 0.13 75)"

export function DecidableTasks() {
  const colour = (i: number) => (i < ALL_PASS ? PASS : i < ALL_PASS + MIXED ? MIX : FAIL)
  const rowY = (r: number) => 118 + r * 30
  const H = rowY(ROWS.length) + 8
  const mixX0 = X0 + LABEL_W

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        38 held-out DeepSWE tasks × 4 Opus 5 rollouts: where a verifier can make a difference
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="Thirty-eight squares, one per held-out DeepSWE task. Twenty-one are green: every rollout passed, so any pick scores. Thirteen are amber: some rollouts passed and some failed, so the pick matters. Four are red: no rollout passed, so no pick can score. Below, four rows count how many of the thirteen mixed tasks each selector gets: the oracle 13, the fine-tuned CLM head 10, a random pick 7.0 on average, and Jev 6."
      >
        {Array.from({ length: TASKS }, (_, i) => (
          <rect
            key={i}
            x={X0 + i * (CELL + GAP)}
            y={30}
            width={CELL}
            height={CELL}
            rx={2}
            fill={colour(i)}
            opacity={0.85}
          />
        ))}
        <g className="font-mono" fontSize={10}>
          <text x={X0} y={20} fill={PASS}>
            {ALL_PASS} always pass: every pick scores
          </text>
          <text x={X0 + ALL_PASS * (CELL + GAP)} y={66} fill={MIX}>
            {MIXED} mixed: the pick decides
          </text>
          <text x={X0 + (ALL_PASS + MIXED) * (CELL + GAP) - 40} y={20} fill={FAIL}>
            {ALL_FAIL} never pass
          </text>
        </g>

        <text x={X0} y={96} className="fill-muted-foreground font-mono" fontSize={10}>
          of the 13 mixed tasks, each selector gets
        </text>

        {ROWS.map((row, r) => (
          <g key={row.label}>
            <text x={X0} y={rowY(r) + 12} className="fill-foreground font-mono" fontSize={10}>
              {row.label}
            </text>
            {Array.from({ length: MIXED }, (_, j) => (
              <rect
                key={j}
                x={mixX0 + j * (CELL + GAP)}
                y={rowY(r)}
                width={CELL}
                height={CELL}
                rx={2}
                fill={j < row.got ? MIX : "none"}
                stroke={MIX}
                strokeWidth={1}
                opacity={j < row.got ? 0.9 : 0.5}
              />
            ))}
            <text
              x={mixX0 + MIXED * (CELL + GAP) + 10}
              y={rowY(r) + 12}
              className="fill-foreground font-mono"
              fontSize={10}
            >
              {row.label.startsWith("random") ? "7.0" : row.got} of 13 · {row.note}
            </text>
            <text
              x={W - 12}
              y={rowY(r) + 12}
              textAnchor="end"
              className="fill-muted-foreground font-mono"
              fontSize={9}
            >
              {row.kind}
            </text>
          </g>
        ))}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The task split and the random and oracle rows are measured from the released evaluation
        metadata; the CLM and Jev rows are the release&apos;s own numbers minus the 21 tasks nobody can
        get wrong. A random picker lands on 10 or more of the 13 about 6.2% of the time, and on 6 or
        fewer about 37.9% of the time (the exact distribution over these 13 tasks&apos; pass
        fractions).
      </figcaption>
    </figure>
  )
}
