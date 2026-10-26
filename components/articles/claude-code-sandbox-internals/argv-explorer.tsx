"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The flags below are copied from the real command sandbox-runtime 0.0.81 built
// on my Linux VM for the sample policy in the article (allowedDomains:
// ["example.com"], denyRead: ["$S/run/secret"], allowWrite: ["$S/run/project"]).
// I captured it through SandboxManager.wrapWithSandbox and abbreviated the
// scratch path to $S and the proxy socket id; nothing else is edited. The
// annotations are read from src/sandbox/linux-sandbox-utils.ts at commit
// 98a4016. Click a token to pin its note.

type Group =
  | "session"
  | "net"
  | "mount-ro"
  | "mount-rw"
  | "mount-deny"
  | "ns"
  | "exec"

const GROUPS: Record<Group, { label: string; cls: string }> = {
  session: { label: "process", cls: "ccx-session" },
  net: { label: "network", cls: "ccx-net" },
  "mount-ro": { label: "read-only mount", cls: "ccx-ro" },
  "mount-rw": { label: "writable mount", cls: "ccx-rw" },
  "mount-deny": { label: "deny mount", cls: "ccx-deny" },
  ns: { label: "namespace / caps", cls: "ccx-ns" },
  exec: { label: "the command", cls: "ccx-exec" },
}

type Tok = { t: string; g: Group; note: string }

const TOKENS: Tok[] = [
  { t: "--new-session", g: "session", note: "New session keyring and a fresh controlling terminal, so the command cannot inject keystrokes into the parent's TTY with TIOCSTI." },
  { t: "--die-with-parent", g: "session", note: "If the srt process dies, the kernel kills the whole sandbox. No orphaned shell keeps running." },
  { t: "--unshare-net", g: "net", note: "A fresh network namespace with nothing in it but loopback. No interfaces, no routes, no resolver. This is the entire network fence." },
  { t: "--bind /tmp/claude-http-<id>.sock …", g: "net", note: "The one hole in the net namespace: the host proxy's Unix socket, bind-mounted in. In 0.0.81 a single mux socket serves both HTTP and SOCKS, so it is bound once." },
  { t: "--setenv HTTP_PROXY http://srt.<key>:<tok>@localhost:3128", g: "net", note: "Points tools at the in-sandbox socat listener. The username carries a base64 attribution key so the proxy can file each connection under the command that made it. ~30 more --setenv lines set every proxy variant (https/all/ftp/grpc, git, docker, gcloud, a Java agent)." },
  { t: "--ro-bind / /", g: "mount-ro", note: "The whole host tree, mounted read-only. Reads are open by default; this is why. There are no path checks in user space — the mount table is the policy." },
  { t: "--ro-bind $S/run/project/.git …", g: "mount-ro", note: "The repo's .git is pinned read-only first, before the project is bound writable over it, so the writable bind cannot expose .git/hooks or .git/config." },
  { t: "--bind /root/.npm/_logs …", g: "mount-rw", note: "A default writable path (npm logs). A short list of these (/tmp/claude, ~/.npm/_logs, ~/.claude/debug) is writable even with an empty allowWrite." },
  { t: "--bind $S/run/project $S/run/project", g: "mount-rw", note: "The one allowWrite root, re-mounted read-write on top of the read-only root. Writes land here and nowhere else." },
  { t: "--tmpfs $S/run/secret", g: "mount-deny", note: "A denyRead directory becomes an empty tmpfs mounted over it. The real files are not hidden — they are not there. The tmpfs is writable, but its contents vanish with it." },
  { t: "--ro-bind /dev/null $S/run/project/.bashrc  (×11)", g: "mount-deny", note: "Each mandatory-deny file that would run code later (.bashrc, .zshrc, .profile, .gitconfig, .mcp.json, .ripgreprc, .vscode, .idea, …) gets /dev/null mounted over it read-only — so it cannot be written or created, even though allowWrite covers the directory. A ripgrep scan, 3 levels deep, finds them." },
  { t: "--ro-bind $S/run/project/.git/hooks …", g: "mount-deny", note: ".git/hooks and .git/config are re-bound read-only over the writable project. These are the files git would execute outside the sandbox." },
  { t: "--dev /dev", g: "mount-rw", note: "A minimal /dev (null, zero, random, tty, …), not the host's full device tree." },
  { t: "--unshare-pid", g: "ns", note: "A new PID namespace, so the command cannot see or signal processes outside it. apply-seccomp nests a second PID namespace below this one." },
  { t: "--unshare-user", g: "ns", note: "A new user namespace. Set in both modes because bwrap only auto-creates one when EUID != 0; a root parent in an unprivileged container would otherwise EPERM." },
  { t: "--cap-drop ALL --cap-add CAP_SETFCAP", g: "ns", note: "Drop every capability, then add back only CAP_SETFCAP, which the apply-seccomp helper needs to set up its nested namespaces." },
  { t: "--proc /proc", g: "ns", note: "Mount a fresh /proc for the new PID namespace. --ro-bind /proc would leak host process info; --proc gives a procfs scoped to the namespace. (In unprivileged Docker this is swapped for --bind /proc under enableWeakerNestedSandbox.)" },
  { t: "--unsetenv SRT_ALLOW_NESTED_USERNS", g: "ns", note: "Clear the opt-out so the caller's environment cannot turn off the namespace restrictions; the helper sets it itself." },
  { t: "-- /usr/bin/bash -c '<socat; wait; apply-seccomp bash -c CMD>'", g: "exec", note: "The command runs one level deeper: start both socat listeners, poll /proc/net/sockstat until two TCP sockets listen (up to 30 s), then apply-seccomp installs the seccomp filters in a nested user+PID+mount namespace and execs the command." },
]

export function BwrapArgvExplorer() {
  const [sel, setSel] = useState<number>(5) // default to --ro-bind / /

  return (
    <div className="my-6 overflow-hidden rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        <span className="font-medium text-foreground">bwrap argv, measured</span>
        {(Object.keys(GROUPS) as Group[]).map((g) => (
          <span key={g} className="inline-flex items-center gap-1">
            <span className={cn("inline-block h-2 w-2 rounded-sm", GROUPS[g].cls, "ccx-dot")} />
            {GROUPS[g].label}
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-3 p-4 lg:flex-row">
        <div className="font-mono text-[12px] leading-relaxed lg:w-3/5">
          <span className="text-muted-foreground">bwrap </span>
          {TOKENS.map((tok, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setSel(i)}
              className={cn(
                "ccx-tok mr-1 mb-1 inline rounded px-1 py-0.5 text-left align-baseline transition-colors",
                GROUPS[tok.g].cls,
                i === sel ? "ccx-on" : "ccx-off",
              )}
            >
              {tok.t}
            </button>
          ))}
        </div>

        <div className="lg:w-2/5">
          <div className="rounded-lg border border-border bg-background p-3 text-sm">
            <div className="mb-1 flex items-center gap-2">
              <span className={cn("inline-block h-2 w-2 rounded-sm", GROUPS[TOKENS[sel].g].cls, "ccx-dot")} />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {GROUPS[TOKENS[sel].g].label}
              </span>
            </div>
            <code className="mb-2 block break-all text-[12px] text-foreground">{TOKENS[sel].t}</code>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{TOKENS[sel].note}</p>
          </div>
        </div>
      </div>

      <style>{`
        .ccx-dot.ccx-session{background:#64748b}
        .ccx-dot.ccx-net{background:#0ea5e9}
        .ccx-dot.ccx-ro{background:#94a3b8}
        .ccx-dot.ccx-rw{background:#22c55e}
        .ccx-dot.ccx-deny{background:#ef4444}
        .ccx-dot.ccx-ns{background:#a855f7}
        .ccx-dot.ccx-exec{background:#f59e0b}
        .ccx-tok{border:1px solid transparent}
        .ccx-off{background:color-mix(in srgb, var(--muted) 55%, transparent);color:var(--foreground)}
        .ccx-off:hover{background:color-mix(in srgb, var(--muted) 85%, transparent)}
        .ccx-on.ccx-session{border-color:#64748b}
        .ccx-on.ccx-net{border-color:#0ea5e9;background:color-mix(in srgb,#0ea5e9 16%,transparent)}
        .ccx-on.ccx-ro{border-color:#94a3b8;background:color-mix(in srgb,#94a3b8 16%,transparent)}
        .ccx-on.ccx-rw{border-color:#22c55e;background:color-mix(in srgb,#22c55e 16%,transparent)}
        .ccx-on.ccx-deny{border-color:#ef4444;background:color-mix(in srgb,#ef4444 16%,transparent)}
        .ccx-on.ccx-ns{border-color:#a855f7;background:color-mix(in srgb,#a855f7 16%,transparent)}
        .ccx-on.ccx-exec{border-color:#f59e0b;background:color-mix(in srgb,#f59e0b 16%,transparent)}
        .ccx-on.ccx-session{background:color-mix(in srgb,#64748b 16%,transparent)}
      `}</style>
    </div>
  )
}
