"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// One diff through OpenQodex, stage by stage.
//
// The diff is the repository's own demo (examples/demo-repo: baseline/ is
// committed, planted/ is laid over it uncommitted). The scanner gating is
// each adapter's `wants` (packages/scanners/src/adapters/*.ts). The detector
// rows are examples/demo-repo/expected.json. The cross-scanner merge is
// ruleClassFor + dedupByRuleClass in packages/scanners/src/run.ts. The
// rejection messages are the strings checkSubmission builds in
// packages/core/src/finalize.ts, and the round limit is MAX_CORRECTIONS = 2
// in packages/cli/src/review-run.ts. The verdict line is render/common.ts.
//
// What is NOT from a run: the reviewer's dispositions and severities below
// are my illustration of the answer format. The launch video's own run of
// this demo counted 26 candidates and printed 10 findings; expected.json
// names the 19 detector rows shown here, not every hit.

type Stage = 0 | 1 | 2 | 3 | 4

const STAGES = ["the change", "scanners wake", "candidates", "the answer", "verdict"] as const

const FILES = [
  { path: "app/config.py", note: "new file: a payment key" },
  { path: "app/search.py", note: "new file: a search endpoint" },
  { path: "app/server.py", note: "registers search, changes the page offset" },
  { path: "Dockerfile", note: "latest base, apt, ADD, USER line removed" },
  { path: "scripts/deploy.sh", note: "unquoted rm, a loop over ls" },
  { path: ".github/workflows/ci.yml", note: "PR title pasted into run" },
  { path: "package.json", note: "lodash 4.18.1 down to 4.17.15" },
  { path: "package-lock.json", note: "the same downgrade" },
]

// ADAPTERS order (run.ts merges in this order; dedup ties go to the first).
const SCANNERS: { name: string; reads: string; wakes: string | null }[] = [
  { name: "semgrep", reads: "any file", wakes: "every changed file" },
  { name: "gitleaks", reads: "any file", wakes: "every changed file" },
  { name: "sqllint", reads: ".sql", wakes: null },
  { name: "osv-scanner", reads: "a lockfile", wakes: "package-lock.json" },
  { name: "actionlint", reads: ".github/workflows/*.yml", wakes: "ci.yml" },
  { name: "hadolint", reads: "a Dockerfile", wakes: "Dockerfile" },
  { name: "shellcheck", reads: ".sh, .bash", wakes: "deploy.sh" },
  { name: "ruff", reads: ".py", wakes: "three .py files" },
  { name: "brakeman", reads: "Rails, with Gemfile and app/", wakes: null },
  { name: "rubocop", reads: ".rb, Gemfile", wakes: null },
  { name: "bandit", reads: ".py", wakes: "three .py files" },
  { name: "oxlint", reads: ".js, .ts and kin", wakes: null },
  { name: "golangci", reads: ".go", wakes: null },
]

type Row = {
  where: string
  scanner: string
  rule: string
  fate: "kept" | "merged" | "filtered"
  why?: string
  bug: string
}

const ROWS: Row[] = [
  { where: "app/config.py:2", scanner: "semgrep", rule: "detected-stripe-api-key", fate: "kept", bug: "secret" },
  { where: "app/config.py:2", scanner: "gitleaks", rule: "stripe-access-token", fate: "merged", why: "same line, both in the secret class: one scanner keeps its hit", bug: "secret" },
  { where: "app/search.py:14", scanner: "bandit", rule: "B608", fate: "kept", bug: "sqli" },
  { where: "app/search.py:14", scanner: "semgrep", rule: "formatted-sql-query", fate: "kept", bug: "sqli" },
  { where: "app/search.py:14", scanner: "semgrep", rule: "tainted-sql-string", fate: "kept", bug: "sqli" },
  { where: "Dockerfile:1", scanner: "hadolint", rule: "DL3007", fate: "kept", bug: "latest" },
  { where: "Dockerfile:3", scanner: "hadolint", rule: "DL3008", fate: "kept", bug: "apt" },
  { where: "Dockerfile:3", scanner: "hadolint", rule: "DL3015", fate: "kept", bug: "apt" },
  { where: "Dockerfile:3", scanner: "hadolint", rule: "DL3009", fate: "kept", bug: "apt" },
  { where: "Dockerfile:3", scanner: "hadolint", rule: "DL3014", fate: "kept", bug: "apt" },
  { where: "Dockerfile:6", scanner: "hadolint", rule: "DL3020", fate: "kept", bug: "add" },
  { where: "Dockerfile:7", scanner: "hadolint", rule: "DL3042", fate: "kept", bug: "pip" },
  { where: "Dockerfile:11", scanner: "semgrep", rule: "missing-user", fate: "filtered", why: "line 11 was not added or modified, so the changed-line filter drops it", bug: "root" },
  { where: "package-lock.json:11", scanner: "osv-scanner", rule: "GHSA-p6mc-m468-83gw", fate: "kept", bug: "lodash" },
  { where: "scripts/deploy.sh:7", scanner: "shellcheck", rule: "SC2115", fate: "kept", bug: "rm" },
  { where: "scripts/deploy.sh:7", scanner: "shellcheck", rule: "SC2086", fate: "kept", bug: "rm" },
  { where: "scripts/deploy.sh:11", scanner: "shellcheck", rule: "SC2045", fate: "kept", bug: "ls" },
  { where: "scripts/deploy.sh:11", scanner: "shellcheck", rule: "SC2086", fate: "kept", bug: "ls" },
  { where: "ci.yml:15", scanner: "actionlint", rule: "expression", fate: "kept", bug: "workflow" },
  { where: "ci.yml:15", scanner: "semgrep", rule: "run-shell-injection", fate: "kept", bug: "workflow" },
]

type Sev = "critical" | "major" | "minor"

// Illustrative: one finding per bug, the sibling candidates dropped.
const BUGS: { id: string; title: string; sev: Sev; own?: true }[] = [
  { id: "secret", title: "Payment key committed to source", sev: "critical" },
  { id: "sqli", title: "Search query built from request input", sev: "critical" },
  { id: "rm", title: "rm -rf on an unquoted variable", sev: "major" },
  { id: "workflow", title: "PR title runs in the workflow shell", sev: "major" },
  { id: "lodash", title: "Lodash with a known advisory", sev: "major" },
  { id: "pagination", title: "Page offset skips the first page", sev: "major", own: true },
  { id: "root", title: "Container runs as root again", sev: "major", own: true },
  { id: "latest", title: "Unpinned base image", sev: "minor" },
  { id: "apt", title: "apt install without pins or cleanup", sev: "minor" },
  { id: "add", title: "ADD used for a local file", sev: "minor" },
  { id: "pip", title: "pip cache kept in the image", sev: "minor" },
  { id: "ls", title: "Loop over unquoted ls output", sev: "minor" },
]

const RANK: Record<Sev, number> = { critical: 3, major: 2, minor: 1 }

const MISTAKES = [
  { id: "skip", label: "leave one candidate unanswered", error: "candidate c9 (Dockerfile:3) has no disposition: raise it in a finding or add it to dropped with a reason and a line" },
  { id: "long", label: "write a 24-word sentence", error: 'findings[2] ("rm -rf on an unquoted variable").problem: sentence 1 has 24 words; the limit is 20' },
  { id: "name", label: "name the scanner in the prose", error: 'findings[0] ("Payment key committed to source").problem: names the scanner name "gitleaks"; describe the problem in your own words, the source is shown on its own line' },
  { id: "line", label: "cite the CMD line for the root bug", error: 'findings[6] ("Container runs as root again"): line 11 of Dockerfile is not a line this change added or modified; start the range on a changed line, or a line next to a deletion' },
] as const

const OK = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 25)"
const WARN = "oklch(0.68 0.13 85)"
const SEV_C: Record<Sev, string> = { critical: BAD, major: WARN, minor: "oklch(0.6 0.05 250)" }

export function ReviewPipeline() {
  const [stage, setStage] = useState<Stage>(0)
  const [mistakes, setMistakes] = useState<Record<string, boolean>>({})
  const [fixedIn, setFixedIn] = useState<1 | 2 | 3 | 0>(2)
  const [threshold, setThreshold] = useState<Sev | "off">("off")

  const errors = MISTAKES.filter((m) => mistakes[m.id])
  // Round 1 is the brief. With errors, at most two correction rounds follow.
  const rounds = errors.length === 0 ? 1 : fixedIn === 0 ? 3 : fixedIn
  const complete = errors.length === 0 || fixedIn !== 0
  const counted = BUGS.map((b) => b.sev)
  const over = threshold === "off" ? 0 : counted.filter((s) => RANK[s] >= RANK[threshold]).length
  const blocked = over > 0
  const breakdown = (["critical", "major", "minor"] as Sev[])
    .map((s) => [s, counted.filter((x) => x === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ")
  const verdict = !complete
    ? "Review incomplete: this is not a review of the change"
    : blocked
      ? `Blocked: ${over} findings at or above ${threshold} (${breakdown})`
      : `Passed with warnings: ${BUGS.length} findings (${breakdown})`
  const gate = !complete
    ? "push gate: one line saying the review was incomplete; it never blocks"
    : blocked
      ? "push gate: denies the push, names the counts and the report"
      : "push gate: says nothing"

  const kept = ROWS.filter((r) => r.fate === "kept")

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">openqodex review, on its own demo diff</span>
        <span className="font-mono text-[10px] text-muted-foreground">answers illustrative, rules from the code</span>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2">
        {STAGES.map((s, i) => (
          <button
            key={s}
            type="button"
            onClick={() => setStage(i as Stage)}
            aria-pressed={stage === i}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
              stage === i ? "border-foreground/40 bg-muted/50 text-foreground" : "border-transparent text-muted-foreground hover:bg-muted/30",
            )}
          >
            {i + 1}. {s}
          </button>
        ))}
      </div>

      <div className="min-h-[300px] p-3 sm:p-4">
        {stage === 0 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              The change is the commits not yet pushed plus everything uncommitted. Here: eight files, +38 -14, copied into a frozen snapshot before anything runs.
            </p>
            <div className="space-y-1">
              {FILES.map((f) => (
                <div key={f.path} className="flex flex-wrap items-baseline gap-x-3 rounded-md border px-2 py-1.5">
                  <span className="font-mono text-[11px] text-foreground">{f.path}</span>
                  <span className="text-xs text-muted-foreground">{f.note}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 1 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Each adapter asks one question first: does the change hold a file I read? Eight say yes, five say no. Then the eight run in parallel, and a failure in any one becomes a status, never an error.
            </p>
            <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">
              {SCANNERS.map((s) => (
                <div
                  key={s.name}
                  className={cn("flex items-baseline justify-between gap-2 rounded-md border px-2 py-1.5", !s.wakes && "opacity-50")}
                >
                  <span className="font-mono text-[11px] text-foreground">{s.name}</span>
                  <span className="truncate text-right font-mono text-[10px]" style={{ color: s.wakes ? OK : undefined }}>
                    {s.wakes ? `ran: ${s.wakes}` : `nothing to check (${s.reads})`}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-2 font-mono text-[11px] text-muted-foreground">Scanners: 8 ran, 5 had nothing to check</div>
          </div>
        )}

        {stage === 2 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              Every hit is cut to the changed lines, fixture paths are dropped, and hits of one class on one span from two scanners merge. What survives is a numbered candidate. These are the hits the demo&apos;s expected file describes, and{" "}
              {kept.length} of them survive.
            </p>
            <div className="space-y-1">
              {ROWS.map((r, i) => (
                <div
                  key={i}
                  className={cn("rounded-md border px-2 py-1", r.fate !== "kept" && "opacity-60")}
                  style={r.fate !== "kept" ? { borderColor: r.fate === "merged" ? WARN : BAD } : undefined}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{r.where}</span>
                    <span className="font-mono text-[11px] text-foreground">
                      {r.scanner}:{r.rule}
                    </span>
                    <span className="ml-auto font-mono text-[9px]" style={{ color: r.fate === "kept" ? OK : r.fate === "merged" ? WARN : BAD }}>
                      {r.fate === "kept" ? "candidate" : r.fate}
                    </span>
                  </div>
                  {r.why && <div className="text-[11px] text-muted-foreground">{r.why}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 3 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              A separate Claude Code or Codex process reads the snapshot and answers with one JSON object. Every candidate needs exactly one disposition: raised in a finding, or dropped with a reason and a line. A script checks the answer and sends back every broken rule, numbered. Break a rule to see it.
            </p>
            <div className="flex flex-wrap gap-1.5">
              {MISTAKES.map((m) => (
                <label key={m.id} className="flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs">
                  <input
                    type="checkbox"
                    checked={!!mistakes[m.id]}
                    onChange={(e) => setMistakes((x) => ({ ...x, [m.id]: e.target.checked }))}
                  />
                  {m.label}
                </label>
              ))}
            </div>
            {errors.length > 0 && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                <span>the reviewer fixes it in</span>
                {([2, 3, 0] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setFixedIn(r)}
                    aria-pressed={fixedIn === r}
                    className={cn("cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px]", fixedIn === r && "border-foreground/40 bg-muted/50")}
                  >
                    {r === 0 ? "never" : `round ${r}`}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 font-mono text-[11px] leading-5">
              {errors.length === 0 ? (
                <span style={{ color: OK }}>
                  round 1: every check passed. {kept.length} candidates disposed, {BUGS.filter((b) => b.own).length} findings with no candidate
                </span>
              ) : (
                <>
                  <div className="text-muted-foreground">Your answer failed these checks. Fix every one.</div>
                  {errors.map((e, i) => (
                    <div key={e.id} style={{ color: BAD }}>
                      {i + 1}. {e.error}
                    </div>
                  ))}
                  <div className="mt-1.5" style={{ color: complete ? OK : BAD }}>
                    {complete
                      ? `round ${rounds}: passed after ${rounds - 1} correction ${rounds - 1 === 1 ? "round" : "rounds"}`
                      : "round 3: still failing after 2 correction rounds; review incomplete, exit 2"}
                  </div>
                </>
              )}
            </div>
            <div className="mt-2 space-y-0.5">
              {BUGS.map((b) => (
                <div key={b.id} className="flex items-baseline gap-2 text-xs">
                  <span className="inline-block w-14 shrink-0 font-mono text-[10px]" style={{ color: SEV_C[b.sev] }}>
                    {b.sev}
                  </span>
                  <span className="text-foreground">{b.title}</span>
                  <span className="ml-auto shrink-0 font-mono text-[9px] text-muted-foreground">
                    {b.own ? "source: the reviewer" : `raises 1, drops ${ROWS.filter((r) => r.bug === b.id && r.fate === "kept").length - 1}`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {stage === 4 && (
          <div>
            <p className="mb-2 text-sm text-muted-foreground">
              The verdict counts findings at or above <code>block_on_severity</code>. Out of the box that key is unset, so nothing blocks. The answer from step 4 carries over: an answer that never passed makes the whole review incomplete.
            </p>
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>block_on_severity:</span>
              {(["off", "critical", "major", "minor"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setThreshold(t)}
                  aria-pressed={threshold === t}
                  className={cn("cursor-pointer rounded border px-1.5 py-0.5 font-mono text-[10px]", threshold === t && "border-foreground/40 bg-muted/50")}
                >
                  {t === "off" ? "unset (default)" : t}
                </button>
              ))}
            </div>
            <div className="mt-3 rounded-lg border bg-muted/20 px-3 py-2.5 font-mono text-[12px]">
              <div style={{ color: !complete || blocked ? BAD : threshold === "off" ? WARN : OK }}>{verdict}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">exit {!complete ? 2 : blocked ? 1 : 0}</div>
              <div className="mt-1 text-[11px] text-muted-foreground">{gate}</div>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between border-t px-4 py-2">
        <button
          type="button"
          disabled={stage === 0}
          onClick={() => setStage((s) => Math.max(0, s - 1) as Stage)}
          className="cursor-pointer font-mono text-[11px] text-muted-foreground disabled:opacity-30"
        >
          back
        </button>
        <span className="font-mono text-[10px] text-muted-foreground">
          {stage + 1} / {STAGES.length}
        </span>
        <button
          type="button"
          disabled={stage === 4}
          onClick={() => setStage((s) => Math.min(4, s + 1) as Stage)}
          className="cursor-pointer font-mono text-[11px] text-muted-foreground disabled:opacity-30"
        >
          next
        </button>
      </div>
    </figure>
  )
}
