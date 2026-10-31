"use client"

import { useState } from "react"

// Every row is a decider I wrote against switch's loop (src/core/loop.ts, v0.1.1) and ran on the README's
// ticket-triage domain with its view function. "requests" is how many times the decider was called.
// Nothing here is a model: the decider returns what the row says, so the table shows what the LOOP does with it.

type Row = {
  id: string
  label: string
  returned: string
  ended: string
  steps: number
  requests: number
  detail: string
  verdict: "ok" | "stops" | "throws"
}

const ROWS: Row[] = [
  { id: "bad-label", label: "A label that is not on the menu", returned: 'pick: choice "o99"', ended: "failed", steps: 1, requests: 1, detail: 'error: "the model answered o99 to pick, which is none of its labels"', verdict: "stops" },
  { id: "other-q", label: "A label from another question", returned: 'pick: choice "infra"', ended: "failed", steps: 1, requests: 1, detail: 'same check; "infra" is a label of the team question, not of this pick', verdict: "stops" },
  { id: "wrong-type", label: "A bool where a choice was asked", returned: "pick: bool 0.5", ended: "failed", steps: 1, requests: 1, detail: 'error: "the answer to pick is a bool answer, not a choice one"', verdict: "stops" },
  { id: "missing", label: "No answer for the question", returned: "{} (empty answers)", ended: "failed", steps: 1, requests: 1, detail: 'error: "no answer to pick"', verdict: "stops" },
  { id: "api-error", label: "The API reports an error", returned: 'stopReason "error", 503 upstream', ended: "failed", steps: 1, requests: 1, detail: 'error: "503 upstream"; no retry in the loop (pi-ai retries twice below it)', verdict: "stops" },
  { id: "too-long-3", label: "Window exceeded on every try", returned: "tooLong, three times", ended: "failed", steps: 1, requests: 3, detail: "two notes in the trace; the view budget shrinks 0.7x per retry, three attempts in all", verdict: "stops" },
  { id: "too-long-1", label: "Window exceeded once", returned: "tooLong, then a valid answer", ended: "done", steps: 2, requests: 3, detail: "one note in the trace; the second attempt carried a smaller view and succeeded", verdict: "ok" },
  { id: "throws", label: "The decider throws", returned: 'Error("network down")', ended: "run() rejects", steps: 0, requests: 1, detail: "the exception escapes run(); this loop writes no failed ending for it", verdict: "throws" },
  { id: "never-stop", label: "Always label o1, never stop", returned: "first label every time", ended: "done", steps: 10, requests: 10, detail: "8 reads, then only stop is left so o1 is stop, then team: the menu empties itself", verdict: "ok" },
  { id: "stop-now", label: "Always the last label", returned: "last label every time", ended: "done", steps: 2, requests: 2, detail: "stop at once, then the last team label", verdict: "ok" },
  { id: "cut", label: "Always o1 over 50 logs", returned: "first label every time", ended: "step limit", steps: 20, requests: 20, detail: "20 of 51 options shown per step (stop kept by priority), 20 logs read, the domain's 20-step cap ends it", verdict: "stops" },
]

const TONE = { ok: "bg-emerald-500/15", stops: "bg-amber-500/15", throws: "bg-red-500/15" } as const

export function FailureLab() {
  const [id, setId] = useState(ROWS[0].id)
  const r = ROWS.find((x) => x.id === id) ?? ROWS[0]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        what the loop does with a bad decider · 11 runs I executed against switch 0.1.1
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[1fr_1.2fr]">
        <ul className="space-y-1" role="listbox" aria-label="Decider behaviours">
          {ROWS.map((x) => (
            <li key={x.id}>
              <button
                type="button"
                role="option"
                aria-selected={x.id === id}
                onClick={() => setId(x.id)}
                className={`w-full rounded border px-2 py-1 text-left text-xs ${x.id === id ? "border-foreground" : "border-border text-muted-foreground"}`}
              >
                {x.label}
              </button>
            </li>
          ))}
        </ul>
        <div className="space-y-2 text-sm">
          <div className="font-mono text-xs text-muted-foreground">decider returns</div>
          <div className="rounded border p-2 font-mono text-xs">{r.returned}</div>
          <div className="font-mono text-xs text-muted-foreground">the loop</div>
          <div className={`rounded border p-2 text-xs ${TONE[r.verdict]}`}>
            <div className="font-mono">
              ended: <b>{r.ended}</b> · steps: {r.steps} · decider calls: {r.requests}
            </div>
            <p className="mt-1">{r.detail}</p>
          </div>
        </div>
      </div>
    </figure>
  )
}
