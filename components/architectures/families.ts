// Display labels for the architecture families in data/architectures.ts,
// shared by the /architectures gallery (a client component, which must not
// pull the Zod-validated roster into the browser bundle) and each
// architecture's own page.
export const FAMILY_LABEL: Record<string, string> = {
  transformer: "Transformer",
  attention: "Attention",
  moe: "MoE",
  ssm: "SSM / RNN",
  positional: "Positional",
  diffusion: "Diffusion",
  training: "Training",
  other: "Other",
}
