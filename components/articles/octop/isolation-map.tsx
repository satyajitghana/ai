"use client"

import { useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

// An isolation map for one Octop deployment, built from the code at commit
// 4b17f1c (Octop) and 14a1cd9 (octop-harness). Alice owns an agent called
// "planner". Bob is a second account on the same deployment. For each thing
// that belongs to Alice's agent, or that her agent uses, the map answers two
// questions:
//
//   API    can Bob see it through Octop's own HTTP / WebSocket routes?
//          (JWT -> users row -> agents.user_id row check; admin bypasses)
//   shell  can a shell Bob controls reach it on disk?
//          (his agent's execute tool under the chosen backend, or the
//           dashboard Terminal, which is a host PTY whatever the backend)
//
// The answers are a pure function of the toggles. Nothing is random, nothing
// from Math.* reaches the DOM.

type Backend = "host" | "jail" | "docker"
type Level = "no" | "partial" | "yes" | "na"

type Cell = { level: Level; why: string }

type Ctx = {
  admin: boolean
  terminal: boolean
  desktop: boolean
  shared: boolean
  backend: Backend
}

type Resource = {
  name: string
  scope: "per agent" | "per user" | "deployment" | "host"
  where: string
  api: (c: Ctx) => Cell
  shell: (shell: Backend) => Cell
}

const hostReads = (what: string): Cell => ({
  level: "yes",
  why: `same OS user as the server, and ${what} is a file under ~/.octop (host_dirs.py:87-89)`,
})
const jailed: Cell = {
  level: "no",
  why: "bwrap binds Bob's own root_dir at / ; ~/.octop is not inside it (bwrap_shell.py:96-106)",
}
const boxed: Cell = {
  level: "no",
  why: "his agent runs in its own container with no host mounts unless configured (docker_sandbox.py:454-484)",
}

const byShell = (host: Cell) => (s: Backend): Cell =>
  s === "host" ? host : s === "jail" ? jailed : boxed

const RESOURCES: Resource[] = [
  {
    name: "Chat threads",
    scope: "per user",
    where: "threads table, key agent:dashboard:<user_id>:dm",
    api: (c) =>
      c.admin
        ? { level: "yes", why: "admin bypasses the owner check and may act as_user (agent.py:51-58)" }
        : c.shared
          ? { level: "no", why: "he can chat with the shared agent, but the thread key carries his own user id" }
          : { level: "no", why: "row check: agents.user_id must equal his id (agent.py:26-31)" },
    shell: byShell(hostReads("the SQLite control-plane database")),
  },
  {
    name: "Workspace files",
    scope: "per agent",
    where: "~/.octop/agents/<agent_id>/",
    api: (c) =>
      c.admin
        ? { level: "yes", why: "admin bypass on every row check (agent.py:20-21)" }
        : c.shared
          ? { level: "yes", why: "read routes accept a shared agent (workspace.py:166); writes stay owner-only" }
          : { level: "no", why: "row check: agents.user_id must equal his id (agent.py:26-31)" },
    shell: byShell(hostReads("her workspace")),
  },
  {
    name: "Memory",
    scope: "per agent",
    where: "namespace agent_<agent_id>; memory.sqlite in the workspace",
    api: (c) =>
      c.admin
        ? { level: "yes", why: "admin bypass on every row check (agent.py:20-21)" }
        : c.shared
          ? {
              level: "partial",
              why: "his chats with the shared agent recall and write its memory, keyed by agent, not by user (backend.py:76)",
            }
          : { level: "no", why: "row check: agents.user_id must equal his id (agent.py:26-31)" },
    shell: byShell(hostReads("memory.sqlite")),
  },
  {
    name: "Browser profile",
    scope: "per user",
    where: "profile user-<user_id>, shared by all her agents",
    api: () => ({ level: "no", why: "the profile name is derived from the caller's id (browser_media.py:34-41)" }),
    shell: byShell(hostReads("~/.octop/browser-profiles")),
  },
  {
    name: "Coding-agent runners",
    scope: "per user",
    where: "settings key acp_runners:user:<id>",
    api: () => ({ level: "no", why: "runner cards are stored per user (settings/acp.py:16)" }),
    shell: byShell(hostReads("the settings table")),
  },
  {
    name: "Model provider keys",
    scope: "deployment",
    where: "providers table, no user_id column",
    api: () => ({
      level: "yes",
      why: "one table for everyone; the list route open to any signed-in user returns rows as stored (providers.py:189-195)",
    }),
    shell: byShell(hostReads("the providers table")),
  },
  {
    name: "Plugins",
    scope: "deployment",
    where: "~/.octop/plugins, loaded into the server process",
    api: () => ({ level: "yes", why: "loaded once for the whole process; installing needs the plugins permission" }),
    shell: byShell(hostReads("~/.octop/plugins")),
  },
  {
    name: "Remote desktop",
    scope: "host",
    where: "one display: Xvnc :99 or the real screen",
    api: (c) =>
      c.desktop || c.admin
        ? { level: "yes", why: "one host screen for every account with the desktop permission (stream.py:288)" }
        : { level: "no", why: "the desktop permission is not granted to new users (permissions.py)" },
    shell: () => ({ level: "na", why: "not a file; the screen is reached through the desktop stream" }),
  },
]

const LEVEL_LABEL: Record<Level, string> = { no: "no", partial: "partly", yes: "yes", na: "n/a" }
const LEVEL_STYLE: Record<Level, string> = {
  no: "text-emerald-700 dark:text-emerald-400",
  partial: "text-amber-700 dark:text-amber-400",
  yes: "text-red-700 dark:text-red-400",
  na: "text-muted-foreground",
}

const SCOPE_STYLE: Record<Resource["scope"], string> = {
  "per agent": "border-emerald-600/40",
  "per user": "border-sky-600/40",
  deployment: "border-amber-600/50",
  host: "border-red-600/40",
}

const BACKENDS: { id: Backend; label: string; note: string }[] = [
  { id: "host", label: "default: local_shell, root /", note: "what an agent gets when nobody sets a policy" },
  { id: "jail", label: "policy root_dir + bubblewrap", note: "admin sets workspace_root_dir for Bob; Linux only" },
  { id: "docker", label: "docker, sandbox_scope agent", note: "one container per agent, network off by default" },
]

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="bg-muted flex cursor-pointer items-start gap-2 rounded-md px-2.5 py-1.5 text-xs">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

function Verdict({ cell }: { cell: Cell }) {
  return (
    <div className="min-w-0">
      <span className={cn("font-mono font-semibold", LEVEL_STYLE[cell.level])}>{LEVEL_LABEL[cell.level]}</span>
      <span className="text-muted-foreground"> · {cell.why}</span>
    </div>
  )
}

export function IsolationMap() {
  const [admin, setAdmin] = useState(false)
  const [terminal, setTerminal] = useState(false)
  const [desktop, setDesktop] = useState(false)
  const [shared, setShared] = useState(false)
  const [backend, setBackend] = useState<Backend>("host")

  const ctx: Ctx = { admin, terminal, desktop, shared, backend }
  // The Terminal page spawns $SHELL on the host with the agent workspace as
  // cwd (terminal.py:310-318); it never goes through the agent's backend.
  const shellKind: Backend = terminal || admin ? "host" : backend
  const rows = RESOURCES.map((r) => ({ r, api: r.api(ctx), shell: r.shell(shellKind) }))
  const apiLeaks = rows.filter((x) => x.api.level === "yes" || x.api.level === "partial").length
  const shellLeaks = rows.filter((x) => x.shell.level === "yes").length

  let wall: string
  if (shellKind === "host") {
    wall =
      terminal || admin
        ? "The Terminal is a host shell, so Bob's account is now as strong as the server's OS user. The row checks still hold in the dashboard; they do not hold on disk."
        : "Only the row checks. Bob's agent runs commands as the server's OS user, which owns every account's files."
  } else if (shellKind === "jail") {
    wall = "Row checks in the API, plus a bubblewrap mount namespace around every command Bob's agent runs."
  } else {
    wall = "Row checks in the API, plus a container boundary around Bob's agent."
  }

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="text-muted-foreground mb-2 text-xs">
        Alice owns the agent <code>planner</code>. What can Bob, a second account on the same Octop, reach?
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <Toggle checked={terminal} onChange={setTerminal}>
          Bob has the <code>terminal</code> permission
        </Toggle>
        <Toggle checked={desktop} onChange={setDesktop}>
          Bob has the <code>desktop</code> permission
        </Toggle>
        <Toggle checked={admin} onChange={setAdmin}>
          Bob is an admin
        </Toggle>
        <Toggle checked={shared} onChange={setShared}>
          Alice marks <code>planner</code> as shared
        </Toggle>
      </div>

      <div className="mt-3">
        <div className="text-muted-foreground mb-1.5 text-xs">Backend for Bob&apos;s own agent</div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Backend for Bob's agent">
          {BACKENDS.map((b) => (
            <button
              key={b.id}
              type="button"
              role="radio"
              aria-checked={backend === b.id}
              onClick={() => setBackend(b.id)}
              title={b.note}
              className={cn(
                "rounded-md border px-2.5 py-1 font-mono text-xs",
                backend === b.id ? "border-foreground bg-muted" : "border-border hover:bg-muted"
              )}
            >
              {b.label}
            </button>
          ))}
        </div>
        <div className="text-muted-foreground mt-1 text-[11px]">
          {BACKENDS.find((b) => b.id === backend)?.note}
          {(terminal || admin) && backend !== "host"
            ? ". The Terminal ignores this choice, so the shell column shows the host."
            : ""}
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-xs">
          <thead>
            <tr className="text-muted-foreground text-left">
              <th className="py-1.5 pr-3 font-normal">Alice&apos;s …</th>
              <th className="py-1.5 pr-3 font-normal">scope</th>
              <th className="py-1.5 pr-3 font-normal">Bob, through Octop&apos;s API</th>
              <th className="py-1.5 font-normal">a shell Bob controls</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, api, shell }) => (
              <tr key={r.name} className="border-t align-top">
                <td className="py-1.5 pr-3">
                  <div className="font-medium">{r.name}</div>
                  <div className="text-muted-foreground font-mono text-[10px] break-words">{r.where}</div>
                </td>
                <td className="py-1.5 pr-3">
                  <span className={cn("rounded border px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap", SCOPE_STYLE[r.scope])}>
                    {r.scope}
                  </span>
                </td>
                <td className="py-1.5 pr-3">
                  <Verdict cell={api} />
                </td>
                <td className="py-1.5">
                  <Verdict cell={shell} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-muted mt-3 rounded-md px-3 py-2 text-xs">
        <span className="font-mono">
          API: {apiLeaks}/{rows.length} reachable · shell: {shellLeaks}/{rows.length} reachable
        </span>
        <div className="mt-1">{wall}</div>
      </div>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        Reasoned from the code at Octop <code>4b17f1c</code> and octop-harness <code>14a1cd9</code>, not from a run. The
        jail row assumes the admin pointed Bob&apos;s <code>workspace_root_dir</code> outside <code>~/.octop</code> and
        that <code>bwrap</code> is installed; with Octop itself in Docker that policy is ignored. The shell column says
        what the operating system allows, not what any agent will do. Alice and <code>planner</code> are made up.
      </figcaption>
    </figure>
  )
}
