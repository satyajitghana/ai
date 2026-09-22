// The whole of "compatible with any agent harness", drawn to scale.
//
// apps/server/src/agent.ts is 64 lines. Its AgentsFactory returns exactly one
// agent under the key `default`, chosen by a two-level ternary on
// config.agentBackend:
//
//   sample -> new ConversationAgent(config, service, owner)   // scripted
//   agui   -> new HttpAgent({ url: config.agentUrl, headers })
//   model  -> new ConversationAgent(config, service, owner)   // BuiltInAgent
//
// ConversationAgent (apps/server/src/engine/conversation.ts, 283 lines) is where
// the tools live: it constructs a BuiltInAgent with 18 defineTool() entries and
// a ~2,000-character system prompt, then subscribes to it. HttpAgent
// (@ag-ui/client 0.0.59) is a POST and an SSE reader — its entire run() is
// `this.fetch(this.url, this.requestInit(input))`.
//
// So the seam is real and it is total. Everything attached to the agent is
// attached *inside* the branch that the agui backend replaces, which is why the
// column widths below are the honest picture: the protocol carries messages and
// events, and nothing else crosses.
//
// Server-rendered, zero JS.

type Lane = {
  key: string
  backend: string
  ctor: string
  file: string
  carries: string[]
  missing: string[]
  tint: string
}

const LANES: Lane[] = [
  {
    key: "sample",
    backend: "AGENT_BACKEND=sample",
    ctor: "ConversationAgent",
    file: "engine/conversation.ts",
    carries: [
      "3 regexes over the prompt, then a fallback",
      "writes a task, streams one delegate_task tool call",
    ],
    missing: ["any model call", "use in live mode — config throws"],
    tint: "oklch(0.62 0.15 85)",
  },
  {
    key: "model",
    backend: "AGENT_BACKEND=model",
    ctor: "ConversationAgent → BuiltInAgent",
    file: "engine/conversation.ts",
    carries: [
      "18 server tools (8 app + 10 computer)",
      "2,722-character system prompt",
      "maxSteps 6, maxRetries 0",
      "client tool list filtered to one name",
    ],
    missing: [],
    tint: "oklch(0.58 0.15 152)",
  },
  {
    key: "agui",
    backend: "AGENT_BACKEND=agui",
    ctor: "HttpAgent",
    file: "@ag-ui/client",
    carries: ["POST RunAgentInput", "read back text/event-stream"],
    missing: [
      "all 18 server tools",
      "the system prompt",
      "the step and retry budget",
      "any tool name the UI can draw",
    ],
    tint: "oklch(0.55 0.14 250)",
  },
]

export function HarnessSeam() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">apps/server/src/agent.ts</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          one AgentsFactory · one key · three constructors
        </span>
      </div>

      <div className="border-b px-4 py-1.5 font-mono text-[10px] text-muted-foreground">
        <span className="text-foreground">+</span> what that constructor brings ·{" "}
        <span className="text-destructive">&minus;</span> what it does not
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        {LANES.map((lane) => (
          <div key={lane.key} className="bg-background p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: lane.tint }}
              />
              <span className="font-mono text-[11px] text-foreground">{lane.backend}</span>
            </div>

            <div className="mt-2 rounded-md border px-2.5 py-2">
              <div className="font-mono text-xs text-foreground">{lane.ctor}</div>
              <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">{lane.file}</div>
            </div>

            <ul className="mt-3 list-none space-y-1.5 pl-0 text-xs text-muted-foreground">
              {lane.carries.map((item) => (
                <li key={item} className="flex gap-2">
                  <span
                    aria-hidden
                    className="mt-[2px] font-mono text-[10px]"
                    style={{ color: lane.tint }}
                  >
                    +
                  </span>
                  <span>{item}</span>
                </li>
              ))}
              {lane.missing.map((item) => (
                <li key={item} className="flex gap-2">
                  <span aria-hidden className="mt-[2px] font-mono text-[10px] text-destructive">
                    &minus;
                  </span>
                  <span className="opacity-70">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The three constructors are interchangeable because they all satisfy AG-UI&apos;s{" "}
        <span className="font-mono">AbstractAgent</span>: one method,{" "}
        <span className="font-mono">run(input): Observable&lt;BaseEvent&gt;</span>. That is the
        entire portability story, and it is a good one. But the tools are arguments to{" "}
        <span className="font-mono">BuiltInAgent</span> inside{" "}
        <span className="font-mono">ConversationAgent</span>, not registrations on the runtime, so
        they are on the replaced side of the seam. Point{" "}
        <span className="font-mono">AGENT_URL</span>{" "}
        at your own harness and OpenMuse hands it a conversation and takes back a stream of
        events — which is exactly what the protocol promises, and less than the README&apos;s
        sentence suggests.
      </p>
    </figure>
  )
}
