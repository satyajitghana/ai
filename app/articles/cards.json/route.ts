import { articleCards } from "../cards"

// The full /articles list for its search, filters, lenses and "Show more".
// The page itself ships only the first page of cards; this is fetched once
// per visit and cached at the edge, so the page stays small for every crawler
// and reader that never touches the controls.
export const dynamic = "force-static"

export function GET() {
  return Response.json(articleCards())
}
