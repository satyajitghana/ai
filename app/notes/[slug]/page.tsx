import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { PageShell } from "@/components/site/page-shell"
import { getNote, getNotes } from "@/lib/content"
import { resolveBacklinks, slugifyLink } from "@/lib/notes"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getNotes().map((note) => ({ slug: note.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const note = getNote(slug)
  if (!note) return {}
  return {
    title: note.title,
    description: `Note: ${note.title}`,
  }
}

// Split a line of text on [[wikilinks]] and render each link as a <Link>. A
// missing target still renders a link — the garden tolerates dangling edges.
function renderInline(text: string, keyPrefix: string) {
  const parts = text.split(/(\[\[[^\]]+?\]\])/g)
  return parts.map((part, i) => {
    const match = part.match(/^\[\[([^\]]+?)\]\]$/)
    if (!match) return <span key={`${keyPrefix}-${i}`}>{part}</span>
    const label = match[1].trim()
    const slug = slugifyLink(label)
    return (
      <Link
        key={`${keyPrefix}-${i}`}
        href={`/notes/${slug}`}
        className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
      >
        {label}
      </Link>
    )
  })
}

// Minimal markdown: "## " headings, "- " list items, blank-line-separated
// paragraphs. Enough for evergreen notes without an MDX pipeline.
function renderBody(body: string) {
  const blocks = body.trim().split(/\n{2,}/)
  return blocks.map((block, i) => {
    const trimmed = block.trim()

    if (trimmed.startsWith("## ")) {
      return (
        <h2
          key={i}
          className="font-heading mt-8 mb-3 text-xl font-semibold tracking-tight"
        >
          {renderInline(trimmed.slice(3), `h-${i}`)}
        </h2>
      )
    }

    const lines = trimmed.split("\n")
    if (lines.every((l) => l.trim().startsWith("- "))) {
      return (
        <ul key={i} className="mt-4 list-disc space-y-1 pl-5 leading-7">
          {lines.map((l, j) => (
            <li key={j}>{renderInline(l.trim().slice(2), `li-${i}-${j}`)}</li>
          ))}
        </ul>
      )
    }

    return (
      <p key={i} className="mt-4 leading-7">
        {renderInline(trimmed.replace(/\n/g, " "), `p-${i}`)}
      </p>
    )
  })
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const note = getNote(slug)
  if (!note) notFound()

  const backlinks = resolveBacklinks(getNotes()).get(slug) ?? []

  return (
    <PageShell agentPath={{ md: `/notes/${slug}.md`, json: "/api/notes" }}>
      <article>
        <header className="mb-8">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
            {note.title}
          </h1>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {note.date}
            {note.updated ? ` · updated ${note.updated}` : ""}
            {note.tags.length > 0
              ? ` · ${note.tags.map((t) => `#${t}`).join(" ")}`
              : ""}
          </p>
        </header>

        <div className="max-w-prose">{renderBody(note.body)}</div>
      </article>

      {backlinks.length > 0 ? (
        <section className="mt-16 border-t pt-6">
          <h2 className="font-mono mb-3 text-xs tracking-wide text-muted-foreground uppercase">
            Linked from
          </h2>
          <ul className="space-y-2">
            {backlinks.map((b) => (
              <li key={b.slug}>
                <Link
                  href={`/notes/${b.slug}`}
                  className="underline-offset-4 hover:underline"
                >
                  {b.title}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </PageShell>
  )
}
