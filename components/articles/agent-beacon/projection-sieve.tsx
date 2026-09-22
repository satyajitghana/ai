// What Beacon knows about an event, and what it shows the model.
//
// Left column: the fields of asymptoteobserve.TraceEventV1, the normalized event
// every adapter in the repository produces (pkg/asymptoteobserve/trace.go).
// Right column: the fields of learning.ProjectedEvent, which is what
// BuildProjection puts on the wire (cli/beacon/internal/learning/evaluator.go).
// Both read at commit 63d43f4.
//
// TraceEventV1 has 21 top-level fields; the list below expands the structured
// ones (command, file, mcp, approval, usage) to the sub-fields that carry the
// evidence, and drops SourceEventID because it duplicates ID. Six survive, and
// Content is not even the event's content for a
// command: eventContent() only fills Content.Text for prompts and agent
// messages, so for a command.executed event the projection falls back to
//
//   if event.Command != nil && projected.Content == "" {
//       projected.Content = cleanText(event.Command.Command)
//   }
//
// the command string. Not its output, and not its exit code.
//
// The four rows marked below are the ones the rubric asks about. exit_code
// answers "did the task succeed" exactly. actor answers "was there a human
// correction" exactly. approval.decision is the only human choice in the trace.
// fidelity says whether the action was observed or guessed by a regex. All four
// are dropped before the question is asked.
//
// Server-rendered, zero JS.

const DROP = "oklch(0.58 0.19 27)"
const KEEP = "oklch(0.58 0.15 152)"

type Field = {
  name: string
  kept?: boolean
  why?: string
}

const FIELDS: Field[] = [
  { name: "number", kept: true },
  { name: "type", kept: true },
  { name: "action", kept: true },
  { name: "title", kept: true },
  { name: "summary", kept: true },
  { name: "content.text", kept: true },
  { name: "id" },
  { name: "timestamp" },
  { name: "category" },
  { name: "fidelity", why: "observed, or inferred by a pattern match" },
  { name: "actor", why: "user or agent — the correction signal" },
  { name: "trace.span_id" },
  { name: "tool_call_id" },
  { name: "tool.{name,args,result}" },
  { name: "command.exit_code", why: "did the test pass" },
  { name: "command.output" },
  { name: "command.duration_ms" },
  { name: "file.{path,operation,diff}" },
  { name: "mcp.{server,tool,method}" },
  { name: "approval.decision", why: "the only human decision in the trace" },
  { name: "model" },
  { name: "usage.{tokens,cost_usd}" },
]

const kept = FIELDS.filter((f) => f.kept)
const dropped = FIELDS.filter((f) => !f.kept)
const loadBearing = dropped.filter((f) => f.why)

export function ProjectionSieve() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        TraceEventV1 → learning.ProjectedEvent —{" "}
        <span className="text-foreground">
          {kept.length} of {FIELDS.length} fields on the wire, 80 events of any length
        </span>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-2">
        <div className="bg-background px-3 py-3">
          <p className="mt-0 mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            what every adapter produces
          </p>
          <ul className="my-0 list-none space-y-1 pl-0">
            {FIELDS.map((f) => (
              <li
                key={f.name}
                className="flex flex-wrap items-baseline gap-x-2 font-mono text-[11px] leading-5"
              >
                <span className={f.kept ? "text-foreground" : "text-muted-foreground"}>
                  {f.name}
                </span>
                {f.why ? (
                  <span
                    className="font-sans text-[10px]"
                    style={{ color: DROP }}
                  >
                    {f.why}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-background px-3 py-3">
          <p className="mt-0 mb-2 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">
            what the model is shown
          </p>
          <ul className="my-0 list-none space-y-1 pl-0">
            {kept.map((f) => (
              <li key={f.name} className="font-mono text-[11px] leading-5">
                <span style={{ color: KEEP }}>{f.name}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-0 text-xs leading-5 text-muted-foreground">
            Strings only, each truncated to 1,200 characters and passed through the secret
            redactor. For a <span className="font-mono">command.executed</span> event,{" "}
            <span className="font-mono">content.text</span> is the command line — Beacon never
            fills it with the command&apos;s output, so the projection falls back to the command
            itself.
          </p>
          <p className="mt-2 mb-0 text-xs leading-5" style={{ color: DROP }}>
            {dropped.length} fields dropped, {loadBearing.length} of them the ones the rubric is
            asking about.
          </p>
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The first rubric question is{" "}
        <span className="italic">did the trace complete the task successfully</span>. Beacon
        recorded the exit code of every command in the run and does not send it. The second is{" "}
        <span className="italic">does it contain a correction</span>. Beacon recorded who spoke
        and does not send that either. Both questions have exact answers sitting in the same
        struct, one field away from the projection that replaces them with a guess.
      </p>
    </figure>
  )
}
