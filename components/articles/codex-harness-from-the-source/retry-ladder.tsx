"use client"

import { useState } from "react"

import { Chip, Panel, Src } from "./ui"

// Constants: core/src/responses_retry.rs:58-176; async-utils/src/backoff.rs:6-19 (200 ms, doubling, 90-110% jitter);
// model-provider-info/src/lib.rs:72-79 (5 stream retries, 300 s idle timeout); protocol/src/error.rs:426-478 (terminal kinds).
type Kind = { id: string; label: string; how: "terminal" | "ladder" | "advice" | "connection"; note: string }

const KINDS: Kind[] = [
  { id: "ctx", label: "ContextWindowExceeded", how: "terminal", note: "Returned to the turn loop, which marks the window full; it is not retried (turn.rs:1892-1912)." },
  { id: "usage", label: "UsageLimitReached", how: "terminal", note: "Rate limits are recorded and the turn returns; it is not retried." },
  { id: "invalid", label: "InvalidRequest", how: "terminal", note: "One of the 29 error kinds that never retry." },
  { id: "stream", label: "Stream / Timeout / 5xx", how: "ladder", note: "Backs off 0.2, 0.4, 0.8, 1.6 and 3.2 seconds (each ±10%), unless the server sends Retry-After." },
  { id: "overload", label: "ServerOverloaded", how: "advice", note: "Retried only when the server gives advice on how long to wait." },
  { id: "conn", label: "ConnectionFailed (sampling request)", how: "connection", note: "With the default-on UnboundedConnectionRetries feature it retries forever: 5 s, doubling to a 60 s cap, showing “Reconnecting… waiting for network”." },
]

const LADDER = [0.2, 0.4, 0.8, 1.6, 3.2]
const CONN = [5, 10, 20, 40, 60, 60, 60]

function Waits({ waits, tone }: { waits: number[]; tone: string }) {
  const total = waits.reduce((a, b) => a + b, 0)
  return (
    <div>
      <div className="flex h-8 overflow-hidden rounded">
        {waits.map((w, i) => (
          <div key={i} className={tone} style={{ width: `${(w / total) * 100}%` }}>
            <div className="flex h-full items-center justify-center border-r border-background text-[10px] tabular-nums">{w}s</div>
          </div>
        ))}
      </div>
      <div className="mt-1 text-[11.5px] text-muted-foreground">{waits.length} waits, {total.toFixed(1)} s in all</div>
    </div>
  )
}

export function RetryLadder() {
  const [id, setId] = useState("stream")
  const k = KINDS.find((x) => x.id === id) ?? KINDS[3]
  return (
    <Panel title="What happens when a request fails" sub="most errors never reach the backoff ladder">
      <div className="mb-3 flex flex-wrap gap-1.5">
        {KINDS.map((x) => (<Chip key={x.id} tone={x.how === "terminal" ? "rose" : "emerald"} active={id === x.id} onClick={() => setId(x.id)}>{x.label}</Chip>))}
      </div>
      <div className="rounded-lg border border-border bg-muted/40 p-3 text-[13px]">
        <p className="mb-2">{k.note}</p>
        {k.how === "ladder" ? (
          <>
            <Waits waits={LADDER} tone="bg-emerald-500/40" />
            <p className="mt-2 text-xs text-muted-foreground">If the five retries run out, it tries once to switch the transport (WebSocket to HTTPS) and resets the counter; after that a failure ends the turn with an error message so the user can continue.</p>
          </>
        ) : null}
        {k.how === "connection" ? <Waits waits={CONN} tone="bg-amber-500/40" /> : null}
        {k.how === "terminal" ? <div className="text-xs text-muted-foreground">No wait. The turn loop decides what to do next: compact and retry once (context window), or stop.</div> : null}
        {k.how === "advice" ? <div className="text-xs text-muted-foreground">No local backoff: the wait comes from the server&apos;s advice, and exhausting retries stores that advice for reuse.</div> : null}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Defaults: 5 stream retries, 4 request retries, a 300-second idle timeout and a cap of 100 retries. <Src>model-provider-info/src/lib.rs:72-79</Src> · <Src>protocol/src/error.rs:426-478</Src></p>
    </Panel>
  )
}
