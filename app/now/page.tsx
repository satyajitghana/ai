import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { now } from "@/data/now"

export const metadata: Metadata = {
  title: "Now",
  description: "What Satyajit Ghana is focused on right now.",
}

export default function NowPage() {
  return (
    <PageShell
      title="Now"
      lede="What I'm focused on at the moment."
      agentPath={{ json: "/api/now" }}
    >
      <p className="font-mono text-xs text-muted-foreground">
        updated {now.updated}
      </p>

      <ul className="mt-6 space-y-4">
        {now.items.map((item, i) => (
          <li key={i} className="flex gap-3 leading-7">
            <span className="font-mono text-xs text-muted-foreground select-none">
              ›
            </span>
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
