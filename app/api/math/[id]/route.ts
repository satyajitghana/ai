import { problem } from "@/lib/api-error"
import { mathResult, mathResults } from "@/lib/math-wall"

export const dynamic = "force-static"
export const dynamicParams = false

export function generateStaticParams() {
  return mathResults().map((r) => ({ id: r.id }))
}

// One family in full: the summary fields of /api/math plus our review notes
// (what the result means, caveats, what exactly is in Lean) and the release's
// own summary. The /math panel reads this when it opens.
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const r = mathResult(id)
  if (!r)
    return problem({
      code: "not_found",
      detail: `No openai/math result family with id "${id}".`,
      hint: "Ids are three digits, 001 to 372. List them at /api/math.",
      instance: `/api/math/${id}`,
    })
  return Response.json(r)
}
