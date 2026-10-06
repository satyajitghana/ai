"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// The interfaze-1-lite bundle, folder by folder, and which folders each public
// method touches. Bytes are the Hub API's file sizes for the bundle at commit
// 1bfa94c (measured). Parameter counts: "measured" were summed from the
// safetensors headers; "hub" is the upstream repo's own safetensors metadata;
// "reasoned" is file size / 4 for a float32 Paddle or PyTorch file. The task ->
// component map is read from modeling_interfaze_lite.py, not run.

type Basis = "measured" | "hub" | "reasoned"

type Part = {
  id: string
  folder: string
  role: string
  upstream: string
  params: string
  basis: Basis
  gb: number // bundle bytes, GB (1e9)
  bundled: boolean
  signal: string // what it hands back besides content
}

const PARTS: Part[] = [
  { id: "brain", folder: "brain/", role: "Reasoning core", upstream: "Qwen/Qwen3.8-27B-FP8", params: "27.78B", basis: "measured", gb: 30.889, bundled: true, signal: "boxes on a 0-1000 grid (from generated text)" },
  { id: "ocr_vlm", folder: "ocr_vlm/", role: "Document reader", upstream: "datalab-to/chandra-ocr-2", params: "5.30B", basis: "measured", gb: 10.611, bundled: true, signal: "text and reading order; no confidence" },
  { id: "asr", folder: "asr_fallback/", role: "Speech", upstream: "openai/whisper-large-v3-turbo", params: "0.81B", basis: "measured", gb: 1.622, bundled: true, signal: "timestamps; no confidence" },
  { id: "segmenter", folder: "segmenter/", role: "Segmentation", upstream: "facebook/sam2.1-hiera-large", params: "224M", basis: "hub", gb: 0.898, bundled: true, signal: "outlines; its mask scores are dropped" },
  { id: "layout", folder: "layout/", role: "Layout", upstream: "PaddlePaddle/PP-DocLayout_plus-L", params: "~32M", basis: "reasoned", gb: 0.134, bundled: true, signal: "typed blocks with a score" },
  { id: "line_det", folder: "line_detector/", role: "Line geometry", upstream: "PaddlePaddle/PP-OCRv5_server_det", params: "~22M", basis: "reasoned", gb: 0.09, bundled: true, signal: "a quad per line" },
  { id: "line_rec", folder: "line_recognizer/", role: "Line geometry", upstream: "PaddlePaddle/en_PP-OCRv5_mobile_rec", params: "~1.9M", basis: "reasoned", gb: 0.009, bundled: true, signal: "a score per line: the confidence" },
  { id: "diarizer", folder: "diarizer/", role: "Diarization", upstream: "pyannote/speaker-diarization-community-1", params: "~8M", basis: "reasoned", gb: 0.033, bundled: true, signal: "speaker turns" },
  { id: "guard", folder: "(not in bundle)", role: "Guardrails", upstream: "meta-llama/Llama-Guard-3-1B", params: "1.50B", basis: "hub", gb: 0, bundled: false, signal: "unsafe probability" },
  { id: "forecaster", folder: "(not in bundle)", role: "Forecasting", upstream: "google/timesfm-2.5-200m-pytorch", params: "231M", basis: "hub", gb: 0, bundled: false, signal: "point forecast; quantiles dropped" },
]

type Task = { id: string; call: string; uses: string[]; note: string }

const TASKS: Task[] = [
  { id: "ocr", call: "ocr()", uses: ["ocr_vlm", "line_det", "line_rec", "layout"], note: "Three readers run concurrently on every page: the document reader for text, the Paddle pair for a box and a score per line, the layout detector for typed blocks. The brain is never loaded." },
  { id: "transcribe", call: "transcribe()", uses: ["asr"], note: "Whisper large-v3 turbo alone. Audio past 120 s is cut at quiet points into windows of at most 30 s and decoded 16 at a time." },
  { id: "speakers", call: "transcribe(by_speaker=True)", uses: ["asr", "diarizer"], note: "Whisper for words, pyannote for who spoke when; each word goes to the speaker whose turn overlaps it most." },
  { id: "detect", call: "detect()", uses: ["brain", "segmenter"], note: "The 27B core writes boxes as text on a 0-1000 grid; SAM 2.1 turns each box into an outline." },
  { id: "ground", call: "ground()", uses: ["brain"], note: "GUI grounding is the core alone, tiling large screenshots." },
  { id: "chat", call: "chat(files=…)", uses: ["brain", "ocr_vlm", "line_det", "line_rec", "layout", "asr", "diarizer", "segmenter"], note: "The core gets four tools (ocr, stt, object_detection, gui_detection) and up to six tool-calling turns. Every folder it might reach is shown; a given request loads only what the core calls." },
  { id: "moderate", call: "moderate()", uses: ["guard"], note: "Llama Guard 3 1B. Its weights are not in the bundle." },
  { id: "forecast", call: "forecast()", uses: ["forecaster"], note: "TimesFM 2.5. Its weights are not in the bundle either." },
]

const BASIS_LABEL: Record<Basis, string> = {
  measured: "measured, safetensors header",
  hub: "upstream's Hub metadata",
  reasoned: "reasoned, bytes / 4",
}

const ACCENT = "oklch(0.64 0.15 45)"
const TOTAL_GB = 44.289

export function MoaBundle() {
  const [task, setTask] = useState<string>("ocr")
  const t = TASKS.find((x) => x.id === task) ?? TASKS[0]
  const used = new Set(t.uses)
  const usedGb = PARTS.filter((p) => used.has(p.id)).reduce((s, p) => s + p.gb, 0)
  const missing = PARTS.filter((p) => used.has(p.id) && !p.bundled)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        interfaze-1-lite, folder by folder &middot; pick a call to see which checkpoints it loads
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Method">
          {TASKS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setTask(x.id)}
              aria-pressed={task === x.id}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[11px] transition-colors",
                task === x.id
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {x.call}
            </button>
          ))}
        </div>

        {/* One bar for the 44.3 GB bundle; each folder is a segment. */}
        <div className="mt-4 flex h-5 w-full overflow-hidden rounded-sm border" aria-hidden>
          {PARTS.filter((p) => p.bundled).map((p) => (
            <div
              key={p.id}
              title={`${p.folder} ${p.gb.toFixed(3)} GB`}
              style={{
                width: `${(p.gb / TOTAL_GB) * 100}%`,
                minWidth: "2px",
                background: used.has(p.id) ? ACCENT : "oklch(0.62 0.02 260 / 0.35)",
              }}
              className="border-r border-background last:border-r-0"
            />
          ))}
        </div>
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">
          {t.call} loads {usedGb.toFixed(1)} GB of the {TOTAL_GB.toFixed(1)} GB bundle
          {missing.length > 0 ? `, plus ${missing.map((m) => m.upstream).join(", ")} from outside it` : ""}
        </p>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="py-1.5 pr-2 font-normal">Role</th>
                <th className="py-1.5 pr-2 font-normal">Upstream checkpoint</th>
                <th className="py-1.5 pr-2 text-right font-normal">Params</th>
                <th className="py-1.5 pr-2 text-right font-normal">GB</th>
                <th className="py-1.5 font-normal">Hands back</th>
              </tr>
            </thead>
            <tbody>
              {PARTS.map((p) => {
                const on = used.has(p.id)
                return (
                  <tr
                    key={p.id}
                    className={cn("border-b border-border/50 transition-opacity", on ? "opacity-100" : "opacity-40")}
                  >
                    <td className="py-1.5 pr-2">
                      <span className="inline-flex items-center gap-1.5">
                        <span
                          className="inline-block size-2 rounded-full"
                          style={{ background: on ? ACCENT : "transparent", border: `1px solid ${ACCENT}` }}
                        />
                        {p.role}
                      </span>
                    </td>
                    <td className="py-1.5 pr-2 font-mono text-[11px]">{p.upstream}</td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums" title={BASIS_LABEL[p.basis]}>
                      {p.params}
                      <sup className="ml-0.5 text-[9px] text-muted-foreground">
                        {p.basis === "measured" ? "m" : p.basis === "hub" ? "h" : "r"}
                      </sup>
                    </td>
                    <td className="py-1.5 pr-2 text-right font-mono tabular-nums">
                      {p.bundled ? p.gb.toFixed(2) : "—"}
                    </td>
                    <td className="py-1.5 text-muted-foreground">{p.signal}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">{t.note}</p>
        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          m = measured from the safetensors headers &middot; h = the upstream repo&rsquo;s own Hub metadata &middot; r =
          reasoned, file bytes / 4 for float32 Paddle and PyTorch files. Every weight file in the bundle has the same
          SHA-256 as the upstream file it came from.
        </p>
      </div>
    </figure>
  )
}
