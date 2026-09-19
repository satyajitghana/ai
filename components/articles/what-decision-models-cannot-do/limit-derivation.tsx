// The whole argument of the article in one picture.
//
// One architectural choice sits at the top. Two things follow from it that are
// genuinely forced — the output cannot be a string, and nothing survives a call
// — and one thing that ISN'T forced: how the options reach the scorer is a free
// implementation decision, and the two available answers pay opposite prices.
//
// The bottom band is the part most write-ups get wrong. Half the failure modes
// on TypeSafe's own jaggedness page do not follow from the shape at all, and the
// cardinality numbers people quote as limits are constants in four different
// files. Drawing them detached is the point of the diagram.
//
// Server-rendered SVG, zero JS. Integer coordinates only — no Math.* anywhere,
// so nothing can serialize differently on the server and in the browser.
const W = 920

const ORDINARY = [
  "literal reading",
  "arithmetic",
  "date ordering",
  "context rot",
  "prompt injection",
  "contradictory criteria",
]

const CONSTANTS = [
  ["openjev", "16"],
  ["Laya", "~20"],
  ["Jev", "255"],
  ["system-one-mini", "fixed K"],
  ["CUA-S1, open-jev-deberta", "none"],
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

export function LimitDerivation() {
  const L = 44 // left column x
  const R = 492 // right column x
  const CW = 384 // column width

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one architectural choice · what follows from it, and what does not
      </div>
      <svg
        viewBox={`0 0 ${W} 596`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A derivation diagram. At the top: the model's output is an element of the option set the caller sent. Two branches follow. Branch A, bounded output, forces two limits: the model cannot produce a string that is not already an option, which is the generation limit; and no intermediate result survives a call, which is the planning and multi-step limit. Branch B, option comparison, is a free choice between two implementations that pay opposite prices: per-option scoring is order-invariant by construction but cannot answer a question spanning two options, which is Jev's zero out of one hundred on relational choice; shared context can in principle answer relational questions but carries a position prior, measured at 1.7 logits in openjev. Below, detached from the derivation, two bands: six ordinary weaknesses that do not follow from the shape — literal reading, arithmetic, date ordering, context rot, prompt injection and contradictory criteria — and five cardinality ceilings that are constants in five different repositories rather than one limit: 16, about 20, 255, a fixed K, and none at all."
      >
        {/* ---------- root ---------- */}
        <Box x={228} y={14} w={464} h={54} tone="root" />
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={460} y={36} textAnchor="middle">
            THE ONE CHOICE
          </text>
        </g>
        <g className="fill-foreground/80 font-mono" style={{ fontSize: 11 }}>
          <text x={460} y={55} textAnchor="middle">
            the output is an element of the option set the caller sent
          </text>
        </g>

        {/* spine + bus */}
        <line x1={460} y1={68} x2={460} y2={88} className="stroke-foreground/40" strokeWidth={1.5} />
        <line x1={236} y1={88} x2={684} y2={88} className="stroke-foreground/40" strokeWidth={1.5} />
        <line x1={236} y1={88} x2={236} y2={104} className="stroke-foreground/40" strokeWidth={1.5} />
        <line x1={684} y1={88} x2={684} y2={104} className="stroke-foreground/40" strokeWidth={1.5} />

        {/* ---------- branch headers ---------- */}
        <Box x={L} y={104} w={CW} h={42} tone="muted" />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={L + 14} y={122}>A · BOUNDED OUTPUT</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={L + 14} y={138}>forced — true of every family</text>
        </g>

        <Box x={R} y={104} w={CW} h={42} tone="muted" />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={R + 14} y={122}>B · HOW OPTIONS ARE COMPARED</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={R + 14} y={138}>not forced — a free implementation choice</text>
        </g>

        {/* ---------- A consequences ---------- */}
        <line x1={236} y1={146} x2={236} y2={166} className="stroke-border" strokeWidth={1.5} />
        <line x1={236} y1={190} x2={236} y2={262} className="stroke-border" strokeWidth={1.5} />
        <line x1={236} y1={190} x2={L + 18} y2={190} className="stroke-border" strokeWidth={1.5} />
        <line x1={236} y1={262} x2={L + 18} y2={262} className="stroke-border" strokeWidth={1.5} />

        <Box x={L} y={166} w={CW} h={70} />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={L + 14} y={186}>it cannot produce a string that is not an option</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={L + 14} y={204}>385 of 413 WebMCP decisions handed to a generative</text>
          <text x={L + 14} y={218}>model; 379 of those filled an unconstrained string</text>
          <text x={L + 14} y={232}>→ pair it with a writer, or enumerate the candidates</text>
        </g>

        <Box x={L} y={248} w={CW} h={70} />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={L + 14} y={268}>no intermediate result survives a call</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={L + 14} y={286}>a 255-way choice carries under 8 bits; there is no</text>
          <text x={L + 14} y={300}>scratchpad, so planning has to live in the harness</text>
          <text x={L + 14} y={314}>→ &quot;a documented weakness&quot;: indirection, stopping</text>
        </g>

        {/* ---------- B consequences ---------- */}
        <line x1={684} y1={146} x2={684} y2={166} className="stroke-border" strokeWidth={1.5} />
        <line x1={684} y1={190} x2={684} y2={262} className="stroke-border" strokeWidth={1.5} />
        <line x1={684} y1={190} x2={R + 18} y2={190} className="stroke-border" strokeWidth={1.5} />
        <line x1={684} y1={262} x2={R + 18} y2={262} className="stroke-border" strokeWidth={1.5} />

        <Box x={R} y={166} w={CW} h={70} />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={R + 14} y={186}>each option scored alone (Jev, CUA-S1, DeBERTa)</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={R + 14} y={204}>✓ option order is not expressible</text>
          <text x={R + 14} y={220}>✗ a question spanning two options has no answer</text>
          <text x={R + 14} y={234}>   to find — 0 / 100 on relational choice</text>
        </g>

        <Box x={R} y={248} w={CW} h={70} />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={R + 14} y={268}>options share a context (letters, markers)</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={R + 14} y={286}>✓ a relational question is at least answerable</text>
          <text x={R + 14} y={302}>✗ position carries a prior — +1.71 logits for slot A,</text>
          <text x={R + 14} y={316}>   flipping 10 of 36 reversed questions</text>
        </g>

        {/* ---------- detached band: ordinary weaknesses ---------- */}
        <line
          x1={44}
          y1={344}
          x2={876}
          y2={344}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={460} y={338} textAnchor="middle">
            everything below is reported as a limit of the shape and is not one
          </text>
        </g>

        <Box x={44} y={364} w={832} h={88} tone="dashed" />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={60} y={386}>NOT DERIVED — ordinary weaknesses any encoder has</text>
        </g>
        {ORDINARY.map((label, i) => {
          const x = 60 + (i % 3) * 272
          const y = 410 + (i < 3 ? 0 : 26)
          return (
            <g key={label}>
              <rect
                x={x}
                y={y}
                width={248}
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
        <Box x={44} y={468} w={832} h={112} tone="dashed" />
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={60} y={490}>NOT ONE LIMIT — five ceilings, five unrelated causes</text>
        </g>
        {CONSTANTS.map(([who, cap], i) => {
          const y = 504 + i * 15
          return (
            <g key={who} className="font-mono" style={{ fontSize: 10.5 }}>
              <text x={60} y={y + 11} className="fill-muted-foreground">
                {who}
              </text>
              <text x={330} y={y + 11} className="fill-foreground" textAnchor="end">
                {cap}
              </text>
              <line
                x1={344}
                y1={y + 7}
                x2={860}
                y2={y + 7}
                className="stroke-border"
                strokeWidth={0.75}
                strokeDasharray="2 4"
              />
            </g>
          )
        })}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10.5 }}>
          <text x={356} y={515}>a 16-character constant in one file</text>
          <text x={356} y={530}>a recommendation; options share one 512-token sequence</text>
          <text x={356} y={545}>a served product limit, with a two-stage fallback above it</text>
          <text x={356} y={560}>the answer set is welded into the head at training time</text>
          <text x={356} y={575}>one scalar per option: N is a loop bound, not a weight</text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The top half is the argument: two limits are forced by the shape, and the third
        and fourth are the two prices of a decision the shape leaves open. The bottom
        half is the argument against the version of this article that everyone
        else{" "}would write.
      </figcaption>
    </figure>
  )
}
