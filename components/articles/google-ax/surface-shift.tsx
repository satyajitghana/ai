// The "not a framework" test, applied to both versions of google/ax: what does
// your code have to import, and what interface does it have to implement?
//
// v0.2.3 (commit b777313): you implement proto HarnessService and speak AX's own
// Step/Content messages. v0.3.0 (d8ed0fe): you ship a container image with a
// runner at a fixed path, and your agent is an opaque argv.
//
// Server-rendered, zero JS, no SVG — this one is a contract sheet, and the
// contrast is in the text.

type Row = { demand: string; detail: string }

const BEFORE: Row[] = [
  {
    demand: "implement proto HarnessService",
    detail:
      "one bidi RPC, Connect(stream HarnessRequest) returns (stream HarnessResponse)",
  },
  {
    demand: "speak ax's message types",
    detail:
      "Step, ContentStep, ThoughtStep, ToolCallStep, FunctionResultStep — 236 lines of proto",
  },
  {
    demand: "adopt its turn shape",
    detail:
      "exactly one start frame in, zero or more outputs frames out, exactly one terminal end",
  },
  {
    demand: "give up mid-turn steering",
    detail:
      "the request oneof is {start, cancel}; there is no wire frame for input after start",
  },
  {
    demand: "hold conversation state yourself",
    detail:
      "keyed by the conversation id ax hands you, last-write-wins, no CAS — because single writer",
  },
]

const AFTER: Row[] = [
  {
    demand: "put a runner at a fixed path",
    detail:
      "/usr/local/bin/ax-task-runner in your image, even if it is a shell wrapper",
  },
  {
    demand: "serve two HTTP paths on :80",
    detail: "/healthz always 200; /readyz 503 until the workspace is prepared",
  },
  {
    demand: "read two environment variables",
    detail: "AX_TASK_YAML and AX_WORKSPACES_YAML, then start spec.command yourself",
  },
  {
    demand: "stay up as PID 1",
    detail:
      "outlive the command so ax ssh keeps working; forward SIGTERM to its process group",
  },
  {
    demand: "nothing about the agent",
    detail:
      "spec.command is opaque argv; your agent imports no ax package and knows no ax type",
  },
]

function Column({
  tag,
  version,
  verdict,
  verdictTone,
  rows,
}: {
  tag: string
  version: string
  verdict: string
  verdictTone: string
  rows: Row[]
}) {
  return (
    <div className="min-w-0 flex-1 p-4">
      <div className="font-mono text-xs text-muted-foreground">{tag}</div>
      <div className="font-mono text-sm text-foreground">{version}</div>
      <div className="mt-1 font-mono text-xs" style={{ color: verdictTone }}>
        {verdict}
      </div>
      <ul className="mt-3 list-none space-y-3 pl-0">
        {rows.map((r) => (
          <li key={r.demand} className="border-l-2 border-border pl-3">
            <div className="font-mono text-xs text-foreground">{r.demand}</div>
            <div className="mt-0.5 font-mono text-[11px] leading-snug text-muted-foreground">
              {r.detail}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SurfaceShift() {
  return (
    <figure className="my-8 rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the honest test of &quot;not a framework&quot; — what it makes your code do
      </div>
      <div className="flex flex-col divide-y divide-border sm:flex-row sm:divide-x sm:divide-y-0">
        <Column
          tag="before the restructure"
          version="v0.2.3 · b777313 · 19 Aug 2026"
          verdict="framework — your agent is restructured around its abstractions"
          verdictTone="oklch(0.58 0.19 27)"
          rows={BEFORE}
        />
        <Column
          tag="after the restructure"
          version="v0.3.0 · d8ed0fe · 19 Sep 2026"
          verdict="orchestrator — an existing harness runs unmodified in a container"
          verdictTone="oklch(0.55 0.16 155)"
          rows={AFTER}
        />
      </div>
      <div className="border-t px-4 py-3 font-mono text-[11px] leading-snug text-muted-foreground">
        What neither version demands: a model SDK, a tool schema, a prompt format,
        a language. What v0.3.0 declares but does not deliver: MCP servers and
        skill registries are fields in the Workspace proto with a round-trip test
        and no client — the default runner materializes a skills directory with{" "}
        <code className="font-mono">os.MkdirAll</code> and writes no MCP config at
        all.
      </div>
    </figure>
  )
}
