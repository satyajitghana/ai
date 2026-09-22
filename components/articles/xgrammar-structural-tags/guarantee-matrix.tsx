// Two mechanisms for stopping a model emitting something the caller cannot
// handle, and the two different things they promise.
//
// The grammar column describes XGrammar-2's Structural Tag as the repository
// implements it: a compiled pushdown grammar masks the vocabulary at every
// step, so the emitted token sequence is in the language by construction. The
// menu column describes a bounded decision model as TypeSafe documents it and
// as this site has measured it -- the output is an element of the option set
// the caller supplied on this request.
//
// The middle strip is the overlap, and it is a real construct rather than a
// rhetorical one: xgrammar's OrFormat over ConstStringFormat is an enumerated
// menu expressed as a grammar, and cpp/json_schema_converter.cc recognises
// `const` and `enum` as a finite value set under the name kFiniteValues.
//
// Pure layout arithmetic; lib/dmath is not needed.

type Col = {
  title: string
  sub: string
  guarantee: string
  mechanism: string[]
  cannot: string[]
}

const COLS: Col[] = [
  {
    title: "A grammar",
    sub: "XGrammar Structural Tag",
    guarantee: "the output parses",
    mechanism: [
      "at every step the vocabulary is masked to the tokens",
      "that keep the string inside the language",
    ],
    cannot: [
      "that the tool chosen is the right tool",
      "that a free string field says anything true",
      "that the model would have preferred this string",
      "that the value existed anywhere before it was generated",
    ],
  },
  {
    title: "A menu",
    sub: "a bounded decision model",
    guarantee: "the answer was on the menu",
    mechanism: [
      "the output is an element of the option set",
      "the caller sent with this request",
    ],
    cannot: [
      "that the option chosen is the right option",
      "that the option order did not decide it",
      "that a string can be produced at all",
      "that more than 255 options can be offered",
    ],
  },
]

export function GuaranteeMatrix() {
  const W = 860
  const colW = 396
  const gap = 34
  const x0 = 22
  const top = 20
  const boxH = 268
  const stripY = top + boxH + 20
  const H = stripY + 86

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        two answers to &ldquo;stop the model emitting something my program cannot
        handle&rdquo; · neither guarantee implies the other
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="Two panels side by side. The left panel, a grammar as implemented by an XGrammar structural tag, guarantees that the output parses, by masking the vocabulary to the tokens that keep the string in the language. It cannot guarantee that the tool chosen is the right tool, that a free string field says anything true, that the model would have preferred this string, or that the value existed anywhere before it was generated. The right panel, a menu as implemented by a bounded decision model, guarantees that the answer was on the menu, because the output is an element of the option set the caller sent with the request. It cannot guarantee that the option chosen is the right option, that the option order did not decide it, that a string can be produced at all, or that more than 255 options can be offered. A strip beneath both reads that the two overlap where a grammar enumerates its own alternatives: an or of constant strings, or a JSON schema with an enum, which XGrammar's converter recognises internally as a finite value set."
      >
        {COLS.map((c, i) => {
          const cx = x0 + i * (colW + gap)
          return (
            <g key={c.title} transform={`translate(${cx},0)`}>
              <rect
                x={0}
                y={top}
                width={colW}
                height={boxH}
                rx={4}
                className="fill-foreground/[0.04] stroke-border"
                strokeWidth={1.25}
              />
              <text
                x={16}
                y={top + 26}
                className="fill-foreground font-mono"
                style={{ fontSize: 15 }}
              >
                {c.title}
              </text>
              <text
                x={16}
                y={top + 42}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {c.sub}
              </text>

              <rect
                x={16}
                y={top + 54}
                width={colW - 32}
                height={38}
                rx={3}
                className="fill-foreground/55 stroke-foreground"
                strokeWidth={1.25}
              />
              <text
                x={28}
                y={top + 72}
                className="fill-background font-mono"
                style={{ fontSize: 8.5 }}
              >
                GUARANTEES
              </text>
              <text
                x={28}
                y={top + 86}
                className="fill-background font-mono"
                style={{ fontSize: 12.5 }}
              >
                {c.guarantee}
              </text>

              <text
                x={16}
                y={top + 110}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 8.5 }}
              >
                because
              </text>
              {c.mechanism.map((line, j) => (
                <text
                  key={line}
                  x={16}
                  y={top + 124 + j * 14}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {line}
                </text>
              ))}

              <line
                x1={16}
                y1={top + 154}
                x2={colW - 16}
                y2={top + 154}
                className="stroke-border"
                strokeWidth={1}
              />
              <text
                x={16}
                y={top + 170}
                className="fill-destructive font-mono"
                style={{ fontSize: 8.5 }}
              >
                RULES OUT NONE OF
              </text>
              {c.cannot.map((line, j) => (
                <text
                  key={line}
                  x={16}
                  y={top + 188 + j * 18}
                  className="fill-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  &middot; {line}
                </text>
              ))}
            </g>
          )
        })}

        <rect
          x={x0}
          y={stripY}
          width={2 * colW + gap}
          height={68}
          rx={4}
          className="fill-foreground/[0.07] stroke-foreground/45"
          strokeWidth={1.25}
          strokeDasharray="6 4"
        />
        <text
          x={x0 + 16}
          y={stripY + 22}
          className="fill-foreground font-mono"
          style={{ fontSize: 11.5 }}
        >
          where they meet: a grammar that enumerates its own alternatives
        </text>
        <text
          x={x0 + 16}
          y={stripY + 42}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          {"{"}&quot;type&quot;: &quot;or&quot;, &quot;elements&quot;: [
          const_string, const_string, ...]{"}"} &nbsp;·&nbsp; or a JSON schema
          with an <tspan className="fill-foreground">enum</tspan>
        </text>
        <text
          x={x0 + 16}
          y={stripY + 58}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9.5 }}
        >
          XGrammar&rsquo;s schema converter has a name for this case:
          kFiniteValues, reached by a const or an enum
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        A grammar guarantees <em>membership in a language</em>; a menu guarantees{" "}
        <em>membership in a set</em>. Neither implies the other: a language has
        infinitely many strings and the grammar does not care which one you get,
        while a set has no syntax and nothing stops its members being unparseable
        if you never checked. They coincide in exactly one place &mdash; when the
        language is finite and written out &mdash; and every practical schema is
        a mixture: enums where the values are known, free strings where they are
        not. The free strings are the residue neither mechanism validates.
      </figcaption>
    </figure>
  )
}
