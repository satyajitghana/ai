"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// Two ways to turn scores into a graph.
//
// GLiNER2 thresholded entities and relations independently and handed you both
// lists. Nothing connects them, so the union is routinely not a graph: a
// relation can name an entity that fell below the bar, and a person can end up
// with two employers when the schema says one.
//
// GLiNER2.5 scores the same candidates in one forward pass and then assembles
// them, checking each admission against the declared rules as the solution is
// built. Two consequences fall straight out. A strong relation can pull a weak
// entity into the graph — Fastino's own figure labels this `rescued: true`. And
// a cardinality rule resolves itself in favour of the higher-scoring edge
// instead of being left for your ingestion code.
//
// The admission below is greedy in descending score, which is the simple
// version of what the system does with a beam over the same candidate pool. The
// scores are the ones in Fastino's figure; the fourth relation is added so the
// cardinality rule has something to bite on.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

type Ent = { id: string; type: string; score: number; x: number; y: number }
type Rel = { s: string; p: string; o: string; score: number }

const ENTS: Ent[] = [
  { id: "Alice", type: "person", score: 0.94, x: 108, y: 52 },
  { id: "Bob", type: "person", score: 0.28, x: 108, y: 158 },
  { id: "Acme", type: "organization", score: 0.91, x: 330, y: 104 },
  { id: "Globex", type: "organization", score: 0.52, x: 560, y: 44 },
  { id: "Paris", type: "location", score: 0.89, x: 560, y: 166 },
]

const RELS: Rel[] = [
  { s: "Alice", p: "works_for", o: "Acme", score: 0.88 },
  { s: "Acme", p: "located_in", o: "Paris", score: 0.86 },
  { s: "Bob", p: "works_for", o: "Acme", score: 0.81 },
  { s: "Alice", p: "works_for", o: "Globex", score: 0.44 },
]

// the circles are 54px across, so the type has to be short enough to sit inside one
const SHORT: Record<string, string> = { person: "person", organization: "org", location: "place" }

const byId = (id: string) => ENTS.find((e) => e.id === id)!

type Solved = {
  ents: Set<string>
  rels: Rel[]
  rescued: Set<string>
  dangling: Rel[]
  overCardinality: string[]
  blocked: Rel[]
}

function solve(tau: number, joint: boolean, cardinality: boolean): Solved {
  const ents = new Set<string>()
  const rescued = new Set<string>()
  const rels: Rel[] = []
  const blocked: Rel[] = []
  const employers = new Map<string, number>()

  if (!joint) {
    // two independent thresholds, no communication between them
    for (const e of ENTS) if (e.score >= tau) ents.add(e.id)
    for (const r of RELS) if (r.score >= tau) rels.push(r)
    const dangling = rels.filter((r) => !ents.has(r.s) || !ents.has(r.o))
    for (const r of rels) {
      if (r.p !== "works_for") continue
      employers.set(r.s, (employers.get(r.s) ?? 0) + 1)
    }
    const over = cardinality
      ? [...employers.entries()].filter(([, n]) => n > 1).map(([k]) => k)
      : []
    return { ents, rels, rescued, dangling, overCardinality: over, blocked }
  }

  // joint: admit in descending score, checking the rules on the way in
  const pool = [
    ...ENTS.map((e) => ({ kind: "e" as const, score: e.score, e })),
    ...RELS.map((r) => ({ kind: "r" as const, score: r.score, r })),
  ].sort((a, b) => b.score - a.score)

  for (const c of pool) {
    if (c.kind === "e") {
      if (c.e.score >= tau) ents.add(c.e.id)
      continue
    }
    const r = c.r
    if (r.score < tau) continue
    if (cardinality && r.p === "works_for" && (employers.get(r.s) ?? 0) >= 1) {
      blocked.push(r)
      continue
    }
    // the relation is in, so its endpoints must be too — this is the rescue
    for (const end of [r.s, r.o]) {
      if (!ents.has(end)) {
        ents.add(end)
        if (byId(end).score < tau) rescued.add(end)
      }
    }
    rels.push(r)
    if (r.p === "works_for") employers.set(r.s, (employers.get(r.s) ?? 0) + 1)
  }
  return { ents, rels, rescued, dangling: [], overCardinality: [], blocked }
}

export function JointGraph() {
  const [joint, setJoint] = useState(false)
  const [tau, setTau] = useState(50)
  const [cardinality, setCardinality] = useState(true)

  const t = tau / 100
  const s = solve(t, joint, cardinality)
  const violations = s.dangling.length + s.overCardinality.length

  const W = 700
  const H = 216

  const colourFor = (e: Ent) =>
    s.rescued.has(e.id) ? GOOD : e.type === "person" ? ACCENT : e.type === "organization" ? WARM : "oklch(0.55 0.10 300)"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          &ldquo;Alice works for Acme in Paris. Bob joined Acme last year.&rdquo;
        </span>
        <span className="font-mono text-[10px]" style={{ color: violations ? BAD : GOOD }}>
          {violations ? `${violations} schema violation${violations > 1 ? "s" : ""}` : "well-formed"}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              [false, "independent thresholds (GLiNER2)"],
              [true, "joint decode (GLiNER2.5)"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={String(k)}
              type="button"
              onClick={() => setJoint(k)}
              aria-pressed={joint === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                joint === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setCardinality((v) => !v)}
            aria-pressed={cardinality}
            className={cn(
              "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
              cardinality
                ? "border-foreground/30 bg-muted/50 text-foreground"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            rule: one employer per person
          </button>
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A five-node graph of Alice, Bob, Acme, Globex and Paris. ${
                joint
                  ? "Under joint decoding every drawn edge connects two nodes that are in the graph."
                  : `Under independent thresholding ${s.dangling.length} edge or edges point at a node that was dropped.`
              }`}
            </title>

            {RELS.map((r) => {
              const a = byId(r.s)
              const b = byId(r.o)
              const inGraph = s.rels.includes(r)
              const isDangling = s.dangling.includes(r)
              const isBlocked = s.blocked.includes(r)
              if (!inGraph && !isBlocked) return null
              const colour = isDangling ? BAD : isBlocked ? "currentColor" : GOOD
              const mx = (a.x + b.x) / 2
              const my = (a.y + b.y) / 2
              return (
                <g key={`${r.s}-${r.p}-${r.o}`}>
                  <line
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                    stroke={colour}
                    strokeOpacity={isBlocked ? 0.22 : 0.65}
                    strokeWidth={isBlocked ? 1 : 1.8}
                    strokeDasharray={isDangling ? "4 3" : isBlocked ? "2 3" : undefined}
                  />
                  <rect
                    x={mx - 46}
                    y={my - 8}
                    width={92}
                    height={13}
                    rx={3}
                    fill="var(--background, #fff)"
                    fillOpacity={0.85}
                  />
                  <text
                    x={mx}
                    y={my + 2}
                    fontSize={7.5}
                    textAnchor="middle"
                    fill={colour}
                    fillOpacity={isBlocked ? 0.5 : 1}
                    fontFamily="ui-monospace, monospace"
                  >
                    {r.p} {r.score.toFixed(2)}
                    {isBlocked ? " ✕" : ""}
                  </text>
                </g>
              )
            })}

            {ENTS.map((e) => {
              const inGraph = s.ents.has(e.id)
              const colour = colourFor(e)
              return (
                <g key={e.id} opacity={inGraph ? 1 : 0.22}>
                  <circle
                    cx={e.x}
                    cy={e.y}
                    r={27}
                    fill={colour}
                    fillOpacity={inGraph ? 0.14 : 0.05}
                    stroke={colour}
                    strokeOpacity={inGraph ? 0.75 : 0.3}
                    strokeDasharray={s.rescued.has(e.id) ? "4 3" : undefined}
                  />
                  <text x={e.x} y={e.y - 6} fontSize={9.5} textAnchor="middle" fill={colour} fontFamily="ui-monospace, monospace">
                    {e.id}
                  </text>
                  <text x={e.x} y={e.y + 5} fontSize={6.5} textAnchor="middle" fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                    {SHORT[e.type] ?? e.type}
                  </text>
                  <text x={e.x} y={e.y + 16} fontSize={7} textAnchor="middle" fill={colour} fontFamily="ui-monospace, monospace">
                    {e.score.toFixed(2)}
                  </text>
                  {s.rescued.has(e.id) ? (
                    <text x={e.x} y={e.y + 39} fontSize={7} textAnchor="middle" fill={GOOD} fontFamily="ui-monospace, monospace">
                      rescued
                    </text>
                  ) : null}
                </g>
              )
            })}
          </svg>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="w-24 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
            threshold τ
          </span>
          <Range
            min={20}
            max={90}
            step={1}
            value={tau}
            onChange={(e) => setTau(Number(e.target.value))}
            className="flex-1"
            aria-label="the confidence threshold applied to entity and relation candidates"
            accent={ACCENT}
          />
          <span className="w-10 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
            {t.toFixed(2)}
          </span>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[
            { l: "entities in graph", v: `${s.ents.size} / ${ENTS.length}`, c: ACCENT },
            { l: "edges in graph", v: `${s.rels.length} / ${RELS.length}`, c: GOOD },
            {
              l: "violations",
              v: violations ? `${s.dangling.length} dangling · ${s.overCardinality.length} over-cardinality` : "none",
              c: violations ? BAD : GOOD,
            },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-xs tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Leave it on independent thresholds and drag τ down from 0.90. At 0.81 the edge{" "}
          <span className="font-mono text-[11px] text-foreground">Bob works_for Acme</span>{" "}enters
          the output while Bob himself, at 0.28, is still nowhere near the bar — an edge naming a
          node that does not exist. Drag further and Alice acquires a second employer. Neither is a
          model error; both are what happens when two lists are produced by two independent
          argmaxes and stapled together afterwards.
          <br />
          <br />
          Switch to joint decode and the same numbers behave. The 0.81 edge{" "}
          <span style={{ color: GOOD }}>pulls Bob in with it</span>, because a relation cannot be
          admitted without its endpoints. The 0.44 edge to Globex is refused, because by the time it
          comes up Alice already has the employer the rule allows.{" "}
          <span className="text-foreground">
            The consistency work did not disappear — it moved from your ingestion pipeline into the
            decoder
          </span>
          , where it can be done while the scores are still available.
        </p>
      </div>
    </figure>
  )
}
