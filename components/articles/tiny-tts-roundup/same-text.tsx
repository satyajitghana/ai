"use client"

import { useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// The same texts read by all three models on beast2 (run.sh in the article's notes): Kitten TTS 2
// Mini through its int8 ONNX graph on the CPU (voice Eleanor), tiny-voca through PyTorch on the CPU
// (voice F2), TontaubeV1.1-int4 on the RTX 3090 with its server defaults (built-in voice, audiobook
// style, seed 1234). Clips are the run's output re-encoded to 48 kb/s AAC; nothing was edited.

const TEXTS: { id: string; label: string; text: string }[] = [
  { id: "s1", label: "question", text: "Can you hear the difference between a voice that was recorded and one that was computed?" },
  { id: "s2", label: "numbers", text: "The RTX 4090 cost $1,599 at launch on October 12, 2022, and drew 450 watts." },
  {
    id: "s3",
    label: "passage",
    text: "The lighthouse keeper climbed the spiral stairs every evening at dusk. He counted the steps out of habit, though he had long since memorized the number. At the top, he wiped the salt from the glass, lit the lamp, and watched its beam sweep across the dark water, searching for ships that rarely came anymore.",
  },
  { id: "s4", label: "names", text: "Wait, you're telling me Dr. Nakamura flew from Reykjavik to Bengaluru just to read the speech aloud?" },
]

const MODELS: { key: string; name: string; note: string }[] = [
  { key: "tinyvoca-torch", name: "tiny-voca", note: "voice F2, CPU" },
  { key: "kitten-onnx", name: "Kitten TTS 2 Mini", note: "voice Eleanor, int8 ONNX, CPU" },
  { key: "tontaube-gpu", name: "TontaubeV1.1-int4", note: "built-in voice, RTX 3090" },
]

export function SameText() {
  const [t, setT] = useState(0)
  const refs = useRef<(HTMLAudioElement | null)[]>([])
  const cur = TEXTS[t]
  const solo = (k: number) => refs.current.forEach((a, j) => j !== k && a?.pause())

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">same text</span>
        {TEXTS.map((x, k) => (
          <button
            key={x.id}
            type="button"
            onClick={() => {
              refs.current.forEach((a) => a?.pause())
              setT(k)
            }}
            aria-pressed={k === t}
            className={`rounded-md border px-2 py-0.5 ${k === t ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <blockquote className="border-l-2 pl-3 text-[14px] leading-relaxed">{cur.text}</blockquote>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {MODELS.map((m, k) => (
            <label key={m.key} className="block">
              <span className="block font-mono text-[11px]">{m.name}</span>
              <span className="block font-mono text-[10px] text-muted-foreground">{m.note}</span>
              <audio
                ref={(el) => {
                  refs.current[k] = el
                }}
                key={`${m.key}-${cur.id}`}
                controls
                preload="none"
                src={mediaUrl(`/articles/tiny-tts-roundup/${m.key}_${cur.id}.m4a`)}
                onPlay={() => solo(k)}
                className="mt-1 w-full"
              />
            </label>
          ))}
        </div>
      </div>
    </figure>
  )
}
