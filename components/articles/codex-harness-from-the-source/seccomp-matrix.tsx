"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Panel, Src, Tag } from "./ui"

// Codex columns: linux-sandbox/src/seccomp.rs:190-296 (default allow; a matched rule returns EPERM).
// Claude column: our own article claude-code-sandbox-internals (apply-seccomp, @anthropic-ai/sandbox-runtime 0.0.81).
type Cell = "deny" | "allow" | "cond" | "none"
type Row = { call: string; group: string; codex: [Cell, Cell, Cell]; claude: Cell; note?: string }

const R: Row[] = [
  { call: "ptrace", group: "introspection", codex: ["deny", "deny", "allow"], claude: "none", note: "not in the filters our article describes" },
  { call: "process_vm_readv / writev", group: "introspection", codex: ["deny", "deny", "allow"], claude: "none" },
  { call: "io_uring_setup / enter / register", group: "io_uring", codex: ["deny", "deny", "deny"], claude: "deny", note: "io_uring can create AF_VSOCK sockets without socket() (a comment in the code)" },
  { call: "connect, accept, accept4, bind, listen", group: "network syscalls", codex: ["deny", "allow", "allow"], claude: "none" },
  { call: "getpeername, getsockname, shutdown", group: "network syscalls", codex: ["deny", "allow", "allow"], claude: "none" },
  { call: "sendto, sendmmsg, recvmmsg", group: "network syscalls", codex: ["deny", "allow", "allow"], claude: "none" },
  { call: "getsockopt, setsockopt", group: "network syscalls", codex: ["deny", "allow", "allow"], claude: "none" },
  { call: "recvfrom", group: "network syscalls", codex: ["allow", "allow", "allow"], claude: "none", note: "left allowed on purpose so cargo clippy can use socketpairs" },
  { call: "socket(AF_UNIX)", group: "socket families", codex: ["allow", "cond", "allow"], claude: "deny", note: "Codex's proxy-routed mode denies it unless a managed policy grants all Unix sockets" },
  { call: "socket(AF_INET / AF_INET6)", group: "socket families", codex: ["deny", "allow", "allow"], claude: "none" },
  { call: "socket(AF_VSOCK)", group: "socket families", codex: ["deny", "deny", "deny"], claude: "deny" },
  { call: "unshare, clone with namespace flags", group: "namespaces and mounts", codex: ["none", "none", "none"], claude: "deny", note: "grep for SYS_unshare, CLONE_NEWUSER, disable-userns outside vendor/ returns nothing" },
  { call: "setns, mount, umount2, pivot_root", group: "namespaces and mounts", codex: ["none", "none", "none"], claude: "deny" },
  { call: "open_tree, move_mount, fsopen, fsmount…", group: "namespaces and mounts", codex: ["none", "none", "none"], claude: "deny" },
]

const LABEL: Record<Cell, string> = { deny: "EPERM", allow: "allowed", cond: "conditional", none: "no rule" }
const CLS: Record<Cell, string> = {
  deny: "bg-rose-500/25 text-foreground",
  allow: "text-muted-foreground",
  cond: "bg-amber-500/25",
  none: "text-muted-foreground/70",
}

export function SeccompMatrix() {
  const [view, setView] = useState<"codex" | "compare">("codex")
  const cols = view === "codex" ? ["Restricted", "ProxyRouted", "VmSocketRestricted"] : ["Codex, Restricted", "Claude runtime"]
  const rows = view === "compare" ? R : R.filter((r) => r.group !== "namespaces and mounts")
  return (
    <Panel title="What the seccomp filters do and do not say" sub="default action allow; a matching rule returns EPERM">
      <div className="mb-3 flex gap-1.5">
        <Chip active={view === "codex"} onClick={() => setView("codex")}>Codex, three modes</Chip>
        <Chip tone="amber" active={view === "compare"} onClick={() => setView("compare")}>Codex against the Claude runtime</Chip>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              <th className="py-1 pr-3 font-medium">syscall</th>
              {cols.map((c) => (<th key={c} className="px-2 font-medium">{c}</th>))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const cells: Cell[] = view === "codex" ? [...r.codex] : [r.codex[0], r.claude]
              return (
                <tr key={r.call} className="border-b border-border/60 align-top">
                  <td className="py-1 pr-3"><span className="font-mono">{r.call}</span>{r.note ? <div className="text-[10.5px] text-muted-foreground">{r.note}</div> : null}</td>
                  {cells.map((c, i) => (<td key={i} className="px-1 py-1"><span className={cn("inline-block w-full rounded px-1.5 py-0.5 text-center", CLS[c])}>{LABEL[c]}</span></td>))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        In Restricted mode Codex denies 19 syscalls outright and denies <code>socket</code> and <code>socketpair</code> unless they are AF_UNIX. <Src>seccomp.rs:190-296</Src>{" "}
        {view === "compare" ? (<><Tag tone="amber">measured, not tested</Tag> The bottom three rows are an absence found by grep. What that absence means in practice was not tested here.</>) : null}
      </p>
    </Panel>
  )
}
