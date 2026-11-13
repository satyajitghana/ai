"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { tablistKeys } from "@/components/articles/ui/tablist-keys"
import { cn } from "@/lib/utils"

// A month of one-shot page jobs, priced three ways from Cloudflare's published price lists (read
// 13 November 2026) and the median per-page cost from kitesurf.dev/benchmarks (same day):
//   Browser Run, Chromium: browser hours = pages x wall time; 10 h a month included, then $0.09/h.
//     The monthly total is rounded to the nearest hour (pricing FAQ).
//   Browser Run, Kitesurf: free in beta. The second line asks what it would cost on today's unit.
//   Self-hosted Kitesurf: Workers Paid CPU (30M ms included, then $0.02 per million ms) and Dynamic
//     Workers (1,000 a month included, then $0.002 each). The engine calls LOADER.load() for every
//     page and for the renderer, and the pricing page counts each load() as a new Dynamic Worker.
//     The counts used (2 for a screenshot, 1 for HTML) are the floor read from the code: an iframe,
//     a web worker or an about:blank isolate started before navigating each add one.
// Requests and the $5 Workers Paid subscription are left out of every line. Pure arithmetic.

type Task = "shot" | "html"

const PER_PAGE: Record<Task, { ksWall: number; ksCpu: number; brWall: number; loads: number }> = {
  shot: { ksWall: 1.2, ksCpu: 361, brWall: 0.82, loads: 2 },
  html: { ksWall: 0.85, ksCpu: 239, brWall: 0.709, loads: 1 },
}

const STOPS = [100, 300, 1000, 3000, 10000, 30000, 100000]
const DAYS = 30

const usd = (v: number) =>
  v < 0.005 ? "$0.00" : v < 100 ? `$${v.toFixed(2)}` : `$${Math.round(v).toLocaleString("en-US")}`
const int = (v: number) => Math.round(v).toLocaleString("en-US")

export function CostCalc() {
  const [task, setTask] = useState<Task>("shot")
  const [stop, setStop] = useState(4)
  const perDay = STOPS[stop]
  const pages = perDay * DAYS
  const p = PER_PAGE[task]

  const brHours = Math.round((pages * p.brWall) / 3600)
  const brCost = Math.max(0, brHours - 10) * 0.09

  const ksHours = Math.round((pages * p.ksWall) / 3600)
  const ksIfBilled = Math.max(0, ksHours - 10) * 0.09

  const loads = pages * p.loads
  const dwCost = Math.max(0, loads - 1000) * 0.002
  const cpuMs = pages * p.ksCpu
  const cpuCost = (Math.max(0, cpuMs - 30_000_000) / 1_000_000) * 0.02
  const selfCost = dwCost + cpuCost

  const rows = [
    {
      label: "Browser Run, Chromium",
      cost: brCost,
      how: `${int(brHours)} browser hours; 10 included, then $0.09 an hour`,
    },
    {
      label: "Browser Run, Kitesurf (beta)",
      cost: 0,
      how: `free while in beta, behind per-account limits. On the Chromium unit it would be ${int(ksHours)} hours, ${usd(ksIfBilled)}`,
    },
    {
      label: "Kitesurf on your own account",
      cost: selfCost,
      how: `${int(loads)} Dynamic Workers (${usd(dwCost)}) + ${int(cpuMs / 1000)} CPU-seconds (${usd(cpuCost)})`,
    },
  ]
  const max = Math.max(1, ...rows.map((r) => r.cost))

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">a month of one-shot page jobs, at list price</div>
      <div className="space-y-2 border-b px-4 py-3 text-xs">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Job" onKeyDown={tablistKeys()}>
          <span className="w-20 shrink-0 font-mono text-muted-foreground">job</span>
          {(["shot", "html"] as Task[]).map((t) => (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={task === t}
              tabIndex={task === t ? 0 : -1}
              onClick={() => setTask(t)}
              className={cn(
                "rounded border px-2 py-1 font-mono text-[11px]",
                task === t ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "shot" ? "screenshot" : "extract HTML"}
            </button>
          ))}
        </div>
        <label className="flex flex-wrap items-center gap-2">
          <span className="w-20 shrink-0 font-mono text-muted-foreground">pages / day</span>
          <Range
            min={0}
            max={STOPS.length - 1}
            step={1}
            value={stop}
            onChange={(e) => setStop(Number(e.target.value))}
            aria-label="Pages per day"
            className="min-w-[10rem] flex-1"
          />
          <span className="w-28 shrink-0 text-right font-mono tabular-nums">{int(perDay)}</span>
        </label>
        <div className="font-mono text-[11px] text-muted-foreground">
          {int(pages)} pages a month · per page: Chromium {p.brWall} s wall · Kitesurf {p.ksWall} s wall, {p.ksCpu} ms CPU,{" "}
          at least {p.loads} Dynamic Worker{p.loads > 1 ? "s" : ""}
        </div>
      </div>
      <ul className="space-y-2 px-4 py-3 text-xs">
        {rows.map((r) => (
          <li key={r.label}>
            <div className="flex items-baseline justify-between gap-2">
              <span>{r.label}</span>
              <span className="font-mono tabular-nums">{usd(r.cost)}</span>
            </div>
            <div className="mt-0.5 h-2.5 overflow-hidden rounded-sm bg-muted">
              <div className="h-full bg-foreground/70" style={{ width: `${((r.cost / max) * 100).toFixed(2)}%` }} />
            </div>
            <div className="mt-0.5 text-[11px] text-muted-foreground">{r.how}</div>
          </li>
        ))}
      </ul>
      <figcaption className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        My arithmetic on Cloudflare&apos;s price pages (Browser Run, Dynamic Workers, Workers) and its benchmark medians, as of
        13 November 2026. Requests and the $5 Workers Paid plan are left out. Nothing here was run against a bill.
      </figcaption>
    </figure>
  )
}
