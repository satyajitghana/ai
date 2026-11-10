"use client"

import { useMemo, useState, type ReactNode } from "react"

import { Range } from "@/components/articles/ui/range"
import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

import { codeExpiry, codeFull, codeThread, screensFull, screensThread } from "./measured"

// Bytes on the wire per request, with and without a message thread.
// Every number here was measured: the SDK built each request body and a local
// mock server counted it (see measured.ts for how). Nothing is modelled.

type Workload = "code" | "screens"

const C_FULL = "oklch(0.64 0.17 30)"
const C_THREAD = "oklch(0.62 0.13 200)"

const kb = (b: number) => (b >= 1e6 ? `${(b / 1e6).toFixed(2)} MB` : `${(b / 1e3).toFixed(1)} KB`)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
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

export function UploadMeter() {
  const [work, setWork] = useState<Workload>("code")
  const [expiry, setExpiry] = useState(false)
  const [log, setLog] = useState(true)
  const full = work === "code" ? codeFull : screensFull
  const thread = work === "code" ? (expiry ? codeExpiry : codeThread) : screensThread
  const n = full.length
  const [pick, setPick] = useState(60)
  const at = Math.min(pick, n)

  const W = 640
  const H = 170
  const top = Math.max(...full, ...thread)
  const lo = 300
  const y = useMemo(() => {
    const lmax = mlog10(top)
    const lmin = mlog10(lo)
    return (b: number) => {
      if (!log) return H - (b / top) * H
      const v = (mlog10(Math.max(b, lo)) - lmin) / (lmax - lmin)
      return H - v * H
    }
  }, [log, top])

  const path = (xs: number[]) =>
    xs.map((b, i) => `${i === 0 ? "M" : "L"}${((i / (xs.length - 1)) * W).toFixed(1)},${y(b).toFixed(1)}`).join(" ")

  // With the expiry on, the threaded run has one extra request (the 404), so
  // its index runs one ahead of the plain run after request 62.
  const tIdx = expiry && work === "code" && at >= 62 ? at : at - 1
  const fullTotal = sum(full)
  const threadTotal = sum(thread)
  const ticks = log ? [1e3, 1e4, 1e5, 1e6].filter((t) => t <= top * 1.2) : [top / 4, top / 2, (3 * top) / 4, top]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">bytes uploaded per request · measured</span>
        <div className="flex flex-wrap gap-1.5">
          <Chip on={work === "code"} onClick={() => setWork("code")}>
            coding loop · 120 requests
          </Chip>
          <Chip on={work === "screens"} onClick={() => setWork("screens")}>
            image loop · 60 requests
          </Chip>
        </div>
      </div>

      <div className="space-y-4 p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          <Chip on={log} onClick={() => setLog(!log)}>
            log scale
          </Chip>
          {work === "code" ? (
            <Chip on={expiry} onClick={() => setExpiry(!expiry)}>
              thread lost at request 62
            </Chip>
          ) : null}
        </div>

        <svg
          viewBox={`-44 -6 ${W + 50} ${H + 24}`}
          className="w-full"
          role="img"
          aria-label="Request body size per turn: without a thread it grows with the conversation; with a thread it stays near the size of the newest turn"
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={0} x2={W} y1={y(t)} y2={y(t)} stroke="currentColor" strokeOpacity={0.12} />
              <text x={-6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
                {kb(t)}
              </text>
            </g>
          ))}
          <path d={path(full)} fill="none" stroke={C_FULL} strokeWidth={2} />
          <path d={path(thread)} fill="none" stroke={C_THREAD} strokeWidth={2} />
          <line
            x1={((at - 1) / (n - 1)) * W}
            x2={((at - 1) / (n - 1)) * W}
            y1={0}
            y2={H}
            stroke="currentColor"
            strokeOpacity={0.45}
            strokeDasharray="3 3"
          />
          <text x={0} y={H + 15} fontSize={10} className="fill-muted-foreground font-mono">
            request 1
          </text>
          <text x={W} y={H + 15} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
            request {n}
          </text>
        </svg>

        <label className="block space-y-1">
          <span className="font-mono text-[11px] text-muted-foreground">inspect request {at}</span>
          <Range min={1} max={n} value={at} onChange={(e) => setPick(Number(e.target.value))} aria-label="Request to inspect" />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: C_FULL }} />
              whole history every time
            </div>
            <div className="mt-1 font-mono text-lg tabular-nums">{kb(full[at - 1])}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              session total {kb(fullTotal)} · median {kb(median(full))}
            </div>
          </div>
          <div className="rounded-lg border px-3 py-2.5">
            <div className="flex items-center gap-2 font-mono text-[11px]">
              <span className="inline-block size-2.5 rounded-sm" style={{ background: C_THREAD }} />
              thread: create once, then continue
            </div>
            <div className="mt-1 font-mono text-lg tabular-nums">{kb(thread[tIdx])}</div>
            <div className="font-mono text-[11px] text-muted-foreground">
              session total {kb(threadTotal)} · median {kb(median(thread))}
            </div>
          </div>
        </div>
        <p className="font-mono text-[11px] text-muted-foreground">
          {fullTotal > 0 ? `${(fullTotal / threadTotal).toFixed(0)}x fewer bytes over the session with a thread. ` : ""}
          The token count the model reads is the same in both columns.
        </p>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs text-muted-foreground">
        Measured, not modelled: the anthropic Python SDK 2.7.0 built every request and a local mock server counted
        the body. The coding loop&apos;s tool results are real files from this site&apos;s repo; the image loop returns a
        1200x630 JPEG each turn. Request 1 is about 40 KB in both runs because it carries the system prompt and tools.
      </figcaption>
    </figure>
  )
}
