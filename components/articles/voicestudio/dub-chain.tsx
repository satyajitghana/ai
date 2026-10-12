"use client"

import { useState } from "react"

// The dubbing chain as VoiceStudio wires it at commit 7703ca66, one stage per
// row, with the engines each stage can use. Sources:
//   stages and order      backend/services/dub_pipeline.py ingest_pipeline(),
//                         api/routers/dub_core.py, dub_translate.py,
//                         dub_generate.py, dub_export.py
//   translator registry   backend/services/translation_engines.py REGISTRY
//   translator default    electron/src/shared/hooks/useDubWorkflow.js:116
//                         useState('argos')
//   timing default        useDubWorkflow.js:1180 `timingStrategy || 'strict_slot'`,
//                         labelled "Lip sync" in DubRightColumn.jsx:105
//   licence labels        backend/config/model_licenses.json (checked_at
//                         2026-10-03) and the Hugging Face cards. "label" means
//                         the upstream card's licence field, which VoiceStudio's
//                         own inventory marks "unreviewed"; "unresolved" means
//                         the inventory lists the asset family with no
//                         licence identified (NOASSERTION).
//   watermark default     backend/services/watermark.py is_enabled(),
//                         resolve("watermark.invisible", default=True)

type Where = "local" | "network" | "either"
type Terms = "nc" | "label" | "unresolved" | "custom" | "service"

type Option = {
  id: string
  name: string
  where: Where
  terms: Terms
  termsText: string
  note: string
  isDefault?: boolean
}

type Stage = { id: string; title: string; what: string; options: Option[] }

const STAGES: Stage[] = [
  {
    id: "ingest",
    title: "Ingest",
    what: "Copy the file, or fetch a URL, then extract audio twice with FFmpeg: 16-bit PCM for speech, a full-quality copy for separation.",
    options: [
      { id: "file", name: "Local file", where: "local", terms: "label", termsText: "FFmpeg (bundled via PyAV)", note: "Nothing leaves the machine.", isDefault: true },
      { id: "url", name: "URL via yt-dlp", where: "network", terms: "service", termsText: "the site's own terms", note: "Downloads the video; can also pull the site's caption track and skip ASR." },
    ],
  },
  {
    id: "separate",
    title: "Separate",
    what: "Demucs splits vocals from everything else. The vocals feed ASR and voice references; the rest becomes the background bed.",
    options: [
      { id: "htdemucs", name: "Demucs htdemucs", where: "local", terms: "unresolved", termsText: "weights unresolved in the inventory", note: "Subprocess, two stems, up to 1,800 s.", isDefault: true },
      { id: "none", name: "Separation fails", where: "local", terms: "label", termsText: "n/a", note: "Falls back to the full mix: references carry music, and no background bed." },
    ],
  },
  {
    id: "transcribe",
    title: "Transcribe + diarize",
    what: "Word-timed transcript, speaker labels, then a 5-15 s reference clip per speaker cut from the separated vocals.",
    options: [
      { id: "whisperx", name: "WhisperX large-v3 + pyannote 3.1", where: "local", terms: "label", termsText: "MIT labels; pyannote is HF-gated", note: "The default. Alignment models and VAD are unresolved in the inventory.", isDefault: true },
      { id: "heuristic", name: "WhisperX, no pyannote", where: "local", terms: "label", termsText: "MIT label", note: "Speakers come from a silence-gap heuristic instead." },
      { id: "parakeet", name: "Parakeet TDT 0.6B", where: "local", terms: "label", termsText: "CC-BY-4.0 label", note: "25 languages, fast on CPU." },
      { id: "oai", name: "OpenAI-compatible ASR", where: "either", terms: "service", termsText: "the provider's terms", note: "Local only if the endpoint is loopback." },
    ],
  },
  {
    id: "translate",
    title: "Translate",
    what: "Every segment, with its time budget. LLM modes (Autofit, Cinematic) also rewrite lines toward the slot.",
    options: [
      { id: "argos", name: "Argos Translate", where: "local", terms: "unresolved", termsText: "language packs unresolved", note: "The app's default translator. Pure CPU, one pack per pair.", isDefault: true },
      { id: "nllb", name: "NLLB-200 600M", where: "local", terms: "nc", termsText: "CC-BY-NC-4.0", note: "About 2.4 GB, the best offline quality." },
      { id: "google", name: "Google Translate (free)", where: "network", terms: "service", termsText: "unofficial endpoint", note: "No key; text goes to Google." },
      { id: "keyed", name: "DeepL / Microsoft / Amazon / Google Cloud", where: "network", terms: "service", termsText: "API terms", note: "Needs a key; text goes to the vendor." },
      { id: "llm", name: "LLM, OpenAI-compatible", where: "either", terms: "service", termsText: "the model's terms", note: "Ollama or LM Studio stay local; any keyed provider does not." },
      { id: "agent", name: "Agent CLI (Claude Code, Codex, OpenCode, Pi)", where: "network", terms: "service", termsText: "the agent vendor's terms", note: "The whole ordered dialogue goes to the agent." },
    ],
  },
  {
    id: "speak",
    title: "Speak",
    what: "Zero-shot TTS per line, cloning each speaker from their own reference.",
    options: [
      { id: "omnivoice", name: "OmniVoice", where: "local", terms: "nc", termsText: "CC-BY-NC weights; Higgs Audio 2 and Llama 3 tokenizer terms", note: "The default. 646 languages; about 6 GB of VRAM recommended.", isDefault: true },
      { id: "cosy", name: "CosyVoice 3 (0.5B)", where: "local", terms: "label", termsText: "Apache-2.0 label", note: "Separate install; far fewer languages." },
      { id: "voxcpm", name: "VoxCPM2", where: "local", terms: "label", termsText: "Apache-2.0 label", note: "pip install; cloning and voice design." },
      { id: "index", name: "IndexTTS 2.5", where: "local", terms: "custom", termsText: "bilibili model licence", note: "One-click sidecar; emotion control." },
      { id: "breeze", name: "audio.cpp (Breeze-TTS-2)", where: "local", terms: "nc", termsText: "research / non-commercial weights", note: "Prebuilt native binary; GPU where it was compiled for one." },
    ],
  },
  {
    id: "fit",
    title: "Fit",
    what: "Reconcile each spoken line with the time it has on screen.",
    options: [
      { id: "strict", name: "Strict slot (the \"Lip sync\" button)", where: "local", terms: "label", termsText: "code only", note: "Asks the TTS for the slot's duration, then a pitch-preserving stretch. No lip model.", isDefault: true },
      { id: "smart", name: "Smart Fit", where: "local", terms: "label", termsText: "code only", note: "Speeds audio up to 1.5x and slows that stretch of video up to 2x; stops if a line still overflows." },
      { id: "concise", name: "Concise", where: "local", terms: "label", termsText: "code only", note: "Natural rate; stops on overflow instead of cutting words." },
      { id: "condense", name: "Concise + LLM condensation", where: "either", terms: "service", termsText: "the LLM's terms", note: "Asks an LLM to shorten lines that cannot fit." },
    ],
  },
  {
    id: "mix",
    title: "Mix, mark, export",
    what: "Dub over the separated background inside dialogue, original sound outside it, then mux with FFmpeg.",
    options: [
      { id: "mark", name: "With AudioSeal watermark", where: "local", terms: "unresolved", termsText: "AudioSeal weights unresolved", note: "On by default: a 16-bit \"OM\" mark, inaudible.", isDefault: true },
      { id: "nomark", name: "Watermark switched off", where: "local", terms: "label", termsText: "n/a", note: "One preference; marking also passes audio through unmarked if AudioSeal fails." },
    ],
  },
]

const WHERE_TEXT: Record<Where, string> = { local: "on this machine", network: "leaves the machine", either: "depends on the endpoint" }
const TERMS_COLOR: Record<Terms, string> = {
  nc: "oklch(0.6 0.19 25)",
  custom: "oklch(0.7 0.14 70)",
  unresolved: "oklch(0.65 0.03 260)",
  label: "oklch(0.62 0.13 150)",
  service: "oklch(0.6 0.12 250)",
}

function defaults(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const s of STAGES) out[s.id] = (s.options.find((o) => o.isDefault) ?? s.options[0]).id
  return out
}

export function DubChain() {
  const [pick, setPick] = useState<Record<string, string>>(defaults)
  const [active, setActive] = useState(0)

  const chosen = STAGES.map((s) => ({ stage: s, opt: s.options.find((o) => o.id === pick[s.id]) ?? s.options[0] }))
  const leaves = chosen.filter((c) => c.opt.where !== "local")
  const nc = chosen.filter((c) => c.opt.terms === "nc")
  const unresolved = chosen.filter((c) => c.opt.terms === "unresolved" || c.opt.terms === "custom")
  const stage = STAGES[active]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">VoiceStudio dub chain &middot; commit 7703ca66</span>
        <button
          type="button"
          onClick={() => setPick(defaults())}
          className="cursor-pointer rounded-full border px-2.5 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
        >
          reset to app defaults
        </button>
      </div>

      <div className="p-3 sm:p-4">
        <ol className="flex flex-wrap gap-1.5" aria-label="Dubbing stages">
          {chosen.map(({ stage: s, opt }, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => setActive(i)}
                aria-current={i === active ? "step" : undefined}
                data-on={i === active}
                className="cursor-pointer rounded-lg border px-2.5 py-1.5 text-left font-mono text-[10.5px] text-muted-foreground transition-colors hover:text-foreground data-[on=true]:border-foreground/40 data-[on=true]:bg-muted/50 data-[on=true]:text-foreground"
              >
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle" style={{ background: TERMS_COLOR[opt.terms] }} aria-hidden />
                {i + 1}. {s.title}
                {opt.where !== "local" && <span className="ml-1 text-[9.5px]">(net)</span>}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-3 rounded-lg border p-3">
          <div className="text-sm font-medium text-foreground">
            {active + 1}. {stage.title}
          </div>
          <p className="mt-1 text-[13px] leading-5 text-muted-foreground">{stage.what}</p>
          <div className="mt-2.5 grid gap-1.5 sm:grid-cols-2" role="radiogroup" aria-label={`${stage.title} engine`}>
            {stage.options.map((o) => {
              const on = pick[stage.id] === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  data-on={on}
                  onClick={() => setPick((p) => ({ ...p, [stage.id]: o.id }))}
                  className="cursor-pointer rounded-lg border p-2 text-left transition-colors hover:bg-muted/30 data-[on=true]:border-foreground/40 data-[on=true]:bg-muted/50"
                >
                  <div className="flex items-center gap-1.5 font-mono text-[11px] text-foreground">
                    <span className="inline-block h-2 w-2 shrink-0 rounded-full" style={{ background: TERMS_COLOR[o.terms] }} aria-hidden />
                    {o.name}
                    {o.isDefault && <span className="text-[9.5px] text-muted-foreground">default</span>}
                  </div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">
                    {WHERE_TEXT[o.where]} &middot; {o.termsText}
                  </div>
                  <div className="mt-0.5 text-[11.5px] leading-4 text-muted-foreground">{o.note}</div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="mt-3 grid gap-2 font-mono text-[10.5px] sm:grid-cols-3">
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">leaves the machine</div>
            <div className="text-foreground">{leaves.length === 0 ? "nothing" : leaves.map((c) => c.stage.title).join(", ")}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">non-commercial terms</div>
            <div className="text-foreground">{nc.length === 0 ? "none chosen" : nc.map((c) => c.opt.name).join(", ")}</div>
          </div>
          <div className="rounded-lg border p-2.5">
            <div className="text-muted-foreground">unresolved or custom</div>
            <div className="text-foreground">{unresolved.length === 0 ? "none chosen" : unresolved.map((c) => c.opt.name).join(", ")}</div>
          </div>
        </div>

        <p className="mt-3 font-mono text-[10px] leading-4 text-muted-foreground">
          <span style={{ color: TERMS_COLOR.nc }}>&#9679;</span> non-commercial{" "}
          <span style={{ color: TERMS_COLOR.custom }}>&#9679;</span> custom licence{" "}
          <span style={{ color: TERMS_COLOR.unresolved }}>&#9679;</span> unresolved in VoiceStudio&rsquo;s inventory{" "}
          <span style={{ color: TERMS_COLOR.label }}>&#9679;</span> permissive card label, not reviewed{" "}
          <span style={{ color: TERMS_COLOR.service }}>&#9679;</span> a third-party service
        </p>
      </div>
    </figure>
  )
}
