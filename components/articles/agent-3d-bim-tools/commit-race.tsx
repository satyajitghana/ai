"use client"

// MutinyBIM's commit rule, as planCommit() in
// packages/bim-kernel/src/changeset.ts (commit 94513ba) applies it to an
// agent's command built on an older revision, split by what each command
// records as authored. Corrected 2026-11-12 after the site's hands-on run
// (/articles/mutiny-bim) raced two sessions on that commit:
// - move_wall records start/end: a second move of the same wall is refused by
//   name (measured; a person or an agent gets the same words). Moves are
//   deltas, so two identical moves still conflict (measured).
// - delete_elements is refused if another session changed the element since
//   the base, whatever field it was, even an unrecorded thickness (measured).
// - set_element_thickness leaves through finish(reader, working, touched, [],
//   ...) in elements/commands.ts: an empty authored list, so two thickness
//   edits both commit and the later one wins, silently (measured: 300 vs 250,
//   revisions 15 and 16, the wall ended at 250).
// - set_element_values shares that exit line (read in the code, not raced).
// - set_parameters records values.<name> (read in the code, not raced).
// - different fields on one wall: both commit (measured for thickness vs move).
// - edits from the same session are dropped from the comparison (read in the
//   code; the measured "two tabs" race was two sessions and was refused).
// Wall ids and values are illustrative; outcomes are the run's or the code's.

import Link from "next/link"
import { useState } from "react"

type Cmd = "move" | "thickness" | "values" | "params" | "delete"
type Basis = "measured" | "read in code"
type Kind = "refused" | "silent" | "committed"

const CMDS: { id: Cmd; label: string; cmd: string; records: string }[] = [
  { id: "move", label: "move the wall", cmd: "move_wall", records: "start, end" },
  { id: "thickness", label: "set its thickness", cmd: "set_element_thickness", records: "nothing (empty list)" },
  { id: "values", label: "set an element value", cmd: "set_element_values", records: "nothing (empty list)" },
  { id: "params", label: "set a part parameter", cmd: "set_parameters", records: "values.<name>" },
  { id: "delete", label: "delete it", cmd: "delete_elements", records: "n/a: reads which elements changed" },
]

type Out = { kind: Kind; code: string; why: string; basis: Basis }

function decide(cmd: Cmd, otherField: boolean, sameSession: boolean): Out {
  if (sameSession) {
    return {
      kind: "committed",
      code: "committed",
      why: "Changesets from the agent's own session are left out of the comparison, so its earlier edit does not compete with it.",
      basis: "read in code",
    }
  }
  if (cmd === "delete") {
    return {
      kind: "refused",
      code: "refused, by name",
      why: "Priya changed wall-12 after you looked at it; check it before deleting. The delete rule reads which elements changed, so even her unrecorded thickness edit protects the wall.",
      basis: "measured",
    }
  }
  if (otherField) {
    return {
      kind: "committed",
      code: "committed (rebased)",
      why: "Priya wrote a different field. The agent's command re-runs on her revision and both changes stand.",
      basis: cmd === "move" || cmd === "thickness" ? "measured" : "read in code",
    }
  }
  if (cmd === "move") {
    return {
      kind: "refused",
      code: "refused, by name",
      why: "Priya changed wall-12 start while you were editing. Even the same +50 is refused: a move is a delta, so re-run on her head it lands somewhere else.",
      basis: "measured",
    }
  }
  if (cmd === "params") {
    return {
      kind: "refused",
      code: "refused, by name",
      why: "set_parameters records values.<name>, so the server sees Priya wrote that parameter since your base and refuses, unless the head already holds your value.",
      basis: "read in code",
    }
  }
  if (cmd === "thickness") {
    return {
      kind: "silent",
      code: "committed: last write wins",
      why: "The command records no authored field, so there is nothing to compare. Priya's 300 and the agent's 250 both commit as revisions 15 and 16; the wall ends at 250 and nobody is told.",
      basis: "measured",
    }
  }
  return {
    kind: "silent",
    code: "committed: last write wins",
    why: "set_element_values leaves through the same finish(…, [], …) line as thickness: no authored field, so the later value overwrites Priya's without a word.",
    basis: "read in code",
  }
}

const TONE: Record<Kind, string> = {
  refused: "border-sky-500/50 bg-sky-500/5",
  committed: "border-emerald-500/50 bg-emerald-500/5",
  silent: "border-amber-500/60 bg-amber-500/10",
}

export function CommitRace() {
  const [cmd, setCmd] = useState<Cmd>("thickness")
  const [otherField, setOtherField] = useState(false)
  const [sameSession, setSameSession] = useState(false)
  const out = decide(cmd, otherField && cmd !== "delete", sameSession)
  const meta = CMDS.find((c) => c.id === cmd)!

  return (
    <figure
      className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent"
      aria-label="MutinyBIM commit decision for two editing sessions, by command"
    >
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>planCommit · base r14, head r15</span>
        <span className="text-muted-foreground/60">corrected 12 Nov 2026</span>
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="space-y-2">
          <div className="text-sm font-semibold">Both sessions, from the same base, on wall-12:</div>
          <div className="flex flex-col gap-1.5">
            {CMDS.map((c) => (
              <Choice key={c.id} on={cmd === c.id} onClick={() => setCmd(c.id)} label={c.label} sub={c.cmd} />
            ))}
          </div>
          <label className="mt-2 flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={otherField && cmd !== "delete"}
              disabled={cmd === "delete"}
              onChange={(e) => setOtherField(e.target.checked)}
            />
            Priya edited a different field instead
          </label>
          <label className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <input type="checkbox" checked={sameSession} onChange={(e) => setSameSession(e.target.checked)} />
            r15 came from the agent&apos;s own session
          </label>
        </div>
        <div className="space-y-2">
          <div className="text-sm font-semibold">Priya committed r15 first. The agent&apos;s command arrives:</div>
          <div className="rounded-md border px-3 py-2 font-mono text-xs text-muted-foreground">
            {meta.cmd} records as authored: <span className="text-foreground">{meta.records}</span>
          </div>
          <div className={"mt-3 rounded-lg border p-3 " + TONE[out.kind]} aria-live="polite">
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono text-xs uppercase tracking-wide">{out.code}</span>
              <span className="rounded-full border px-2 py-0.5 font-mono text-[10px] text-muted-foreground">{out.basis}</span>
            </div>
            <div className="mt-1 text-sm">{out.why}</div>
          </div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        The server re-runs the agent&apos;s command on the head and compares only the fields the command records as
        authored. &ldquo;Measured&rdquo; outcomes are from the race run in the{" "}
        <Link className="underline" href="/articles/mutiny-bim">
          hands-on Mutiny BIM article
        </Link>
        ; &ldquo;read in code&rdquo; ones were not raced. Wall ids are illustrative.
      </figcaption>
    </figure>
  )
}

function Choice({ on, onClick, label, sub }: { on: boolean; onClick: () => void; label: string; sub: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={
        "flex items-baseline justify-between gap-2 rounded-md border px-2.5 py-1 text-left font-mono text-xs " +
        (on ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")
      }
    >
      <span>{label}</span>
      <span className="opacity-60">{sub}</span>
    </button>
  )
}
