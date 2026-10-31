"use client"

import { useState } from "react"

import { Chip, Panel } from "./ui"

// Codex column: read from openai/codex @ 67f0994b. Claude column: our own articles sandbox-runtime and
// claude-code-sandbox-internals (@anthropic-ai/sandbox-runtime 0.0.81). Rows marked "differs" are the interesting ones.
type Row = { group: string; aspect: string; codex: string; claude: string; same?: boolean }

const ROWS: Row[] = [
  { group: "shape", aspect: "What it is", codex: "Part of the agent harness. One helper binary re-executes itself in two stages.", claude: "A library and the srt CLI that turn a policy into one bwrap command line." },
  { group: "filesystem", aspect: "Flags both use", codex: "--new-session --die-with-parent --ro-bind / / --dev /dev --bind --unshare-user --unshare-pid --unshare-net --proc /proc --cap-drop ALL --tmpfs --ro-bind", claude: "the same set", same: true },
  { group: "filesystem", aspect: "Flags only one uses", codex: "--unshare-ipc --perms --remount-ro --ro-bind-data --chdir --bind-try --dir", claude: "--cap-add CAP_SETFCAP, and --ro-bind /dev/null over masked files" },
  { group: "filesystem", aspect: "Protected paths", codex: "4 names under every writable root: .git, .agents, .codex, .aws (the whole directory)", claude: "14 specific entries: shell rc files, .gitconfig, .gitmodules, .ripgreprc, .mcp.json, .vscode/, .idea/, .claude/commands and agents, .git/hooks, .git/config" },
  { group: "filesystem", aspect: "Missing protected path", codex: "An empty read-only mount target is created so the path cannot be created inside", claude: "Existing files are masked" },
  { group: "filesystem", aspect: "Writable symlink over a protected path", codex: "Fails closed: refuses to start", claude: "Not covered in our article" },
  { group: "syscalls", aspect: "Seccomp", codex: "Network filter (19 syscalls plus socket rules), ptrace, process_vm_*, io_uring denied. Installed in an inner stage after a capability check.", claude: "A unix-block filter (AF_UNIX, AF_VSOCK, io_uring) and a namespaces filter (unshare, clone flags, setns, mount, pivot_root, the new mount API), with clone3 returning ENOSYS" },
  { group: "syscalls", aspect: "Nested namespaces", codex: "One level (bubblewrap). Capabilities verified empty before exec, or the helper panics.", claude: "apply-seccomp nests a PID, mount and user namespace; the command is inner PID 2" },
  { group: "network", aspect: "Egress", codex: "--unshare-net plus a host proxy bridged TCP to Unix socket to TCP; 16 proxy variables rewritten; a per-connection attribution token", claude: "--unshare-net plus one Unix socket to a mux proxy (HTTP and SOCKS) through socat" },
  { group: "network", aspect: "Proxy features", codex: "Allow and deny lists with wildcards, a method-limited mode, private-IP and resolved-IP blocks, TLS inspection with an in-memory CA, header stripping, SigV4 re-signing, credential masking, an OTEL audit trail", claude: "Domain allow and deny; no TLS inspection by default (an optional mitmProxy)" },
  { group: "decisions", aspect: "Who decides what runs", codex: "execpolicy rules, four approval modes, an optional model reviewer (the Guardian), hooks and admin requirements", claude: "The host app decides through its own permission rules; the library enforces the policy it is given" },
  { group: "decisions", aspect: "Remote execution", codex: "exec-server over JSON-RPC (WebSocket, stdio or a Noise relay); unauthenticated unless configured", claude: "None in the runtime" },
  { group: "platforms", aspect: "macOS", codex: "sandbox-exec with parameterized .sbpl fragments (4 files, 343 lines)", claude: "A Seatbelt profile per command" },
  { group: "platforms", aspect: "Windows", codex: "Restricted token, managed accounts and ACLs, 12 Filtering Platform filters, or the MXC container", claude: "Not supported by the runtime" },
  { group: "limits", aspect: "Stated thin spots", codex: "Proxy DNS rebinding; MXC hard-link and alias limits; the inherit-PID mode; a hook error does not block", claude: "An allowed domain is the whole domain; AF_VSOCK; the namespaces filter is load-bearing; hooks, MCP servers and built-ins run outside" },
]
const GROUPS = ["all", "filesystem", "syscalls", "network", "decisions", "platforms", "limits"]

export function SandboxCompare() {
  const [g, setG] = useState("all")
  const rows = ROWS.filter((r) => g === "all" || r.group === g || r.group === "shape")
  return (
    <Panel title="Two Linux sandboxes, side by side" sub="Codex from the source; Claude from our teardown">
      <div className="mb-3 flex flex-wrap gap-1.5">{GROUPS.map((x) => (<Chip key={x} active={g === x} onClick={() => setG(x)}>{x}</Chip>))}</div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead><tr className="border-b border-border text-left text-muted-foreground"><th className="w-32 py-1 pr-3 font-medium">aspect</th><th className="pr-3 font-medium">Codex harness</th><th className="font-medium">Claude Code sandbox runtime</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.aspect} className="border-b border-border/60 align-top">
                <td className="py-1.5 pr-3 font-medium">{r.aspect}</td>
                <td className="py-1.5 pr-3">{r.codex}</td>
                <td className="py-1.5 text-muted-foreground">{r.claude}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  )
}
