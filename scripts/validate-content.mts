// Loud content validation: load every MDX file through the Zod-backed content
// layer. Any malformed frontmatter throws here, failing `pnpm validate` and CI.
// This is the safety net that lets Claude agents edit content without breaking the site.
import {
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

  // Slug uniqueness within each kind.
  for (const [kind, items] of [
    ["blog", blog],
    ["articles", articles],
    ["logs", logs],
    ["projects", projects],
    ["arxiv", arxiv],
    ["snippets", snippets],
    ["notes", notes],
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

  console.log(
    `✓ content valid — ${blog.length} blog, ${articles.length} articles, ${logs.length} logs, ${projects.length} projects, ${arxiv.length} arxiv digests, ${snippets.length} snippets, ${notes.length} notes`
  )
}

main()
