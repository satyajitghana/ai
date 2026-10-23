"use client"

import { useState } from "react"

// Where the five Ming-3.0 headline sizes come from. Every number below is a count of
// tensor elements, read by us from the safetensors headers of the five Hugging Face
// repositories (HTTP range requests, 23 Oct 2026; nothing was downloaded but the
// headers). Units are millions of parameters. "Active" for a routed-expert block is
// 8 of its experts (num_experts_per_tok = 8 in every config), so it is the block's
// expert parameters times 8/128 (tiny models) or 8/512 (flash); everything that is
// not a routed expert counts in full. The published claims are the model cards' and
// the launch post's. Which parts belong in a headline is a convention, and the five
// cards do not share one: that is what the toggles show.

type Part = {
  id: string
  label: string
  total: number // M params
  active: number // M params used per decode step
  note: string
}

type Model = {
  id: string
  name: string
  claimTotal: string
  claimActive?: string
  parts: Part[]
  headline: string[] // the parts that reproduce the published total
  headlineActive?: string[] // the parts that reproduce the published active count, if different
}

const MODELS: Model[] = [
  {
    id: "tts05",
    name: "Ming-3.0-tts-0.5B",
    claimTotal: "0.5B",
    parts: [
      { id: "llm", label: "Qwen2.5 backbone (tied embedding)", total: 494.0, active: 494.0, note: "24 layers, 896 wide" },
      { id: "dit", label: "DiT patch head", total: 103.1, active: 103.1, note: "8 blocks, 1024 wide, 10 flow steps x 2 for guidance" },
      { id: "agg", label: "aggregator", total: 101.7, active: 101.7, note: "feeds each new latent back in" },
      { id: "dec", label: "audio VAE decoder", total: 361.1, active: 361.1, note: "latents to 44.1 kHz waveform" },
      { id: "enc", label: "audio VAE encoder", total: 419.3, active: 0, note: "only for a reference clip" },
    ],
    headline: ["llm"],
  },
  {
    id: "ttstiny",
    name: "Ming-3.0-tts-tiny",
    claimTotal: "7.9B",
    claimActive: "1.3B",
    parts: [
      { id: "emb", label: "input embedding", total: 241.4, active: 241.4, note: "157,184 x 1,536" },
      { id: "head", label: "output head", total: 241.4, active: 241.4, note: "untied" },
      { id: "dense", label: "attention, layer-0 FFN, shared experts", total: 464.8, active: 464.8, note: "18 KDA + 6 MLA layers" },
      { id: "exp", label: "routed experts", total: 6945.8, active: 434.1, note: "23 layers x 128, 8 used" },
      { id: "dit", label: "DiT patch head", total: 204.5, active: 204.5, note: "16 blocks" },
      { id: "agg", label: "aggregator", total: 102.4, active: 102.4, note: "" },
      { id: "dec", label: "audio VAE decoder", total: 361.1, active: 361.1, note: "" },
      { id: "enc", label: "audio VAE encoder", total: 419.3, active: 0, note: "reference clip only" },
    ],
    headline: ["emb", "head", "dense", "exp"],
  },
  {
    id: "flash",
    name: "Ming-3.0-audio-flash",
    claimTotal: "126B",
    claimActive: "6.5B",
    parts: [
      { id: "emb", label: "input embedding", total: 402.4, active: 402.4, note: "157,184 x 2,560" },
      { id: "head", label: "output head", total: 402.4, active: 402.4, note: "" },
      { id: "dense", label: "attention, 2 dense FFNs, shared experts", total: 2813.5, active: 2813.5, note: "35 KDA + 7 MLA layers" },
      { id: "exp", label: "routed experts", total: 120796.0, active: 1887.4, note: "40 layers x 512, 8 used" },
      { id: "aud", label: "Whisper-shaped audio encoder + projector", total: 694.6, active: 694.6, note: "32 layers, 1280 wide" },
      { id: "talk", label: "Talker: 0.5B LM + DiT + aggregator", total: 699.1, active: 699.1, note: "the TTS model, inside" },
      { id: "vae", label: "Talker audio VAE", total: 780.4, active: 361.1, note: "decoder used for speech out" },
      { id: "mtp", label: "multi-token-prediction layer", total: 3072.2, active: 0, note: "training aid" },
    ],
    headline: ["emb", "head", "dense", "exp", "aud", "talk"],
    headlineActive: ["head", "dense", "exp", "aud", "talk"],
  },
  {
    id: "audiotiny",
    name: "Ming-3.0-audio-tiny",
    claimTotal: "9.3B",
    claimActive: "2.7B",
    parts: [
      { id: "emb", label: "input embedding", total: 241.4, active: 241.4, note: "" },
      { id: "head", label: "output head", total: 241.4, active: 241.4, note: "" },
      { id: "dense", label: "attention, layer-0 FFN, shared experts", total: 464.8, active: 464.8, note: "" },
      { id: "exp", label: "routed experts", total: 6945.8, active: 434.1, note: "23 layers x 128, 8 used" },
      { id: "aud", label: "Whisper-shaped audio encoder + projector", total: 661.3, active: 661.3, note: "" },
      { id: "talk", label: "Talker: 0.5B LM + DiT + aggregator", total: 699.1, active: 699.1, note: "" },
      { id: "vae", label: "Talker audio VAE", total: 780.4, active: 361.1, note: "" },
      { id: "mtp", label: "multi-token-prediction layer", total: 316.6, active: 0, note: "" },
    ],
    headline: ["emb", "head", "dense", "exp", "aud", "talk"],
  },
  {
    id: "asr",
    name: "Ming-3.0-asr-tiny",
    claimTotal: "8.6B",
    claimActive: "2B",
    parts: [
      { id: "emb", label: "input embedding", total: 241.4, active: 241.4, note: "" },
      { id: "head", label: "output head", total: 241.4, active: 241.4, note: "" },
      { id: "dense", label: "attention, layer-0 FFN, shared experts", total: 464.8, active: 464.8, note: "" },
      { id: "exp", label: "routed experts", total: 6945.8, active: 434.1, note: "23 layers x 128, 8 used" },
      { id: "aud", label: "Whisper-shaped audio encoder + projector", total: 655.8, active: 655.8, note: "" },
      { id: "mtp", label: "multi-token-prediction layer", total: 316.6, active: 0, note: "" },
    ],
    headline: ["emb", "head", "dense", "exp", "aud"],
  },
]

const fmtB = (m: number) => (m >= 10000 ? (m / 1000).toFixed(1) : (m / 1000).toFixed(2))

export function ParamLedger() {
  const [modelId, setModelId] = useState(MODELS[1].id)
  const model = MODELS.find((m) => m.id === modelId) ?? MODELS[0]
  const [on, setOn] = useState<Record<string, string[]>>(() =>
    Object.fromEntries(MODELS.map((m) => [m.id, m.headline])),
  )
  const sel = on[model.id] ?? model.headline

  const total = model.parts.filter((p) => sel.includes(p.id)).reduce((a, p) => a + p.total, 0)
  const active = model.parts.filter((p) => sel.includes(p.id)).reduce((a, p) => a + p.active, 0)
  const all = model.parts.reduce((a, p) => a + p.total, 0)

  const toggle = (id: string) =>
    setOn((prev) => {
      const cur = prev[model.id] ?? model.headline
      return { ...prev, [model.id]: cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id] }
    })
  const preset = (ids: string[]) => setOn((prev) => ({ ...prev, [model.id]: ids }))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap gap-1 border-b px-4 py-2.5 font-mono text-[11px]">
        {MODELS.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setModelId(m.id)}
            aria-pressed={m.id === model.id}
            className={`rounded-md border px-2 py-0.5 ${m.id === model.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"}`}
          >
            {m.name.replace("Ming-3.0-", "")}
          </button>
        ))}
      </div>
      <div className="grid gap-4 p-4 sm:grid-cols-[1fr_auto]">
        <ul className="space-y-1">
          {model.parts.map((p) => {
            const checked = sel.includes(p.id)
            return (
              <li key={p.id}>
                <label className="flex cursor-pointer items-start gap-2 text-[13px]">
                  <input type="checkbox" checked={checked} onChange={() => toggle(p.id)} className="mt-1" />
                  <span className="flex-1">
                    <span className={checked ? "" : "text-muted-foreground line-through decoration-muted-foreground/50"}>
                      {p.label}
                    </span>
                    {p.note ? <span className="ml-1 text-[11px] text-muted-foreground">{p.note}</span> : null}
                  </span>
                  <span className="w-28 text-right font-mono text-[11px] tabular-nums">
                    {fmtB(p.total)}B
                    {p.active !== p.total ? <span className="text-muted-foreground"> / {fmtB(p.active)}B</span> : null}
                  </span>
                </label>
                <div className="ml-6 mt-0.5 h-1 rounded bg-muted">
                  <div
                    className={`h-1 rounded ${checked ? "bg-sky-600 dark:bg-sky-400" : "bg-muted-foreground/30"}`}
                    style={{ width: `${Math.max(0.6, (p.total / all) * 100).toFixed(2)}%` }}
                  />
                </div>
              </li>
            )
          })}
        </ul>
        <div className="min-w-[13rem] space-y-2 font-mono text-[12px]">
          <div className="rounded-lg border p-3">
            <div className="text-[10.5px] text-muted-foreground">ticked parts, total</div>
            <div className="text-xl tabular-nums">{fmtB(total)}B</div>
            <div className="text-[10.5px] text-muted-foreground">card says {model.claimTotal}</div>
          </div>
          {model.claimActive ? (
            <div className="rounded-lg border p-3">
              <div className="text-[10.5px] text-muted-foreground">ticked parts, active per step</div>
              <div className="text-xl tabular-nums">{fmtB(active)}B</div>
              <div className="text-[10.5px] text-muted-foreground">card says {model.claimActive}</div>
            </div>
          ) : null}
          <div className="flex flex-wrap gap-1 text-[10.5px]">
            <button type="button" onClick={() => preset(model.headline)} className="rounded border px-1.5 py-0.5 hover:bg-muted">
              headline total
            </button>
            {model.headlineActive ? (
              <button type="button" onClick={() => preset(model.headlineActive ?? [])} className="rounded border px-1.5 py-0.5 hover:bg-muted">
                headline active
              </button>
            ) : null}
            <button type="button" onClick={() => preset(model.parts.map((p) => p.id))} className="rounded border px-1.5 py-0.5 hover:bg-muted">
              everything in the repo
            </button>
          </div>
          <div className="text-[10.5px] text-muted-foreground">everything in the repo: {fmtB(all)}B</div>
        </div>
      </div>
      <figcaption className="border-t px-4 py-2.5 font-mono text-[10px] leading-relaxed text-muted-foreground">
        Measured by us from the safetensors headers of the five repositories, 23 Oct 2026. Each row: total
        parameters / parameters used per decode step, where they differ. Routed experts count 8 of 128 (or 8 of
        512) as active; the audio VAE encoder runs only when you clone a voice from a clip. The claims are the
        model cards&apos;. On flash, the headline-active preset drops the input embedding: that is the only mix of
        parts we found that lands on 6.5B, and it is not the mix that gives audio-tiny its 2.7B.
      </figcaption>
    </figure>
  )
}
