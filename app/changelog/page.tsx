import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { getChangelog } from "@/lib/changelog"

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What shipped, and when — generated from git history. Most entries were authored by the Claude crew.",
  alternates: { canonical: "/changelog" },
}

export default function ChangelogPage() {
  const entries = getChangelog()

  // Group consecutive entries by day so the log reads as dated releases.
  const groups: { date: string; items: typeof entries }[] = []
  for (const e of entries) {
    const last = groups[groups.length - 1]
    if (last && last.date === e.date) last.items.push(e)
    else groups.push({ date: e.date, items: [e] })
  }

  return (
    <PageShell
      title="Changelog"
      lede="What shipped, and when — straight from git history."
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No history available yet.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.date} className="grid gap-2 sm:grid-cols-[110px_1fr] sm:gap-6">
              <h2 className="h-fit font-mono text-xs text-muted-foreground tabular-nums sm:sticky sm:top-20">
                {g.date}
              </h2>
              <ul className="space-y-2.5">
                {g.items.map((entry) => (
                  <li key={entry.hash} className="flex items-baseline gap-3 leading-6">
                    <a
                      href={`https://github.com/satyajitghana/ai/commit/${entry.hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {entry.hash}
                    </a>
                    <span>{entry.subject}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="mt-12 border-t pt-6 font-mono text-xs text-muted-foreground">
        {entries.length} changes · every entry shipped as a PR, most authored by the Claude crew.
      </p>
    </PageShell>
  )
}
