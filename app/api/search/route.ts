import { problem } from "@/lib/api-error"
import { searchContent } from "@/lib/search"

// In-memory substring/tag search over the whole corpus. Dynamic (reads ?q=).
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get("q")?.trim()
  const limit = Math.min(Number(searchParams.get("limit") ?? 20), 50)

  if (!q) {
    return problem({
      code: "invalid_request",
      detail: "The required query parameter `q` is missing or empty.",
      hint: "Call /api/search?q=<terms>. Add &limit=<1-50> to cap results.",
      instance: "/api/search",
    })
  }

  const results = searchContent(q, limit)
  return Response.json({ query: q, count: results.length, results })
}
