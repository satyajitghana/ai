// Canonical absolute base URL — a fixed config constant for this site (used for
// metadataBase, JSON-LD, sitemap, llms.txt, feeds, and `.md`/share links so
// everything an agent sees is absolute). Change it here, not via env.
export const siteUrl = "https://ai.thesatyajit.com"

export function absoluteUrl(pathname: string): string {
  return new URL(pathname, siteUrl).toString()
}

export const SITE_NAME = "Satyajit Ghana"
export const HOME_TITLE = `${SITE_NAME} — Head of Engineering, AI & 3D Perception`
// ≤160 characters: the length a search result shows before cutting it
export const SITE_DESCRIPTION =
  "Satyajit Ghana, Head of Engineering at Inkers: deep learning, 3D perception and CUDA. Explainers on AI papers, a daily arXiv digest, projects and a resume."
