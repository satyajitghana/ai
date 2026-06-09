// Canonical absolute base URL — a fixed config constant for this site (used for
// metadataBase, JSON-LD, sitemap, llms.txt, feeds, and `.md`/share links so
// everything an agent sees is absolute). Change it here, not via env.
export const siteUrl = "https://ai.thesatyajit.com"

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteUrl).toString()
}
