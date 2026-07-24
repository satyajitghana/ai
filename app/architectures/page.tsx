import type { Metadata } from "next"

import { ARCH_DIAGRAM_SLUGS } from "@/components/architectures/registry"
import { PageShell } from "@/components/site/page-shell"
import { architectures, architectureSignal } from "@/data/architectures"

import { ArchitecturesList } from "./architectures-list"

export const metadata: Metadata = {
  title: "Architectures",
  description:
    "A curated gallery of the building-block architectures behind modern models — each rated on interestingness and uniqueness, many drawn as distill-style diagrams.",
  alternates: { canonical: "/architectures" },
}

export default function Page() {
  // Slim, serializable projection handed to the client gallery. The signal is
  // derived from each entry's own interest + uniqueness (data/architectures.ts).
  const items = architectures.map((a) => {
    const s = architectureSignal(a)
    return {
      slug: a.slug,
      name: a.name,
      family: a.family,
      year: a.year,
      tags: a.tags,
      interest: a.interest,
      uniqueness: a.uniqueness,
      summary: a.summary,
      article: a.article ?? null,
      paper: a.paper ?? null,
      signal: s.level,
      signalLabel: s.label,
      score: s.score,
      hasDiagram: ARCH_DIAGRAM_SLUGS.has(a.slug),
    }
  })

  return (
    <PageShell
      title="Architectures"
      lede="The building-block architectures behind modern models — attention, MoE, state-space, positional, diffusion — each rated on how interesting and how unique it is, and many drawn as detailed distill-style diagrams."
      agentPath={{ json: "/api/architectures" }}
    >
      <ArchitecturesList items={items} />
    </PageShell>
  )
}
