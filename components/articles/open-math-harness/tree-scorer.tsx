"use client"

// The discovery tree's two rules, ported line for line from the repository at
// commit 80247afe:
//   score()  interfaces/discovery/src/scoring.rs (task-scoring protocol v3)
//   pi0      program-files/discovery/policies/pi0.py (the generation-0 policy)
// Edit the five nodes; the scores and the next batch are recomputed here with
// + - * / and Math.round only, so server and client agree exactly.
//
// Dual-native: the prose sections "Scoring a half-finished proof" and "Which
// branch to grow next" state the same formula, the same ordering and the batch
// this default tree produces.

import { useState } from "react"
import { Range } from "@/components/articles/ui/range"

type Status = "invalid" | "errors" | "sorries" | "unverified" | "solved"

type Node = {
  id: number
  parent: number
  depth: number
  status: Status
  errors: number
  fraction: number
  closed: number
  open: number
  hollow: boolean
}

const INITIAL: Node[] = [
  { id: 1, parent: 0, depth: 1, status: "sorries", errors: 0, fraction: 0, closed: 2, open: 1, hollow: false },
  { id: 2, parent: 0, depth: 1, status: "errors", errors: 2, fraction: 0.8, closed: 0, open: 0, hollow: false },
  { id: 3, parent: 0, depth: 1, status: "invalid", errors: 0, fraction: 0, closed: 0, open: 0, hollow: false },
  { id: 4, parent: 1, depth: 2, status: "sorries", errors: 0, fraction: 0, closed: 1, open: 2, hollow: false },
  { id: 5, parent: 1, depth: 2, status: "errors", errors: 5, fraction: 0.3, closed: 0, open: 0, hollow: false },
]

const STATUS_LABEL: Record<Status, string> = {
  invalid: "invalid",
  errors: "errors",
  sorries: "sorries",
  unverified: "complete, verify rejected",
  solved: "complete, verified",
}

// scoring.rs: score(verdict, verified, credit), rounded to four decimals.
function score(n: Node): number {
  let raw: number
  if (n.status === "solved") raw = 1.0
  else if (n.status === "unverified") raw = 0.9
  else if (n.status === "errors") raw = 0.05
  else if (n.status === "invalid") raw = 0.0
  else {
    const total = n.closed + n.open
    const frac = n.hollow || total === 0 ? 0 : n.closed / total
    raw = 0.5 + 0.4 * Math.min(frac, 0.999)
  }
  return Math.round(raw * 10000) / 10000
}

// The root is the frozen statement itself, proof `sorry`: its one leaf is the
// theorem, which is hollow by definition, so it sits at the 0.5 base.
const ROOT_SCORE = 0.5

// pi0.py decide(): order continuable nodes by (score desc, depth asc, id asc),
// drop invalid ones, reserve the first slot for the best repair prospect
// (errors <= 3, fewest errors, then latest first error), else the sorries
// leaf with the most closed steps; fill the rest in order; cut to w.
function pi0(nodes: Node[], w: number): { batch: number[]; reserved: number | null; order: number[] } {
  const parents = new Set(nodes.map((n) => n.parent))
  const leaves = nodes.filter((n) => !parents.has(n.id)).map((n) => n.id)
  const info = new Map<number, { s: number; d: number; n: Node | null }>()
  info.set(0, { s: ROOT_SCORE, d: 0, n: null })
  for (const n of nodes) info.set(n.id, { s: score(n), d: n.depth, n })
  const continuable = [...leaves, 0]
  const order = [...continuable].sort((a, b) => {
    const A = info.get(a)!
    const B = info.get(b)!
    if (A.s !== B.s) return B.s - A.s
    if (A.d !== B.d) return A.d - B.d
    return a - b
  })
  const eligible = order.filter((v) => v === 0 || info.get(v)!.n!.status !== "invalid")
  let repair: [number, number, number, number] | null = null
  let sketch: [number, number, number] | null = null
  eligible.forEach((v, pos) => {
    if (v === 0) return
    const n = info.get(v)!.n!
    if (n.status === "errors" && n.errors <= 3) {
      const key: [number, number, number, number] = [n.errors, -n.fraction, pos, v]
      if (!repair || lexLess(key, repair)) repair = key
    } else if (n.status === "sorries") {
      const key: [number, number, number] = [-n.closed, pos, v]
      if (!sketch || lexLess(key, sketch)) sketch = key
    }
  })
  const r = repair as [number, number, number, number] | null
  const k = sketch as [number, number, number] | null
  const reserved = r ? r[3] : k ? k[2] : null
  const batch = reserved !== null ? [reserved] : []
  for (const v of eligible) if (v !== reserved) batch.push(v)
  return { batch: batch.slice(0, w), reserved, order }
}

function lexLess(a: number[], b: number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] < b[i]
  }
  return false
}

const STATUSES: Status[] = ["invalid", "errors", "sorries", "unverified", "solved"]

export function TreeScorer() {
  const [nodes, setNodes] = useState<Node[]>(INITIAL)
  const [w, setW] = useState(2)

  const update = (id: number, patch: Partial<Node>) =>
    setNodes((ns) => ns.map((n) => (n.id === id ? { ...n, ...patch } : n)))

  const solved = nodes.find((n) => n.status === "solved")
  const { batch, reserved, order } = pi0(nodes, w)
  const parents = new Set(nodes.map((n) => n.parent))

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="font-mono text-xs text-muted-foreground">
        a discovery tree after two rounds: edit any node, then read the next batch
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-left text-xs">
          <thead className="font-mono text-[10px] text-muted-foreground">
            <tr>
              <th className="py-1 pr-2">node</th>
              <th className="pr-2">parent</th>
              <th className="pr-2">Lean verdict</th>
              <th className="pr-2">detail</th>
              <th className="pr-2 text-right">score</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t">
              <td className="py-1 pr-2 font-mono">0 (root)</td>
              <td className="pr-2 font-mono">none</td>
              <td className="pr-2">sorries</td>
              <td className="pr-2 text-muted-foreground">the frozen statement; its leaf is hollow</td>
              <td className="pr-2 text-right font-mono">{ROOT_SCORE.toFixed(4)}</td>
            </tr>
            {nodes.map((n) => (
              <tr key={n.id} className="border-t align-top">
                <td className="py-1 pr-2 font-mono">
                  {n.id}
                  {parents.has(n.id) ? <span className="text-muted-foreground"> (inner)</span> : null}
                </td>
                <td className="pr-2 font-mono">{n.parent}</td>
                <td className="pr-2">
                  <select
                    aria-label={`verdict of node ${n.id}`}
                    value={n.status}
                    onChange={(e) => update(n.id, { status: e.target.value as Status })}
                    className="rounded border bg-background px-1 py-0.5 text-xs"
                  >
                    {STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABEL[s]}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="pr-2">
                  {n.status === "sorries" ? (
                    <span className="flex flex-wrap items-center gap-1.5">
                      <label className="flex items-center gap-1">
                        C
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={n.closed}
                          onChange={(e) => update(n.id, { closed: clampInt(e.target.value) })}
                          className="w-12 rounded border bg-background px-1"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        L
                        <input
                          type="number"
                          min={0}
                          max={20}
                          value={n.open}
                          onChange={(e) => update(n.id, { open: clampInt(e.target.value) })}
                          className="w-12 rounded border bg-background px-1"
                        />
                      </label>
                      <label className="flex items-center gap-1">
                        <input
                          type="checkbox"
                          checked={n.hollow}
                          onChange={(e) => update(n.id, { hollow: e.target.checked })}
                        />
                        hollow leaf
                      </label>
                    </span>
                  ) : n.status === "errors" ? (
                    <label className="flex items-center gap-1">
                      errors
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={n.errors}
                        onChange={(e) => update(n.id, { errors: Math.max(1, clampInt(e.target.value)) })}
                        className="w-12 rounded border bg-background px-1"
                      />
                      <span className="text-muted-foreground">
                        {n.errors <= 3 ? "repairable" : "not repairable"}
                      </span>
                    </label>
                  ) : (
                    <span className="text-muted-foreground">fixed score</span>
                  )}
                </td>
                <td className="pr-2 text-right font-mono">{score(n).toFixed(4)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs">
        <label htmlFor="omh-w" className="font-mono">
          width W = {w}
        </label>
        <Range id="omh-w" min={1} max={6} step={1} value={w} onChange={(e) => setW(Number(e.target.value))} className="w-40" />
      </div>

      <div className="mt-3 rounded-md border bg-background/60 p-3 text-xs leading-5">
        {solved ? (
          <p>
            Node {solved.id} scored 1.0. The loop stops: a verified solve ends the rollout, and the
            round&apos;s other live workers are killed.
          </p>
        ) : (
          <>
            <p>
              <span className="font-mono text-muted-foreground">continuable, ordered: </span>
              <span className="font-mono">{order.join(", ")}</span>
            </p>
            <p className="mt-1">
              <span className="font-mono text-muted-foreground">next batch: </span>
              {batch.map((v, i) => (
                <span
                  key={`${v}-${i}`}
                  className={`mr-1 inline-block rounded border px-1.5 font-mono ${
                    v === reserved ? "border-orange-500 bg-orange-500/15" : ""
                  }`}
                >
                  {v === 0 ? "0 (fresh root)" : v}
                </span>
              ))}
            </p>
            <p className="mt-1 text-muted-foreground">
              {reserved !== null
                ? `Node ${reserved} takes the reserved first slot as the best repair prospect. Each batch entry spawns one worker that resumes that node's workspace and produces one child.`
                : "No repair prospect, so the batch follows the ordering. Each batch entry spawns one worker that resumes that node's workspace and produces one child."}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function clampInt(s: string): number {
  const v = Math.round(Number(s))
  if (!Number.isFinite(v)) return 0
  return Math.min(20, Math.max(0, v))
}
