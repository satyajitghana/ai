"use client"

import { useState } from "react"

// Small open TTS models on one table, every number from the Paradee paper
// (arXiv 2610.06817), Table 2 and Table 3: 200 held-out WikiText-103 sentences,
// UTMOS utmos22_strong, Whisper (base) WER, real-time factor on one CPU thread of
// an Apple M4 Pro. The paper's own caveats travel with each row:
//   - Kokoro and Paradee are timed from phonemes; Piper and KittenTTS from text,
//     so their times include phonemization.
//   - File size is the model as distributed: Paradee int8, everything else fp32.
//   - Each model speaks its own voice, so UTMOS compares naturalness, not
//     closeness to af_heart.
// The released ONNX row is from the same table (it reports no confidence interval).

type Metric = "params" | "size" | "speed" | "utmos" | "wer"

type Row = {
  name: string
  voice: string
  params: number // millions
  size: number // MB
  speed: number // x real time, 1 thread
  utmos: number
  wer: number // %
  timed: "phonemes" | "text"
  hl?: boolean
}

const ROWS: Row[] = [
  { name: "Kokoro-82M (teacher)", voice: "af_heart", params: 81.8, size: 325, speed: 7.6, utmos: 4.52, wer: 5.7, timed: "phonemes" },
  { name: "Paradee (paper)", voice: "af_heart", params: 8.07, size: 8.45, speed: 25.0, utmos: 4.41, wer: 5.7, timed: "phonemes", hl: true },
  { name: "Paradee, released ONNX", voice: "af_heart", params: 8.07, size: 9.0, speed: 17.8, utmos: 4.41, wer: 6.0, timed: "phonemes", hl: true },
  { name: "Kokoro-7M-Distill", voice: "af_msa", params: 7.48, size: 30.1, speed: 35.5, utmos: 4.18, wer: 7.4, timed: "phonemes" },
  { name: "Piper lessac-medium", voice: "lessac", params: 15.7, size: 63.2, speed: 15.4, utmos: 4.36, wer: 8.8, timed: "text" },
  { name: "KittenTTS nano 0.8", voice: "Bella", params: 14.0, size: 56.8, speed: 10.7, utmos: 4.01, wer: 5.5, timed: "text" },
]

const METRICS: { id: Metric; label: string; unit: string; better: "low" | "high"; lo: number; hi: number; note: string }[] = [
  { id: "params", label: "parameters", unit: "M", better: "low", lo: 0, hi: 82, note: "Linear scale from zero." },
  { id: "size", label: "file size", unit: "MB", better: "low", lo: 0, hi: 325, note: "As distributed: Paradee in int8, the others in fp32." },
  { id: "speed", label: "speed, 1 thread", unit: "x RT", better: "high", lo: 0, hi: 36, note: "Real-time factor on one M4 Pro CPU thread. Hatched rows include phonemization; the others do not." },
  { id: "utmos", label: "UTMOS", unit: "", better: "high", lo: 3.8, hi: 4.6, note: "The axis starts at 3.8, not zero, so small gaps look large. Predicted naturalness, 1 to 5." },
  { id: "wer", label: "Whisper WER", unit: "%", better: "low", lo: 0, hi: 9, note: "Whisper (base) word error rate against the source text. Linear from zero." },
]

const GREEN = "oklch(0.62 0.16 155)"
const GREY = "oklch(0.62 0.03 250)"

export function TtsLadder() {
  const [m, setM] = useState<Metric>("size")
  const meta = METRICS.find((x) => x.id === m) ?? METRICS[0]
  const rows = [...ROWS].sort((a, b) => (meta.better === "low" ? a[m] - b[m] : b[m] - a[m]))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {METRICS.map((x) => (
          <button
            key={x.id}
            type="button"
            onClick={() => setM(x.id)}
            aria-pressed={m === x.id}
            className={`rounded-md border px-2 py-0.5 ${m === x.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {x.label}
          </button>
        ))}
        <span className="ml-auto text-muted-foreground">{meta.better === "low" ? "lower is better" : "higher is better"}</span>
      </div>

      <div className="space-y-1.5 p-3 sm:p-4">
        {rows.map((r) => {
          const v = r[m]
          const pct = Math.max(0, Math.min(100, ((v - meta.lo) / (meta.hi - meta.lo)) * 100))
          const hatch = m === "speed" && r.timed === "text"
          return (
            <div key={r.name} className="grid grid-cols-[9rem_1fr] items-center gap-2 sm:grid-cols-[12rem_1fr]">
              <span className="min-w-0">
                <span className={`block truncate text-[13px] ${r.hl ? "font-medium" : ""}`}>{r.name}</span>
                <span className="block font-mono text-[10px] text-muted-foreground">voice {r.voice}</span>
              </span>
              <span className="flex items-center gap-2">
                <span
                  className="block h-3 rounded-sm"
                  style={{
                    width: `${pct.toFixed(2)}%`,
                    minWidth: 2,
                    background: hatch
                      ? `repeating-linear-gradient(45deg, ${GREY}, ${GREY} 3px, transparent 3px, transparent 6px)`
                      : r.hl
                        ? GREEN
                        : GREY,
                  }}
                />
                <span className="shrink-0 font-mono text-[11px]">
                  {v}
                  {meta.unit === "x RT" ? "x" : meta.unit ? ` ${meta.unit}` : ""}
                </span>
              </span>
            </div>
          )
        })}
        <p className="pt-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
          {meta.note} All rows: Paradee paper, Tables 2 and 3, 200 held-out sentences, each model in its own voice.
        </p>
      </div>
    </figure>
  )
}
