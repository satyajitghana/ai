"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"
import { Range } from "@/components/articles/ui/range"

// A per-task cost and time model for one computer-use agent, run twice with only the
// driver swapped. The model is the arithmetic in the article, not a measurement:
//
//   every model call reads the whole context so far (cached, 0.1x input price),
//   writes O output tokens, waits L seconds for the model and then the driver's own
//   time, and appends the tool result it gets back (a cache write, 1.25x input).
//
// arc-driver: observe once, then one call per step: act with settle:true returns the
// settled snapshot in the same result, so the look and the act are one round trip.
// cua-driver: observe once, then per step a click (whose result carries no window
// state) and, on a fraction of steps, a get_window_state that returns the tree and a
// screenshot by default.
//
// Seeds (the article labels each): arc observation 1,300 tokens (4,604 bytes of
// element JSON / 3.5); cua tree 900 tokens (3,186 bytes of markdown / 3.5) plus a
// 700x892 window image at w*h/750 = 832 tokens; an action result 150 tokens; driver
// time per step 0.22 s (arc click with settle) vs 1.11 s click + 0.14 s observe
// (cua-driver, BENCHMARKS.md). All arithmetic is + - * / and Math.round, which are
// exact, so server and client render the same digits.

const ARC_OBS = 1300
const ARC_ACT_EXTRA = 60
const CUA_TREE = 900
const CUA_IMG = 832
const CUA_ACT = 150
const ARC_STEP_S = 0.22
const CUA_CLICK_S = 1.11
const CUA_OBS_S = 0.14
const CACHE_READ = 0.1
const CACHE_WRITE = 1.25

const ARC = "oklch(0.72 0.17 160)"
const CUA = "oklch(0.68 0.17 300)"

const PRICES = [
  { id: "sonnet", label: "Sonnet 5.5 · $2 / $10", pin: 2, pout: 10 },
  { id: "opus", label: "Opus 5.5 · $4 / $20", pin: 4, pout: 20 },
] as const

type Call = { res: number; drv: number }

function simulate(calls: Call[], prefix: number, out: number, lat: number, pin: number, pout: number) {
  let ctx = prefix
  let cost = 0
  let time = 0
  let model = 0
  let driver = 0
  for (const c of calls) {
    cost += (ctx * pin * CACHE_READ) / 1e6 + (out * pout) / 1e6
    time += lat + c.drv
    model += lat
    driver += c.drv
    ctx += out
    cost += (c.res * pin * CACHE_WRITE) / 1e6
    ctx += c.res
  }
  return { cost, time, model, driver, calls: calls.length, ctx }
}

function arcCalls(n: number): Call[] {
  const calls: Call[] = [{ res: ARC_OBS, drv: 0.01 }]
  for (let i = 0; i < n; i++) calls.push({ res: ARC_OBS + ARC_ACT_EXTRA, drv: ARC_STEP_S })
  return calls
}

function cuaCalls(n: number, everyPct: number, shot: boolean): Call[] {
  const obs = CUA_TREE + (shot ? CUA_IMG : 0)
  const calls: Call[] = [{ res: obs, drv: 0.06 }]
  let acc = 0
  for (let i = 0; i < n; i++) {
    calls.push({ res: CUA_ACT, drv: CUA_CLICK_S })
    acc += everyPct
    while (acc >= 100) {
      acc -= 100
      calls.push({ res: obs, drv: CUA_OBS_S })
    }
  }
  return calls
}

const fmt$ = (v: number) => `$${v.toFixed(3)}`
const fmtS = (v: number) => `${v.toFixed(1)} s`

export function DriverCost() {
  const [steps, setSteps] = useState(10)
  const [lat, setLat] = useState(30) // tenths of a second
  const [prefixK, setPrefixK] = useState(15)
  const [every, setEvery] = useState(100)
  const [shot, setShot] = useState(true)
  const [price, setPrice] = useState<(typeof PRICES)[number]["id"]>("sonnet")

  const p = PRICES.find((x) => x.id === price) ?? PRICES[0]
  const L = lat / 10
  const prefix = prefixK * 1000
  const out = 150

  const a = simulate(arcCalls(steps), prefix, out, L, p.pin, p.pout)
  const c = simulate(cuaCalls(steps, every, shot), prefix, out, L, p.pin, p.pout)

  const maxT = Math.max(a.time, c.time)
  const maxC = Math.max(a.cost, c.cost)
  const speed = c.time / a.time
  const saving = 1 - a.cost / c.cost

  const rows = [
    { name: "arc-driver", color: ARC, r: a, note: "act + settle returns the fresh snapshot" },
    { name: "cua-driver", color: CUA, r: c, note: `click, then look on ${every}% of steps${shot ? ", tree + screenshot" : ", tree only"}` },
  ]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs">
        <span className="text-muted-foreground">one task · same model, same prompt · only the driver swapped</span>
        <div className="flex gap-1">
          {PRICES.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => setPrice(o.id)}
              aria-pressed={price === o.id}
              className={cn(
                "cursor-pointer rounded px-2 py-1 font-mono text-xs transition-colors",
                price === o.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 p-3 sm:grid-cols-2 sm:p-4">
        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>actions per task</span>
            <span className="tabular-nums text-foreground">{steps}</span>
          </div>
          <Range min={3} max={30} step={1} value={steps} onChange={(e) => setSteps(Number(e.target.value))} className="w-full cursor-pointer" aria-label="actions per task" />
        </label>
        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>model time per turn</span>
            <span className="tabular-nums text-foreground">{L.toFixed(1)} s</span>
          </div>
          <Range min={5} max={100} step={5} value={lat} onChange={(e) => setLat(Number(e.target.value))} className="w-full cursor-pointer" aria-label="model time per turn in tenths of a second" />
        </label>
        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>cached prefix (system prompt + tools)</span>
            <span className="tabular-nums text-foreground">{prefixK}k tokens</span>
          </div>
          <Range min={5} max={40} step={1} value={prefixK} onChange={(e) => setPrefixK(Number(e.target.value))} className="w-full cursor-pointer" aria-label="cached prefix in thousands of tokens" />
        </label>
        <label className="block">
          <div className="mb-1 flex justify-between font-mono text-[11px] text-muted-foreground">
            <span>cua-driver: steps followed by a fresh look</span>
            <span className="tabular-nums text-foreground">{every}%</span>
          </div>
          <Range min={0} max={100} step={25} value={every} onChange={(e) => setEvery(Number(e.target.value))} className="w-full cursor-pointer" aria-label="share of cua-driver steps followed by get_window_state" accent={CUA} />
        </label>
        <div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground sm:col-span-2">
          <span>cua-driver observation:</span>
          {[
            { v: true, label: "tree + screenshot (default)" },
            { v: false, label: "include_screenshot: false" },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              onClick={() => setShot(o.v)}
              aria-pressed={shot === o.v}
              className={cn(
                "cursor-pointer rounded px-2 py-1 font-mono text-[11px] transition-colors",
                shot === o.v ? "bg-foreground text-background" : "border text-muted-foreground hover:text-foreground"
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-4 border-t p-3 sm:p-4">
        {rows.map((row) => (
          <div key={row.name}>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-3 font-mono text-xs">
              <span style={{ color: row.color }} className="font-semibold">{row.name}</span>
              <span className="text-[11px] text-muted-foreground">{row.note}</span>
            </div>
            <div className="grid grid-cols-[4.5rem_1fr_5rem] items-center gap-2 font-mono text-[11px]">
              <span className="text-muted-foreground">time</span>
              <div className="flex h-4 overflow-hidden rounded bg-muted/40">
                <div style={{ width: `${(row.r.model / maxT) * 100}%`, background: row.color, opacity: 0.85 }} className="transition-all duration-300" title="model time" />
                <div style={{ width: `${(row.r.driver / maxT) * 100}%`, background: row.color, opacity: 0.35 }} className="transition-all duration-300" title="driver time" />
              </div>
              <span className="text-right tabular-nums">{fmtS(row.r.time)}</span>

              <span className="text-muted-foreground">cost</span>
              <div className="h-4 overflow-hidden rounded bg-muted/40">
                <div style={{ width: `${(row.r.cost / maxC) * 100}%`, background: row.color, opacity: 0.85 }} className="h-full transition-all duration-300" />
              </div>
              <span className="text-right tabular-nums">{fmt$(row.r.cost)}</span>
            </div>
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              {row.r.calls} model calls · driver {fmtS(row.r.driver)} of {fmtS(row.r.time)} · context at the end{" "}
              {Math.round(row.r.ctx / 100) / 10}k tokens
            </div>
          </div>
        ))}

        <div className="flex flex-wrap gap-x-6 gap-y-1 rounded-lg border bg-muted/20 px-3 py-2 font-mono text-xs">
          <span>
            arc is <span className="tabular-nums text-foreground">{speed.toFixed(2)}×</span> faster
          </span>
          <span>
            {saving >= 0 ? (
              <>
                and <span className="tabular-nums text-foreground">{Math.round(saving * 100)}%</span> cheaper
              </>
            ) : (
              <>
                and <span className="tabular-nums text-foreground">{Math.round(-saving * 100)}%</span> dearer
              </>
            )}
          </span>
          <span className="text-muted-foreground">reported in the post: about 1.7× and about 30%</span>
        </div>

        <p className="text-sm leading-6 text-muted-foreground">
          Bright segments are model time, faint ones driver time. With a few seconds per model
          turn, the driver&rsquo;s own second per click matters less than the number of turns: a
          driver whose action result already contains the next observation saves a whole model
          call per step. Set the fresh-look share to zero and cua-driver gets cheaper than arc,
          because it is acting blind.
        </p>
      </div>
    </figure>
  )
}
