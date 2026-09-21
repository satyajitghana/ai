// Assert the article corpus has no orphan pages, and report the shape of the
// internal link graph.
//
// An orphan is a page nothing links to. Crawlers reach it only through the
// sitemap, which is the weakest signal there is, and the problem lands hardest
// on the newest work. `lib/related.ts` closes the gap automatically — this
// checks that it actually did, and fails if an article ends up unreachable
// (which can only happen when it shares no tag with anything else in the
// corpus, i.e. it needs a tag, not a shrug).
import { getArticles } from "../lib/content/index"
import { linkPlan } from "../lib/related"

function main() {
  const all = getArticles()
  const { related, inbound, orphans } = linkPlan()

  if (orphans.length) {
    console.error(
      `\n✖ ${orphans.length} article(s) have no inbound internal link.\n` +
        `  Each shares no tag with any other article, so tag overlap cannot\n` +
        `  place it. Add a tag it has in common with the rest of the corpus,\n` +
        `  or link it from the prose of a related piece.\n`,
    )
    for (const s of orphans) console.error(`  content/articles/${s}.mdx`)
    console.error("")
    process.exit(1)
  }

  const degrees = [...inbound.values()].sort((a, b) => a - b)
  const median = degrees[Math.floor(degrees.length / 2)]
  const dead = all.filter((a) => (related.get(a.slug) ?? []).length === 0)

  console.log(
    `✓ links OK — ${all.length} articles, 0 orphans, ` +
      `in-degree min ${degrees[0]} / median ${median} / max ${degrees[degrees.length - 1]}` +
      (dead.length ? `, ${dead.length} with no related block` : ""),
  )
}

main()
