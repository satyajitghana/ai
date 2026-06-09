import { getGitHubStats } from "@/lib/github"

// Static + hourly ISR: serves the seed instantly with no token, live data when
// GITHUB_TOKEN exists (the underlying fetch is tagged "github" for revalidation).
export const revalidate = 3600

export async function GET() {
  return Response.json(await getGitHubStats())
}
