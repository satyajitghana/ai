"use client"

import { useState } from "react"

// How tiny-voca's training set was made, stage by stage, with the counts from the dataset card
// (n4ze3m/tiny-voca, README and voices.json) and the model card. The toggle marks every stage
// where a model that learned from recorded human speech touched the data: the claim "never heard a
// real human voice" is true of tiny-voca's own weights, and of nothing upstream of them.

type Stage = {
  id: string
  title: string
  tool: string
  real: boolean
  realNote?: string
  count: number
  unit: string
  lines: string[]
}

const STAGES: Stage[] = [
  {
    id: "text",
    title: "Write the sentences",
    tool: "LibriTTS-R transcripts, DeepSeek, Common Voice, templates",
    real: false,
    realNote: "Text only. The LibriTTS-R transcripts come from a recorded corpus, but no audio is used.",
    count: 8_984,
    unit: "sentences",
    lines: [
      "batch1: 4,905 sentences, LibriTTS-R book transcripts plus LLM-written conversational lines",
      "batch2: 2,700 Common Voice sentences, 779 Common Voice Wikipedia sentences, 600 templates for numbers, dates, money, names and questions",
    ],
  },
  {
    id: "design",
    title: "Design two voices from text",
    tool: "Qwen3-TTS 1.7B VoiceDesign",
    real: true,
    realNote: "Qwen3-TTS learned what voices sound like from recorded speech.",
    count: 2,
    unit: "reference clips",
    lines: [
      "F2: \"an adult American woman in her mid twenties with a bright, clear, slightly higher-pitched voice\", seed 31416, 12.32 s",
      "M2: \"an adult American man in his late twenties with a bright, clear light baritone voice\", seed 31419, 11.52 s",
    ],
  },
  {
    id: "read",
    title: "Read every sentence in both voices",
    tool: "Qwen3-TTS 1.7B Base, reference clip as the voice prompt",
    real: true,
    realNote: "The teacher. Every waveform tiny-voca trains on is its output.",
    count: 17_968,
    unit: "readings",
    lines: ["9,810 readings in batch1 and 8,158 in batch2: each sentence twice, once per voice"],
  },
  {
    id: "screen",
    title: "Screen with speech recognition",
    tool: "Whisper small.en",
    real: true,
    realNote: "Whisper was trained on recorded speech; it decides which clips count as correct.",
    count: 17_371,
    unit: "clips kept, 19.1 h",
    lines: [
      "Over 15% word error rate, or an implausible duration, rate or silence: generate again",
      "Failed twice: left out. 270 of 9,810 in batch1, 327 of 8,158 in batch2",
      "Accepted clips peak-normalised to 0.95",
    ],
  },
  {
    id: "align",
    title: "Label phoneme durations",
    tool: "facebook/wav2vec2-lv-60-espeak-cv-ft forced alignment",
    real: true,
    realNote: "A phoneme recogniser trained on recorded speech sets the duration targets.",
    count: 17_326,
    unit: "clips aligned",
    lines: ["17,326 of 17,371 clips passed the alignment checks (annotations v4, dizione phonemes)"],
  },
  {
    id: "train",
    title: "Train tiny-voca from scratch",
    tool: "one RTX 4090, 7.7 hours",
    real: false,
    realNote: "No pretrained weights inside the model. It only ever hears the teacher.",
    count: 16_018,
    unit: "training clips, 17.6 h",
    lines: [
      "104,737 steps: 66,000 on batch1 with eSpeak NG phonemes, then 38,737 on both batches with dizione",
      "Spectral losses only for the first 8,000 steps, then adversarial losses too",
    ],
  },
]

const MAX = 17_968
const ACCENT = "oklch(0.64 0.15 35)"
const REAL = "oklch(0.6 0.16 255)"

export function SyntheticCorpus() {
  const [i, setI] = useState(0)
  const [showReal, setShowReal] = useState(false)
  const s = STAGES[i]

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 font-mono text-[11px]">
        <button
          type="button"
          onClick={() => setI((k) => Math.max(0, k - 1))}
          disabled={i === 0}
          className="rounded-md border px-2 py-0.5 disabled:opacity-40"
        >
          prev
        </button>
        <button
          type="button"
          onClick={() => setI((k) => Math.min(STAGES.length - 1, k + 1))}
          disabled={i === STAGES.length - 1}
          className="rounded-md border px-2 py-0.5 disabled:opacity-40"
        >
          next
        </button>
        <span className="text-muted-foreground">
          stage {i + 1} of {STAGES.length}
        </span>
        <label className="ml-auto flex cursor-pointer items-center gap-1.5">
          <input type="checkbox" checked={showReal} onChange={(e) => setShowReal(e.target.checked)} />
          <span>where recorded speech entered</span>
        </label>
      </div>

      <div className="p-3 sm:p-4">
        <ol className="space-y-1">
          {STAGES.map((st, k) => {
            const w = st.unit.startsWith("sentences") || st.count < 10 ? null : (st.count / MAX) * 100
            const marked = showReal && st.real
            return (
              <li key={st.id}>
                <button
                  type="button"
                  onClick={() => setI(k)}
                  aria-pressed={k === i}
                  className={`grid w-full grid-cols-[1.5rem_9rem_1fr] items-center gap-2 rounded-md px-1 py-1 text-left sm:grid-cols-[1.5rem_13rem_1fr] ${k === i ? "bg-muted/60" : "hover:bg-muted/30"}`}
                >
                  <span className="font-mono text-[11px] text-muted-foreground">{k + 1}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px]">{st.title}</span>
                    <span
                      className="block truncate font-mono text-[10px]"
                      style={{ color: marked ? REAL : undefined }}
                    >
                      {st.tool}
                    </span>
                  </span>
                  <span className="flex items-center gap-2">
                    {w !== null ? (
                      <span
                        className="block h-2.5 rounded-sm"
                        style={{ width: `${w.toFixed(2)}%`, background: marked ? REAL : ACCENT, opacity: k <= i ? 1 : 0.35 }}
                      />
                    ) : null}
                    <span className="shrink-0 font-mono text-[11px] text-muted-foreground">
                      {st.count.toLocaleString("en-US")} {st.unit}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>

        <div className="mt-3 rounded-lg border p-3">
          <div className="text-[14px] font-medium">{s.title}</div>
          <ul className="mt-1.5 list-disc space-y-1 pl-5 text-[13px] leading-relaxed">
            {s.lines.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
          {showReal && s.realNote && (
            <p className="mt-2 font-mono text-[11px]" style={{ color: s.real ? REAL : undefined }}>
              {s.real ? "trained on recorded speech: " : "no recorded audio here: "}
              {s.realNote}
            </p>
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          Counts from the tiny-voca dataset and model cards. Bars share one scale, readings at full width.
        </p>
      </div>
    </figure>
  )
}
