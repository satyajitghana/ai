"use client"

// The week's board: every item in the article, with the published facts only
// (CVSS as the CNA published it, KEV date from CISA's catalog JSON version
// 2026.10.21, fixed versions from the vendor advisory). The order is a risk
// score built from three published facts rather than from CVSS:
//
//   exploited:  malicious release shipped = 3 · in KEV = 3
//               · confirmed platform breach = 3
//               · exploitation attempts reported by a vendor = 2
//               · keys publicly recovered = 2 · none reported = 0
//   access:     no authentication = 2 · authenticated user = 1
//               · admin or local = 0
//   reach:      internet-facing appliance or web runtime = 2
//               · conditional (needs a specific config or data path) = 1
//               · local only = 0
//
// For a malicious release, access is "none" and reach is "edge": whoever
// installed it already ran the attacker's code. Ties break on how direct
// the exploitation evidence is (malicious, KEV, attempts, breach, keys,
// none), then on CVSS. CVSS is shown, never summed in. The prose explains why.

import { useMemo, useState } from "react"

type Exploited = "malicious" | "kev" | "breach" | "attempts" | "keys" | "none"
type Access = "none" | "user" | "admin" | "local"
type Reach = "edge" | "conditional" | "local"

type Item = {
  name: string
  ids: string
  kind: "runtime" | "appliance" | "pki" | "app" | "desktop" | "ai" | "platform"
  cls: string
  cvss: string
  kev: string | null
  exploited: Exploited
  access: Access
  reach: Reach
  poc: boolean | null
  fix: string
}

const ITEMS: Item[] = [
  { name: "LiteLLM 1.107.0 (PyPI, Docker)", ids: "Malicious release, no CVE", kind: "ai", cls: "Supply-chain compromise: credential stealer and remote loader at install", cvss: "n/a", kev: null, exploited: "malicious", access: "none", reach: "edge", poc: null, fix: "Pin 1.106.2 or earlier; rebuild; rotate every secret the host reached" },
  { name: "Railway", ids: "Disclosure, 21 Oct", kind: "platform", cls: "Unauthorized access to stored environment variables", cvss: "n/a", kev: null, exploited: "breach", access: "none", reach: "conditional", poc: null, fix: "Rotate all env vars, API keys and registry credentials" },
  { name: "TiDB Cloud (PingCAP)", ids: "Incident report, 19 Oct", kind: "platform", cls: "Stolen service-account credentials, 9 Sep to 7 Oct", cvss: "n/a", kev: null, exploited: "breach", access: "none", reach: "conditional", poc: null, fix: "Credentials invalidated 14 Oct; await PingCAP notice" },
  { name: "Zeabur", ids: "Incident, 14 Oct", kind: "platform", cls: "Unauthorized access to internal systems and some customer services", cvss: "n/a", kev: null, exploited: "breach", access: "none", reach: "conditional", poc: null, fix: "Migrate before 31 Dec shutdown; rotate deployed secrets" },
  { name: "GitLab CE/EE (self-managed)", ids: "CVE-2026-110264", kind: "app", cls: "Integer overflow in regex compilation, unauthenticated RCE", cvss: "10.0 (v3.1)", kev: null, exploited: "none", access: "none", reach: "edge", poc: null, fix: "19.5.1 · 19.4.3 · 19.3.6 · 19.2.9 · 19.1.9 · 19.0.10 · 18.11.13" },
  { name: "WordPress core (XSS2Shell)", ids: "CVE-2026-64638", kind: "app", cls: "Pre-auth reflected XSS on login screen; RCE needs victim interaction", cvss: "8.9 (v4.0)", kev: null, exploited: "none", access: "user", reach: "edge", poc: true, fix: "7.0.3 (6 Aug), backported to 4.7+" },
  { name: "PHP (php2shell)", ids: "CVE-2026-109618, CVE-2026-109619", kind: "runtime", cls: "Use-after-free / uninitialised state in request handling", cvss: "9.2 (v4.0)", kev: null, exploited: "attempts", access: "none", reach: "edge", poc: true, fix: "8.5.12 · 8.4.27 · 8.3.36 · 8.2.35, then restart workers" },
  { name: "eMudhra intermediates", ids: "Bugzilla 2083449 (no CVE)", kind: "pki", cls: "Weak CA private keys (P-384 scalars below 256)", cvss: "n/a", kev: null, exploited: "keys", access: "none", reach: "conditional", poc: true, fix: "Revoked 18 Oct; browsers blocked; emSign ECC Root CA - G3 removed. Update trust stores." },
  { name: "Ivanti Connect Secure", ids: "CVE-2026-104935", kind: "appliance", cls: "Authentication bypass by spoofing", cvss: "8.6 (v3.1)", kev: "2026-10-13", exploited: "kev", access: "none", reach: "edge", poc: null, fix: "Per Ivanti advisory; 22.7R2.14 and earlier not affected" },
  { name: "Cisco Secure Email Gateway", ids: "CVE-2026-76519", kind: "appliance", cls: "Relative path traversal, arbitrary file write", cvss: "9.8 (v3.1)", kev: "2026-10-14", exploited: "kev", access: "none", reach: "edge", poc: null, fix: "Per cisco-sa-esa-afw-zqYJkjxp" },
  { name: "Ahsay AhsayCBS", ids: "CVE-2026-105133, CVE-2026-105134", kind: "appliance", cls: "Auth bypass chained with OS command injection", cvss: "10.0 (v3.1, VulDB)", kev: "2026-10-14", exploited: "kev", access: "none", reach: "edge", poc: true, fix: "Ahsay patch announcement; affected up to 10.3.2" },
  { name: "Atlassian Data Center", ids: "CVE-2026-21589", kind: "app", cls: "Unauthenticated file read in web root", cvss: "9.3 (v4.0)", kev: "2026-10-15", exploited: "kev", access: "none", reach: "edge", poc: null, fix: "Per product: e.g. Confluence 10.2.19 / 9.2.26, Jira 11.3.12 / 10.3.26" },
  { name: "BeyondTrust Remote Support", ids: "CVE-2026-102764", kind: "appliance", cls: "Improper origin validation, file operations", cvss: "9.3 (v4.0)", kev: "2026-10-16", exploited: "kev", access: "none", reach: "edge", poc: null, fix: "26.2.3 (advisory BT26-05)" },
  { name: "Plex Media Server", ids: "CVE-2026-96652, -96654, -96655, -96656", kind: "app", cls: "SSRF and URL injection chained to admin file write", cvss: "5.3 to 8.6 (v4.0)", kev: "2026-10-20", exploited: "kev", access: "user", reach: "edge", poc: null, fix: "1.43.3.10861" },
  { name: "Windows Shell", ids: "CVE-2026-96951", kind: "desktop", cls: "Command injection, security feature bypass", cvss: "8.8 (v3.1)", kev: "2026-10-13", exploited: "kev", access: "user", reach: "conditional", poc: null, fix: "October 2026 cumulative update" },
  { name: "Palo Alto PAN-OS", ids: "CVE-2026-0322", kind: "appliance", cls: "Code injection in management interface", cvss: "8.6 (v4.0)", kev: "2026-10-14", exploited: "kev", access: "admin", reach: "conditional", poc: null, fix: "e.g. 12.2.4, 11.2.16; restrict the management interface" },
  { name: "Node.js (Node2Shell)", ids: "CVE-2026-111497; TLS: CVE-2026-105483, CVE-2026-106069", kind: "runtime", cls: "Brotli decoder out-of-bounds write; two TLS hostname-check bypasses", cvss: "9.2 (v4.0, CNA); High (Node.js)", kev: null, exploited: "none", access: "none", reach: "conditional", poc: true, fix: "22.23.4 · 24.22.1 · 26.12.1" },
  { name: "Fortinet FortiOS and others", ids: "CVE-2025-61624", kind: "appliance", cls: "Path traversal via admin CLI", cvss: "5.4 (v3.1)", kev: "2026-10-16", exploited: "kev", access: "admin", reach: "conditional", poc: null, fix: "Per FG-IR-26-122" },
  { name: "SiteGuard Server Edition", ids: "CVE-2026-106931", kind: "app", cls: "OS command injection (local)", cvss: "8.5 (v4.0)", kev: "2026-10-20", exploited: "kev", access: "local", reach: "local", poc: null, fix: "8.00 Update 5 or later" },
  { name: "Siemens Software Center", ids: "CVE-2026-110936", kind: "desktop", cls: "Uncontrolled DLL search path (local)", cvss: "8.4 (v4.0)", kev: "2026-10-20", exploited: "kev", access: "local", reach: "local", poc: null, fix: "V4.0.9.8" },
  { name: "vLLM", ids: "CVE-2026-114049", kind: "ai", cls: "Cross-request constraint mask leak", cvss: "6.3 (v4.0)", kev: null, exploited: "none", access: "none", reach: "conditional", poc: null, fix: "0.31.0" },
]

const E: Record<Exploited, number> = { malicious: 3, kev: 3, breach: 3, attempts: 2, keys: 2, none: 0 }
const TIE: Record<Exploited, number> = { malicious: 5, kev: 4, attempts: 3, breach: 2, keys: 1, none: 0 }
const A: Record<Access, number> = { none: 2, user: 1, admin: 0, local: 0 }
const R: Record<Reach, number> = { edge: 2, conditional: 1, local: 0 }
const score = (i: Item) => E[i.exploited] + A[i.access] + R[i.reach]

const EX_LABEL: Record<Exploited, string> = {
  malicious: "Malicious release shipped",
  kev: "In KEV",
  breach: "Confirmed breach",
  attempts: "Attempts reported (vendor)",
  keys: "Keys publicly recovered",
  none: "None reported",
}

const KINDS = ["all", "runtime", "appliance", "app", "platform", "pki", "desktop", "ai"] as const

export function WeekBoard() {
  const [kind, setKind] = useState<(typeof KINDS)[number]>("all")
  const [kevOnly, setKevOnly] = useState(false)
  const [sortBy, setSortBy] = useState<"risk" | "cvss">("risk")

  const rows = useMemo(() => {
    const r = ITEMS.filter((i) => (kind === "all" || i.kind === kind) && (!kevOnly || i.kev))
    const cv = (i: Item) => Number.parseFloat(i.cvss) || 0
    return [...r].sort((a, b) => (sortBy === "risk" ? score(b) - score(a) || TIE[b.exploited] - TIE[a.exploited] || cv(b) - cv(a) : cv(b) - cv(a)))
  }, [kind, kevOnly, sortBy])

  return (
    <div className="not-prose my-6 rounded-lg border border-border p-3 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          Kind
          <select value={kind} onChange={(e) => setKind(e.target.value as (typeof KINDS)[number])} className="rounded border border-border bg-background px-1 py-0.5">
            {KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={kevOnly} onChange={(e) => setKevOnly(e.target.checked)} />
          KEV only
        </label>
        <label className="flex items-center gap-1">
          Sort
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as "risk" | "cvss")} className="rounded border border-border bg-background px-1 py-0.5">
            <option value="risk">Real-world risk</option>
            <option value="cvss">CVSS only</option>
          </select>
        </label>
        <span className="text-muted-foreground">{rows.length} items</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="py-1 pr-2">Risk</th>
              <th className="py-1 pr-2">Component</th>
              <th className="py-1 pr-2">Class</th>
              <th className="py-1 pr-2">CVSS</th>
              <th className="py-1 pr-2">Exploitation</th>
              <th className="py-1 pr-2">Public PoC</th>
              <th className="py-1">Fixed in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((i) => (
              <tr key={i.ids} className="border-b border-border/60 align-top">
                <td className="py-1.5 pr-2 font-mono">{score(i)}/7</td>
                <td className="py-1.5 pr-2">
                  <div className="font-medium">{i.name}</div>
                  <div className="font-mono text-xs text-muted-foreground">{i.ids}</div>
                </td>
                <td className="py-1.5 pr-2">{i.cls}</td>
                <td className="py-1.5 pr-2 font-mono text-xs">{i.cvss}</td>
                <td className="py-1.5 pr-2">
                  {EX_LABEL[i.exploited]}
                  {i.kev ? <div className="font-mono text-xs text-muted-foreground">added {i.kev}</div> : null}
                </td>
                <td className="py-1.5 pr-2">{i.poc === null ? "not stated" : i.poc ? "yes" : "no"}</td>
                <td className="py-1.5 text-xs">{i.fix}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Risk = exploitation (malicious release, KEV or confirmed breach 3; reported attempts or public keys 2; none 0) + access (none 2, user 1, admin or local 0) +
        reach (internet-facing 2, conditional 1, local 0). CVSS is shown but not added in. PoC is yes, no or not stated, from the CVE record or the vendor; no links.
      </p>
    </div>
  )
}
