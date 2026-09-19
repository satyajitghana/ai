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
const IDENT = [0, 1, 2, 3, 4, 5]

function groupsFor(order: number[]): string[][] {
  return order.map((_, h) => OFFSETS.map((o) => COLS[order[(h + o) % D]]))
}

const GA = groupsFor(IDENT)
const GB = groupsFor(PERM)

const CW = 108
const X0 = 24
const BW = 100
const centre = (i: number) => X0 + i * CW + BW / 2

export function ColumnOrder() {
  const W = 860

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cell_embedder._group · offsets {"{"}0, 1, 3{"}"} taken mod d · feature_group_size = 3
      </div>
      <svg
        viewBox={`0 0 ${W} 436`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="A six-column table — age, job, city, tenure, plan, spend — shown twice. In the order the user wrote it, the cell embedder crosses each column with the columns one and three positions to its right, wrapping around the end: age crosses with job and tenure, and plan wraps past the end to cross with spend and job. In the second ordering, which is what one of the thirty-two ensemble members sees after a random column shuffle, the same six columns produce six completely different three-way crosses and not one of the original six survives. Below, thirty-two stacked bars stand for the thirty-two ensemble members, each with its own random column permutation, whose logits are averaged."
      >
        {/* ---- ordering A ---- */}
        <text x={X0} y={18} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          THE TABLE AS THE USER WROTE IT
        </text>

        {/* arcs above: column 0 crosses with columns 1 and 3 */}
        {[
          { to: 1, up: 16 },
          { to: 3, up: 30 },
        ].map((a) => {
          const xa = centre(0)
          const xb = centre(a.to)
          return (
            <path
              key={`up${a.to}`}
              d={`M ${xa} 62 C ${xa} ${62 - a.up}, ${xb} ${62 - a.up}, ${xb} 62`}
              fill="none"
              className="stroke-foreground/50"
              strokeWidth={1.5}
            />
          )
        })}

        {COLS.map((c, i) => (
          <g key={c}>
            <rect
              x={X0 + i * CW}
              y={62}
              width={BW}
              height={26}
              rx={4}
              className="fill-background stroke-border"
              strokeWidth={1.5}
            />
            <text x={X0 + i * CW + 10} y={79} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              {c}
            </text>
            <text
              x={X0 + i * CW + BW - 22}
              y={79}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              h={i}
            </text>
          </g>
        ))}

        {/* arcs below: column 4 wraps past the end */}
        {[
          { to: 5, dn: 16 },
          { to: 1, dn: 32 },
        ].map((a) => {
          const xa = centre(4)
          const xb = centre(a.to)
          return (
            <path
              key={`dn${a.to}`}
              d={`M ${xa} 88 C ${xa} ${88 + a.dn}, ${xb} ${88 + a.dn}, ${xb} 88`}
              fill="none"
              className="stroke-border"
              strokeWidth={1.5}
              strokeDasharray="4 3"
            />
          )
        })}
        <text x={462} y={138} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          plan wraps past the end: (4+3) mod 6 = 1
        </text>

        <text x={X0} y={162} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          the six 3-way crosses this ordering builds
        </text>
        {GA.map((g, i) => (
          <text
            key={i}
            x={X0 + (i % 3) * 270}
            y={182 + Math.floor(i / 3) * 16}
            className="fill-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {`{${g.join(", ")}}`}
          </text>
        ))}

        <line x1={X0} y1={216} x2={W - 24} y2={216} className="stroke-border" strokeWidth={1} />

        {/* ---- ordering B ---- */}
        <text x={X0} y={238} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          THE SAME TABLE, AS ENSEMBLE MEMBER #7 SEES IT
        </text>

        {PERM.map((p, i) => (
          <g key={i}>
            <rect
              x={X0 + i * CW}
              y={252}
              width={BW}
              height={26}
              rx={4}
              className="fill-muted/50 stroke-border"
              strokeWidth={1.5}
            />
            <text x={X0 + i * CW + 10} y={269} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
              {COLS[p]}
            </text>
            <text
              x={X0 + i * CW + BW - 22}
              y={269}
              className="fill-muted-foreground font-mono"
              style={{ fontSize: 9 }}
            >
              h={i}
            </text>
          </g>
        ))}

        <text x={X0} y={302} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          and the six it builds instead — not one of the originals survives
        </text>
        {GB.map((g, i) => (
          <text
            key={i}
            x={X0 + (i % 3) * 270}
            y={322 + Math.floor(i / 3) * 16}
            className="fill-foreground font-mono"
            style={{ fontSize: 10 }}
          >
            {`{${g.join(", ")}}`}
          </text>
        ))}

        <line x1={X0} y1={356} x2={W - 24} y2={356} className="stroke-border" strokeWidth={1} />

        {/* ---- the ensemble ---- */}
        {Array.from({ length: 32 }, (_, i) => i).map((i) => (
          <rect
            key={i}
            x={X0 + i * 10}
            y={374}
            width={7}
            height={22}
            rx={1.5}
            className="fill-muted/60 stroke-border"
            strokeWidth={0.8}
          />
        ))}
        <line x1={346} y1={385} x2={378} y2={385} className="stroke-border" strokeWidth={1.5} />
        <rect x={378} y={372} width={112} height={26} rx={4} className="fill-background stroke-foreground/40" strokeWidth={1.5} />
        <text x={388} y={389} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          average the logits
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={510} y={372}>n_estimators = 32 is the DEFAULT, not the preset.</text>
          <text x={510} y={388}>Each member sees its own column permutation, its</text>
          <text x={510} y={404}>own class-label rotation, and one of two normalisers.</text>
          <text x={510} y={420}>The “single forward pass” is thirty-two of them.</text>
        </g>
      </svg>
    </figure>
  )
}
