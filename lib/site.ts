// Canonical absolute base URL — a fixed config constant for this site (used for
// metadataBase, JSON-LD, sitemap, llms.txt, feeds, and `.md`/share links so
// everything an agent sees is absolute). Change it here, not via env.
export const siteUrl = "https://ai.satyajit.si"

// Satyajit's one identity across his sites. satyajit.si (the portfolio) is his
// home page and defines the Person under this @id; this site describes the same
// Person and credits every article to it, so search and answer engines see one
// author across both sites instead of two people with the same name.
export const PERSON_URL = "https://satyajit.si"
export const PERSON_ID = `${PERSON_URL}/#person`

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteUrl).toString()
}

export const SITE_NAME = "Satyajit Ghana"
// Leads with what this site is about, not only the name: satyajit.si answers
// searches for Satyajit himself, and this home page targets the topics.
export const HOME_TITLE = `AI Articles & Paper Explainers — ${SITE_NAME}`
// ≤160 characters: the length a search result shows before cutting it
export const SITE_DESCRIPTION =
  "In-depth articles explaining AI papers, models and architectures, plus projects and notes, by Satyajit Ghana, Head of Engineering at Inkers."
