// The three post-training branches exactly as TypeSafe frames them on
// docs.typesafe.ai/introduction/machine-learning-primer ("Three post-training
// approaches"), with one column added that the docs page does not have: what is
// actually published about each branch's objective.
//
// Every string in OBJECTIVE / OUTPUT is quoted or paraphrased from a primary
// source named in EVIDENCE. The RLCD row's "not published" is the finding, not a
// rhetorical flourish: a full-text search of the 835 KB docs dump, the launch
// post, evals.typesafe.ai and the manifesto returns zero loss functions, zero
// reward definitions and zero calibration measurements.
//
// Server-rendered, zero JS — this is reference material, not something to drag.

const ACCENT = "oklch(0.72 0.15 195)"
const WARN = "oklch(0.68 0.16 40)"
const MUTED = "oklch(0.62 0.02 260)"

const W = 800
const H = 322

type Branch = {
  id: string
  name: string
  expand: string
  optimizes: string
  output: string
  evidence: string
  known: boolean
  color: string
  y: number
}

const BRANCHES: Branch[] = [
  {
    id: "rlhf",
    name: "RLHF",
    expand: "from human feedback",
    optimizes: "the text a human rater prefers",
    output: "strings",
    evidence: "objective published — Ouyang et al. 2022, arXiv 2203.02155",
    known: true,
    color: MUTED,
    y: 58,
  },
  {
    id: "rlvr",
    name: "RLVR",
    expand: "with verifiable rewards",
    optimizes: "outputs a program can check",
    output: "strings, checked",
    evidence: "objective published — the reward is the checker",
    known: true,
    color: MUTED,
    y: 150,
  },
  {
    id: "rlcd",
    name: "RLCD",
    expand: "for calibrated decisions",
    optimizes: "not published",
    output: "decision + probability",
    evidence: "no loss, no reward, no data, no measurement",
    known: false,
    color: ACCENT,
    y: 242,
  },
]

export function PostTrainingBranches() {
  const bx = 226
  const bw = 150
  const bh = 52
  const srcX = 150
  const srcY = 150

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        three post-training branches — and what each one publishes about its
        objective
      </div>

      <div className="overflow-x-auto px-3 py-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[620px]"
          role="img"
          aria-label="A pretrained language model branches three ways. RLHF optimizes for the text a human rater prefers and emits strings; its objective is published in Ouyang et al. 2022. RLVR optimizes for outputs a program can check and emits checked strings; its objective is published. RLCD, TypeSafe's branch, emits a decision plus a probability, and its objective is not published: no loss function, no reward, no dataset and no calibration measurement appear anywhere in TypeSafe's public material."
        >
          <defs>
            <filter id="ptb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="ptb-arrow"
              viewBox="0 -5 10 10"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              refX="7"
              refY="0"
            >
              <path
                d="M0,-4L6,0L0,4"
                fill="none"
                stroke={MUTED}
                strokeWidth={1.5}
              />
            </marker>
            <marker
              id="ptb-arrow-a"
              viewBox="0 -5 10 10"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              refX="7"
              refY="0"
            >
              <path
                d="M0,-4L6,0L0,4"
                fill="none"
                stroke={ACCENT}
                strokeWidth={1.5}
              />
            </marker>
          </defs>

          {/* source node */}
          <rect
            x={22}
            y={srcY - 34}
            width={112}
            height={68}
            rx={10}
            fill="var(--background)"
            stroke="var(--border)"
            strokeWidth={1.5}
            filter="url(#ptb-soft)"
          />
          <text
            x={78}
            y={srcY - 10}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={12}
            fontWeight={600}
          >
            pretrained
          </text>
          <text
            x={78}
            y={srcY + 6}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={12}
            fontWeight={600}
          >
            LM
          </text>
          <text
            x={78}
            y={srcY + 23}
            textAnchor="middle"
            fill={MUTED}
            className="font-mono"
            fontSize={9}
          >
            ECE 0.007
          </text>

          {BRANCHES.map((b) => {
            const y = b.y
            const my = (srcY + y) / 2
            const d = `M ${srcX} ${srcY} C ${(srcX + bx) / 2} ${srcY}, ${(srcX + bx) / 2} ${my}, ${bx - 8} ${y}`
            return (
              <g key={b.id}>
                <path
                  d={d}
                  fill="none"
                  stroke={b.known ? MUTED : ACCENT}
                  strokeWidth={1.5}
                  strokeOpacity={b.known ? 0.5 : 1}
                  markerEnd={b.known ? "url(#ptb-arrow)" : "url(#ptb-arrow-a)"}
                />

                <rect
                  x={bx}
                  y={y - bh / 2}
                  width={bw}
                  height={bh}
                  rx={9}
                  fill="var(--background)"
                  stroke={b.known ? "var(--border)" : ACCENT}
                  strokeWidth={1.5}
                  filter="url(#ptb-soft)"
                />
                <text
                  x={bx + 14}
                  y={y - 6}
                  className="font-mono"
                  fill={b.known ? "var(--foreground)" : ACCENT}
                  fontSize={13}
                  fontWeight={600}
                >
                  {b.name}
                </text>
                <text
                  x={bx + 14}
                  y={y + 11}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={9}
                >
                  {b.expand}
                </text>

                {/* optimizes column */}
                <text
                  x={bx + bw + 26}
                  y={y - 8}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={8.5}
                >
                  optimizes for
                </text>
                <text
                  x={bx + bw + 26}
                  y={y + 7}
                  className="fill-foreground"
                  fontSize={11.5}
                  fontWeight={b.known ? 400 : 600}
                  {...(b.known ? {} : { fill: WARN })}
                >
                  {b.optimizes}
                </text>
                <text
                  x={bx + bw + 26}
                  y={y + 22}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={8.5}
                >
                  {b.evidence}
                </text>

                {/* output pill */}
                <rect
                  x={W - 152}
                  y={y - 13}
                  width={138}
                  height={26}
                  rx={13}
                  fill={b.known ? "var(--muted)" : "transparent"}
                  stroke={b.known ? "transparent" : ACCENT}
                  strokeWidth={1.2}
                />
                <text
                  x={W - 83}
                  y={y + 4}
                  textAnchor="middle"
                  className="font-mono"
                  fill={b.known ? MUTED : ACCENT}
                  fontSize={9.5}
                >
                  {b.output}
                </text>
              </g>
            )
          })}

          {/* measured consequence on the RLHF branch */}
          <text
            x={bx + bw + 26}
            y={BRANCHES[0].y + 36}
            className="font-mono"
            fill={WARN}
            fontSize={8.5}
          >
            measured cost: ECE 0.007 → 0.074 after PPO (GPT-4 report, Fig. 8)
          </text>
        </svg>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        The three-way split, the names and the acronym expansions are TypeSafe&apos;s
        own, from the{" "}
        <a
          href="https://docs.typesafe.ai/introduction/machine-learning-primer"
          className="underline decoration-foreground/30 underline-offset-2"
        >
          AI primer
        </a>
        . The middle column is mine: RLHF and RLVR name an objective you can write
        down, and RLCD, as published, names only the shape of the answer it wants.
        The two ECE numbers are measured, from the GPT-4 Technical Report&apos;s own
        Figure 8 (arXiv 2303.08774), on a subset of MMLU.
      </figcaption>
    </figure>
  )
}
