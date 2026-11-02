"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

import { Chip, Ev, Panel, Src, Tag, type Tone } from "./ui"

// Types and rules: protocol/src/permissions.rs:40-50 (four protected names), :120 (read < write < deny, deny beats write beats read at
// equal specificity), models.rs:426 (PermissionProfile), sandboxing/src/manager.rs:50 (backend per platform).
type Access = "read" | "write" | "deny"
type Entry = { path: string; access: Access; label: string }

const PROJECT = "/home/u/proj"
const PROTECTED = [".git", ".agents", ".codex", ".aws"]

const PROFILES = {
  ":read-only": { entries: [{ path: "/", access: "read", label: "Root" }] as Entry[], note: "Everything readable, nothing writable. The default sandbox mode." },
  ":workspace": { entries: [{ path: "/", access: "read", label: "Root" }, { path: PROJECT, access: "write", label: "ProjectRoots" }, { path: "/tmp", access: "write", label: "SlashTmp" }] as Entry[], note: "The project and the temp directories are writable; everything else is read-only." },
  ":danger-full-access": { entries: [] as Entry[], note: "No outer sandbox at all: the command runs as the user." },
}
type ProfileId = keyof typeof PROFILES

const RANK: Record<Access, number> = { read: 0, write: 1, deny: 2 }
const TONE: Record<Access, Tone> = { read: "sky", write: "emerald", deny: "rose" }

const TESTS = [`${PROJECT}/src/main.rs`, `${PROJECT}/.git/config`, `${PROJECT}/.codex/config.toml`, "/etc/hosts", "/tmp/scratch.txt", "/home/u/.ssh/id_ed25519", "/home/u/.aws/credentials"]

function resolve(profile: ProfileId, extra: Entry[], path: string): { access: Access; why: string } {
  if (profile === ":danger-full-access") return { access: "write", why: "no sandbox: nothing is mounted or filtered" }
  const entries = [...PROFILES[profile].entries, ...extra]
  const hit = entries.filter((e) => e.path === "/" || path === e.path || path.startsWith(`${e.path}/`))
  const bestLen = Math.max(...hit.map((e) => e.path.length))
  const best = hit.filter((e) => e.path.length === bestLen).sort((a, b) => RANK[b.access] - RANK[a.access])[0]
  if (best.access === "write") {
    const root = entries.filter((e) => e.access === "write" && (path === e.path || path.startsWith(`${e.path}/`))).sort((a, b) => b.path.length - a.path.length)[0]
    const first = path.slice(root.path.length + 1).split("/")[0]
    if (PROTECTED.includes(first)) return { access: "read", why: `${first} is a protected name: re-bound read-only under every writable root` }
  }
  return { access: best.access, why: `longest matching entry: ${best.label} (${best.path}) is ${best.access}` }
}

const BACKEND: Record<ProfileId, string[]> = {
  ":read-only": ["Linux: bubblewrap with --ro-bind / /, no writable binds, plus the seccomp filter", "macOS: sandbox-exec with the base policy and no write roots", "Windows: restricted token and ACLs, or the MXC container"],
  ":workspace": ["Linux: --ro-bind / /, --bind of the project and /tmp, --ro-bind of .git .agents .codex .aws", "macOS: file-write* allowed per root with require-not clauses for the protected names", "Windows: restricted token with ACLs on the workspace"],
  ":danger-full-access": ["Linux: the command is returned unwrapped when network is also open", "macOS and Windows: no outer sandbox"],
}

export function PolicyLattice() {
  const [profile, setProfile] = useState<ProfileId>(":workspace")
  const [denySsh, setDenySsh] = useState(false)
  const extra = useMemo<Entry[]>(() => (denySsh ? [{ path: "/home/u/.ssh", access: "deny", label: "user entry" }] : []), [denySsh])
  return (
    <Panel title="From a profile to what a path can do" sub="the resolution rule from permissions.rs; paths are examples">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {(Object.keys(PROFILES) as ProfileId[]).map((p) => (<Chip key={p} active={profile === p} onClick={() => setProfile(p)}>{p}</Chip>))}
        <label className="ml-auto flex items-center gap-1.5 text-[12px] text-muted-foreground"><input type="checkbox" checked={denySsh} onChange={(e) => setDenySsh(e.target.checked)} /> add a deny entry for ~/.ssh</label>
      </div>
      <p className="mb-3 text-[12.5px] text-muted-foreground">{PROFILES[profile].note}</p>
      <ul className="space-y-1">
        {TESTS.map((p) => {
          const r = resolve(profile, extra, p)
          return (
            <li key={p} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 rounded border border-border px-2 py-1.5 text-[12px]">
              <code className="w-64 shrink-0 truncate font-mono">{p}</code>
              <Tag tone={TONE[r.access]}>{r.access === "deny" ? "no access" : r.access === "write" ? "read + write" : "read only"}</Tag>
              <span className="text-muted-foreground">{r.why}</span>
            </li>
          )
        })}
      </ul>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
          <div className="mb-1 flex items-center gap-2 font-medium">The layers <Ev kind="READ" /></div>
          <ol className="list-decimal space-y-1 pl-4 text-muted-foreground">
            <li><span className="text-foreground">Profile:</span> Managed (Codex builds the sandbox), Disabled, or External (an outer caller enforces it).</li>
            <li><span className="text-foreground">Filesystem policy:</span> entries of path and access; the most specific wins; at equal specificity deny beats write beats read.</li>
            <li><span className="text-foreground">Backend:</span> chosen per platform and by whether a sandbox is required.</li>
          </ol>
        </div>
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-[12.5px]">
          <div className="mb-1 font-medium">What the backend gets for {profile}</div>
          <ul className="list-disc space-y-1 pl-4 text-muted-foreground">{BACKEND[profile].map((b) => (<li key={b}>{b}</li>))}</ul>
        </div>
      </div>
      <p className={cn("mt-2 text-xs text-muted-foreground")}>Sources: <Src>protocol/src/permissions.rs:40-50, 120</Src> · <Src>protocol/src/models.rs:426</Src> · <Src>sandboxing/src/manager.rs:50, 313, 334</Src></p>
    </Panel>
  )
}
