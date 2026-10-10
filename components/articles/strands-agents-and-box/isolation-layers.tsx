"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Where does each kind of sandbox get to say no, and what can it see when it
// does? Box's column is read from strands-agents/box at 83075df: the design
// docs (architecture, containment, egress, limitations, macos-enforcement) and
// the action vocabulary in docs/user/policy/actions.md. The other three
// columns follow the mechanisms as their projects describe them and as Marc
// Brooker frames them in "Strands Box: The Big Picture": a container filters
// syscalls on a shared kernel, gVisor answers them from a user-space kernel,
// a Firecracker microVM boots a guest kernel behind a small device model.
// Nothing here runs anything; it is a static map of who decides what.

type Verdict = "deny" | "allow" | "coarse" | "none"

const V: Record<Verdict, { label: string; color: string; bg: string }> = {
  deny: { label: "can refuse it, by meaning", color: "oklch(0.55 0.14 150)", bg: "oklch(0.55 0.14 150 / 0.12)" },
  coarse: { label: "only a blunt rule", color: "oklch(0.62 0.15 65)", bg: "oklch(0.62 0.15 65 / 0.14)" },
  allow: { label: "goes through", color: "oklch(0.58 0.20 25)", bg: "oklch(0.58 0.20 25 / 0.12)" },
  none: { label: "not its job", color: "oklch(0.55 0.02 260)", bg: "oklch(0.55 0.02 260 / 0.14)" },
}

const COLS = [
  { id: "ctr", name: "Container", sub: "namespaces + seccomp, shared kernel" },
  { id: "gv", name: "gVisor", sub: "user-space kernel answers syscalls" },
  { id: "fc", name: "Firecracker", sub: "guest kernel behind KVM" },
  { id: "box", name: "Strands Box", sub: "Seatbelt + policy outside the sandbox" },
] as const

type ColId = (typeof COLS)[number]["id"]

type Attempt = {
  id: string
  cmd: string
  gloss: string
  cells: Record<ColId, { v: Verdict; text: string }>
}

const ATTEMPTS: Attempt[] = [
  {
    id: "slack",
    cmd: "curl -X POST https://slack.com/api/chat.postMessage",
    gloss: "the fourth post in ten minutes",
    cells: {
      ctr: { v: "coarse", text: "Sees connect() to an address and port. The request is TLS, so method, path and the count of earlier posts are invisible. Allow the host or don't." },
      gv: { v: "coarse", text: "Its netstack sees the same connection, still encrypted. Richer syscall view, same blind spot for the HTTP request." },
      fc: { v: "coarse", text: "The host sees packets leaving a virtual NIC: ciphertext. Brooker's word for policy at this layer is 'blunt'." },
      box: { v: "deny", text: "The egress gateway terminates TLS with the box's own CA and raises http:request with host, method and path. A temporal rule counts three 200 responses in 10m and the gateway answers 403 naming the rule." },
    },
  },
  {
    id: "rm",
    cmd: "rm -rf build/",
    gloss: "delete a directory the agent may write to",
    cells: {
      ctr: { v: "coarse", text: "unlinkat() on a writable mount succeeds. To forbid deletes you mount read-only, which also forbids edits." },
      gv: { v: "coarse", text: "The Sentry sees each unlinkat and could filter it, but gVisor offers no policy language for 'edit yes, delete no'." },
      fc: { v: "coarse", text: "The guest kernel deletes; the host sees block writes at offsets. Nothing there says 'a file was removed'." },
      box: { v: "deny", text: "Strands Shell resolves the command and raises fs:delete for every file it would remove. A forbid on fs:delete stops it before the first unlink, while fs:write edits still pass." },
    },
  },
  {
    id: "exfil",
    cmd: "python3 -c \"data=open('customers.csv').read(); fetch(url, body=data)\"",
    gloss: "read private data, then send it out",
    cells: {
      ctr: { v: "allow", text: "Two unrelated syscalls on two subsystems. No component remembers the read when the connect happens." },
      gv: { v: "allow", text: "Same: it can see both calls, but nothing connects them into one rule." },
      fc: { v: "allow", text: "A block read and later some packets. The link between them lives only inside the guest." },
      box: { v: "deny", text: "The box's python3 is Monty: open() pauses the interpreter and raises fs:read, fetch() goes through the gateway as http:request. One engine, one history, so 'no HTTP after reading customer data' is a single rule. (import requests fails: Monty is a subset.)" },
    },
  },
  {
    id: "ssh",
    cmd: "cat ~/.ssh/id_ed25519",
    gloss: "read a credential the agent was never given",
    cells: {
      ctr: { v: "deny", text: "Not mounted, so it does not exist inside the container." },
      gv: { v: "deny", text: "Not in the sandbox's filesystem view." },
      fc: { v: "deny", text: "Not in the guest image." },
      box: { v: "deny", text: "Two routes. The agent's own open() hits Seatbelt, and Box refuses any grant that encloses ~/.ssh. Through Strands Shell it is an fs:read decision with no credential floor beneath it, so a path-free permit would read it. Scope every rule by path." },
    },
  },
  {
    id: "spin",
    cmd: ":(){ :|:& };:   # or a loop that fills the disk",
    gloss: "exhaust processes, CPU or disk",
    cells: {
      ctr: { v: "deny", text: "cgroups cap pids, CPU and memory per container." },
      gv: { v: "deny", text: "Runs under cgroups like any container runtime." },
      fc: { v: "deny", text: "The VM gets a fixed number of vCPUs and a fixed memory size." },
      box: { v: "none", text: "Documented non-goal: 'a box doesn't bound process creation, CPU, or disk use'. Set limits outside Box." },
    },
  },
  {
    id: "kernel",
    cmd: "an exploit against the host kernel",
    gloss: "escape the boundary itself",
    cells: {
      ctr: { v: "allow", text: "The container shares the host kernel, so a kernel bug is an escape." },
      gv: { v: "coarse", text: "Most syscalls never reach the host kernel; the Sentry answers them. The host surface is much smaller." },
      fc: { v: "deny", text: "The attacker owns a guest kernel and still faces KVM and a minimal VMM." },
      box: { v: "allow", text: "Documented: 'an exploit that defeats the kernel defeats the box'. AWS recommends a per-session microVM around Box for multi-tenant cloud use." },
    },
  },
]

const BOOT = [
  { n: "1", t: "Harden the trusted process", d: "refuse a same-user process its address space (defence in depth; root bypasses it)" },
  { n: "2", t: "Read box.toml, take the run lock", d: "record each file's identity, act on identity not name from then on" },
  { n: "3", t: "Open the collector", d: "decisions go to <box_dir>/private/telemetry/records.jsonl as OTLP JSON" },
  { n: "4", t: "Install policy.dw", d: "refuse a policy that does not parse or validate, or a rule that can never fire" },
  { n: "5", t: "Secrets, gateway CA, broker socket", d: "resolve bound secrets, mint a CA in memory, bind run/box.sock" },
  { n: "6", t: "Build and print every sandbox grant", d: "each tool first, then the agent, on stderr: no fs:* decision covers these" },
  { n: "7", t: "Start the trampoline", d: "it applies the Seatbelt profile to itself with sandbox_init(), then becomes the agent" },
]

export function IsolationLayers() {
  const [view, setView] = useState<"where" | "boot">("where")
  const [id, setId] = useState(ATTEMPTS[0].id)
  const a = ATTEMPTS.find((x) => x.id === id) ?? ATTEMPTS[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">where each boundary can say no</span>
        <div className="flex gap-1">
          {(["where", "boot"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setView(k)}
              aria-pressed={view === k}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10px]",
                view === k ? "border-foreground/40 bg-background text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              {k === "where" ? "attempts" : "how a box comes up"}
            </button>
          ))}
        </div>
      </div>

      {view === "where" ? (
        <div className="space-y-3 p-3 sm:p-4">
          <div className="flex flex-wrap gap-1">
            {ATTEMPTS.map((x) => (
              <button
                key={x.id}
                type="button"
                onClick={() => setId(x.id)}
                aria-pressed={x.id === id}
                className={cn(
                  "rounded-md border px-2 py-1 text-left text-[11px]",
                  x.id === id ? "border-foreground/40 bg-background text-foreground" : "border-transparent bg-background/40 text-muted-foreground",
                )}
              >
                {x.gloss}
              </button>
            ))}
          </div>
          <code className="block overflow-x-auto rounded-md border bg-background/60 px-3 py-2 font-mono text-[11px] text-foreground">
            {a.cmd}
          </code>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {COLS.map((c) => {
              const cell = a.cells[c.id]
              const v = V[cell.v]
              return (
                <div
                  key={c.id}
                  className={cn("rounded-lg border bg-background/60 p-3", c.id === "box" && "border-foreground/30")}
                >
                  <div className="font-mono text-[12px] font-medium text-foreground">{c.name}</div>
                  <div className="text-[10px] text-muted-foreground">{c.sub}</div>
                  <span
                    className="mt-2 inline-block rounded-full px-2 py-0.5 font-mono text-[10px]"
                    style={{ color: v.color, background: v.bg }}
                  >
                    {v.label}
                  </span>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground">{cell.text}</p>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <ol className="space-y-0 p-3 sm:p-4">
          {BOOT.map((b, k) => (
            <li key={b.n} className="grid grid-cols-[auto_1fr] gap-x-3">
              <div className="flex flex-col items-center">
                <span className="flex size-5 items-center justify-center rounded-full border font-mono text-[10px]">{b.n}</span>
                {k < BOOT.length - 1 ? <span className="w-px flex-1 bg-border" /> : null}
              </div>
              <div className="pb-3">
                <div className="font-mono text-[12px] text-foreground">{b.t}</div>
                <div className="text-[12px] leading-5 text-muted-foreground">{b.d}</div>
              </div>
            </li>
          ))}
          <li className="pl-8 text-[12px] leading-5 text-muted-foreground">
            Teardown runs backwards: the workload is reaped first, the lock releases last, and the collector drains after that.
          </li>
        </ol>
      )}

      <figcaption className="border-t px-4 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
        Box column and boot order from the strands-agents/box design docs at 83075df. The other columns describe each mechanism&apos;s
        layer, not any one product&apos;s configuration.
      </figcaption>
    </figure>
  )
}
