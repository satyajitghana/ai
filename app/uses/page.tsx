import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { uses } from "@/data/uses"

export const metadata: Metadata = {
  title: "Uses",
  description: "The hardware, editor, terminal, and stack Satyajit Ghana uses.",
}

export default function UsesPage() {
  return (
    <PageShell
      title="Uses"
      lede="The gear and software I reach for."
      agentPath={{ json: "/api/uses" }}
    >
      <div className="space-y-12">
        {uses.map((group) => (
          <section key={group.section}>
            <h2 className="font-mono mb-4 text-xs tracking-wide text-muted-foreground uppercase">
              {group.section}
            </h2>
            <ul className="space-y-3">
              {group.items.map((item) => (
                <li
                  key={item.name}
                  className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span className="font-medium">{item.name}</span>
                  {item.note ? (
                    <span className="font-mono text-xs text-muted-foreground sm:text-right">
                      {item.note}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PageShell>
  )
}
