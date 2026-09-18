"use client"

import { useEffect, useRef, useState } from "react"

// Shared chrome + palette for the two GOAT interactives: a side-by-side
// softmax-vs-entropic-OT attention grid, and a Sinkhorn-iteration stepper.
// Colors echo the field-guide convention used elsewhere on the site (green =
// ordinary attention weight, violet = mass over its budget / a sink, teal = a
// constraint sitting right at its budget) so a reader who has seen the
// attention-mechanisms piece recognizes the language immediately.

export const ATT = "oklch(0.62 0.16 150)" // ordinary attention weight — green
export const SINK = "oklch(0.58 0.20 300)" // over budget / sink mass — violet
export const OK = "oklch(0.72 0.14 195)" // at its budget — teal

// Respect the OS reduced-motion setting. False on server + first client
// render (deterministic), flips in an effect only.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)")
    const on = () => setReduced(mq.matches)
    on()
    mq.addEventListener("change", on)
    return () => mq.removeEventListener("change", on)
  }, [])
  return reduced
}

// A capped ticker: advances at `ms` cadence while playing, never while the OS
// asks for reduced motion. Caller owns the modulo/looping.
export function useTicker(
  playing: boolean,
  reduced: boolean,
  ms: number,
  onTick: () => void
) {
  const cb = useRef(onTick)
  useEffect(() => {
    cb.current = onTick
  })
  useEffect(() => {
    if (!playing || reduced) return
    const id = setInterval(() => cb.current(), ms)
    return () => clearInterval(id)
  }, [playing, reduced, ms])
}

export function FigureCard({
  label,
  right,
  children,
}: {
  label: string
  right?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span className="truncate">{label}</span>
        <span className="shrink-0">
          {right ?? <span className="text-muted-foreground/50">illustrative</span>}
        </span>
      </div>
      <div className="p-3 sm:p-4">{children}</div>
    </figure>
  )
}

export function Legend({
  items,
}: {
  items: { color: string; label: string; ring?: boolean }[]
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{
              background: it.ring ? "transparent" : it.color,
              boxShadow: it.ring ? `inset 0 0 0 1.5px ${it.color}` : undefined,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}
