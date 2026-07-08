import { CopyButton } from "@/components/site/copy-button"
import { profile } from "@/data/profile"
import { siteUrl } from "@/lib/site"

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
]

// "Cite this article" — a scholarly footer rendered on every article. Everything
// is derived from the article's own frontmatter (title, slug, date) plus the
// site author/URL, so it needs no per-article data and covers every article for
// free. Citation points at our explainer, not the source paper.
export function Citation({
  title,
  slug,
  date,
}: {
  title: string
  slug: string
  date: string
}) {
  const [year, month] = date.split("-")
  const monthName = MONTHS[Number(month) - 1] ?? ""
  const url = `${siteUrl}/articles/${slug}`
  // BibTeX cite keys must be alphanumeric — strip the slug's separators.
  const key = `${profile.name.split(" ").pop()?.toLowerCase()}${year}${slug.replace(/[^a-z0-9]/gi, "")}`

  const reference = `${profile.name}, "${title}", ${siteUrl.replace(/^https?:\/\//, "")}, ${monthName} ${year}.`

  const bibtex = `@misc{${key},
  author = {${profile.name}},
  title  = {${title}},
  url    = {${url}},
  year   = {${year}}
}`

  return (
    <section className="mt-12 border-t pt-6" aria-label="Citation">
      <h2 className="font-heading text-sm font-semibold tracking-tight">
        Cite this article
      </h2>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        For attribution, please use the following reference or BibTeX:
      </p>
      <p className="mt-3 text-sm leading-6">{reference}</p>
      <div className="mt-4 overflow-hidden rounded-lg border bg-muted/30">
        <div className="flex items-center justify-between border-b px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
          <span>bibtex</span>
          <CopyButton text={bibtex} label="copy BibTeX" />
        </div>
        <pre className="overflow-x-auto p-3 font-mono text-xs leading-5">
          <code>{bibtex}</code>
        </pre>
      </div>
    </section>
  )
}
