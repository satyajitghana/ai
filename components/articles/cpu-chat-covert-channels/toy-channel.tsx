"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { cn } from "@/lib/utils"

import { NOISES, SLOTS, SWEEP } from "./data"

// A toy contention channel between two threads of ONE process, pinned to one logical CPU, measured on a shared
// cloud VM (data.ts has the provenance). The strip of received bits is not a recording: it is drawn from the
// measured mean bit error rate for the chosen cell with a fixed-seed generator, so you can see what that error
// rate looks like. Everything else on the card is a number from the sweep.

const ACCENT = "oklch(0.62 0.16 35)"

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

export function ToyChannel() {
  const [si, setSi] = useState(4)
  const [ni, setNi] = useState(0)
  const slot = SLOTS[si]
  const noise = NOISES[ni]
  const row = SWEEP.find((r) => r[0] === slot && r[1] === noise)!
  const [, , ber, lo, hi, cap] = row
  const raw = 1e6 / slot
  const r = rng(7)
  const sent = Array.from({ length: 48 }, () => (r() < 0.5 ? 0 : 1))
  const flip = Array.from({ length: 48 }, () => r() < Math.min(ber, 0.5))
  const got = sent.map((b, i) => (flip[i] ? 1 - b : b))
  const maxCap = 170

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        toy channel · two threads of one process on one logical CPU · measured, 5 runs per cell
      </div>
      <div className="space-y-2 px-4 pt-3">
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">slot length</span>
          <Range min={0} max={4} step={1} value={si} accent={ACCENT} onChange={(e) => setSi(Number(e.target.value))} aria-label="slot length" className="w-full" />
          <span className="w-24 shrink-0 text-right font-mono tabular-nums">{slot >= 1000 ? `${slot / 1000} ms` : `${slot} us`}</span>
        </label>
        <label className="flex items-center gap-3 text-xs">
          <span className="w-28 shrink-0 font-mono text-muted-foreground">noise thread</span>
          <Range min={0} max={4} step={1} value={ni} accent={ACCENT} onChange={(e) => setNi(Number(e.target.value))} aria-label="noise duty" className="w-full" />
          <span className="w-24 shrink-0 text-right font-mono tabular-nums">{Math.round(noise * 100)}% busy</span>
        </label>
      </div>
      <div className="grid grid-cols-3 gap-3 px-4 py-3 font-mono text-xs">
        <div>
          <div className="text-muted-foreground">raw rate</div>
          <div className="text-lg tabular-nums">{raw.toFixed(0)} b/s</div>
        </div>
        <div>
          <div className="text-muted-foreground">bit error rate</div>
          <div className="text-lg tabular-nums">{(ber * 100).toFixed(1)}%</div>
          <div className="text-[10px] text-muted-foreground">runs {(lo * 100).toFixed(1)}% to {(hi * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-muted-foreground">capacity</div>
          <div className="text-lg tabular-nums">{cap.toFixed(0)} b/s</div>
          <div className="text-[10px] text-muted-foreground">raw x (1 - H(BER))</div>
        </div>
      </div>
      <div className="px-4 pb-3">
        <div className="mb-1 font-mono text-[11px] text-muted-foreground">capacity across the grid (b/s; click a cell)</div>
        <div className="grid gap-1" style={{ gridTemplateColumns: `3.5rem repeat(${NOISES.length}, 1fr)` }}>
          <div />
          {NOISES.map((n) => (
            <div key={n} className="text-center font-mono text-[10px] text-muted-foreground">{Math.round(n * 100)}%</div>
          ))}
          {SLOTS.map((s, i) => (
            <div key={s} className="contents">
              <div className="self-center font-mono text-[10px] text-muted-foreground">{s >= 1000 ? `${s / 1000} ms` : `${s} us`}</div>
              {NOISES.map((n, j) => {
                const c = SWEEP.find((x) => x[0] === s && x[1] === n)![5]
                const a = Math.min(1, c / maxCap)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => {
                      setSi(i)
                      setNi(j)
                    }}
                    aria-label={`slot ${s} microseconds, noise ${Math.round(n * 100)} percent, capacity ${c.toFixed(0)} bits per second`}
                    className={cn("rounded border py-1 font-mono text-[11px] tabular-nums", i === si && j === ni && "ring-2 ring-foreground/50")}
                    style={{ background: `color-mix(in oklch, ${ACCENT} ${(a * 70).toFixed(0)}%, transparent)` }}
                  >
                    {c.toFixed(0)}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="border-t px-4 py-3 font-mono text-[11px]">
        <div className="mb-1 text-muted-foreground">48 bits sent, and 48 received at this cell&apos;s mean error rate (drawn from the rate, not recorded)</div>
        <div className="flex flex-wrap gap-x-[2px] leading-5" aria-hidden>
          {sent.map((b, i) => (
            <span key={i} className="w-3 text-center text-muted-foreground">{b}</span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-[2px] leading-5" aria-hidden>
          {got.map((b, i) => (
            <span key={i} className={cn("w-3 text-center", flip[i] && "rounded bg-foreground text-background")}>{b}</span>
          ))}
        </div>
        <div className="mt-2 text-muted-foreground">
          Within one process, one CPU. Nothing here crosses a process, VM or tenant boundary, and the numbers say nothing about a real sandbox.
        </div>
      </div>
    </figure>
  )
}
