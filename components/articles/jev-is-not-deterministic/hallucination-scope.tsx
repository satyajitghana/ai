// "It cannot hallucinate" is three different propositions, and the complaint
// attacks the one nobody asserted.
//
// The first is a closure property and permuting the option list cannot touch
// it. The second is a statement about aggregates and the vendor scopes it
// itself. The third is the one readers supply for free — that the answer is a
// property of the question — and it is the one the measurement kills.
//
// Server-rendered SVG, zero JS, integer coordinates, no Math.* at all.
const W = 920
const H = 330

const X_PROP = 20
const W_PROP = 392
const X_WHO = 428
const W_WHO = 232
const X_TEST = 676
const W_TEST = 224

const ROW_Y = [78, 162, 246]
const ROW_H = 72

type Row = {
  tag: string
  prop: string
  detail: string[]
  who: string[]
  survives: "holds" | "scoped" | "false"
  test: string[]
}

const ROWS: Row[] = [
  {
    tag: "P1",
    prop: "the answer is an element of the list you sent",
    detail: ["no option can be invented, misspelled,", "or half-copied — there is no decode step"],
    who: ["asserted, in these words:", "“Schema matching is guaranteed,", "thus we can confidently add 0%”"],
    survives: "holds",
    test: ["permuting the list permutes", "the set. The answer is still", "an element of it."],
  },
  {
    tag: "P2",
    prop: "the probability that comes back is calibrated",
    detail: ["a threshold on it separates the cases", "you can automate from the ones you cannot"],
    who: [
      "asserted and then scoped, by",
      "the vendor: “does not guarantee",
      "that an individual answer is correct”",
    ],
    survives: "scoped",
    test: [
      "two arrangements return 0.69",
      "apart for one option. At most",
      "one is the belief about it.",
    ],
  },
  {
    tag: "P3",
    prop: "the answer is a property of the question alone",
    detail: ["send the same question any way you like", "and the same thing comes back"],
    who: ["asserted by nobody.", "Supplied by the reader, because", "it is what “decision” sounds like"],
    survives: "false",
    test: ["measured false: 12 of 100", "items change answer under", "permutation alone"],
  },
]

function chip(kind: Row["survives"]): { label: string; cls: string } {
  if (kind === "holds")
    return { label: "SURVIVES", cls: "fill-foreground/[0.08] stroke-foreground/50" }
  if (kind === "scoped") return { label: "STRAINED", cls: "fill-muted/50 stroke-border" }
  return { label: "BROKEN", cls: "fill-destructive/10 stroke-destructive" }
}

export function HallucinationScope() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        “it cannot hallucinate” · three propositions, one of which was never made
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A three-row table unpacking the claim that the model cannot hallucinate into three separate propositions and asking which survives permuting the option list. Proposition one: the answer is an element of the list you sent, so no option can be invented, misspelled or half-copied because there is no decode step; asserted by the vendor in the words schema matching is guaranteed; it survives, because permuting the list permutes the set and the answer is still an element of it. Proposition two: the probability that comes back is calibrated, so a threshold separates the cases you can automate from the ones you cannot; asserted by the vendor and then scoped by it, calibration does not guarantee that an individual answer is correct; it is strained, because two arrangements of the same question return probabilities 0.69 apart for one option and at most one of them can be the belief about that option. Proposition three: the answer is a property of the question alone, so sending the same question any way you like returns the same thing; asserted by nobody and supplied by the reader because it is what the word decision sounds like; it is broken, measured false, with 12 of 100 items changing answer under permutation alone."
      >
        {/* header */}
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          <text x={X_PROP} y={62}>
            WHAT THE PROPOSITION SAYS
          </text>
          <text x={X_WHO} y={62}>
            WHO ASSERTED IT
          </text>
          <text x={X_TEST} y={62}>
            UNDER A PERMUTED OPTION LIST
          </text>
        </g>

        {/* the claim as written */}
        <rect
          x={X_PROP}
          y={14}
          width={880}
          height={32}
          rx={5}
          className="fill-foreground/[0.06] stroke-foreground/50"
          strokeWidth={1.5}
        />
        <text
          x={460}
          y={34}
          textAnchor="middle"
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          the shipped claim: “no type errors … it is mathematically impossible”
        </text>

        {ROWS.map((r, i) => {
          const y = ROW_Y[i]
          const c = chip(r.survives)
          return (
            <g key={r.tag}>
              {/* proposition */}
              <rect
                x={X_PROP}
                y={y}
                width={W_PROP}
                height={ROW_H}
                rx={5}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <text
                x={X_PROP + 12}
                y={y + 19}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 10 }}
              >
                {r.tag}
              </text>
              <text
                x={X_PROP + 36}
                y={y + 19}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {r.prop}
              </text>
              {r.detail.map((d, j) => (
                <text
                  key={d}
                  x={X_PROP + 36}
                  y={y + 39 + j * 14}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {d}
                </text>
              ))}

              {/* who */}
              <rect
                x={X_WHO}
                y={y}
                width={W_WHO}
                height={ROW_H}
                rx={5}
                className="fill-muted/40 stroke-border"
                strokeWidth={1}
              />
              {r.who.map((d, j) => (
                <text
                  key={d}
                  x={X_WHO + 12}
                  y={y + 20 + j * 14}
                  className={j === 0 ? "fill-foreground font-mono" : "fill-muted-foreground font-mono"}
                  style={{ fontSize: 10 }}
                >
                  {d}
                </text>
              ))}

              {/* test */}
              <rect
                x={X_TEST}
                y={y}
                width={W_TEST}
                height={ROW_H}
                rx={5}
                className="fill-background stroke-border"
                strokeWidth={1}
              />
              <rect
                x={X_TEST + 12}
                y={y + 10}
                width={78}
                height={17}
                rx={3}
                className={c.cls}
                strokeWidth={1.25}
              />
              <text
                x={X_TEST + 51}
                y={y + 22}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                {c.label}
              </text>
              {r.test.map((d, j) => (
                <text
                  key={d}
                  x={X_TEST + 12}
                  y={y + 44 + j * 12}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 9.5 }}
                >
                  {d}
                </text>
              ))}
            </g>
          )
        })}
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The complaint reads as an attack on the first row and is really an observation about
        the third. P1 is the only one shipped as a guarantee, and it is the only one a
        permuted list cannot touch — which is exactly why it is worth so much less than it
        sounds.
      </figcaption>
    </figure>
  )
}
