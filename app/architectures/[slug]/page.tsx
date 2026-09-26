import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowUpRightIcon } from "@phosphor-icons/react/dist/ssr"

import { FAMILY_LABEL } from "@/components/architectures/families"
import { ArchDiagram } from "@/components/architectures/registry"
import { AgentChip } from "@/components/site/agent-chip"
import { ArticleFilm } from "@/components/site/article-film"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { architectures } from "@/data/architectures"
import { getArchitectureDoc, getArchitectureDocs, getArticle } from "@/lib/content"
import { archFilmKey, getFilm } from "@/lib/films"
import { architectureJsonLd, breadcrumbJsonLd, JsonLd } from "@/lib/jsonld"
import { isAbsolute } from "@/lib/media"
import { absoluteUrl } from "@/lib/site"
import { getThumb } from "@/lib/thumbs"

// One architecture from the /architectures gallery, explained in full: its
// entry in data/architectures.ts (name, family, year, tags, paper, related
// article), its explainer film or thumbnail, its registry diagram, and the
// long-form doc at content/architectures/<slug>.mdx. A page exists only for an
// entry that has a doc; validate-content refuses a doc whose slug is not an
// entry.

// MUST stay false. This route's body does a template-literal dynamic import
// (`@/content/architectures/${slug}.mdx`), so the bundler cannot know which doc
// is needed and pulls every one of them — plus everything they import — into
// this route's server bundle. With dynamicParams = true that whole bundle has
// to ship as a runtime function able to render an arbitrary slug, which is how
// /articles/[slug] reached 266 MB against Vercel's 250 MB function limit and
// failed a deploy. With it false, generateStaticParams below prerenders every
// slug at build time, unknown slugs get Next's static 404, and no function is
// emitted at all. Dev is unaffected: `next dev` compiles routes on demand and
// does not enforce dynamicParams.
export const dynamicParams = false

export function generateStaticParams() {
  return getArchitectureDocs().map((d) => ({ slug: d.slug }))
}

const entryOf = (slug: string) => architectures.find((a) => a.slug === slug)

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const doc = getArchitectureDoc(slug)
  const arch = entryOf(slug)
  if (!doc || !arch) return {}
  const film = getFilm(archFilmKey(slug))
  return {
    title: doc.title,
    description: doc.description,
    alternates: {
      canonical: `/architectures/${slug}`,
      types: { "text/markdown": `/architectures/${slug}.md` },
    },
    openGraph: {
      type: "article",
      publishedTime: doc.date,
      modifiedTime: doc.lastUpdated,
      tags: [...new Set([...arch.tags, ...doc.tags])],
      // Discord, Slack and friends play an og:video inline when a link is shared.
      // Absolute: metadataBase resolves og:image URLs but not og:video ones.
      ...(film ? { videos: [{ url: isAbsolute(film.src) ? film.src : absoluteUrl(film.src), type: "video/mp4", width: film.width, height: film.height }] } : {}),
    },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const doc = getArchitectureDoc(slug)
  const arch = entryOf(slug)
  if (!doc || !arch) notFound()

  const { default: Doc } = await import(`@/content/architectures/${slug}.mdx`)
  // Films and thumbnails come from the committed manifests, never from public/
  // (lib/films.ts): an fs read there would drag the directory into the trace.
  const film = getFilm(archFilmKey(slug))
  const thumb = getThumb(archFilmKey(slug))
  const related = arch.article ? getArticle(arch.article) : undefined
  const tags = [...new Set([...arch.tags, ...doc.tags])]

  return (
    <PageShell>
      <JsonLd data={architectureJsonLd(doc, arch)} />
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Architectures", path: "/architectures" },
          { name: arch.name, path: `/architectures/${slug}` },
        ])}
      />
      <article>
        <header className="mb-10">
          <p className="mb-3 font-mono text-xs text-muted-foreground">
            <Link href="/architectures" className="hover:text-foreground">
              architectures
            </Link>
            {" / "}
            <Link
              href={`/architectures?family=${arch.family}`}
              className="hover:text-foreground"
            >
              {(FAMILY_LABEL[arch.family] ?? arch.family).toLowerCase()}
            </Link>
          </p>
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
              {doc.title}
            </h1>
            <AgentChip md={`/architectures/${slug}.md`} json="/api/architectures" />
          </div>
          <p className="mt-3 font-mono text-xs text-muted-foreground">
            <span className="text-foreground/80">{arch.name}</span> · {arch.year} ·{" "}
            {FAMILY_LABEL[arch.family] ?? arch.family} · {doc.readingTimeMins} min
          </p>
          {tags.length ? (
            <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Tags">
              {tags.map((t) => (
                <li
                  key={t}
                  className="rounded border px-1.5 py-0.5 font-mono text-[10px] tracking-wide text-muted-foreground"
                >
                  {t}
                </li>
              ))}
            </ul>
          ) : null}
          {film ? (
            <ArticleFilm film={film} title={doc.title} source="page" />
          ) : thumb ? (
            // No film yet: the thumbnail painted from the storyboard is the
            // cover. Decorative — the prose below carries its content.
            <div className="mt-8 overflow-hidden rounded-xl border bg-muted shadow-sm ring-1 ring-black/5 dark:ring-white/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={thumb.src}
                alt=""
                width={thumb.width}
                height={thumb.height}
                className="block h-auto w-full"
                decoding="async"
                fetchPriority="high"
              />
            </div>
          ) : null}
        </header>
        {/* the gallery's vetted diagram of this architecture */}
        <ArchDiagram slug={slug} />
        <Doc />
      </article>
      {arch.paper || related ? (
        <nav aria-labelledby="sources-heading" className="mt-16 border-t pt-8">
          <h2
            id="sources-heading"
            className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
          >
            Paper and related reading
          </h2>
          <ul className="mt-4 space-y-4">
            {arch.paper ? (
              <li>
                <a
                  href={arch.paper}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 font-heading text-lg font-semibold tracking-tight underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
                >
                  The paper <ArrowUpRightIcon size={14} weight="bold" aria-hidden="true" />
                </a>
                <p className="mt-1 font-mono text-xs break-all text-muted-foreground">
                  {arch.paper}
                </p>
              </li>
            ) : null}
            {related ? (
              <li>
                <Link
                  href={`/articles/${related.slug}`}
                  className="font-heading text-lg font-semibold tracking-tight underline decoration-foreground/25 underline-offset-4 hover:decoration-foreground"
                >
                  {related.title}
                </Link>
                <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                  {related.description}
                </p>
              </li>
            ) : null}
          </ul>
        </nav>
      ) : null}
      <ShareButtons
        path={`/architectures/${slug}`}
        title={doc.title}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}
