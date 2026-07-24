import type { ComponentType } from "react"

import { AttentionKvSharing } from "./attention-kv-sharing"
import { DiffusionTransformer } from "./diffusion-transformer"
import { EncoderBert } from "./encoder-bert"
import { EncoderDecoder } from "./encoder-decoder"
import { KimiK3Architecture } from "./kimi-k3"
import { LoopedTransformer } from "./looped-transformer"
import { MambaSsm } from "./mamba-ssm"
import { MaskedDiffusionLm } from "./masked-diffusion-lm"
import { MixtureOfDepths } from "./mixture-of-depths"
import { MoeLayer } from "./moe-layer"
import { Rope } from "./rope"
import { TransformerBlock } from "./transformer-block"

// slug → vetted distill-style diagram. Every architecture in the gallery has one;
// they render inline on /architectures (and the components are reused inside the
// matching article). Keep the keys in sync with data/architectures.ts slugs.
// One diagram per anchor slug — the KV-sharing figure already compares MHA →
// MQA → GQA → MLA in one scene, and the Kimi figure covers KDA + AttnRes, so we
// mount each once (on the anchor) rather than repeating it on every variant.
const DIAGRAMS: Record<string, ComponentType> = {
  transformer: TransformerBlock,
  "encoder-bert": EncoderBert,
  "encoder-decoder": EncoderDecoder,
  "mixture-of-experts": MoeLayer,
  "attention-kv": AttentionKvSharing,
  rope: Rope,
  "mamba-ssm": MambaSsm,
  "looped-transformer": LoopedTransformer,
  "mixture-of-depths": MixtureOfDepths,
  "diffusion-transformer": DiffusionTransformer,
  "masked-diffusion-lm": MaskedDiffusionLm,
  "kimi-k3": KimiK3Architecture,
}

export const ARCH_DIAGRAM_SLUGS = new Set(Object.keys(DIAGRAMS))

export function ArchDiagram({ slug }: { slug: string }) {
  const Component = DIAGRAMS[slug]
  return Component ? <Component /> : null
}
