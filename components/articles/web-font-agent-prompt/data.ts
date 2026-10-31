// Every number in this file was measured for the article "Tell your agent to optimize your web fonts"
// (web-font-agent-prompt); the scripts that produced them are listed in the article. Bytes are exact file sizes.
// Chromium 141.0.7390.37 headless on Linux, fontTools 4.68.0, brotli, Python 3.13.

export type FontId = "Inter" | "SourceSerif4" | "JBMono"

export const FONTS: { id: FontId; name: string; role: string; axes: string }[] = [
  { id: "Inter", name: "Inter", role: "sans, body text", axes: "wght 100-900, opsz 14-32" },
  { id: "SourceSerif4", name: "Source Serif 4", role: "serif, long reads", axes: "wght 200-900, opsz 8-60" },
  { id: "JBMono", name: "JetBrains Mono", role: "code", axes: "wght 100-800" },
]

// Each step of the ladder is cumulative with the one above it, except the last two, which are alternatives.
export type Step = {
  id: string
  label: string
  note: string
  bytes: Record<FontId, number>
  pixels: string
}

export const STEPS: Step[] = [
  { id: "ttf", label: "TTF as shipped", note: "The variable TTF from the google/fonts repository.", bytes: { Inter: 876576, SourceSerif4: 1209508, JBMono: 187208 }, pixels: "reference" },
  { id: "woff2", label: "WOFF2, nothing else", note: "Same tables, Brotli-compressed by fontTools.", bytes: { Inter: 350516, SourceSerif4: 428076, JBMono: 71548 }, pixels: "the baseline for every diff; a lossless wrapper" },
  { id: "subset-all", label: "Subset, every feature kept", note: "The characters in the site's prose (or code) plus Latin-1 and Latin Extended-A. All GSUB and GPOS features survive.", bytes: { Inter: 121672, SourceSerif4: 256216, JBMono: 48256 }, pixels: "identical, except characters the subset left out" },
  { id: "subset-default", label: "Subset, fontTools default features", note: "The subsetter drops stylistic sets, tabular figures, case forms, the slashed zero.", bytes: { Inter: 90052, SourceSerif4: 165352, JBMono: 46596 }, pixels: "identical until CSS asks for tnum, ss01, cv11, case or zero" },
  { id: "axis", label: "And wght limited to 400-700", note: "The axis range cut to the weights the CSS uses. opsz untouched.", bytes: { Inter: 63956, SourceSerif4: 115316, JBMono: 34692 }, pixels: "weight 400 identical; 500-700 drift by up to 1.1 font units" },
  { id: "split", label: "Core + extended, both files", note: "Core (ASCII, curly quotes, dashes, ellipsis) is preloaded; extended sits behind unicode-range. Sum of both.", bytes: { Inter: 75144, SourceSerif4: 139672, JBMono: 39588 }, pixels: "same as the step above" },
]

export const CORE: Record<FontId, number> = { Inter: 30664, SourceSerif4: 52204, JBMono: 23516 }
export const EXT: Record<FontId, number> = { Inter: 44480, SourceSerif4: 87468, JBMono: 16072 }
// Axis pinned to one value, for the "what if the axis were fixed" question. opsz stays variable.
export const PIN400: Record<FontId, number> = { Inter: 40584, SourceSerif4: 66944, JBMono: 23304 }

export const STAGES = [
  { id: "orig", label: "original" },
  { id: "subfullall", label: "subset, all features" },
  { id: "subfull", label: "default features" },
  { id: "opt", label: "wght 400-700" },
] as const
export type StageId = (typeof STAGES)[number]["id"]

// Uncompressed table sizes (bytes) of the TTF each stage would save, top tables by size in the original.
export const TABLES: Record<FontId, { keys: string[]; rows: Record<StageId, { total: number; parts: Record<string, number> }> }> = {
  Inter: {
    keys: ["gvar", "GPOS", "glyf", "GSUB", "cmap", "post", "other"],
    rows: {
      orig: { total: 876213, parts: {"gvar": 454714, "GPOS": 153772, "glyf": 137900, "GSUB": 24692, "cmap": 25866, "post": 32712, "other": 46557} },
      subfullall: { total: 297888, parts: {"gvar": 144010, "GPOS": 76852, "glyf": 43424, "GSUB": 15850, "cmap": 1192, "post": 32, "other": 16528} },
      subfull: { total: 201786, parts: {"gvar": 97780, "GPOS": 53152, "glyf": 28986, "GSUB": 9608, "cmap": 1160, "post": 32, "other": 11068} },
      opt: { total: 159644, parts: {"gvar": 57926, "GPOS": 53084, "glyf": 28986, "GSUB": 9608, "cmap": 1160, "post": 32, "other": 8848} },
    },
  },
  SourceSerif4: {
    keys: ["gvar", "GPOS", "glyf", "GDEF", "GSUB", "cmap", "other"],
    rows: {
      orig: { total: 1209127, parts: {"gvar": 598758, "GPOS": 422184, "glyf": 107252, "GDEF": 35407, "GSUB": 10960, "cmap": 9944, "other": 24622} },
      subfullall: { total: 631471, parts: {"gvar": 331284, "GPOS": 194740, "glyf": 58872, "GDEF": 25771, "GSUB": 6796, "cmap": 930, "other": 13078} },
      subfull: { total: 368946, parts: {"gvar": 217140, "GPOS": 81854, "glyf": 38810, "GDEF": 17203, "GSUB": 3312, "cmap": 930, "other": 9697} },
      opt: { total: 274110, parts: {"gvar": 137696, "GPOS": 77650, "glyf": 38810, "GDEF": 7226, "GSUB": 3312, "cmap": 930, "other": 8486} },
    },
  },
  JBMono: {
    keys: ["gvar", "glyf", "GSUB", "post", "hmtx", "cmap", "other"],
    rows: {
      orig: { total: 186832, parts: {"gvar": 70298, "glyf": 65698, "GSUB": 21644, "post": 12343, "hmtx": 4716, "cmap": 2626, "other": 9507} },
      subfullall: { total: 116359, parts: {"gvar": 49178, "glyf": 37742, "GSUB": 21072, "post": 32, "hmtx": 2360, "cmap": 1136, "other": 4839} },
      subfull: { total: 112947, parts: {"gvar": 47904, "glyf": 36832, "GSUB": 19928, "post": 32, "hmtx": 2304, "cmap": 1136, "other": 4811} },
      opt: { total: 88262, parts: {"gvar": 23756, "glyf": 36832, "GSUB": 19928, "post": 32, "hmtx": 2304, "cmap": 1136, "other": 4274} },
    },
  },
}

// CLS and font-ready time, Chromium 141, local server, CDP network throttling, 7 loads each (median).
// Text paragraph 620 px wide, 18 px, font-display swap, fallback Liberation Sans.
export type LoadRow = { id: string; label: string; bytes: number; ready: number; cls: number; fcp: number }
export const LOADS: Record<"slow" | "fast", LoadRow[]> = {
  slow: [
    { id: "orig", label: "original WOFF2", bytes: 350516, ready: 2107, cls: 0.027, fcp: 296 },
    { id: "opt", label: "core file only", bytes: 30664, ready: 487, cls: 0.027, fcp: 292 },
    { id: "orig_adj", label: "original + size-adjust", bytes: 350516, ready: 2105, cls: 0, fcp: 296 },
    { id: "opt_adj", label: "core + size-adjust", bytes: 30664, ready: 487, cls: 0, fcp: 296 },
  ],
  fast: [
    { id: "orig", label: "original WOFF2", bytes: 350516, ready: 444, cls: 0.027, fcp: 176 },
    { id: "opt", label: "core file only", bytes: 30664, ready: 141, cls: 0, fcp: 156 },
    { id: "orig_adj", label: "original + size-adjust", bytes: 350516, ready: 441, cls: 0, fcp: 184 },
    { id: "opt_adj", label: "core + size-adjust", bytes: 30664, ready: 138, cls: 0, fcp: 156 },
  ],
}

// Summed advance width of the three test paragraphs at font-size 100px (Chromium getBoundingClientRect, one line, no wrap).
export const WIDTH_INTER = 23008.8
export const WIDTH_FALLBACK = 23600.25
export const FIT = { size: 97.49, ascent: 99.37, descent: 24.74, gap: 0 }
