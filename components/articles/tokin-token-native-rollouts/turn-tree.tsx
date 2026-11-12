"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A session as tokin's Session.attach builds it (src/tokin/session.py at v0.1.0): each request continues the deepest
// turn whose messages it begins with, a request that shares no turn's start opens a new root, and every leaf is a
// rollout. The trainer side follows examples/pi_mimo_rl/generate.py: one sample per leaf, and a turn shared by
// several leaves trained once, in the first. Token counts are illustrative; the structure is the code's.

type Turn = {
  id: string
  parent: string | null
  delta: number
  y: number
  sent: string
  why: string
}

const TURNS: Turn[] = [
  { id: "A", parent: null, delta: 420, y: 60, sent: "[task]", why: "Nothing precedes it: a root. tokin renders system prompt, tools and task as Δ₀." },
  { id: "B", parent: "A", delta: 180, y: 90, sent: "[task, a₀, o₁]", why: "Begins with A's messages, reply echoed by text, reasoning and call id: child of A. Only o₁ is encoded." },
  { id: "C", parent: "B", delta: 240, y: 50, sent: "[task, a₀, o₁, a₁, o₂]", why: "B is the deepest turn it continues. Only o₂ is encoded; y₀ and y₁ are reused as sampled." },
  { id: "D", parent: "A", delta: 200, y: 70, sent: "[task, a₀, o₁′]", why: "The harness rewrote o₁, so it continues A but not B: a branch at A that keeps y₀." },
  { id: "E", parent: null, delta: 900, y: 40, sent: "[summary]", why: "A compaction replaced the history with a summary. It starts no turn's path: a new root." },
  { id: "F", parent: "E", delta: 120, y: 30, sent: "[summary, aₑ, o]", why: "Continues E like any other turn." },
]
const BY_ID = Object.fromEntries(TURNS.map((t) => [t.id, t]))

// Layout of the tree, in a 300 x 170 box.
const POS: Record<string, [number, number]> = {
  A: [30, 30],
  B: [110, 30],
  C: [190, 30],
  D: [110, 85],
  E: [30, 140],
  F: [110, 140],
}

function path(id: string): Turn[] {
  const out: Turn[] = []
  let t: Turn | undefined = BY_ID[id]
  while (t) {
    out.unshift(t)
    t = t.parent ? BY_ID[t.parent] : undefined
  }
  return out
}

export function TurnTree() {
  const [n, setN] = useState(TURNS.length)
  const [pick, setPick] = useState<string>("D")
  const [once, setOnce] = useState(true)

  const served = TURNS.slice(0, n)
  const parents = new Set(served.map((t) => t.parent))
  const leaves = served.filter((t) => !parents.has(t.id)).map((t) => t.id)
  const leaf = leaves.includes(pick) ? pick : leaves[leaves.length - 1]
  const last = served[served.length - 1]

  // Which leaf trains each turn first: leaves in the order they were served.
  const owner: Record<string, string> = {}
  for (const l of leaves) for (const t of path(l)) if (!(t.id in owner)) owner[t.id] = l

  const rollout = path(leaf)
  const total = rollout.reduce((s, t) => s + t.delta + t.y, 0)
  const trainedHere = rollout.reduce((s, t) => s + (!once || owner[t.id] === leaf ? t.y : 0), 0)
  const trainedAll = leaves.reduce(
    (s, l) => s + path(l).reduce((ss, t) => ss + (!once || owner[t.id] === l ? t.y : 0), 0),
    0
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">one session, request by request</span>
        <span className="font-mono text-[11px] text-muted-foreground">structure from session.py; token counts illustrative</span>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <label className="flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
          <span className="shrink-0">requests served: {n}</span>
          <Range min={1} max={TURNS.length} step={1} value={n} onChange={(e) => setN(Number(e.target.value))} aria-label="requests served" />
        </label>

        <div className="grid gap-3 sm:grid-cols-[minmax(0,300px)_1fr]">
          <svg viewBox="0 0 300 170" className="w-full max-w-[300px]" role="img" aria-label="The session's tree of turns">
            {served
              .filter((t) => t.parent)
              .map((t) => {
                const [x1, y1] = POS[t.parent as string]
                const [x2, y2] = POS[t.id]
                const on = rollout.some((r) => r.id === t.id)
                return (
                  <path
                    key={t.id}
                    d={y1 === y2 ? `M${x1} ${y1} L${x2} ${y2}` : `M${x1} ${y1} L${x1} ${y2} L${x2} ${y2}`}
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity={on ? 0.8 : 0.3}
                    strokeWidth={on ? 2 : 1.2}
                  />
                )
              })}
            {served.map((t) => {
              const [x, y] = POS[t.id]
              const isLeaf = leaves.includes(t.id)
              const on = rollout.some((r) => r.id === t.id)
              return (
                <g
                  key={t.id}
                  onClick={() => isLeaf && setPick(t.id)}
                  className={isLeaf ? "cursor-pointer" : undefined}
                  role={isLeaf ? "button" : undefined}
                  aria-label={isLeaf ? `rollout ending at ${t.id}` : undefined}
                >
                  <circle
                    cx={x}
                    cy={y}
                    r={13}
                    className={cn(on ? "fill-sky-500/30" : "fill-muted", t.id === last.id && "stroke-amber-500")}
                    stroke="currentColor"
                    strokeOpacity={t.id === last.id ? 1 : 0.5}
                    strokeWidth={t.id === last.id ? 2.5 : 1}
                  />
                  <text x={x} y={y + 4} textAnchor="middle" fontSize={12} className="fill-foreground font-mono">
                    {t.id}
                  </text>
                  {isLeaf && (
                    <text x={x + 18} y={y + 4} fontSize={9} className="fill-muted-foreground font-mono">
                      leaf
                    </text>
                  )}
                </g>
              )
            })}
          </svg>

          <div className="space-y-2 text-sm">
            <div className="font-mono text-[11px] text-muted-foreground">
              request {last.id} sends <span className="text-foreground">{last.sent}</span>
            </div>
            <p className="leading-relaxed">{last.why}</p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {leaves.map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPick(l)}
                  aria-pressed={leaf === l}
                  className={cn(
                    "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px]",
                    leaf === l ? "border-foreground/30 bg-muted/60" : "border-border text-muted-foreground hover:text-foreground"
                  )}
                >
                  rollout {path(l).map((t) => t.id).join("→")}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 font-mono text-[11px] text-muted-foreground">
            <span>
              rollout ending at {leaf}: {total.toLocaleString("en-US")} ids, loss mask 1 on {trainedHere.toLocaleString("en-US")}
            </span>
            <button
              type="button"
              onClick={() => setOnce(!once)}
              aria-pressed={once}
              className="cursor-pointer rounded-full border px-2.5 py-1 hover:text-foreground"
            >
              {once ? "●" : "○"} train a shared turn once (the pi recipe)
            </button>
          </div>
          <div className="flex h-9 w-full overflow-hidden rounded-md border">
            {rollout.flatMap((t) => {
              const mine = !once || owner[t.id] === leaf
              return [
                <div
                  key={`${t.id}d`}
                  style={{ flexGrow: t.delta }}
                  className="flex items-center justify-center border-r bg-muted/50 font-mono text-[10px] text-muted-foreground"
                  title={`Δ of ${t.id}: rendered by tokin, mask 0`}
                >
                  Δ{t.id}
                </div>,
                <div
                  key={`${t.id}y`}
                  style={{ flexGrow: t.y }}
                  className={cn(
                    "flex items-center justify-center border-r font-mono text-[10px]",
                    mine ? "bg-sky-600/70 text-white" : "bg-sky-600/20 text-muted-foreground"
                  )}
                  title={`y of ${t.id}: sampled, mask ${mine ? 1 : 0}`}
                >
                  y{t.id}
                </div>,
              ]
            })}
          </div>
          <p className="mt-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
            grey Δ: ids tokin rendered (mask 0). Solid blue y: sampled ids trained in this sample. Pale blue y: sampled, but trained
            in an earlier leaf. Ids trained across all {leaves.length} samples: {trainedAll.toLocaleString("en-US")}.
          </p>
        </div>
      </div>
    </figure>
  )
}
