// Why TabFM can read a schema it has never seen — and what that costs.
//
// Nothing in the 1.64B parameters is indexed by column identity. There is no
// column-name embedding, no vocabulary, no per-schema head. A column is a
// POSITION, and that is the whole trick: any table of any width slots straight
// in. The bill arrives in two places. The cell embedder crosses each column
// with the columns 1 and 3 to its right, modulo the active feature count; and
// the row attention runs RoPE over the column axis. Both mean the model's view
// of a table depends on the order you happened to put the columns in.
//
// The default TabFMClassifier answers that with feat_shuffle_method="random"
// over n_estimators=32 members. The picture below is the reason that default
// is not optional.
//
// Server-rendered SVG, zero JS; integer arithmetic only.

const COLS = ["age", "job", "city", "tenure", "plan", "spend"]
const D = COLS.length
const OFFSETS = [0, 1, 3] // 2^i - 1 for i in 0..2, feature_group_size = 3

// A shuffled column order, as one ensemble member would see it.
const PERM = [3, 0, 5, 2, 4, 1]

function groupsFor(order: number[]): string[][] {
  return order.map((_, h) => OFFSETS.map((o) => COLS[order[(h + o) % D]]))
}

const IDENT = [0, 1, 2, 3, 4, 5]

export function ColumnOrder() {
  const W = 860
  const cw = 108
  const x0 = 24
  const gA = groupsFor(IDENT)
  const gB = groupsFor(PERM)

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cell_embedder._group · offsets {"{"}0, 1, 3{"}"} taken mod d · feature_group_size = 3
      </div>
      <svg
        viewBox={`0 0 ${W} 392`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A six-column table, age job city tenure plan spend, is shown twice. In the first ordering, the cell embedder crosses each column with the columns one and three positions to its right, wrapping around: age crosses with job and tenure, job with city and plan, and so on. In the second ordering, which is what one of the thirty-two ensemble members sees after a random column shuffle, the same six columns produce six completely different three-way crosses: tenure with age and city, age with spend and plan, and so on. Below, thirty-two stacked bars stand for the thirty-two ensemble members, each with its own random column permutation, whose logits are averaged."
      >
        {/* ---- header ---- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={x0} y={20}>THE TABLE AS THE USER WROTE IT</text>
        </g>

        {COLS.map((c, i) => (
          <g key={c}>
            <rect
              x={x0 + i * cw}
              y={30}
              width={cw - 8}
              height={26}
              rx={4}
              className="fill-background stroke-border"
              strokeWidth={1.5}
            />
            <text x={x0 + i * cw + 10} y={47} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              {c}
            </text>
            <text
              x={x0 + i * cw + cw - 22}
              y={47}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              h={i}
            </text>
          </g>
        ))}

        {/* arcs for column 0 and column 4 (the wrap) */}
        {[
          { from: 0, to: 1, up: 18 },
          { from: 0, to: 3, up: 34 },
        ].map((a, i) => {
          const xa = x0 + a.from * cw + (cw - 8) / 2
          const xb = x0 + a.to * cw + (cw - 8) / 2
          return (
            <path
              key={`a${i}`}
              d={`M ${xa} 30 C ${xa} ${30 - a.up}, ${xb} ${30 - a.up}, ${xb} 30`}
              fill="none"
              className="stroke-foreground/50"
              strokeWidth={1.5}
            />
          )
        })}
        {[
          { from: 4, to: 5, down: 16 },
          { from: 4, to: 1, down: 30 },
        ].map((a, i) => {
          const xa = x0 + a.from * cw + (cw - 8) / 2
          const xb = x0 + a.to * cw + (cw - 8) / 2
          return (
            <path
              key={`b${i}`}
              d={`M ${xa} 56 C ${xa} ${56 + a.down}, ${xb} ${56 + a.down}, ${xb} 56`}
              fill="none"
              className="stroke-border"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )
        })}
        <text x={x0 + 4 * cw + 6} y={104} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          plan wraps past the end: (4+3) mod 6 = 1
        </text>

        {/* group list A */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={x0} y={128}>the six 3-way crosses this ordering builds</text>
        </g>
        {gA.map((g, i) => (
          <text
            key={i}
            x={x0 + (i % 3) * 270}
            y={146 + Math.floor(i / 3) * 16}
            className="fill-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {`{${g.join(", ")}}`}
          </text>
        ))}

        <line x1={x0} y1={180} x2={W - 24} y2={180} className="stroke-border" strokeWidth={1} />

        {/* ---- permuted ---- */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={x0} y={202}>THE SAME TABLE, AS ENSEMBLE MEMBER #7 SEES IT</text>
        </g>

        {PERM.map((p, i) => (
          <g key={i}>
            <rect
              x={x0 + i * cw}
              y={212}
              width={cw - 8}
              height={26}
              rx={4}
              className="fill-muted/50 stroke-border"
              strokeWidth={1.5}
            />
            <text x={x0 + i * cw + 10} y={229} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              {COLS[p]}
            </text>
            <text
              x={x0 + i * cw + cw - 22}
              y={229}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              h={i}
            </text>
          </g>
        ))}

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={x0} y={262}>and the six crosses it builds instead — not one of them survives</text>
        </g>
        {gB.map((g, i) => (
          <text
            key={i}
            x={x0 + (i % 3) * 270}
            y={280 + Math.floor(i / 3) * 16}
            className="fill-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {`{${g.join(", ")}}`}
          </text>
        ))}

        <line x1={x0} y1={314} x2={W - 24} y2={314} className="stroke-border" strokeWidth={1} />

        {/* ---- the ensemble ---- */}
        {Array.from({ length: 32 }, (_, i) => i).map((i) => (
          <rect
            key={i}
            x={x0 + i * 10}
            y={334}
            width={7}
            height={22}
            rx={1.5}
            className="fill-muted/60 stroke-border"
            strokeWidth={0.8}
          />
        ))}
        <line x1={x0 + 322} y1={345} x2={x0 + 356} y2={345} className="stroke-border" strokeWidth={1.5} />
        <rect x={x0 + 356} y={332} width={112} height={26} rx={4} className="fill-background stroke-foreground/40" strokeWidth={1.5} />
        <text x={x0 + 366} y={349} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          average the logits
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={x0 + 486} y={332}>n_estimators = 32 is the DEFAULT, not the ensemble preset.</text>
          <text x={x0 + 486} y={348}>Each member gets its own column permutation, its own class-label</text>
          <text x={x0 + 486} y={364}>rotation, and one of two normalisers. The “single forward pass”</text>
          <text x={x0 + 486} y={380}>in the announcement is thirty-two of them.</text>
        </g>
      </svg>
    </figure>
  )
}
