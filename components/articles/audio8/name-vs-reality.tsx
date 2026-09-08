"use client"

import { useState } from "react"

// Named parameter count vs. true end-to-end parameter count, for every arkasr
// (and arkasr-descended) checkpoint Audio8 ships. "Named" is the number in
// the repo name/card headline; "true" is measured directly, two independent
// ways that agree:
//
//   1. Each ASR README states it itself, in these words: Audio8-ASR-0.1B's
//      own card gives "Language-model parameters: 103,502,336 (about 0.104B)"
//      right next to "End-to-end unique parameters: 323,990,528 (about
//      0.324B)" -- the gap is the Whisper-style audio encoder plus MLP
//      adapter, which the headline number never counts.
//   2. Independently, reading the safetensors header at the front of each
//      model.safetensors (first 8 bytes = header length, then that many
//      bytes of JSON -- shapes and dtypes, no download) and classifying
//      every tensor by its prefix confirms the same split for ARK-ASR-0.6B
//      and ARK-ASR-3B, and for ARK-ASR-3B additionally matches
//      model.safetensors.index.json's own total_parameters field exactly:
//      4,063,438,848.
//
// The Whisper-style encoder turns out to be the same 637.0M-parameter block
// (whisper_config: d_model 1280, encoder_layers 32) bit-for-bit in both
// ARK-ASR-0.6B and ARK-ASR-3B -- fixed size regardless of decoder scale --
// which is why the understatement shrinks as the named size grows: a fixed
// ~640M-parameter encoder is 3x the 0.1B decoder, roughly matches the 0.6B
// decoder, and is a rounding error next to the 3B decoder.
//
// GPA and GPA-v1.5 are the control group: their own names ("0.3B", and the
// GPA-v1.5 paper's "1B-scale") already describe the true end-to-end size,
// not a sub-component -- confirmed the same way, from their own safetensors
// headers (312,625,152 and 1,152,556,800 params respectively).

type Row = {
  key: string
  label: string
  namedB: number
  trueB: number
  honest: boolean
  detail: string
}

const ROWS: Row[] = [
  {
    key: "asr01",
    label: "Audio8-ASR-0.1B",
    namedB: 0.1035,
    trueB: 0.324,
    honest: false,
    detail: "103.5M decoder only, per the card's own \"language-model parameters\" line — the true end-to-end figure adds a 186.4M Whisper-small encoder and a 33.6M+0.5M adapter.",
  },
  {
    key: "ark06",
    label: "ARK-ASR-0.6B",
    namedB: 0.6,
    trueB: 1.153,
    honest: false,
    detail: "\"0.6B decoder LLM parameters, with a separate 0.6B-scale Whisper-style audio encoder\" — the card's own words. Adding that separate encoder (637.0M, measured) is most of the gap.",
  },
  {
    key: "ark3b",
    label: "ARK-ASR-3B",
    namedB: 3,
    trueB: 4.063,
    honest: false,
    detail: "the same 637.0M encoder reused unchanged from the 0.6B checkpoint — now a much smaller fraction of a 3.4B decoder, which is why the multiplier shrinks as scale grows.",
  },
  {
    key: "gpa",
    label: "GPA (0.3B)",
    namedB: 0.3,
    trueB: 0.313,
    honest: true,
    detail: "plain Qwen3ForCausalLM, no separate audio encoder in the checkpoint at all — the name already describes the whole thing.",
  },
  {
    key: "gpav15",
    label: "GPA-v1.5 (1B-scale)",
    namedB: 1.0,
    trueB: 1.153,
    honest: true,
    detail: "\"1B-scale\" undersells it by less than 15% — and 1.153B is, tensor for tensor, ARK-ASR-0.6B's own true size, encoder included. The difference from the ASR row above is that this name was set to describe the whole checkpoint from the start.",
  },
]

const UNDER = "oklch(0.68 0.13 85)"
const HONEST = "oklch(0.55 0.16 155)"
const NAMED = "oklch(0.62 0.03 250)"

export function NameVsReality() {
  const [active, setActive] = useState("ark3b")
  const row = ROWS.find((r) => r.key === active) ?? ROWS[0]
  const maxB = Math.max(...ROWS.map((r) => r.trueB))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">named size vs. measured end-to-end size</span>
        <span className="font-mono text-[10px] text-muted-foreground">click a row</span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-3">
          {ROWS.map((r) => {
            const namedW = (r.namedB / maxB) * 100
            const trueW = (r.trueB / maxB) * 100
            const mult = r.trueB / r.namedB
            const isActive = r.key === active
            return (
              <button
                key={r.key}
                type="button"
                onClick={() => setActive(r.key)}
                className="block w-full cursor-pointer text-left"
              >
                <div className="mb-1 flex items-baseline justify-between font-mono text-[10.5px]">
                  <span className={isActive ? "text-foreground" : "text-foreground/80"}>{r.label}</span>
                  <span style={{ color: r.honest ? HONEST : UNDER }}>
                    {mult.toFixed(2)}× {r.honest ? "— roughly honest" : "of the named size"}
                  </span>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">named</span>
                    <div className="h-3.5 flex-1 rounded bg-muted/20">
                      <div className="h-3.5 rounded" style={{ width: `${namedW}%`, background: NAMED, opacity: 0.7 }} />
                    </div>
                    <span className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums text-muted-foreground">
                      {r.namedB.toFixed(3)}B
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="w-16 shrink-0 text-right font-mono text-[9.5px] text-muted-foreground">true</span>
                    <div className="h-3.5 flex-1 rounded bg-muted/20">
                      <div
                        className="h-3.5 rounded"
                        style={{ width: `${trueW}%`, background: r.honest ? HONEST : UNDER, opacity: 0.9 }}
                      />
                    </div>
                    <span
                      className="w-16 shrink-0 text-right font-mono text-[10px] tabular-nums"
                      style={{ color: r.honest ? HONEST : UNDER }}
                    >
                      {r.trueB.toFixed(3)}B
                    </span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>

        <div className="mt-3 rounded-lg border bg-muted/10 px-3 py-2.5">
          <p className="text-[12px] leading-5 text-muted-foreground">{row.detail}</p>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The three <span style={{ color: UNDER }}>ASR</span> checkpoints all name themselves after one
          component — the decoder — and all understate the deployed whole, by a shrinking margin as the
          decoder gets bigger: <span className="text-foreground">3.13×</span> at 0.1B,{" "}
          <span className="text-foreground">1.92×</span> at 0.6B, <span className="text-foreground">1.35×</span> at
          3B. That shrinkage isn&rsquo;t noise — it&rsquo;s the same roughly 637M-parameter Whisper-style
          encoder, reused unchanged, becoming a smaller fraction of an ever-larger decoder. The two{" "}
          <span style={{ color: HONEST }}>unified</span> GPA checkpoints don&rsquo;t have this problem: GPA
          has no separate audio encoder to leave out, and GPA-v1.5 carries the exact same 637M-parameter
          encoder as the ASR line but was simply named after the whole checkpoint from the start — proof the
          honest framing was available the whole time, one repo over.
        </p>
      </div>
    </figure>
  )
}
