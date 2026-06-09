import type { Metadata } from "next"

import { Biomap } from "@/components/health/biomap"
import { HealthStack } from "@/components/health/stack"
import { PageShell } from "@/components/site/page-shell"
import { health } from "@/data/health"

export const metadata: Metadata = {
  title: "Health",
  description:
    "A quantified-self biomarker dashboard — lab panels rendered as a category treemap, with optimal/borderline/elevated status derived per marker.",
}

export default function HealthPage() {
  return (
    <PageShell
      title="Health"
      lede="A biomarker dashboard. The most recent lab panel, sized by attention and colored by system — outliers surface as captions, everything in range stays quiet."
      agentPath={{ md: "/health.md", json: "/api/health" }}
    >
      <p className="font-mono text-xs text-muted-foreground">
        panel · {health.panelDate}
      </p>

      {/* Health Stack */}
      <section className="mt-12">
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground">
          ~/stack
        </h2>
        <p className="mt-2 mb-4 max-w-prose text-sm leading-6 text-muted-foreground">
          Wearables and supplements feeding the numbers below.
        </p>
        <HealthStack stack={health.stack} />
      </section>

      {/* Biomap */}
      <section className="mt-12">
        <h2 className="font-mono text-xs tracking-wide text-muted-foreground">
          ~/biomap
        </h2>
        <p className="mt-2 mb-4 max-w-prose text-sm leading-6 text-muted-foreground">
          Each cell is one biomarker. Area scales with attention weight; color
          marks the body system. Cells outside their optimal range are flagged.
        </p>
        <Biomap />
      </section>

      {/* Footnote */}
      <p className="mt-12 max-w-prose font-mono text-[11px] leading-5 text-muted-foreground">
        Values update as lab panels are ingested by the health-ingestor agent
        and written into{" "}
        <span className="text-foreground">data/health.ts</span>. Current numbers
        are placeholders for layout — not medical advice.
      </p>
    </PageShell>
  )
}
