"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The request path out of a SPACE guest, stage by stage. Pick a request the
// agent makes and see which stage decides, and what the guest sees versus
// what the upstream server receives. Stages and their order are read from the
// SPACE source at b9fc395:
//   node-mgr firewall.rs            "drop-spoofed-guest-source" on tap0, then TPROXY to the gateway
//   net/common lib.rs               platform hard-deny CIDRs > explicit deny > explicit allow
//                                   > DNS-attributed domain allow > default action
//   gateway tls_interception, tcp_proxy/tls_http, routing_headers.rs
//                                   TLS terminated by a per-execution CA, SNI/Host checks
//   gateway tcp_proxy/tls_http/credentials.rs + proto/net/policy/v1/policy.proto
//                                   header injection for an exact host, port, path prefix, GET/POST
// Hostnames are placeholders. This is a static trace, not a live call.

type Verdict = "inject" | "allow" | "deny" | "drop" | "nocred"

const V: Record<Verdict, { label: string; color: string }> = {
  inject: { label: "allowed · credential attached by gateway", color: "oklch(0.58 0.15 255)" },
  allow: { label: "allowed · no credential", color: "oklch(0.56 0.14 150)" },
  nocred: { label: "allowed · sent without the credential", color: "oklch(0.64 0.15 70)" },
  deny: { label: "denied by gateway", color: "oklch(0.58 0.20 25)" },
  drop: { label: "dropped before the gateway", color: "oklch(0.50 0.12 330)" },
}

type Stage = { at: string; text: string; decides?: boolean }

type Req = {
  id: string
  line: string
  gloss: string
  stages: Stage[]
  verdict: Verdict
  guest: string
  upstream: string
}

const POLICY = [
  "default_action: deny",
  "allow: domain pypi.org, domain api.vendor.example",
  "network_credential_rules:",
  "  exact_host api.vendor.example, path_prefix /v1",
  "  methods [POST], header Authorization -> ref 7f3c…",
]

const TAP = { at: "tap0 · nftables", text: "source address equals the VM's assigned address; packet continues" }
const TPROXY = { at: "TPROXY", text: "node-manager's rule hands the flow to this sandbox's gateway" }

const REQS: Req[] = [
  {
    id: "post",
    line: "POST https://api.vendor.example/v1/messages",
    gloss: "call the API the credential is for",
    stages: [
      TAP,
      TPROXY,
      { at: "guardrails", text: "not metadata, link-local, loopback or a sandbox slot range" },
      { at: "policy", text: "domain allow, and the destination IP is attributed to that name by DNS the gateway watched" },
      { at: "TLS", text: "gateway terminates TLS with a leaf from its own per-execution CA; SNI and Host both name the allowed host" },
      { at: "credential", text: "exact host, /v1 prefix and POST all match the rule; the gateway sets Authorization from its zeroizing store", decides: true },
      { at: "dial", text: "new TLS connection upstream from the host side, marked so it is not captured again" },
    ],
    verdict: "inject",
    guest: "POST /v1/messages\nHost: api.vendor.example\n(no Authorization header; the guest has no key)",
    upstream: "POST /v1/messages\nHost: api.vendor.example\nAuthorization: ••••••••  (set by the gateway)",
  },
  {
    id: "delete",
    line: "DELETE https://api.vendor.example/v1/files/42",
    gloss: "same host, a method the rule does not list",
    stages: [
      TAP,
      TPROXY,
      { at: "guardrails", text: "no platform deny matches" },
      { at: "policy", text: "domain allow, DNS-attributed: egress is permitted" },
      { at: "TLS", text: "terminated and inspected as above" },
      { at: "credential", text: "version one of the rule format supports only GET and POST, and this rule lists POST; nothing is attached", decides: true },
    ],
    verdict: "nocred",
    guest: "DELETE /v1/files/42\nHost: api.vendor.example",
    upstream: "DELETE /v1/files/42\nHost: api.vendor.example\n(no credential: the upstream should refuse it)",
  },
  {
    id: "prefix",
    line: "POST https://api.vendor.example/v10/admin",
    gloss: "a path outside the prefix",
    stages: [
      TAP,
      TPROXY,
      { at: "policy", text: "domain allow, DNS-attributed" },
      { at: "TLS", text: "terminated and inspected" },
      { at: "credential", text: "prefixes are segment-aware: /v1 matches /v1 and /v1/…, not /v10; nothing is attached", decides: true },
    ],
    verdict: "nocred",
    guest: "POST /v10/admin\nHost: api.vendor.example",
    upstream: "POST /v10/admin\nHost: api.vendor.example\n(no credential)",
  },
  {
    id: "pypi",
    line: "GET https://pypi.org/simple/numpy/",
    gloss: "install a package",
    stages: [
      TAP,
      TPROXY,
      { at: "guardrails", text: "no platform deny matches" },
      { at: "policy", text: "domain allow; destination IP attributed to pypi.org by observed DNS", decides: true },
      { at: "TLS", text: "SNI and Host must both be the allowed, attributed name" },
      { at: "credential", text: "no rule for this host" },
    ],
    verdict: "allow",
    guest: "GET /simple/numpy/\nHost: pypi.org",
    upstream: "GET /simple/numpy/\nHost: pypi.org",
  },
  {
    id: "imds",
    line: "GET http://169.254.169.254/latest/meta-data/",
    gloss: "reach the cloud metadata service",
    stages: [
      TAP,
      TPROXY,
      { at: "guardrails", text: "169.254.169.254/32 is a platform hard deny; it precedes every tenant rule, even default allow", decides: true },
    ],
    verdict: "deny",
    guest: "GET /latest/meta-data/",
    upstream: "(nothing leaves the host)",
  },
  {
    id: "unlisted",
    line: "GET https://unlisted.example/",
    gloss: "a host nobody allowed",
    stages: [
      TAP,
      TPROXY,
      { at: "guardrails", text: "no platform deny matches" },
      { at: "policy", text: "no explicit allow, no DNS attribution to an allowed name, default action is deny", decides: true },
    ],
    verdict: "deny",
    guest: "GET /\nHost: unlisted.example",
    upstream: "(nothing leaves the host)",
  },
  {
    id: "mismatch",
    line: "TLS: SNI names pypi.org, HTTP Host names another site",
    gloss: "hostname layers disagree",
    stages: [
      TAP,
      TPROXY,
      { at: "policy", text: "the IP is attributed to an allowed name, so the connection is admitted to inspection" },
      { at: "TLS", text: "after remediation the gateway requires the SNI and every hostname in the request to be allowlisted and attributed to this IP; known CDN routing headers are stripped", decides: true },
    ],
    verdict: "deny",
    guest: "ClientHello SNI: pypi.org\nHost: other.example",
    upstream: "(rejected at the gateway)",
  },
  {
    id: "spoof",
    line: "a packet whose source is not the VM's address",
    gloss: "root in the guest can craft any packet",
    stages: [
      { at: "tap0 · nftables", text: "the drop-spoofed-guest-source rule drops it before TPROXY; the gateway never sees it", decides: true },
    ],
    verdict: "drop",
    guest: "(raw packet, forged source)",
    upstream: "(dropped in the sandbox network namespace)",
  },
]

export function EgressPath() {
  const [id, setId] = useState(REQS[0].id)
  const r = REQS.find((x) => x.id === id) ?? REQS[0]
  const v = V[r.verdict]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">guest request · where it is decided · what each side sees</span>
        <span
          className="rounded-full px-2 py-0.5 font-mono text-[11px] font-medium"
          style={{ color: v.color, background: "color-mix(in oklch, currentColor 12%, transparent)" }}
        >
          {v.label}
        </span>
      </div>

      <div className="grid gap-4 p-4 md:grid-cols-[0.9fr_1.4fr]">
        <div className="space-y-1">
          {REQS.map((x) => {
            const on = x.id === id
            return (
              <button
                key={x.id}
                type="button"
                aria-pressed={on}
                onClick={() => setId(x.id)}
                className={cn(
                  "w-full rounded-lg border px-3 py-1.5 text-left transition-colors",
                  on ? "border-foreground/40 bg-background" : "border-transparent bg-background/40 hover:bg-background/70",
                )}
              >
                <div className={cn("truncate font-mono text-[11px]", on ? "text-foreground" : "text-muted-foreground")}>
                  {x.line}
                </div>
                <div className="truncate text-[10px] text-muted-foreground">{x.gloss}</div>
              </button>
            )
          })}
          <pre className="mt-3 overflow-x-auto rounded-md border bg-background/60 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
            {POLICY.join("\n")}
          </pre>
        </div>

        <div className="space-y-3">
          <ol className="space-y-1">
            {r.stages.map((s, i) => (
              <li
                key={`${r.id}-${i}`}
                className={cn(
                  "grid grid-cols-[6.5rem_1fr] gap-2 rounded-md px-2 py-1.5 text-[12px] leading-snug",
                  s.decides ? "bg-background ring-1" : "",
                )}
                style={s.decides ? { boxShadow: `inset 3px 0 0 ${v.color}` } : undefined}
              >
                <span className="font-mono text-[11px] text-muted-foreground">{s.at}</span>
                <span>{s.text}</span>
              </li>
            ))}
          </ol>
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-md border bg-background/60 p-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">inside the guest</div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{r.guest}</pre>
            </div>
            <div className="rounded-md border bg-background/60 p-2">
              <div className="mb-1 font-mono text-[10px] uppercase tracking-wide text-muted-foreground">what upstream receives</div>
              <pre className="whitespace-pre-wrap font-mono text-[11px] leading-relaxed">{r.upstream}</pre>
            </div>
          </div>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 text-[11px] leading-relaxed text-muted-foreground">
        A static trace of the SPACE egress path at <code>b9fc395</code>, with placeholder hostnames. Network
        credentials are off by default (<code>SPACE_SBXMGR_NETWORK_CREDENTIALS_ENABLED</code>), and a host listed as a
        TLS interception exemption skips inspection and injection entirely.
      </figcaption>
    </figure>
  )
}
