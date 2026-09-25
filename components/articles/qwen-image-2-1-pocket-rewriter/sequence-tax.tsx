import { cn } from "@/lib/utils"

// What a rewritten prompt costs the denoiser, as opposed to the rewriter.
//
// Qwen-Image-2.1 is single-stream: the prompt's text tokens are not a side
// input, they are part of the one sequence that all 32 blocks process. So a
// longer prompt is a longer sequence. Whether that is paid once or on every
// step depends on the prefix KV cache:
//
//   - diffusers (use_kv_cache=True by default) runs the full sequence on the
//     first step, keeps the prefix's K and V, and from then on only the target
//     image's tokens are projected. The text is paid once.
//   - stable-diffusion.cpp at 2bb7294 (src/model/diffusion/qwen_image_2_1.hpp)
//     builds the joint sequence, runs all 32 blocks over it, and only slices
//     the prefix off at the end — on every step. The text is paid 40 times.
//
// Cost model, identical to the one in the parent article's PrefixCache widget:
// per layer, per token, the bias-free linear layers cost 13 d^2 multiply-
// accumulates (4 d^2 for q/k/v/o, 9 d^2 for the SwiGLU at mlp_ratio 3), and
// attention costs 2 d per (query, key) pair allowed by the block-causal mask:
// a text token at index i sees i + 1 keys, an image token sees everything.
// d = 4096, 32 layers, 40 steps.
//
// Text-token counts are the measured means over the 300 held-out requests
// (see RewriterLedger): 34 for the request as typed, 446 / 477 for the two
// pocket rewrites, 827 for the 9B's. Image tokens are (px / 16)^2.
//
// This is derived arithmetic, not a timing. It predicts; the section on the
// four-core run is where it gets checked.
//
// Server-rendered, zero JS. Integer + - * and one division per ratio.

const D = 4096
const LAYERS = 32
const STEPS = 40
const LINEAR = 13 * D * D

const ARMS = [
  { key: "raw", label: "no rewriter", text: 34 },
  { key: "p08", label: "Pocket-0.8B", text: 446 },
  { key: "p2b", label: "Pocket-2B", text: 477 },
  { key: "t9b", label: "9B teacher", text: 827 },
]

const SIZES = [
  { px: 512, note: "the four-core gallery size" },
  { px: 1024, note: "the pocket eval's ~1 MP" },
  { px: 2048, note: "Qwen's own ratio table" },
]

function pairs(text: number, image: number): number {
  return (text * (text + 1)) / 2 + image * (text + image)
}

function macs(tokens: number, p: number): number {
  return tokens * LINEAR * LAYERS + 2 * p * D * LAYERS
}

/** Full sequence every step: stable-diffusion.cpp. */
function jobUncached(text: number, image: number): number {
  return STEPS * macs(text + image, pairs(text, image))
}

/** Full sequence once, then target tokens only: diffusers' default. */
function jobCached(text: number, image: number): number {
  return macs(text + image, pairs(text, image)) + (STEPS - 1) * macs(image, image * (text + image))
}

const x = (n: number) => `${n.toFixed(2)}x`

export function SequenceTax() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-sequence-tax={SIZES.length}
      aria-label="Derived denoiser cost of a rewritten prompt in Qwen-Image-2.1, with and without the prefix KV cache, at three resolutions"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        denoiser work for a 40-step image, relative to the request as typed —
        derived, not timed
      </div>

      {SIZES.map((s) => {
        const image = (s.px / 16) * (s.px / 16)
        const baseU = jobUncached(ARMS[0].text, image)
        const baseC = jobCached(ARMS[0].text, image)
        return (
          <div key={s.px} className="border-b px-4 py-4 last:border-b-0">
            <p className="my-0 font-mono text-xs">
              {s.px}² · {image.toLocaleString("en-US")} image tokens{" "}
              <span className="text-muted-foreground">— {s.note}</span>
            </p>
            <div className="mt-3 overflow-x-auto">
              <div className="grid min-w-[21rem] grid-cols-[1fr_auto_auto_auto] gap-x-3 gap-y-1.5 font-mono text-xs tabular-nums sm:gap-x-6">
                <span className="text-muted-foreground">prompt</span>
                <span className="text-right text-muted-foreground">text share</span>
                <span className="text-right text-muted-foreground">no cache</span>
                <span className="text-right text-muted-foreground">cache</span>
                {ARMS.map((a) => {
                  const share = (a.text * 100) / (a.text + image)
                  const u = jobUncached(a.text, image) / baseU
                  const c = jobCached(a.text, image) / baseC
                  return (
                    <div key={a.key} className="contents">
                      <span className="flex items-center gap-2">
                        <span className="w-24 shrink-0 truncate sm:w-28">{a.label}</span>
                        <span className="relative hidden h-2 flex-1 rounded-sm bg-muted/50 sm:block">
                          <span
                            className="absolute inset-y-0 left-0 rounded-sm bg-foreground/60"
                            style={{ width: `${share}%` }}
                          />
                        </span>
                      </span>
                      <span className="text-right">{share.toFixed(1)}%</span>
                      <span
                        className={cn(
                          "text-right",
                          u >= 1.2 ? "font-medium text-foreground" : "text-muted-foreground"
                        )}
                      >
                        {x(u)}
                      </span>
                      <span className="text-right text-muted-foreground">{x(c)}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })}

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The tax is largest exactly where the pitch points: a small image, on a
        runtime without the prefix cache. At 512² on stable-diffusion.cpp a
        0.8B rewrite should make every denoising step about 39% more expensive.
        At 2048² with diffusers&rsquo; cache, the 9B&rsquo;s 827 tokens cost
        2%.
      </p>
    </figure>
  )
}
