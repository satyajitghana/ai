// Three drop-ins, three different `confidence` fields, one wire format.
//
// Every one of these projects advertises compatibility with TypeSafe's SDK, and
// every threshold anyone tunes in a confidence-gated routing system is a
// threshold on this number. It is not the same number.
//
//   rescaled max      (p_max - 1/n) / (1 - 1/n)     jeff; kev (choice)
//   normalised entropy 1 - H(p) / ln(n)             gliner2-doom
//   distance from mode 1 - E|i - mode| / (L - 1)    kev (score)
//
// The first is the formula the RLCD piece recovered from TypeSafe's own worked
// examples; the second is the one its stale quickstart page matches. Both are
// now shipping, in different repositories, under the same field name.
//
// Values are computed in the scratchpad and pasted as literals, so no logarithm
// runs at render time and there is nothing for Node and Chrome to disagree about.
// Server-rendered, zero JS.

interface Case {
  label: string
  dist: string
  rescaled: number
  entropy: number
  mode: number
  note?: string
}

const CASES: Case[] = [
  { label: "two-option, 75 / 25", dist: "0.75, 0.25", rescaled: 0.5, entropy: 0.189, mode: 0.75 },
  {
    label: "the docs' quickstart example",
    dist: "0.84, 0.159, 0.001",
    rescaled: 0.76,
    entropy: 0.594,
    mode: 0.919,
    note: "published as 0.596",
  },
  { label: "the docs' Score example", dist: "0.00, 0.70, 0.30", rescaled: 0.55, entropy: 0.444, mode: 0.85 },
  { label: "confident three-way", dist: "0.90, 0.05, 0.05", rescaled: 0.85, entropy: 0.641, mode: 0.925 },
  {
    label: "near-uniform",
    dist: "0.40, 0.35, 0.25",
    rescaled: 0.1,
    entropy: 0.016,
    mode: 0.575,
    note: "auto-ships under one rule, escalates under two",
  },
]

const THRESHOLD = 0.5

function Cell({ v, note }: { v: number; note?: boolean }) {
  const above = v >= THRESHOLD
  return (
    <td className="px-3 py-2 text-right">
      <span
        className={`inline-block rounded-sm px-1.5 py-0.5 tabular-nums ${
          above ? "bg-foreground/10 font-semibold text-foreground" : "text-muted-foreground"
        }`}
      >
        {v.toFixed(3)}
      </span>
      {note ? <span className="sr-only"> (above the 0.5 threshold)</span> : null}
    </td>
  )
}

export function ConfidenceDivergence() {
  return (
    <figure className="my-8 space-y-3">
      <div className="overflow-x-auto rounded-md border">
        <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
          the same distribution, three shipping definitions of{" "}
          <code className="font-mono">confidence</code> · shaded = would auto-ship
          at a 0.5 threshold
        </div>
        <table className="w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b text-left font-mono text-xs text-muted-foreground">
              <th className="px-3 py-2 font-normal">distribution</th>
              <th className="px-3 py-2 text-right font-normal">
                (p_max &minus; 1/n) / (1 &minus; 1/n)
              </th>
              <th className="px-3 py-2 text-right font-normal">1 &minus; H(p)/ln n</th>
              <th className="px-3 py-2 text-right font-normal">1 &minus; E|i&minus;mode|/(L&minus;1)</th>
            </tr>
            <tr className="border-b text-left font-mono text-[10px] text-muted-foreground">
              <th className="px-3 pb-2 font-normal" />
              <th className="px-3 pb-2 text-right font-normal">jeff · kev (choice)</th>
              <th className="px-3 pb-2 text-right font-normal">gliner2-doom</th>
              <th className="px-3 pb-2 text-right font-normal">kev (score)</th>
            </tr>
          </thead>
          <tbody className="font-mono text-xs">
            {CASES.map((c) => (
              <tr key={c.label} className="border-b last:border-0">
                <td className="px-3 py-2">
                  <div className="text-foreground/80">{c.label}</div>
                  <div className="text-muted-foreground">{c.dist}</div>
                  {c.note ? <div className="text-[10px] text-muted-foreground">{c.note}</div> : null}
                </td>
                <Cell v={c.rescaled} />
                <Cell v={c.entropy} />
                <Cell v={c.mode} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <figcaption className="text-xs leading-relaxed text-muted-foreground">
        Formulas read out of{" "}
        <code className="font-mono">jeff/src/jeff/core/answers.py</code>,{" "}
        <code className="font-mono">gliner2-doom/src/systemone.rs</code> and{" "}
        <code className="font-mono">kev/kev/api.py</code>. All three serve
        TypeSafe&apos;s <code className="font-mono">/v1/systemone</code> contract and
        all three populate the same <code className="font-mono">confidence</code>{" "}
        field. Row two is the RLCD piece&apos;s stale-page finding reproduced: the
        docs publish <code className="font-mono">0.596</code> for that
        distribution, which is the entropy column, while every other worked
        example in the docs matches the first column.
      </figcaption>
    </figure>
  )
}
