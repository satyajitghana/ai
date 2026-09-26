// Loud content validation: load every MDX file through the Zod-backed content
// layer. Any malformed frontmatter throws here, failing `pnpm validate` and CI.
// This is the safety net that lets Claude agents edit content without breaking the site.
import { architectures } from "../data/architectures"
import {
  getArchitectureDocs,
  getArticles,
  getArxivDigests,
  getBlogPosts,
  getLogs,
  getNotes,
  getProjects,
  getSnippets,
} from "../lib/content/index"

function main() {
  const blog = getBlogPosts({ includeDrafts: true })
  const articles = getArticles({ includeDrafts: true })
  const logs = getLogs()
  const projects = getProjects()
  const arxiv = getArxivDigests()
  const snippets = getSnippets()
  const notes = getNotes()
  const archDocs = getArchitectureDocs()

  // Slug uniqueness within each kind.
  for (const [kind, items] of [
    ["blog", blog],
    ["articles", articles],
    ["logs", logs],
    ["projects", projects],
    ["arxiv", arxiv],
    ["snippets", snippets],
    ["notes", notes],
    ["architectures", archDocs],
  ] as const) {
    const slugs = items.map((i) => i.slug)
    const dupes = slugs.filter((s, i) => slugs.indexOf(s) !== i)
    if (dupes.length) {
      throw new Error(`Duplicate ${kind} slugs: ${[...new Set(dupes)].join(", ")}`)
    }
  }

  // arXiv digests: slug must equal the digest date (file is <YYYY-MM-DD>.mdx).
  for (const d of arxiv) {
    if (d.slug !== d.date) {
      throw new Error(
        `arXiv digest slug "${d.slug}" must equal its date "${d.date}"`
      )
    }
  }

  // Architecture docs: the file name is the slug of an entry in
  // data/architectures.ts, which the page reads for its name, family, year,
  // tags, paper and diagram. A doc for no entry would have no page to live on.
  const archSlugs = new Set(architectures.map((a) => a.slug))
  for (const d of archDocs) {
    if (!archSlugs.has(d.slug)) {
      throw new Error(
        `content/architectures/${d.slug}.mdx: "${d.slug}" is not a slug in data/architectures.ts (${[...archSlugs].join(", ")})`
      )
    }
  }

  console.log(
    `✓ content valid — ${blog.length} blog, ${articles.length} articles, ${archDocs.length} architecture docs, ${logs.length} logs, ${projects.length} projects, ${arxiv.length} arxiv digests, ${snippets.length} snippets, ${notes.length} notes`
  )
}

main()
