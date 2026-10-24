"use client"

// "Am I affected?" for the version-checkable items of the week: PHP
// (CVE-2026-109618, CVE-2026-109619), Node.js (all ten CVEs of its 21 October
// release), GitLab (all twelve of 19.5.1), NGINX Open Source and Plus (the
// five of 14 October), Go (CVE-2026-111943) and the malicious LiteLLM 1.107.0. Pure version-range logic
// copied from the vendors' own advisories; nothing is fetched. Type the
// version your runtime reports (`php -v`, `node -v`) and it says which fixed
// release your branch needs. A distro package can carry a backport under an
// older upstream number, so a "vulnerable" verdict on a distro build means
// "check your vendor's changelog", which the result says.

import { useState } from "react"

type Rule = { branch: string; fixed: string | null; note?: string }

const PHP: Rule[] = [
  { branch: "8.5", fixed: "8.5.12" },
  { branch: "8.4", fixed: "8.4.27" },
  { branch: "8.3", fixed: "8.3.36" },
  { branch: "8.2", fixed: "8.2.35", note: "8.2 reaches end of life on 31 December 2026." },
  { branch: "8.1", fixed: null, note: "No official release. PHP published a minimal source backport; distros and LTS vendors may ship one." },
  { branch: "8.0", fixed: null, note: "No official release. PHP published a minimal source backport; distros and LTS vendors may ship one." },
  { branch: "7.4", fixed: null, note: "No official release. PHP published a minimal source backport; distros and LTS vendors may ship one." },
]

const NODE: Rule[] = [
  { branch: "26", fixed: "26.12.1", note: "10" },
  { branch: "24", fixed: "24.22.1", note: "8" },
  { branch: "22", fixed: "22.23.4", note: "7" },
]

function parse(v: string): number[] | null {
  const m = v.trim().replace(/^v/i, "").match(/^(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3] ?? 0)]
}

function cmp(a: number[], b: number[]): number {
  for (let i = 0; i < 3; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

type Verdict = { tone: "ok" | "bad" | "warn"; text: string }

function checkPhp(raw: string): Verdict | null {
  const v = parse(raw)
  if (!v) return null
  if (v[0] === 8 && v[1] >= 6) return { tone: "warn", text: "PHP 8.6 is still a release candidate. RC4 carries the fixes; earlier 8.6 builds do not. Do not run it in production." }
  const rule = PHP.find((r) => r.branch === `${v[0]}.${v[1]}`)
  if (!rule) return { tone: "bad", text: "This branch is older than 7.4. It is affected, and PHP publishes no fix for it. Upgrade to a supported branch." }
  if (!rule.fixed) return { tone: "bad", text: `Affected. ${rule.note}` }
  const fixed = parse(rule.fixed)!
  if (cmp(v, fixed) >= 0) return { tone: "ok", text: `At or past ${rule.fixed}, the fixed release for ${rule.branch}. Restart every PHP worker so the running processes are the patched ones.${rule.note ? " " + rule.note : ""}` }
  return { tone: "bad", text: `Below ${rule.fixed}: affected upstream. If this came from a distro package, check its changelog for the two CVE ids before concluding; vendors received the patches early.` }
}

function checkNode(raw: string): Verdict | null {
  const v = parse(raw)
  if (!v) return null
  const rule = NODE.find((r) => r.branch === `${v[0]}`)
  if (!rule) {
    if (v[0] > 26) return { tone: "warn", text: "Newer than the lines in the October advisory. Check the Node.js release notes for this line." }
    return { tone: "bad", text: "This line is end of life and gets no fix. Odd-numbered lines like 25 and 23, and 20 and older, are all in this group. Move to 22, 24 or 26." }
  }
  const fixed = parse(rule.fixed!)!
  if (cmp(v, fixed) >= 0) return { tone: "ok", text: `At or past ${rule.fixed}, the fixed release for the ${rule.branch}.x line. Check container images too: a Node binary bundled in an image is a separate copy.` }
  return { tone: "bad", text: `Below ${rule.fixed}: affected by ${rule.note} of the release's 10 CVEs, four of them rated high (on 22.x, three). The Brotli one needs untrusted Brotli data to reach the decoder; the TLS ones matter wherever this process makes TLS connections. Update.` }
}

// GitLab 19.5.1 release: CVE-2026-110264 is affected from 7.0 and fixed per
// minor line, back to 18.11. The other eleven are fixed only in 19.3.6, 19.4.3
// and 19.5.1; each has its own "affected from" version (EE-only ones marked).
const GITLAB: Record<string, string> = {
  "19.5": "19.5.1",
  "19.4": "19.4.3",
  "19.3": "19.3.6",
  "19.2": "19.2.9",
  "19.1": "19.1.9",
  "19.0": "19.0.10",
  "18.11": "18.11.13",
}

const GITLAB_OTHERS: { from: number[]; ee: boolean }[] = [
  { from: [10, 1, 0], ee: false }, // CVE-2026-15723, 8.2
  { from: [18, 3, 0], ee: false }, // CVE-2026-112212, 7.5
  { from: [18, 2, 0], ee: false }, // CVE-2026-12664, 6.8
  { from: [12, 0, 0], ee: true }, // CVE-2026-16255, 5.9
  { from: [17, 6, 5], ee: false }, // CVE-2026-105777, 4.3
  { from: [15, 10, 0], ee: false }, // CVE-2026-13319, 4.3
  { from: [17, 8, 0], ee: true }, // CVE-2026-112378, 4.3
  { from: [15, 0, 0], ee: false }, // CVE-2026-105711, 3.5
  { from: [17, 4, 0], ee: true }, // CVE-2026-14288, 3.1
  { from: [17, 8, 0], ee: true }, // CVE-2026-112326, 3.1
  { from: [19, 2, 0], ee: true }, // CVE-2026-103515, 2.7
]
const OTHERS_FIXED: Record<string, number[]> = { "19.3": [19, 3, 6], "19.4": [19, 4, 3], "19.5": [19, 5, 1] }

function others(v: number[]): string {
  const key = `${v[0]}.${v[1]}`
  const fx = OTHERS_FIXED[key]
  if (fx && cmp(v, fx) >= 0) return ""
  if (cmp(v, [19, 5, 1]) > 0) return ""
  const hit = GITLAB_OTHERS.filter((o) => cmp(v, o.from) >= 0)
  if (hit.length === 0) return ""
  const ee = hit.filter((o) => o.ee).length
  return ` It is also affected by ${hit.length} of the release's 11 other CVEs (${ee} of them EE only; the highest is CVSS 8.2), which are fixed only in 19.3.6, 19.4.3 and 19.5.1.`
}

function checkGitlab(raw: string): Verdict | null {
  const v = parse(raw)
  if (!v) return null
  if (v[0] < 7) return { tone: "ok", text: "Older than 7.0, outside the advisory's range, and far too old to run safely for other reasons." }
  const key = `${v[0]}.${v[1]}`
  const fixedStr = GITLAB[key]
  const rest = others(v)
  if (fixedStr) {
    const fixed = parse(fixedStr)!
    if (cmp(v, fixed) >= 0) {
      if (rest) return { tone: "warn", text: `At or past ${fixedStr}, so the CVSS 10.0 bug is fixed.${rest} Plan the move to a 19.3 or later line.` }
      return { tone: "ok", text: `At or past ${fixedStr}, the fixed release for ${key}, covering all 12 CVEs. GitLab.com and Dedicated are already patched.` }
    }
    return { tone: "bad", text: `Below ${fixedStr}: affected by the CVSS 10.0 bug. GitLab lists no workaround. Upgrade, and note that the 12 October release does not fix this one.${rest}` }
  }
  if (cmp(v, [19, 5, 1]) > 0) return { tone: "ok", text: "Newer than the 19.5 line in the advisory." }
  return { tone: "bad", text: `Affected by the CVSS 10.0 bug, and on a line with no backport. Upgrade to 19.3.6 or later to clear all 12, or to 18.11.13 for the critical one alone.${rest}` }
}

// NGINX Open Source: nginx.org advisories for the five CVEs of 14 October.
// Each has its own "vulnerable from" version; all are fixed in 1.31.7 and
// 1.30.6. NGINX Plus: F5's CVE records (37.0.5.1 and 37.1.0.1 for four; the
// HTTP/3 one lists 37.0.7.1 and 37.2.0.1).
const NGINX_OSS: { id: string; from: number[]; to: number[]; note: string }[] = [
  { id: "CVE-2026-15176", from: [0, 1, 29], to: [1, 31, 6], note: "alias with rewrite" },
  { id: "CVE-2026-93479", from: [1, 31, 2], to: [1, 31, 6], note: "map with regex captures" },
  { id: "CVE-2026-93479", from: [1, 30, 0], to: [1, 30, 5], note: "map with regex captures" },
  { id: "CVE-2026-95101", from: [1, 25, 0], to: [1, 31, 6], note: "HTTP/3 with proxy_request_buffering" },
  { id: "CVE-2026-97629", from: [1, 23, 2], to: [1, 31, 6], note: "shared session cache without a ticket key file" },
  { id: "CVE-2026-97205", from: [0, 8, 11], to: [1, 31, 6], note: "AIO with SSI" },
]

function parse4(v: string): number[] | null {
  const m = v.trim().match(/^(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/)
  if (!m) return null
  return [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4] ?? 0)]
}

function cmp4(a: number[], b: number[]): number {
  for (let i = 0; i < 4; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return 0
}

function checkNginx(raw: string): Verdict | null {
  const tag = raw.match(/nginx\/(\S+)/i)
  const s = (tag ? tag[1] : raw).trim()
  if (/^r\d+/i.test(s)) return { tone: "bad", text: "NGINX Plus R33 to R36 are listed as affected by all five, with no fix on those releases. Move to 37.0.7.1 or 37.2.0.1 (37.0.5.1 or 37.1.0.1 clear four of the five)." }
  const p4 = parse4(s)
  if (p4 && p4[0] >= 37) {
    const four = (p4[1] === 0 && cmp4(p4, [37, 0, 5, 1]) < 0) || (p4[1] === 1 && cmp4(p4, [37, 1, 0, 1]) < 0)
    const h3 = (p4[1] === 0 && cmp4(p4, [37, 0, 7, 1]) < 0) || (p4[1] >= 1 && cmp4(p4, [37, 2, 0, 1]) < 0)
    if (four) return { tone: "bad", text: "NGINX Plus below the fix: affected by all five. Upgrade to 37.0.7.1 or 37.2.0.1." }
    if (h3) return { tone: "warn", text: "Clear of four, but F5 lists the HTTP/3 body-injection bug (CVE-2026-95101) as fixed only in 37.0.7.1 and 37.2.0.1. Upgrade, or set proxy_request_buffering off where HTTP/3 is enabled." }
    return { tone: "ok", text: "At or past the NGINX Plus fixes F5 lists for all five." }
  }
  const v = parse(s)
  if (!v) return null
  if (cmp(v, [1, 31, 7]) >= 0 || (v[0] === 1 && v[1] === 30 && cmp(v, [1, 30, 6]) >= 0)) return { tone: "ok", text: "At or past 1.31.7 or 1.30.6: none of the five. Restart or upgrade in place so the running workers are the new binary." }
  const hits = NGINX_OSS.filter((r) => cmp(v, r.from) >= 0 && cmp(v, r.to) <= 0)
  if (hits.length === 0) return { tone: "ok", text: "Outside the published ranges for these five." }
  const ids = Array.from(new Set(hits.map((h) => `${h.id} (${h.note})`)))
  const line = v[1] % 2 === 0 ? "1.30.6 on the stable line, or 1.31.7" : "1.31.7"
  return { tone: "bad", text: `Affected by ${ids.length}: ${ids.join("; ")}. Each needs that configuration to be reachable, so check your config, then upgrade to ${line}. A distro package may carry a backport under an older number.` }
}

// Go CVE-2026-111943 (GO-2026-6809): fixed in 1.26.10 and 1.27.3. Go links
// the standard library into each binary, so the toolchain that BUILT a binary
// is what matters (go version -m <binary>).
function checkGo(raw: string): Verdict | null {
  const found = raw.match(/(\d+\.\d+(?:\.\d+)?)/)
  const v = found ? parse(found[1]) : null
  if (!v) return null
  if (v[0] === 1 && v[1] === 27) return cmp(v, [1, 27, 3]) >= 0 ? { tone: "ok", text: "At or past 1.27.3. Binaries built with it carry the denylist; older builds do not until rebuilt." } : { tone: "bad", text: "Below 1.27.3: Certificate.Verify does not reject the eMudhra intermediates. Upgrade the toolchain and rebuild every binary." }
  if (v[0] === 1 && v[1] === 26) return cmp(v, [1, 26, 10]) >= 0 ? { tone: "ok", text: "At or past 1.26.10. Binaries built with it carry the denylist; older builds do not until rebuilt." } : { tone: "bad", text: "Below 1.26.10: Certificate.Verify does not reject the eMudhra intermediates. Upgrade the toolchain and rebuild every binary." }
  if (v[0] === 1 && v[1] < 26) return { tone: "bad", text: "Unsupported Go release, affected with no fix. Move to 1.26.10 or 1.27.3 and rebuild. An updated system trust store covers most platforms in the meantime." }
  return { tone: "warn", text: "Newer than the lines in the advisory. Check the Go release notes." }
}

// LiteLLM: only 1.107.0 was malicious; the maintainers name 1.106.2 as the pin.
function checkLitellm(raw: string): Verdict | null {
  const v = parse(raw)
  if (!v) return null
  if (cmp(v, [1, 107, 0]) === 0) return { tone: "bad", text: "1.107.0 is the malicious release. Treat the host or image as compromised: remove it, rebuild from a pinned earlier version such as 1.106.2, and rotate every secret it could reach. Do not just upgrade in place." }
  if (cmp(v, [1, 107, 0]) < 0) return { tone: "ok", text: "Not the October release. If you pulled a container tag like latest, main-latest or main-stable on 21 October, check the image digest, not just the version." }
  return { tone: "warn", text: "Newer than 1.107.0. Confirm against the maintainers' incident page that this release was published after the clean-up." }
}

// CVE-2026-111497 outside Node ("HTTP2Shell"). The CVE record (Google as CNA)
// names Brotli 1.0.3 through 1.2.0, fixed in 1.0.10, 1.1.1 and 1.2.1.
// GHSA-9v8h-qqgm-4m35 gives the PyPI fixes: Brotli 1.2.1 (PyPI never got a
// 1.0.10 or 1.1.1) and brotlicffi 1.2.1.0, whose four-part versions track the
// bundled C library. A distro package keeps the old number when it backports.
function checkBrotliPy(raw: string): Verdict | null {
  const four = raw.trim().match(/^v?(\d+)\.(\d+)\.(\d+)\.(\d+)/)
  if (four) {
    const v = four.slice(1).map(Number)
    const ok = v[0] > 1 || (v[0] === 1 && (v[1] > 2 || (v[1] === 2 && v[2] >= 1)))
    return ok
      ? { tone: "ok", text: "brotlicffi at or past 1.2.1.0, the fixed release. Rebuild images that pinned an older wheel." }
      : { tone: "bad", text: "brotlicffi below 1.2.1.0: it bundles an affected Brotli decoder. urllib3, httpx and aiohttp use it whenever it is installed. Upgrade to 1.2.1.0." }
  }
  const v = parse(raw)
  if (!v) return null
  if (cmp(v, [1, 2, 1]) >= 0) return { tone: "ok", text: "Brotli at or past 1.2.1, the fixed PyPI release." }
  if (cmp(v, [1, 0, 3]) < 0) return { tone: "warn", text: "Older than the CVE's stated range (1.0.3 to 1.2.0), and years out of support. Move to 1.2.1 anyway." }
  return { tone: "bad", text: "Brotli 1.0.3 to 1.2.0 on PyPI is affected, and PyPI's only fix is 1.2.1. urllib3 (so requests), httpx and aiohttp use it whenever it is installed. Upgrade." }
}

function checkLibbrotli(raw: string): Verdict | null {
  const found = raw.match(/(\d+\.\d+\.\d+)/)
  const v = found ? parse(found[1]) : null
  if (!v) return null
  if (v[0] !== 1) return { tone: "warn", text: "Not a Brotli 1.x version. Check what reported it." }
  if (cmp(v, [1, 0, 3]) < 0) return { tone: "warn", text: "Older than the CVE's stated range (1.0.3 to 1.2.0). Check your vendor's advisory." }
  const fixed = v[1] === 0 ? [1, 0, 10] : v[1] === 1 ? [1, 1, 1] : v[1] === 2 ? [1, 2, 1] : null
  if (!fixed) return { tone: "warn", text: "Newer than the lines in the CVE record. Check the Brotli release notes." }
  if (cmp(v, fixed) >= 0) return { tone: "ok", text: `At or past ${fixed.join(".")}, the upstream fix for the ${v[0]}.${v[1]} line.` }
  return { tone: "warn", text: `Upstream ${v.join(".")} is affected (fixed in ${fixed.join(".")}). A distro package keeps the old number when it backports: Debian's fixes are 1.0.9-2+deb12u1 and 1.1.0-2+deb13u1. Check the package release, not only this number.` }
}

const TONE: Record<Verdict["tone"], string> = {
  ok: "oklch(0.58 0.14 155)",
  bad: "oklch(0.60 0.18 28)",
  warn: "oklch(0.70 0.14 85)",
}

function Field({ label, placeholder, check }: { label: string; placeholder: string; check: (s: string) => Verdict | null }) {
  const [val, setVal] = useState("")
  const verdict = val ? check(val) : null
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium">
        {label}
        <input
          value={val}
          onChange={(e) => setVal(e.target.value)}
          placeholder={placeholder}
          spellCheck={false}
          className="mt-1 block w-full rounded border border-border bg-background px-2 py-1 font-mono text-sm"
        />
      </label>
      <p className="min-h-[3rem] text-sm" style={verdict ? { borderLeft: `3px solid ${TONE[verdict.tone]}`, paddingLeft: "0.6rem" } : undefined}>
        {val && !verdict ? "Type a version like 8.3.30 or v24.22.0." : verdict?.text}
      </p>
    </div>
  )
}

export function VersionCheck() {
  return (
    <div className="not-prose my-6 grid gap-6 rounded-lg border border-border p-4 sm:grid-cols-2">
      <Field label="PHP version (php -v)" placeholder="8.3.30" check={checkPhp} />
      <Field label="Node.js version (node -v)" placeholder="v24.22.0" check={checkNode} />
      <Field label="GitLab version (Admin, or /help)" placeholder="19.4.2" check={checkGitlab} />
      <Field label="LiteLLM version (pip show litellm)" placeholder="1.106.2" check={checkLitellm} />
      <Field label="NGINX version (nginx -v), or Plus 37.x.y.z / R36" placeholder="1.30.5" check={checkNginx} />
      <Field label="Go toolchain that built the binary (go version -m)" placeholder="go1.26.9" check={checkGo} />
      <Field label="Python Brotli or brotlicffi (pip show brotli brotlicffi)" placeholder="1.2.0" check={checkBrotliPy} />
      <Field label="libbrotli, the C library (dpkg -l, rpm -q, or curl -V)" placeholder="1.1.0" check={checkLibbrotli} />
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Version ranges from the PHP advisories GHSA-w8hw-w9fx-j79w and GHSA-6wmf-4rv5-p3rp, the Node.js October 2026 security
        release, the GitLab 19.5.1 patch release, nginx.org&apos;s advisories and F5&apos;s CVE records, Go&apos;s GO-2026-6809, the LiteLLM 21 October incident report, and for Brotli the CVE-2026-111497 record and GHSA-9v8h-qqgm-4m35. Nothing leaves your browser. A version string is not the whole answer: a distro backport can fix an older number,
        and an unrestarted worker can still run the old code.
      </p>
    </div>
  )
}
