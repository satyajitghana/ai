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

// Below sm a 700-900-unit diagram squeezed into a phone-width card puts its
// labels at 4-5 px. Wrapped in this, a diagram keeps at least 40rem of width
// there and scrolls sideways inside its figure; the caption under it still
// wraps. Used by the gallery's cards and modal and by each architecture page.
export const DIAGRAM_FIT = "[&_figure>div]:overflow-x-auto [&_svg]:min-w-[40rem] sm:[&_svg]:min-w-0"
