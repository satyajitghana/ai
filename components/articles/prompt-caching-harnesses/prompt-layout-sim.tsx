"use client"

import { useMemo, useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

// A prefix-cache simulator for a 40-request coding-agent session.
//
// The request is a list of segments, each with an identity key and a token
// count. A cache entry is the key list of a prefix that some earlier request
// wrote. A request reads the longest live entry that is a prefix of its own
// key list; what it writes depends on the provider:
//   explicit (Anthropic): an entry at every breakpoint, charged as a write
//     for the tokens between the read and the last breakpoint
//   implicit (OpenAI GPT-5.6+): one entry at the end of the latest message,
//     charged as a write
//   interval (OpenAI GPT-5.5): entries every 2,048 tokens, reads rounded down
//     to that interval, no write charge
//   deepseek: an entry at the end of the input and one at the end of the
//     output, no write charge
// Prices are the published per-million-token rates the article cites.
// Same logic as the article's cost model, so the defaults reproduce its numbers.

type ProviderKey = "sonnet46" | "sonnet55" | "gpt55" | "gpt56t" | "dsv4pro"
type Mode = "explicit" | "implicit" | "interval" | "deepseek"

type Provider = {
  label: string
  base: number
  write: number | null
  read: number
  out: number
  mode: Mode
  ttl: number // minutes, for the idle-pause toggle
  ttlNote: string
}

const PROVIDERS: Record<ProviderKey, Provider> = {
  sonnet46: { label: "Claude Sonnet 4.6", base: 3, write: 3.75, read: 0.3, out: 15, mode: "explicit", ttl: 5, ttlNote: "5 min default TTL" },
  sonnet55: { label: "Claude Sonnet 5.5", base: 2, write: 2.5, read: 0.1, out: 10, mode: "explicit", ttl: 5, ttlNote: "5 min default TTL" },
  gpt55: { label: "OpenAI gpt-5.5", base: 5, write: null, read: 0.5, out: 30, mode: "interval", ttl: 30, ttlNote: "about 30 min, up to 24 h" },
  gpt56t: { label: "OpenAI gpt-5.6-terra", base: 2, write: 2.5, read: 0.2, out: 12, mode: "implicit", ttl: 30, ttlNote: "at least 30 min" },
  dsv4pro: { label: "DeepSeek V4 Pro (peak)", base: 1.32, write: null, read: 0.044, out: 3.96, mode: "deepseek", ttl: 600, ttlNote: "hours to days" },
}

type Movable = "system" | "date" | "memory"
type Strategy = "tail" | "tiered" | "none"
type DateChange = "never" | "midnight" | "every"

const TURNS = 40
const IN = 1500
const OUT = 500
const TOKENS: Record<"tools" | Movable, number> = { tools: 11000, system: 5980, date: 20, memory: 3000 }
const NAMES: Record<"tools" | Movable, string> = {
  tools: "tool definitions",
  system: "system prompt",
  date: "date line",
  memory: "project memory",
}

type Config = {
  provider: ProviderKey
  strategy: Strategy
  order: Movable[]
  dateInTurn: boolean
  dateChange: DateChange
  mcp: boolean
  memEvery: number
  idle: boolean
  compact: boolean
}

type Seg = { key: string; tokens: number; label: string }
type Turn = { n: number; segs: Seg[]; total: number; read: number; write: number; miss: number; cost: number; base: number }

function build(n: number, c: Config): { segs: Seg[]; nStatic: number } {
  const segs: Seg[] = []
  let toolTokens = TOKENS.tools
  let toolVer = 0
  if (c.mcp && n >= 15) {
    toolVer = 1
    toolTokens += 2000
  }
  segs.push({ key: `tools:${toolVer}`, tokens: toolTokens, label: NAMES.tools })
  for (const name of c.order) {
    if (name === "date" && c.dateInTurn) continue
    let v = 0
    if (name === "date") v = c.dateChange === "every" ? n : c.dateChange === "midnight" && n >= 21 ? 1 : 0
    if (name === "memory" && c.memEvery > 0) v = Math.floor((n - 1) / c.memEvery)
    segs.push({ key: `${name}:${v}`, tokens: TOKENS[name], label: NAMES[name] })
  }
  const nStatic = segs.length
  let start = 1
  if (c.compact && n > 30) {
    segs.push({ key: "summary", tokens: 4000, label: "compaction summary" })
    start = 30
  }
  for (let k = start; k < n; k++) {
    segs.push({ key: `in${k}`, tokens: IN, label: `turn ${k} input` })
    segs.push({ key: `out${k}`, tokens: OUT, label: `turn ${k} reply` })
  }
  segs.push({ key: `in${n}`, tokens: IN + (c.dateInTurn ? TOKENS.date : 0), label: `turn ${n} input` })
  return { segs, nStatic }
}

function simulate(c: Config) {
  const p = PROVIDERS[c.provider]
  const entries = new Map<string, { len: number; t: number }>()
  const turns: Turn[] = []
  let t = 0
  for (let n = 1; n <= TURNS; n++) {
    t += 1
    if (c.idle && n === 25) t += 10
    const { segs, nStatic } = build(n, c)
    const keys = segs.map((s) => s.key)
    const cum = [0]
    for (const s of segs) cum.push(cum[cum.length - 1] + s.tokens)
    const total = cum[cum.length - 1]

    for (const [k, e] of entries) if (t - e.t > p.ttl) entries.delete(k)

    let best = 0
    let bestLen = 0
    for (let L = keys.length; L >= 1; L--) {
      const e = entries.get(keys.slice(0, L).join("|"))
      if (e) {
        best = cum[L]
        bestLen = L
        break
      }
    }
    if (bestLen > 0) entries.set(keys.slice(0, bestLen).join("|"), { len: bestLen, t })
    if (p.mode === "interval") best = Math.floor(best / 2048) * 2048

    let bps: number[] = [keys.length]
    if (p.mode === "explicit") {
      bps = c.strategy === "none" ? [] : c.strategy === "tail" ? [keys.length] : [1, nStatic, keys.length]
    }
    for (const b of bps) entries.set(keys.slice(0, b).join("|"), { len: b, t })
    if (p.mode === "deepseek") entries.set([...keys, `out${n}`].join("|"), { len: keys.length + 1, t })

    const lastBp = bps.length > 0 ? cum[Math.max(...bps)] : 0
    let write = 0
    let miss = 0
    let cost = 0
    if (p.write !== null) {
      write = Math.max(0, lastBp - best)
      miss = total - best - write
      cost = (best * p.read + write * p.write + miss * p.base) / 1e6
    } else {
      miss = total - best
      cost = (best * p.read + miss * p.base) / 1e6
    }
    turns.push({ n, segs, total, read: best, write, miss, cost, base: (total * p.base) / 1e6 })
  }
  const sum = (f: (x: Turn) => number) => turns.reduce((a, x) => a + f(x), 0)
  return {
    turns,
    cost: sum((x) => x.cost),
    noCache: sum((x) => x.base),
    read: sum((x) => x.read),
    write: sum((x) => x.write),
    miss: sum((x) => x.miss),
    output: (TURNS * OUT * p.out) / 1e6,
  }
}

function statusOf(tr: Turn) {
  const out: (Seg & { hit: number; wr: number; ms: number })[] = []
  let from = 0
  for (const s of tr.segs) {
    const hit = Math.max(0, Math.min(s.tokens, tr.read - from))
    const wr = Math.max(0, Math.min(s.tokens - hit, tr.read + tr.write - from - hit))
    out.push({ ...s, hit, wr, ms: s.tokens - hit - wr })
    from += s.tokens
  }
  return out
}

const C_READ = "oklch(0.68 0.13 150)"
const C_WRITE = "oklch(0.75 0.14 75)"
const C_MISS = "oklch(0.62 0.18 25)"

const fmt = (x: number) => x.toLocaleString("en-US")
const usd = (x: number) => `$${x.toFixed(3)}`

const DEFAULT: Config = {
  provider: "sonnet46",
  strategy: "tail",
  order: ["system", "date", "memory"],
  dateInTurn: false,
  dateChange: "midnight",
  mcp: false,
  memEvery: 0,
  idle: false,
  compact: false,
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-md border px-2 py-1 text-left font-mono text-[11px] transition-colors",
        on ? "border-foreground/40 bg-foreground/10 text-foreground" : "text-muted-foreground hover:bg-muted/40",
      )}
    >
      {children}
    </button>
  )
}

export function PromptLayoutSim() {
  const [c, setC] = useState<Config>(DEFAULT)
  const [inspect, setInspect] = useState(21)
  const r = useMemo(() => simulate(c), [c])
  const p = PROVIDERS[c.provider]
  const set = (patch: Partial<Config>) => setC((prev) => ({ ...prev, ...patch }))

  const move = (i: number, d: -1 | 1) => {
    const j = i + d
    if (j < 0 || j >= c.order.length) return
    const next = [...c.order]
    const tmp = next[i]
    next[i] = next[j]
    next[j] = tmp
    set({ order: next })
  }

  const maxTotal = Math.max(...r.turns.map((x) => x.total))
  const W = 640
  const H = 150
  const colW = W / TURNS
  const tr = r.turns[inspect - 1]

  // Per-segment status for the inspected request: tokens before the read
  // boundary are hits; then writes up to the last breakpoint; then misses.
  const segStatus = statusOf(tr)
  const staticSegs = segStatus.filter((s) => !s.key.startsWith("in") && !s.key.startsWith("out"))
  const histSegs = segStatus.filter((s) => s.key.startsWith("in") || s.key.startsWith("out"))
  const histRead = histSegs.reduce((a, s) => a + s.hit, 0)
  const histTotal = histSegs.reduce((a, s) => a + s.tokens, 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">prompt-layout simulator · 40 requests</span>
        <select
          value={c.provider}
          onChange={(e) => set({ provider: e.target.value as ProviderKey })}
          className="rounded-md border bg-background px-2 py-1 font-mono text-[11px]"
          aria-label="Provider and model"
        >
          {(Object.keys(PROVIDERS) as ProviderKey[]).map((k) => (
            <option key={k} value={k}>
              {PROVIDERS[k].label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">request layout, top to bottom</div>
            <div className="mt-2 space-y-1">
              <div className="flex items-center justify-between rounded-sm bg-muted px-2 py-1 font-mono text-[11px]">
                <span>tool definitions</span>
                <span className="text-muted-foreground">{fmt(TOKENS.tools)}</span>
              </div>
              {c.order.map((name, i) => {
                const hidden = name === "date" && c.dateInTurn
                return (
                  <div
                    key={name}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-sm bg-muted px-2 py-1 font-mono text-[11px]",
                      hidden && "opacity-40",
                    )}
                  >
                    <span>
                      {NAMES[name]}
                      {hidden ? " (moved to latest message)" : ""}
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="text-muted-foreground">{fmt(TOKENS[name])}</span>
                      <button
                        type="button"
                        className="rounded border px-1 leading-none disabled:opacity-30"
                        onClick={() => move(i, -1)}
                        disabled={i === 0}
                        aria-label={`Move ${NAMES[name]} up`}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className="rounded border px-1 leading-none disabled:opacity-30"
                        onClick={() => move(i, 1)}
                        disabled={i === c.order.length - 1}
                        aria-label={`Move ${NAMES[name]} down`}
                      >
                        ↓
                      </button>
                    </span>
                  </div>
                )
              })}
              <div className="rounded-sm border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">
                history: {fmt(IN)} in + {fmt(OUT)} out per turn
              </div>
              <div className="rounded-sm border border-dashed px-2 py-1 font-mono text-[11px] text-muted-foreground">
                new turn: {fmt(IN)}
              </div>
            </div>
          </div>

          <div className="space-y-2 rounded-lg border bg-muted/20 px-3 py-2.5">
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">breakpoints</div>
            {p.mode === "explicit" ? (
              <div className="flex flex-wrap gap-1.5">
                <Toggle on={c.strategy === "tail"} onClick={() => set({ strategy: "tail" })}>
                  last message only
                </Toggle>
                <Toggle on={c.strategy === "tiered"} onClick={() => set({ strategy: "tiered" })}>
                  tools + static + last
                </Toggle>
                <Toggle on={c.strategy === "none"} onClick={() => set({ strategy: "none" })}>
                  none
                </Toggle>
              </div>
            ) : (
              <div className="font-mono text-[11px] text-muted-foreground">
                {p.mode === "deepseek"
                  ? "automatic: an entry at the end of every input and every output"
                  : p.mode === "interval"
                    ? "automatic: 2,048-token intervals, no write charge"
                    : "automatic: end of the latest message, writes at 1.25x"}
              </div>
            )}
            <div className="font-mono text-[10px] tracking-wide text-muted-foreground">what changes mid-session</div>
            <div className="flex flex-wrap gap-1.5">
              <Toggle on={c.dateChange === "midnight"} onClick={() => set({ dateChange: c.dateChange === "midnight" ? "never" : "midnight" })}>
                date flips at turn 21
              </Toggle>
              <Toggle on={c.dateChange === "every"} onClick={() => set({ dateChange: c.dateChange === "every" ? "never" : "every" })}>
                timestamp every request
              </Toggle>
              <Toggle on={c.dateInTurn} onClick={() => set({ dateInTurn: !c.dateInTurn })}>
                date in latest message
              </Toggle>
              <Toggle on={c.mcp} onClick={() => set({ mcp: !c.mcp })}>
                MCP server joins at turn 15
              </Toggle>
              <Toggle on={c.memEvery > 0} onClick={() => set({ memEvery: c.memEvery > 0 ? 0 : 10 })}>
                memory rewritten every 10
              </Toggle>
              <Toggle on={c.idle} onClick={() => set({ idle: !c.idle })}>
                10 min pause before 25
              </Toggle>
              <Toggle on={c.compact} onClick={() => set({ compact: !c.compact })}>
                compaction at turn 30
              </Toggle>
            </div>
            <div className="font-mono text-[10px] text-muted-foreground">
              cache lifetime: {p.ttlNote}; one request a minute otherwise
            </div>
          </div>
        </div>

        <div>
          <svg viewBox={`0 0 ${W} ${H + 16}`} className="w-full" role="img" aria-label="Input tokens per request, split into cache reads, cache writes and uncached input">
            {r.turns.map((x, i) => {
              const h = (x.total / maxTotal) * H
              const hr = (x.read / maxTotal) * H
              const hw = (x.write / maxTotal) * H
              const hm = h - hr - hw
              const xx = i * colW + 1
              const w = colW - 2
              return (
                <g key={x.n} onClick={() => setInspect(x.n)} className="cursor-pointer">
                  <rect x={xx} y={H - hr} width={w} height={hr} fill={C_READ} />
                  <rect x={xx} y={H - hr - hw} width={w} height={hw} fill={C_WRITE} />
                  <rect x={xx} y={H - h} width={w} height={hm} fill={C_MISS} />
                  {x.n === inspect ? (
                    <rect x={xx - 1} y={H - h - 2} width={w + 2} height={h + 2} fill="none" stroke="currentColor" strokeWidth={1.5} />
                  ) : null}
                </g>
              )
            })}
            <text x={0} y={H + 13} className="fill-muted-foreground font-mono" fontSize={10}>
              request 1
            </text>
            <text x={W} y={H + 13} textAnchor="end" className="fill-muted-foreground font-mono" fontSize={10}>
              request 40
            </text>
          </svg>
          <div className="mt-1 flex flex-wrap gap-3 font-mono text-[10px] text-muted-foreground">
            <span>
              <span className="mr-1 inline-block h-2 w-2" style={{ background: C_READ }} />
              cache read
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2" style={{ background: C_WRITE }} />
              cache write
            </span>
            <span>
              <span className="mr-1 inline-block h-2 w-2" style={{ background: C_MISS }} />
              uncached
            </span>
          </div>
        </div>

        <div className="rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center gap-3">
            <span className="shrink-0 font-mono text-[11px]">request {inspect}</span>
            <Range min={1} max={TURNS} step={1} value={inspect} onChange={(e) => setInspect(Number(e.target.value))} aria-label="Request to inspect" className="w-full" />
          </div>
          <div className="mt-2 space-y-1">
            {staticSegs.map((s) => (
              <div key={s.key} className="flex items-center justify-between rounded-sm px-2 py-0.5 font-mono text-[11px]" style={{ background: `color-mix(in oklch, var(--background), ${s.ms > 0 ? C_MISS : s.wr > 0 ? C_WRITE : C_READ} 22%)` }}>
                <span>{s.label}</span>
                <span>{s.ms > 0 ? "uncached" : s.wr > 0 ? "written" : "read"}</span>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-sm bg-muted px-2 py-0.5 font-mono text-[11px]">
              <span>history + new turn</span>
              <span>
                {fmt(histRead)} of {fmt(histTotal)} read
              </span>
            </div>
          </div>
          <div className="mt-2 font-mono text-[11px] text-muted-foreground">
            {fmt(tr.total)} in · {fmt(tr.read)} read · {fmt(tr.write)} written · {fmt(tr.miss)} uncached · {usd(tr.cost)}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["input, cached", usd(r.cost)],
            ["input, no cache", usd(r.noCache)],
            ["cached / uncached", `${((r.cost / r.noCache) * 100).toFixed(1)}%`],
            ["output (same either way)", usd(r.output)],
          ].map(([k, v]) => (
            <div key={k} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[10px] text-muted-foreground">{k}</div>
              <div className="font-mono text-sm">{v}</div>
            </div>
          ))}
        </div>
        <div className="font-mono text-[10px] text-muted-foreground">
          {fmt(r.read)} tokens read · {fmt(r.write)} written · {fmt(r.miss)} uncached, over {TURNS} requests
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        A reasoned model, not a measurement: a 20,000-token prefix, 1,500 tokens in and 500 out per turn, one
        request a minute, prices from each provider&apos;s pricing page. Reorder the blocks, change what moves, and watch
        where the reads stop.
      </figcaption>
    </figure>
  )
}
