"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The CVE-2026-31431 shields that ship in shirudo's upatches/kernel-cve/, played against a
// small mix of AF_ALG traffic. The rules are the programs' own:
//   - cve-2026-31431-af-alg-block.bpf.c: SEC("lsm/socket_create"), family == AF_ALG (38) -> -EPERM.
//   - cve-2026-31431-alg-splice-block.bpf.c: SEC("lsm/socket_sendmsg"), an AF_ALG socket whose
//     msg_flags carry MSG_SPLICE_PAGES (0x8000000) -> -EACCES. Copying sends go through.
//   - cve-2026-31431-copyfail-detector.bpf.c: lsm/socket_sendmsg marks a spliced AF_ALG socket in
//     sk_storage; fexit/aead_recvmsg counts every aead op in `activity` and, for a marked socket
//     whose op returned an error, one `hits`. It never refuses anything.
// The bug (the files' own comments): the algif_aead copy-failure path writes back into its source
// pages, which corrupts memory it does not own only when a zero-copy splice put foreign pages
// (a file's page cache) there. What is NOT real: the traffic rows are examples I picked, not a
// measured workload.

type Mode = "none" | "detector" | "socket" | "splice"

const MODES: { id: Mode; label: string; hook: string }[] = [
  { id: "none", label: "No shield", hook: "nothing attached" },
  { id: "detector", label: "Detector only", hook: "lsm/socket_sendmsg + fexit/aead_recvmsg, counts" },
  { id: "socket", label: "Block AF_ALG", hook: "lsm/socket_create, family 38 → EPERM" },
  { id: "splice", label: "Block splice into AF_ALG", hook: "lsm/socket_sendmsg, MSG_SPLICE_PAGES → EACCES" },
]

type Row = {
  id: string
  what: string
  alg: boolean // opens an AF_ALG socket
  splice: boolean // sends with MSG_SPLICE_PAGES
  aead: boolean // ends in aead_recvmsg
  fails: boolean // the aead op returns an error
  exploit: boolean
}

const ROWS: Row[] = [
  { id: "hash", what: "Hash a buffer through AF_ALG (copying sendmsg)", alg: true, splice: false, aead: false, fails: false, exploit: false },
  { id: "aead-ok", what: "AEAD encrypt and decrypt, copying sendmsg", alg: true, splice: false, aead: true, fails: false, exploit: false },
  { id: "aead-bad", what: "AEAD decrypt with a bad tag, copying sendmsg", alg: true, splice: false, aead: true, fails: true, exploit: false },
  { id: "splice-hash", what: "Hash a file by splicing its pages into AF_ALG", alg: true, splice: true, aead: false, fails: false, exploit: false },
  { id: "exploit", what: "Splice a file's page cache into AEAD, force a failed decrypt", alg: true, splice: true, aead: true, fails: true, exploit: true },
  { id: "tcp", what: "Send on an ordinary TCP socket", alg: false, splice: false, aead: false, fails: false, exploit: false },
]

type Outcome = { text: string; tone: "ok" | "refused" | "bad" | "neutral" }

function outcome(r: Row, mode: Mode): Outcome {
  if (mode === "socket" && r.alg) return { text: "socket() → EPERM", tone: r.exploit ? "ok" : "refused" }
  if (mode === "splice" && r.alg && r.splice) return { text: "sendmsg() → EACCES", tone: r.exploit ? "ok" : "refused" }
  if (r.exploit) return { text: "page cache corrupted", tone: "bad" }
  if (r.aead && r.fails) return { text: "EBADMSG, nothing corrupted", tone: "neutral" }
  return { text: "works", tone: "neutral" }
}

const TONE: Record<Outcome["tone"], string> = {
  ok: "bg-emerald-500/15 text-emerald-800 dark:text-emerald-300",
  refused: "bg-amber-500/15 text-amber-800 dark:text-amber-300",
  bad: "bg-red-500/15 text-red-700 dark:text-red-300",
  neutral: "bg-muted text-foreground",
}

export function ShieldPicker() {
  const [mode, setMode] = useState<Mode>("none")
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(ROWS.map((r) => [r.id, true])))

  const active = ROWS.filter((r) => on[r.id])
  // detector counters: only meaningful when it is attached
  const activity = active.filter((r) => r.aead).length
  const hits = active.filter((r) => r.aead && r.splice && r.fails).length
  const collateral = active.filter((r) => !r.exploit && (outcome(r, mode).tone === "refused")).length
  const exploited = active.some((r) => r.exploit && outcome(r, mode).tone === "bad")

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Three upatches for one kernel bug (CVE-2026-31431)</figcaption>
      <div className="mb-3 flex flex-wrap gap-2" role="radiogroup" aria-label="Which upatch is loaded">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            role="radio"
            aria-checked={mode === m.id}
            onClick={() => setMode(m.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 text-xs transition-colors",
              mode === m.id ? "border-foreground bg-foreground text-background" : "border-border hover:bg-muted",
            )}
          >
            {m.label}
          </button>
        ))}
      </div>
      <p className="mb-3 font-mono text-xs text-muted-foreground">{MODES.find((m) => m.id === mode)?.hook}</p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[30rem] border-collapse text-xs">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="w-8 py-1 font-normal">run</th>
              <th className="py-1 font-normal">what a process does</th>
              <th className="w-44 py-1 font-normal">result</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const o = outcome(r, mode)
              return (
                <tr key={r.id} className={cn("border-t border-border", !on[r.id] && "opacity-40")}>
                  <td className="py-1.5">
                    <input
                      type="checkbox"
                      checked={on[r.id]}
                      onChange={(e) => setOn({ ...on, [r.id]: e.target.checked })}
                      aria-label={`Run: ${r.what}`}
                    />
                  </td>
                  <td className="py-1.5 pr-2">
                    {r.what}
                    {r.exploit && <span className="ml-1 rounded bg-red-500/15 px-1 text-[10px] text-red-700 dark:text-red-300">exploit</span>}
                  </td>
                  <td className="py-1.5">
                    <span className={cn("rounded px-1.5 py-0.5 font-mono", TONE[o.tone])}>{o.text}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">exploit lands</div>
          <div className={cn("font-mono", exploited ? "text-red-700 dark:text-red-300" : "")}>{exploited ? "yes" : "no"}</div>
        </div>
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">legitimate calls refused</div>
          <div className="font-mono">{collateral}</div>
        </div>
        <div className="rounded bg-muted px-2 py-1.5">
          <div className="text-xs text-muted-foreground">detector maps</div>
          <div className="font-mono">
            {mode === "detector" ? `activity ${activity} · hits ${hits}` : "not loaded"}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Rules from the three BPF programs in <code>upatches/kernel-cve/sources/</code>. The traffic rows are examples, not a
        measured workload. Untick rows to see what each shield costs a host that never splices into AF_ALG.
      </p>
    </figure>
  )
}
