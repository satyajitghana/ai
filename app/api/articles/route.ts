import { articleSignal, getArticles } from "@/lib/content"

export const dynamic = "force-static"

// Each article carries its `interest`/`helpful` frontmatter; expose the derived
// signal level alongside so agents can sort/filter the same way the UI does.
export function GET() {
  return Response.json(
    getArticles().map((a) => ({ ...a, signal: articleSignal(a) })),
  )
}
