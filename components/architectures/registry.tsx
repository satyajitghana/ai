import type { ComponentType } from "react"

import { AttentionKvSharing } from "./attention-kv-sharing"
import { KimiK3Architecture } from "./kimi-k3"
import { MoeLayer } from "./moe-layer"
import { TransformerBlock } from "./transformer-block"

// slug → vetted distill-style diagram. Not every architecture has one; the ones
// that do render inline on /architectures (and the components are reused inside
// the matching article). Keep the keys in sync with data/architectures.ts slugs.
const DIAGRAMS: Record<string, ComponentType> = {
  transformer: TransformerBlock,
  "mixture-of-experts": MoeLayer,
  "multi-head-attention": AttentionKvSharing,
  "multi-query-attention": AttentionKvSharing,
  "grouped-query-attention": AttentionKvSharing,
  "multi-head-latent-attention": AttentionKvSharing,
  "kimi-delta-attention": KimiK3Architecture,
  "attention-residuals": KimiK3Architecture,
}

export const ARCH_DIAGRAM_SLUGS = new Set(Object.keys(DIAGRAMS))

export function ArchDiagram({ slug }: { slug: string }) {
  const Component = DIAGRAMS[slug]
  return Component ? <Component /> : null
}
