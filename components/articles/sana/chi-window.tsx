"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"

// Complex Human Instruction, as the code actually implements it.
//
// app/sana_pipeline.py:225-247 (identical in app/sana_sprint_pipeline.py:208):
//
//     if not self.config.text_encoder.chi_prompt:
//         max_length_all = self.config.text_encoder.model_max_length
//         prompts_all = prompts
//     else:
//         chi_prompt = "\n".join(self.config.text_encoder.chi_prompt)
//         prompts_all = [chi_prompt + prompt for prompt in prompts]
//         num_chi_prompt_tokens = len(self.tokenizer.encode(chi_prompt))
//         max_length_all = num_chi_prompt_tokens + model_max_length - 2
//
//     caption_token = self.tokenizer(prompts_all, max_length=max_length_all,
//                                    padding="max_length", truncation=True, ...)
//     select_index = [0] + list(range(-model_max_length + 1, 0))
//     caption_embs = self.text_encoder(...)[0][:, None][:, :, select_index]
//     emb_masks    = caption_token.attention_mask[:, select_index]
//
// The CHI preamble is the 8-line block in every config's text_encoder.chi_prompt
// ("Given a user prompt, generate an 'Enhanced prompt'..."). I tokenised it with
// the Gemma tokenizer shipped in Efficient-Large-Model/Sana_1600M_1024px_BF16_
// diffusers/tokenizer: 1057 characters, 208 pieces, so num_chi_prompt_tokens
// (which includes the BOS that HF's .encode prepends) = 209 and max_length_all
// = 209 + 300 - 2 = 507.
//
// Then the slice. select_index keeps position 0 and the last 299 positions of
// 507, i.e. index 0 and indices 208..506. Index 208 is the LAST token of the
// preamble; everything from 209 on is the user's prompt and then right padding,
// which emb_masks zeroes out. So the DiT never sees the instruction. It
// cross-attends to BOS + last-preamble-token + the prompt: min(P + 2, 300)
// vectors for a P-token prompt. For the repo's own example prompt, 'a cyberpunk
// cat with a neon sign that says "Sana"', P = 11 in context and the DiT gets 13.

const CHI = "oklch(0.68 0.13 85)"
const PROMPT = "oklch(0.55 0.16 155)"
const PAD = "oklch(0.62 0.03 250)"
const KEEP = "oklch(0.60 0.15 255)"

const N_CHI = 208 // preamble pieces, excluding BOS
const MML = 300 // model_max_length
const MAX_LEN = N_CHI + 1 + MML - 2 // 507
const WIN_START = MAX_LEN - (MML - 1) // 208

export function ChiWindow() {
  const [p, setP] = useState(11)

  const realEnd = 1 + N_CHI + p // exclusive index of the last real token
  const truncated = realEnd > MAX_LEN
  const pKept = truncated ? MAX_LEN - 1 - N_CHI : p
  const inWindow = Math.min(1 + N_CHI + pKept, MAX_LEN) - WIN_START // real tokens inside the tail slice
  const reaching = 1 + Math.max(0, inWindow) // + BOS

  const W = 700
  const X0 = 128
  const SPAN = 540
  const px = (i: number) => X0 + (i / MAX_LEN) * SPAN
  const H = 196

  const bosW = Math.max(2, px(1) - px(0))
  const chiW = px(1 + N_CHI) - px(1)
  const promW = Math.max(pKept > 0 ? 2 : 0, px(1 + N_CHI + pKept) - px(1 + N_CHI))
  const padW = SPAN - bosW - chiW - promW

  // second bar: the 300 conditioning slots the DiT is handed
  const S0 = X0
  const SS = SPAN
  const sx = (i: number) => S0 + (i / MML) * SS
  const keepW = Math.max(2, sx(reaching) - sx(0))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          Gemma-2-2B-IT conditioning · {MAX_LEN} input slots · {MML}-slot selection window
        </span>
        <span className="font-mono text-[10px]" style={{ color: KEEP }}>
          {reaching} vector{reaching === 1 ? "" : "s"} reach the DiT
          {truncated ? " · prompt truncated" : ""}
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-mono text-[10px] text-muted-foreground">user prompt length</span>
          <Range
            min={1}
            max={340}
            step={1}
            value={p}
            accent={PROMPT}
            aria-label="user prompt length in tokens"
            onChange={(e) => setP(Number(e.target.value))}
            className="w-56"
          />
          <span className="font-mono text-[10px] tabular-nums" style={{ color: PROMPT }}>
            {p} tokens
          </span>
        </div>

        <div className="mt-3 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A ${MAX_LEN}-slot Gemma input made of one BOS token, a ${N_CHI}-piece Complex Human Instruction preamble, a ${pKept}-token user prompt and right padding. Sana keeps slot 0 and the last ${
                MML - 1
              } slots, so only ${reaching} unmasked vectors reach the diffusion transformer's cross-attention.`}
            </title>

            {/* row 1: what Gemma is fed */}
            <text x={0} y={30} fontSize={9} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
              into Gemma
            </text>
            <text x={0} y={42} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {MAX_LEN} slots
            </text>

            <rect x={X0} y={22} width={bosW} height={22} rx={2} fill={KEEP} fillOpacity={0.9} />
            <rect x={X0 + bosW} y={22} width={chiW} height={22} rx={2} fill={CHI} fillOpacity={0.75} />
            <rect x={X0 + bosW + chiW} y={22} width={promW} height={22} rx={2} fill={PROMPT} fillOpacity={0.85} />
            <rect x={X0 + bosW + chiW + promW} y={22} width={Math.max(0, padW)} height={22} rx={2} fill={PAD} fillOpacity={0.16} />

            <text x={X0 + bosW + chiW / 2} y={16} fontSize={8} textAnchor="middle" fill={CHI} fontFamily="ui-monospace, monospace">
              CHI preamble · {N_CHI} pieces
            </text>
            <text x={X0 + SPAN} y={16} fontSize={8} textAnchor="end" fill={PAD} fontFamily="ui-monospace, monospace">
              right padding
            </text>

            {/* the selection window */}
            <line x1={px(WIN_START)} y1={18} x2={px(WIN_START)} y2={72} stroke={KEEP} strokeWidth={1.4} strokeDasharray="3 2" />
            <line x1={px(0)} y1={18} x2={px(0)} y2={72} stroke={KEEP} strokeWidth={1.4} strokeDasharray="3 2" />
            <line x1={px(WIN_START)} y1={62} x2={X0 + SPAN} y2={62} stroke={KEEP} strokeWidth={1.2} />
            <text x={0} y={74} fontSize={7.5} fill={KEEP} fontFamily="ui-monospace, monospace">
              select_index = [0] + the last {MML - 1} slots — window opens at slot {WIN_START}
            </text>

            {/* row 2: what the DiT gets */}
            <text x={0} y={112} fontSize={9} fill="currentColor" fillOpacity={0.75} fontFamily="ui-monospace, monospace">
              into the DiT
            </text>
            <text x={0} y={124} fontSize={7.5} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {MML} slots, masked
            </text>

            <rect x={S0} y={104} width={SS} height={22} rx={2} fill={PAD} fillOpacity={0.16} />
            <rect x={S0} y={104} width={keepW} height={22} rx={2} fill={KEEP} fillOpacity={0.85} />
            <text
              x={S0 + SS}
              y={138}
              fontSize={8}
              textAnchor="end"
              fill={KEEP}
              fontFamily="ui-monospace, monospace"
            >
              {reaching} unmasked · {MML - reaching} padded away
            </text>

            <text x={0} y={158} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              the instruction is never handed to the transformer —
            </text>
            <text x={0} y={170} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              it only shapes the hidden states at the prompt positions,
            </text>
            <text x={0} y={182} fontSize={8} fill="currentColor" fillOpacity={0.5} fontFamily="ui-monospace, monospace">
              because Gemma is causal and they come after it
            </text>

            <g transform="translate(320, 146)">
              <rect x={0} y={0} width={352} height={42} rx={5} fill="currentColor" fillOpacity={0.04} />
              <text x={10} y={16} fontSize={8} fill="currentColor" fillOpacity={0.62} fontFamily="ui-monospace, monospace">
                prompt tokens in context: {pKept}
                {truncated ? ` (truncated from ${p})` : ""}
              </text>
              <text x={10} y={30} fontSize={8} fill={KEEP} fillOpacity={0.85} fontFamily="ui-monospace, monospace">
                cross-attention keys/values: {reaching} of {MML}
              </text>
            </g>
          </svg>
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          Sana&rsquo;s text encoder is a decoder-only LLM with the language-model head removed —{" "}
          <span className="font-mono text-[11px] text-foreground">
            AutoModelForCausalLM.from_pretrained(&hellip;).get_decoder()
          </span>{" "}
          on Gemma-2-2B-IT, 2.6B parameters against T5-XXL&rsquo;s 4.8B. That swap is only half the
          idea. The other half is that a decoder-only model can be <em>instructed</em>, so Sana
          prepends a fixed 208-piece &ldquo;Complex Human Instruction&rdquo; telling the model how to
          expand a terse prompt into a visual description — and then throws the instruction away.
          <br />
          <br />
          Drag the prompt length. The preamble occupies the first{" "}
          <span className="font-mono text-[11px]">209</span>{" "}slots of a{" "}
          <span className="font-mono text-[11px]">507</span>-slot input, but{" "}
          <span className="font-mono text-[11px]">select_index</span>{" "}keeps only slot 0 and the
          last 299, and the attention mask zeroes the padding. For a short prompt the diffusion
          transformer ends up cross-attending to about a dozen vectors, not 300. The instruction
          never reaches it. It works because Gemma is causal: every hidden state at a prompt position
          has already attended over the whole instruction, so the enhancement is baked into the
          representation rather than into a second generated string.
          <br />
          <br />
          Two practical consequences fall out of the arithmetic. Prompts longer than{" "}
          <span className="font-mono text-[11px]">298</span>{" "}tokens get truncated — push the slider
          past it and watch. And the cost of CHI is real: Gemma runs over 507 positions instead of
          300, for a prompt that is usually a dozen tokens long.
        </p>
      </div>
    </figure>
  )
}
