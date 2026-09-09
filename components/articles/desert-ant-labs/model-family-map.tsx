// Provenance for all 17 published repos, read from each repo's own "Built on"
// section (or its absence) and, for text encoders, the "base" field inside
// config.json. Three of these are direct quotes: voz's README says weight
// values are "otherwise unchanged" from the NVIDIA checkpoint; title's README
// names ibm-granite/granite-4.0-350m as "the base model this is fine-tuned
// from"; toxic and toxic-en's config.json each carry a literal "base" field.
// The last group is everything this article did not independently trace --
// listed as such rather than assumed to be either scratch-trained or not.

type Row = { model: string; base: string | null; note: string }

const GROUPS: { label: string; tone: "scratch" | "converted" | "finetuned" | "hybrid" | "unknown"; rows: Row[] }[] = [
  {
    label: "trained from scratch (best-supported claim in the family)",
    tone: "scratch",
    rows: [
      { model: "tongue", base: null, note: "custom hashed n-gram embedding, no pretrained encoder anywhere in the pipeline" },
    ],
  },
  {
    label: "converted, weights unchanged",
    tone: "converted",
    rows: [
      { model: "voz", base: "nvidia/parakeet-tdt-0.6b-v3 (CC BY 4.0)", note: "README: “converted to Core ML and compressed... weight values are otherwise unchanged”" },
    ],
  },
  {
    label: "fine-tuned from a named open base",
    tone: "finetuned",
    rows: [
      { model: "title", base: "ibm-granite/granite-4.0-350m", note: "352.4M params measured from its own safetensors index — matches the 350M base almost exactly" },
      { model: "clips", base: "FacebookAI/xlm-roberta-base (MIT)", note: "shared trunk, 4 new heads trained (saliency, start, end, scorer)" },
      { model: "redact", base: "Multilingual-MiniLM (XLM-R lineage), truncated to 6 layers", note: "fine-tuned for BIOES tagging, EU-script-trimmed vocab" },
      { model: "toxic", base: "xlm-roberta-base", note: "config.json: \"base\": \"xlm-roberta-base\"" },
      { model: "toxic-en", base: "microsoft/Multilingual-MiniLM-L12-H384", note: "config.json: \"base\": \"microsoft/Multilingual-MiniLM-L12-H384\"" },
    ],
  },
  {
    label: "borrowed component + original training",
    tone: "hybrid",
    rows: [
      { model: "emo", base: "minishlab/potion-multilingual-128M (distilled from BAAI/bge-m3)", note: "semantic stream only, PCA-reduced + vocab-pruned; lexical stream + transformer head are original" },
    ],
  },
  {
    label: "distilled lineage, base not formally disclosed",
    tone: "unknown",
    rows: [
      { model: "clear", base: "DeepFilterNet / DFN3 (inferred from tags + keywords)", note: "no “Built on” section anywhere on the card — “distilled model” appears only in the keyword list" },
    ],
  },
  {
    label: "not independently traced by this article",
    tone: "unknown",
    rows: [
      { model: "ear", base: null, note: "" },
      { model: "gist", base: null, note: "model2vec tag suggests the same pattern as emo" },
      { model: "shapes", base: null, note: "" },
      { model: "uhm", base: null, note: "" },
      { model: "schemer", base: null, note: "" },
      { model: "moderator", base: null, note: "" },
      { model: "who", base: null, note: "bundles an Apache-2.0 licensed component per its own licenses/ dir" },
      { model: "align", base: null, note: "" },
    ],
  },
]

const TONE: Record<string, string> = {
  scratch: "oklch(0.55 0.16 155)",
  converted: "oklch(0.60 0.15 255)",
  finetuned: "oklch(0.65 0.15 80)",
  hybrid: "oklch(0.60 0.13 300)",
  unknown: "oklch(0.55 0.02 260)",
}

export function ModelFamilyMap() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          all 17 repos, grouped by how much of the checkpoint is Desert Ant&rsquo;s own training
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">source: each repo&rsquo;s README + config.json</span>
      </div>

      <div className="divide-y divide-border">
        {GROUPS.map((g) => (
          <div key={g.label} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: TONE[g.tone] }} />
              <span className="font-mono text-[10.5px] tracking-wide text-foreground uppercase">{g.label}</span>
              <span className="font-mono text-[10px] text-muted-foreground">({g.rows.length})</span>
            </div>
            <div className="mt-2 space-y-1.5 pl-4">
              {g.rows.map((r) => (
                <div key={r.model} className="text-xs leading-5">
                  <span className="font-mono font-medium text-foreground">{r.model}</span>
                  {r.base ? <span className="text-muted-foreground"> &larr; {r.base}</span> : null}
                  {r.note ? <div className="text-muted-foreground">{r.note}</div> : null}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Nine of seventeen repos trace to a named third-party checkpoint once you read past the
        launch post. That is not the same claim as &ldquo;we trained the models ourselves&rdquo; &mdash;
        it is closer to &ldquo;we converted, fine-tuned, quantized, and in one case trained a model,
        and the SDK, packaging, deterministic layers, and licensing around all of them are original
        work.&rdquo; Both things can be true about the same release.
      </div>
    </figure>
  )
}
