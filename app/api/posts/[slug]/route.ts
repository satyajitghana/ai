import { problem } from "@/lib/api-error"
import { getBlogPosts, getLogs } from "@/lib/content"

export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  return [
    ...getBlogPosts().map((p) => ({ slug: p.slug })),
    ...getLogs().map((l) => ({ slug: l.slug })),
  ]
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const post =
    getBlogPosts().find((p) => p.slug === slug) ??
    getLogs().find((l) => l.slug === slug)
  if (!post)
    return problem({
      code: "not_found",
      detail: `No blog post or log with slug "${slug}".`,
      hint: "List every slug at /api/posts, or read the index at /llms.txt.",
      instance: `/api/posts/${slug}`,
    })
  return Response.json(post)
}
