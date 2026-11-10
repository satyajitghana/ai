"use client"

import { useMemo, useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// One agent session, priced from the published list, with a pause in the
// middle. Two clocks run during the pause: the thread's (it expires 5 minutes
// after its last request) and the prompt cache's (5 minutes or 1 hour,
// refreshed on every read). The thread decides how many bytes the next request
// uploads; the cache decides what its tokens cost. The bill below never looks
// at the thread, because the docs say threads do not change pricing.
//
// Prices: platform.claude.com/docs/en/build-with-claude/prompt-caching, the
// Pricing table, $ per million tokens: base input, 5m write, 1h write, read.

type ModelKey = "opus55" | "sonnet55" | "fable52" | "haiku45"
const MODELS: Record<ModelKey, { label: string; base: number; w5: number; w1: number; read: number }> = {
  opus55: { label: "Claude Opus 5.5", base: 4, w5: 5, w1: 8, read: 0.2 },
  sonnet55: { label: "Claude Sonnet 5.5", base: 2, w5: 2.5, w1: 4, read: 0.1 },
  fable52: { label: "Claude Fable 5.2", base: 8, w5: 10, w1: 16, read: 0.2 },
  haiku45: { label: "Claude Haiku 4.5", base: 1, w5: 1.25, w1: 2, read: 0.1 },
}

const START = 10_000
const THREAD_TTL = 5
const THREAD_DELETE = 60

function bill(m: ModelKey, turns: number, end: number, gapAt: number, gap: number, ttl: 5 | 60) {
  const p = MODELS[m]
  const w = ttl === 5 ? p.w5 : p.w1
  let noCache = 0
  let cached = 0
  let prev = 0
  for (let i = 0; i < turns; i++) {
    const c = START + ((end - START) * i) / (turns - 1)
    noCache += (c * p.base) / 1e6
    const cold = i === 0 || (i === gapAt && gap > ttl)
    cached += cold ? (c * w) / 1e6 : (prev * p.read + (c - prev) * w) / 1e6
    prev = c
  }
  return { noCache, cached }
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-md border px-2 py-1 font-mono text-[11px] transition-colors",
        on ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  )
}

function State({ tone, title, children }: { tone: "ok" | "warn" | "bad"; title: string; children: ReactNode }) {
  const color = tone === "ok" ? "oklch(0.66 0.13 150)" : tone === "warn" ? "oklch(0.74 0.14 75)" : "oklch(0.63 0.18 28)"
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <div className="flex items-center gap-2 font-mono text-[11px]">
        <span className="inline-block size-2.5 rounded-full" style={{ background: color }} />
        {title}
      </div>
      <div className="mt-1 text-[13px] leading-snug">{children}</div>
    </div>
  )
}

const usd = (x: number) => `$${x.toFixed(2)}`

export function ThreadClock() {
  const [model, setModel] = useState<ModelKey>("opus55")
  const [turns, setTurns] = useState(120)
  const [end, setEnd] = useState(200_000)
  const [gap, setGap] = useState(0)
  const [ttl, setTtl] = useState<5 | 60>(5)
  const gapAt = turns >> 1

  const r = useMemo(() => bill(model, turns, end, gapAt, gap, ttl), [model, turns, end, gapAt, gap, ttl])
  const base = useMemo(() => bill(model, turns, end, gapAt, 0, 5), [model, turns, end, gapAt])
  const ctxAtGap = Math.round(START + ((end - START) * gapAt) / (turns - 1))

  const threadState =
    gap <= THREAD_TTL ? "alive" : gap <= THREAD_DELETE ? "expired" : "deleted"
  const cacheWarm = gap <= ttl

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">two clocks: the thread and the cache · reasoned from the docs</span>
        <select
          value={model}
          onChange={(e) => setModel(e.target.value as ModelKey)}
          className="rounded-md border bg-background px-2 py-1 font-mono text-[11px]"
          aria-label="Model"
        >
          {(Object.keys(MODELS) as ModelKey[]).map((k) => (
            <option key={k} value={k}>
              {MODELS[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block space-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">requests in the session: {turns}</span>
            <Range min={20} max={300} step={10} value={turns} onChange={(e) => setTurns(Number(e.target.value))} aria-label="Requests" />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">context at the end: {(end / 1000).toFixed(0)}K tokens</span>
            <Range min={50_000} max={1_000_000} step={10_000} value={end} onChange={(e) => setEnd(Number(e.target.value))} aria-label="Final context" />
          </label>
          <label className="block space-y-1">
            <span className="font-mono text-[11px] text-muted-foreground">
              pause before request {gapAt + 1}: {gap} min
            </span>
            <Range min={0} max={90} value={gap} onChange={(e) => setGap(Number(e.target.value))} aria-label="Pause in minutes" />
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[11px] text-muted-foreground">cache_control ttl:</span>
          <Chip on={ttl === 5} onClick={() => setTtl(5)}>
            5m (write 1.25x)
          </Chip>
          <Chip on={ttl === 60} onClick={() => setTtl(60)}>
            1h (write 2x)
          </Chip>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <State
            tone={threadState === "alive" ? "ok" : "warn"}
            title={threadState === "alive" ? "thread: still there" : threadState === "expired" ? "thread: expired" : "thread: expired, and past the 1 h deletion bound"}
          >
            {threadState === "alive"
              ? `Request ${gapAt + 1} is a continue: only the new messages and previous_message_id.`
              : `The continue gets 404 thread_not_found. Your client replays all ${ctxAtGap.toLocaleString("en-US")} tokens of conversation in a new create request, with system and tools, then continues from the new id.`}
          </State>
          <State tone={cacheWarm ? "ok" : "bad"} title={cacheWarm ? "cache: warm" : "cache: cold"}>
            {cacheWarm
              ? `The ${ctxAtGap.toLocaleString("en-US")}-token prefix is a cache read at ${usd(MODELS[model].read)} per million.`
              : `The whole ${ctxAtGap.toLocaleString("en-US")}-token prefix is written again at ${usd(ttl === 5 ? MODELS[model].w5 : MODELS[model].w1)} per million.`}
          </State>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] font-mono text-[12px]">
            <thead>
              <tr className="text-left text-[11px] text-muted-foreground">
                <th className="py-1 pr-3 font-normal">input bill for the session</th>
                <th className="py-1 pr-3 font-normal">without thread</th>
                <th className="py-1 font-normal">with thread</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t">
                <td className="py-1.5 pr-3">no cache_control</td>
                <td className="py-1.5 pr-3 tabular-nums">{usd(r.noCache)}</td>
                <td className="py-1.5 tabular-nums">{usd(r.noCache)}</td>
              </tr>
              <tr className="border-t">
                <td className="py-1.5 pr-3">top-level cache_control, {ttl === 5 ? "5m" : "1h"}</td>
                <td className="py-1.5 pr-3 tabular-nums">{usd(r.cached)}</td>
                <td className="py-1.5 tabular-nums">{usd(r.cached)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          The two columns are equal by construction: threads change what you upload, not what you are billed.
          {r.cached > base.cached + 0.005 ? ` The pause adds ${usd(r.cached - base.cached)} to the cached session.` : ""}
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Reasoned from published prices, not measured. Context grows linearly from 10K tokens; each request reads the
        previous prefix from cache and writes the new part. Output tokens are left out (the same in every cell). The
        thread clock is the docs&apos; 5 minutes after the last request; the deletion bound is 1 hour.
      </figcaption>
    </figure>
  )
}
