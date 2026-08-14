"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The Supported Components table from the README, turned into the question it
// actually answers: what can you assemble, and what does each choice cost you
// in portability.
//
// Counts are the rows of that table: 1 VAD, 6 STT, 3 LLM, 5 TTS.

type Slot = "STT" | "LLM" | "TTS"

type Option = { name: string; where: string; extra?: string; local: boolean }

const OPTIONS: Record<Slot, Option[]> = {
  STT: [
    { name: "Parakeet TDT (default)", where: "CUDA / CPU / Apple Silicon", local: true },
    { name: "Whisper (Transformers)", where: "CUDA / CPU", local: true },
    { name: "Faster Whisper", where: "CUDA / CPU", extra: "faster-whisper", local: true },
    { name: "Lightning Whisper MLX", where: "Apple Silicon", extra: "whisper-mlx", local: true },
    { name: "MLX Audio Whisper", where: "Apple Silicon", local: true },
    { name: "Paraformer (FunASR)", where: "CUDA / CPU", extra: "paraformer", local: true },
  ],
  LLM: [
    { name: "OpenAI-compatible API", where: "hosted or self-hosted", local: false },
    { name: "Transformers", where: "CUDA / CPU", local: true },
    { name: "mlx-lm", where: "Apple Silicon", local: true },
  ],
  TTS: [
    { name: "Qwen3-TTS (default)", where: "GGML / CUDA on Linux, mlx-audio on macOS", local: true },
    { name: "Kokoro-82M", where: "CUDA / CPU / Apple Silicon", extra: "kokoro", local: true },
    { name: "Pocket TTS (Kyutai)", where: "CPU / CUDA", extra: "pocket", local: true },
    { name: "ChatTTS", where: "CUDA / CPU", extra: "chattts", local: true },
    { name: "MMS TTS", where: "CUDA / CPU", local: true },
  ],
}

const SLOTS: Slot[] = ["STT", "LLM", "TTS"]

const LOCAL = "oklch(0.60 0.15 255)"
const REMOTE = "oklch(0.68 0.13 85)"

export function BackendMatrix() {
  const [pick, setPick] = useState<Record<Slot, number>>({ STT: 0, LLM: 0, TTS: 0 })

  const combos = OPTIONS.STT.length * OPTIONS.LLM.length * OPTIONS.TTS.length
  const chosen = SLOTS.map((s) => OPTIONS[s][pick[s]])
  const fullyLocal = chosen.every((c) => c.local)
  const extras = chosen.map((c) => c.extra).filter(Boolean)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">VAD → STT → LLM → TTS</span>
        <span className="font-mono text-[10px] text-muted-foreground">{combos} combinations</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="rounded-lg border bg-muted/20 px-3 py-2">
          <div className="font-mono text-[10px] text-muted-foreground">VAD — not swappable</div>
          <div className="font-mono text-[11px] text-foreground">Silero VAD v5 · built-in, all platforms</div>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          {SLOTS.map((s) => (
            <div key={s} className="rounded-lg border bg-muted/20 px-2.5 py-2">
              <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{s}</div>
              <div className="mt-1 space-y-0.5">
                {OPTIONS[s].map((o, i) => (
                  <button
                    key={o.name}
                    type="button"
                    onClick={() => setPick({ ...pick, [s]: i })}
                    aria-pressed={pick[s] === i}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors",
                      pick[s] === i ? "bg-muted/60" : "hover:bg-muted/30",
                    )}
                  >
                    <span
                      className="inline-block h-2 w-2 shrink-0 rounded-sm"
                      style={{ background: o.local ? LOCAL : REMOTE }}
                    />
                    <span
                      className={cn(
                        "truncate font-mono text-[10px]",
                        pick[s] === i ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {o.name}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-2 rounded-lg border bg-muted/20 px-3 py-2.5">
          <div className="font-mono text-[11px]" style={{ color: fullyLocal ? LOCAL : REMOTE }}>
            {fullyLocal ? "fully local — no network required after cache warm-up" : "one hop leaves the machine"}
          </div>
          <div className="mt-1 space-y-0.5">
            {SLOTS.map((s, i) => (
              <div key={s} className="font-mono text-[10px] text-muted-foreground">
                <span className="text-foreground">{s}</span> {chosen[i].name} · {chosen[i].where}
              </div>
            ))}
          </div>
          {extras.length ? (
            <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">
              needs extras: {extras.map((e) => `pip install speech-to-speech[${e}]`).join(" · ")}
            </div>
          ) : (
            <div className="mt-1.5 font-mono text-[10px] text-muted-foreground">every piece is in the base install</div>
          )}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Ninety combinations, and only one slot can leave the machine. The LLM row is the interesting one: the
          &ldquo;OpenAI-compatible API&rdquo; option is remote only in the sense that it speaks HTTP — point it at a{" "}
          <span className="font-mono text-foreground">llama-server</span>{" "}on localhost and the whole pipeline is
          local while still being an API client. That is a different design from embedding a model in-process, and
          it is why swapping the LLM does not mean rewriting the pipeline.
        </p>
      </div>
    </figure>
  )
}
