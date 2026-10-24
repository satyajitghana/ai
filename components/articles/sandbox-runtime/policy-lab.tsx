"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Two panels. The first replays what srt 0.0.81 did on my Linux VM for each
// command (the output strings are copied from the runs, scratch path shortened
// to $S) and, beside it, what the macOS Seatbelt profile does according to
// src/sandbox/macos-sandbox-utils.ts and the README (not run: no Mac here).
// The second is a port of the network decision in src/sandbox/sandbox-manager.ts
// (deniedDomains, then allowedDomains, then strictAllowlist, then the
// per-command list, then the ask callback, else deny) and of
// matchesDomainPattern in src/sandbox/domain-pattern.ts.

type Verdict = "allow" | "deny"

type Attempt = {
  id: string
  cmd: string
  gloss: string
  verdict: Verdict
  linux: { layer: string; output: string }
  mac: { layer: string; output: string }
}

const ATTEMPTS: Attempt[] = [
  {
    id: "read-ok",
    cmd: "cat notes.txt",
    gloss: "read a file in the working directory",
    verdict: "allow",
    linux: { layer: "--ro-bind / / leaves the whole tree readable; the project is also --bind read-write", output: "public notes" },
    mac: { layer: "(allow file-read*) is the default read rule; no deny covers the file", output: "public notes" },
  },
  {
    id: "read-deny",
    cmd: "cat $S/run/secret/key.txt",
    gloss: "read a file under a denyRead directory",
    verdict: "deny",
    linux: {
      layer: "--tmpfs $S/run/secret: an empty directory is mounted over it, so the file is simply not there",
      output: "cat: $S/run/secret/key.txt: No such file or directory",
    },
    mac: {
      layer: "(deny file-read* (subpath …)) after the default allow; the kernel refuses the open",
      output: "Operation not permitted (the README's example for a denied file)",
    },
  },
  {
    id: "write-out",
    cmd: "echo b > $S/run/outside/x.txt",
    gloss: "write outside allowWrite",
    verdict: "deny",
    linux: {
      layer: "the path sits under --ro-bind / /, a read-only bind; the kernel answers EROFS",
      output: "/usr/bin/bash: line 1: $S/run/outside/x.txt: Read-only file system",
    },
    mac: { layer: "deny default: no (allow file-write* …) names the path", output: "Operation not permitted (EPERM)" },
  },
  {
    id: "bashrc",
    cmd: "echo d >> .bashrc",
    gloss: "write a mandatory-deny file inside the writable project",
    verdict: "deny",
    linux: {
      layer: "--ro-bind /dev/null …/project/.bashrc: the file did not exist, so srt mounted a read-only /dev/null at its name",
      output: "/usr/bin/bash: line 1: .bashrc: Permission denied",
    },
    mac: { layer: "(deny file-write* …) from the mandatory deny list, a glob that also covers files not yet made", output: "/bin/bash: .bashrc: Operation not permitted (README)" },
  },
  {
    id: "hook",
    cmd: "echo e > .git/hooks/pre-commit",
    gloss: "plant a git hook",
    verdict: "deny",
    linux: { layer: "--ro-bind …/.git/hooks …/.git/hooks re-binds the hooks directory read-only inside the writable project", output: "/usr/bin/bash: line 1: .git/hooks/pre-commit: Read-only file system" },
    mac: { layer: "mandatory deny on .git/hooks/", output: "/bin/bash: .git/hooks/pre-commit: Operation not permitted (README)" },
  },
  {
    id: "curl-ok",
    cmd: "curl https://example.com",
    gloss: "HTTPS to an allowlisted host",
    verdict: "allow",
    linux: {
      layer: "HTTPS_PROXY=localhost:3128 → socat in the sandbox → Unix socket → host proxy; example.com matches allowedDomains",
      output: "example.com https 200",
    },
    mac: { layer: "(allow network-outbound (remote ip \"localhost:<proxy port>\")) to the same proxy", output: "200 (same decision; not run)" },
  },
  {
    id: "curl-deny",
    cmd: "curl https://example.org",
    gloss: "HTTPS to a host not on the list",
    verdict: "deny",
    linux: { layer: "the host proxy finds no rule and no ask callback, and answers the CONNECT with 403", output: "curl: (56) CONNECT tunnel failed, response 403" },
    mac: { layer: "same proxy, same 403", output: "curl: (56) CONNECT tunnel failed, response 403 (not run)" },
  },
  {
    id: "curl-http",
    cmd: "curl -i http://example.org",
    gloss: "plain HTTP to a host not on the list",
    verdict: "deny",
    linux: { layer: "the HTTP proxy sees the absolute URL and refuses it", output: "HTTP/1.1 403 Forbidden\nX-Proxy-Error: blocked-by-allowlist\n\nConnection blocked by network allowlist" },
    mac: { layer: "same proxy", output: "same 403 body (not run)" },
  },
  {
    id: "noproxy",
    cmd: "curl --noproxy '*' https://example.com",
    gloss: "ignore the proxy and dial directly",
    verdict: "deny",
    linux: {
      layer: "--unshare-net: the namespace has only lo, no route and no resolver, so even the allowed host is unreachable",
      output: "curl: (6) Could not resolve host: example.com",
    },
    mac: { layer: "the profile allows outbound only to the proxy's localhost ports; any other connect is refused", output: "connect denied by Seatbelt (from the profile; not run)" },
  },
  {
    id: "unix",
    cmd: "python3 -c 'socket.socket(socket.AF_UNIX)'",
    gloss: "open a Unix domain socket",
    verdict: "deny",
    linux: { layer: "apply-seccomp's BPF filter returns EPERM for socket(AF_UNIX, …)", output: "PermissionError: [Errno 1] Operation not permitted" },
    mac: { layer: "no (allow system-socket (socket-domain AF_UNIX)) unless allowUnixSockets lists a path", output: "Operation not permitted (from the profile; not run)" },
  },
  {
    id: "userns",
    cmd: "unshare -U true",
    gloss: "make a user namespace to undo the mounts",
    verdict: "deny",
    linux: { layer: "apply-seccomp's second filter refuses unshare/clone with CLONE_NEWUSER", output: "unshare: unshare failed: Operation not permitted" },
    mac: { layer: "not applicable: Seatbelt has no mount table to undo", output: "n/a" },
  },
]

const TONE: Record<Verdict, { label: string; color: string; bg: string }> = {
  allow: { label: "allowed", color: "oklch(0.55 0.14 150)", bg: "oklch(0.55 0.14 150 / 0.12)" },
  deny: { label: "blocked", color: "oklch(0.58 0.20 25)", bg: "oklch(0.58 0.20 25 / 0.12)" },
}

// --- network decision, ported from sandbox-manager.ts / domain-pattern.ts ---

function splitPort(pattern: string): { host: string; port?: number } {
  const p = pattern.trim()
  if (p.startsWith("[")) {
    const end = p.indexOf("]")
    const rest = p.slice(end + 1)
    return { host: p.slice(0, end + 1), port: rest.startsWith(":") ? Number(rest.slice(1)) : undefined }
  }
  const i = p.lastIndexOf(":")
  if (i > 0 && /^\d+$/.test(p.slice(i + 1))) return { host: p.slice(0, i), port: Number(p.slice(i + 1)) }
  return { host: p }
}

function matchesDomain(hostname: string, pattern: string): boolean {
  const h = hostname.toLowerCase()
  if (pattern === "*") return true
  if (pattern.startsWith("*.")) {
    if (/^[\d.]+$/.test(h) || h.includes(":")) return false
    return h.endsWith("." + pattern.slice(2).toLowerCase())
  }
  return h === pattern.toLowerCase()
}

function matchesWithPort(host: string, port: number, pattern: string): boolean {
  const { host: hp, port: pp } = splitPort(pattern)
  if (pp !== undefined && pp !== port) return false
  return matchesDomain(host, hp)
}

type Decision = { verdict: Verdict; step: number; why: string }

function decide(
  host: string,
  port: number,
  allowed: string[],
  denied: string[],
  strict: boolean,
  perCommand: string[],
  ask: "none" | "yes" | "no",
): Decision {
  const d = denied.find((p) => matchesWithPort(host, port, p))
  if (d) return { verdict: "deny", step: 1, why: `deniedDomains entry "${d}" matches` }
  const a = allowed.find((p) => matchesWithPort(host, port, p))
  if (a) return { verdict: "allow", step: 2, why: `allowedDomains entry "${a}" matches` }
  if (strict) return { verdict: "deny", step: 3, why: "strictAllowlist: host is not on the allow list" }
  const c = perCommand.find((p) => matchesWithPort(host, port, p))
  if (c) return { verdict: "allow", step: 4, why: `the per-command list for this invocation has "${c}"` }
  if (ask === "none") return { verdict: "deny", step: 5, why: "no ask callback: host is not on the allow list" }
  if (ask === "yes") return { verdict: "allow", step: 5, why: "the ask callback answered true" }
  return { verdict: "deny", step: 5, why: "the ask callback denied it (user denied)" }
}

const STEPS = ["deniedDomains", "allowedDomains", "strictAllowlist", "per-command list", "ask callback / default deny"]

const list = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)

export function PolicyLab() {
  const [id, setId] = useState("read-deny")
  const [os, setOs] = useState<"linux" | "mac">("linux")
  const a = ATTEMPTS.find((x) => x.id === id) ?? ATTEMPTS[0]
  const side = os === "linux" ? a.linux : a.mac
  const tone = TONE[a.verdict]

  const [allowed, setAllowed] = useState("example.com, *.npmjs.org, github.com:443")
  const [denied, setDenied] = useState("")
  const [perCmd, setPerCmd] = useState("")
  const [host, setHost] = useState("example.org")
  const [port, setPort] = useState("443")
  const [strict, setStrict] = useState(false)
  const [ask, setAsk] = useState<"none" | "yes" | "no">("none")
  const portN = /^\d+$/.test(port) ? Number(port) : 443
  const dec = decide(host.trim(), portN, list(allowed), list(denied), strict, list(perCmd), ask)
  const dt = TONE[dec.verdict]

  const input = "w-full rounded-md border border-border bg-background px-2 py-1 font-mono text-xs"

  return (
    <div className="not-prose my-8 space-y-6 rounded-xl border border-border bg-card p-4 text-sm">
      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          What srt did with each command
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          Linux outputs are copied from my runs of srt 0.0.81 (bubblewrap 0.9.0, Ubuntu 24.04). The macOS column is read
          from the Seatbelt profile generator and the README, not run.
        </p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {ATTEMPTS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setId(x.id)}
              className={cn(
                "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
                x.id === id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {x.cmd.length > 34 ? x.cmd.slice(0, 32) + "…" : x.cmd}
            </button>
          ))}
        </div>
        <div className="mb-2 flex gap-1.5">
          {(["linux", "mac"] as const).map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setOs(o)}
              className={cn(
                "rounded-full border px-3 py-0.5 text-xs",
                os === o ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
              )}
            >
              {o === "linux" ? "Linux (measured)" : "macOS (from source)"}
            </button>
          ))}
        </div>
        <div className="rounded-lg border border-border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <code className="font-mono text-xs">$ {a.cmd}</code>
            <span className="rounded px-1.5 py-0.5 text-[11px] font-semibold" style={{ color: tone.color, background: tone.bg }}>
              {tone.label}
            </span>
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{a.gloss}</div>
          <div className="mt-3 text-xs">
            <span className="font-semibold">Layer that decides:</span> {side.layer}
          </div>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-muted p-2 font-mono text-[11px] leading-relaxed">
            {side.output}
          </pre>
        </div>
      </div>

      <div>
        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          The proxy&apos;s decision, in srt&apos;s order
        </div>
        <p className="mb-3 text-xs text-muted-foreground">
          A port of the network check in sandbox-manager.ts. Lists are comma-separated; an entry may carry a :port.
          Note that *.npmjs.org does not match npmjs.org itself.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="space-y-1 text-xs">
            <span>allowedDomains</span>
            <input className={input} value={allowed} onChange={(e) => setAllowed(e.target.value)} />
          </label>
          <label className="space-y-1 text-xs">
            <span>deniedDomains</span>
            <input className={input} value={denied} onChange={(e) => setDenied(e.target.value)} placeholder="e.g. *:22" />
          </label>
          <label className="space-y-1 text-xs">
            <span>per-command allow list</span>
            <input className={input} value={perCmd} onChange={(e) => setPerCmd(e.target.value)} />
          </label>
          <div className="grid grid-cols-[1fr_5rem] gap-2">
            <label className="space-y-1 text-xs">
              <span>host</span>
              <input className={input} value={host} onChange={(e) => setHost(e.target.value)} />
            </label>
            <label className="space-y-1 text-xs">
              <span>port</span>
              <input className={input} value={port} onChange={(e) => setPort(e.target.value)} />
            </label>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
          <label className="flex items-center gap-1.5">
            <input type="checkbox" checked={strict} onChange={(e) => setStrict(e.target.checked)} />
            strictAllowlist
          </label>
          <span className="text-muted-foreground">ask callback:</span>
          {(["none", "yes", "no"] as const).map((v) => (
            <label key={v} className="flex items-center gap-1">
              <input type="radio" name="srt-ask" checked={ask === v} onChange={() => setAsk(v)} />
              {v === "none" ? "absent (CLI)" : v === "yes" ? "user allows" : "user denies"}
            </label>
          ))}
        </div>
        <ol className="mt-3 space-y-1">
          {STEPS.map((s, i) => {
            const n = i + 1
            const reached = n <= dec.step
            const here = n === dec.step
            return (
              <li
                key={s}
                className={cn("flex items-center gap-2 rounded-md px-2 py-1 text-xs", !reached && "opacity-40")}
                style={here ? { background: dt.bg } : undefined}
              >
                <span className="w-4 font-mono">{n}</span>
                <span className="font-mono">{s}</span>
                {here && (
                  <span className="ml-auto font-semibold" style={{ color: dt.color }}>
                    {dt.label}
                  </span>
                )}
              </li>
            )
          })}
        </ol>
        <div className="mt-2 text-xs">
          <span className="font-semibold">Why:</span> {dec.why}.
        </div>
      </div>
    </div>
  )
}
