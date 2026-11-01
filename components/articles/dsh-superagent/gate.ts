// A re-implementation of the human-trigger branch of settingsPolicy().gate in
// deepseek-ai/dsh-superagent-prototype (src/policy.ts, commit 6337fc8), written from reading the code and
// the admission defaults in src/admission.ts, not imported from it. Enumerating all 72 combinations of the six
// inputs below gives, for the default table, 30 explicit / 10 inferred / 32 refused; with the "open support"
// table (unlisted + addressed = explicit) 54 / 6 / 12.

export type Addressed = "none" | "mention" | "direct"
export type Mode = "off" | "observe" | "auto"
export type Cell = "explicit" | "inferred" | "ignore"

export interface GateInput {
  listed: boolean
  addressed: Addressed
  ticket: boolean
  mode: Mode
  observed: boolean
  unlistedAddressed: Cell
}

export interface GateResult {
  strength: "explicit" | "inferred" | "refused"
  via: string
}

const DEFAULTS = { listedUnaddressed: "inferred", unlistedAddressed: "ignore", unlistedUnaddressed: "ignore" } as const

export function gate(i: GateInput): GateResult {
  const addressed = i.addressed !== "none"
  if (i.listed && addressed) return { strength: "explicit", via: "A listed person addressed the agent. No table cell is consulted." }
  const cell = i.listed ? "listedUnaddressed" : addressed ? "unlistedAddressed" : "unlistedUnaddressed"
  const receivable = addressed || i.observed
  const table = cell === "unlistedAddressed" ? i.unlistedAddressed : DEFAULTS[cell]
  const admission = receivable ? table : "ignore"
  if (admission === "explicit") return { strength: "explicit", via: "The admission table's unlisted-and-addressed cell is set to explicit." }
  if (!(i.addressed === "direct" && !i.listed) && (i.listed || i.mode !== "off") && i.ticket) {
    return {
      strength: i.listed ? "explicit" : "inferred",
      via: i.listed ? "A listed person followed up on a thread that has a ticket." : "An unlisted person followed up on a thread that has a ticket; inferred, and only because the mode is not off.",
    }
  }
  if (admission === "inferred" && i.mode !== "off") return { strength: "inferred", via: "The admission table makes this an inferred candidate; Eval still has to assess it." }
  if (!receivable) return { strength: "refused", via: "Unaddressed, and this scope only receives mentions. The Source drops it before the gate sees it." }
  if (admission === "inferred") return { strength: "refused", via: "Table says inferred, but the accept mode is off: nothing inferred becomes a candidate." }
  return { strength: "refused", via: "The table says ignore for this sender and address." }
}

export function tally(unlistedAddressed: Cell): Record<GateResult["strength"], number> {
  const out = { explicit: 0, inferred: 0, refused: 0 }
  for (const listed of [true, false])
    for (const addressed of ["none", "mention", "direct"] as Addressed[])
      for (const ticket of [true, false])
        for (const mode of ["off", "observe", "auto"] as Mode[])
          for (const observed of [true, false]) out[gate({ listed, addressed, ticket, mode, observed, unlistedAddressed }).strength]++
  return out
}
