"use client"

// "Am I affected?" for the two runtime items of the week: PHP (CVE-2026-109618,
// CVE-2026-109619) and Node.js (CVE-2026-111497). Pure version-range logic
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
  { branch: "26", fixed: "26.12.1" },
  { branch: "24", fixed: "24.22.1" },
  { branch: "22", fixed: "22.23.4" },
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
  return { tone: "bad", text: `Below ${rule.fixed}: affected. Exposure needs untrusted Brotli data to reach the decoder, for example a fetched response or a body parser that decodes Brotli. Update anyway.` }
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
      <p className="text-xs text-muted-foreground sm:col-span-2">
        Version ranges from the PHP advisories GHSA-w8hw-w9fx-j79w and GHSA-6wmf-4rv5-p3rp, and the Node.js October 2026 security
        release. Nothing leaves your browser. A version string is not the whole answer: a distro backport can fix an older number,
        and an unrestarted worker can still run the old code.
      </p>
    </div>
  )
}
