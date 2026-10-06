"use client"

import { useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A replay of treg's routed `treg.people.email.find`, with the catalog's own
// numbers. Candidates are the routed adapters in src/treg/catalog/adapters.yaml
// (commit f93ae9b) whose `accepts` matches the identity the caller sent; each
// price is the endpoint's `cost` in src/treg/catalog/<provider>.yaml times that
// provider's credit rate in src/treg/catalog/fx.yaml. Ranking follows rank() in
// src/treg/domain/catalog/routing/plan.py:
//
//   key = (tier, prefer, specificity, ignored filters, expected cost per hit,
//          p50 latency, days since last ok, endpoint id)
//   expected cost per hit = price x P(billed) / P(hit)
//
// P(billed) is P(hit) for per_success pricing (a miss is free) and 1 for
// per_call, so for per_success the hit rate cancels and only price is left.
// Live hit rates and latencies come from treg's own call log and are not in the
// repo, so they are left out (every candidate ties on them) except for the one
// per_call endpoint, whose hit rate the reader sets. The waterfall in
// src/treg/application/call/route.py walks the ranking, skips a candidate whose
// price would push the spend past X-Treg-Route-Max-Cost ($1.00 by default),
// continues on a miss, and stops at the first hit.
//
// Pure function of the controls: no randomness, no timers.

type Pricing = "per_success" | "per_call"

type Cand = {
  id: string
  usd: number // list price of one call / one hit, in USD
  pricing: Pricing
}

const NAME_DOMAIN: Cand[] = [
  { id: "quickenrich.people.email.find", usd: 0.004834, pricing: "per_success" },
  { id: "trykitt.people.email.find", usd: 0.005, pricing: "per_success" },
  { id: "tomba.people.email.find", usd: 0.0089, pricing: "per_success" },
  { id: "moltsets.people.email.find.name", usd: 0.01, pricing: "per_success" },
  { id: "dropleads.people.email.find", usd: 0.018, pricing: "per_success" },
  { id: "findymail.search.name", usd: 0.0198, pricing: "per_success" },
  { id: "limadata.people.email.find.name", usd: 0.02, pricing: "per_success" },
  { id: "datagma.people.email.find", usd: 0.02258, pricing: "per_success" },
  { id: "hunter.people.email.find", usd: 0.0245, pricing: "per_success" },
  { id: "leadsforge.people.email.find", usd: 0.0245, pricing: "per_success" },
  { id: "prospeo.people.email.find", usd: 0.0245, pricing: "per_success" },
  { id: "leadmagic.people.email.find", usd: 0.025, pricing: "per_success" },
  { id: "wiza.people.email.find", usd: 0.075, pricing: "per_success" },
]

const LINKEDIN: Cand[] = [
  { id: "quickenrich.people.email.find", usd: 0.004834, pricing: "per_success" },
  { id: "aiark.people.email.find", usd: 0.005267, pricing: "per_success" },
  { id: "tomba.people.email.find.linkedin", usd: 0.0089, pricing: "per_success" },
  { id: "findymail.search.business-profile", usd: 0.0198, pricing: "per_success" },
  { id: "harvestapi.linkedin.user.profile.email", usd: 0.02, pricing: "per_call" },
  { id: "leadsforge.people.email.find", usd: 0.0245, pricing: "per_success" },
  { id: "prospeo.people.email.find", usd: 0.0245, pricing: "per_success" },
  { id: "fiber-ai.people.contacts.reveal", usd: 0.04, pricing: "per_success" },
  { id: "leadmagic.x.personal-email-finder", usd: 0.05, pricing: "per_success" },
  { id: "fiber-ai.people.contacts.turbo", usd: 0.06, pricing: "per_success" },
  { id: "limadata.people.email.find.linkedin", usd: 0.06, pricing: "per_success" },
  { id: "wiza.people.email.find", usd: 0.075, pricing: "per_success" },
  { id: "aviato.people.email.find", usd: 0.08, pricing: "per_success" },
  { id: "contactout.people.contact.work", usd: 0.15, pricing: "per_success" },
]

const MAX_COST = 1.0

type Ranked = Cand & { own: boolean; price: number; expected: number }

function rank(cands: Cand[], ownHunter: boolean, perCallHit: number): Ranked[] {
  const rows = cands.map((c) => {
    const own = ownHunter && c.id.startsWith("hunter.")
    const price = own ? 0 : c.usd
    const pHit = Math.max(perCallHit / 100, 0.01)
    const expected = own ? 0 : c.pricing === "per_success" ? price : price / pHit
    return { ...c, own, price, expected }
  })
  return rows.sort((a, b) => {
    const ta = a.own ? 0 : 2
    const tb = b.own ? 0 : 2
    if (ta !== tb) return ta - tb
    if (a.expected !== b.expected) return a.expected - b.expected
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
  })
}

type Step = { row: Ranked; outcome: "miss" | "hit" | "skipped" | "not asked"; charged: number }

function walk(rows: Ranked[], holder: number, waterfall: boolean): { steps: Step[]; spent: number; found: boolean } {
  const steps: Step[] = []
  let spent = 0
  let done = false
  let found = false
  rows.forEach((row, i) => {
    if (done) {
      steps.push({ row, outcome: "not asked", charged: 0 })
      return
    }
    if (spent + row.price > MAX_COST + 1e-9) {
      steps.push({ row, outcome: "skipped", charged: 0 })
      return
    }
    if (i === holder) {
      spent += row.price
      steps.push({ row, outcome: "hit", charged: row.price })
      done = true
      found = true
      return
    }
    const charged = row.pricing === "per_call" ? row.price : 0
    spent += charged
    steps.push({ row, outcome: "miss", charged })
    if (!waterfall) done = true
  })
  return { steps, spent, found }
}

const fmt = (x: number) => (x === 0 ? "$0" : `$${x.toFixed(x < 0.01 ? 4 : 3)}`)

const OUTCOME_STYLE: Record<Step["outcome"], string> = {
  hit: "border-emerald-600/60 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
  miss: "border-border text-muted-foreground",
  skipped: "border-amber-500/50 bg-amber-500/5 text-amber-700 dark:text-amber-400",
  "not asked": "border-border/50 text-muted-foreground/60",
}

function Toggle({
  checked,
  onChange,
  children,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
}) {
  return (
    <label className="flex items-start gap-2 text-xs">
      <input type="checkbox" className="mt-0.5" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  )
}

export function RouteWaterfall() {
  const [identity, setIdentity] = useState<"name" | "linkedin">("name")
  const [ownHunter, setOwnHunter] = useState(false)
  const [waterfall, setWaterfall] = useState(true)
  const [perCallHit, setPerCallHit] = useState(100)
  const [holder, setHolder] = useState(3)

  const cands = identity === "name" ? NAME_DOMAIN : LINKEDIN
  const rows = rank(cands, ownHunter, perCallHit)
  const h = Math.min(holder, rows.length)
  const { steps, spent, found } = walk(rows, h, waterfall)
  const holderLabel = h >= rows.length ? "nobody" : `rung ${h + 1}, ${rows[h].id.split(".")[0]}`

  return (
    <figure className="not-prose my-8 rounded-lg border p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["name", "linkedin"] as const).map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setIdentity(k)}
            className={cn(
              "border-border hover:bg-muted rounded-md border px-2.5 py-1 font-mono text-xs",
              identity === k && "bg-muted font-semibold",
            )}
          >
            {k === "name" ? "{full_name, domain}" : "{linkedin_url}"}
          </button>
        ))}
        <span className="text-muted-foreground font-mono text-xs">
          {rows.length} candidates · max cost {fmt(MAX_COST)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Toggle checked={ownHunter} onChange={setOwnHunter}>
          Your team connected its own Hunter key {identity === "linkedin" ? "(Hunter takes no LinkedIn URL)" : ""}
        </Toggle>
        <Toggle checked={waterfall} onChange={setWaterfall}>
          Waterfall on (off = <code>X-Treg-Route-Waterfall: 0</code>, stop at the first miss)
        </Toggle>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block text-xs">
          <span className="text-muted-foreground">Who actually has this person&apos;s email: </span>
          <span className="font-mono">{holderLabel}</span>
          <Range
            className="mt-1 w-full"
            min={0}
            max={rows.length}
            step={1}
            value={h}
            onChange={(e) => setHolder(Number(e.target.value))}
            aria-label="Which rung holds the answer"
          />
        </label>
        {identity === "linkedin" ? (
          <label className="block text-xs">
            <span className="text-muted-foreground">Hit rate of the one per-call endpoint (HarvestAPI): </span>
            <span className="font-mono">{perCallHit}%</span>
            <Range
              className="mt-1 w-full"
              min={10}
              max={100}
              step={5}
              value={perCallHit}
              onChange={(e) => setPerCallHit(Number(e.target.value))}
              aria-label="Per-call endpoint hit rate"
            />
          </label>
        ) : (
          <p className="text-muted-foreground text-xs">
            Every name-and-domain finder here is priced per success, so its hit rate cancels out of the
            ranking. Switch to the LinkedIn identity to see the one that is not.
          </p>
        )}
      </div>

      <ol className="mt-4 space-y-1">
        {steps.map((s, i) => (
          <li
            key={s.row.id}
            className={cn(
              "grid grid-cols-[2rem_1fr_auto] items-center gap-2 rounded-md border px-2 py-1 font-mono text-[11px]",
              OUTCOME_STYLE[s.outcome],
            )}
          >
            <span>{i + 1}</span>
            <span className="truncate">
              {s.row.id}
              {s.row.own ? " · own key" : ""}
              {s.row.pricing === "per_call" ? " · per call" : ""}
            </span>
            <span className="text-right">
              {s.row.own ? "free" : `${fmt(s.row.price)}`}
              {s.row.pricing === "per_call" && !s.row.own ? ` → ${fmt(s.row.expected)}/hit` : ""} · {s.outcome}
              {s.charged > 0 ? ` · billed ${fmt(s.charged)}` : ""}
            </span>
          </li>
        ))}
      </ol>

      <figcaption className="text-muted-foreground mt-3 text-xs">
        {found ? "Found" : "Not found"} after {steps.filter((s) => s.outcome === "hit" || s.outcome === "miss").length}{" "}
        call{steps.filter((s) => s.outcome === "hit" || s.outcome === "miss").length === 1 ? "" : "s"}; the team pays{" "}
        <span className="text-foreground font-mono">{fmt(spent)}</span>. Prices are the catalog&apos;s list rates at commit
        f93ae9b (credits converted with its <code>fx.yaml</code>); live hit rates and latencies, which break ties on
        treg.to, are not in the repo and are left out. Which providers the hosted service holds keys for is also not in
        the repo.
      </figcaption>
    </figure>
  )
}
