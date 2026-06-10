import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getArxivDigests } from "@/lib/content"

export const metadata: Metadata = {
  title: "arXiv digest",
  description:
    "A personalized daily arXiv digest — new papers in CV, 3D, and ML, ranked against my interests, each with a short take.",
  alternates: { canonical: "/arxiv" },
}

export default function Page() {
  const digests = getArxivDigests()

  return (
    <PageShell
      title="arXiv"
      lede="A personalized daily arXiv digest — new papers ranked against my interests by the paper-scout agent, each with a short take. Links only; read them on arXiv."
      agentPath={{ json: "/api/arxiv" }}
    >
      <ul className="space-y-6" data-stagger>
        {digests.map((d) => {
          const standout = d.papers.find((p) => p.standout)
          return (
            <li key={d.slug}>
              <Link href={`/arxiv/${d.slug}`} className="group block">
                <div className="flex items-baseline justify-between gap-4">
                  <h2 className="font-heading text-lg font-semibold underline-offset-4 group-hover:underline">
                    {d.date}
                  </h2>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {d.papers.length} papers
                    {standout ? " · ★" : ""}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">
                  {standout
                    ? `★ ${standout.title}`
                    : d.papers.map((p) => p.title).join(" · ")}
                </p>
              </Link>
            </li>
          )
        })}
      </ul>
    </PageShell>
  )
}
