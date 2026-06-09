import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { getChangelog } from "@/lib/changelog"

export const metadata: Metadata = {
  title: "Changelog",
  description:
    "What shipped, and when — generated from git history. Most entries were authored by the Claude crew.",
}

export default function ChangelogPage() {
  const entries = getChangelog()

  return (
    <PageShell
      title="Changelog"
      lede="What shipped, and when — straight from git history."
    >
      {entries.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No history available yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.hash}
              className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3"
            >
              <span className="shrink-0 font-mono text-xs text-muted-foreground">
                {entry.hash} · {entry.date} —
              </span>
              <span className="leading-6">{entry.subject}</span>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-12 border-t pt-6 font-mono text-xs text-muted-foreground">
        every entry above was shipped as a PR; most were authored by the Claude
        crew.
      </p>
    </PageShell>
  )
}
