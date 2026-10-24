"use client"

// Every CVE behind the "single day" post of 22 October 00:06 UTC: PHP 2,
// Node.js 10, NGINX 5, Go 1, GitLab 12. One row per CVE, copied from the
// vendor's advisory and, where one exists, the CVE record (CNA container)
// read on 23 October. Severity is exactly as published: a CVSS vector and
// its version where the CNA gave one, otherwise the vendor's own word
// (Node.js publishes only high/medium/low, and its CVE records were not yet
// public). KEV status is from CISA's catalog 2026.10.21, re-read 23 October:
// none of these thirty is in it. No exploit details, by design.

import { useMemo, useState } from "react"

type Project = "PHP" | "Node.js" | "NGINX" | "Go" | "GitLab"
type Access = "none" | "user" | "admin" | "local" | "n/a"

type Cve = {
  p: Project
  id: string
  component: string
  cls: string
  sev: "critical" | "high" | "medium" | "low" | "unscored"
  score: number | null
  vector: string | null
  access: Access
  affected: string
  fixed: string
  published: string
}

const ROWS: Cve[] = [
  // PHP: GHSA-w8hw-w9fx-j79w, GHSA-6wmf-4rv5-p3rp; CVE records.
  { p: "PHP", id: "CVE-2026-109618", component: "Request lifecycle (OOM path)", cls: "Use of partly initialised memory after an out-of-memory abort", sev: "critical", score: 9.2, vector: "CVSS:4.0/AV:N/AC:H/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", access: "none", affected: "8.2 to 8.5 below the fix; 7.4 to 8.1 source backports only", fixed: "8.5.12 · 8.4.27 · 8.3.36 · 8.2.35", published: "21 Oct" },
  { p: "PHP", id: "CVE-2026-109619", component: "Request-owned global state", cls: "Use after free of stale global state across requests", sev: "critical", score: 9.2, vector: "CVSS:4.0/AV:N/AC:H/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N", access: "none", affected: "8.2 to 8.5 below the fix; 7.4 to 8.1 source backports only", fixed: "8.5.12 · 8.4.27 · 8.3.36 · 8.2.35", published: "21 Oct" },

  // Node.js: October 2026 security release page. Only CVE-2026-111497 has a
  // published CVE record (Google as CNA); the others had none on 23 October.
  { p: "Node.js", id: "CVE-2026-111497", component: "zlib (bundled Brotli decoder)", cls: "Out-of-bounds write (CWE-787)", sev: "high", score: 9.2, vector: "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N (Google, CNA)", access: "none", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-105482", component: "dns.resolve", cls: "Names containing a NUL character are truncated", sev: "high", score: null, vector: null, access: "none", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-105483", component: "tls hostname check", cls: "Certificate hostname bypass for IPs written in fullwidth digits", sev: "high", score: null, vector: null, access: "none", affected: "24.x, 26.x", fixed: "24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106069", component: "tls hostname check", cls: "Certificate hostname bypass when the host loosely resolves to an IP", sev: "high", score: null, vector: null, access: "none", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-105481", component: "http client keep-alive", cls: "A response written before the request was sent is processed as its reply", sev: "medium", score: null, vector: null, access: "none", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106072", component: "tls certificate validation", cls: "DNS SANs accepted for non-canonical IPv4 endpoints", sev: "medium", score: null, vector: null, access: "none", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106074", component: "crypto.randomUUID, randomInt", cls: "Entropy cache saved into startup snapshots and SEAs, so processes repeat values", sev: "medium", score: null, vector: null, access: "n/a", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106070", component: "ZipFile", cls: "Returns attacker-controlled prefix bytes after a failed header check", sev: "low", score: null, vector: null, access: "none", affected: "26.x", fixed: "26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106071", component: "Permission Model", cls: "Filesystem over-grant via wildcard lookup", sev: "low", score: null, vector: null, access: "local", affected: "26.x", fixed: "26.12.1", published: "21 Oct" },
  { p: "Node.js", id: "CVE-2026-106073", component: "Permission Model", cls: "Bypass with fs.realpathSync", sev: "low", score: null, vector: null, access: "local", affected: "22.x, 24.x, 26.x", fixed: "22.23.4 · 24.22.1 · 26.12.1", published: "21 Oct" },

  // NGINX: nginx.org security advisories + F5's CVE records (published
  // 14 October, not 21). nginx.org rates all five "medium"; F5's CVSS is below.
  { p: "NGINX", id: "CVE-2026-15176", component: "core: alias with rewrite", cls: "Heap buffer overflow in a worker (CWE-122)", sev: "critical", score: 9.2, vector: "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N; 3.1: 8.1", access: "none", affected: "OSS 0.1.29 to 1.31.6; Plus R33 to R36, 37.0.x below 37.0.5.1, 37.1.0", fixed: "OSS 1.31.7 · 1.30.6; Plus 37.0.5.1 · 37.1.0.1", published: "14 Oct" },
  { p: "NGINX", id: "CVE-2026-93479", component: "script evaluation (map with regex)", cls: "Heap buffer overflow in a worker (CWE-122)", sev: "critical", score: 9.2, vector: "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N; 3.1: 8.1", access: "none", affected: "OSS 1.31.2 to 1.31.6, 1.30.0 to 1.30.5; Plus as above", fixed: "OSS 1.31.7 · 1.30.6; Plus 37.0.5.1 · 37.1.0.1", published: "14 Oct" },
  { p: "NGINX", id: "CVE-2026-97205", component: "core: AIO with SSI", cls: "Use after free in a worker (CWE-416)", sev: "critical", score: 9.2, vector: "CVSS:4.0/AV:N/AC:H/AT:N/PR:N/UI:N/VC:H/VI:H/VA:H/SC:N/SI:N/SA:N; 3.1: 8.1", access: "none", affected: "OSS 0.8.11 to 1.31.6; Plus as above", fixed: "OSS 1.31.7 · 1.30.6; Plus 37.0.5.1 · 37.1.0.1", published: "14 Oct" },
  { p: "NGINX", id: "CVE-2026-97629", component: "ssl: session ticket key rotation", cls: "Uninitialised ticket key, session forgery (CWE-908)", sev: "high", score: 8.3, vector: "CVSS:4.0/AV:N/AC:L/AT:P/PR:N/UI:N/VC:H/VI:L/VA:N/SC:N/SI:N/SA:N; 3.1: 6.5", access: "none", affected: "OSS 1.23.2 to 1.31.6; Plus as above", fixed: "OSS 1.31.7 · 1.30.6; Plus 37.0.5.1 · 37.1.0.1", published: "14 Oct" },
  { p: "NGINX", id: "CVE-2026-95101", component: "HTTP/3 (ngx_http_v3_module)", cls: "Request body injection into the proxied request (CWE-172)", sev: "medium", score: 6.9, vector: "CVSS:4.0/AV:N/AC:L/AT:N/PR:N/UI:N/VC:N/VI:L/VA:N/SC:N/SI:N/SA:N; 3.1: 5.3", access: "none", affected: "OSS 1.25.0 to 1.31.6; Plus R33 to R36, 37.0.x below 37.0.7.1, 37.1 to 37.2.0", fixed: "OSS 1.31.7 · 1.30.6; Plus 37.0.7.1 · 37.2.0.1", published: "14 Oct" },

  // Go: GO-2026-6809 (vuln.go.dev), CVE record by the Go CNA; no CVSS.
  { p: "Go", id: "CVE-2026-111943", component: "crypto/x509 Certificate.Verify", cls: "Distrust of compromised intermediates (eMudhra) added as a denylist (CWE-299)", sev: "unscored", score: null, vector: null, access: "none", affected: "all before 1.26.10; 1.27.0 to 1.27.2", fixed: "1.26.10 · 1.27.3", published: "21 Oct (record)" },

  // GitLab: 19.5.1 critical patch release, 21 October. The critical fix is
  // backported to 18.11 to 19.2; the other eleven are fixed only in 19.3.6,
  // 19.4.3 and 19.5.1.
  { p: "GitLab", id: "CVE-2026-110264", component: "Regular expression compiler (CE/EE)", cls: "Integer overflow, unauthenticated code execution (CWE-190)", sev: "critical", score: 10.0, vector: "CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", access: "none", affected: "from 7.0", fixed: "19.5.1 · 19.4.3 · 19.3.6 · 19.2.9 · 19.1.9 · 19.0.10 · 18.11.13", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-15723", component: "OmniAuth-to-LDAP auto-linking (CE/EE)", cls: "Improper authentication, account takeover when SAML and LDAP auto-linking are both on (CWE-90)", sev: "high", score: 8.2, vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:C/C:H/I:H/A:N", access: "user", affected: "from 10.1", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-112212", component: "OAuth/OIDC discovery endpoints (CE/EE)", cls: "Shared-cache poisoning of the discovery document (CWE-444)", sev: "high", score: 7.5, vector: "CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:L/A:L", access: "none", affected: "from 18.3", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-12664", component: "GraphQL work item email field (CE/EE)", cls: "Token scope not enforced (read_api token can create work items) (CWE-863)", sev: "medium", score: 6.8, vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:H/A:N", access: "user", affected: "from 18.2", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-16255", component: "SAML/LDAP membership lock (EE)", cls: "Lock not enforced on requests created before it (CWE-863)", sev: "medium", score: 5.9, vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:H/I:L/A:N", access: "user", affected: "from 12.0", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-105777", component: "Internal response headers (CE/EE)", cls: "Internal server credentials exposed (CWE-201)", sev: "medium", score: 4.3, vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N", access: "user", affected: "from 17.6.5", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-13319", component: "Group milestones API (CE/EE)", cls: "Missing authorization, private milestone metadata readable (CWE-639)", sev: "medium", score: 4.3, vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:L/I:N/A:N", access: "user", affected: "from 15.10", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-112378", component: "AI Gateway feature header (EE)", cls: "Paid AI features without a subscription (CWE-348)", sev: "medium", score: 4.3, vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:L/A:N", access: "user", affected: "from 17.8", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-105711", component: "Merge request title cache (CE/EE)", cls: "Confidential issue title leaks through a shared cache (CWE-524)", sev: "low", score: 3.5, vector: "CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:U/C:L/I:N/A:N", access: "user", affected: "from 15.0", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-14288", component: "MR approval policy (EE)", cls: "Required approval policy bypass on a protected branch (CWE-706)", sev: "low", score: 3.1, vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N", access: "user", affected: "from 17.4", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-112326", component: "Security findings (EE)", cls: "Read-only user can delete vulnerability records (CWE-460)", sev: "low", score: 3.1, vector: "CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:L/A:N", access: "user", affected: "from 17.8", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
  { p: "GitLab", id: "CVE-2026-103515", component: "Duo admin-lock for Amazon Q (EE)", cls: "Group Owner can re-enable a locked AI data egress (CWE-863)", sev: "low", score: 2.7, vector: "CVSS:3.1/AV:N/AC:L/PR:H/UI:N/S:U/C:N/I:L/A:N", access: "admin", affected: "from 19.2", fixed: "19.5.1 · 19.4.3 · 19.3.6", published: "21 Oct" },
]

const PROJECTS = ["all", "PHP", "Node.js", "NGINX", "Go", "GitLab"] as const
const SEV_RANK: Record<Cve["sev"], number> = { critical: 4, high: 3, medium: 2, low: 1, unscored: 0 }
const ACCESS_LABEL: Record<Access, string> = { none: "none", user: "user", admin: "admin", local: "local code", "n/a": "n/a" }

export function DayCves() {
  const [project, setProject] = useState<(typeof PROJECTS)[number]>("all")
  const [noAuth, setNoAuth] = useState(false)
  const [order, setOrder] = useState<"severity" | "project">("severity")

  const rows = useMemo(() => {
    const r = ROWS.filter((c) => (project === "all" || c.p === project) && (!noAuth || c.access === "none"))
    if (order === "project") return r
    return [...r].sort((a, b) => SEV_RANK[b.sev] - SEV_RANK[a.sev] || (b.score ?? 0) - (a.score ?? 0))
  }, [project, noAuth, order])

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const r of ROWS) c[r.p] = (c[r.p] ?? 0) + 1
    return c
  }, [])

  return (
    <div className="not-prose my-6 rounded-lg border border-border p-3 text-sm">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1">
          Project
          <select value={project} onChange={(e) => setProject(e.target.value as (typeof PROJECTS)[number])} className="rounded border border-border bg-background px-1 py-0.5">
            {PROJECTS.map((p) => (
              <option key={p} value={p}>
                {p === "all" ? `all (${ROWS.length})` : `${p} (${counts[p]})`}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={noAuth} onChange={(e) => setNoAuth(e.target.checked)} />
          No login needed
        </label>
        <label className="flex items-center gap-1">
          Order
          <select value={order} onChange={(e) => setOrder(e.target.value as "severity" | "project")} className="rounded border border-border bg-background px-1 py-0.5">
            <option value="severity">Published severity</option>
            <option value="project">By project</option>
          </select>
        </label>
        <span className="text-muted-foreground">{rows.length} CVEs · exploited in the wild: 0 · in KEV: 0</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[760px] border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-xs uppercase text-muted-foreground">
              <th className="py-1 pr-2">CVE</th>
              <th className="py-1 pr-2">Class</th>
              <th className="py-1 pr-2">Severity as published</th>
              <th className="py-1 pr-2">Login</th>
              <th className="py-1 pr-2">Affected</th>
              <th className="py-1">Fixed in</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id} className="border-b border-border/60 align-top">
                <td className="py-1.5 pr-2">
                  <div className="font-mono text-xs">{c.id}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.p} · {c.component} · {c.published}
                  </div>
                </td>
                <td className="py-1.5 pr-2">{c.cls}</td>
                <td className="py-1.5 pr-2">
                  <div>
                    {c.sev === "unscored" ? "no score published" : c.sev}
                    {c.score !== null ? ` ${c.score.toFixed(1)}` : ""}
                  </div>
                  {c.vector ? <div className="break-all font-mono text-[10px] text-muted-foreground">{c.vector}</div> : c.p === "Node.js" ? <div className="text-[10px] text-muted-foreground">Node.js rating; no CVE record yet</div> : null}
                </td>
                <td className="py-1.5 pr-2">{ACCESS_LABEL[c.access]}</td>
                <td className="py-1.5 pr-2 text-xs">{c.affected}</td>
                <td className="py-1.5 text-xs">{c.fixed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Sources: the PHP, Node.js, nginx.org, Go and GitLab advisories, and each CVE record (CNA container) read on 23 October. KEV: CISA catalog 2026.10.21,
        re-read 23 October; none of these is listed. Login is the privilege the vector or advisory names; &quot;none&quot; can still need a specific
        configuration, which the article spells out per project.
      </p>
    </div>
  )
}
