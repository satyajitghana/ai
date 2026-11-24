"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The phases `shirudo upatch load` runs, in order, and where each failure stops it. Phase names,
// failure categories and what each phase does are from Documentation/reference/failure-categories.rst
// and Documentation/start/how-it-works.rst at commit 154afee. The "root calls bpf() itself" case is
// not a shirudo command at all: it is lsm/bpf refusing a load from userspace that is not a signed
// BPF_PROG_TYPE_SYSCALL loader (Documentation/security/security-model.rst).

type Phase = { id: string; label: string; does: string }

const PHASES: Phase[] = [
  { id: "pre_flight", label: "pre_flight", does: "signed-loader ABI present, .bpf keyring matches the frozen record" },
  { id: "parse", label: "parse", does: "header, signed name, payload_sha256 recomputed over the signed bytes" },
  { id: "pin", label: "pin", does: "refuse a name that is already loaded" },
  { id: "signed_loader_load", label: "signed_loader_load", does: "freeze __loader.map, BPF_PROG_LOAD: kernel checks the ML-DSA-87 signature; lsm/bpf and lsm/bpf_prog_load bracket it" },
  { id: "payload_load", label: "payload_load", does: "the loader runs in the kernel and loads each program through the verifier" },
  { id: "link_create", label: "link_create", does: "attach, compare the link with the signed attach metadata, pin in the private bpffs" },
  { id: "persist", label: "persist", does: "archive the artifact for the next boot" },
  { id: "tpm_extend", label: "tpm_extend", does: "extend the measurement register, append the eventlog record" },
  { id: "done", label: "done", does: "the shield is live and measured" },
]

type Case = { id: string; label: string; stop: string | null; category?: string; note: string }

const CASES: Case[] = [
  { id: "good", label: "Signed upatch, built for this kernel", stop: null, note: "Every phase passes. The register now records the load." },
  { id: "flip", label: "A byte changed after signing", stop: "parse", category: "parser_rejected", note: "The header names the SHA-256 of the signed bytes; the target recomputes it and refuses a mismatch." },
  { id: "resign", label: "Changed, and re-signed with a key the target does not hold", stop: "signed_loader_load", category: "signature_rejected", note: "The kernel checks one signature over the loader instructions and the frozen map against the sealed .bpf keyring." },
  { id: "loaded", label: "A upatch of that name is already loaded", stop: "pin", category: "already_loaded", note: "Nothing is touched. Unload it with its signed directive first." },
  { id: "core", label: "Reads a struct field this kernel renamed", stop: "payload_load", category: "verifier_rejected", note: "CO-RE cannot relocate the access; the verifier log comes back in the report." },
  { id: "scope", label: "Kernel reports the kprobe at another offset", stop: "link_create", category: "attach_scope_mismatch", note: "shirudo compares the link the kernel made with the site the signed metadata names." },
  { id: "tpm", label: "The TPM refuses the extension", stop: "tpm_extend", category: "tpm_error, load undone", note: "An unmeasured load is undone rather than left running." },
  { id: "root", label: "Root calls bpf() with its own program", stop: "signed_loader_load", category: "EPERM from lsm/bpf", note: "Not a shirudo command: lsm/bpf admits a load from userspace only as a signed loader, even for CAP_SYS_ADMIN." },
]

export function LoadGate() {
  const [caseId, setCaseId] = useState("good")
  const c = CASES.find((x) => x.id === caseId) ?? CASES[0]
  const stopAt = c.stop ? PHASES.findIndex((p) => p.id === c.stop) : PHASES.length - 1

  return (
    <figure className="not-prose my-8 rounded-lg border border-border bg-card p-4 text-sm">
      <figcaption className="mb-3 font-medium">Where a load stops: the phases of <code>shirudo upatch load</code></figcaption>
      <label className="mb-3 block">
        <span className="mb-1 block text-xs text-muted-foreground">What arrives on the target</span>
        <select
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm"
          aria-label="Scenario"
        >
          {CASES.map((x) => (
            <option key={x.id} value={x.id}>
              {x.label}
            </option>
          ))}
        </select>
      </label>
      <ol className="space-y-1">
        {PHASES.map((p, i) => {
          const passed = i < stopAt || (c.stop === null && i <= stopAt)
          const failed = c.stop !== null && i === stopAt
          const skipped = c.stop !== null && i > stopAt
          return (
            <li
              key={p.id}
              className={cn(
                "grid grid-cols-[1.25rem_9.5rem_1fr] items-start gap-2 rounded px-2 py-1",
                failed && "bg-red-500/10",
                skipped && "opacity-35",
              )}
            >
              <span aria-hidden className={cn("font-mono", passed ? "text-emerald-600 dark:text-emerald-400" : failed ? "text-red-600 dark:text-red-400" : "text-muted-foreground")}>
                {passed ? "✓" : failed ? "✕" : "·"}
              </span>
              <span className="font-mono text-xs">{p.label}</span>
              <span className="text-xs text-muted-foreground">{p.does}</span>
            </li>
          )
        })}
      </ol>
      <p className={cn("mt-3 rounded px-2 py-1.5 text-xs", c.stop ? "bg-red-500/10 text-red-700 dark:text-red-300" : "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300")}>
        {c.stop ? (
          <>
            Stops at <code>{c.stop}</code>, <code>{c.category}</code>. {c.note}
          </>
        ) : (
          c.note
        )}
      </p>
    </figure>
  )
}
