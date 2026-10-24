"use client"

import { useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"

import { CLIPS } from "./data"

// Two lanes of talkspurts from one of Block's published Dessa recordings, a
// window at a time. Every bar is measured from the FLAC files (see data.ts for
// the method); nothing here is schematic. Overlap is where both lanes are on.
// Floor switches are marked with their offset: positive = a gap before the
// new speaker started, negative = they started while the other was talking.

const DESSA = "oklch(0.62 0.16 150)"
const OTHER = "oklch(0.7 0.14 60)"
const OVER = "oklch(0.62 0.2 25)"
const WIN = 3000 // centiseconds shown at once

function pairs(flat: number[]): [number, number][] {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < flat.length; i += 2) out.push([flat[i], flat[i + 1]])
  return out
}

function overlaps(a: [number, number][], b: [number, number][]) {
  const out: [number, number][] = []
  for (const [s, e] of a)
    for (const [s2, e2] of b) {
      const lo = Math.max(s, s2)
      const hi = Math.min(e, e2)
      if (hi > lo) out.push([lo, hi])
    }
  return out
}

function median(xs: number[]) {
  if (!xs.length) return 0
  const s = [...xs].sort((p, q) => p - q)
  const m = (s.length - 1) / 2
  const lo = Math.floor(m)
  const hi = Math.ceil(m)
  return (s[lo] + s[hi]) / 2
}

function clock(cs: number) {
  const s = Math.floor(cs / 100)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`
}

export function TurnTape() {
  const [id, setId] = useState("ai-release")
  const [t0, setT0] = useState(0)
  const clip = CLIPS.find((c) => c.id === id) ?? CLIPS[0]
  const maxStart = Math.max(0, clip.dur - WIN)
  const start = Math.min(t0, maxStart)
  const end = start + WIN

  const lanes = useMemo(() => {
    const u = pairs(clip.u)
    const d = pairs(clip.d)
    return { u, d, o: overlaps(u, d) }
  }, [clip])

  const stats = useMemo(() => {
    const ds = clip.sw.filter((x) => x[2] === 1).map((x) => x[1] / 100)
    const os = clip.sw.filter((x) => x[2] === 0).map((x) => x[1] / 100)
    const talkU = lanes.u.reduce((a, [s, e]) => a + e - s, 0)
    const talkD = lanes.d.reduce((a, [s, e]) => a + e - s, 0)
    const ov = lanes.o.reduce((a, [s, e]) => a + e - s, 0)
    return {
      dn: ds.length,
      dmed: median(ds),
      dneg: ds.length ? ds.filter((x) => x < 0).length / ds.length : 0,
      omed: median(os),
      bcd: clip.ov.filter((x) => x[2] === 1).length,
      bco: clip.ov.filter((x) => x[2] === 0).length,
      ovShare: talkU + talkD - ov > 0 ? ov / (talkU + talkD - ov) : 0,
    }
  }, [clip, lanes])

  const x = (cs: number) => ((cs - start) / WIN) * 100
  const vis = (s: number, e: number) => e > start && s < end
  const clipRect = (s: number, e: number) => {
    const a = Math.max(s, start)
    const b = Math.min(e, end)
    return { left: `${x(a)}%`, width: `${((b - a) / WIN) * 100}%` }
  }
  const ticks: number[] = []
  for (let t = Math.ceil(start / 500) * 500; t <= end; t += 500) ticks.push(t)
  const otherName = clip.other === "GPT-Live-1" ? "GPT-Live-1" : clip.other === "team member" ? "person (team)" : "person"

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">turn tape: who is talking, 10 ms at a time</span>
        <span className="font-mono text-[10px] text-muted-foreground">measured from Block&apos;s two-track demo files</span>
      </div>
      <div className="p-3 sm:p-4">
        <label className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          recording
          <select
            value={id}
            onChange={(e) => {
              setId(e.target.value)
              setT0(0)
            }}
            className="rounded-md border bg-background px-2 py-1 text-[11px] text-foreground"
          >
            {CLIPS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title} ({clock(c.dur)}, {c.other})
              </option>
            ))}
          </select>
        </label>

        <div className="mt-3 rounded-lg border bg-muted/10 p-3">
          <div className="grid grid-cols-[5.5rem_1fr] items-center gap-x-2 gap-y-1.5">
            <span className="truncate font-mono text-[10px] text-muted-foreground">{otherName}</span>
            <div className="relative h-5 rounded-sm bg-muted/30">
              {lanes.u.filter(([s, e]) => vis(s, e)).map(([s, e]) => (
                <div key={`u${s}`} className="absolute inset-y-0 rounded-sm" style={{ ...clipRect(s, e), background: OTHER, opacity: 0.85 }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">Dessa</span>
            <div className="relative h-5 rounded-sm bg-muted/30">
              {lanes.d.filter(([s, e]) => vis(s, e)).map(([s, e]) => (
                <div key={`d${s}`} className="absolute inset-y-0 rounded-sm" style={{ ...clipRect(s, e), background: DESSA, opacity: 0.85 }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">both</span>
            <div className="relative h-2 rounded-sm bg-muted/20">
              {lanes.o.filter(([s, e]) => vis(s, e)).map(([s, e]) => (
                <div key={`o${s}`} className="absolute inset-y-0 rounded-sm" style={{ ...clipRect(s, e), background: OVER }} />
              ))}
            </div>
            <span className="font-mono text-[10px] text-muted-foreground">switches</span>
            <div className="relative h-9">
              {clip.sw
                .filter(([s]) => s >= start && s <= end)
                .map(([s, off, who]) => (
                  <div key={`s${s}${who}`} className="absolute top-0 flex -translate-x-1/2 flex-col items-center" style={{ left: `${x(s)}%` }}>
                    <span className="h-3 w-px" style={{ background: who ? DESSA : OTHER }} />
                    <span className="font-mono text-[9px] leading-3" style={{ color: who ? DESSA : OTHER }}>
                      {off > 0 ? "+" : ""}
                      {(off / 100).toFixed(2)}
                    </span>
                  </div>
                ))}
            </div>
            <span />
            <div className="relative h-3">
              {ticks.map((t) => (
                <span key={t} className="absolute -translate-x-1/2 font-mono text-[9px] text-muted-foreground" style={{ left: `${x(t)}%` }}>
                  {clock(t)}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <Range
              min={0}
              max={maxStart}
              step={100}
              value={start}
              onChange={(e) => setT0(Number(e.target.value))}
              aria-label="window start"
              className="w-full"
            />
            <div className="mt-1 font-mono text-[10px] text-muted-foreground">
              window {clock(start)} to {clock(end)} of {clock(clip.dur)}
            </div>
          </div>
        </div>

        <dl className="mt-3 grid grid-cols-2 gap-2 font-mono text-[11px] sm:grid-cols-4">
          <div className="rounded-md border bg-muted/10 p-2">
            <dt className="text-[10px] text-muted-foreground">Dessa takes the floor</dt>
            <dd style={{ color: DESSA }}>{stats.dn} times</dd>
          </div>
          <div className="rounded-md border bg-muted/10 p-2">
            <dt className="text-[10px] text-muted-foreground">its median offset</dt>
            <dd style={{ color: DESSA }}>
              {stats.dmed > 0 ? "+" : ""}
              {stats.dmed.toFixed(2)} s ({(stats.dneg * 100).toFixed(0)}% in overlap)
            </dd>
          </div>
          <div className="rounded-md border bg-muted/10 p-2">
            <dt className="text-[10px] text-muted-foreground">{otherName}&apos;s median offset</dt>
            <dd style={{ color: OTHER }}>
              {stats.omed > 0 ? "+" : ""}
              {stats.omed.toFixed(2)} s
            </dd>
          </div>
          <div className="rounded-md border bg-muted/10 p-2">
            <dt className="text-[10px] text-muted-foreground">short overlaps inside a turn</dt>
            <dd>
              <span style={{ color: DESSA }}>{stats.bcd}</span> / <span style={{ color: OTHER }}>{stats.bco}</span>, both {(stats.ovShare * 100).toFixed(1)}% of talk
            </dd>
          </div>
        </dl>
      </div>
      <figcaption className="border-t px-4 py-2.5 text-xs leading-5 text-muted-foreground">
        Talkspurts from an energy detector run on each speaker&apos;s own FLAC track; red marks both talking at once. A switch is a
        speaker starting after the other one last spoke; its number is the gap in seconds, negative when the new speaker started
        before the other had finished. Short overlaps are spurts that start and end inside the other&apos;s spurt: backchannels,
        laughs, breaths. The recordings were chosen by Block.
      </figcaption>
    </figure>
  )
}
