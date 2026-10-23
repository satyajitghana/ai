"use client"

import { useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// Seven takes made by us with Ming-3.0-tts-0.5B and the official inference code
// (github.com/inclusionAI/Ming-3.0-tts at commit 028c1ea), PyTorch 2.6.0 CPU wheels,
// bf16 weights, on a shared 4-core cloud VM on 23 Oct 2026: torch.set_num_threads(2),
// nice 19, seed 1895 (the CLI's default), cfg 2.0, temperature 0, 10 flow steps, text
// normalization off (pynini not installed). Other jobs were running; the load average
// was between 8 and 20 on 4 cores, so wall times are a ceiling, not a benchmark.
// "made in" is wall time for synthesize(), after load; RTF is that over the audio
// length (above 1 is slower than real time); RAM is the process's peak resident set
// during the call. Two takes were repeated and came back bit-identical. The
// transcripts are openai/whisper-base (transformers 4.46.3, greedy, language forced)
// reading the WAV back; the error rates are ours against the input text with the
// tags removed, after lower-casing and dropping punctuation (English: words; Chinese:
// characters). The audio is the 44.1 kHz WAV re-encoded to 32 kb/s mono Opus;
// nothing was edited or normalized.

type Kind = "voice" | "design" | "tags"

type Sample = {
  file: string
  kind: Kind
  task: string
  voice: string
  lang: "en" | "zh"
  text: string
  gloss?: string
  control?: string
  note?: string
  audio: number // s
  synth: number // s
  ram: number // GiB
  whisper: string
  err: string
  flaw?: boolean
}

const SAMPLES: Sample[] = [
  {
    file: "/articles/ming-3/sample-1-en-emma.webm",
    kind: "voice",
    task: "IP",
    voice: "US_Emma (built-in)",
    lang: "en",
    text: "The model writes sound the way a language model writes words, one small step at a time.",
    audio: 5.8,
    synth: 32.53,
    ram: 2.51,
    whisper: "The model writes sound the way a language model writes words. One small step at a time.",
    err: "WER 0%",
  },
  {
    file: "/articles/ming-3/sample-2-zh-xiaochuan.webm",
    kind: "voice",
    task: "IP",
    voice: "灵小川 (built-in)",
    lang: "zh",
    text: "这段声音是在一台只有四个处理器核心的电脑上生成的。",
    gloss: "This voice was generated on a computer with only four processor cores.",
    audio: 4.1,
    synth: 24.33,
    ram: 2.48,
    whisper: "这段声音是在一台只有四个处理器核心的电脑上声称的。",
    err: "CER 8.3% (声称 for 生成, a homophone)",
  },
  {
    file: "/articles/ming-3/sample-3-design-en.webm",
    kind: "design",
    task: "VOICE_DESIGN",
    voice: "none, described",
    lang: "en",
    control:
      "An elderly British man with a deep, gravelly voice, speaking slowly and warmly, like a grandfather reading a story by the fire.",
    text: "Long ago, before the river changed its course, there was a mill at the bottom of this hill.",
    audio: 6.2,
    synth: 50.09,
    ram: 2.56,
    whisper: "Long ago, before the river changed its course, there was a mill at the bottom of this hill.",
    err: "WER 0%",
  },
  {
    file: "/articles/ming-3/sample-4-design-zh-whisper.webm",
    kind: "design",
    task: "VOICE_DESIGN",
    voice: "none, described",
    lang: "zh",
    control: "The cookbook's own ASMR description: a woman whispering very softly and slowly, breathy, close to the microphone.",
    text: "别说话，听，外面在下雨，雨点一颗一颗落在窗台上。",
    gloss: "Don't speak. Listen: it is raining outside, the drops landing one by one on the windowsill.",
    note: "The flaw: not a whisper, and louder than either plain voice. The stop head never fired: the loop ran 304 steps, 24.32 s, into its cache limit, and 18.6 s of silence was trimmed.",
    audio: 5.7,
    synth: 363.28,
    ram: 2.62,
    whisper: "别说话 听外面在下雨雨点一刻一刻落在窗台上",
    err: "CER 10.0% (刻 for 颗, twice)",
    flaw: true,
  },
  {
    file: "/articles/ming-3/sample-5-tags-en-laugh.webm",
    kind: "tags",
    task: "IP + inline tag",
    voice: "US_James (built-in)",
    lang: "en",
    text: "I told it to laugh in the middle of a sentence [Laughter] and it actually did.",
    audio: 5.4,
    synth: 46.75,
    ram: 2.62,
    whisper: "I told it to laugh in the middle of a sentence. And it actually did.",
    err: "WER 0% (tag removed from the reference)",
  },
  {
    file: "/articles/ming-3/sample-6-tags-zh-sigh.webm",
    kind: "tags",
    task: "IP + inline tags",
    voice: "灵小川 (built-in)",
    lang: "zh",
    text: "[Sigh]雨还是没有停，[Cough]我们恐怕只能把活动改到室内了。",
    gloss: "(sigh) It still hasn't stopped raining. (cough) I'm afraid we'll have to move the event indoors.",
    note: "The README's own tag example, on a built-in voice instead of its reference clip.",
    audio: 4.1,
    synth: 49.8,
    ram: 2.58,
    whisper: "语还是没有听,我们恐怕只能把活动改到室内了。",
    err: "CER 10.0% (语 for 雨, 听 for 停)",
  },
  {
    file: "/articles/ming-3/sample-7-freeform-coach.webm",
    kind: "design",
    task: "FREEFORM",
    voice: "none, instructed",
    lang: "en",
    control: "Sound like an encouraging sports coach, energetic and firm without shouting.",
    text: "Keep your eyes forward and your shoulders relaxed. One more round, you can do this!",
    note: "Needed a one-line dtype cast to run on a CPU; see the text.",
    audio: 4.4,
    synth: 43.51,
    ram: 2.5,
    whisper: "Keep your eyes forward and your shoulders relaxed. One more round you can do this.",
    err: "WER 0%",
  },
]

const FILTERS: { id: "all" | Kind; label: string }[] = [
  { id: "all", label: "all seven" },
  { id: "voice", label: "built-in voices" },
  { id: "design", label: "voice from a description" },
  { id: "tags", label: "inline tags" },
]

const fmt = (x: number, d = 2) => x.toFixed(d)

export function SamplePlayer() {
  const [filter, setFilter] = useState<"all" | Kind>("all")
  const [playing, setPlaying] = useState<string | null>(null)
  const refs = useRef<Record<string, HTMLAudioElement | null>>({})

  const onPlay = (file: string) => {
    for (const [k, el] of Object.entries(refs.current)) if (k !== file) el?.pause()
    setPlaying(file)
  }

  const shown = SAMPLES.filter((s) => filter === "all" || s.kind === filter)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">Ming-3.0-tts-0.5B, CPU, 2 threads</span>
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
                <span>task {s.task}</span>
                <span className="text-muted-foreground">voice {s.voice}</span>
                <span className="text-muted-foreground">{s.lang}</span>
                {s.flaw ? (
                  <span className="rounded border border-amber-500/60 px-1.5 text-amber-700 dark:text-amber-400">flaw</span>
                ) : null}
              </div>
              {s.control ? (
                <p className="mt-2 text-[12px] text-muted-foreground">
                  <span className="font-mono text-[10.5px]">asked for:</span> {s.control}
                </p>
              ) : null}
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
                  <dt className="inline text-muted-foreground">peak RAM </dt>
                  <dd className="inline">{fmt(s.ram)} GiB</dd>
                </div>
              </dl>
              <div className="mt-2 space-y-0.5 text-[12px]">
                <p lang={s.lang}>
                  <span className="font-mono text-[10.5px] text-muted-foreground">Whisper-base hears:</span>{" "}
                  {s.whisper}
                </p>
                <p className="font-mono text-[10.5px] text-muted-foreground">{s.err}</p>
              </div>
            </li>
          )
        })}
      </ol>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Generated by us on a shared 4-core CPU VM, 23 Oct 2026: the official Ming-3.0-tts code, bf16, 2 threads, seed
        1895, nice 19 with other jobs running. RTF is synthesis time over audio length, so 5.61 means 5.61 times
        slower than real time. Opus at 32 kb/s, not loudness-normalized. Error rates are ours, against the input text;
        Whisper-base is a small recognizer and its Chinese errors here are all near-homophones.
      </figcaption>
    </figure>
  )
}
