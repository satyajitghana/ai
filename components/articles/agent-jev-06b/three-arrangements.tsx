// Three ways to arrange an option set, and what each one buys.
//
// The two this site has documented are a fork: isolate the options and you get
// exact order-invariance but no option can refer to another; put them in one
// sequence and a relational question becomes expressible but position acquires
// a prior worth +1.71 logits. AgentJev is arranged a third way — one cached
// prefix, one private branch per candidate, and the candidates meeting only
// afterwards inside a transformer that has no positional embeddings — and that
// arrangement is order-invariant AND lets a candidate's score depend on what
// else is in the set.
//
// Server-rendered SVG, zero JS. Every coordinate is +, -, * or / on integers.

type Row = {
  name: string
  who: string
  layout: "isolated" | "shared" | "branched"
  meet: string
  order: { ok: boolean; note: string }
  cross: { ok: boolean; note: string }
}

const ROWS: Row[] = [
  {
    name: "Isolated paths",
    who: "cua-s1-forms · open-jev-deberta · Jev, by argument",
    layout: "isolated",
    meet: "at the softmax, as scalars",
    order: { ok: true, note: "exact in the shape; the hosted model still flips 12 of 100" },
    cross: { ok: false, note: "none — 0 of 100 on relational choice" },
  },
  {
    name: "One shared sequence",
    who: "openjev · Laya",
    layout: "shared",
    meet: "in the backbone's attention, at a position",
    order: { ok: false, note: "+1.71 logits for slot A; 27.8% flip" },
    cross: { ok: true, note: "full, at token level" },
  },
  {
    name: "Shared prefix, private branches, set head",
    who: "AgentJev-0.6B",
    layout: "branched",
    meet: "after the backbone, in a head with no positions",
    order: { ok: true, note: "measured below" },
    cross: { ok: true, note: "through one 256-d summary per candidate" },
  },
]

const W = 300 // width of the glyph column
const H = 86

/** The token layout each arrangement feeds to the backbone. */
function Glyph({ kind }: { kind: Row["layout"] }) {
  const pre = 96 // prefix block width
  const cand = 40 // candidate block width
  const rowH = 14
  const gap = 5

  if (kind === "isolated") {
    return (
      <g>
        {[0, 1, 2].map((i) => {
          const y = 12 + i * (rowH + gap)
          return (
            <g key={i}>
              <rect x={8} y={y} width={pre} height={rowH} rx={2} className="fill-foreground/10 stroke-border" />
              <rect x={8 + pre + 2} y={y} width={cand} height={rowH} rx={2} className="fill-foreground/45" />
            </g>
          )
        })}
        <text x={8} y={78} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          prefix recomputed per candidate
        </text>
      </g>
    )
  }

  if (kind === "shared") {
    const seg = 44
    return (
      <g>
        <rect x={8} y={26} width={pre} height={rowH} rx={2} className="fill-foreground/10 stroke-border" />
        {[0, 1, 2].map((i) => (
          <rect
            key={i}
            x={8 + pre + 2 + i * (seg + 2)}
            y={26}
            width={seg}
            height={rowH}
            rx={2}
            className="fill-foreground/45"
          />
        ))}
        {[0, 1].map((i) => (
          <path
            key={i}
            d={`M ${8 + pre + 2 + i * (seg + 2) + seg / 2} 24 Q ${8 + pre + 2 + (i + 1) * (seg + 2)} 8 ${
              8 + pre + 2 + (i + 1) * (seg + 2) + seg / 2
            } 24`}
            className="fill-none stroke-foreground/55"
            strokeWidth={1}
          />
        ))}
        <text x={8} y={62} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          one sequence · every candidate has an index
        </text>
      </g>
    )
  }

  return (
    <g>
      <rect x={8} y={26} width={pre} height={rowH} rx={2} className="fill-foreground/10 stroke-border" />
      <text x={8 + 4} y={26 + 10.5} className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
        cached once
      </text>
      {[0, 1, 2].map((i) => {
        const y = 12 + i * (rowH + gap)
        return (
          <g key={i}>
            <line
              x1={8 + pre}
              y1={33}
              x2={8 + pre + 14}
              y2={y + rowH / 2}
              className="stroke-border"
              strokeWidth={1}
            />
            <rect x={8 + pre + 14} y={y} width={cand} height={rowH} rx={2} className="fill-foreground/45" />
            <line
              x1={8 + pre + 14 + cand}
              y1={y + rowH / 2}
              x2={8 + pre + 14 + cand + 16}
              y2={33}
              className="stroke-border"
              strokeWidth={1}
            />
          </g>
        )
      })}
      <rect
        x={8 + pre + 14 + cand + 16}
        y={22}
        width={58}
        height={22}
        rx={3}
        className="fill-foreground/15 stroke-foreground/45"
      />
      <text x={8 + pre + 14 + cand + 20} y={36} className="fill-foreground font-mono" style={{ fontSize: 8.5 }}>
        set head
      </text>
      <text x={8} y={78} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
        branches never attend each other · head has no positions
      </text>
    </g>
  )
}

function Mark({ ok }: { ok: boolean }) {
  return (
    <span
      className={
        ok
          ? "font-mono text-xs text-foreground"
          : "font-mono text-xs text-muted-foreground"
      }
    >
      {ok ? "yes" : "no"}
    </span>
  )
}

export function ThreeArrangements() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        three arrangements of one option set · what each one buys
      </div>

      <div className="divide-y">
        {ROWS.map((r) => (
          <div key={r.name} className="px-4 py-4">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-mono text-sm font-medium">{r.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{r.who}</span>
            </div>

            <svg
              viewBox={`0 0 ${W} ${H}`}
              className="mt-3 w-full max-w-[420px]"
              role="img"
              aria-label={
                r.layout === "isolated"
                  ? "Three rows, each a long light prefix block followed by a short dark candidate block: the state and question are re-encoded once per candidate and the candidates never meet."
                  : r.layout === "shared"
                    ? "One long row: a light prefix block followed by three dark candidate blocks side by side, with arcs joining each candidate to the next, because they share one sequence and attend to one another at fixed positions."
                    : "One light prefix block marked cached once, fanning out to three short dark candidate branches that do not touch, and the three branches then converging on a box marked set head."
              }
            >
              <Glyph kind={r.layout} />
            </svg>

            <dl className="mt-3 grid gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
              <div>
                <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  options meet
                </dt>
                <dd className="leading-6">{r.meet}</dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  order-invariant
                </dt>
                <dd className="leading-6">
                  <Mark ok={r.order.ok} /> — {r.order.note}
                </dd>
              </div>
              <div>
                <dt className="font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
                  candidate sees candidate
                </dt>
                <dd className="leading-6">
                  <Mark ok={r.cross.ok} /> — {r.cross.note}
                </dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The first two rows are the fork this site has been describing for four articles.
        Each pays exactly one of the two prices, and I have written more than once that you
        have to pay one. The third row does not sit on the fork and pays neither, because
        the only place its candidates meet is a two-layer transformer that was given no
        positional embeddings to meet at.
      </figcaption>
    </figure>
  )
}
