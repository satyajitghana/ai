import { revalidateTag } from "next/cache"

// On-demand bust of the GitHub stats cache (the live fetch is tagged "github").
// Use from a Vercel Cron or manually. If REVALIDATE_SECRET is set it is
// required; in no-key mode the data is the static seed anyway, so this is open.
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET
  if (secret && req.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ error: "unauthorized" }, { status: 401 })
  }

  // Next 16: the second argument ("profile") is required.
  revalidateTag("github", "max")
  return Response.json({ revalidated: "github", at: new Date().toISOString() })
}
