import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { IntelligenceScatter } from "@/components/models/intelligence-scatter"
import { MetricRanking } from "@/components/models/metric-ranking"
import { FrontierTimeline } from "@/components/models/frontier-timeline"
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
      <MetricRanking models={models} />

      <h2 className="mt-10 mb-1 font-heading text-lg font-semibold">
        Are Chinese models catching up?
      </h2>
      <p className="mb-2 max-w-prose text-sm leading-6 text-muted-foreground">
        Intelligence against release date, with a best-so-far frontier line for each
        origin. The gap between the two envelopes — and whether it&apos;s closing — is the
        question the{" "}
        <a href="https://scaling01.substack.com/p/have-chinese-ai-models-caught-up" className="underline decoration-foreground/30 underline-offset-4 hover:text-foreground">
          scaling01 analysis
        </a>{" "}
        digs into.
      </p>
      <FrontierTimeline models={models} />

      <h2 className="mt-10 mb-2 font-heading text-lg font-semibold">The full table</h2>
      <ModelTable models={models} />
    </PageShell>
  )
}
