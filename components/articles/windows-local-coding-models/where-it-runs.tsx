"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where each part of a GitHub Copilot session runs once local models arrive on
// Windows. The point of the widget is that "local model" moves exactly one row
// (inference) and leaves the others where they were.
//
// Every placement comes from one of four primary sources, cited per cell:
//   CL  = "Bringing local models and sandboxed tools to Windows and GitHub
//         Copilot", Microsoft Command Line, 2026-10-07 (incl. its Figure 5)
//   OLL = GitHub changelog, "Discover local models in GitHub Copilot CLI",
//         2026-10-07
//   SBX = GitHub changelog, "Local sandboxing for GitHub Copilot now generally
//         available", 2026-10-07
// Cells marked "not documented" are places where none of them says, and the
// widget refuses to guess.

type Mode = "auto" | "local" | "cloud"
type Where = "cloud" | "pc" | "box" | "either" | "unknown"

type Cell = { where: Where; text: string; src: string }
type Row = { id: string; label: string; cell: (m: Mode, sandbox: boolean, offline: boolean) => Cell }

const COLOR: Record<Where, string> = {
  cloud: "oklch(0.62 0.13 250)",
  pc: "oklch(0.66 0.14 60)",
  box: "oklch(0.58 0.14 155)",
  either: "oklch(0.60 0.12 300)",
  unknown: "oklch(0.62 0.02 250)",
}

const WHERE_LABEL: Record<Where, string> = {
  cloud: "cloud",
  pc: "this PC",
  box: "this PC, inside MXC",
  either: "local or cloud",
  unknown: "not documented",
}

const ROWS: Row[] = [
  {
    id: "select",
    label: "Choosing the model",
    cell: (m) =>
      m === "auto"
        ? {
            where: "cloud",
            text: "Auto model selection sits under “Connected services” and hands its choice down to the device",
            src: "CL, Figure 5",
          }
        : { where: "pc", text: "You pick the model or endpoint yourself", src: "CL" },
  },
  {
    id: "infer",
    label: "Inference",
    cell: (m) =>
      m === "auto"
        ? {
            where: "either",
            text: "Per request, from task context and cache state. The rules for which tasks go local are not published",
            src: "CL",
          }
        : m === "local"
          ? {
              where: "pc",
              text: "Windows ML provider (MAI Code 1.1 Flash) or any OpenAI-compatible local endpoint, e.g. Ollama",
              src: "CL, OLL",
            }
          : { where: "cloud", text: "Hosted model, billed per token at the model's rate", src: "CL" },
  },
  {
    id: "shell",
    label: "Shell commands the agent runs",
    cell: (_m, sb) =>
      sb
        ? { where: "box", text: "ProcessContainer, BaseContainer tier (an AppContainer) under the effective policy", src: "CL, SBX" }
        : { where: "pc", text: "Inherit the full access of your user account", src: "CL" },
  },
  {
    id: "mcp",
    label: "Local MCP and language servers",
    cell: (_m, sb) =>
      sb
        ? { where: "box", text: "Inside the process boundary by default", src: "CL" }
        : { where: "pc", text: "Run as you", src: "CL" },
  },
  {
    id: "files",
    label: "Built-in file tools",
    cell: () => ({
      where: "pc",
      text: "Run inside Copilot itself. The harness checks them against policy, but that is not OS-enforced isolation",
      src: "CL",
    }),
  },
  {
    id: "remote",
    label: "Remote MCP servers",
    cell: () => ({
      where: "cloud",
      text: "Outside the local sandbox; Copilot checks the connection policy in process",
      src: "CL",
    }),
  },
  {
    id: "net",
    label: "Network and telemetry",
    cell: (m, _sb, off) =>
      off
        ? m === "local"
          ? {
              where: "unknown",
              text: "COPILOT_OFFLINE=true is the explicit switch; what it turns off besides cloud models is not spelled out",
              src: "OLL",
            }
          : {
              where: "unknown",
              text: "Offline mode with a cloud or Auto choice is not described in any of the posts",
              src: "OLL",
            }
        : {
            where: "cloud",
            text: "A local model does not make the session offline or disable GitHub telemetry",
            src: "CL, OLL",
          },
  },
]

const MODES: { id: Mode; label: string; note: string }[] = [
  { id: "auto", label: "Auto (HydraFusion on Windows)", note: "experimental preview, later in October" },
  { id: "local", label: "Explicit local model", note: "Ollama discovery shipped in CLI 1.0.94-0" },
  { id: "cloud", label: "Cloud model", note: "what Copilot does today" },
]

export function WhereItRuns() {
  const [mode, setMode] = useState<Mode>("auto")
  const [sandbox, setSandbox] = useState(true)
  const [offline, setOffline] = useState(false)

  const cells = ROWS.map((r) => ({ row: r, cell: r.cell(mode, sandbox, offline) }))
  const moved = cells.filter((c) => c.cell.where !== "cloud").length

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>One Copilot session, part by part</span>
        <span className="text-muted-foreground/60">from the 2026-10-07 posts</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Model mode">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              aria-pressed={mode === m.id}
              className={cn(
                "cursor-pointer rounded-md border px-2.5 py-1.5 text-left font-mono text-[11px] transition-colors",
                mode === m.id ? "border-foreground/40 bg-muted/50 text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span className="block">{m.label}</span>
              <span className="block text-[9.5px] text-muted-foreground">{m.note}</span>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1.5 font-mono text-[11px] text-muted-foreground">
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={sandbox} onChange={(e) => setSandbox(e.target.checked)} />
            Sandbox new sessions (MXC, GA)
          </label>
          <label className="flex cursor-pointer items-center gap-1.5">
            <input type="checkbox" checked={offline} onChange={(e) => setOffline(e.target.checked)} />
            COPILOT_OFFLINE=true
          </label>
        </div>

        <div className="divide-y rounded-lg border">
          {cells.map(({ row, cell }) => (
            <div key={row.id} className="grid grid-cols-1 gap-1 px-3 py-2.5 sm:grid-cols-[11rem_9.5rem_1fr] sm:gap-3">
              <div className="text-sm font-medium">{row.label}</div>
              <div>
                <span
                  className="inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10.5px]"
                  style={{ borderColor: COLOR[cell.where], color: COLOR[cell.where] }}
                >
                  <span className="inline-block size-1.5 rounded-full" style={{ background: COLOR[cell.where] }} />
                  {WHERE_LABEL[cell.where]}
                </span>
              </div>
              <div className="text-[13px] leading-snug text-muted-foreground">
                {cell.text}
                <span className="ml-1.5 font-mono text-[10px] text-muted-foreground/60">[{cell.src}]</span>
              </div>
            </div>
          ))}
        </div>

        <p className="font-mono text-[10.5px] text-muted-foreground">
          {moved} of {ROWS.length} rows are not plain cloud in this setting. Switching between local and cloud changes
          only the first two rows; the sandbox switch changes two others.
        </p>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        CL is Microsoft&apos;s Command Line post, OLL and SBX are GitHub&apos;s changelog entries on local model discovery
        and on local sandboxing, all from 2026-10-07. &ldquo;Not documented&rdquo; means none of them says.
      </figcaption>
    </figure>
  )
}
