"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

import { gate, tally, type Addressed, type Cell, type Mode } from "./gate"

// Interactive view of the gate that decides whether a message may start work. The logic is our re-implementation
// (./gate.ts) of dsh-superagent's policy gate, checked by enumeration, not DeepSeek's own test run.

function Seg<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { id: T; text: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="w-28 shrink-0 font-mono text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-1" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            aria-pressed={value === o.id}
            onClick={() => onChange(o.id)}
            className={cn(
              "rounded-md border px-2.5 py-1 font-mono text-xs transition-colors",
              value === o.id ? "border-foreground bg-foreground text-background" : "hover:bg-muted/60",
            )}
          >
            {o.text}
          </button>
        ))}
      </div>
    </div>
  )
}

const TONE = {
  explicit: "border-emerald-500/50 bg-emerald-500/10",
  inferred: "border-amber-500/50 bg-amber-500/10",
  refused: "border-rose-500/40 bg-rose-500/10",
} as const

export function GateExplorer() {
  const [listed, setListed] = useState(false)
  const [addressed, setAddressed] = useState<Addressed>("mention")
  const [ticket, setTicket] = useState(false)
  const [mode, setMode] = useState<Mode>("observe")
  const [observed, setObserved] = useState(false)
  const [cell, setCell] = useState<Cell>("ignore")

  const r = gate({ listed, addressed, ticket, mode, observed, unlistedAddressed: cell })
  const t = tally(cell)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">gate · who may start work · re-implemented from src/policy.ts</span>
        <span className="font-mono text-xs">{t.explicit} explicit / {t.inferred} inferred / {t.refused} refused of 72</span>
      </div>
      <div className="grid gap-3 p-4">
        <Seg label="sender" value={listed ? "listed" : "unlisted"} options={[{ id: "listed", text: "on the allowed list" }, { id: "unlisted", text: "not on the list" }]} onChange={(v) => setListed(v === "listed")} />
        <Seg label="addresses agent" value={addressed} options={[{ id: "none", text: "no" }, { id: "mention", text: "mention" }, { id: "direct", text: "direct message" }]} onChange={setAddressed} />
        <Seg label="thread" value={ticket ? "ticket" : "new"} options={[{ id: "new", text: "no ticket yet" }, { id: "ticket", text: "already has a ticket" }]} onChange={(v) => setTicket(v === "ticket")} />
        <Seg label="accept mode" value={mode} options={[{ id: "off", text: "off" }, { id: "observe", text: "observe" }, { id: "auto", text: "auto" }]} onChange={setMode} />
        <Seg label="scope receives" value={observed ? "all" : "mentions"} options={[{ id: "mentions", text: "mentions only" }, { id: "all", text: "every message" }]} onChange={(v) => setObserved(v === "all")} />
        <Seg label="unlisted+addressed" value={cell} options={[{ id: "ignore", text: "ignore (default)" }, { id: "inferred", text: "inferred" }, { id: "explicit", text: "explicit" }]} onChange={setCell} />
        <div className={cn("rounded-lg border px-3 py-2.5", TONE[r.strength])} aria-live="polite">
          <div className="font-mono text-sm font-semibold uppercase tracking-wide">{r.strength}</div>
          <p className="mt-1 text-sm leading-snug">{r.via}</p>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Reasoned from the code, then enumerated: with the default table, an unlisted person never gets an explicit request, and in mode off nothing unlisted gets through at all.
      </figcaption>
    </figure>
  )
}
