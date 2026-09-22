// Sixteen tasks, three engines, one chart — because "up to 4.5×" is one row of
// it and 1.02× is another, and the shape between them is the whole finding.
//
// Every number is Table 1 on husky.underdog.ai, transcribed unaltered: medians
// of three runs per engine on one M5 Max, Woof 4B at 4 bits, greedy decoding,
// same weight file on both sides. Rows are sorted by the Flash-on ratio, which
// is the order the table already uses.
//
// The two series say different things and the chart keeps them apart:
//   Husky (no Flash)  — the engine on its own, plus prompt-lookup speculation
//   Flash on          — the same engine with a trained draft in the slot
// On the seven prose tasks at the bottom, the engine alone is a tie with MLX.
// Every large ratio on this chart is speculative decoding of one kind or other.
//
// Zero JS, server-rendered. Linear axis, all exact arithmetic.

type Row = {
  task: string
  ctx: number
  mlx: number
  husky: number
  flash: number
}

const ROWS: Row[] = [
  { task: "Function edit", ctx: 368, mlx: 163, husky: 614, flash: 730 },
  { task: "Add a field to a JSON file", ctx: 477, mlx: 157, husky: 611, flash: 672 },
  { task: "Rename a SQL column", ctx: 240, mlx: 158, husky: 487, flash: 547 },
  { task: "Write a function", ctx: 40, mlx: 155, husky: 170, flash: 545 },
  { task: "Fix typos in a paragraph", ctx: 301, mlx: 159, husky: 463, flash: 535 },
  { task: "Invoice to JSON", ctx: 321, mlx: 164, husky: 208, flash: 496 },
  { task: "CSV to a table", ctx: 303, mlx: 158, husky: 287, flash: 462 },
  { task: "Data to a table", ctx: 247, mlx: 163, husky: 188, flash: 282 },
  { task: "Repeated transcript", ctx: 857, mlx: 153, husky: 164, flash: 273 },
  { task: "Tone rewrite", ctx: 195, mlx: 162, husky: 168, flash: 269 },
  { task: "Short email", ctx: 38, mlx: 151, husky: 164, flash: 260 },
  { task: "Project plan", ctx: 51, mlx: 158, husky: 171, flash: 246 },
  { task: "Meeting notes to to-dos", ctx: 249, mlx: 163, husky: 175, flash: 234 },
  { task: "Reply to an email thread", ctx: 280, mlx: 163, husky: 170, flash: 217 },
  { task: "Call summary", ctx: 657, mlx: 162, husky: 166, flash: 211 },
  { task: "Question over a document", ctx: 297, mlx: 159, husky: 193, flash: 210 },
]

const X_MAX = 780

export function TaskLadder() {
  const W = 840
  const L = 178
  const R = 742
  const top = 66
  const rowH = 27
  const H = top + ROWS.length * rowH + 52
  const x = (v: number) => L + (v / X_MAX) * (R - L)

  const ticks = [0, 200, 400, 600, 730]

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        decode tokens/s while writing the reply · M5 Max, Woof 4B at 4 bits, same weight file both engines
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="Sixteen tasks, each with three horizontal bars for decode throughput in tokens per second. MLX sits between 151 and 164 on every single task. Husky without its draft model ranges from 164 to 614: it is three to four times MLX on the four editing tasks at the top, where the reply repeats the prompt, and within a few percent of MLX on the seven prose tasks at the bottom. Husky with Flash on ranges from 210 to 730, beating MLX everywhere, with the largest gaps on the edits and on code written from scratch. The topmost bar, the function edit at 730 tokens per second, is the source of the headline four-and-a-half-times figure."
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={top - 10} x2={x(t)} y2={top + ROWS.length * rowH - 4} className="stroke-border" strokeWidth={1} strokeOpacity={0.5} />
            <text x={x(t)} y={top - 16} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {t}
            </text>
          </g>
        ))}

        <g className="font-mono" style={{ fontSize: 9.5 }}>
          <rect x={L} y={20} width={9} height={9} className="fill-muted-foreground/45" />
          <text x={L + 14} y={28} className="fill-muted-foreground">
            MLX 0.32.2 / mlx-lm 0.31.3
          </text>
          <rect x={L + 152} y={20} width={9} height={9} className="fill-foreground/80" />
          <text x={L + 166} y={28} className="fill-muted-foreground">
            Husky — prompt lookup only
          </text>
          <rect x={L + 330} y={20} width={9} height={9} className="fill-destructive" />
          <text x={L + 344} y={28} className="fill-muted-foreground">
            Husky, Flash on — trained draft
          </text>
        </g>

        {ROWS.map((r, i) => {
          const y = top + i * rowH
          const h = 6
          return (
            <g key={r.task}>
              <text x={L - 10} y={y + 8} textAnchor="end" className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {r.task}
              </text>
              <text x={L - 10} y={y + 18} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
                {r.ctx} tokens in
              </text>

              <rect x={x(0)} y={y} width={Math.max(1, x(r.mlx) - x(0))} height={h} className="fill-muted-foreground/45" />
              <rect x={x(0)} y={y + h} width={Math.max(1, x(r.husky) - x(0))} height={h} className="fill-foreground/80" />
              <rect x={x(0)} y={y + 2 * h} width={Math.max(1, x(r.flash) - x(0))} height={h} className="fill-destructive" />

              <text x={x(r.flash) + 6} y={y + 12} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                {(r.flash / r.mlx).toFixed(2)}×
              </text>
              <text x={x(r.flash) + 6} y={y + 22} className="fill-muted-foreground font-mono" style={{ fontSize: 8 }}>
                {r.mlx} / {r.husky} / {r.flash}
              </text>
            </g>
          )
        })}

        <text x={L - 10} y={H - 26} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          medians
        </text>
        <text x={L} y={H - 26} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          MLX 159 tok/s across all sixteen · Husky alone 1.125× median · Flash on 1.757× median · 4.48× on one row
        </text>
        <text x={L} y={H - 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          the baseline is mlx-lm&apos;s plain generate path — its own `--draft-model` speculative decoding was not enabled
        </text>
      </svg>
    </figure>
  )
}
