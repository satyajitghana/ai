import { cn } from "@/lib/utils"

// The Layer model's only quantitative evidence, with each row's provenance.
//
// The numbers are transcribed from assets/performance.webp in
// inclusionAI/Ming-Image-0.1-Design-Layer at revision 6504487, a table headed
// "Table 1: Quantitative results of various layer-decomposition methods on
// Crello test set". Four of its seven rows were then checked against Table 1 of
// the Qwen-Image-Layered paper (arXiv:2512.15603), whose text says the model
// behind that row was fine-tuned on the Crello training set: all 48 numbers
// match to four decimal places. Two rows are the Ming team's own runs of the
// released Qwen-Image-Layered weights. The last row is labelled "CLEAR-1024
// (Ours)"; no paper by that name was found on arXiv on 23 September 2026, and
// neither model card uses the name.
//
// MLM is "max-allowed layer merge": how many adjacent predicted layers the
// scorer may merge to match the ground truth. 0 is the strict column.
//
// Server-rendered, zero JS.

type Source = "qwen-paper" | "ming-run" | "ming-ours"

type Row = {
  name: string
  source: Source
  l1: [number, number] // RGB L1 at MLM 0 and MLM 5, lower is better
  iou: [number, number] // alpha soft IoU at MLM 0 and MLM 5, higher is better
}

const ROWS: Row[] = [
  { name: "VLM Base + Hi-SAM", source: "qwen-paper", l1: [0.1197, 0.0726], iou: [0.5596, 0.7589] },
  { name: "Yolo Base + Hi-SAM", source: "qwen-paper", l1: [0.0962, 0.0579], iou: [0.5697, 0.7897] },
  { name: "LayerD", source: "qwen-paper", l1: [0.0709, 0.0396], iou: [0.752, 0.865] },
  { name: "Qwen-Image-Layered-I2L, Crello-tuned", source: "qwen-paper", l1: [0.0594, 0.0363], iou: [0.8705, 0.916] },
  { name: "Qwen-Image-Layered, released, 640", source: "ming-run", l1: [0.1481, 0.088], iou: [0.7131, 0.8672] },
  { name: "Qwen-Image-Layered, released, 1024", source: "ming-run", l1: [0.1409, 0.0736], iou: [0.7177, 0.8749] },
  { name: "CLEAR-1024 (Ours)", source: "ming-ours", l1: [0.0574, 0.0314], iou: [0.8923, 0.9424] },
]

const SOURCE: Record<Source, { label: string; tone: string }> = {
  "qwen-paper": { label: "copied from Qwen-Image-Layered's Table 1 — matches to 4 d.p.", tone: "bg-foreground/25" },
  "ming-run": { label: "Ming team's run of the released Qwen weights", tone: "bg-amber-500/70" },
  "ming-ours": { label: "the table's own row, named CLEAR", tone: "bg-sky-500/80" },
}

const MAX_L1 = 0.15

export function CrelloProvenance() {
  const ours = ROWS[6]
  const tuned = ROWS[3]
  const released = ROWS[5]
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-crello-provenance={ROWS.length}
      aria-label="The Crello layer-decomposition table from the Ming-Image-0.1-Design-Layer model card, with the provenance of each row"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        Crello test set &mdash; RGB L1 (lower is better) at MLM 0, strict matching
      </div>

      <div className="space-y-2 px-4 py-4">
        {ROWS.map((r) => (
          <div key={r.name} className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span
              className="basis-full truncate font-mono text-[11px] sm:w-64 sm:shrink-0 sm:basis-auto"
              title={r.name}
            >
              <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", SOURCE[r.source].tone)} />
              {r.name}
            </span>
            <div className="relative h-4 flex-1 rounded-sm bg-muted/50">
              <div
                className={cn("absolute inset-y-0 left-0 rounded-sm", SOURCE[r.source].tone)}
                style={{ width: `${(r.l1[0] * 100) / MAX_L1}%` }}
              />
            </div>
            <span className="w-36 shrink-0 text-right font-mono text-[11px] tabular-nums">
              {r.l1[0].toFixed(4)}
              <span className="text-muted-foreground"> &middot; IoU {r.iou[0].toFixed(3)}</span>
            </span>
          </div>
        ))}
      </div>

      <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 border-t px-4 py-3 pl-4 font-mono text-xs text-muted-foreground">
        {(Object.keys(SOURCE) as Source[]).map((k) => (
          <li key={k} className="my-0">
            <span className={cn("mr-1.5 inline-block h-2 w-2 rounded-xs align-middle", SOURCE[k].tone)} />
            {SOURCE[k].label}
          </li>
        ))}
      </ul>

      <dl className="my-0 grid gap-x-6 gap-y-1 border-t px-4 py-4 font-mono text-xs sm:grid-cols-[1fr_auto]">
        <dt className="text-muted-foreground">CLEAR vs the Crello-tuned Qwen row, RGB L1 at MLM 0</dt>
        <dd className="my-0 tabular-nums">
          {(((ours.l1[0] - tuned.l1[0]) * 100) / tuned.l1[0]).toFixed(1)}%
        </dd>
        <dt className="text-muted-foreground">same, alpha soft IoU at MLM 0</dt>
        <dd className="my-0 tabular-nums">+{(ours.iou[0] - tuned.iou[0]).toFixed(4)}</dd>
        <dt className="text-muted-foreground">CLEAR vs the released Qwen weights at 1024, RGB L1 at MLM 0</dt>
        <dd className="my-0 tabular-nums">
          {(((ours.l1[0] - released.l1[0]) * 100) / released.l1[0]).toFixed(1)}%
        </dd>
      </dl>

      <figcaption className="border-t px-4 py-3 text-xs text-muted-foreground">
        The comparison that decides whether this is a strong result is the last
        grey row: a Qwen model fine-tuned on Crello&rsquo;s training split, which
        CLEAR beats by 3.4% on the strict column. Whether CLEAR also saw that
        split is the one fact the table does not state. Against the Qwen weights
        anyone can download the margin is 59%, and the table&rsquo;s own footnote
        explains most of that: the paper&rsquo;s number came from a Crello-tuned
        checkpoint that was never released.
      </figcaption>
    </figure>
  )
}
