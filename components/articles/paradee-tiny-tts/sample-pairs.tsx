"use client"

import { useRef, useState } from "react"

import { mediaUrl } from "@/lib/media"

// The five held-out sentences from the model card (samples/sentences.txt), read by
// Paradee and by its teacher. The WAVs are from sahilmahendrakar/Paradee-8M-v1.0
// (tag v1.0, Apache-2.0), re-encoded to 56 kb/s mono AAC for the page; nothing was
// regenerated. Paradee's clips are the released model, phase-locking filter included.

const SENTENCES = [
  "As of August 2015, there were 169 proposed targets for these goals and 304 proposed indicators to show compliance.",
  "White dwarf stars, if they have a near companion, may then become Type Ia supernovae.",
  "According to Herodotus, this was because they had decided in council that they could not beat the Allies in a naval battle.",
  "In 1997 Hurlbut's career focused on light as applied to photography and film, and he owned a lighting business in Pasadena, California.",
  "Harvey ended with a century on his Ashes debut, scoring 112 from 183 balls in an innings noted for powerful driving on both sides of the wicket.",
]

const src = (i: number, who: "paradee" | "kokoro") =>
  mediaUrl(`/articles/paradee-tiny-tts/sample-${i + 1}-${who}.m4a`)

export function SamplePairs() {
  const [i, setI] = useState(0)
  const a = useRef<HTMLAudioElement | null>(null)
  const b = useRef<HTMLAudioElement | null>(null)

  const pick = (k: number) => {
    a.current?.pause()
    b.current?.pause()
    setI(k)
  }

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        <span className="mr-2 text-muted-foreground">held-out sentence</span>
        {SENTENCES.map((_, k) => (
          <button
            key={k}
            type="button"
            onClick={() => pick(k)}
            aria-pressed={k === i}
            className={`rounded-md border px-2 py-0.5 ${k === i ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {k + 1}
          </button>
        ))}
      </div>
      <div className="p-3 sm:p-4">
        <blockquote className="border-l-2 pl-3 text-[14px] leading-relaxed">{SENTENCES[i]}</blockquote>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="font-mono text-[11px]">Paradee, 8.07M parameters</span>
            <audio
              ref={a}
              key={`p${i}`}
              controls
              preload="none"
              src={src(i, "paradee")}
              onPlay={() => b.current?.pause()}
              className="mt-1 w-full"
            />
          </label>
          <label className="block">
            <span className="font-mono text-[11px] text-muted-foreground">Kokoro-82M, the teacher</span>
            <audio
              ref={b}
              key={`k${i}`}
              controls
              preload="none"
              src={src(i, "kokoro")}
              onPlay={() => a.current?.pause()}
              className="mt-1 w-full"
            />
          </label>
        </div>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          The model card&apos;s own samples, Apache-2.0, re-encoded for the page. The author says a slight buzz
          remains on some stressed syllables; headphones are the place to listen for it.
        </p>
      </div>
    </figure>
  )
}
