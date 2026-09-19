// What it takes to make a bounded model write a string.
//
// WindTunnel's decision scaffold ships two argument fillers. The one it measured
// pairs Jev with a generative model. The other one — `fillFromSpans` in
// `experiments/jev/frozen/arms/decision-spans.mjs` — is the honest attempt to do
// it with the decision model alone, and it is the clearest statement anywhere of
// what "bounded output" costs. Every row below is that file.
//
// Server-rendered, zero JS.
const STEPS = [
  {
    n: "1",
    head: "the task arrives as a string",
    body: 'Find the post whose title starts with "Introducing" and report its full title.',
    mono: true,
    note: "a real prompt from the published WebMCP traces; the chosen action is ask_site, whose only argument is a free-text query",
  },
  {
    n: "2",
    head: "the harness manufactures an answer set",
    body: "regex over the prompt for emails, quoted spans, ISO dates, all-caps tokens and numbers · every string, number and boolean walked out of the last observations · then every contiguous span of the prompt up to six words long",
    note: "63 candidates from this prompt's own text before a single observation is added; the pool is capped at 2,000",
  },
  {
    n: "3",
    head: "the string field becomes a Choice",
    body: "options = the surviving candidates that validate against the field's schema, sliced to 255 — or 254, because an optional field spends one slot on “Omit this optional argument”",
    note: "required fields with no representable candidate throw; optional ones are dropped and audited as argument_omitted",
  },
  {
    n: "4",
    head: "the final answer becomes eight Choices",
    body: "slot 1 of 8 … slot 8 of 8, each over the same candidate list plus “Stop selecting answer evidence”, deduplicated, joined with “; ” and truncated at 3,900 characters",
    note: "a sentence is not composed; it is concatenated out of spans that already existed somewhere",
  },
]

export function SpanLadder() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        generation, rebuilt out of choices · decision-spans.mjs
      </div>
      <ol className="divide-y">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3 px-3 py-3">
            <span className="mt-[2px] font-mono text-[11px] text-muted-foreground">
              {s.n}
            </span>
            <div className="min-w-0 space-y-1.5">
              <p className="font-mono text-[11px] text-foreground">{s.head}</p>
              <p
                className={`text-[12px] leading-5 ${
                  s.mono
                    ? "rounded-sm border bg-muted/40 px-2 py-1 font-mono text-[11px]"
                    : "text-muted-foreground"
                }`}
              >
                {s.body}
              </p>
              <p className="font-mono text-[10.5px] leading-4 text-muted-foreground/80">
                {s.note}
              </p>
            </div>
          </li>
        ))}
      </ol>
      <div className="border-t bg-muted/30 px-3 py-3">
        <p className="font-mono text-[11px] text-muted-foreground">
          and then the comment in the source, where the ladder stops
        </p>
        <p className="mt-1 font-mono text-[12px] leading-5 text-foreground">
          &quot;contiguous spans up to six words, not linguistic phrase extraction. Longer
          newly composed strings require the hybrid filler.&quot;
        </p>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The candidate count is measured by reimplementing their{" "}
        <code className="font-mono">collectCandidates</code> over this prompt alone. Every
        other number and quotation is read out of the file.
      </figcaption>
    </figure>
  )
}
