"use client"

import { useState } from "react"

// Pencil and ink in an OpenTakeoff MCP session, read from mcp/src/session.ts
// and web/src/lib at commit 9624be8 (2026-10-10).
//
// - Every agent commit goes through Session.commit(), which forces
//   origin.reviewed = false and attaches the open proposal's id.
// - reviewed: true arrives only from a person: the canvas's Accept pill on a
//   batch (web/src/lib/proposals.js), carried back into a session by
//   import_takeoff. The APPROVED seal is minted only by the canvas's Approve
//   tool (approvals.js); mark_verdict takes no actor and mints AGENT.
// - Guards on reviewed work: edit_shape (editShape), cut_out (cutOut),
//   scope_merge (scopeMerge, as the loser) refuse. delete_shape (deleteShape)
//   has no review check. withdraw_proposal removes pending shapes only.
// - conditionTotals (totals.js) adds every shape's quantity whatever its
//   review state, so pending pencil counts in takeoff_summary from the
//   moment it is committed.
//
// The three rooms and their areas are made up.

type Shape = {
  id: string
  room: string
  sf: number
  reviewed: boolean
  deleted: boolean
  verdict: boolean
  seal: boolean
}

const START: Shape[] = [
  { id: "shp-1", room: "134", sf: 261.9, reviewed: false, deleted: false, verdict: false, seal: false },
  { id: "shp-2", room: "136", sf: 180.4, reviewed: false, deleted: false, verdict: false, seal: false },
  { id: "shp-3", room: "137", sf: 218.2, reviewed: false, deleted: false, verdict: false, seal: false },
]

type Verb = "edit_shape" | "cut_out" | "scope_merge" | "delete_shape" | "mark_verdict"

const VERBS: Verb[] = ["edit_shape", "cut_out", "scope_merge", "delete_shape", "mark_verdict"]

// Refusal text as the server writes it (ids substituted).
function refusal(v: Verb, id: string): string | null {
  if (v === "edit_shape")
    return `Shape "${id}" was affirmed by a human — reviewed work is ink, not pencil, and cannot be edited by an agent.`
  if (v === "cut_out")
    return `Shape ${id} was affirmed by a human — reviewed work is ink, and cutting a hole in it would mutate what the estimator signed.`
  if (v === "scope_merge")
    return `Shape ${id} (CPT-1) was affirmed by a human — reviewed work is ink, and trimming or deleting it would mutate what the estimator signed.`
  return null
}

export function PencilInk() {
  const [shapes, setShapes] = useState<Shape[]>(START)
  const [sel, setSel] = useState("shp-1")
  const [log, setLog] = useState<string[]>([
    "propose_takeoff → batch “Level 1 rooms per finish schedule” opened",
    "measure_polygon × 3 → committed reviewed:false, attached to the batch",
  ])

  const live = shapes.filter((s) => !s.deleted)
  const total = live.reduce((n, s) => n + s.sf, 0)
  const inked = live.filter((s) => s.reviewed).reduce((n, s) => n + s.sf, 0)
  const pending = live.filter((s) => !s.reviewed).length
  const cur = shapes.find((s) => s.id === sel && !s.deleted) ?? live[0]

  const push = (line: string) => setLog((l) => [...l.slice(-5), line])

  function agent(v: Verb) {
    if (!cur) return
    if (cur.reviewed) {
      const r = refusal(v, cur.id)
      if (r) {
        push(`${v}(${cur.id}) → refused: ${r}`)
        return
      }
    }
    if (v === "delete_shape") {
      setShapes((ss) => ss.map((s) => (s.id === cur.id ? { ...s, deleted: true } : s)))
      push(
        `delete_shape(${cur.id}) → deleted${cur.reviewed ? " — no review check on this verb, so ink goes too" : ""}`,
      )
      return
    }
    if (v === "mark_verdict") {
      if (cur.verdict) {
        push(`mark_verdict(${cur.id}) → refused: one mark per shape`)
        return
      }
      setShapes((ss) => ss.map((s) => (s.id === cur.id ? { ...s, verdict: true } : s)))
      push(`mark_verdict(${cur.id}) → AGENT diamond; no quantity changes, nothing is approved`)
      return
    }
    push(`${v}(${cur.id}) → allowed on pencil; the shape is re-measured and stays reviewed:false`)
  }

  function withdraw() {
    const gone = live.filter((s) => !s.reviewed).length
    const kept = live.filter((s) => s.reviewed).length
    setShapes((ss) => ss.map((s) => (!s.deleted && !s.reviewed ? { ...s, deleted: true } : s)))
    push(`withdraw_proposal → ${gone} pending removed, ${kept} accepted kept (ink stays)`)
  }

  function accept() {
    setShapes((ss) => ss.map((s) => (s.deleted ? s : { ...s, reviewed: true })))
    push("estimator clicks Accept on the batch pill → pencil becomes ink (reviewed:true)")
  }

  function approve() {
    if (!cur) return
    setShapes((ss) => ss.map((s) => (s.id === cur.id ? { ...s, seal: true } : s)))
    push(`estimator uses the Approve tool on ${cur.id} → green APPROVED ring (no MCP verb can do this)`)
  }

  function reset() {
    setShapes(START)
    setSel("shp-1")
    setLog(["reset"])
  }

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4 font-mono text-[11px]">
      <div className="grid gap-2 sm:grid-cols-3">
        {shapes.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.deleted}
            onClick={() => setSel(s.id)}
            aria-pressed={cur?.id === s.id}
            className={
              "rounded border p-2 text-left transition-colors disabled:opacity-40 " +
              (cur?.id === s.id ? "border-foreground" : "border-border hover:bg-muted") +
              (s.reviewed ? " border-solid" : " border-dashed")
            }
          >
            <div className="flex items-center justify-between">
              <span>
                room {s.room} · {s.id}
              </span>
              <span className="flex gap-1">
                {s.verdict && (
                  <span className="rounded bg-zinc-500/20 px-1 text-zinc-600 dark:text-zinc-300" title="AGENT diamond">
                    ◆ AGENT
                  </span>
                )}
                {s.seal && (
                  <span className="rounded bg-emerald-600/15 px-1 text-emerald-700 dark:text-emerald-400" title="APPROVED seal">
                    ● APPROVED
                  </span>
                )}
              </span>
            </div>
            <div className="mt-1">
              {s.deleted ? "deleted" : `${s.sf.toFixed(1)} SF · ${s.reviewed ? "ink (reviewed:true)" : "pencil (reviewed:false)"}`}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">agent, on {cur ? cur.id : "nothing"}:</span>
        {VERBS.map((v) => (
          <button
            key={v}
            type="button"
            disabled={!cur}
            onClick={() => agent(v)}
            className="rounded border border-border px-2 py-0.5 transition-colors hover:bg-muted disabled:opacity-40"
          >
            {v}
          </button>
        ))}
        <button
          type="button"
          disabled={pending === 0}
          onClick={withdraw}
          className="rounded border border-border px-2 py-0.5 transition-colors hover:bg-muted disabled:opacity-40"
        >
          withdraw_proposal
        </button>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <span className="text-muted-foreground">estimator, in the canvas:</span>
        <button
          type="button"
          disabled={pending === 0}
          onClick={accept}
          className="rounded border border-blue-500 px-2 py-0.5 text-blue-600 transition-colors hover:bg-blue-500/10 disabled:opacity-40 dark:text-blue-400"
        >
          Accept batch ({pending})
        </button>
        <button
          type="button"
          disabled={!cur}
          onClick={approve}
          className="rounded border border-emerald-600 px-2 py-0.5 text-emerald-700 transition-colors hover:bg-emerald-600/10 disabled:opacity-40 dark:text-emerald-400"
        >
          Approve
        </button>
        <button type="button" onClick={reset} className="ml-auto rounded border border-border px-2 py-0.5 hover:bg-muted">
          reset
        </button>
      </div>

      <div className="mt-3 rounded border bg-background/60 p-2">
        <div>
          takeoff_summary: CPT-1 floor_sf = <b>{total.toFixed(1)}</b>
          <span className="text-muted-foreground">
            {" "}
            (of which reviewed {inked.toFixed(1)} SF; pending pencil is counted too)
          </span>
        </div>
        <ol className="mt-2 list-none space-y-0.5 text-muted-foreground">
          {log.map((l, i) => (
            <li key={i}>› {l}</li>
          ))}
        </ol>
      </div>

      <figcaption className="mt-3 font-sans text-xs text-muted-foreground">
        Three made-up rooms in one proposal. Agent verbs that touch a shape a person accepted are refused by
        edit_shape, cut_out and scope_merge; delete_shape has no such check. mark_verdict only ever mints the
        grey AGENT mark, and only the canvas&apos;s Approve tool mints the green seal. The total counts pencil and
        ink alike.
      </figcaption>
    </figure>
  )
}
