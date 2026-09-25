import { cn } from "@/lib/utils"

// Alpha histograms of Ming-Image-0.1-Design's three published RGBA samples,
// binned finely enough to see the floor under the "transparent" background.
//
// The files are assets/t2i_samples/transparent_rgba/*.webp in
// github.com/inclusionAI/Ming-Image at commit 62c6072: 2048 x 2048, the
// model's native text-to-image bucket. WebP stores alpha in its own ALPH chunk;
// in all three the chunk header reads compression=1 (lossless) and
// pre-processing=0 (no level reduction), so these counts are the model's alpha
// exactly, even though the RGB is lossy. I counted every pixel; each row sums to
// 2048 * 2048 = 4,194,304.
//
// The Qwen-Image-2.1 reference rows are this site's own earlier measurement of
// two native 1024 x 1024 generations (see /articles/qwen-image-2-1), binned
// coarsely, so only their midrange and near-extreme shares are shown.
//
// Server-rendered, zero JS.

const PX = 2048 * 2048

type Sample = { label: string; note: string; bins: number[] }

// [0, 1-7, 8-31, 32-223, 224-247, 248-254, 255]
const SAMPLES: Sample[] = [
  { label: "silver sedan", note: "windows rendered fully opaque; the only soft region is the contact shadow", bins: [2_247_449, 521_055, 11_428, 27_350, 10_408, 419_421, 957_193] },
  { label: "tabby cat", note: "fur and whiskers — the hard case", bins: [781_337, 1_068_820, 19_099, 37_234, 9_203, 148_367, 2_130_244] },
  { label: "snowboarder", note: "a helmeted rider holding a board: mostly hard edges", bins: [812_025, 1_904_233, 2_310, 6_059, 2_234, 403_958, 1_063_485] },
]

const BINS = [
  { label: "0", tone: "bg-foreground/10" },
  { label: "1–7", tone: "bg-rose-500/60" },
  { label: "8–31", tone: "bg-foreground/35" },
  { label: "32–223", tone: "bg-sky-600/90" },
  { label: "224–247", tone: "bg-foreground/35" },
  { label: "248–254", tone: "bg-foreground/55" },
  { label: "255", tone: "bg-foreground/75" },
]

const REFERENCE = [
  { label: "Qwen-Image-2.1, INT8, 1024²", mid: 5_763 / 1_048_576, near7: (650_873 + 388_284) / 1_048_576 },
  { label: "Qwen-Image-2.1, Q4_K_M, 1024²", mid: 5_052 / 1_048_576, near7: (862_749 + 176_912) / 1_048_576 },
]

const pct = (n: number, d = 2) => (n * 100).toFixed(d)

export function AlphaFloor() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-alpha-floor={SAMPLES.length}
      aria-label="Alpha-channel histograms of three native 2048-pixel RGBA outputs of Ming-Image-0.1-Design, with Qwen-Image-2.1 for reference"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        alpha values in three native 2048&sup2; RGBA samples, lossless alpha plane
      </div>

      <div className="space-y-4 px-4 py-4">
        {SAMPLES.map((s) => {
          const mid = s.bins[3] / PX
          const near7 = (s.bins[0] + s.bins[1] + s.bins[5] + s.bins[6]) / PX
          return (
            <div key={s.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                <span className="font-mono text-xs">{s.label}</span>
                <span className="font-mono text-xs tabular-nums">
                  <span className="text-muted-foreground">midrange </span>
                  {pct(mid, 3)}%<span className="text-muted-foreground"> &middot; alpha = 1&ndash;7 </span>
                  {pct(s.bins[1] / PX, 1)}%
                </span>
              </div>
              <div className="mt-2 flex h-6 overflow-hidden rounded-sm bg-muted/50">
                {s.bins.map((b, i) => (
                  <div
                    key={BINS[i].label}
                    className={cn("h-full", BINS[i].tone)}
                    style={{ width: `${(b * 100) / PX}%` }}
                    title={`alpha ${BINS[i].label}: ${pct(b / PX)}%`}
                  />
                ))}
              </div>
              <p className="mt-1 mb-0 text-xs text-muted-foreground">
                {s.note} &middot; within 7 levels of an extreme: {pct(near7)}%
              </p>
            </div>
          )
        })}
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 pl-4 font-mono text-xs text-muted-foreground">
        {BINS.map((b) => (
          <li key={b.label} className="my-0">
            <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", b.tone)} />
            {b.label}
          </li>
        ))}
      </ul>

      <dl className="my-0 grid gap-x-6 gap-y-1 border-t px-4 py-4 font-mono text-xs sm:grid-cols-[1fr_auto_auto]">
        {REFERENCE.map((r) => (
          <div key={r.label} className="contents">
            <dt className="text-muted-foreground">{r.label}</dt>
            <dd className="my-0 tabular-nums">midrange {pct(r.mid, 3)}%</dd>
            <dd className="my-0 tabular-nums">within 7: {pct(r.near7)}%</dd>
          </div>
        ))}
      </dl>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Two different Qwen RGBA autoencoders &mdash; Qwen-Image-2.1&rsquo;s 16x one
        and the 8x Qwen-Image-Layered one Ming ships &mdash; under two different
        denoisers, and the same answer: under one pixel in a hundred carries
        partial transparency, even on fur. The rose band is the practical
        surprise. The background is not
        zero: alpha = 1 is the single most common value in the snowboarder frame,
        43.2% of it, so any tool that treats <code>alpha &gt; 0</code> as
        &ldquo;content&rdquo; sees the whole canvas.
      </figcaption>
    </figure>
  )
}
