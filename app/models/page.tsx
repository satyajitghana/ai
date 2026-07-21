import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { IntelligenceScatter } from "@/components/models/intelligence-scatter"
import { ModelTable } from "@/components/models/model-table"
import { models, MODELS_SNAPSHOT_DATE } from "@/data/models"

export const metadata: Metadata = {
  title: "Models",
  description:
    "A dated snapshot comparing frontier and open LLMs — intelligence, price, speed, latency, and context — across US, Chinese, and other labs.",
  alternates: { canonical: "/models" },
}

export default function ModelsPage() {
  return (
    <PageShell
      title="Models"
      lede="A snapshot comparison of frontier and open language models — intelligence against price, speed, latency, and context — with the open-vs-closed and US-vs-China lines drawn in."
      className="max-w-5xl"
    >
      <p className="mb-6 font-mono text-xs text-muted-foreground">
        snapshot {MODELS_SNAPSHOT_DATE} · {models.length} models · figures from Artificial
        Analysis, provider docs, and Epoch (ECI). Leaderboards churn — treat this as a dated
        picture, not live data.
      </p>

      <IntelligenceScatter models={models} />
      <ModelTable models={models} />
    </PageShell>
  )
}
