// One ordinary tool schema, field by field, against what each mechanism can
// actually bound.
//
// A grammar bounds the *shape* of every field: a number is digits, an enum is
// one of its listed members, a string is a quoted run of characters. A menu --
// a bounded decision model choosing from the caller's option set -- can only
// supply a field whose values were enumerable before the call. Where a field is
// a free string those two coincide in the least useful way: the grammar accepts
// any quoted run, and the menu cannot produce one at all.
//
// The tally at the bottom is the measurement from this site's WindTunnel read:
// across 413 selected actions in nekuda's published traces, 385 could not be
// executed until a second, generative model wrote their arguments, and 379 of
// those carried at least one `string` property with no `enum` and no `const`.
//
// Pure layout arithmetic; lib/dmath is not needed.

type Field = {
  name: string
  schema: string
  grammarBound: string
  menuBound: boolean
  residue: boolean
}

const FIELDS: Field[] = [
  {
    name: "category",
    schema: '{"enum": ["books", "tools", "food"]}',
    grammarBound: "one of three literals",
    menuBound: true,
    residue: false,
  },
  {
    name: "sort",
    schema: '{"const": "price_asc"}',
    grammarBound: "exactly one literal",
    menuBound: true,
    residue: false,
  },
  {
    name: "max_price",
    schema: '{"type": "number"}',
    grammarBound: "digits, one point, optional sign",
    menuBound: false,
    residue: true,
  },
  {
    name: "query",
    schema: '{"type": "string"}',
    grammarBound: "any quoted run of characters",
    menuBound: false,
    residue: true,
  },
]

export function ResidueLadder() {
  const W = 860
  const H = 322
  const nameX = 22
  const schemaX = 132
  const grammarX = 404
  const menuX = 680
  const rowTop = 84
  const rowH = 44

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one <code className="font-mono">search_products</code> tool call · what a
        grammar bounds, and what a menu can supply
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A four-row table of tool-call fields. The category field, an enum of three values, is bounded by the grammar to one of three literals and can be supplied from a menu. The sort field, a const, is bounded to exactly one literal and can be supplied from a menu. The max_price field, a number, is bounded by the grammar to digits with one point and an optional sign, but cannot come from a menu. The query field, a free string, is bounded only to any quoted run of characters and cannot come from a menu. The last two rows are marked as residue: fields where the grammar admits an unbounded set and the menu cannot help. A footer notes that across 413 selected actions in the WindTunnel traces, 379 of the 385 that needed a second model carried at least one free string property."
      >
        <text
          x={nameX}
          y={40}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          FIELD
        </text>
        <text
          x={schemaX}
          y={40}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          SCHEMA
        </text>
        <text
          x={grammarX}
          y={40}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          WHAT THE GRAMMAR ADMITS
        </text>
        <text
          x={menuX}
          y={40}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          FROM A MENU?
        </text>
        <line
          x1={nameX}
          y1={52}
          x2={W - 22}
          y2={52}
          className="stroke-border"
          strokeWidth={1}
        />

        <text
          x={nameX}
          y={70}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          the two mechanisms agree on the first two rows and diverge on the last
          two
        </text>

        {FIELDS.map((f, i) => {
          const y = rowTop + i * rowH
          return (
            <g key={f.name}>
              {f.residue ? (
                <rect
                  x={nameX - 8}
                  y={y - 16}
                  width={W - 28}
                  height={rowH - 6}
                  rx={3}
                  className="fill-destructive/[0.08]"
                />
              ) : null}
              <text
                x={nameX}
                y={y}
                className="fill-foreground font-mono"
                style={{ fontSize: 12 }}
              >
                {f.name}
              </text>
              <text
                x={schemaX}
                y={y}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                {f.schema}
              </text>
              <text
                x={grammarX}
                y={y}
                className={
                  f.residue
                    ? "fill-destructive font-mono"
                    : "fill-foreground font-mono"
                }
                style={{ fontSize: 10.5 }}
              >
                {f.grammarBound}
              </text>
              <text
                x={menuX}
                y={y}
                className={
                  f.menuBound
                    ? "fill-foreground font-mono"
                    : "fill-destructive font-mono"
                }
                style={{ fontSize: 10.5 }}
              >
                {f.menuBound ? "yes — it is a list" : "no — no list"}
              </text>
              {f.residue ? (
                <text
                  x={nameX}
                  y={y + 14}
                  className="fill-destructive font-mono"
                  style={{ fontSize: 8.5 }}
                >
                  residue
                </text>
              ) : null}
            </g>
          )
        })}

        <line
          x1={nameX}
          y1={rowTop + FIELDS.length * rowH - 4}
          x2={W - 22}
          y2={rowTop + FIELDS.length * rowH - 4}
          className="stroke-border"
          strokeWidth={1}
        />
        <text
          x={nameX}
          y={rowTop + FIELDS.length * rowH + 18}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          In the WindTunnel traces: 385 of 413 selected actions needed a second
          model to write their arguments.
        </text>
        <text
          x={nameX}
          y={rowTop + FIELDS.length * rowH + 34}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          379 of those 385 carried at least one <tspan className="fill-foreground">string</tspan> property with no enum and no const.
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        The two shaded rows are the whole disagreement. A grammar will happily
        emit <code className="font-mono">&quot;query&quot;: &quot;&quot;</code>{" "}
        or a paragraph of nonsense &mdash; both are quoted runs of characters, so
        both parse. A decision model will not emit either, because neither was on
        a list. That is why the constructive answer is not one mechanism but a
        split: enumerate the fields you can, let the grammar bound the shape of
        the rest, and <em>know which ones are residue</em>, because those are the
        only ones where a wrong answer looks exactly like a right one.
      </figcaption>
    </figure>
  )
}
