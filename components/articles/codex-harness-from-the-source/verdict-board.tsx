"use client"

import { useState } from "react"

import { Chip, Panel, Src, Tag } from "./ui"

const IN: [string, string][] = [
  ["The agent loop and tools", "core, tools, apply-patch"],
  ["The sandboxes", "linux-sandbox, bwrap, windows-sandbox-rs, mxc-sandbox, sandboxing, execpolicy, network-proxy"],
  ["TUI, CLI, non-interactive exec", "tui, cli, exec"],
  ["App-server and its protocol", "app-server, app-server-protocol, app-server-transport"],
  ["MCP client", "codex-mcp, rmcp-client"],
  ["Skills, plugins, hooks", "ext/skills, core-plugins, hooks"],
  ["The code-mode V8 runtime", "code-mode, code-mode-host, code-mode-runtime, v8-poc"],
  ["Python and TypeScript SDKs", "sdk/python, sdk/typescript"],
  ["Build and release", "31 workflows, Cargo, Bazel, Nix"],
]

const OUT: [string, string][] = [
  ["Model weights and the Responses API server", "the repo holds clients: codex-api, codex-client"],
  ["The hosted Codex cloud service", "cloud-client, cloud-tasks-client, backend-client are clients"],
  ["The fleet that runs executors", "exec-server is the executor process; the fleet is not here"],
  ["ChatGPT accounts and billing", "login, workload-identity, user-verification are client-side"],
  ["The catalogue of Apps connectors", "connectors and codex_apps.rs are only the plumbing"],
  ["External pull requests", "GitHub reports pull_request_creation_policy: collaborators_only"],
]

// First day each path appears in the history window we could read (2026-05-19 to 2026-10-31).
const START = Date.UTC(2026, 4, 19) / 86400000
const END = Date.UTC(2026, 9, 31) / 86400000
const DAY = (m: number, d: number) => Date.UTC(2026, m - 1, d) / 86400000 - START
const SPAN = END - START

const FIRST_SEEN: { path: string; day: number; label: string }[] = [
  { path: "ext/skills", day: DAY(6, 3), label: "Jun 3" },
  { path: "code-mode-host", day: DAY(6, 11), label: "Jun 11" },
  { path: "code-mode-runtime", day: DAY(7, 30), label: "Jul 30" },
  { path: "ext/guardian-v2", day: DAY(8, 13), label: "Aug 13" },
  { path: "agent-roles", day: DAY(8, 24), label: "Aug 24" },
  { path: "worktree", day: DAY(8, 25), label: "Aug 25" },
  { path: "guardian-context", day: DAY(8, 28), label: "Aug 28" },
  { path: "voice-host", day: DAY(8, 31), label: "Aug 31" },
  { path: "mxc-sandbox", day: DAY(9, 4), label: "Sep 4" },
  { path: "ext/guardian-reviewer", day: DAY(9, 9), label: "Sep 9" },
  { path: "message-board", day: DAY(10, 21), label: "Oct 21" },
  { path: "plugin-host", day: DAY(10, 26), label: "Oct 26" },
]

const DAY_ONE = ["skills (core)", "code-mode", "v8-poc", "app-server", "app-server-protocol", "hooks", "core-plugins", "linux-sandbox", "windows-sandbox-rs", "exec-server", "rmcp-client", "sdk/python", "sdk/typescript", "tui"]

export function VerdictBoard() {
  const [sel, setSel] = useState<number | null>(null)
  const x = (d: number) => 24 + (d / SPAN) * 672
  return (
    <Panel title="What the post says is open, and what the repository holds" sub="read from the repo; pinned to commit 67f0994b">
      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Tag tone="emerald">in the repo</Tag><span className="text-muted-foreground">the client side, whole</span></div>
          <ul className="space-y-1.5">
            {IN.map(([a, b]) => (
              <li key={a} className="rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                <span className="font-medium">{a}</span>
                <div className="mt-0.5"><Src>{b}</Src></div>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium"><Tag tone="rose">not in the repo</Tag><span className="text-muted-foreground">what an &ldquo;open-sourced&rdquo; headline can blur</span></div>
          <ul className="space-y-1.5">
            {OUT.map(([a, b]) => (
              <li key={a} className="rounded-md border border-border px-2.5 py-1.5 text-[13px]">
                <span className="font-medium">{a}</span>
                <div className="mt-0.5"><Src>{b}</Src></div>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-5 border-t border-border pt-4">
        <div className="mb-1 text-sm font-medium">When each piece first appears in the history I could read</div>
        <p className="mb-2 text-xs text-muted-foreground">
          The window starts on 2026-05-19 and holds 6,300 commits. Fourteen of the paths the post names were already there on its first day ({DAY_ONE.join(", ")}). The rest arrived later; click a dot.
        </p>
        <svg viewBox="0 0 720 96" className="w-full" role="img" aria-label="Timeline of first appearance of newer crates between 19 May and 31 October 2026">
          <line x1={24} y1={58} x2={696} y2={58} className="stroke-border" strokeWidth={2} />
          {[["May 19", 0], ["Jul 1", DAY(7, 1)], ["Sep 1", DAY(9, 1)], ["Oct 31", SPAN]].map(([l, d]) => (
            <g key={String(l)}>
              <line x1={x(Number(d))} y1={54} x2={x(Number(d))} y2={62} className="stroke-muted-foreground" />
              <text x={x(Number(d))} y={78} textAnchor="middle" className="fill-muted-foreground text-[10px]">{l}</text>
            </g>
          ))}
          {FIRST_SEEN.map((f, i) => (
            <circle key={f.path} cx={x(f.day)} cy={i % 2 ? 40 : 58} r={sel === i ? 7 : 5} className={sel === i ? "fill-amber-500" : "fill-sky-500"} onClick={() => setSel(i)} style={{ cursor: "pointer" }} />
          ))}
        </svg>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {FIRST_SEEN.map((f, i) => (
            <Chip key={f.path} tone="amber" active={sel === i} onClick={() => setSel(i)}>{f.path} · {f.label}</Chip>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {sel === null ? "There is no single open-sourcing commit in the window. The repository was created on 2025-04-13; its first months are outside what I could read." : `${FIRST_SEEN[sel].path} first appears on ${FIRST_SEEN[sel].label}, ${Math.round(FIRST_SEEN[sel].day)} days into the window.`}
        </p>
      </div>
    </Panel>
  )
}
