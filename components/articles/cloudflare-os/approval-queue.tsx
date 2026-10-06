"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// An approval-queue simulator for one Cloudflare OS agent turn. The agent's
// executeCode run makes ten calls against the bindings it was introduced to;
// each one is classified the way the repo's gatekeepers classify it:
//
//   read     -> runs now, recorded as an observation (state "approved")
//   action   -> queued as "pending"; the gatekeeper simulates it and the turn
//               keeps going (GitHub returns a provisional issue "~1")
//   await    -> queued as "pending" with awaitDecision; nothing is simulated,
//               so the turn suspends until a human decides (MCP tool calls)
//   no-net   -> the isolate was loaded with globalOutbound: null
//   no-cap   -> the binding was never introduced, so env has no such name
//
// The reader then approves or rejects the queue later, in a batch. Rejecting
// the provisional issue strands the comment that depends on it, as both the
// GitHub gatekeeper and gatekeeper-kit's action set do. Auto-approval follows
// autoApprovalRule() in workshop-backend/src/auto-approval.ts: the author
// marked the action autoApprovable, the user enabled a rule for its kind, and
// the workspace has not latched restricted data.
//
// Pure function of the controls: no randomness, no timers, nothing from
// Math.* reaches the DOM.

type Kind = "read" | "action" | "await" | "no-net" | "no-cap"

type Call = {
  code: string
  binding: string
  kind: Kind
  title: string
  result: string
  dependsOn?: number // log id of the action this one needs
  autoKind?: string // actionKind tag, when the author marked it autoApprovable
}

const CALLS: Call[] = [
  {
    code: 'await env.REPO.listIssues({ state: "open" })',
    binding: "REPO",
    kind: "read",
    title: "List open issues",
    result: "cursor: #38, #40, #41",
  },
  {
    code: 'await (await env.REPO.getIssue("41")).getDetails()',
    binding: "REPO",
    kind: "read",
    title: "Read issue #41",
    result: "{ title: \"Deploy fails on staging\", body: … }",
  },
  {
    code: 'const issue = await env.REPO.createIssue({ title: "Flaky deploy" })',
    binding: "REPO",
    kind: "action",
    title: "Create issue Flaky deploy",
    result: 'GitHubIssue with provisional id "~1" (simulated)',
  },
  {
    code: 'await issue.postComment("Repro: run deploy twice")',
    binding: "REPO",
    kind: "action",
    title: "Comment on issue ~1",
    result: "resolved (simulated)",
    dependsOn: 3,
  },
  {
    code: 'await env.REPO.listIssues({ state: "open" })',
    binding: "REPO",
    kind: "read",
    title: "List open issues",
    result: "cursor: ~1, #38, #40, #41 (~1 injected by the simulation)",
  },
  {
    code: "await env.PLAN.getContent()",
    binding: "PLAN",
    kind: "read",
    title: "Read Google Doc Q3 plan",
    result: "\"## Q3 plan …\"",
  },
  {
    code: 'await env.PLAN.replaceText("Q3", "Q4")',
    binding: "PLAN",
    kind: "action",
    title: "Edit Google Doc",
    result: "resolved (simulated)",
    autoKind: "editDocument",
  },
  {
    code: 'await fetch("https://api.example.com/upload", { method: "POST" })',
    binding: "",
    kind: "no-net",
    title: "",
    result: "throws: this isolate has no outbound network",
  },
  {
    code: 'await env.CHAT.postMessage("done")',
    binding: "CHAT",
    kind: "no-cap",
    title: "",
    result: "TypeError: env.CHAT is undefined (never introduced)",
  },
  {
    code: 'await env.TRACKER.callTool("update_status", { id: 7 })',
    binding: "TRACKER",
    kind: "await",
    title: "MCP tool update_status",
    result: '{ status: "pending" }: turn suspended until you decide',
  },
]

type Decision = "approved" | "rejected"

type Row = {
  id: number
  call: Call
  type: "observation" | "action"
  state: "approved" | "pending" | "rejected" | "stranded"
  auto: boolean
  restricted: boolean
}

function buildLog(
  ran: number,
  rule: boolean,
  restrictedDoc: boolean,
  decisions: Record<number, Decision>
): { rows: Row[]; latched: boolean } {
  const rows: Row[] = []
  let nextId = 1
  let latched = false
  for (const call of CALLS.slice(0, ran)) {
    if (call.kind === "no-net" || call.kind === "no-cap") continue
    const id = nextId++
    if (call.kind === "read") {
      const restricted = restrictedDoc && call.binding === "PLAN"
      if (restricted) latched = true
      rows.push({ id, call, type: "observation", state: "approved", auto: false, restricted })
      continue
    }
    // autoApprovalRule(): author flag && user rule && no restricted latch
    const auto = call.autoKind !== undefined && rule && !latched
    let state: Row["state"] = auto ? "approved" : (decisions[id] ?? "pending")
    if (call.dependsOn !== undefined && decisions[call.dependsOn] === "rejected") state = "stranded"
    rows.push({ id, call, type: "action", state, auto, restricted: false })
  }
  return { rows, latched }
}

const STATE_STYLE: Record<Row["state"], string> = {
  approved: "border-emerald-600/60 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  pending: "border-amber-500/60 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  rejected: "border-red-600/60 bg-red-600/10 text-red-700 dark:text-red-400",
  stranded: "border-red-600/40 bg-red-600/5 text-red-700/80 dark:text-red-400/80",
}

const KIND_LABEL: Record<Kind, string> = {
  read: "read: observation",
  action: "write: queued, simulated",
  await: "write: queued, turn waits",
  "no-net": "denied: no egress",
  "no-cap": "denied: no capability",
}

function Toggle({
  checked,
  disabled,
  onChange,
  children,
}: {
  checked: boolean
  disabled: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className={cn("flex items-start gap-2 text-xs", disabled && "opacity-60")}>
      <input
        type="checkbox"
        className="mt-0.5"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{children}</span>
    </label>
  )
}

export function ApprovalQueue() {
  const [ran, setRan] = useState(0)
  const [rule, setRule] = useState(true)
  const [restrictedDoc, setRestrictedDoc] = useState(false)
  const [decisions, setDecisions] = useState<Record<number, Decision>>({})
  const [selected, setSelected] = useState<Record<number, boolean>>({})

  const { rows, latched } = buildLog(ran, rule, restrictedDoc, decisions)
  const pending = rows.filter((r) => r.state === "pending")
  const awaitRow = rows.find((r) => r.call.kind === "await")
  const suspended = awaitRow !== undefined && awaitRow.state === "pending"
  const resumed = awaitRow !== undefined && awaitRow.state !== "pending"
  const done = ran >= CALLS.length

  const decide = (ids: number[], d: Decision) => {
    if (ids.length === 0) return
    setDecisions((prev) => {
      const next = { ...prev }
      for (const id of ids) next[id] = d
      return next
    })
    setSelected({})
  }
  const chosen = pending.filter((r) => selected[r.id]).map((r) => r.id)

  const reset = () => {
    setRan(0)
    setDecisions({})
    setSelected({})
  }

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setRan((n) => Math.min(CALLS.length, n + 1))}
          disabled={done || suspended}
          className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
        >
          next call
        </button>
        <button
          type="button"
          onClick={() => setRan(CALLS.length)}
          disabled={done || suspended}
          className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
        >
          run the turn
        </button>
        <button
          type="button"
          onClick={reset}
          className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs"
        >
          reset
        </button>
        <span className="text-muted-foreground font-mono text-xs">
          {ran}/{CALLS.length} calls{ran > 0 ? " · reset to change the settings" : ""}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Toggle checked={rule} disabled={ran > 0} onChange={setRule}>
          You enabled an auto-approve rule for <code>editDocument</code> on this doc
        </Toggle>
        <Toggle checked={restrictedDoc} disabled={ran > 0} onChange={setRestrictedDoc}>
          The doc read is flagged <code>containsRestrictedData</code>
        </Toggle>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="min-w-0">
          <div className="text-muted-foreground mb-1.5 text-xs">what the agent&apos;s code sees</div>
          <ol className="space-y-1.5">
            {CALLS.slice(0, ran).map((c, i) => (
              <li key={i} className="bg-muted rounded-md px-2.5 py-1.5">
                <div className="font-mono text-[11px] break-words">{c.code}</div>
                <div className="mt-0.5 flex flex-wrap items-baseline gap-x-2 text-[11px]">
                  <span
                    className={cn(
                      "font-semibold",
                      c.kind === "read" && "text-emerald-700 dark:text-emerald-400",
                      (c.kind === "action" || c.kind === "await") && "text-amber-700 dark:text-amber-400",
                      (c.kind === "no-net" || c.kind === "no-cap") && "text-red-700 dark:text-red-400"
                    )}
                  >
                    {KIND_LABEL[c.kind]}
                  </span>
                  <span className="text-muted-foreground font-mono break-words">→ {c.result}</span>
                </div>
              </li>
            ))}
            {ran === 0 ? (
              <li className="text-muted-foreground text-xs">Press “next call” to start the agent&apos;s turn.</li>
            ) : null}
            {suspended ? (
              <li className="rounded-md border-l-4 border-amber-500 bg-amber-500/10 px-2.5 py-1.5 text-xs">
                Turn suspended: the MCP gatekeeper cannot simulate a tool call, so it set <code>awaitDecision</code>.
                Decide action #{awaitRow?.id} to resume.
              </li>
            ) : null}
            {resumed ? (
              <li className="rounded-md border-l-4 border-emerald-600 bg-emerald-600/10 px-2.5 py-1.5 text-xs">
                Turn resumed: action #{awaitRow?.id} was {awaitRow?.state}.
              </li>
            ) : null}
          </ol>
        </div>

        <div className="min-w-0">
          <div className="text-muted-foreground mb-1.5 text-xs">
            the workspace&apos;s action log{latched ? " (restricted-data latch set: nothing auto-approves)" : ""}
          </div>
          <ul className="space-y-1.5">
            {rows.map((r) => (
              <li key={r.id} className={cn("rounded-md border px-2.5 py-1.5 text-xs", STATE_STYLE[r.state])}>
                <div className="flex items-baseline gap-2">
                  {r.state === "pending" ? (
                    <input
                      type="checkbox"
                      aria-label={`select action ${r.id}`}
                      checked={selected[r.id] ?? false}
                      onChange={(e) => setSelected((s) => ({ ...s, [r.id]: e.target.checked }))}
                    />
                  ) : null}
                  <span className="font-mono">#{r.id}</span>
                  <span className="font-mono">{r.type}</span>
                  <span className="text-foreground min-w-0 flex-1 break-words">{r.call.title}</span>
                  <span className="font-mono font-semibold">
                    {r.state}
                    {r.auto ? " (auto)" : ""}
                  </span>
                </div>
                {r.restricted ? (
                  <div className="mt-0.5 font-mono text-[11px]">containsRestrictedData: true</div>
                ) : null}
                {r.state === "stranded" ? (
                  <div className="mt-0.5 text-[11px]">
                    This action needed action {r.call.dependsOn}, which did not complete.
                  </div>
                ) : null}
              </li>
            ))}
            {rows.length === 0 ? <li className="text-muted-foreground text-xs">Nothing logged yet.</li> : null}
          </ul>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => decide(chosen, "approved")}
              disabled={chosen.length === 0}
              className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
            >
              approve selected
            </button>
            <button
              type="button"
              onClick={() => decide(chosen, "rejected")}
              disabled={chosen.length === 0}
              className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
            >
              reject selected
            </button>
            <button
              type="button"
              onClick={() =>
                decide(
                  pending.map((r) => r.id),
                  "approved"
                )
              }
              disabled={pending.length === 0}
              className="border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs disabled:opacity-40"
            >
              approve all {pending.length > 0 ? `(${pending.length})` : ""}
            </button>
          </div>
        </div>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        Reasoned from the repo at commit b304e8c, not a run of it. The GitHub calls, the provisional id{" "}
        <code>~1</code>, the <code>editDocument</code> kind, the MCP gatekeeper waiting on its tool calls, the{" "}
        <code>globalOutbound: null</code> isolate and the three-part auto-approval test follow the code; the issue
        titles, the binding names <code>PLAN</code>, <code>CHAT</code> and <code>TRACKER</code>, and the doc text are
        made up. Reject #3 and watch #4 strand.
      </figcaption>
    </figure>
  )
}
