import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { reading, type ReadingItem } from "@/data/reading"

export const metadata: Metadata = {
  title: "Reading",
  description: "Papers and books Satyajit Ghana is reading, has read, or has queued.",
}

const STATUS_ORDER: ReadingItem["status"][] = ["reading", "queued", "read"]
const STATUS_LABEL: Record<ReadingItem["status"], string> = {
  reading: "reading",
  queued: "queued",
  read: "read",
}

export default function ReadingPage() {
  return (
    <PageShell
      title="Reading"
      lede="Papers and books in the queue, in progress, and finished."
      agentPath={{ json: "/api/reading" }}
    >
      <ul className="space-y-6">
        {[...reading]
          .sort(
            (a, b) =>
              STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
          )
          .map((item, i) => (
            <li key={i}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium underline-offset-4">
                  {item.url ? (
                    <a href={item.url} className="hover:underline">
                      {item.title}
                    </a>
                  ) : (
                    item.title
                  )}
                </span>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {item.type} · {STATUS_LABEL[item.status]}
                </span>
              </div>
              {item.author ? (
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.author}
                </p>
              ) : null}
              {item.note ? (
                <p className="mt-1 text-sm leading-6 text-muted-foreground">
                  {item.note}
                </p>
              ) : null}
            </li>
          ))}
      </ul>
    </PageShell>
  )
}
