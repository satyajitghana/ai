import { getArxivDigests, paperLinks } from "@/lib/content"

export const dynamic = "force-static"

export function GET() {
  return Response.json(
    getArxivDigests().map((d) => ({
      ...d,
      papers: d.papers.map((p) => ({ ...p, links: paperLinks(p.arxivId) })),
    }))
  )
}
