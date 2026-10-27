"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The three channel classes the cpu-chat post names, as a defender sees them. This is a conceptual map and it is
// REASONED from how shared CPU resources work, plus what the post REPORTS. It contains no procedure: no sizes,
// thresholds, addresses or code that would set up a channel. "What a defender sees" is the useful half.

const CLASSES = [
  {
    id: "cpu",
    name: "CPU contention",
    shared: "Execution time on cores and the host scheduler's run queue",
    send: "Sender runs or idles; the share of CPU time left for others goes down or up",
    recv: "Receiver watches how much work it gets done per interval",
    sees: "Run-queue length, steal time, context switches, a periodic on/off pattern in CPU use that matches no workload",
    note: "Cheapest to build and the slowest. My toy is this class, inside one process.",
    tag: "reasoned",
  },
  {
    id: "cache",
    name: "Cache eviction timing",
    shared: "A cache level that more than one tenant's cores share, usually the last-level cache",
    send: "Sender touches memory so that some of the receiver's cached lines are pushed out, or leaves them alone",
    recv: "Receiver times its own memory accesses: a slow access means the line was evicted",
    sees: "Last-level-cache miss counts and miss rates per core or per VM that do not follow the workload",
    note: "The class OpenAI is reported to have seen. Same physics as a cache side channel, different goal: both ends cooperate.",
    tag: "reported",
  },
  {
    id: "dram",
    name: "DRAM bandwidth contention",
    shared: "The memory controller and the channels to DRAM",
    send: "Sender streams memory hard or stays quiet",
    recv: "Receiver measures how fast its own memory traffic completes",
    sees: "Memory bandwidth counters per core or per VM, and uncore events at the controller",
    note: "Reaches across sockets of cores that share no cache, but only as far as they share a memory controller.",
    tag: "reasoned",
  },
] as const

export function ChannelClasses() {
  const [id, setId] = useState<(typeof CLASSES)[number]["id"]>("cache")
  const c = CLASSES.find((x) => x.id === id)!
  const rows: [string, string][] = [
    ["what is shared", c.shared],
    ["what the sender varies", c.send],
    ["what the receiver measures", c.recv],
    ["what a defender sees", c.sees],
  ]
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        three channel classes · conceptual map for defenders, no procedure
      </div>
      <div className="flex flex-wrap gap-1.5 border-b px-4 py-2.5" role="tablist">
        {CLASSES.map((x) => (
          <button
            key={x.id}
            type="button"
            role="tab"
            aria-selected={x.id === id}
            onClick={() => setId(x.id)}
            className={cn(
              "rounded border px-2.5 py-1 font-mono text-[11px] transition-colors",
              x.id === id ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
            )}
          >
            {x.name}
          </button>
        ))}
      </div>
      <dl className="divide-y text-sm">
        {rows.map(([k, v]) => (
          <div key={k} className={cn("grid gap-1 px-4 py-2.5 md:grid-cols-[11rem_1fr]", k === "what a defender sees" && "bg-muted/40")}>
            <dt className="font-mono text-[11px] text-muted-foreground">{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        <span className="mr-2 rounded border px-1.5 py-0.5 font-mono text-[10px]">{c.tag}</span>
        {c.note}
      </div>
    </figure>
  )
}
