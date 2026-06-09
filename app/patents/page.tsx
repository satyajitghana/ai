import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { patents } from "@/data/patents"

export const metadata: Metadata = {
  title: "Patents",
  description:
    "USPTO patent applications by Satyajit Ghana — structural-defect analysis and data-acquisition systems for industrial AI.",
}

export default function PatentsPage() {
  return (
    <PageShell
      title="Patents"
      lede="Filed with the USPTO, currently pending examination."
      agentPath={{ json: "/api/patents" }}
    >
      <ul className="space-y-6">
        {patents.map((patent) => (
          <li key={patent.applicationNumber} className="rounded-md border p-5">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-heading text-lg leading-snug font-semibold text-balance">
                {patent.title}
              </h2>
              <span className="shrink-0 rounded border px-2 py-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                Patent Pending
              </span>
            </div>

            <dl className="mt-4 space-y-1 font-mono text-xs text-muted-foreground">
              <div>
                <span className="text-foreground">US app no.</span>{" "}
                {patent.applicationNumber}
              </div>
              <div>
                <span className="text-foreground">filed</span>{" "}
                {patent.filingDate}
              </div>
              <div>
                <span className="text-foreground">priority</span>{" "}
                {patent.priority.country} {patent.priority.number} (
                {patent.priority.date})
              </div>
              <div>
                <span className="text-foreground">claims</span>{" "}
                {patent.claims.total} ({patent.claims.independent} independent)
              </div>
            </dl>

            <p className="mt-3 text-sm leading-6 text-muted-foreground">
              {patent.inventors.join(", ")}
            </p>
            <p className="mt-1 text-sm leading-6 text-muted-foreground">
              Assignee: {patent.assignee}
            </p>
          </li>
        ))}
      </ul>
    </PageShell>
  )
}
