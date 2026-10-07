import { mathCounts, mathResults, MATH_ARTICLE, MATH_COMMIT, MATH_REPO, summarize } from "@/lib/math-wall"
import { absoluteUrl } from "@/lib/site"

export const dynamic = "force-static"

// Agent-readable roster of /math: every openai/math result family with our
// grades (significance, kind, Lean status), the claim as we read it, our
// verdict line, manuscript links pinned to a commit, and its video (`reel`) if
// one has been rendered. The review prose for one family is at `detail`.
export function GET() {
  return Response.json({
    about:
      "AI breakthroughs in mathematics: a short narrated video (field `reel`, with WebVTT captions) for each of the 372 result families of OpenAI's openai/math release, results produced or claimed by AI systems. Every entry is a CLAIM from an unrefereed release; significance, kind and verdict are our reading, Lean status is what the release's own docs say (not re-run).",
    page: absoluteUrl("/math"),
    article: absoluteUrl(MATH_ARTICLE),
    repository: MATH_REPO,
    commit: MATH_COMMIT,
    counts: mathCounts(),
    results: mathResults().map(summarize),
  })
}
