// Every tool name OpenMuse defines, and where each one is attached.
//
// Counted by reading the three files that call defineTool():
//   apps/server/src/computer-tools.ts  10 tools, shared by both agents
//   apps/server/src/engine/conversation.ts  +8, chat only
//   apps/server/src/engine/model.ts  +12, durable task worker only
// read_mail_thread is defined in both of the latter two with different bodies
// (the chat one truncates to 20 messages and 12,000 characters per body; the
// task one appends every message to task.evidence), so the distinct-name count
// is 8 + 10 + 11 = 29 across 40 registrations.
//
// The `card` column is not a guess: apps/mobile/src/chat.tsx calls
// useRenderTool() eight times, keyed on the exact server tool name, and nothing
// else in the client matches a tool name. The ten computer tools and every task
// tool fall through to CopilotKit's default rendering.
//
// The point of the table: none of these 29 names exist on the other side of
// AGENT_BACKEND=agui, and the eight that the UI draws are matched by string.
//
// Server-rendered, zero JS.

type Tool = {
  name: string
  note: string
  card?: string
}

type Group = {
  title: string
  where: string
  tint: string
  tools: Tool[]
}

const GROUPS: Group[] = [
  {
    title: "app tools — chat agent only",
    where: "engine/conversation.ts",
    tint: "oklch(0.58 0.15 152)",
    tools: [
      { name: "search_mail", note: "≤20 summaries, 240-char snippets", card: "email card" },
      { name: "read_mail_thread", note: "≤20 messages, 12,000 chars each", card: "email card" },
      { name: "browse_web", note: "≤30,000 chars of page text", card: "browser card" },
      { name: "delegate_task", note: "creates a durable job", card: "Task" },
      { name: "agent_status", note: "reads tasks, goals, ideas", card: "Agent progress" },
      { name: "create_goal", note: "goal + milestones", card: "Goal" },
      { name: "watch_page", note: "recurring public-page check", card: "Tracking" },
      { name: "remember_fact", note: "one memory row", card: "Memory" },
    ],
  },
  {
    title: "computer tools — both agents",
    where: "computer-tools.ts",
    tint: "oklch(0.62 0.15 85)",
    tools: [
      { name: "computer_status", note: "container state + receipts" },
      { name: "start_computer", note: "docker container create/start" },
      { name: "stop_computer", note: "keeps the /workspace volume" },
      { name: "run_computer_command", note: "bash -c, 30 s, no network" },
      { name: "list_computer_files", note: "inside /workspace" },
      { name: "read_computer_file", note: "UTF-8, ≤256 KB" },
      { name: "write_computer_file", note: "UTF-8, ≤256 KB, atomic" },
      { name: "mkdir_computer", note: "inside /workspace" },
      { name: "import_computer_pdf", note: "app PDF in, ≤10 MB" },
      { name: "export_computer_pdf", note: "workspace PDF out" },
    ],
  },
  {
    title: "task tools — durable worker only",
    where: "engine/model.ts",
    tint: "oklch(0.55 0.14 250)",
    tools: [
      { name: "set_plan", note: "1–12 steps, checkpointed" },
      { name: "read_workspace", note: "mail / calendar / files" },
      { name: "import_pdf", note: "from an email attachment" },
      { name: "inspect_pdf", note: "AcroForm fields" },
      { name: "fill_pdf", note: "writes a new PDF" },
      { name: "read_web", note: "public pages via the worker" },
      { name: "save_artifact", note: "plan / comparison / report" },
      { name: "prepare_email", note: "proposal only — then pause" },
      { name: "prepare_event", note: "proposal only — then pause" },
      { name: "ask_user", note: "pause for a missing fact" },
      { name: "finish_task", note: "the only success exit" },
    ],
  },
]

const TOTAL = GROUPS.reduce((n, g) => n + g.tools.length, 0)
const CARDS = GROUPS.reduce((n, g) => n + g.tools.filter((t) => t.card).length, 0)

export function ToolLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-foreground">
          {TOTAL} distinct tool names, 40 registrations
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          {CARDS} drawn by the client · 0 survive an agent swap
        </span>
      </div>

      <div className="grid gap-px bg-border md:grid-cols-3">
        {GROUPS.map((group) => (
          <div key={group.title} className="bg-background p-3 sm:p-4">
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: group.tint }}
              />
              <span className="text-xs font-medium text-foreground">{group.title}</span>
            </div>
            <div className="mt-0.5 pl-[18px] font-mono text-[10px] text-muted-foreground">
              {group.where} · {group.tools.length}
            </div>

            <ul className="mt-3 list-none space-y-2 pl-0">
              {group.tools.map((tool) => (
                <li key={tool.name} className="border-l-2 pl-2.5" style={{ borderColor: group.tint }}>
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-mono text-[11px] text-foreground">{tool.name}</span>
                    {tool.card ? (
                      <span className="rounded border px-1 font-mono text-[9px] text-muted-foreground">
                        {tool.card}
                      </span>
                    ) : null}
                  </div>
                  <div className="text-[11px] leading-4 text-muted-foreground">{tool.note}</div>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Nothing in this table dispatches an external write.{" "}
        <span className="font-mono">prepare_email</span> and{" "}
        <span className="font-mono">prepare_event</span> build a proposal, set the task to{" "}
        <span className="font-mono">waiting_approval</span>{" "}
        and stop; the send happens later, from an authenticated app request. The system prompt
        says so out loud —{" "}
        <em>&ldquo;External writes require prepare_email/prepare_event; there is no tool to
        approve them&rdquo;</em> — and the code agrees: the only caller of{" "}
        <span className="font-mono">ActionService.decide</span> with{" "}
        <span className="font-mono">&quot;approve&quot;</span> is the route handler for{" "}
        <span className="font-mono">POST /api/actions/:id/decide</span>.
      </p>
    </figure>
  )
}
