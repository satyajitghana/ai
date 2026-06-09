import { searchContent } from "@/lib/search"

// In-memory substring/tag search over the whole corpus. Dynamic (reads ?q=).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50)

  if (!q) {
    return Response.json({ error: "missing ?q=" }, { status: 400 })
  }

  const results = searchContent(q, limit)
  return Response.json({ query: q, count: results.length, results })
}
