"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Six things that happen when two agent sessions write to one Agent Memory
// Repo through plain git. Every outcome below is MEASURED: it is what
// `git pull --no-rebase` printed (git 2.43.0) in a throwaway repo whose
// MEMORY.md and findings.md follow the spec's entry format. The file contents
// are the exact lines the script wrote. Nothing here is simulated in the
// browser; the widget only lays the recorded runs side by side.
//
// The second lane is NOT a git run. It is what Supermemory's memoryrepo
// (commit 54f7ff3) does with the same pair of writes, worked out from its two
// write paths: the chat-time check in src/server/memory-agent.ts:326-329 and
// the dream rebase in memory-agent.ts:407-415. I transcribed those rules into
// a short script and replayed each case through it; nothing from that repo
// was executed.

type Outcome = "conflict" | "clean" | "resurrected"

type Lane = { outcome: Outcome; label: string; text: string }

type Scenario = {
  key: string
  name: string
  file: string
  base: string[]
  a: { who: string; lines: string[] }
  b: { who: string; lines: string[] }
  outcome: Outcome
  result: string[]
  why: string
  mm: Lane
}

const FINDINGS_BASE = ["- Database: queries are fast [source: s/301]"]
const MEMORY_BASE = [
  "- Prefers concise bullet summaries [added: 2026-09-01]",
  "- Dev server runs on port 3001 [added: 2026-09-02]",
]

const SCENARIOS: Scenario[] = [
  {
    key: "append",
    name: "both append",
    file: "findings.md",
    base: FINDINGS_BASE,
    a: {
      who: "runtime agent (pushed first)",
      lines: [...FINDINGS_BASE, "- Runtime: GC freezes 400 ms [source: s/302]"],
    },
    b: {
      who: "load-balancer agent",
      lines: [...FINDINGS_BASE, "- LB: ruled out [source: s/303]"],
    },
    outcome: "conflict",
    result: [
      FINDINGS_BASE[0],
      "<<<<<<< HEAD",
      "- LB: ruled out [source: s/303]",
      "=======",
      "- Runtime: GC freezes 400 ms [source: s/302]",
      ">>>>>>> (the commit B pulled)",
    ],
    why: "Both sides inserted a line at the same place, the end of the file. Git cannot order two insertions at one point, so a shared findings file conflicts on every pair of concurrent appends, not only when two agents edit the same line.",
    mm: {
      outcome: "conflict",
      label: "rejected, agent merges",
      text: "B's write never lands. The check compares whole files, sees findings.md changed since B's turn began, and hands back the current version; the agent writes one merged file and retries once. Had B been a dream, the whole dream would be dropped.",
    },
  },
  {
    key: "union",
    name: "append + union",
    file: "findings.md",
    base: FINDINGS_BASE,
    a: {
      who: "runtime agent (pushed first)",
      lines: [...FINDINGS_BASE, "- Runtime: GC freezes 400 ms [source: s/302]"],
    },
    b: {
      who: "load-balancer agent",
      lines: [...FINDINGS_BASE, "- LB: ruled out [source: s/303]"],
    },
    outcome: "clean",
    result: [
      FINDINGS_BASE[0],
      "- LB: ruled out [source: s/303]",
      "- Runtime: GC freezes 400 ms [source: s/302]",
    ],
    why: "One line in .gitattributes, `findings.md merge=union`, tells git to keep both sides' lines. That is right for a log of one-line bullets, and wrong for a file where a later line is meant to replace an earlier one.",
    mm: {
      outcome: "conflict",
      label: "rejected, agent merges",
      text: "There is no merge driver to configure. Any change to the same file, appends included, is case 1 again.",
    },
  },
  {
    key: "files",
    name: "different files",
    file: "findings.md + cache.md",
    base: FINDINGS_BASE,
    a: {
      who: "runtime agent (pushed first)",
      lines: [...FINDINGS_BASE, "- Runtime: GC freezes 400 ms [source: s/302]"],
    },
    b: { who: "cache agent, new file cache.md", lines: ["- Cache: refresh every 10 s [source: s/304]"] },
    outcome: "clean",
    result: [
      "findings.md: " + FINDINGS_BASE[0],
      "findings.md: - Runtime: GC freezes 400 ms [source: s/302]",
      "cache.md:    - Cache: refresh every 10 s [source: s/304]",
    ],
    why: "The second push is still rejected as non-fast-forward, as every concurrent push is. The merge that follows is clean because the edits touch different files. This is what a one-file-per-agent layout buys.",
    mm: {
      outcome: "clean",
      label: "lands, nothing refused",
      text: "Better than git here: B's write lands on the first try, because the check looks only at the files B touches.",
    },
  },
  {
    key: "untouched",
    name: "dream deletes, old clone idle",
    file: "MEMORY.md",
    base: MEMORY_BASE,
    a: { who: "dreaming pass (pushed first)", lines: [MEMORY_BASE[0]] },
    b: { who: "older session, edits only cache.md", lines: MEMORY_BASE },
    outcome: "clean",
    result: [MEMORY_BASE[0]],
    why: "A three-way merge sees that the older session never changed the port line, so the deletion wins. A stale clone does not bring a forgotten entry back merely by existing.",
    mm: {
      outcome: "clean",
      label: "dream commits",
      text: "Same as git. A file the chat never touched takes the dream's version, so the deletion stays.",
    },
  },
  {
    key: "edit",
    name: "dream deletes, old clone edits",
    file: "MEMORY.md",
    base: MEMORY_BASE,
    a: { who: "dreaming pass (pushed first)", lines: [MEMORY_BASE[0]] },
    b: {
      who: "older session",
      lines: [MEMORY_BASE[0], "- Dev server runs on port 3002 [added: 2026-09-02]"],
    },
    outcome: "conflict",
    result: [
      MEMORY_BASE[0],
      "<<<<<<< HEAD",
      "- Dev server runs on port 3002 [added: 2026-09-02]",
      "=======",
      ">>>>>>> (the commit B pulled)",
    ],
    why: "Delete on one side and modify on the other is a real conflict. The session has to decide, and the spec gives it nothing to decide with: no record says the deletion was deliberate.",
    mm: {
      outcome: "conflict",
      label: "second writer loses",
      text: "Whichever lands second loses. A chat write is refused and shown a MEMORY.md with the line already gone; a dream is dropped whole and retried four hours later.",
    },
  },
  {
    key: "relearn",
    name: "dream deletes, old clone re-learns",
    file: "MEMORY.md + env.md",
    base: MEMORY_BASE,
    a: { who: "dreaming pass (pushed first)", lines: [MEMORY_BASE[0]] },
    b: {
      who: "older session, new file env.md",
      lines: ["- Dev server runs on port 3001 [added: 2026-09-05]"],
    },
    outcome: "resurrected",
    result: [
      "MEMORY.md: " + MEMORY_BASE[0],
      "env.md:    - Dev server runs on port 3001 [added: 2026-09-05]",
    ],
    why: "The fact comes back with no conflict, because to git it is a new line in a new file. Only a tombstone, an entry that says this was removed on purpose, could catch it, and the spec does not define one.",
    mm: {
      outcome: "resurrected",
      label: "lands, fact is back",
      text: "Same as git. env.md existed at neither commit, so nothing looks touched, and the dream prompt's rule that the most recent statement wins favours the re-learned line.",
    },
  },
]

const BADGE: Record<Outcome, string> = {
  conflict: "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  clean: "border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  resurrected: "border-destructive/50 bg-destructive/10 text-destructive",
}

const LABEL: Record<Outcome, string> = {
  conflict: "CONFLICT",
  clean: "merged clean",
  resurrected: "merged clean, fact is back",
}

function Lines({ lines, tone }: { lines: string[]; tone?: "result" }) {
  return (
    <pre className="m-0 overflow-x-auto whitespace-pre rounded border bg-background/60 px-2 py-1.5 font-mono text-[11px] leading-relaxed">
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn(
            tone === "result" && /^(<{7}|={7}|>{7})/.test(l) && "text-amber-600 dark:text-amber-400",
          )}
        >
          {l || " "}
        </div>
      ))}
    </pre>
  )
}

export function MemoryMergeLab() {
  const [idx, setIdx] = useState(0)
  const s = SCENARIOS[idx]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          two sessions, one memory repo, plain git
        </span>
        <span className="font-mono text-[11px] text-muted-foreground">measured, git 2.43.0</span>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-3 py-2.5 sm:px-4">
        {SCENARIOS.map((sc, i) => (
          <button
            key={sc.key}
            type="button"
            onClick={() => setIdx(i)}
            aria-pressed={i === idx}
            className={cn(
              "cursor-pointer rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
              i === idx
                ? "border-foreground/30 bg-muted/60 text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {i + 1}. {sc.name}
          </button>
        ))}
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <div className="font-mono text-[11px] text-muted-foreground">
          file: <span className="text-foreground">{s.file}</span> · common ancestor:
        </div>
        <Lines lines={s.base} />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">A · {s.a.who}</div>
            <Lines lines={s.a.lines} />
          </div>
          <div>
            <div className="mb-1 font-mono text-[11px] text-muted-foreground">B · {s.b.who}</div>
            <Lines lines={s.b.lines} />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-muted-foreground">
            B is behind, so git push is refused (non-fast-forward) · git pull --no-rebase →
          </span>
          <span className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", BADGE[s.outcome])}>
            {LABEL[s.outcome]}
          </span>
        </div>
        <Lines lines={s.result} tone="result" />

        <p className="text-sm text-muted-foreground">{s.why}</p>

        <div className="rounded-lg border border-dashed px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[11px] text-muted-foreground">
              same writes, Supermemory&apos;s memoryrepo (read from its code) →
            </span>
            <span className={cn("rounded border px-2 py-0.5 font-mono text-[11px]", BADGE[s.mm.outcome])}>
              {s.mm.label}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{s.mm.text}</p>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Each run starts from the same two files, lets session A push first, then has B commit
        from the older checkout and pull. The outcomes are what git printed; the widget only
        shows them side by side. The dashed lane is not a git run: it applies
        memoryrepo&apos;s two write rules (memory-agent.ts:326-329 and 407-415) to the same writes.
      </figcaption>
    </figure>
  )
}
