import { articleSignal, getArticles } from "@/lib/content"
import { articleApiFields } from "@/lib/content/signals"

export const dynamic = "force-static"

// Every article with its editorial metadata (rating, topic, kind, level,
// runsOn, licence) and what lib/content/signals.ts computes from it: facts,
// the 0–100 score, the percentile tier, its rank and the lens sort keys, so an
// agent can filter and order exactly as /articles does. Unrated articles carry
// nulls. `signal` is the older 1–5 level, kept for existing clients: derived
// from the tier when rated, else from the deprecated interest + helpful.
export function GET() {
  return Response.json(
    getArticles().map((a) => {
      const fields = articleApiFields(a)
      return { ...a, ...fields, signal: articleSignal(a, fields) }
    }),
  )
}
