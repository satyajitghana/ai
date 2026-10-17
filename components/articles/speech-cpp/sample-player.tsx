"use client"

import { useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// Eight takes made by us with speech.cpp 0.8.9 (commit 32cbe28), built from source
// for the CPU, on a shared 4-core Xeon VM on 17 Oct 2026: `speech tts ... --threads 2
// --seed 1`, run under nice 19 while other jobs shared the machine. Every number is
// the engine's own report for that run (`-v`): seconds of audio, time to first
// audio, and the synthesis time, whose ratio to the audio is the real-time factor
// (RTF; above 1 is slower than real time). The transcripts are speech.cpp's own
// recognizers reading the WAV back: Qwen3-ASR 0.6B (Q8_0) for every take, and
// Parakeet TDT 0.6B v3 (Q8_0) for the English ones. Error rates are computed by us
// against the input text, after lower-casing, dropping punctuation and treating a
// number written as digits or as words as the same word. The audio is the WAV
// re-encoded to 32 kb/s mono Opus; nothing was edited or normalized.

type Family = "qwen" | "irodori"

type Sample = {
  file: string
  family: Family
  model: string
  voice: string
  lang: "en" | "ja"
  text: string
  gloss?: string
  note?: string
  audio: number // s
  synth: number // s, synthesis after load
  ttfa: number // s, time to first audio after load
  qwenAsr: string
  parakeet?: string
  err: string
  flaw?: boolean
}

const SAMPLES: Sample[] = [
  {
    file: "/articles/speech-cpp/sample-1-ryan.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "ryan",
    lang: "en",
    text: "One program reads the text, runs the talker, and streams the waveform while the rest is still being made.",
    audio: 7.6,
    synth: 28.8,
    ttfa: 0.876,
    qwenAsr: "One program reads the text, runs the talker, and streams the waveform while the rest is still being made.",
    parakeet: "One program reads the text, runs the talker, and streams the waveform while the rest is still being made.",
    err: "WER 0% / 0%",
  },
  {
    file: "/articles/speech-cpp/sample-2-aiden.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "aiden",
    lang: "en",
    text: "Each frame is eighty milliseconds of sound, sixteen codes deep, and it is decoded the moment it exists.",
    audio: 7.44,
    synth: 29.14,
    ttfa: 0.682,
    qwenAsr: "Each frame is 80 milliseconds of sound, 16 codes deep, and it is decoded the moment it exists.",
    parakeet: "Each frame is 80 milliseconds of sound, 16 codes deep, and it is decoded the moment it exists.",
    err: "WER 0% / 0% (digits for words)",
  },
  {
    file: "/articles/speech-cpp/sample-3-serena.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "serena",
    lang: "en",
    note: "A Chinese voice of the model, asked for English.",
    text: "Every stage was compared with the official implementation, on the same inputs, before it shipped.",
    audio: 7.12,
    synth: 26.86,
    ttfa: 0.673,
    qwenAsr: "Every stage was compared with the official implementation, on the same inputs before it shipped.",
    parakeet: "Every stage was compared with the official implementation on the same inputs before it shipped.",
    err: "WER 0% / 0%",
  },
  {
    file: "/articles/speech-cpp/sample-4-ryan-numbers.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "ryan",
    lang: "en",
    note: "Digits, a version string and a unit, written as digits.",
    text: "Version 0.8.8 shipped on October 16, and the Drama 3 file weighs 20.8 GB.",
    audio: 9.92,
    synth: 39.17,
    ttfa: 0.766,
    qwenAsr: "Version 0.8.8 shipped on October 16th, and the drama 3 file weighs 20.8 gigabytes.",
    parakeet: "Version 0.8.8 shipped on October 16 and the DRAMA 3 file weighs 20.8 GB.",
    err: "WER 0% / 0% (16th, gigabytes)",
  },
  {
    file: "/articles/speech-cpp/sample-5-ryan-speechcpp.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "ryan",
    lang: "en",
    note: "The flaw: both recognizers hear the project's own name wrongly.",
    text: "Run speech.cpp, pull the GGUF file, and pick Q4_K when memory is tight.",
    audio: 9.6,
    synth: 35.77,
    ttfa: 0.74,
    qwenAsr: "Run SpeechBox PP. Pull the G GUF file and pick Q4K when memory is tight.",
    parakeet: "Run SpeechBoss BP Pull the G GUF file and pick Q4K when memory is tight.",
    err: "WER 35.7% / 35.7%",
    flaw: true,
  },
  {
    file: "/articles/speech-cpp/sample-6-ono-anna.webm",
    family: "qwen",
    model: "qwen3-tts-0.6b, Q8_0",
    voice: "ono_anna",
    lang: "ja",
    text: "今日は四つのCPUコアだけで、日本語の音声を合成しています。",
    gloss: "Today I am synthesizing Japanese speech on just four CPU cores.",
    note: "Quiet: about 10 dB below aiden's take.",
    audio: 5.44,
    synth: 21.56,
    ttfa: 0.853,
    qwenAsr: "今日は四つの CPU コアだけで日本語の音声を合成しています。",
    err: "CER 0%",
  },
  {
    file: "/articles/speech-cpp/sample-7-irodori-design.webm",
    family: "irodori",
    model: "irodori-tts-mf, Q4_K",
    voice: "none, with instructions",
    lang: "ja",
    text: "明日の東京は晴れですが、夕方から少し風が強くなるでしょう。",
    gloss: "Tomorrow Tokyo will be sunny, but the wind will pick up a little from the evening.",
    note: "Instructions: 落ち着いた女性の声で、ゆっくりと読み上げてください (read it slowly, in a calm female voice).",
    audio: 6.16,
    synth: 27.97,
    ttfa: 5.087,
    qwenAsr: "明日の東京は晴れですが、夕方から少し風が強くなるでしょう。",
    err: "CER 0%",
  },
  {
    file: "/articles/speech-cpp/sample-8-irodori-clone.webm",
    family: "irodori",
    model: "irodori-tts-mf, Q4_K",
    voice: "take 6 as the reference",
    lang: "ja",
    text: "小さなパソコンでも、声はちゃんと作れます。",
    gloss: "Even a small computer can make a proper voice.",
    note: "Irodori given the ono_anna WAV above as its reference recording.",
    audio: 4.0,
    synth: 17.52,
    ttfa: 4.01,
    qwenAsr: "小さなパソコンでも声はちゃんと作れます。",
    err: "CER 0%",
  },
]

const FILTERS: { id: "all" | Family; label: string }[] = [
  { id: "all", label: "all eight" },
  { id: "qwen", label: "Qwen3-TTS 0.6B" },
  { id: "irodori", label: "Irodori-TTS MF" },
]

const fmt = (x: number, d = 2) => x.toFixed(d)

export function SamplePlayer() {
  const [filter, setFilter] = useState<"all" | Family>("all")
  const [playing, setPlaying] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLAudioElement | null>>({})

  const onPlay = (file: string) => {
    for (const [k, el] of Object.entries(refs.current)) if (k !== file) el?.pause()
    setPlaying(file)
  }

  const shown = SAMPLES.filter((s) => filter === "all" || s.family === filter)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">speech.cpp 0.8.9, CPU, 2 threads</span>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            className={`rounded-md border px-2 py-0.5 ${filter === f.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {f.label}
          </button>
        ))}
      </div>
      <ol className="divide-y">
        {shown.map((s) => {
          const n = SAMPLES.indexOf(s) + 1
          const rtf = s.synth / s.audio
          return (
            <li key={s.file} className={`p-3 sm:p-4 ${playing === s.file ? "bg-muted/30" : ""}`}>
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 font-mono text-[11px]">
                <span className="rounded border px-1.5">{n}</span>
                <span>{s.model}</span>
                <span className="text-muted-foreground">voice {s.voice}</span>
                <span className="text-muted-foreground">{s.lang}</span>
                {s.flaw ? (
                  <span className="rounded border border-amber-500/60 px-1.5 text-amber-700 dark:text-amber-400">flaw</span>
                ) : null}
              </div>
              <blockquote lang={s.lang} className="mt-2 border-l-2 pl-3 text-[14px] leading-relaxed">
                {s.text}
              </blockquote>
              {s.gloss ? <p className="mt-1 pl-3.5 text-[12px] italic text-muted-foreground">{s.gloss}</p> : null}
              {s.note ? <p className="mt-1 pl-3.5 text-[12px] text-muted-foreground">{s.note}</p> : null}
              <audio
                ref={(el) => {
                  refs.current[s.file] = el
                }}
                controls
                preload="none"
                src={mediaUrl(s.file)}
                onPlay={() => onPlay(s.file)}
                onPause={() => setPlaying((p) => (p === s.file ? null : p))}
                className="mt-2 w-full"
              >
                <a href={mediaUrl(s.file)}>Download the take (Opus in WebM)</a>
              </audio>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 font-mono text-[10.5px] sm:grid-cols-4">
                <div>
                  <dt className="inline text-muted-foreground">audio </dt>
                  <dd className="inline">{fmt(s.audio)} s</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">made in </dt>
                  <dd className="inline">{fmt(s.synth)} s</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">RTF </dt>
                  <dd className="inline">{fmt(rtf)}</dd>
                </div>
                <div>
                  <dt className="inline text-muted-foreground">first audio </dt>
                  <dd className="inline">{fmt(s.ttfa, 3)} s</dd>
                </div>
              </dl>
              <div className="mt-2 space-y-0.5 text-[12px]">
                <p lang={s.lang}>
                  <span className="font-mono text-[10.5px] text-muted-foreground">Qwen3-ASR 0.6B hears:</span>{" "}
                  {s.qwenAsr}
                </p>
                {s.parakeet ? (
                  <p>
                    <span className="font-mono text-[10.5px] text-muted-foreground">Parakeet TDT v3 hears:</span>{" "}
                    {s.parakeet}
                  </p>
                ) : null}
                <p className="font-mono text-[10.5px] text-muted-foreground">{s.err}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Generated on a shared 4-core CPU VM by us, 17 Oct 2026: speech.cpp built from source, 2 threads, seed 1,
        nice 19 with other jobs running. RTF is synthesis time over audio length, so 3.8 means 3.8 times slower than
        real time. Opus at 32 kb/s, not loudness-normalized. Error rates are ours, against the input text.
      </figcaption>
    </figure>
  )
}
