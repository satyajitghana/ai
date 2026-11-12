"use client"

// MutinyBIM's commit rule, as planCommit() in
// packages/bim-kernel/src/changeset.ts (commit 94513ba) applies it to an
// agent's command that was built on an older revision:
// 1. the server re-runs the command on the current head with its own code;
// 2. a delete of an element another session changed since the base is refused;
// 3. an authored field another session wrote since the base is refused, unless
//    the head already holds the value this command writes (sameValue);
// 4. edits from the same session (one browser tab, one agent run) never
//    compete with each other;
// 5. otherwise the change commits, rebased onto the head.
// The intent check (an earlier change's recorded intent must still hold on any
// element this one writes) is in the prose, not modelled here.
// The element and the millimetre values are illustrative.

import { useState } from "react"

type First = "none" | "height" | "thickness" | "sameHeight"
type Second = "setHeight" | "delete"

const FIRSTS: { id: First; label: string }[] = [
  { id: "none", label: "nobody touched wall-12" },
  { id: "height", label: "Priya set height to 2,900" },
  { id: "thickness", label: "Priya set thickness to 200" },
  { id: "sameHeight", label: "Priya set height to 3,000" },
]

const SECONDS: { id: Second; label: string }[] = [
  { id: "setHeight", label: "set height to 3,000" },
  { id: "delete", label: "delete wall-12" },
]

function decide(first: First, second: Second, sameSession: boolean) {
  const changed = first !== "none"
  if (sameSession && changed) {
    return { ok: true, code: "committed", why: "Both edits come from the same session, so the earlier one is not competing intent." }
  }
  if (second === "delete") {
    if (changed) {
      return { ok: false, code: "conflict", why: "Priya changed wall-12 after you looked at it; check it before deleting." }
    }
    return { ok: true, code: "committed", why: "Nobody changed wall-12 since your base revision." }
  }
  if (first === "height") {
    return { ok: false, code: "conflict", why: "Priya changed wall-12 height while you were editing." }
  }
  if (first === "sameHeight") {
    return { ok: true, code: "committed", why: "Priya wrote height too, but the head already holds 3,000, the value you write: no competing value." }
  }
  if (first === "thickness") {
    return { ok: true, code: "committed (rebased)", why: "Different authored field. Your command re-ran on the newer head and only height changed." }
  }
  return { ok: true, code: "committed", why: "Nothing changed since your base revision." }
}

export function CommitRace() {
  const [first, setFirst] = useState<First>("height")
  const [second, setSecond] = useState<Second>("setHeight")
  const [sameSession, setSameSession] = useState(false)
  const out = decide(first, second, sameSession)

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="MutinyBIM commit decision for two editing sessions"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>planCommit · base r41, head r42</span>
        <span className="text-muted-foreground/60">rules from the repo</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <div className="text-sm font-semibold">r42, already committed by {sameSession ? "this same session" : "Priya (another session)"}</div>
          <div className="flex flex-col gap-1.5">
            {FIRSTS.map((f) => (
              <Choice key={f.id} on={first === f.id} onClick={() => setFirst(f.id)} label={f.label} />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={sameSession} onChange={(e) => setSameSession(e.target.checked)} />
            r42 came from the agent&apos;s own session
          </label>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">The agent&apos;s command, built on r41</div>
          <div className="flex flex-col gap-1.5">
            {SECONDS.map((s) => (
              <Choice key={s.id} on={second === s.id} onClick={() => setSecond(s.id)} label={s.label} />
            ))}
          </div>
          <div
            className={
              "mt-3 rounded-lg border p-3 " +
              (out.ok ? "border-emerald-500/50 bg-emerald-500/5" : "border-rose-500/50 bg-rose-500/5")
            }
            aria-live="polite"
          >
            <div className="font-mono text-xs uppercase tracking-wide">{out.code}</div>
            <div className="mt-1 text-sm">{out.why}</div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        The server re-runs the agent&apos;s command on r42 and checks it against every changeset since r41. Refusals
        carry the other person&apos;s name and the field. The wall and its values are illustrative.
      </figcaption>
    </figure>
  )
}

function Choice({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        "rounded-md border px-2.5 py-1 text-left font-mono text-xs " +
        (on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
      }
    >
      {label}
    </button>
  )
}
