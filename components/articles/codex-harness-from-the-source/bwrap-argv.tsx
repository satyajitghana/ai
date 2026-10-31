"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { Ev, Panel, Src } from "./ui"

// The order in which codex-rs/linux-sandbox/src/bwrap.rs builds the argv for a restricted policy
// (create_bwrap_flags 309-390 around create_filesystem_args 392-799). The sample is a workspace profile.
type G = "process" | "ro" | "rw" | "deny" | "ns" | "caps" | "exec"
const COLORS: Record<G, { label: string; cls: string }> = {
  process: { label: "process", cls: "bg-slate-500/70" },
  ro: { label: "read-only mount", cls: "bg-sky-500/70" },
  rw: { label: "writable mount", cls: "bg-emerald-500/70" },
  deny: { label: "mask / deny", cls: "bg-rose-500/70" },
  ns: { label: "namespace", cls: "bg-violet-500/70" },
  caps: { label: "capabilities", cls: "bg-amber-500/80" },
  exec: { label: "the command", cls: "bg-foreground/60" },
}

const TOKENS: { t: string; g: G; src: string; note: string }[] = [
  { t: "--new-session --die-with-parent", g: "process", src: "bwrap.rs:340-341", note: "The helper starts bubblewrap in a new session and ties the sandbox's lifetime to its own." },
  { t: "--ro-bind / /", g: "ro", src: "bwrap.rs:392-410, step 1", note: "A policy that can read everything starts from the whole host tree mounted read-only. A restricted-read policy instead starts from an empty tmpfs and binds each readable root." },
  { t: "--dev /dev", g: "rw", src: "bwrap.rs:392-410, step 2", note: "A minimal /dev with the standard device nodes, even under a read-only root." },
  { t: "--perms 000 --tmpfs <unreadable ancestor>", g: "deny", src: "bwrap.rs:605-624", note: "Unreadable ancestors of a writable root are masked first, so nested writable carve-outs can be reopened safely afterwards." },
  { t: "--bind <root> <root>", g: "rw", src: "bwrap.rs:644-648", note: "Each writable root is re-mounted read-write over the read-only tree. Binding / recreates the minimal /dev before any carve-outs." },
  { t: "--ro-bind <subpath> <subpath>", g: "ro", src: "bwrap.rs:686-693", note: "Read-only carve-outs inside a writable root, so protected subpaths win. The protected names .git, .agents, .codex and .aws are added to this list for every writable root." },
  { t: "--perms 555 --tmpfs <missing .git|.agents|.codex|.aws> --remount-ro", g: "deny", src: "bwrap.rs:1290-1306", note: "If a protected directory does not exist yet, it is created as an empty read-only mount target, so the sandboxed command cannot create it." },
  { t: "--ro-bind-data <fd of /dev/null> <missing path>", g: "deny", src: "bwrap.rs:1279-1288", note: "Other missing read-only paths get an empty file bound read-only. Bubblewrap consumes and closes the descriptor for each bind-data mount." },
  { t: "--perms 000|111 --tmpfs <denied dir> --remount-ro", g: "deny", src: "bwrap.rs:1378-1416", note: "A deny-read directory becomes an empty tmpfs, mode 000, or 111 if a writable child must stay reachable inside it. Unreadable globs are expanded before launch with ripgrep." },
  { t: "--unshare-user", g: "ns", src: "bwrap.rs:356-360", note: "Requested explicitly because bubblewrap's automatic user namespace is skipped when the caller is uid 0 (the comment says so)." },
  { t: "--unshare-pid  --unshare-ipc", g: "ns", src: "bwrap.rs:362-364", note: "A new PID namespace unless the startup-only inherit mode is set, and a new IPC namespace." },
  { t: "--unshare-net", g: "ns", src: "bwrap.rs:365-366", note: "Only when the network policy says to unshare it." },
  { t: "--proc /proc", g: "ns", src: "bwrap.rs:368-371", note: "A fresh procfs unless disabled. If the mount is denied, the helper retries without it (the README says process IDs inside can then differ from /proc)." },
  { t: "--chdir <canonical cwd>", g: "process", src: "bwrap.rs:372-379", note: "Only when the working directory is a symlink alias that the mounted view would not contain." },
  { t: "--cap-drop ALL", g: "caps", src: "bwrap.rs:381", note: "Every capability dropped. The inner stage later checks that none remain (see the helper timeline)." },
  { t: "-- <command>", g: "exec", src: "bwrap.rs:383-384", note: "The command is the helper itself, re-invoked with --apply-seccomp-then-exec: the filter is installed after the filesystem view exists." },
]

export function CodexArgvExplorer() {
  const [i, setI] = useState(5)
  const t = TOKENS[i]
  return (
    <Panel title="The bubblewrap command line, in the order the code builds it" sub="a workspace-write profile; click a part">
      <div className="mb-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {(Object.keys(COLORS) as G[]).map((g) => (<span key={g} className="inline-flex items-center gap-1"><span className={cn("inline-block h-2 w-2 rounded-sm", COLORS[g].cls)} />{COLORS[g].label}</span>))}
      </div>
      <ol className="rounded-lg border border-border bg-muted/30 p-2 font-mono text-[12px]">
        {TOKENS.map((x, k) => (
          <li key={x.t}>
            <button type="button" onClick={() => setI(k)} className={cn("flex w-full items-start gap-2 rounded px-1.5 py-1 text-left hover:bg-muted", i === k && "bg-amber-500/15")}>
              <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-sm", COLORS[x.g].cls)} />
              <span className="break-all">{x.t}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="mt-3 rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        <div className="mb-1 flex flex-wrap items-center gap-2"><Ev kind="READ" /> <Src>{t.src}</Src></div>
        <p className="text-muted-foreground">{t.note}</p>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">There is also a fast path: if the policy grants full-disk write, no unreadable globs and full network access, the command is returned unwrapped; with network unshared it gets a shorter list (<code>--bind / /</code> instead of the mount stack). 18 distinct bubblewrap flags appear in the file.</p>
    </Panel>
  )
}
