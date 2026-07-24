import type { ComponentType } from "react"

import { AttentionKvSharing } from "./attention-kv-sharing"
import { KimiK3Architecture } from "./kimi-k3"
import { MoeLayer } from "./moe-layer"
import { TransformerBlock } from "./transformer-block"

// slug → vetted distill-style diagram. Not every architecture has one; the ones
// that do render inline on /architectures (and the components are reused inside
// the matching article). Keep the keys in sync with data/architectures.ts slugs.
// One diagram per anchor slug — the KV-sharing figure already compares MHA →
// MQA → GQA → MLA in one scene, and the Kimi figure covers KDA + AttnRes, so we
// mount each once (on the anchor) rather than repeating it on every variant.
const DIAGRAMS: Record<string, ComponentType> = {
  transformer: TransformerBlock,
  "mixture-of-experts": MoeLayer,
  "multi-head-attention": AttentionKvSharing,
  "kimi-delta-attention": KimiK3Architecture,
}

export const ARCH_DIAGRAM_SLUGS = new Set(Object.keys(DIAGRAMS))

export function ArchDiagram({ slug }: { slug: string }) {
  const Component = DIAGRAMS[slug]
  return Component ? <Component /> : null
}
