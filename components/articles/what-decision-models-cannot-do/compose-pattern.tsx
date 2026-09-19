// Three harnesses built in the same week by people who were not talking to each
// other, reduced to the three questions that turn out to be the same three
// questions. The row labels are the design rule; the cells are what each project
// actually does, read out of its source.
//
// Server-rendered, zero JS.
const ROWS = [
  { key: "enumerate", label: "who builds the answer set" },
  { key: "decide", label: "what the model decides" },
  { key: "compose", label: "who composes the result" },
  { key: "cost", label: "what it costs" },
] as const

type RowKey = (typeof ROWS)[number]["key"]

const CASES: { name: string; sub: string; cells: Record<RowKey, string> }[] = [
  {
    name: "WebMCP arm",
    sub: "nekuda-ai/WindTunnel",
    cells: {
      enumerate: "the page — every live WebMCP tool, re-listed each step, plus finish and abstain",
      decide: "which tool to call next, out of a menu of 3 to 10",
      compose: "Mercury 2.5 writes the arguments and the final answer",
      cost: "385 of 413 decisions needed the second model; it is 78% of the bill",
    },
  },
  {
    name: "semgrep",
    sub: "uehaj/jev-semgrep",
    cells: {
      enumerate: "the file — 30 lines per request, one Noul per (line, meaning) pair",
      decide: "does this line match this meaning · one probability, thresholded",
      compose: "JavaScript evaluates the AND / OR / NOT in disjunctive normal form",
      cost: "every query re-reads the whole corpus; there is no index",
    },
  },
  {
    name: "json-render",
    sub: "vercel-labs/json-render",
    cells: {
      enumerate: "the developer — 17 component types, plus per-request value and binding candidates",
      decide: "membership, then parent slots and sibling order, in two batched evaluations",
      compose: "code assembles and validates the tree; the registry owns appearance",
      cost: "“arbitrary new text/data are not supported”",
    },
  },
]

export function ComposePattern() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the bounded model decides · something else composes
      </div>
      <div className="grid gap-px bg-border sm:grid-cols-3">
        {CASES.map((c) => (
          <div key={c.name} className="bg-background">
            <div className="border-b px-3 py-2">
              <p className="font-mono text-[12px] text-foreground">{c.name}</p>
              <p className="font-mono text-[10.5px] text-muted-foreground">{c.sub}</p>
            </div>
            <dl className="divide-y">
              {ROWS.map((r) => (
                <div key={r.key} className="px-3 py-2.5">
                  <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {r.label}
                  </dt>
                  <dd className="mt-1 text-[12px] leading-5 text-foreground/90">
                    {c.cells[r.key]}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        ))}
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Three unrelated repositories, one shape. The row that is easy to miss is the last
        one: in all three, the work moves to whoever has to enumerate, and that is where
        the remaining difficulty now lives.
      </figcaption>
    </figure>
  )
}
