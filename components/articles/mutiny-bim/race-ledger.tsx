"use client"

// Seven races I ran against MutinyBIM's dev server (commit 94513ba): two sync
// clients in one Node process, both connected to the same model, each
// submitting one command in the same tick, so both carry the same base
// revision. Revisions, outcomes and messages are copied from the run's log
// (conflicts2.json); the "records as authored" column is read from the kernel
// source: move_wall pushes start and end (commands.ts), and the element-core
// commands (set_element_thickness, set_element_values, set_element_type,
// set_element_class, set_element_placement) all end in
// finish(reader, working, touched, [], ...) in elements/commands.ts, an empty
// list. planCommit() only compares fields in that list. SSR-safe.

import { useState } from "react"

type Side = { who: string; cmd: string; args: string; status: "committed" | "rejected"; rev?: number; message?: string }
type Race = { id: string; title: string; base: number; a: Side; b: Side; authored: string; why: string }

const RACES: Race[] = [
  {
    id: "thick",
    title: "Same wall, thickness 300 vs 250",
    base: 14,
    a: { who: "Priya", cmd: "set_element_thickness", args: "300 mm", status: "committed", rev: 15 },
    b: { who: "Avery", cmd: "set_element_thickness", args: "250 mm", status: "committed", rev: 16 },
    authored: "none (empty list)",
    why: "The command records no authored field, so the server has nothing to compare. Both commit; the wall ends at 250 and Priya is not told. Last write wins.",
  },
  {
    id: "move",
    title: "Same wall, moved +100 vs -150",
    base: 16,
    a: { who: "Priya", cmd: "move_wall", args: "x +100", status: "committed", rev: 17 },
    b: { who: "Avery", cmd: "move_wall", args: "x -150", status: "rejected", message: "Priya changed wall-2014a0c039274c2e-4 start while you were editing" },
    authored: "start, end (and joined walls' ends)",
    why: "Avery's move is re-run on the head; it writes start, which Priya wrote since the base, to a different value. Refused, by name.",
  },
  {
    id: "same",
    title: "Same wall, both moved +50",
    base: 17,
    a: { who: "Priya", cmd: "move_wall", args: "x +50", status: "committed", rev: 18 },
    b: { who: "Avery", cmd: "move_wall", args: "x +50", status: "rejected", message: "Priya changed wall-2014a0c039274c2e-2 start while you were editing" },
    authored: "start, end",
    why: "A move is a delta. Re-run on the head it puts the wall at +100, not the +50 Priya wrote, so the values differ and the same-value exemption does not apply.",
  },
  {
    id: "mixed",
    title: "Same wall, thickness vs move",
    base: 18,
    a: { who: "Priya", cmd: "set_element_thickness", args: "260 mm", status: "committed", rev: 19 },
    b: { who: "Avery", cmd: "move_wall", args: "x +80", status: "committed", rev: 20 },
    authored: "thickness: none · move: start, end",
    why: "Different fields (and the thickness edit records none). Avery's move commits on top of Priya's change.",
  },
  {
    id: "agent",
    title: "Person vs agent, both move one wall",
    base: 20,
    a: { who: "Priya", cmd: "move_wall", args: "x +60", status: "committed", rev: 21 },
    b: { who: "Avery's agent", cmd: "move_wall", args: "x -60", status: "rejected", message: "Priya changed wall-b7134495d8d06f58-2 start while you were editing" },
    authored: "start, end",
    why: "The agent is an actor of kind agent with its own session. It gets the same refusal, in the same words, as a person would.",
  },
  {
    id: "delete",
    title: "Thickness edit vs delete",
    base: 21,
    a: { who: "Priya", cmd: "set_element_thickness", args: "280 mm", status: "committed", rev: 22 },
    b: { who: "Avery", cmd: "delete_elements", args: "policy disconnect", status: "rejected", message: "Priya changed wall-2014a0c039274c2e-4 after you looked at it; check it before deleting" },
    authored: "n/a: the delete rule reads changed elements",
    why: "The delete check looks at which elements other sessions changed, not at authored fields, so even an unrecorded thickness edit protects the wall from a blind delete.",
  },
  {
    id: "tabs",
    title: "Priya in two tabs, both move one wall",
    base: 22,
    a: { who: "Priya, tab 1", cmd: "move_wall", args: "x +40", status: "committed", rev: 23 },
    b: { who: "Priya, tab 2", cmd: "move_wall", args: "x -40", status: "rejected", message: "Priya changed wall-b7134495d8d06f58-4 start while you were editing" },
    authored: "start, end",
    why: "Same person, different session id. Each tab is its own session, so Priya is told that Priya changed it.",
  },
]

export function RaceLedger() {
  const [id, setId] = useState("thick")
  const r = RACES.find((x) => x.id === id) ?? RACES[0]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/20 to-transparent" aria-label="Seven measured commit races on MutinyBIM's dev server">
      <div className="flex items-center justify-between border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>seven races · both sides sent on the same base revision</span>
        <span className="text-muted-foreground/60">measured</span>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b px-4 py-3 font-mono text-xs">
        {RACES.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setId(x.id)}
            aria-pressed={x.id === id}
            className={"rounded-md border px-2 py-0.5 " + (x.id === id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}
          >
            {x.title}
          </button>
        ))}
      </div>

      <div className="grid gap-3 p-4 sm:grid-cols-2 sm:p-5">
        <SideCard s={r.a} base={r.base} order="sent first" />
        <SideCard s={r.b} base={r.base} order="sent second" />
      </div>

      <div className="space-y-2 px-4 pb-4 text-sm sm:px-5">
        <div className="font-mono text-xs">
          <span className="text-muted-foreground">fields the command records as authored: </span>
          {r.authored}
        </div>
        <p className="leading-snug text-muted-foreground">{r.why}</p>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        Outcomes and messages are copied from the run, against the in-memory dev server over a local socket. The authored-field column is read from the kernel source, not measured.
      </figcaption>
    </figure>
  )
}

function SideCard({ s, base, order }: { s: Side; base: number; order: string }) {
  const ok = s.status === "committed"
  return (
    <div className={"rounded-lg border p-3 " + (ok ? "" : "border-foreground/60")}>
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold">{s.who}</span>
        <span className="font-mono text-[10px] text-muted-foreground">{order}</span>
      </div>
      <div className="font-mono text-xs">
        {s.cmd} <span className="text-muted-foreground">({s.args})</span>
      </div>
      <div className="font-mono text-[11px] text-muted-foreground">base revision {base}</div>
      <div className={"mt-2 inline-block rounded px-1.5 py-0.5 font-mono text-xs " + (ok ? "bg-muted" : "bg-foreground text-background")}>
        {ok ? `committed as revision ${s.rev}` : "rejected: conflict"}
      </div>
      {s.message ? <div className="mt-2 text-xs leading-snug">&ldquo;{s.message}&rdquo;</div> : null}
    </div>
  )
}
