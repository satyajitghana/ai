"use client"

import { useEffect, useRef, useState } from "react"
import { PauseIcon, PlayIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// ─────────────────────────────────────────────────────────────────────────────
// One shared visual language for the whole attention field guide.
//
// The reader learns the colours once and carries them across every diagram:
//   ATT    a query attends here (allowed key / kept token)      → green
//   MASK   masked out / not read                                → muted
//   LOCAL  the query's own local window / self position         → amber
//   GLOBAL a global or "sink" token every query can see         → violet
//   IDX    selected by a content score (top-k, index branch)    → blue
//   IO     a systems object (SRAM tile, KV page, running state) → teal
//
// Every component wraps itself in <FigureCard> for identical chrome (bordered
// card + mono caption bar), and animated ones gate autoplay behind
// useReducedMotion() with a manual step/scrub fallback. First render is pure and
// deterministic (SSR-safe): timers, matchMedia and Math.random live in effects
// only, so the server prerender always terminates.
// ─────────────────────────────────────────────────────────────────────────────

export const ATT = "oklch(0.62 0.16 150)" // attended — house green
export const LOCAL = "oklch(0.72 0.15 60)" // local window / self — amber
export const GLOBAL = "oklch(0.58 0.20 300)" // global / sink token — violet
export const IDX = "oklch(0.60 0.15 255)" // content-selected — blue
export const IO = "oklch(0.72 0.14 195)" // systems (SRAM / page / state) — teal
export const WARM = "oklch(0.70 0.17 40)" // a second/contrasting map — warm orange

// Respect the OS reduced-motion setting. Returns false on the server and first
// client render (deterministic), flips in an effect. Autoplay must check this.
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

// A capped ticker: advances `frames` steps at `ms` cadence while playing, and
// never runs when the OS asks for reduced motion. The cap lives in the caller's
// modulo, not here, so there is no unbounded loop anywhere.
export function useTicker(
  playing: boolean,
  reduced: boolean,
  ms: number,
  onTick: () => void
) {
  const cb = useRef(onTick)
  cb.current = onTick
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

export function PlayPause({
  playing,
  onToggle,
  hidden,
}: {
  playing: boolean
  onToggle: () => void
  hidden?: boolean
}) {
  if (hidden) return <span className="text-muted-foreground/50">step mode</span>
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex cursor-pointer items-center gap-1 transition-colors hover:text-foreground"
      aria-pressed={playing}
    >
      {playing ? <PauseIcon size={12} weight="fill" /> : <PlayIcon size={12} weight="fill" />}
      {playing ? "pause" : "play"}
    </button>
  )
}

export type LegendItem = { color: string; label: string; op?: number; ring?: boolean }

export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-mono text-[10px] text-muted-foreground">
      {items.map((it) => (
        <span key={it.label} className="flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-2.5 rounded-[3px]"
            style={{
              background: it.ring ? "transparent" : it.color,
              opacity: it.op ?? 1,
              boxShadow: it.ring ? `inset 0 0 0 1.5px ${it.color}` : undefined,
            }}
          />
          {it.label}
        </span>
      ))}
    </div>
  )
}

// A small segmented control used across diagrams (mode / pattern pickers).
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  color,
  ariaLabel,
}: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  color?: string
  ariaLabel?: string
}) {
  return (
    <div className="flex flex-wrap items-center gap-1" role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onChange(o.id)}
            aria-pressed={on}
            className={cn(
              "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
              on
                ? "border-transparent text-background"
                : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
            )}
            style={on ? { background: color ?? ATT } : undefined}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// Shared soft drop-shadow + arrow marker defs. Give each instance a unique id
// prefix so multiple diagrams on one page never collide.
export function SvgDefs({ id, arrow }: { id: string; arrow?: string }) {
  return (
    <defs>
      <filter id={`${id}-soft`} x="-40%" y="-40%" width="180%" height="180%">
        <feDropShadow dx="0" dy="1" stdDeviation="1.3" floodOpacity="0.16" />
      </filter>
      {arrow ? (
        <marker
          id={`${id}-arr`}
          viewBox="0 -5 10 10"
          markerWidth="7"
          markerHeight="7"
          orient="auto"
          refX="7"
          refY="0"
        >
          <path d="M0,-4L6,0L0,4" fill="none" stroke={arrow} strokeWidth={1.5} />
        </marker>
      ) : null}
    </defs>
  )
}
