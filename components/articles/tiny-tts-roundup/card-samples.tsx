"use client"

import { useRef } from "react"

import { mediaUrl } from "@/lib/media"

// The publishers' own samples, re-encoded to 56 kb/s mono AAC for the page; nothing regenerated.
// tiny-voca: samples/F2-2.wav, F2-4.wav, M2-4.wav from n4ze3m/tiny-voca (Apache-2.0); the texts are
// printed in its model card. Tontaube: assets/showcase/*.mp3 from TontaubeAI/TontaubeV1.1-int4,
// which the card says were made with the int4 model and loudness-normalised; it does not print the
// texts, and the showcase files are outside the model licence's covered files.

type Clip = { file: string; who: string; text?: string }

const CLIPS: Clip[] = [
  {
    file: "card-tinyvoca-F2-4",
    who: "tiny-voca, voice F2",
    text: "She had never seen the sea before, and for a long while she stood at the edge of the water without saying a word.",
  },
  {
    file: "card-tinyvoca-M2-4",
    who: "tiny-voca, voice M2",
    text: "She had never seen the sea before, and for a long while she stood at the edge of the water without saying a word.",
  },
  {
    file: "card-tinyvoca-F2-2",
    who: "tiny-voca, voice F2",
    text: "The meeting moved to 3:30 pm on March 14th, so we have about 45 minutes left.",
  },
  { file: "card-tontaube-english-audiobook-01", who: "TontaubeV1.1-int4, audiobook style" },
  { file: "card-tontaube-english-agentic-01", who: "TontaubeV1.1-int4, agentic style" },
]

export function CardSamples() {
  const refs = useRef<(HTMLAudioElement | null)[]>([])
  const solo = (k: number) => refs.current.forEach((a, j) => j !== k && a?.pause())

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-[11px] text-muted-foreground">
        the publishers&apos; own samples, as released
      </div>
      <div className="grid gap-3 p-3 sm:grid-cols-2 sm:p-4">
        {CLIPS.map((c, k) => (
          <label key={c.file} className="block rounded-lg border p-2.5">
            <span className="block font-mono text-[11px]">{c.who}</span>
            <span className="mt-1 block min-h-[2.5rem] text-[13px] leading-snug text-muted-foreground">
              {c.text ?? "The model card does not print this clip's text."}
            </span>
            <audio
              ref={(el) => {
                refs.current[k] = el
              }}
              controls
              preload="none"
              src={mediaUrl(`/articles/tiny-tts-roundup/${c.file}.m4a`)}
              onPlay={() => solo(k)}
              className="mt-2 w-full"
            />
          </label>
        ))}
      </div>
      <p className="px-4 pb-3 font-mono text-[10px] text-muted-foreground">
        Re-encoded to 56 kb/s AAC. Kitten TTS 2 Mini&apos;s card ships no samples.
      </p>
    </figure>
  )
}
