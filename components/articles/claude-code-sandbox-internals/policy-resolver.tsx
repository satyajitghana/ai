"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// Two resolvers, both ports of the real code at commit 98a4016.
//
// Network: the five ordered checks in shouldAllowConnection
// (src/sandbox/sandbox-manager.ts): deniedDomains, then allowedDomains, then
// strictAllowlist, then a per-command allow list, then the ask callback (none
// in the bare CLI, so the fall-through is deny). Host matching is
// matchesDomainPattern (src/sandbox/domain-pattern.ts): an exact host, or a
// *.domain wildcard that matches a sub-domain but NOT the apex.
//
// Filesystem: reads are open by default and carved by denyRead, re-opened by
// allowRead unless a deny sits more specifically under the allow; writes are
// closed by default, opened by allowWrite, closed again by denyWrite and by the
// mandatory denies, which win inside an allowed directory
// (src/sandbox/linux-sandbox-utils.ts, generateFilesystemArgs).

const SAMPLE_POLICY = {
  allowedDomains: ["example.com", "*.githubusercontent.com"],
  deniedDomains: ["github.com:22"],
  strictAllowlist: false,
}

const MANDATORY = [
  ".bashrc", ".bash_profile", ".zshrc", ".zprofile", ".profile",
  ".gitconfig", ".gitmodules", ".ripgreprc", ".mcp.json",
  ".vscode/", ".idea/", ".claude/commands/", ".claude/agents/",
  ".git/hooks/", ".git/config",
]

type NetStep = { label: string; hit: boolean; verdict?: "allow" | "deny"; detail: string }

function matchesPattern(host: string, pat: string): boolean {
  const [ph, pp] = pat.split(":")
  const [h] = host.split(":")
  if (ph.startsWith("*.")) {
    const base = ph.slice(2)
    return h.endsWith("." + base) // sub-domain only, not the apex
  }
  if (pp) return host === pat
  return h === ph
}

function resolveNet(host: string): { verdict: "allow" | "deny"; steps: NetStep[] } {
  const steps: NetStep[] = []
  const denied = SAMPLE_POLICY.deniedDomains.find((d) => matchesPattern(host, d))
  steps.push({ label: "1. deniedDomains", hit: !!denied, verdict: denied ? "deny" : undefined, detail: denied ? `matches ${denied}` : "no match" })
  if (denied) return { verdict: "deny", steps }

  const allowed = SAMPLE_POLICY.allowedDomains.find((d) => matchesPattern(host, d))
  steps.push({ label: "2. allowedDomains", hit: !!allowed, verdict: allowed ? "allow" : undefined, detail: allowed ? `matches ${allowed}` : "no match" })
  if (allowed) return { verdict: "allow", steps }

  steps.push({ label: "3. strictAllowlist", hit: SAMPLE_POLICY.strictAllowlist, verdict: SAMPLE_POLICY.strictAllowlist ? "deny" : undefined, detail: SAMPLE_POLICY.strictAllowlist ? "off-list → deny, no appeal" : "off, so fall through" })
  if (SAMPLE_POLICY.strictAllowlist) return { verdict: "deny", steps }

  steps.push({ label: "4. per-command allow list", hit: false, detail: "empty in this sample" })
  steps.push({ label: "5. ask callback", hit: true, verdict: "deny", detail: "bare srt CLI has no callback → deny (Claude Code's callback would prompt here)" })
  return { verdict: "deny", steps }
}

const NET_EXAMPLES = ["example.com", "api.example.com", "raw.githubusercontent.com", "githubusercontent.com", "github.com:22", "github.com:443", "evil.net"]

type FsStep = { label: string; detail: string; verdict?: "allow" | "deny" }

function resolveFs(path: string, op: "read" | "write"): { verdict: "allow" | "deny"; steps: FsStep[] } {
  const base = path.split("/").pop() ?? ""
  const inProject = path.startsWith("project/")
  const inSecret = path.startsWith("project/secret/") || path.startsWith("secret/")
  const mandatory = MANDATORY.find((m) => path.endsWith(m.replace(/\/$/, "")) || path.includes("/" + m) || base === m.replace(/\/$/, ""))
  const steps: FsStep[] = []

  if (op === "read") {
    steps.push({ label: "default", detail: "reads open (--ro-bind / /)", verdict: "allow" })
    if (inSecret) {
      steps.push({ label: "denyRead", detail: "under secret/ → empty tmpfs mounted over it; the file is not there", verdict: "deny" })
      return { verdict: "deny", steps }
    }
    steps.push({ label: "denyRead", detail: "no deny covers it", verdict: "allow" })
    return { verdict: "allow", steps }
  }

  // write
  steps.push({ label: "default", detail: "writes closed (path sits under read-only /)", verdict: "deny" })
  if (!inProject) {
    steps.push({ label: "allowWrite", detail: "not under the allowWrite root → EROFS", verdict: "deny" })
    return { verdict: "deny", steps }
  }
  steps.push({ label: "allowWrite", detail: "under project/ → re-bound read-write", verdict: "allow" })
  if (mandatory) {
    steps.push({ label: "mandatory deny", detail: `${mandatory} is always write-denied (ro /dev/null or ro-bind) even inside allowWrite`, verdict: "deny" })
    return { verdict: "deny", steps }
  }
  if (inSecret) {
    steps.push({ label: "denyRead (write side)", detail: "writable tmpfs, but changes vanish with it", verdict: "allow" })
  }
  return { verdict: "allow", steps }
}

const FS_EXAMPLES: { path: string; op: "read" | "write" }[] = [
  { path: "project/src/main.rs", op: "write" },
  { path: "project/notes.txt", op: "read" },
  { path: "project/.bashrc", op: "write" },
  { path: "project/.git/hooks/pre-commit", op: "write" },
  { path: "secret/key.txt", op: "read" },
  { path: "outside/x.txt", op: "write" },
  { path: "project/.git/config", op: "write" },
]

function Verdict({ v }: { v: "allow" | "deny" }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[11px] font-semibold uppercase", v === "allow" ? "ccx-vt-allow" : "ccx-vt-deny")}>
      {v}
    </span>
  )
}

export function PolicyResolver() {
  const [net, setNet] = useState("api.example.com")
  const [fs, setFs] = useState<{ path: string; op: "read" | "write" }>(FS_EXAMPLES[2])

  const netR = useMemo(() => resolveNet(net), [net])
  const fsR = useMemo(() => resolveFs(fs.path, fs.op), [fs])

  return (
    <div className="my-6 grid gap-4 lg:grid-cols-2">
      {/* Network */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-sm font-medium">Network decision</div>
        <div className="p-4">
          <div className="mb-3 text-xs text-muted-foreground">
            policy: allow <code>example.com</code>, <code>*.githubusercontent.com</code>; deny <code>github.com:22</code>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {NET_EXAMPLES.map((h) => (
              <button key={h} type="button" onClick={() => setNet(h)}
                className={cn("rounded border px-2 py-1 font-mono text-[11px] transition-colors", net === h ? "border-sky-500 bg-sky-500/15" : "border-border hover:bg-muted")}>
                {h}
              </button>
            ))}
          </div>
          <ol className="space-y-1.5">
            {netR.steps.map((s, i) => (
              <li key={i} className={cn("flex items-start justify-between gap-2 rounded px-2 py-1.5 text-[13px]", s.hit ? "bg-muted" : "opacity-55")}>
                <span><span className="font-medium">{s.label}</span> <span className="text-muted-foreground">— {s.detail}</span></span>
                {s.verdict ? <Verdict v={s.verdict} /> : null}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">verdict for <code className="text-foreground">{net}</code>:</span>
            <Verdict v={netR.verdict} />
          </div>
        </div>
      </div>

      {/* Filesystem */}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border px-4 py-2 text-sm font-medium">Filesystem decision</div>
        <div className="p-4">
          <div className="mb-3 text-xs text-muted-foreground">
            policy: allowWrite <code>project/</code>; denyRead <code>secret/</code>
          </div>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {FS_EXAMPLES.map((e) => (
              <button key={e.path + e.op} type="button" onClick={() => setFs(e)}
                className={cn("rounded border px-2 py-1 font-mono text-[11px] transition-colors", fs.path === e.path && fs.op === e.op ? "border-green-500 bg-green-500/15" : "border-border hover:bg-muted")}>
                {e.op} {e.path}
              </button>
            ))}
          </div>
          <ol className="space-y-1.5">
            {fsR.steps.map((s, i) => (
              <li key={i} className="flex items-start justify-between gap-2 rounded bg-muted px-2 py-1.5 text-[13px]">
                <span><span className="font-medium">{s.label}</span> <span className="text-muted-foreground">— {s.detail}</span></span>
                {s.verdict ? <Verdict v={s.verdict} /> : null}
              </li>
            ))}
          </ol>
          <div className="mt-3 flex items-center gap-2 border-t border-border pt-3 text-sm">
            <span className="text-muted-foreground">verdict for <code className="text-foreground">{fs.op} {fs.path}</code>:</span>
            <Verdict v={fsR.verdict} />
          </div>
        </div>
      </div>

      <style>{`
        .ccx-vt-allow{background:color-mix(in srgb,#22c55e 20%,transparent);color:#16a34a}
        .ccx-vt-deny{background:color-mix(in srgb,#ef4444 20%,transparent);color:#dc2626}
      `}</style>
    </div>
  )
}
