"use client"

import { useMemo, useState } from "react"

import { cn } from "@/lib/utils"

// The Slack rate limit from the Strands Box announcement, evaluated by hand.
// Rule (AWS blog): forbid http:request POST /api/chat.postMessage when
//   count for (t: Timepoint). where (formerly within 10m
//     Box::Action::"http:request"::response{ ..., output.status: 200 } && tp(t)) >= 3
// Semantics used here, from the Dogwood guide (04-temporal-expressions.md):
//   windows are closed, a witness exactly W back is in; the engine appends a
//   request event to the log before it evaluates it (Local Engine post), so a
//   rule over ::request counts the request being decided. Box records
//   ::request for every decision, permitted or denied, and ::response only
//   when the operation ran (docs/user/policy/actions.md). I did not run the
//   engine; this is my reading of the documented semantics.

type Mode = "response" | "request"

const PRESET = [0, 3, 5, 6, 11]

function hhmm(m: number) {
  return `10:${String(m).padStart(2, "0")}`
}

export function RateLimitTimeline() {
  const [mode, setMode] = useState<Mode>("response")
  const [posts, setPosts] = useState<number[]>(PRESET)

  const rows = useMemo(() => {
    const sorted = [...posts].sort((a, b) => a - b)
    const reqs: number[] = []
    const resps: number[] = []
    return sorted.map((t) => {
      reqs.push(t)
      const count =
        mode === "response"
          ? resps.filter((e) => t - e <= 10).length
          : reqs.filter((e) => t - e <= 10).length
      const allowed = count < 3
      if (allowed) resps.push(t)
      return { t, count, allowed }
    })
  }, [posts, mode])

  const toggle = (m: number) =>
    setPosts((p) => (p.includes(m) ? p.filter((x) => x !== m) : [...p, m]))

  const byMinute = new Map(rows.map((r) => [r.t, r]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">rate_limit_slack_posts · three per 10m</span>
        <div className="flex gap-1">
          {(["response", "request"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "rounded-md border px-2 py-0.5 font-mono text-[10px]",
                mode === k ? "border-foreground/40 bg-background text-foreground" : "border-transparent text-muted-foreground",
              )}
            >
              count ::{k}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3 p-3 sm:p-4">
        <p className="text-[12px] leading-5 text-muted-foreground">
          Click a minute to add or remove a post attempt. Each attempt is decided against the events already recorded.
        </p>
        <div className="grid grid-cols-7 gap-1 sm:grid-cols-[repeat(21,minmax(0,1fr))]">
          {Array.from({ length: 21 }, (_, m) => {
            const r = byMinute.get(m)
            return (
              <button
                key={m}
                type="button"
                onClick={() => toggle(m)}
                aria-label={`${hhmm(m)}: ${r ? (r.allowed ? "post allowed" : "post denied") : "no post"}`}
                className={cn(
                  "flex h-12 flex-col items-center justify-center rounded-md border font-mono text-[9px]",
                  !r && "border-dashed text-muted-foreground",
                )}
                style={
                  r
                    ? r.allowed
                      ? { background: "oklch(0.55 0.14 150 / 0.14)", borderColor: "oklch(0.55 0.14 150)" }
                      : { background: "oklch(0.58 0.20 25 / 0.14)", borderColor: "oklch(0.58 0.20 25)" }
                    : undefined
                }
              >
                <span>{hhmm(m)}</span>
                {r ? <span className="font-medium">{r.allowed ? "200" : "403"}</span> : null}
              </button>
            )
          })}
        </div>

        <ol className="space-y-1">
          {rows.map((r) => (
            <li key={r.t} className="flex flex-wrap items-baseline gap-x-3 font-mono text-[11px]">
              <span className="text-foreground">{hhmm(r.t)}</span>
              <span className="text-muted-foreground">
                {mode === "response" ? "200 responses" : "requests, this one included"} in [{hhmm(Math.max(0, r.t - 10))}, {hhmm(r.t)}]: {r.count}
              </span>
              <span style={{ color: r.allowed ? "oklch(0.55 0.14 150)" : "oklch(0.58 0.20 25)" }}>
                {r.allowed ? "permit" : "forbid → 403 [policy: rate_limit_slack_posts]"}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setPosts(PRESET)} className="rounded-md border px-2 py-1 font-mono text-[10px]">
            the blog&apos;s timeline
          </button>
          <button type="button" onClick={() => setPosts([0, 1, 2, 3, 4, 5, 6])} className="rounded-md border px-2 py-1 font-mono text-[10px]">
            an agent that retries every minute
          </button>
          <button type="button" onClick={() => setPosts([0, 4, 8, 10])} className="rounded-md border px-2 py-1 font-mono text-[10px]">
            the window edge
          </button>
        </div>
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[10px] leading-4 text-muted-foreground">
        Hand evaluation of the announcement&apos;s rule using the Dogwood guide&apos;s window semantics (closed windows; a request is in the
        history when it is decided). Not output from the engine.
      </figcaption>
    </figure>
  )
}
