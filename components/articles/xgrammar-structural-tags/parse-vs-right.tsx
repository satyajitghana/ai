// What a grammar removes, and what it leaves behind.
//
// Values are read off the two bar charts in the XGrammar-2 post (Figure 1:
// schema accuracy and output accuracy on the BFCL-V3 simple and parallel
// subsets, with and without a Structural Tag), to the nearest half point.
// Schema accuracy is the share of outputs that conform to the target JSON
// schema; output accuracy is the share scored correct. Every output is then in
// exactly one of three states, and the two charts pin all three:
//
//   correct             = output accuracy
//   parses but is wrong = schema accuracy - output accuracy
//   does not parse      = 100 - schema accuracy
//
// Two models bracket the argument: the smallest, where constrained decoding
// does the most, and the largest, where it does nothing. The middle three are
// in the published figure alongside this one.
//
// Only +, -, * and / on doubles, so lib/dmath is not needed.

type Case = {
  model: string
  note: string
  bars: { label: string; schema: number; output: number }[]
}

const CASES: Case[] = [
  {
    model: "Llama-3.2-1B",
    note: "the grammar does the most work here",
    bars: [
      { label: "without a structural tag", schema: 21, output: 5 },
      { label: "with a structural tag", schema: 100, output: 46.5 },
    ],
  },
  {
    model: "Qwen2.5-72B",
    note: "already conformed; nothing left to enforce",
    bars: [
      { label: "without a structural tag", schema: 100, output: 92.3 },
      { label: "with a structural tag", schema: 100, output: 92.2 },
    ],
  },
]

export function ParseVsRight() {
  const W = 860
  const left = 218
  const right = 720
  const x = (pct: number) => left + (pct / 100) * (right - left)

  const barH = 30
  const barGap = 40
  const caseGap = 46
  const top = 52
  const H = top + CASES.length * (2 * barGap + caseGap) + 18

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        BFCL-V3, simple and parallel subsets · every tool call is correct, or
        parses and is wrong, or does not parse
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Four stacked bars, each a hundred percent of tool calls split three ways. For Llama-3.2-1B without a structural tag: 5 percent correct, 16 percent parse but are wrong, 79 percent do not parse. With a structural tag: 46.5 percent correct, 53.5 percent parse but are wrong, none fail to parse. For Qwen2.5-72B without a tag: 92.3 percent correct, 7.7 percent parse but are wrong, none fail to parse. With a tag: 92.2, 7.8, none. The grammar moves the whole 'does not parse' segment, and roughly half of it lands in 'parses but is wrong' rather than in 'correct'."
      >
        {[0, 25, 50, 75, 100].map((p) => (
          <g key={p}>
            <line
              x1={x(p)}
              y1={top - 16}
              x2={x(p)}
              y2={H - 14}
              className="stroke-border"
              strokeWidth={1}
              strokeOpacity={0.45}
            />
            <text
              x={x(p)}
              y={top - 22}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 10 }}
            >
              {p}%
            </text>
          </g>
        ))}

        {/* legend */}
        <g>
          <rect
            x={14}
            y={top - 34}
            width={12}
            height={12}
            rx={2}
            className="fill-foreground/60 stroke-foreground"
            strokeWidth={1}
          />
          <text
            x={32}
            y={top - 24}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            correct
          </text>
          <rect
            x={98}
            y={top - 34}
            width={12}
            height={12}
            rx={2}
            className="fill-foreground/18 stroke-foreground/50"
            strokeWidth={1}
          />
          <text
            x={116}
            y={top - 24}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            parses, wrong
          </text>
          <rect
            x={14}
            y={top - 17}
            width={12}
            height={12}
            rx={2}
            className="fill-destructive/25 stroke-destructive"
            strokeWidth={1}
          />
          <text
            x={32}
            y={top - 7}
            className="fill-muted-foreground font-mono"
            style={{ fontSize: 9 }}
          >
            does not parse
          </text>
        </g>

        {CASES.map((c, ci) => {
          const y0 = top + ci * (2 * barGap + caseGap)
          return (
            <g key={c.model}>
              <text
                x={14}
                y={y0 + 14}
                className="fill-foreground font-mono"
                style={{ fontSize: 13 }}
              >
                {c.model}
              </text>
              <text
                x={14}
                y={y0 + 27}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                {c.note}
              </text>

              {c.bars.map((b, bi) => {
                const y = y0 + 36 + bi * barGap
                const correct = b.output
                const wrong = b.schema - b.output
                const nope = 100 - b.schema
                return (
                  <g key={b.label}>
                    <text
                      x={left - 10}
                      y={y + 20}
                      textAnchor="end"
                      className="fill-foreground font-mono"
                      style={{ fontSize: 10 }}
                    >
                      {b.label}
                    </text>
                    <rect
                      x={x(0)}
                      y={y}
                      width={x(correct) - x(0)}
                      height={barH}
                      className="fill-foreground/60 stroke-foreground"
                      strokeWidth={1.25}
                    />
                    <rect
                      x={x(correct)}
                      y={y}
                      width={x(correct + wrong) - x(correct)}
                      height={barH}
                      className="fill-foreground/18 stroke-foreground/50"
                      strokeWidth={1.25}
                    />
                    <rect
                      x={x(correct + wrong)}
                      y={y}
                      width={x(100) - x(correct + wrong)}
                      height={barH}
                      className="fill-destructive/25 stroke-destructive"
                      strokeWidth={1.25}
                    />
                    {correct > 8 ? (
                      <text
                        x={x(0) + 8}
                        y={y + 20}
                        className="fill-background font-mono"
                        style={{ fontSize: 10 }}
                      >
                        {correct}
                      </text>
                    ) : (
                      <text
                        x={x(correct) + 4}
                        y={y - 4}
                        className="fill-foreground font-mono"
                        style={{ fontSize: 9 }}
                      >
                        {correct}
                      </text>
                    )}
                    {wrong > 8 ? (
                      <text
                        x={x(correct) + 8}
                        y={y + 20}
                        className="fill-foreground font-mono"
                        style={{ fontSize: 10 }}
                      >
                        {wrong.toFixed(1)}
                      </text>
                    ) : null}
                    {nope > 8 ? (
                      <text
                        x={x(correct + wrong) + 8}
                        y={y + 20}
                        className="fill-foreground font-mono"
                        style={{ fontSize: 10 }}
                      >
                        {nope}
                      </text>
                    ) : null}
                  </g>
                )
              })}
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The grammar does exactly what a grammar guarantees: the red segment goes
        to zero, every time, for every model. What it does not guarantee is where
        those calls land.{" "}
        <strong className="font-medium text-foreground">
          79 points of Llama-3.2-1B&rsquo;s output stopped failing to parse, and
          about 41 of them became correct
        </strong>{" "}
        &mdash; the other 38 became tool calls that parse cleanly and are still
        wrong. At the other end, Qwen2.5-72B had no red segment to remove and
        the tag changed its score by a tenth of a point, downward. Values read
        off the published bars, so treat them as approximate.
      </figcaption>
    </figure>
  )
}
