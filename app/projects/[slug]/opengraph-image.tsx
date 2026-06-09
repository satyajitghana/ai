import { getProject, getProjects } from "@/lib/content"
import { ogContentType, ogSize, renderOgImage } from "@/lib/og"

export const size = ogSize
export const contentType = ogContentType
export const alt = "Project"
export const dynamicParams = false

export function generateStaticParams() {
  return getProjects().map((p) => ({ slug: p.slug }))
}

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const project = getProject(slug)
  return renderOgImage({
    kicker: "open projects/" + slug,
    title: project?.title ?? "Project",
    subtitle: project?.stack.slice(0, 4).join(" · "),
  })
}
