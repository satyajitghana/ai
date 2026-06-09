import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"

import { AgentChip } from "@/components/site/agent-chip"
import { PageShell } from "@/components/site/page-shell"
import { ShareButtons } from "@/components/site/share-buttons"
import { getProject, getProjects } from "@/lib/content"
import { JsonLd, softwareSourceCodeJsonLd } from "@/lib/jsonld"

// Unknown slugs still 404 via notFound() below; `true` (a static literal, as
// Next requires) lets newly-added content resolve in dev without a restart.
export const dynamicParams = true

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) return {}
  return {
    title: project.title,
    description: project.description,
    alternates: { canonical: `/projects/${slug}` },
  }
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = getProject(slug)
  if (!project) notFound()

  const { default: Project } = await import(`@/content/projects/${slug}.mdx`)

  return (
    <PageShell>
      <JsonLd data={softwareSourceCodeJsonLd(project)} />
      <article>
        <header className="mb-10">
          <div className="flex items-start justify-between gap-4">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
              {project.title}
            </h1>
            <AgentChip
              md={`/projects/${slug}.md`}
              json={`/api/projects`}
            />
          </div>
          <p className="mt-2 font-mono text-xs text-muted-foreground">
            {project.stack.join(" · ")}
          </p>
          <p className="mt-3 font-mono text-xs">
            {project.repo ? (
              <a
                href={project.repo}
                className="text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                repo ↗
              </a>
            ) : null}
            {project.demo ? (
              <a
                href={project.demo}
                className="ml-4 text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground"
              >
                demo ↗
              </a>
            ) : null}
          </p>
        </header>
        {project.cover ? (
          <div className="relative mb-10 aspect-[16/9] overflow-hidden rounded-md border bg-muted">
            <Image
              src={project.cover}
              alt={`${project.title} screenshot`}
              fill
              priority
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
            />
          </div>
        ) : null}
        <Project />
      </article>
      <ShareButtons
        path={`/projects/${slug}`}
        title={project.title}
        className="mt-12 border-t pt-6"
      />
    </PageShell>
  )
}
