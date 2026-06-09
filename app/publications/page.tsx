import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { publications, scholarUrl } from "@/data/publications"
import { JsonLd, scholarlyArticleJsonLd } from "@/lib/jsonld"

export const metadata: Metadata = {
  title: "Publications",
  description:
    "Peer-reviewed publications by Satyajit Ghana — augmented reality, machine learning, and computer vision.",
}

export default function PublicationsPage() {
  return (
    <PageShell
      title="Publications"
      lede="Peer-reviewed work."
      agentPath={{ json: "/api/publications" }}
    >
      {publications.map((pub) => (
        <JsonLd key={pub.doi} data={scholarlyArticleJsonLd(pub)} />
      ))}
      <ul className="space-y-6">
        {publications.map((pub) => (
          <li key={pub.doi} className="rounded-md border p-5">
            <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
              {pub.title}
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {pub.authors.join(", ")}
            </p>
            <p className="mt-2 font-mono text-xs text-muted-foreground">
              {pub.journal} · {pub.volume}({pub.issue}):{pub.pages} · {pub.year}
            </p>
            <p className="mt-3 font-mono text-xs">
              <a
                href={pub.url}
                className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
              >
                doi:{pub.doi} ↗
              </a>
            </p>
          </li>
        ))}
      </ul>

      <p className="mt-10 font-mono text-xs text-muted-foreground">
        full list ·{" "}
        <a
          href={scholarUrl}
          className="text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
        >
          Google Scholar ↗
        </a>
      </p>
    </PageShell>
  )
}
