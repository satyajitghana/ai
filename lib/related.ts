import type { Article } from "@/lib/content"
import { getArticles } from "@/lib/content"

// The internal link plan for the article corpus, computed once at build time.
//
// Two jobs, one for readers and one for crawlers. Readers: an article that ends
// in nothing is a dead end — 36% of this corpus had no outbound link to another
// article. Crawlers: 48% had no *inbound* internal link at all, which is what an
// orphan page is. Orphans get crawled less and rank worse, and it lands hardest
// on the newest work, which has had least time to be linked to by hand.
//
// Lives here rather than in the component because it is a property of the whole
// graph, not of one page, and because `scripts/check-links.mts` asserts that
// property without pulling React in.

export const RELATED_LIMIT = 4

// Jaccard, so an article tagged with five things does not out-rank a tightly
// matched pair just by having more tags to collide on.
export function tagScore(a: readonly string[], b: readonly string[]): number {
  const B = new Set(b)
  let shared = 0
  for (const t of a) if (B.has(t)) shared++
  if (shared === 0) return 0
  return shared / (a.length + b.length - shared)
}

const PROSE_LINK = /\/articles\/([a-z0-9-]+)/g

export interface LinkPlan {
  /** slug → the slugs its "Related articles" block links to, in render order */
  related: Map<string, string[]>
  /** slug → inbound links from prose and from related blocks combined */
  inbound: Map<string, number>
  /** articles still reachable from nowhere; the build asserts this is empty */
  orphans: string[]
}

let CACHED: LinkPlan | null = null

export function linkPlan(): LinkPlan {
  if (CACHED) return CACHED

  const all = getArticles()
  const related = new Map<string, string[]>()
  const inbound = new Map<string, number>(all.map((a) => [a.slug, 0]))

  // Links already written by hand in the prose count toward coverage — an
  // article cited in a sentence is not an orphan and needs no help here.
  for (const a of all) {
    for (const m of a.body.matchAll(PROSE_LINK)) {
      const target = m[1]
      if (target !== a.slug && inbound.has(target)) {
        inbound.set(target, inbound.get(target)! + 1)
      }
    }
  }

  for (const self of all) {
    const ranked = all
      .filter((a) => a.slug !== self.slug)
      .map((a) => ({ a, s: tagScore(self.tags ?? [], a.tags ?? []) }))
      .filter((r) => r.s > 0)
      // tie-break by recency so the set stays fresh as the corpus grows
      .sort((x, y) => y.s - x.s || y.a.date.localeCompare(x.a.date))
      .slice(0, RELATED_LIMIT)
    related.set(
      self.slug,
      ranked.map((r) => r.a.slug)
    )
    for (const r of ranked) inbound.set(r.a.slug, inbound.get(r.a.slug)! + 1)
  }

  // Coverage pass. Tag ranking is per-page and coverage is global, so the
  // recency tie-break sends the same few recent hubs to the top of many lists
  // (the busiest picks up 34 inbound links) while a tail of 20 gets none. Place
  // each of those on the page it matches best. Sorted by slug and resolved with
  // explicit tie-breaks so the same corpus always produces the same plan — a
  // related list that reshuffled between builds would churn the HTML for
  // nothing.
  const orphans = all
    .filter((a) => inbound.get(a.slug) === 0)
    .sort((x, y) => x.slug.localeCompare(y.slug))

  for (const orphan of orphans) {
    let host: Article | null = null
    let bestScore = 0
    for (const cand of all) {
      if (cand.slug === orphan.slug) continue
      const list = related.get(cand.slug)!
      if (list.includes(orphan.slug)) continue
      const s = tagScore(orphan.tags ?? [], cand.tags ?? [])
      if (s <= 0) continue
      if (host === null || s > bestScore) {
        host = cand
        bestScore = s
        continue
      }
      if (s < bestScore) continue
      // Equal match: spread the load onto the shorter list, then by slug.
      const hostList = related.get(host.slug)!
      if (
        list.length < hostList.length ||
        (list.length === hostList.length && cand.slug < host.slug)
      ) {
        host = cand
      }
    }
    if (host) {
      related.get(host.slug)!.push(orphan.slug)
      inbound.set(orphan.slug, 1)
    }
  }

  CACHED = {
    related,
    inbound,
    // An article sharing no tag with anything else cannot be placed by this
    // method at all; the checker reports it so it gets a tag, not a shrug.
    orphans: all.filter((a) => inbound.get(a.slug) === 0).map((a) => a.slug),
  }
  return CACHED
}
