import { cn } from "@/lib/utils"

// Alpha histograms of three Qwen-Image-2.1 RGBA outputs, binned the same way.
//
// Row 1 is the release's own published showcase asset, a 684 x 685 web file —
// the measurement already in this article. Rows 2 and 3 are native 1024 x 1024
// generations from a third party's installation validation, one through the
// official INT8 ConvRot weights and one through a Q4_K_M GGUF conversion of the
// same denoiser. I counted those two myself, pixel by pixel, from the committed
// PNGs; the counts are absolute and sum to 1024 * 1024 = 1,048,576 exactly.
//
// The bins are the ones the prose uses: fully transparent, fully opaque, within
// 31 levels of either extreme, and anything in between. The question the last
// bin answers is whether the model produces translucency or a cutout.
//
// Server-rendered, zero JS. Arithmetic is integer add and one division per cell.

const PX_1024 = 1024 * 1024

type Sample = {
  label: string
  note: string
  /** [alpha 0, 1-31 and 224-254, 32-223, alpha 255], as pixel counts or percents */
  bins: [number, number, number, number]
  of: number
  /** share of pixels within 7 levels of an extreme, where counted */
  tails?: number
}

const SAMPLES: Sample[] = [
  {
    label: "release showcase",
    note: "684 x 685, published RGBA web asset, downscaled by someone before publication",
    bins: [53.1, 22.6, 0.8, 23.5],
    of: 100,
  },
  {
    label: "INT8 ConvRot",
    note: "1024 x 1024 native, official Comfy-Org INT8 weights, 40 steps",
    bins: [261_833, 496_774, 5_763, 284_206],
    of: PX_1024,
    tails: (650_873 + 388_284) / PX_1024,
  },
  {
    label: "GGUF Q4_K_M",
    note: "1024 x 1024 native, community 4-bit conversion of the same denoiser, 40 steps",
    bins: [352_887, 541_109, 5_052, 149_528],
    of: PX_1024,
    tails: (862_749 + 176_912) / PX_1024,
  },
]

const BINS = [
  { label: "alpha 0", tone: "bg-foreground/10" },
  { label: "1-31, 224-254", tone: "bg-foreground/30" },
  { label: "32-223", tone: "bg-foreground/90" },
  { label: "alpha 255", tone: "bg-foreground/55" },
]

const pct = (n: number, of: number) => (n * 100) / of

export function AlphaBands() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-alpha-bands={SAMPLES.length}
      aria-label="Alpha-channel histograms of three Qwen-Image-2.1 RGBA outputs, binned by transparency level"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        where the alpha channel actually sits
      </div>

      <div className="space-y-4 px-4 py-4">
        {SAMPLES.map((s) => (
          <div key={s.label}>
            <div className="flex flex-wrap items-baseline justify-between gap-x-4">
              <span className="font-mono text-xs">{s.label}</span>
              <span className="font-mono text-xs tabular-nums">
                <span className="text-muted-foreground">midrange </span>
                {pct(s.bins[2], s.of).toFixed(2)}%
              </span>
            </div>
            <div className="mt-2 flex h-6 overflow-hidden rounded-sm bg-muted/50">
              {s.bins.map((b, i) => (
                <div
                  key={BINS[i].label}
                  className={cn("h-full", BINS[i].tone)}
                  style={{ width: `${pct(b, s.of)}%` }}
                  title={`${BINS[i].label}: ${pct(b, s.of).toFixed(2)}%`}
                />
              ))}
            </div>
            <p className="mt-1 mb-0 text-xs text-muted-foreground">{s.note}</p>
          </div>
        ))}
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 pl-4 font-mono text-xs text-muted-foreground">
        {BINS.map((b) => (
          <li key={b.label} className="my-0">
            <span
              className={cn(
                "mr-1.5 inline-block h-2 w-2 rounded-xs align-middle",
                b.tone
              )}
            />
            {b.label}
          </li>
        ))}
      </ul>

      <div className="grid gap-x-6 gap-y-1 border-t px-4 py-4 font-mono text-sm sm:grid-cols-2">
        {SAMPLES.filter((s) => s.tails != null).map((s) => (
          <Cell key={s.label} label={s.label} value={s.tails as number} />
        ))}
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        A matting model puts mass in the middle: hair, glass, smoke, a soft
        shadow. All three of these put essentially none there. The two native
        files are not mine either &mdash; they come from someone else&rsquo;s
        installation validation, generated on an RTX 3090 through two different
        quantisations of the same denoiser, which is why they are worth more than
        one more sample from one more pipeline.
      </figcaption>
    </figure>
  )
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <>
      <span className="text-muted-foreground">
        {label} &mdash; within 7 levels of an extreme
      </span>
      <span className="tabular-nums">{(value * 100).toFixed(2)}%</span>
    </>
  )
}
