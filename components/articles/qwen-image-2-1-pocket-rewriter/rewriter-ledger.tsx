import { cn } from "@/lib/utils"

// What each prompt path costs before the image model sees a token, and what it
// hands the image model when it is done.
//
// Provenance, row by row:
//
// - parameters: summed from the safetensors headers, pulled over HTTP range
//   reads (8 bytes for the u64 header length, then the JSON header). Pocket
//   0.8B: 320 tensors, all BF16, no MTP tensors. Pocket 2B: 320 tensors.
//   PE-T2I: four shards, 456,010,480 of its parameters in the vision tower it
//   never uses for text-to-image, and untied embeddings (1,017,118,720 in
//   embed_tokens and again in lm_head). Its text path, 8,953,803,264, is
//   exactly what the community GGUF declares as `general.total`.
// - bytes: the safetensors `data_offsets` plus header, or the Hub's file size.
// - system prompt: 0 for the students by construction (the chat template has
//   no system turn in training); 2,426 tokens for the teacher, counting
//   system_prompt.txt (1,721 words, 10,045 bytes) with the shipped tokenizer.
// - generated tokens: the teacher's are the mean of `gen_tokens` over all
//   8,797 rows of labels_full.jsonl, split by tokenizing the stored `thinking`
//   text with the same tokenizer (805 mean). The students' are the model cards'
//   300-row means, which match preds_sft-*.jsonl.
// - rewrite words: medians over the same 300 held-out requests (preds_*.jsonl).
// - DiT text tokens: what Qwen-Image-2.1's denoiser actually receives, counted
//   with the Qwen-Image-2.1 processor tokenizer and the pipeline's own template
//   (`<|im_start|>user\n{prompt}<|im_end|>\n<|im_start|>assistant\n`, system
//   turn dropped), which is how diffusers and stable-diffusion.cpp both build
//   it. Means over the 300 held-out requests and their rewrites.
//
// Server-rendered, zero JS. Arithmetic is + - * / and toFixed only.

type Arm = {
  key: string
  label: string
  sub: string
  params: number | null
  bf16Bytes: number | null
  smallest: string
  systemTokens: number
  thinking: number
  answer: number
  words: number
  ditTokens: number
}

const ARMS: Arm[] = [
  {
    key: "raw",
    label: "no rewriter",
    sub: "the request as typed",
    params: null,
    bf16Bytes: null,
    smallest: "—",
    systemTokens: 0,
    thinking: 0,
    answer: 0,
    words: 14,
    ditTokens: 34,
  },
  {
    key: "p08",
    label: "Pocket-0.8B",
    sub: "Qwen3.5-0.8B, text-only",
    params: 752_393_024,
    bf16Bytes: 1_504_827_608,
    smallest: "0.81 GB · Q8_0 (theirs)",
    systemTokens: 0,
    thinking: 0,
    answer: 453,
    words: 356,
    ditTokens: 446,
  },
  {
    key: "p2b",
    label: "Pocket-2B",
    sub: "Qwen3.5-2B, text-only",
    params: 1_881_825_088,
    bf16Bytes: 3_763_692_048,
    smallest: "3.76 GB · bf16 only",
    systemTokens: 0,
    thinking: 0,
    answer: 483,
    words: 359,
    ditTokens: 477,
  },
  {
    key: "t9b",
    label: "PE-T2I (9B)",
    sub: "Qwen's recommended path",
    params: 9_409_813_744,
    bf16Bytes: 18_819_627_488,
    smallest: "5.63 GB · Q4_K_M (community)",
    systemTokens: 2_426,
    thinking: 805,
    answer: 861,
    words: 589,
    ditTokens: 827,
  },
]

const MAX_GEN = 1_666
const MAX_DIT = 827

const bn = (n: number) => (n / 1e9).toFixed(2)
const gb = (n: number) => (n / 1e9).toFixed(2)
const int = (n: number) => n.toLocaleString("en-US")

function Bar({
  parts,
  max,
}: {
  parts: { value: number; tone: string; title: string }[]
  max: number
}) {
  return (
    <div className="relative flex h-4 w-full overflow-hidden rounded-sm bg-muted/50">
      {parts.map((p) => (
        <div
          key={p.title}
          className={cn("h-full", p.tone)}
          style={{ width: `${(p.value * 100) / max}%` }}
          title={p.title}
        />
      ))}
    </div>
  )
}

export function RewriterLedger() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-rewriter-ledger={ARMS.length}
      aria-label="Cost of each prompt path for Qwen-Image-2.1: no rewriter, the two pocket rewriters, and the official 9B rewriter"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        four ways into Qwen-Image-2.1 — what each costs, and what the denoiser
        receives
      </div>

      <div className="space-y-5 px-4 py-4">
        {ARMS.map((a) => (
          <div key={a.key} className="space-y-2">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="my-0 font-mono text-sm font-medium">
                {a.label}{" "}
                <span className="font-normal text-muted-foreground">
                  · {a.sub}
                </span>
              </p>
              <p className="my-0 font-mono text-xs tabular-nums text-muted-foreground">
                {a.params === null
                  ? "0 parameters"
                  : `${bn(a.params)}B params · ${gb(a.bf16Bytes ?? 0)} GB bf16`}
              </p>
            </div>

            <div className="grid grid-cols-[6.5rem_1fr_4.5rem] items-center gap-x-3 gap-y-1.5 font-mono text-xs sm:grid-cols-[9rem_1fr_5.5rem]">
              <span className="text-muted-foreground">generated</span>
              <Bar
                max={MAX_GEN}
                parts={[
                  {
                    value: a.thinking,
                    tone: "bg-foreground/35",
                    title: `thinking: ${int(a.thinking)} tokens`,
                  },
                  {
                    value: a.answer,
                    tone: "bg-foreground/80",
                    title: `answer: ${int(a.answer)} tokens`,
                  },
                ]}
              />
              <span className="text-right tabular-nums">
                {int(a.thinking + a.answer)}
              </span>

              <span className="text-muted-foreground">into the DiT</span>
              <Bar
                max={MAX_DIT}
                parts={[
                  {
                    value: a.ditTokens,
                    tone: "bg-foreground/60",
                    title: `${int(a.ditTokens)} text tokens`,
                  },
                ]}
              />
              <span className="text-right tabular-nums">{int(a.ditTokens)}</span>
            </div>

            <p className="my-0 font-mono text-xs text-muted-foreground">
              system prompt{" "}
              <span className="text-foreground tabular-nums">
                {int(a.systemTokens)}
              </span>{" "}
              tok · thinking{" "}
              <span className="text-foreground tabular-nums">
                {int(a.thinking)}
              </span>{" "}
              · median{" "}
              <span className="text-foreground tabular-nums">{int(a.words)}</span>{" "}
              words · smallest file{" "}
              <span className="text-foreground">{a.smallest}</span>
            </p>
          </div>
        ))}
      </div>

      <ul className="my-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t px-4 py-2 pl-4 font-mono text-xs text-muted-foreground">
        <li className="my-0">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-foreground/35 align-middle" />
          thinking tokens
        </li>
        <li className="my-0">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-foreground/80 align-middle" />
          answer tokens
        </li>
        <li className="my-0">
          <span className="mr-1.5 inline-block h-2 w-2 rounded-xs bg-foreground/60 align-middle" />
          text tokens the denoiser attends over
        </li>
      </ul>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The teacher generates{" "}
        <span className="font-mono text-foreground tabular-nums">1,666</span>{" "}
        tokens per rewrite on average, and{" "}
        <span className="font-mono text-foreground tabular-nums">805</span> of
        them are thinking — 48%, not the whole of it. Of the{" "}
        <span className="font-mono text-foreground tabular-nums">1,213</span>{" "}
        tokens the 0.8B saves, the thinking is two thirds; the rest is the
        answer getting shorter, because the students were only ever shown the
        teacher&rsquo;s shortest rewrites. Every path hands the denoiser at
        least 13 times more text than the request itself.
      </p>
    </figure>
  )
}
