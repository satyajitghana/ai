// The whole argument of the article in one picture.
//
// One architectural choice sits at the top. Two things follow from it that are
// genuinely forced — the output cannot be a string, and nothing survives a call
// — and one thing that ISN'T forced: how the options reach the scorer is a free
// implementation decision, and the two available answers pay opposite prices.
//
// The bottom band is the part most write-ups get wrong. Half the failure modes
// on TypeSafe's own jaggedness page do not follow from the shape at all, and the
// cardinality numbers people quote as limits are constants in five different
// files. Drawing them detached is the point of the diagram.
//
// Geometry: two 384-wide columns with a 104px corridor between them. Each
// branch's fork rail lives in that corridor (A on the left rail, B on the right)
// so no connector is ever drawn across a box.
//
// Server-rendered SVG, zero JS. Integer coordinates only — no Math.* anywhere,
// so nothing can serialize differently on the server and in the browser.
const W = 920
const H = 596

const L = 24 // left column x
const R = 512 // right column x
const CW = 384 // column width
const LC = L + CW / 2 // left column centre  = 216
const RC = R + CW / 2 // right column centre = 704
const RAIL_A = 440 // fork rail for the left column, inside the corridor
const RAIL_B = 480 // fork rail for the right column

const ORDINARY = [
  "literal reading",
  "arithmetic",
  "date ordering",
  "context rot",
  "prompt injection",
  "contradictory criteria",
]

const CONSTANTS: [string, string, string][] = [
  ["openjev", "16", "a 16-character constant in one file"],
  ["Laya", "~20", "a recommendation; options share one 512-token sequence"],
  ["Jev", "255", "a served product limit, with a two-stage fallback above it"],
  ["system-one-mini", "fixed K", "the answer set is welded into the head at training time"],
  [
    "CUA-S1, open-jev-deberta",
    "none",
    "one scalar per option: N is a loop bound, not a weight",
  ],
]

function Box({
  x,
  y,
  w,
  h,
  tone = "plain",
}: {
  x: number
  y: number
  w: number
  h: number
  tone?: "plain" | "root" | "muted" | "dashed"
}) {
  const cls =
    tone === "root"
      ? "fill-foreground/[0.06] stroke-foreground/50"
      : tone === "muted"
        ? "fill-muted/40 stroke-border"
        : "fill-background stroke-border"
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={5}
      className={cls}
      strokeWidth={tone === "root" ? 1.75 : 1}
      strokeDasharray={tone === "dashed" ? "4 4" : undefined}
    />
  )
}

function Rail({ side }: { side: "a" | "b" }) {
  const rail = side === "a" ? RAIL_A : RAIL_B
  const from = side === "a" ? LC : RC
  const into = side === "a" ? L + CW : R
  return (
    <g className="stroke-border" strokeWidth={1.5} fill="none">
      <line x1={from} y1={146} x2={from} y2={152} />
      <line x1={from} y1={152} x2={rail} y2={152} />
      <line x1={rail} y1={152} x2={rail} y2={282} />
      <line x1={rail} y1={190} x2={into} y2={190} />
      <line x1={rail} y1={282} x2={into} y2={282} />
    </g>
  )
}

export function LimitDerivation() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one architectural choice · what follows from it, and what does not
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A derivation diagram. At the top: the output is an element of the option set the caller sent. Two branches follow. Branch A, bounded output, is forced and holds for every family: it cannot produce a string that is not an option, and no intermediate result survives a call. Branch B, how options are compared, is a free implementation choice with two answers that pay opposite prices: scoring each option alone makes option order inexpressible but leaves a question spanning two options with no answer to find, zero out of one hundred on relational choice; letting options share a context makes relational questions at least answerable but gives position a prior worth 1.71 logits, flipping ten of thirty-six reversed questions. Below, detached from the derivation, two bands. The first lists six ordinary weaknesses that do not follow from the shape: literal reading, arithmetic, date ordering, context rot, prompt injection and contradictory criteria. The second lists five cardinality ceilings with five unrelated causes: openjev's 16, a constant in one file; Laya's roughly 20, a recommendation bounded by one 512-token sequence; Jev's 255, a served product limit with a two-stage fallback; system-one-mini's fixed K, welded into the head at training time; and no ceiling at all for CUA-S1 and open-jev-deberta, where one scalar per option makes N a loop bound rather than a weight."
      >
        {/* ---------- root ---------- */}
        <Box x={228} y={14} w={464} h={54} tone="root" />
        <text
          x={460}
          y={36}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 12 }}
        >
          THE ONE CHOICE
        </text>
        <text
          x={460}
          y={55}
          textAnchor="middle"
          className="fill-foreground/80 font-mono"
          style={{ fontSize: 11 }}
        >
          the output is an element of the option set the caller sent
        </text>

        {/* root spine + header bus */}
        <g className="stroke-foreground/40" strokeWidth={1.5}>
          <line x1={460} y1={68} x2={460} y2={88} />
          <line x1={LC} y1={88} x2={RC} y2={88} />
          <line x1={LC} y1={88} x2={LC} y2={104} />
          <line x1={RC} y1={88} x2={RC} y2={104} />
        </g>

        {/* ---------- branch headers ---------- */}
        <Box x={L} y={104} w={CW} h={42} tone="muted" />
        <text x={L + 14} y={122} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          A · BOUNDED OUTPUT
        </text>
        <text
          x={L + 14}
          y={138}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          forced — true of every family
        </text>

        <Box x={R} y={104} w={CW} h={42} tone="muted" />
        <text x={R + 14} y={122} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          B · HOW OPTIONS ARE COMPARED
        </text>
        <text
          x={R + 14}
          y={138}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          not forced — a free implementation choice
        </text>

        <Rail side="a" />
        <Rail side="b" />

        {/* ---------- A consequences ---------- */}
        <Box x={L} y={166} w={CW} h={70} />
        <text x={L + 14} y={186} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          it cannot produce a string that is not an option
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={L + 14} y={204}>385 of 413 WebMCP decisions handed to a generative</text>
          <text x={L + 14} y={218}>model; 379 of those filled an unconstrained string</text>
          <text x={L + 14} y={232}>→ pair it with a writer, or enumerate the candidates</text>
        </g>

        <Box x={L} y={248} w={CW} h={70} />
        <text x={L + 14} y={268} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          no intermediate result survives a call
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={L + 14} y={286}>a 255-way choice carries under 8 bits; there is no</text>
          <text x={L + 14} y={300}>scratchpad, so planning has to live in the harness</text>
          <text x={L + 14} y={314}>→ indirection, and knowing when to stop</text>
        </g>

        {/* ---------- B consequences ---------- */}
        <Box x={R} y={166} w={CW} h={70} />
        <text x={R + 14} y={186} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          each option scored alone (Jev, CUA-S1, DeBERTa)
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={R + 14} y={204}>✓ option order is not expressible</text>
          <text x={R + 14} y={220}>✗ a question spanning two options has no answer</text>
          <text x={R + 30} y={234}>to find — 0 / 100 on relational choice</text>
        </g>

        <Box x={R} y={248} w={CW} h={70} />
        <text x={R + 14} y={268} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          options share a context (letters, markers)
        </text>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={R + 14} y={286}>✓ a relational question is at least answerable</text>
          <text x={R + 14} y={302}>✗ position carries a prior — +1.71 logits for slot A,</text>
          <text x={R + 30} y={316}>flipping 10 of 36 reversed questions</text>
        </g>

        {/* ---------- detached band: ordinary weaknesses ---------- */}
        <line
          x1={L}
          y1={344}
          x2={R + CW}
          y2={344}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <text
          x={460}
          y={338}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10.5 }}
        >
          everything below is reported as a limit of the shape and is not one
        </text>

        <Box x={L} y={364} w={872} h={88} tone="dashed" />
        <text x={40} y={386} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          NOT DERIVED — ordinary weaknesses any encoder has
        </text>
        {ORDINARY.map((label, i) => {
          const x = 40 + (i % 3) * 288
          const y = 402 + (i < 3 ? 0 : 24)
          return (
            <g key={label}>
              <rect
                x={x}
                y={y}
                width={264}
                height={20}
                rx={3}
                className="fill-muted/40 stroke-border"
                strokeWidth={1}
              />
              <text
                x={x + 10}
                y={y + 14}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                {label}
              </text>
            </g>
          )
        })}

        {/* ---------- detached band: cardinality ---------- */}
        <Box x={L} y={468} w={872} h={112} tone="dashed" />
        <text x={40} y={490} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          NOT ONE LIMIT — five ceilings, five unrelated causes
        </text>
        {CONSTANTS.map(([who, cap, why], i) => {
          const baseline = 515 + i * 15
          return (
            <g key={who} className="font-mono" style={{ fontSize: 10.5 }}>
              <text x={40} y={baseline} className="fill-muted-foreground">
                {who}
              </text>
              <text x={310} y={baseline} textAnchor="end" className="fill-foreground">
                {cap}
              </text>
              <line
                x1={324}
                y1={baseline - 4}
                x2={880}
                y2={baseline - 4}
                className="stroke-border"
                strokeWidth={0.75}
                strokeDasharray="2 4"
              />
              <text x={336} y={baseline} className="fill-muted-foreground">
                {why}
              </text>
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The top half is the argument: two limits are forced by the shape, and the third and
        fourth are the two prices of a decision the shape leaves open. The bottom half is
        the argument against the version of this article everyone else would write.
      </figcaption>
    </figure>
  )
}
