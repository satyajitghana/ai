// The comparison the article is built from: four design decisions every
// decision-model harness has to make, and five independent answers to each.
//
// Rows are the decisions. Columns are the projects. Every cell is a fact read
// out of the repository at the commit named in the prose, not a summary of a
// README.
//
// The colour rule: a cell is emphasised when that project's answer is the
// minority one on its row. That is the whole argument made visible — the
// enumerator row is almost entirely unemphasised (everyone agrees: no model),
// the gate row is entirely emphasised (nobody agrees).
//
// Server-rendered HTML grid, zero JS. Reflows to one column per project on a
// phone rather than scrolling a five-column table sideways.

type Cell = {
  head: string
  sub: string
  odd?: boolean // this answer is the minority one on its row
}

type Row = {
  axis: string
  question: string
  verdict: string
  cells: Cell[] // ordered as PROJECTS
}

const PROJECTS = [
  { name: "SystemOneHarness", lang: "Python · Apache-2.0" },
  { name: "webctl", lang: "Go · MIT" },
  { name: "fastbrowse", lang: "Python · MIT" },
  { name: "djev", lang: "Python · Apache-2.0" },
  { name: "cadence", lang: "Python · MIT" },
]

const ROWS: Row[] = [
  {
    axis: "enumerator",
    question: "what turns a situation into a finite option list?",
    verdict: "four of five contain no model at all",
    cells: [
      { head: "declared, or compiled", sub: "YAML action space, MCP tool schemas, Browser Use's DOM index, a 4-bit canvas quantiser" },
      { head: "search + LSH", sub: "3 engines fused by reciprocal rank, MinHash over 3-word shingles, a 2,000-char chunker" },
      { head: "page capture, then Jev", sub: "capture.js indexes ≤320 controls; past 160 a noul per control shortlists them", odd: true },
      { head: "none — it is the server", sub: "the caller enumerates; for a span the enumerator is the text's own token ids" },
      { head: "a callback", sub: "actions(S) → Sequence[A], supplied by the application" },
    ],
  },
  {
    axis: "question format",
    question: "what shape does one question take, and how many options fit?",
    verdict: "everyone took TypeSafe's three primitives; the ceilings differ by 10x",
    cells: [
      { head: "choice / noul / score", sub: "≤255 options; over that, truncate and record the drop in the trace" },
      { head: "choice / noul / score", sub: "score over a 4-level rubric by default; a custom rubric is a CLI flag" },
      { head: "choice / noul / score", sub: "≤240 for headroom; over that, groups of 30 and a second call" },
      { head: "choice / noul / score / span", sub: "≤26 options — the labels are A…Z, one token each", odd: true },
      { head: "a float", sub: "evaluate(S) → float; no language model anywhere", odd: true },
    ],
  },
  {
    axis: "confidence gate",
    question: "what happens when the answer is not confident enough?",
    verdict: "five different answers — this is where the projects actually disagree",
    cells: [
      { head: "refuse", sub: "per-risk thresholds on the weakest judgment; 3 refusals in a row ends the run with a handoff packet", odd: true },
      { head: "drop", sub: "one cut derived from the rubric size; the result never reaches the agent's context", odd: true },
      { head: "hand it to the LLM", sub: "under 0.55 the step goes to LLM recovery; 11 named thresholds, each with a calibration note", odd: true },
      { head: "look again", sub: "first-read entropy over 0.1 buys three more noise draws, averaged, with a standard error", odd: true },
      { head: "spend more nodes", sub: "the budget is visited nodes per tick; no probability is involved", odd: true },
    ],
  },
  {
    axis: "composer",
    question: "who writes the strings a decision model cannot emit?",
    verdict: "the only axis where a second model is the common answer",
    cells: [
      { head: "nobody — the operator", sub: "a parameter needing free text fails to compile; text is supplied by name before the run" },
      { head: "nobody by default", sub: "--summarize adds a small general model over the kept chunks" },
      { head: "an LLM, then code", sub: "the reader cites block ids; code slices the quote and builds the #:~:text= link" },
      { head: "the model, bounded", sub: "a span returns character offsets, so the string is a substring by construction" },
      { head: "n/a", sub: "the output is an action from the supplied set and a predicted cost" },
    ],
  },
]

export function FourAxes() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
        four design decisions · five independent answers to each
      </div>

      <div className="divide-y">
        {ROWS.map((row) => (
          <section key={row.axis} className="px-3 py-3">
            <header className="mb-2">
              <p className="font-mono text-[11px] font-semibold">{row.axis}</p>
              <p className="font-mono text-[10px] text-muted-foreground">{row.question}</p>
            </header>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {row.cells.map((cell, i) => (
                <div
                  key={PROJECTS[i]!.name}
                  className={`rounded-sm border px-2.5 py-2 ${
                    cell.odd ? "border-foreground/40 bg-foreground/[0.04]" : "border-border"
                  }`}
                >
                  <p className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {PROJECTS[i]!.name}
                  </p>
                  <p className="font-mono text-[11.5px] leading-5 font-semibold">{cell.head}</p>
                  <p className="mt-1 font-mono text-[10px] leading-4 text-muted-foreground">
                    {cell.sub}
                  </p>
                </div>
              ))}
            </div>

            <p className="mt-2 font-mono text-[10px] text-muted-foreground">
              &rarr; {row.verdict}
            </p>
          </section>
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
        A shaded cell is the minority answer on its row. Read the rows, not the columns: the
        enumerator row is nearly unshaded because four of five enumerators contain no model, and
        the gate row is entirely shaded because no two projects do the same thing below the
        threshold. cadence is in the table because it has the same four parts, not because it is a
        decision-model harness — it is not.
      </figcaption>
    </figure>
  )
}
