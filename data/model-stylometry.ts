// data/model-stylometry.ts — a stylometric similarity matrix over LLM prose.
// GENERATED, do not hand-edit. Reproduced faithfully from Typebulb's "You're
// relatively right!" bulb (typebulb.com/u/lab/you-re-relatively-right/full,
// snapshot 2026-07-18), which prompts each model on 8 fixed questions and
// compares them "from their words alone." Method (theirs, replicated exactly):
// char-trigram counts per model → interpolate each gram's probability with the
// pooled background (lambda = 0.8) → cross-entropy → KL divergence in bits →
// symmetrise both directions (Jeffreys/2). Lower = the two models write more
// alike. `values` is the symmetric divergence matrix in bits (diagonal 0);
// `min`/`max` are the off-diagonal range used to normalise the colour ramp.

export type StyloModel = {
  disp: string
  lab: string
  name: string
  released: string | null
  entropy: number // own trigram entropy, bits (raw MLE)
}

export const STYLO_SNAPSHOT = "2026-07-18"
export const STYLO_SOURCE_URL =
  "https://typebulb.com/u/lab/you-re-relatively-right/full"

export const styloModels: StyloModel[] = [
  { disp: "Anthropic: Fable 5", lab: "Anthropic", name: "Fable 5", released: "2026-06", entropy: 10.742 },
  { disp: "Anthropic: Haiku 4.5", lab: "Anthropic", name: "Haiku 4.5", released: "2025-10", entropy: 10.561 },
  { disp: "Anthropic: Opus 4.5", lab: "Anthropic", name: "Opus 4.5", released: "2025-11", entropy: 10.635 },
  { disp: "Anthropic: Opus 4.6", lab: "Anthropic", name: "Opus 4.6", released: "2026-02", entropy: 10.891 },
  { disp: "Anthropic: Opus 4.7", lab: "Anthropic", name: "Opus 4.7", released: "2026-04", entropy: 10.788 },
  { disp: "Anthropic: Opus 4.8", lab: "Anthropic", name: "Opus 4.8", released: "2026-05", entropy: 10.614 },
  { disp: "Anthropic: Sonnet 5", lab: "Anthropic", name: "Sonnet 5", released: "2026-06", entropy: 10.763 },
  { disp: "DeepSeek: DeepSeek V4", lab: "DeepSeek", name: "DeepSeek V4", released: "2026-04", entropy: 10.896 },
  { disp: "Google: Gemini 3 Flash", lab: "Google", name: "Gemini 3 Flash", released: "2025-12", entropy: 10.923 },
  { disp: "Google: Gemini 3.1 Pro", lab: "Google", name: "Gemini 3.1 Pro", released: "2026-02", entropy: 10.953 },
  { disp: "Google: Gemini 3.5 Flash", lab: "Google", name: "Gemini 3.5 Flash", released: "2026-05", entropy: 11.011 },
  { disp: "Moonshot: Kimi K2.6", lab: "Moonshot", name: "Kimi K2.6", released: "2026-04", entropy: 11.152 },
  { disp: "Moonshot: Kimi K3", lab: "Moonshot", name: "Kimi K3", released: "2026-07", entropy: 10.761 },
  { disp: "OpenAI: GPT 5.4", lab: "OpenAI", name: "GPT 5.4", released: "2026-03", entropy: 11.062 },
  { disp: "OpenAI: GPT 5.4 Mini", lab: "OpenAI", name: "GPT 5.4 Mini", released: "2026-03", entropy: 11.074 },
  { disp: "OpenAI: GPT 5.5", lab: "OpenAI", name: "GPT 5.5", released: "2026-04", entropy: 11.185 },
  { disp: "OpenAI: GPT 5.6 Luna", lab: "OpenAI", name: "GPT 5.6 Luna", released: "2026-07", entropy: 10.851 },
  { disp: "OpenAI: GPT 5.6 Sol", lab: "OpenAI", name: "GPT 5.6 Sol", released: "2026-07", entropy: 10.994 },
  { disp: "OpenAI: GPT 5.6 Terra", lab: "OpenAI", name: "GPT 5.6 Terra", released: "2026-07", entropy: 11.123 },
  { disp: "Zhipu: GLM 5.2", lab: "Zhipu", name: "GLM 5.2", released: "2026-06", entropy: 10.923 },
  { disp: "xAI: Grok 4.3", lab: "xAI", name: "Grok 4.3", released: "2026-04", entropy: 10.799 },
  { disp: "xAI: Grok 4.5", lab: "xAI", name: "Grok 4.5", released: "2026-07", entropy: 11.037 },
]

// symmetric KL divergence in bits/trigram; lower = more alike. diagonal is 0.
export const styloValues: number[][] = [
  [0.0000, 0.5644, 0.5601, 0.6333, 0.4288, 0.4395, 0.4471, 0.5759, 0.6216, 0.5862, 0.6181, 0.6486, 0.4373, 0.7787, 0.8756, 0.7738, 0.7200, 0.7334, 0.7117, 0.5299, 0.5655, 0.5922],
  [0.5644, 0.0000, 0.5698, 0.6461, 0.5614, 0.5309, 0.5366, 0.6809, 0.7319, 0.6982, 0.7513, 0.7204, 0.5934, 0.9074, 0.9648, 0.8701, 0.8453, 0.8212, 0.8060, 0.6649, 0.6594, 0.6905],
  [0.5601, 0.5698, 0.0000, 0.6386, 0.5605, 0.5417, 0.5448, 0.6692, 0.6970, 0.6788, 0.6925, 0.7157, 0.5920, 0.8866, 0.9449, 0.8437, 0.8352, 0.8000, 0.7638, 0.6505, 0.6164, 0.7018],
  [0.6333, 0.6461, 0.6386, 0.0000, 0.6361, 0.6265, 0.6197, 0.7175, 0.7825, 0.7245, 0.7796, 0.7761, 0.6579, 0.8679, 0.9363, 0.8262, 0.8355, 0.8221, 0.7906, 0.7049, 0.6874, 0.7299],
  [0.4288, 0.5614, 0.5605, 0.6361, 0.0000, 0.4475, 0.4505, 0.5881, 0.6305, 0.5993, 0.6239, 0.6469, 0.4769, 0.7464, 0.8450, 0.7528, 0.7073, 0.7307, 0.7023, 0.5408, 0.5733, 0.5774],
  [0.4395, 0.5309, 0.5417, 0.6265, 0.4475, 0.0000, 0.4462, 0.5998, 0.6295, 0.6046, 0.6416, 0.6851, 0.4682, 0.8389, 0.8975, 0.8082, 0.7781, 0.7578, 0.7367, 0.5403, 0.5965, 0.6246],
  [0.4471, 0.5366, 0.5448, 0.6197, 0.4505, 0.4462, 0.0000, 0.5999, 0.6264, 0.5915, 0.6344, 0.6464, 0.4713, 0.7736, 0.8529, 0.7539, 0.7413, 0.7288, 0.6943, 0.5494, 0.5617, 0.5564],
  [0.5759, 0.6809, 0.6692, 0.7175, 0.5881, 0.5998, 0.5999, 0.0000, 0.5887, 0.5669, 0.5681, 0.6455, 0.5751, 0.7546, 0.8293, 0.7249, 0.7038, 0.7146, 0.6700, 0.5234, 0.5863, 0.5918],
  [0.6216, 0.7319, 0.6970, 0.7825, 0.6305, 0.6295, 0.6264, 0.5887, 0.0000, 0.4808, 0.4492, 0.6408, 0.6288, 0.8515, 0.9506, 0.8339, 0.8310, 0.8303, 0.7833, 0.4476, 0.6318, 0.6749],
  [0.5862, 0.6982, 0.6788, 0.7245, 0.5993, 0.6046, 0.5915, 0.5669, 0.4808, 0.0000, 0.4419, 0.6377, 0.5854, 0.8617, 0.9132, 0.8129, 0.8130, 0.7954, 0.7555, 0.4176, 0.6123, 0.6317],
  [0.6181, 0.7513, 0.6925, 0.7796, 0.6239, 0.6416, 0.6344, 0.5681, 0.4492, 0.4419, 0.0000, 0.6213, 0.6130, 0.8355, 0.9154, 0.7953, 0.7904, 0.7717, 0.7272, 0.4386, 0.6142, 0.6412],
  [0.6486, 0.7204, 0.7157, 0.7761, 0.6469, 0.6851, 0.6464, 0.6455, 0.6408, 0.6377, 0.6213, 0.0000, 0.6595, 0.8595, 0.9093, 0.8068, 0.8315, 0.7948, 0.7558, 0.6146, 0.6431, 0.6405],
  [0.4373, 0.5934, 0.5920, 0.6579, 0.4769, 0.4682, 0.4713, 0.5751, 0.6288, 0.5854, 0.6130, 0.6595, 0.0000, 0.8146, 0.8731, 0.7693, 0.7538, 0.7184, 0.6978, 0.5448, 0.5565, 0.5898],
  [0.7787, 0.9074, 0.8866, 0.8679, 0.7464, 0.8389, 0.7736, 0.7546, 0.8515, 0.8617, 0.8355, 0.8595, 0.8146, 0.0000, 0.7046, 0.6836, 0.5225, 0.7145, 0.6906, 0.7708, 0.7407, 0.7455],
  [0.8756, 0.9648, 0.9449, 0.9363, 0.8450, 0.8975, 0.8529, 0.8293, 0.9506, 0.9132, 0.9154, 0.9093, 0.8731, 0.7046, 0.0000, 0.7822, 0.7953, 0.7885, 0.7634, 0.8717, 0.8383, 0.7728],
  [0.7738, 0.8701, 0.8437, 0.8262, 0.7528, 0.8082, 0.7539, 0.7249, 0.8339, 0.8129, 0.7953, 0.8068, 0.7693, 0.6836, 0.7822, 0.0000, 0.6415, 0.6249, 0.5447, 0.7615, 0.7191, 0.6942],
  [0.7200, 0.8453, 0.8352, 0.8355, 0.7073, 0.7781, 0.7413, 0.7038, 0.8310, 0.8130, 0.7904, 0.8315, 0.7538, 0.5225, 0.7953, 0.6415, 0.0000, 0.6074, 0.6120, 0.7327, 0.6771, 0.6889],
  [0.7334, 0.8212, 0.8000, 0.8221, 0.7307, 0.7578, 0.7288, 0.7146, 0.8303, 0.7954, 0.7717, 0.7948, 0.7184, 0.7145, 0.7885, 0.6249, 0.6074, 0.0000, 0.5345, 0.7468, 0.6685, 0.6457],
  [0.7117, 0.8060, 0.7638, 0.7906, 0.7023, 0.7367, 0.6943, 0.6700, 0.7833, 0.7555, 0.7272, 0.7558, 0.6978, 0.6906, 0.7634, 0.5447, 0.6120, 0.5345, 0.0000, 0.7171, 0.6268, 0.6199],
  [0.5299, 0.6649, 0.6505, 0.7049, 0.5408, 0.5403, 0.5494, 0.5234, 0.4476, 0.4176, 0.4386, 0.6146, 0.5448, 0.7708, 0.8717, 0.7615, 0.7327, 0.7468, 0.7171, 0.0000, 0.5691, 0.5852],
  [0.5655, 0.6594, 0.6164, 0.6874, 0.5733, 0.5965, 0.5617, 0.5863, 0.6318, 0.6123, 0.6142, 0.6431, 0.5565, 0.7407, 0.8383, 0.7191, 0.6771, 0.6685, 0.6268, 0.5691, 0.0000, 0.5212],
  [0.5922, 0.6905, 0.7018, 0.7299, 0.5774, 0.6246, 0.5564, 0.5918, 0.6749, 0.6317, 0.6412, 0.6405, 0.5898, 0.7455, 0.7728, 0.6942, 0.6889, 0.6457, 0.6199, 0.5852, 0.5212, 0.0000],
]

export const styloMin = 0.4176
export const styloMax = 0.9648
