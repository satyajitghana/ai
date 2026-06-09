import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { getLogs } from "@/lib/content"

export const metadata: Metadata = {
  title: "Logs",
  description: "Daily build logs — what I shipped, learned, and broke.",
  alternates: { canonical: "/logs" },
}

export default function Page() {
  const logs = getLogs()

  return (
    <PageShell
      title="Logs"
      lede="Daily build logs — what I shipped, learned, and broke. Mostly written by the crew, reviewed by me."
      agentPath={{ json: "/api/posts?type=logs" }}
    >
      <ul className="space-y-5">
        {logs.map((l) => (
          <li key={l.slug}>
            <Link href={`/logs/${l.slug}`} className="group block">
              <div className="flex items-baseline gap-4">
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {l.date}
                </span>
                <span className="underline-offset-4 group-hover:underline">
                  {l.title ?? l.slug.replace(/^\d{4}-\d{2}-\d{2}-/, "")}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
