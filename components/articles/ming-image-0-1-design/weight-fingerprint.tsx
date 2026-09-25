import { cn } from "@/lib/utils"

// Is Ming-Image's DiT merely Z-Image's architecture, or Z-Image's weights?
//
// Nine small tensors — biases and norm scales, 38,464 values in all — were
// pulled from each checkpoint by HTTP range read of exactly their byte span
// (the header gives data_offsets), a few tens of kilobytes per model and no
// weight download. Each Ming tensor is compared with the same-named tensor in
// Tongyi-MAI/Z-Image (the base checkpoint), Tongyi-MAI/Z-Image-Turbo and
// inclusionAI/Ming-flash-omni-2.0's transformer/, whose config names
// ZImageTransformer2DModel outright.
//
// Relative L2 is ||ming - other|| / ||ming||; for norm scales the Pearson
// correlation is taken on (w - 1), since every norm initialises at one and
// raw correlation would flatter any pair. Both numbers are in the source
// comments of the article's data; the bar shows 1 - relative L2, floored at 0.
//
// Server-rendered, zero JS.

type Cell = { r: number; l2: number }
type Row = {
  name: string
  n: number
  base: Cell
  turbo: Cell
  omni: Cell
  layer: Cell
  retrained?: boolean
}

const ROWS: Row[] = [
  { name: "layers.29.adaLN_modulation.0.bias", n: 15360, base: { r: 1.0, l2: 0.0084 }, turbo: { r: 0.9872, l2: 0.1614 }, omni: { r: 0.9872, l2: 0.1614 }, layer: { r: 1.0, l2: 0.0018 } },
  { name: "layers.29.attention_norm1.weight", n: 3840, base: { r: 0.9978, l2: 0.0333 }, turbo: { r: 0.3341, l2: 0.5386 }, omni: { r: 0.3328, l2: 0.5392 }, layer: { r: 0.9999, l2: 0.0057 } },
  { name: "layers.15.attention.norm_k.weight", n: 128, base: { r: 0.9815, l2: 0.0255 }, turbo: { r: 0.9657, l2: 0.0864 }, omni: { r: 0.9606, l2: 0.0791 }, layer: { r: 0.9769, l2: 0.0283 } },
  { name: "layers.0.attention.norm_q.weight", n: 128, base: { r: 0.9292, l2: 0.125 }, turbo: { r: 0.8243, l2: 0.1945 }, omni: { r: 0.8291, l2: 0.1896 }, layer: { r: 0.9968, l2: 0.0292 } },
  { name: "all_final_layer.2-1.linear.bias", n: 64, base: { r: 0.978, l2: 0.2498 }, turbo: { r: 0.8454, l2: 0.6705 }, omni: { r: 0.8666, l2: 0.6265 }, layer: { r: 0.9985, l2: 0.056 } },
  { name: "t_embedder.mlp.2.bias", n: 3840, base: { r: 0.9494, l2: 0.3342 }, turbo: { r: 0.7777, l2: 0.7925 }, omni: { r: 0.818, l2: 0.7692 }, layer: { r: 0.9956, l2: 0.0935 } },
  { name: "t_embedder.mlp.0.bias", n: 1024, base: { r: 0.403, l2: 0.9053 }, turbo: { r: 0.258, l2: 0.9016 }, omni: { r: 0.2961, l2: 0.8971 }, layer: { r: 0.9994, l2: 0.0328 }, retrained: true },
  { name: "cap_embedder.1.bias", n: 3840, base: { r: 0.6782, l2: 0.7371 }, turbo: { r: 0.6684, l2: 0.7632 }, omni: { r: 0.6776, l2: 0.7507 }, layer: { r: 0.9939, l2: 0.111 }, retrained: true },
  { name: "cap_embedder.0.weight", n: 2560, base: { r: 0.3047, l2: 0.5327 }, turbo: { r: 0.3076, l2: 0.5105 }, omni: { r: 0.2409, l2: 0.5992 }, layer: { r: 0.8106, l2: 0.3369 }, retrained: true },
]

const COLS: { key: "base" | "turbo" | "omni" | "layer"; label: string }[] = [
  { key: "base", label: "Z-Image" },
  { key: "turbo", label: "Z-Image-Turbo" },
  { key: "omni", label: "Ming-flash-omni-2.0" },
  { key: "layer", label: "Ming …-Layer" },
]

function Bar({ cell, best }: { cell: Cell; best: boolean }) {
  const w = Math.max(0, 1 - cell.l2) * 100
  return (
    <div>
      <div className="h-2 overflow-hidden rounded-sm bg-muted/60">
        <div
          className={cn("h-full", best ? "bg-sky-500/80" : "bg-foreground/30")}
          style={{ width: `${w}%` }}
        />
      </div>
      <div className={cn("mt-0.5 font-mono text-[11px] tabular-nums", best ? "text-foreground" : "text-muted-foreground")}>
        {cell.l2.toFixed(4)}
        <span className="text-muted-foreground"> &middot; r {cell.r.toFixed(3)}</span>
      </div>
    </div>
  )
}

export function WeightFingerprint() {
  const values = ROWS.reduce((a, r) => a + r.n, 0)
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-weight-fingerprint={values}
      aria-label="Relative L2 distance between nine Ming-Image DiT tensors and the same tensors in Z-Image, Z-Image-Turbo and Ming-flash-omni-2.0"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        Ming-Image-0.1-Design transformer/ against three candidate parents &mdash; relative L2, lower is closer
      </div>

      <div className="overflow-x-auto">
        <table className="my-0 w-full min-w-[640px] border-collapse text-left text-xs">
          <thead>
            <tr className="border-b">
              <th className="px-3 py-2 font-mono font-normal text-muted-foreground">tensor</th>
              {COLS.map((c) => (
                <th key={c.key} className="px-3 py-2 font-mono font-normal text-muted-foreground">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => {
              const parents = [r.base.l2, r.turbo.l2, r.omni.l2]
              const min = Math.min(...parents)
              return (
                <tr key={r.name} className={cn("border-b last:border-b-0", r.retrained && "bg-muted/30")}>
                  <td className="px-3 py-2 align-top">
                    <div className="font-mono text-[11px]">{r.name}</div>
                    <div className="text-muted-foreground">
                      {r.n.toLocaleString("en-US")} values{r.retrained ? " · retrained" : ""}
                    </div>
                  </td>
                  {COLS.map((c) => (
                    <td key={c.key} className="w-[18%] px-3 py-2 align-top">
                      <Bar cell={r[c.key]} best={!r.retrained && c.key !== "layer" && r[c.key].l2 === min} />
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        Every informative tensor points at the base Z-Image checkpoint, not at the
        distilled Turbo that inclusionAI&rsquo;s own February model was built on:
        the last block&rsquo;s 15,360-value modulation bias sits 0.84% from
        Z-Image and 16.1% from Turbo. The three shaded rows are equally far from
        every candidate, which is what retraining looks like &mdash; and two of
        them are the caption embedder, the one layer whose input changed, from
        Qwen3-4B&rsquo;s hidden states to Ming&rsquo;s connector. The right-hand
        column is the Layer model against the Design model. The retrained rows moved
        50&ndash;90% away from Z-Image and moved there together, 3&ndash;34% apart,
        which two independent fine-tunes would not do: the two releases share a
        Ming parent. {values.toLocaleString("en-US")} values per checkpoint, read by
        range request.
      </figcaption>
    </figure>
  )
}
