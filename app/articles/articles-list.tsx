"use client"

import { useId, useMemo, useRef, useState } from "react"
import Link from "next/link"
import {
  FadersHorizontalIcon,
  MagnifyingGlassIcon,
  StarIcon,
  XIcon,
} from "@phosphor-icons/react/dist/ssr"

import { DotLine, HighlightList, SCORING_PATH, TierMark, type TierView } from "@/components/site/article-rating"
import {
  KINDS,
  LEVELS,
  RUNS_ON,
  TOPICS,
  type KindId,
  type LevelId,
  type RunsOnId,
  type TopicId,
  runsOnById,
  topicById,
} from "@/data/taxonomy"
import {
  type LensId,
  LENSES,
  type ScoredLensId,
  compareLens,
  tierBand,
} from "@/lib/content/rating"
import { useHydrated } from "@/lib/use-hydrated"
import { useUrlState } from "@/lib/use-url-state"
import { cn } from "@/lib/utils"

// The /articles list: lenses (sort orders that each answer a reader's
// question), topic chips, kind / level / hardware / featured filters and a
// search box, all persisted to the query string so a view is shareable.
//
// The server renders every article in the default lens so the whole corpus is
// in the HTML; once hydrated, the list shows a page at a time with "Show more".
// Scores, tiers, lens keys and highlights arrive precomputed
// (lib/content/signals.ts, lib/content/rating.ts) — nothing here does
// arithmetic that reaches the DOM. A card shows the tier as one mark and the
// highlights in words; the eight-question breakdown lives on the article page.

export type ArticleCard = {
  slug: string
  title: string
  description: string
  why: string | null
  date: string
  updated: string | null
  lastUpdated: string
  tags: string[]
  featured: boolean
  topic: TopicId | null
  kind: KindId | null
  level: LevelId | null
  runsOn: RunsOnId | null
  /** Plain-language highlights (lib/content/rating.ts `highlights`), at most two. */
  highlights: { key: string; text: string }[]
  score: number | null
  tier: TierView | null
  lenses: Record<ScoredLensId, number> | null
  readingTimeMins: number
  thumb: string | null
}

const STAR = "oklch(0.79 0.15 82)" // warm gold
const PAGE = 24
const TOPICS_SHOWN = 6

type State = {
  lens: LensId
  topic: TopicId | null
  kind: KindId | null
  level: LevelId | null
  hw: RunsOnId | null
  featured: boolean
  q: string
}

const oneOf = <T extends string>(ids: readonly { id: T }[], v: string | null): T | null =>
  v && ids.some((x) => x.id === v) ? (v as T) : null

// Pure, and returns defaults for an empty query string (the server snapshot).
// Newest is the default. Older links still work: `sort=new` is Newest, the
// other old sorts map to Must read, and `filter=featured` / `featured=1` set Featured.
function parseUrlState(sp: URLSearchParams): State {
  const sort = sp.get("sort")
  const lens =
    oneOf(LENSES, sp.get("lens")) ?? (sort && sort !== "new" ? "must-read" : "newest")
  return {
    lens,
    topic: oneOf(TOPICS, sp.get("topic")),
    kind: oneOf(KINDS, sp.get("kind")),
    level: oneOf(LEVELS, sp.get("level")),
    hw: oneOf(RUNS_ON, sp.get("hw")),
    featured: sp.get("featured") === "1" || sp.get("filter") === "featured",
    q: sp.get("q") ?? "",
  }
}

function writeState(sp: URLSearchParams, s: State) {
  for (const k of ["sort", "filter", "page", "featured", "lens", "topic", "kind", "level", "hw", "q"]) sp.delete(k)
  if (s.lens !== "newest") sp.set("lens", s.lens)
  if (s.topic) sp.set("topic", s.topic)
  if (s.kind) sp.set("kind", s.kind)
  if (s.level) sp.set("level", s.level)
  if (s.hw) sp.set("hw", s.hw)
  if (s.featured) sp.set("featured", "1")
  if (s.q) sp.set("q", s.q)
}

function fitsHardware(runsOn: RunsOnId | null, hw: RunsOnId | null): boolean {
  if (!hw) return true
  if (!runsOn) return false
  const want = runsOnById(hw)!
  const got = runsOnById(runsOn)!
  if (want.rank === null) return runsOn === hw
  return got.rank !== null && got.rank <= want.rank
}

export function ArticlesList({ articles }: { articles: ArticleCard[] }) {
  const [state, setParams] = useUrlState(parseUrlState)
  const hydrated = useHydrated()
  const [shown, setShown] = useState({ key: "", n: PAGE })
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [allTopics, setAllTopics] = useState(false)
  const topRef = useRef<HTMLDivElement>(null)
  const filtersId = useId()

  const set = (patch: Partial<State>) =>
    setParams((sp) => writeState(sp, { ...state, ...patch }))

  // Lower-cased search text per article, built once.
  const haystack = useMemo(
    () =>
      new Map(
        articles.map((a) => [
          a.slug,
          [a.title, a.description, a.why ?? "", a.tags.join(" "), a.topic ? topicById(a.topic)?.label : "", a.topic ?? "", a.kind ?? ""]
            .join(" ")
            .toLowerCase(),
        ]),
      ),
    [articles],
  )

  const topicCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const a of articles) if (a.topic) m.set(a.topic, (m.get(a.topic) ?? 0) + 1)
    return m
  }, [articles])
  const rated = articles.filter((a) => a.tier).length
  // Most-populated first; from sm up only the first TOPICS_SHOWN wrap into
  // view (plus the selected one) until "more" is pressed. A phone scrolls the
  // whole row instead.
  const topicOrder = TOPICS.filter((t) => topicCounts.get(t.id)).sort(
    (x, y) => topicCounts.get(y.id)! - topicCounts.get(x.id)! || x.label.localeCompare(y.label),
  )

  const terms = state.q.toLowerCase().split(/\s+/).filter(Boolean)
  const filtered = articles
    .filter(
      (a) =>
        (!state.topic || a.topic === state.topic) &&
        (!state.kind || a.kind === state.kind) &&
        (!state.level || a.level === state.level) &&
        fitsHardware(a.runsOn, state.hw) &&
        (!state.featured || a.featured) &&
        terms.every((t) => haystack.get(a.slug)!.includes(t)),
    )
    .sort(compareLens(state.lens))

  // "Start here": the three clearest rated pages in the chosen topic.
  const startHere = state.topic
    ? articles
        .filter((a) => a.topic === state.topic && a.lenses)
        .sort(compareLens("learn"))
        .slice(0, 3)
    : []

  const viewKey = JSON.stringify(state)
  const limit = shown.key === viewKey ? shown.n : PAGE
  // Before hydration (and with JS off) every match is rendered.
  const visible = hydrated ? filtered.slice(0, limit) : filtered

  const activeFilters = [state.kind, state.level, state.hw, state.featured || null].filter(Boolean).length
  const anyFilter = activeFilters > 0 || !!state.topic || !!state.q
  const clearAll = () => set({ topic: null, kind: null, level: null, hw: null, featured: false, q: "" })
  const lensInfo = LENSES.find((l) => l.id === state.lens)!
  const topic = state.topic ? topicById(state.topic) : null

  const pill = (active: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-full border px-3 font-mono text-xs transition-colors sm:min-h-8",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
      active
        ? "border-foreground/40 bg-foreground text-background"
        : "border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
    )

  const selectCls =
    "h-11 w-full min-w-0 cursor-pointer rounded-md border bg-background px-2 font-mono text-xs text-foreground sm:h-9 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"

  return (
    <div ref={topRef} className="scroll-mt-24">
      {/* Search */}
      <div className="relative">
        <MagnifyingGlassIcon
          size={16}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
        />
        <input
          type="search"
          value={state.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder={`Search ${articles.length} articles`}
          aria-label="Search articles by title, description, tag or topic"
          className="h-11 w-full rounded-lg border bg-background pr-10 pl-9 text-base placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm [&::-webkit-search-cancel-button]:hidden"
        />
        {state.q ? (
          <button
            type="button"
            onClick={() => set({ q: "" })}
            aria-label="Clear search"
            className="absolute top-0 right-0 flex h-11 w-11 cursor-pointer items-center justify-center text-muted-foreground hover:text-foreground"
          >
            <XIcon size={14} weight="bold" />
          </button>
        ) : null}
      </div>

      {/* Lenses: a sort order each, named for the question it answers. One
          segmented row; a phone scrolls it sideways rather than wrapping it
          into a block of boxes. */}
      <div className="-mx-6 mt-4 overflow-x-auto px-6 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <div role="group" aria-label="Sort by" className="inline-flex gap-0.5 rounded-full border bg-muted/40 p-1">
          {LENSES.map((l) => {
            const on = state.lens === l.id
            return (
              <button
                key={l.id}
                type="button"
                onClick={() => set({ lens: l.id })}
                aria-pressed={on}
                className={cn(
                  "inline-flex min-h-10 shrink-0 cursor-pointer items-center rounded-full px-3.5 text-[13px] whitespace-nowrap transition-colors sm:min-h-8",
                  "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-ring",
                  on
                    ? "bg-background font-medium text-foreground shadow-sm ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {l.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Topics: one scrolling row on a phone, wrapped on wider screens. */}
      {topicCounts.size ? (
        <div
          role="group"
          aria-label="Topic"
          className="-mx-6 mt-3 flex gap-1.5 overflow-x-auto px-6 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden"
        >
          <button type="button" onClick={() => set({ topic: null })} aria-pressed={!state.topic} className={pill(!state.topic)}>
            All topics
          </button>
          {topicOrder.map((t, i) => (
            <button
              key={t.id}
              type="button"
              onClick={() => set({ topic: state.topic === t.id ? null : t.id })}
              aria-pressed={state.topic === t.id}
              className={cn(
                pill(state.topic === t.id),
                !allTopics && i >= TOPICS_SHOWN && state.topic !== t.id && "sm:hidden",
              )}
            >
              {t.label}
              <span className="tabular-nums opacity-60">{topicCounts.get(t.id)}</span>
            </button>
          ))}
          {topicOrder.length > TOPICS_SHOWN ? (
            <button
              type="button"
              onClick={() => setAllTopics((v) => !v)}
              aria-expanded={allTopics}
              className="hidden min-h-8 cursor-pointer items-center px-2 font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground sm:inline-flex"
            >
              {allTopics ? "fewer" : `${topicOrder.length - TOPICS_SHOWN} more`}
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Filters: behind a toggle on a phone, always shown from sm up. */}
      <div className="mt-3 flex items-center gap-2 sm:hidden">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          aria-expanded={filtersOpen}
          aria-controls={filtersId}
          className={pill(false)}
        >
          <FadersHorizontalIcon size={14} aria-hidden="true" />
          Filters{activeFilters ? <span className="tabular-nums text-foreground">{` ${activeFilters}`}</span> : null}
        </button>
        {anyFilter ? (
          <button type="button" onClick={clearAll} className="min-h-11 cursor-pointer px-2 font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground">
            clear all
          </button>
        ) : null}
      </div>
      <div
        id={filtersId}
        className={cn(
          "mt-3 grid-cols-2 gap-2 sm:grid sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-center",
          filtersOpen ? "grid" : "hidden",
        )}
      >
        <select value={state.kind ?? ""} onChange={(e) => set({ kind: (e.target.value || null) as KindId | null })} aria-label="Kind" className={selectCls}>
          <option value="">Any kind</option>
          {KINDS.map((k) => (
            <option key={k.id} value={k.id}>{k.label}</option>
          ))}
        </select>
        <select value={state.level ?? ""} onChange={(e) => set({ level: (e.target.value || null) as LevelId | null })} aria-label="Level" className={selectCls}>
          <option value="">Any level</option>
          {LEVELS.map((l) => (
            <option key={l.id} value={l.id}>{l.label}</option>
          ))}
        </select>
        <select
          value={state.hw ?? ""}
          onChange={(e) => set({ hw: (e.target.value || null) as RunsOnId | null })}
          aria-label="Runs on: my hardware or less"
          className={cn(selectCls, "col-span-2 sm:col-span-1")}
        >
          <option value="">Runs on: anything</option>
          {RUNS_ON.filter((r) => r.id !== "none").map((r) => (
            <option key={r.id} value={r.id}>
              {r.rank === null ? `Runs on: ${r.label}` : `Runs on ≤ ${r.label}`}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => set({ featured: !state.featured })}
          aria-pressed={state.featured}
          className={cn(pill(state.featured), "col-span-2 sm:col-span-1")}
        >
          <StarIcon size={13} weight="fill" style={{ color: state.featured ? undefined : STAR }} aria-hidden="true" />
          Featured
        </button>
      </div>

      {/* Start here, for the chosen topic */}
      {topic && startHere.length ? (
        <section aria-labelledby="start-here" className="mt-8 rounded-xl border bg-muted/30 p-4 sm:p-5">
          <h2 id="start-here" className="font-mono text-xs tracking-wide text-muted-foreground">
            start here · <span className="text-foreground">{topic.label}</span>
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">{topic.blurb}</p>
          <ol className="mt-4 grid gap-3 sm:grid-cols-3">
            {startHere.map((a, i) => (
              <li key={a.slug} className="group relative grid grid-cols-[6rem_minmax(0,1fr)] items-center gap-3 sm:block">
                <Thumb src={a.thumb} className="rounded-md" />
                <Link
                  href={`/articles/${a.slug}`}
                  className="block text-sm sm:mt-2 leading-snug font-medium underline-offset-4 group-hover:underline after:absolute after:inset-0 after:rounded-md focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-ring"
                >
                  <span className="mr-1 font-mono text-xs text-muted-foreground">{i + 1}.</span>
                  {a.title}
                </Link>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {/* What this view is */}
      <div className="mt-8 mb-5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b pb-3">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{lensInfo.label}.</span>{" "}
          {lensInfo.blurb}
          {state.lens !== "newest" && rated < articles.length ? (
            <span className="text-muted-foreground/80"> Unrated articles follow, newest first.</span>
          ) : null}
        </p>
        <p className="font-mono text-xs text-muted-foreground tabular-nums" aria-live="polite">
          {filtered.length === articles.length ? `${articles.length} articles` : `${filtered.length} of ${articles.length}`}
          {anyFilter ? (
            <button type="button" onClick={clearAll} className="ml-2 hidden cursor-pointer underline underline-offset-4 hover:text-foreground sm:inline">
              clear
            </button>
          ) : null}
        </p>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center">
          <p className="text-muted-foreground">Nothing matches that combination.</p>
          <button type="button" onClick={clearAll} className={cn(pill(false), "mt-4")}>
            Clear filters and search
          </button>
        </div>
      ) : (
        <ul className="divide-y">
          {visible.map((a) => (
            <ArticleRow key={a.slug} a={a} showDate={state.lens === "newest" || state.lens === "new"} />
          ))}
        </ul>
      )}

      {hydrated && filtered.length > visible.length ? (
        <div className="mt-8 flex justify-center">
          <button
            type="button"
            onClick={() => setShown({ key: viewKey, n: limit + PAGE })}
            className={cn(pill(false), "px-5")}
          >
            Show {Math.min(PAGE, filtered.length - visible.length)} more
            <span className="tabular-nums opacity-60">{` · ${filtered.length - visible.length} left`}</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}

function Thumb({ src, className }: { src: string | null; className?: string }) {
  return (
    <div className={cn("aspect-[40/21] w-full overflow-hidden border bg-muted", className)}>
      {src ? (
        // Decorative: the title beside it names the article, and an alt that
        // repeated it would make every card read twice to a screen reader.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          width={1200}
          height={630}
          loading="lazy"
          decoding="async"
          className="block h-full w-full object-cover"
        />
      ) : null}
    </div>
  )
}

function ArticleRow({ a, showDate }: { a: ArticleCard; showDate: boolean }) {
  const topic = a.topic ? topicById(a.topic) : null
  const blurb = a.why ?? a.description
  const band = a.tier ? tierBand(a.tier.id) : null

  return (
    <li className="group relative grid grid-cols-[7rem_minmax(0,1fr)] gap-x-3 gap-y-2 py-5 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:gap-x-5">
      <Thumb src={a.thumb} className="col-start-1 row-start-1 self-start rounded-md transition-opacity group-hover:opacity-90 sm:row-span-3" />

      <h2 className="col-start-2 row-start-1 self-center font-heading text-base leading-snug font-semibold text-balance sm:self-start sm:text-lg">
        {/* Stretched link: the whole row is the target; the tier mark sits
            above it and links to how scoring works. */}
        <Link
          href={`/articles/${a.slug}`}
          className="underline-offset-4 group-hover:underline after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:rounded-lg focus-visible:after:outline-2 focus-visible:after:outline-ring"
        >
          {a.title}
        </Link>
        {a.featured ? (
          <StarIcon size={14} weight="fill" aria-label="Featured" className="ml-1.5 inline-block align-[-0.1em]" style={{ color: STAR }} />
        ) : null}
      </h2>

      <p className={cn("col-span-2 line-clamp-3 text-sm leading-6 text-muted-foreground sm:col-span-1 sm:col-start-2 sm:line-clamp-2", a.why && "text-foreground/80")}>
        {blurb}
      </p>

      <div className="col-span-2 flex flex-wrap items-start gap-x-3 gap-y-1.5 text-xs leading-5 text-muted-foreground sm:col-span-1 sm:col-start-2">
        {a.tier && band ? (
          <Link
            href={`${SCORING_PATH}#tiers`}
            aria-label={`${a.tier.label}: ${band.long}. How articles are scored`}
            className="group/tier relative z-10 rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <TierMark tier={a.tier} />
            <span
              aria-hidden="true"
              className="pointer-events-none absolute bottom-full left-0 mb-1.5 hidden rounded-md bg-foreground px-2 py-1 text-[11px] whitespace-nowrap text-background shadow-md group-hover/tier:block group-focus-visible/tier:block"
            >
              {band.short} of rated articles
            </span>
          </Link>
        ) : null}
        <HighlightList items={a.highlights} className="min-w-0 flex-1" itemClassName="text-foreground/75" />
        <DotLine
          className="basis-full font-mono text-[11px]"
          parts={[showDate ? a.date : null, `${a.readingTimeMins} min`, topic?.label]}
        />
      </div>
    </li>
  )
}
