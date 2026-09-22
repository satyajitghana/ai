// The procedure itself. Four gates, in the order they have to be asked, each
// with the measured consequence of failing it attached on the right.
//
// The ordering is the claim. Gate 3 is the one that decides whether a decision
// model is possible at all; gates 1 and 2 decide whether you can reach it; gate
// 4 decides whether you may act on the number it returns. Cost and latency are
// not gates — they are the answer to a different question, and they are the
// reason people get gate 3 wrong.
//
// Gate 3's failure path loops back, because a relational dependency is not a
// verdict: it is work. Build the relation in deterministic code, hand the model
// one pair, and re-enter.
//
// Server-rendered SVG, zero JS. Every coordinate is integer arithmetic, so
// nothing here can serialize differently on Node and in the browser.

const PASS = "oklch(0.60 0.15 255)"
const STOP = "oklch(0.58 0.20 25)"

type Gate = {
  tag: string
  q: [string, string]
  verdict: string[]
  loop?: boolean
}

const GATES: Gate[] = [
  {
    tag: "gate 1 — the answer set",
    q: ["Is the set of acceptable answers finite", "and known before you make the call?"],
    verdict: [
      "No — then something has to write a string.",
      "379 of 385 WindTunnel tool calls carried a",
      "string property with no enum and no const:",
      "a field with no list to pick from.",
    ],
  },
  {
    tag: "gate 2 — the enumerator",
    q: ["Can code you own produce that set,", "without a model inventing it first?"],
    verdict: [
      "No — then you have not removed the",
      "generative model, you have given it a",
      "proofreader. That is often exactly what",
      "you want. Price it as two models, not one.",
    ],
  },
  {
    tag: "gate 3 — independence",
    q: ["Can every option be judged on its own,", "without reading another option?"],
    loop: true,
    verdict: [
      "No — 0 of 100, below chance. Sharing a",
      "context is not the fix: 8 of 100. Build the",
      "relation in code — intersect the identifiers,",
      "hand over one pair — then re-enter here.",
    ],
  },
  {
    tag: "gate 4 — the threshold",
    q: ["Is the option list frozen, and the cutoff", "measured on your own labelled outcomes?"],
    verdict: [
      "No — then read the argmax and ignore the",
      "number. One synonym added to a dropdown",
      "moved a winner from 0.619 to 0.215; a tuned",
      "cutoff moved 0.67 to 0.37 across two datasets.",
    ],
  },
]

export function DecisionGate() {
  const W = 880
  const LX = 28
  const LW = 352
  const RX = 456
  const RW = 396
  const GAP = 124
  const TOP = 66
  const GH = 78
  const VH = 88
  const cx = LX + LW / 2 // 204
  const H = TOP + GATES.length * GAP + 118

  const termTop = TOP + GATES.length * GAP // 562

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        four gates, in order — the right-hand column is what failing each one has cost somebody
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A four-gate decision procedure drawn as a flowchart. Gate one asks whether the set of acceptable answers is finite and known before the call; failing it means something has to write a string, and 379 of 385 WindTunnel tool calls carried a string property with no enum. Gate two asks whether code you own can produce that set without a model inventing it first; failing it means you have given a generative model a proofreader rather than replacing it. Gate three asks whether every option can be judged on its own without reading another option; failing it scores 0 of 100, below chance, and the fix is to build the relation in deterministic code and re-enter the gate, which is drawn as an arrow looping back. Gate four asks whether the option list is frozen and the cutoff measured on your own labelled outcomes; failing it means reading the argmax and ignoring the probability, because adding one synonym to a dropdown moved a winner from 0.619 to 0.215. Passing all four leads to a terminal box reading: code enumerates, the model picks, code composes."
      >
        <defs>
          <marker id="wg-pass" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={PASS} />
          </marker>
          <marker id="wg-stop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={STOP} />
          </marker>
          <marker id="wg-loop" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--muted-foreground)" />
          </marker>
        </defs>

        {/* loop-back, drawn first so the solid arrows sit on top of it */}
        {GATES.map((g, i) => {
          if (!g.loop) return null
          const t = TOP + i * GAP
          const vBottom = t - 5 + VH
          const railY = vBottom + 18
          const d = `M ${RX + RW / 2} ${vBottom} L ${RX + RW / 2} ${railY} L 14 ${railY} L 14 ${t + GH / 2} L ${LX - 4} ${t + GH / 2}`
          return (
            <g key="loop">
              <path
                d={d}
                fill="none"
                className="stroke-muted-foreground"
                strokeWidth={1.4}
                strokeDasharray="4 4"
                markerEnd="url(#wg-loop)"
              />
              <text
                x={200}
                y={railY - 6}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                supply the relation in code, then re-enter
              </text>
            </g>
          )
        })}

        {GATES.map((g, i) => {
          const t = TOP + i * GAP
          const vt = t - 5
          return (
            <g key={g.tag}>
              {/* the gate */}
              <rect
                x={LX}
                y={t}
                width={LW}
                height={GH}
                rx={7}
                className="fill-background"
                stroke={PASS}
                strokeWidth={1.8}
              />
              <text x={LX + 14} y={t + 19} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {g.tag}
              </text>
              <text x={LX + 14} y={t + 41} className="fill-foreground" style={{ fontSize: 12.5 }}>
                {g.q[0]}
              </text>
              <text x={LX + 14} y={t + 59} className="fill-foreground" style={{ fontSize: 12.5 }}>
                {g.q[1]}
              </text>

              {/* fail path */}
              <line
                x1={LX + LW}
                y1={t + GH / 2}
                x2={RX - 6}
                y2={t + GH / 2}
                stroke={STOP}
                strokeWidth={1.6}
                markerEnd="url(#wg-stop)"
              />
              <text
                x={LX + LW + 26}
                y={t + GH / 2 - 7}
                className="font-mono"
                fill={STOP}
                style={{ fontSize: 9.5 }}
              >
                no
              </text>

              <rect
                x={RX}
                y={vt}
                width={RW}
                height={VH}
                rx={7}
                className="fill-background"
                stroke={STOP}
                strokeWidth={1.2}
                strokeDasharray="5 3"
              />
              {g.verdict.map((line, li) => (
                <text
                  key={li}
                  x={RX + 14}
                  y={vt + 24 + li * 16}
                  className="fill-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {line}
                </text>
              ))}

              {/* pass path */}
              <line
                x1={cx}
                y1={t + GH}
                x2={cx}
                y2={t + GAP - 6}
                stroke={PASS}
                strokeWidth={1.8}
                markerEnd="url(#wg-pass)"
              />
              <text x={cx + 10} y={t + GH + 26} className="font-mono" fill={PASS} style={{ fontSize: 9.5 }}>
                yes
              </text>
            </g>
          )
        })}

        {/* terminal */}
        <rect
          x={LX}
          y={termTop}
          width={LW + 140}
          height={62}
          rx={7}
          fill={PASS}
          fillOpacity={0.1}
          stroke={PASS}
          strokeWidth={2}
        />
        <text x={LX + 16} y={termTop + 25} className="fill-foreground" style={{ fontSize: 13 }}>
          Put the model here.
        </text>
        <text x={LX + 16} y={termTop + 46} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          code enumerates · the model picks · code composes
        </text>

        <text x={LX} y={H - 32} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          Cost and latency are not gates. Nothing on this page was decided by them, and the two headline
        </text>
        <text x={LX} y={H - 19} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          multipliers measure 4.57x and 336x per call when somebody runs both arms on one task.
        </text>
      </svg>
    </figure>
  )
}
