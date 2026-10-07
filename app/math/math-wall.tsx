"use client"

// The /math wall: one tile per openai/math result family, filterable, with a
// panel per result. Filters live in the query string (lib/use-url-state), the
// open result in the hash (#107), so every view is a link.
//
// The tiles are a slim projection serialized into the page; the panel fetches
// the review prose for one family from /api/math/<id> when it opens. A tile
// with a rendered reel (the short narrated video; "reel" is the internal name)
// is a poster that plays a muted preview while hovered or focused on a device
// that hovers, never under prefers-reduced-motion; on a phone a tap opens the
// panel. The panel plays the reel in the site's player
// (components/site/film-player.tsx): ambient and muted, "Watch with sound" for
// the narration with captions and the full controls. One player at a time, for
// the reel being watched. A family without a reel shows a typographic card
// that says so.

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  ShuffleIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr"

import { FilmPlayer } from "@/components/site/film-player"
import type { MathResultDetail, WallTile } from "@/lib/math-wall"
import { useUrlState } from "@/lib/use-url-state"
import { cn } from "@/lib/utils"

const SIG = ["landmark", "major", "notable", "technical"] as const
const LEAN = ["main", "part", "none"] as const
const LEAN_LABEL = ["Lean: main theorem", "Lean: part only", "Manuscript only"]
const LEAN_SHORT = ["Lean", "Lean · part", "no Lean"]
const KIND_SLUG: Record<string, string> = {
  proof: "proof",
  "disproof/counterexample": "disproof",
  "improved bound": "bound",
  partial: "partial",
  conditional: "conditional",
}
// Tiles rendered at a time: divisible by the 2, 3 and 4 columns of the grid.
const PAGE = 36
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")

// The reel's own ground and ink (brand-crew/skills/math-reels/engine/reel.js):
// the placeholder card is a reel that has not been painted yet, in both themes.
const REEL_BG = "#0b0d12"
const REEL_MUTE = "#8E95A1"

// ── external stores: hash, reduced motion, hover capability ─────────────────

const URL_EVENT = "urlstatechange"
function subscribeHash(on: () => void) {
  window.addEventListener("hashchange", on)
  window.addEventListener("popstate", on)
  window.addEventListener(URL_EVENT, on)
  return () => {
    window.removeEventListener("hashchange", on)
    window.removeEventListener("popstate", on)
    window.removeEventListener(URL_EVENT, on)
  }
}
const useHash = () =>
  useSyncExternalStore(subscribeHash, () => window.location.hash, () => "")

function useMedia(query: string) {
  return useSyncExternalStore(
    (on) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", on)
      return () => mq.removeEventListener("change", on)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}
const REDUCE = "(prefers-reduced-motion: reduce)"
const HOVER = "(hover: hover) and (pointer: fine)"

type Filters = {
  q: string
  d: number
  kind: string
  sig: number
  lean: number
  sort: "importance" | "number"
}

// ── the wall ────────────────────────────────────────────────────────────────

export function MathWall({
  tiles,
  disciplines,
  accents,
  kinds,
}: {
  tiles: WallTile[]
  disciplines: string[]
  accents: string[]
  kinds: Record<string, string>
}) {
  const discSlugs = useMemo(() => disciplines.map(slug), [disciplines])
  const [f, setParams] = useUrlState<Filters>((p) => {
    const d = discSlugs.indexOf(p.get("d") ?? "")
    const kind = Object.entries(KIND_SLUG).find(([, v]) => v === p.get("kind"))?.[0] ?? ""
    return {
      q: p.get("q") ?? "",
      d,
      kind,
      sig: SIG.indexOf((p.get("sig") ?? "") as (typeof SIG)[number]),
      lean: LEAN.indexOf((p.get("lean") ?? "") as (typeof LEAN)[number]),
      sort: p.get("sort") === "number" ? "number" : "importance",
    }
  })
  const set = (key: string, value: string | null) =>
    setParams((p) => {
      if (value) p.set(key, value)
      else p.delete(key)
    })

  const byId = useMemo(() => new Map(tiles.map((t) => [t.id, t])), [tiles])

  // Every filter but one: what the chips and selects count against, so a
  // count says how many you would get by choosing it.
  const match = useCallback(
    (t: WallTile, skip?: "d" | "kind" | "sig" | "lean") => {
      const needle = f.q.trim().toLowerCase()
      if (skip !== "d" && f.d >= 0 && t.d !== f.d) return false
      if (skip !== "kind" && f.kind && t.k !== f.kind) return false
      if (skip !== "sig" && f.sig >= 0 && t.s !== f.sig) return false
      if (skip !== "lean" && f.lean >= 0 && t.l !== f.lean) return false
      if (needle) {
        const hay = `${t.id} ${t.t} ${t.c} ${disciplines[t.d]}`.toLowerCase()
        if (!needle.split(/\s+/).every((w) => hay.includes(w))) return false
      }
      return true
    },
    [f.q, f.d, f.kind, f.sig, f.lean, disciplines],
  )

  const shown = useMemo(() => {
    const list = tiles.filter((t) => match(t))
    if (f.sort === "importance") list.sort((a, b) => a.s - b.s || Number(!!b.r) - Number(!!a.r) || a.id.localeCompare(b.id))
    return list
  }, [tiles, match, f.sort])

  const discCounts = useMemo(() => {
    const c = disciplines.map(() => 0)
    for (const t of tiles) if (match(t, "d")) c[t.d]++
    return c
  }, [tiles, match, disciplines])
  const countBy = (skip: "kind" | "sig" | "lean", key: (t: WallTile) => string | number) => {
    const c = new Map<string | number, number>()
    for (const t of tiles) if (match(t, skip)) c.set(key(t), (c.get(key(t)) ?? 0) + 1)
    return c
  }
  const kindCounts = countBy("kind", (t) => t.k)
  const sigCounts = countBy("sig", (t) => t.s)
  const leanCounts = countBy("lean", (t) => t.l)

  // ── open result: the hash ──
  const hash = useHash()
  const openId = /^#\d{3}$/.test(hash) && byId.has(hash.slice(1)) ? hash.slice(1) : null
  const pushed = useRef(false)
  const go = useCallback((id: string | null, mode: "push" | "replace") => {
    const base = window.location.pathname + window.location.search
    if (id) {
      if (mode === "push") {
        window.history.pushState(null, "", `${base}#${id}`)
        pushed.current = true
      } else window.history.replaceState(null, "", `${base}#${id}`)
    } else if (pushed.current) {
      pushed.current = false
      window.history.back()
      return
    } else window.history.replaceState(null, "", base)
    window.dispatchEvent(new Event(URL_EVENT))
  }, [])

  const surprise = () => {
    const pool = shown.length ? shown : tiles
    const pick = pool[Math.floor(Math.random() * pool.length)]
    if (pick) go(pick.id, openId ? "replace" : "push")
  }

  // ── progressive rendering: PAGE tiles at a time, more as the end nears ──
  const filterKey = `${f.q}|${f.d}|${f.kind}|${f.sig}|${f.lean}|${f.sort}`
  const [more, setMore] = useState({ key: filterKey, n: PAGE })
  const limit = more.key === filterKey ? more.n : PAGE
  const visible = shown.slice(0, limit)
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || limit >= shown.length) return
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) setMore({ key: filterKey, n: limit + PAGE })
      },
      { rootMargin: "800px 0px" },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [filterKey, limit, shown.length])

  // ── grid keyboard: one tab stop, arrows move, Enter opens ──
  const [active, setActive] = useState(0)
  const activeIdx = Math.min(active, Math.max(0, visible.length - 1))
  const grid = useRef<HTMLUListElement>(null)
  const onGridKey = (e: React.KeyboardEvent) => {
    const keys = ["ArrowRight", "ArrowLeft", "ArrowDown", "ArrowUp", "Home", "End"]
    if (!keys.includes(e.key) || !grid.current) return
    const items = [...grid.current.querySelectorAll<HTMLElement>("[data-tile]")]
    const top = items[0]?.offsetTop
    const cols = Math.max(1, items.findIndex((el) => el.offsetTop !== top) === -1 ? items.length : items.findIndex((el) => el.offsetTop !== top))
    const step: Record<string, number> = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: cols, ArrowUp: -cols }
    let next = e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : activeIdx + step[e.key]
    next = Math.max(0, Math.min(items.length - 1, next))
    e.preventDefault()
    setActive(next)
    items[next]?.focus()
  }

  const filtered = f.q || f.d >= 0 || f.kind || f.sig >= 0 || f.lean >= 0
  const openIndex = openId ? shown.findIndex((t) => t.id === openId) : -1
  const ring = openIndex >= 0 ? shown : tiles
  const ringIndex = openId ? ring.findIndex((t) => t.id === openId) : -1

  return (
    <div>
      {/* ── controls ── */}
      <div className="space-y-3">
        <div className="flex gap-2">
          <label className="relative flex-1">
            <span className="sr-only">Search results</span>
            <input
              type="search"
              value={f.q}
              onChange={(e) => set("q", e.target.value || null)}
              placeholder="Search titles, claims, disciplines: zeta, Kakeya, 107…"
              className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-2 focus-visible:ring-ring"
            />
          </label>
          <button
            type="button"
            onClick={surprise}
            title="Open a random result"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg border bg-background px-3 text-sm sm:px-4 font-medium transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            <ShuffleIcon aria-hidden className="size-4" />
            <span className="sr-only sm:not-sr-only">Surprise me</span>
          </button>
        </div>

        <div
          role="group"
          aria-label="Discipline"
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:thin] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <Chip pressed={f.d < 0} onClick={() => set("d", null)} label="All" count={discCounts.reduce((a, b) => a + b, 0)} />
          {disciplines.map((name, i) => (
            <Chip
              key={name}
              pressed={f.d === i}
              onClick={() => set("d", f.d === i ? null : discSlugs[i])}
              label={name}
              count={discCounts[i]}
              accent={accents[i]}
              disabled={discCounts[i] === 0 && f.d !== i}
            />
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select
            label="Kind"
            value={f.kind ? KIND_SLUG[f.kind] : ""}
            onChange={(v) => set("kind", v || null)}
            options={[
              ["", "Any kind"],
              ...Object.keys(kinds).map((k) => [KIND_SLUG[k], `${kinds[k].replace(/^Claimed /, "")} (${kindCounts.get(k) ?? 0})`] as [string, string]),
            ]}
          />
          <Select
            label="Significance"
            value={f.sig >= 0 ? SIG[f.sig] : ""}
            onChange={(v) => set("sig", v || null)}
            options={[["", "Any significance"], ...SIG.map((s, i) => [s, `${s} (${sigCounts.get(i) ?? 0})`] as [string, string])]}
          />
          <div role="radiogroup" aria-label="Lean status" className="col-span-2 inline-flex h-9 rounded-lg border p-0.5 text-xs">
            {[
              ["", "Any"],
              ["main", `Main (${leanCounts.get(0) ?? 0})`],
              ["part", `Part (${leanCounts.get(1) ?? 0})`],
              ["none", `None (${leanCounts.get(2) ?? 0})`],
            ].map(([v, label]) => {
              const on = (f.lean >= 0 ? LEAN[f.lean] : "") === v
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => set("lean", v || null)}
                  className={cn(
                    "flex-1 rounded-md px-2.5 whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:flex-none",
                    on ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {v === "" ? "Lean: any" : label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span aria-live="polite" className="mr-auto">
            {shown.length === tiles.length ? `All ${tiles.length} results` : `${shown.length} of ${tiles.length} results`}
          </span>
          {filtered ? (
            <button
              type="button"
              className="underline underline-offset-4 hover:text-foreground"
              onClick={() =>
                setParams((p) => {
                  for (const k of ["q", "d", "kind", "sig", "lean"]) p.delete(k)
                })
              }
            >
              Clear filters
            </button>
          ) : null}
          <Select
            compact
            label="Sort"
            value={f.sort === "number" ? "number" : ""}
            onChange={(v) => set("sort", v || null)}
            options={[
              ["", "Most significant first"],
              ["number", "By number"],
            ]}
          />
        </div>
      </div>

      {/* ── the wall ── */}
      {shown.length ? (
        <ul
          ref={grid}
          aria-label="Results"
          onKeyDown={onGridKey}
          className="mt-4 grid grid-cols-2 gap-x-3 gap-y-5 sm:gap-x-4 md:grid-cols-3 lg:grid-cols-4"
        >
          {visible.map((t, i) => (
            <Tile
              key={t.id}
              tile={t}
              discipline={disciplines[t.d]}
              accent={accents[t.d]}
              tabIndex={i === activeIdx ? 0 : -1}
              onFocus={() => setActive(i)}
              onOpen={() => go(t.id, "push")}
            />
          ))}
        </ul>
      ) : null}
      {shown.length > limit ? (
        <div ref={sentinel} className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setMore({ key: filterKey, n: limit + PAGE })}
            className="rounded-lg border px-4 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Show more ({shown.length - limit} left)
          </button>
        </div>
      ) : null}
      {shown.length ? null : (
        <p className="mt-10 rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          Nothing matches. Try fewer filters, or{" "}
          <button type="button" className="underline underline-offset-4" onClick={surprise}>
            a random result
          </button>
          .
        </p>
      )}

      <Panel
        id={openId}
        tile={openId ? byId.get(openId)! : null}
        tiles={tiles}
        disciplines={disciplines}
        accents={accents}
        kinds={kinds}
        prev={ringIndex > 0 ? ring[ringIndex - 1].id : null}
        next={ringIndex >= 0 && ringIndex < ring.length - 1 ? ring[ringIndex + 1].id : null}
        position={ringIndex >= 0 ? `${ringIndex + 1} of ${ring.length}` : ""}
        onNavigate={(id) => go(id, "replace")}
        onClose={() => go(null, "replace")}
      />
    </div>
  )
}

// ── controls ────────────────────────────────────────────────────────────────

function Chip({
  pressed,
  onClick,
  label,
  count,
  accent,
  disabled,
}: {
  pressed: boolean
  onClick: () => void
  label: string
  count: number
  accent?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      disabled={disabled}
      style={accent ? ({ "--acc": accent } as React.CSSProperties) : undefined}
      className={cn(
        "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs whitespace-nowrap transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-40",
        pressed
          ? accent
            ? "border-[var(--acc)] bg-[color-mix(in_oklab,var(--acc)_18%,transparent)] text-foreground"
            : "border-foreground bg-foreground text-background"
          : "text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      )}
    >
      {accent ? <span aria-hidden className="size-2 rounded-full bg-[var(--acc)]" /> : null}
      {label}
      <span className="font-mono text-[10px] tabular-nums opacity-70">{count}</span>
    </button>
  )
}

function Select({
  label,
  value,
  onChange,
  options,
  compact,
}: {
  compact?: boolean
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <label className="min-w-0">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          "min-w-0 rounded-lg bg-background text-xs focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
          compact ? "h-8 border-0 px-1 text-muted-foreground hover:text-foreground" : "h-9 w-full border px-2 sm:w-auto",
        )}
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  )
}

function LeanBadge({ l, short }: { l: number; short?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-1.5 py-px font-mono text-[10px] whitespace-nowrap",
        l === 0 && "border-emerald-600/40 text-emerald-700 dark:border-emerald-400/40 dark:text-emerald-400",
        l === 1 && "border-amber-600/40 text-amber-700 dark:border-amber-400/40 dark:text-amber-400",
        l === 2 && "text-muted-foreground",
      )}
    >
      <span aria-hidden>{l === 0 ? "✓" : l === 1 ? "◐" : "○"}</span>
      {short ? LEAN_SHORT[l] : LEAN_LABEL[l]}
    </span>
  )
}

function SigBadge({ s }: { s: number }) {
  return (
    <span
      className={cn(
        "rounded-full px-1.5 py-px font-mono text-[10px] whitespace-nowrap",
        s === 0 ? "bg-foreground text-background" : "border text-muted-foreground",
      )}
    >
      {SIG[s]}
    </span>
  )
}

// A reel that has not been rendered yet: the reel's dark ground, its family
// number in the discipline's accent, and a note that says so.
function ReelPlaceholder({ tile, discipline, accent, large }: { tile: WallTile; discipline: string; accent: string; large?: boolean }) {
  return (
    <div
      className="absolute inset-0 flex flex-col justify-between overflow-hidden"
      style={{
        background: `radial-gradient(120% 90% at 85% 110%, color-mix(in oklab, ${accent} 22%, transparent), transparent 60%), ${REEL_BG}`,
        padding: large ? "1.25rem" : "0.6rem 0.7rem",
      }}
    >
      <span
        className={cn("truncate font-mono uppercase tracking-[0.12em]", large ? "text-xs" : "text-[9px]")}
        style={{ color: accent }}
      >
        {discipline}
      </span>
      <span
        aria-hidden
        className={cn("font-heading leading-none font-semibold tabular-nums", large ? "text-5xl" : "text-3xl sm:text-4xl")}
        style={{ color: `color-mix(in oklab, ${accent} 70%, ${REEL_BG})` }}
      >
        {tile.id}
      </span>
      <span className="flex items-center justify-between gap-2">
        <span aria-hidden className="h-0.5 w-8 rounded" style={{ background: accent }} />
        <span className={cn("font-mono", large ? "text-xs" : "text-[9px]")} style={{ color: REEL_MUTE }}>
          video coming
        </span>
      </span>
    </div>
  )
}

// ── a tile ──────────────────────────────────────────────────────────────────

function Tile({
  tile,
  discipline,
  accent,
  tabIndex,
  onFocus,
  onOpen,
}: {
  tile: WallTile
  discipline: string
  accent: string
  tabIndex: number
  onFocus: () => void
  onOpen: () => void
}) {
  const reduce = useMedia(REDUCE)
  const hover = useMedia(HOVER)
  const [play, setPlay] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const ref = useRef<HTMLAnchorElement>(null)
  const canPlay = !!tile.r && hover && !reduce

  const start = () => {
    if (!canPlay) return
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setPlay(true), 140)
  }
  const stop = () => {
    window.clearTimeout(timer.current)
    setPlay(false)
  }

  // a playing tile that scrolls away stops
  useEffect(() => {
    if (!play || !ref.current) return
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) setPlay(false)
    })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [play])
  useEffect(() => () => window.clearTimeout(timer.current), [])

  return (
    <li className="[contain-intrinsic-size:auto_260px] [content-visibility:auto]">
      <a
        ref={ref}
        id={tile.id}
        href={`#${tile.id}`}
        data-tile
        tabIndex={tabIndex}
        onFocus={() => {
          onFocus()
          start()
        }}
        onBlur={stop}
        onPointerEnter={start}
        onPointerLeave={stop}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
          e.preventDefault()
          stop()
          onOpen()
        }}
        aria-label={`${tile.id}. ${tile.t}. ${discipline}, ${SIG[tile.s]}, ${LEAN_LABEL[tile.l]}${tile.r ? "" : ", video coming"}`}
        className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
      >
        <div className="relative aspect-video overflow-hidden rounded-xl border border-black/5 bg-[#0b0d12] shadow-sm transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:shadow-md motion-reduce:transition-none motion-reduce:group-hover:translate-y-0 dark:border-white/10">
          {tile.r ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element -- a committed poster, served through mediaUrl */}
              <img
                src={tile.r[1]}
                alt=""
                loading="lazy"
                decoding="async"
                className="absolute inset-0 size-full object-cover"
              />
              {play ? (
                <video
                  src={tile.r[0]}
                  muted
                  playsInline
                  loop
                  autoPlay
                  preload="auto"
                  aria-hidden
                  className="absolute inset-0 size-full object-cover"
                />
              ) : null}
            </>
          ) : (
            <ReelPlaceholder tile={tile} discipline={discipline} accent={accent} />
          )}
          {tile.r ? (
            <span className="absolute top-1.5 right-1.5 rounded bg-black/55 px-1 font-mono text-[10px] text-white/85 tabular-nums backdrop-blur-sm">
              {tile.id}
            </span>
          ) : null}
        </div>
        <div className="mt-2 px-0.5">
          <h2 className="line-clamp-3 text-[13px] leading-snug font-medium text-balance sm:text-sm">{tile.t}</h2>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex min-w-0 items-center gap-1 text-[11px] text-muted-foreground">
              <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: accent }} />
              <span className="hidden truncate sm:inline">{discipline}</span>
            </span>
            <SigBadge s={tile.s} />
            <LeanBadge l={tile.l} short />
          </div>
        </div>
      </a>
    </li>
  )
}

// ── the panel ───────────────────────────────────────────────────────────────

const detailCache = new Map<string, MathResultDetail>()

function useDetail(id: string | null) {
  const [, bump] = useState(0)
  useEffect(() => {
    if (!id || detailCache.has(id)) return
    let live = true
    fetch(`/api/math/${id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: MathResultDetail | null) => {
        if (d) detailCache.set(id, d)
        if (live) bump((n) => n + 1)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [id])
  return id ? detailCache.get(id) ?? null : null
}

function Panel({
  id,
  tile,
  tiles,
  disciplines,
  accents,
  kinds,
  prev,
  next,
  position,
  onNavigate,
  onClose,
}: {
  id: string | null
  tile: WallTile | null
  tiles: WallTile[]
  disciplines: string[]
  accents: string[]
  kinds: Record<string, string>
  prev: string | null
  next: string | null
  position: string
  onNavigate: (id: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const detail = useDetail(id)

  // open/close the native modal dialog: it makes the page inert behind it,
  // keeps Tab inside, closes on Esc and returns focus to the tile
  useEffect(() => {
    const d = dialog.current
    if (!d) return
    if (id && !d.open) {
      d.showModal()
      document.documentElement.style.overflow = "hidden"
    } else if (!id && d.open) {
      d.close()
    }
  }, [id])
  useEffect(() => {
    if (!id) return
    body.current?.scrollTo({ top: 0 })
    heading.current?.focus({ preventScroll: true })
  }, [id])

  const related = useMemo(() => {
    if (!tile) return []
    const same = tiles
      .filter((t) => t.id !== tile.id && t.d === tile.d)
      .sort((a, b) => Math.abs(a.s - tile.s) - Math.abs(b.s - tile.s) || a.s - b.s || Math.abs(Number(a.id) - Number(tile.id)) - Math.abs(Number(b.id) - Number(tile.id)))
      .slice(0, 4)
    const n = Number(tile.id)
    const peers = tiles
      .filter((t) => t.d !== tile.d && t.s === tile.s)
      .sort((a, b) => ((Number(a.id) * 37 + n) % 372) - ((Number(b.id) * 37 + n) % 372))
      .slice(0, 2)
    return [...same, ...peers]
  }, [tile, tiles])

  const accent = tile ? accents[tile.d] : "#888"
  const discipline = tile ? disciplines[tile.d] : ""

  return (
    <dialog
      ref={dialog}
      aria-labelledby="math-panel-title"
      onClose={() => {
        document.documentElement.style.overflow = ""
        if (id) onClose()
      }}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => {
        if (e.target === dialog.current) onClose()
      }}
      onKeyDown={(e) => {
        // the player's own keys (arrows seek while it narrates) win
        if (e.defaultPrevented) return
        const el = e.target as HTMLElement
        if (el.closest("video, input, select, textarea")) return
        if (e.key === "ArrowLeft" && prev) onNavigate(prev)
        if (e.key === "ArrowRight" && next) onNavigate(next)
      }}
      className={cn(
        "fixed m-0 max-h-none max-w-none overflow-hidden bg-background p-0 text-foreground shadow-2xl backdrop:bg-black/55 backdrop:backdrop-blur-[2px]",
        // phone: a bottom sheet; md and up: a side sheet on the right
        "inset-x-0 top-auto bottom-0 h-[92dvh] w-full rounded-t-2xl border-t",
        "md:inset-y-0 md:right-0 md:left-auto md:h-dvh md:w-[min(600px,100vw)] md:rounded-none md:rounded-l-2xl md:border-t-0 md:border-l",
        "open:motion-safe:animate-in open:motion-safe:slide-in-from-bottom-8 md:open:motion-safe:slide-in-from-right-8 open:motion-safe:fade-in-0",
      )}
    >
      {tile ? (
        <div className="flex h-full flex-col">
          <div className="border-b px-3 pt-2 pb-1.5 md:pt-1.5">
            <span aria-hidden className="mx-auto mb-1.5 block h-1 w-10 rounded-full bg-muted-foreground/30 md:hidden" />
            <div className="flex items-center gap-2">
              <span className="inline-flex min-w-0 items-center gap-1.5 pl-1 font-mono text-[11px] text-muted-foreground">
                <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: accent }} />
                <span className="truncate">
                  {tile.id} · {discipline}
                </span>
              </span>
              <div className="ml-auto flex shrink-0 items-center">
                <span className="mr-1 hidden font-mono text-[11px] text-muted-foreground tabular-nums sm:inline">{position}</span>
                <IconButton label="Previous result" disabled={!prev} onClick={() => prev && onNavigate(prev)}>
                  <ArrowLeftIcon className="size-4" />
                </IconButton>
                <IconButton label="Next result" disabled={!next} onClick={() => next && onNavigate(next)}>
                  <ArrowRightIcon className="size-4" />
                </IconButton>
                <IconButton label="Close" onClick={onClose}>
                  <XIcon className="size-4" />
                </IconButton>
              </div>
            </div>
          </div>

          <div ref={body} className="flex-1 overflow-y-auto overscroll-contain px-4 pt-4 pb-10 sm:px-6">
            {tile.r ? (
              // keyed: the next or previous result is a fresh player, back in ambient
              <FilmPlayer
                key={tile.id}
                src={tile.r[0]}
                poster={tile.r[1]}
                captions={tile.r[2]}
                duration={tile.r[3]}
                title={`${tile.id}. ${tile.t}`}
                noun="video"
                kind={tile.r[2] ? "narrated video" : "video"}
              />
            ) : (
              <>
                <div className="relative aspect-[21/8] overflow-hidden rounded-xl bg-[#0b0d12]">
                  <ReelPlaceholder tile={tile} discipline={discipline} accent={accent} large />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  The video for this result has not been rendered yet. Everything below is the written review.
                </p>
              </>
            )}

            <h2
              id="math-panel-title"
              ref={heading}
              tabIndex={-1}
              className="mt-5 font-heading text-xl leading-snug font-semibold text-balance outline-none sm:text-2xl"
            >
              {tile.t}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="rounded-full border px-2 py-px text-[11px]">{kinds[tile.k] ?? tile.k}</span>
              <SigBadge s={tile.s} />
              <LeanBadge l={tile.l} />
            </div>

            <Section title="The claim">
              <p>{tile.c}</p>
            </Section>

            <Section title="Our read">
              {detail ? (
                <>
                  <p>{detail.verdict}</p>
                  {detail.explainer ? <p className="mt-3 text-muted-foreground">{detail.explainer}</p> : null}
                </>
              ) : (
                <Skeleton lines={4} />
              )}
            </Section>

            <Section title="Caveats">{detail ? <p>{detail.caveats}</p> : <Skeleton lines={3} />}</Section>

            <Section title={LEAN_LABEL[tile.l]}>
              {detail ? (
                <>
                  <p>{detail.leanExplained}</p>
                  {tile.l !== 2 && detail.leanDetail ? (
                    <p className="mt-2 font-mono text-[11px] leading-relaxed break-words text-muted-foreground">{detail.leanDetail}</p>
                  ) : null}
                </>
              ) : (
                <Skeleton lines={2} />
              )}
            </Section>

            <Section title="What the release says">
              {detail ? (
                <p className="text-muted-foreground">
                  {detail.releaseSummary}
                  {detail.pages ? ` (${detail.pages} pages.)` : ""}
                </p>
              ) : (
                <Skeleton lines={3} />
              )}
            </Section>

            <Section title={detail ? `Manuscripts (${detail.manuscripts.length})` : "Manuscripts"}>
              {detail ? (
                <ul className="space-y-1.5">
                  {detail.manuscripts.map((m) => (
                    <li key={m.url}>
                      <a
                        href={m.url}
                        target="_blank"
                        rel="noreferrer"
                        className="group inline-flex items-start gap-1 underline decoration-muted-foreground/40 underline-offset-4 hover:decoration-foreground"
                      >
                        <span>{m.title}</span>
                        <ArrowUpRightIcon aria-hidden className="mt-1 size-3 shrink-0 opacity-60" />
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <Skeleton lines={2} />
              )}
            </Section>

            {detail ? (
              <div className="mt-6 flex flex-wrap gap-2">
                <a
                  href={detail.articleUrl}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-foreground px-3 text-sm font-medium text-background transition-opacity hover:opacity-90"
                >
                  Our write-up
                  <ArrowRightIcon aria-hidden className="size-3.5" />
                </a>
                <a
                  href={detail.catalogueUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors hover:bg-muted"
                >
                  Catalogue entry
                  <ArrowUpRightIcon aria-hidden className="size-3.5" />
                </a>
                <a
                  href={`/api/math/${tile.id}`}
                  className="inline-flex h-9 items-center rounded-lg px-2 font-mono text-xs text-muted-foreground hover:text-foreground"
                >
                  json
                </a>
              </div>
            ) : null}

            {related.length ? (
              <Section title="Related results">
                <ul className="grid gap-1.5 sm:grid-cols-2">
                  {related.map((r) => (
                    <li key={r.id}>
                      <button
                        type="button"
                        onClick={() => onNavigate(r.id)}
                        className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] leading-snug transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span aria-hidden className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: accents[r.d] }} />
                        <span className="min-w-0">
                          <span className="line-clamp-2">{r.t}</span>
                          <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                            {r.id} · {SIG[r.s]}
                            {r.d !== tile.d ? ` · ${disciplines[r.d]}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </Section>
            ) : null}
          </div>
        </div>
      ) : null}
    </dialog>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-1.5 font-mono text-[11px] tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  )
}

function Skeleton({ lines }: { lines: number }) {
  return (
    <div aria-hidden className="space-y-2">
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className="h-3 animate-pulse rounded bg-muted motion-reduce:animate-none" style={{ width: `${92 - ((i * 17) % 30)}%` }} />
      ))}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:opacity-30"
    >
      {children}
    </button>
  )
}
