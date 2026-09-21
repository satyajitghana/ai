// The $15.51 rubric rewrite, taken apart.
//
// Recomputed from runs/holdout-v{1,2,3}/block-rows.json in stas4000/jev-linkmap
// at commit 58f636e. All three holdout runs cover the identical 24 pages and the
// identical 360 (source, target) pairs with the identical anchor options — I
// checked, the queue is frozen — so the only things that move between them are
// the rubric text and the two thresholds.
//
// Two blocks. The top block is the comparison as published: each rubric scored
// against the referee pass that was run under that same rubric. The bottom block
// holds both knobs still — thresholds matched at v3's 0.65/0.40, and the
// reference frozen at the v1 referee pass, the only one made under the
// hand-written rubric.
//
// The published recall gain is 45% -> 65%. Matching thresholds alone, with the
// hand-written rubric untouched, gets 64.2% at higher precision, for nothing.
// And the anchor-agreement gain runs the other way: against a referee that never
// read the new rubric, v3's anchors agree 51.4% where v1's agreed 70.8%.
//
// Server-rendered, zero JS.

const POS = "oklch(0.58 0.15 152)"
const NEG = "oklch(0.58 0.19 27)"
const MUTE = "var(--muted-foreground)"

type Row = {
  rubric: string
  author: string
  thresh: string
  ref: string
  refN: number
  recall: number
  precision: number
  anchor: number
  n: number
}

const AS_PUBLISHED: Row[] = [
  { rubric: "v1", author: "hand-written", thresh: "0.70 / 0.50", ref: "v1 pass", refN: 106, recall: 0.453, precision: 0.828, anchor: 0.708, n: 48 },
  { rubric: "v2", author: "one rewrite", thresh: "0.65 / 0.40", ref: "v2 pass", refN: 115, recall: 0.548, precision: 0.84, anchor: 0.698, n: 63 },
  { rubric: "v3", author: "two rewrites", thresh: "0.65 / 0.40", ref: "v3 pass", refN: 117, recall: 0.65, precision: 0.826, anchor: 0.882, n: 76 },
]

const CONTROLLED: Row[] = [
  { rubric: "v1", author: "hand-written", thresh: "0.65 / 0.40", ref: "v1 pass", refN: 106, recall: 0.642, precision: 0.84, anchor: 0.676, n: 68 },
  { rubric: "v2", author: "one rewrite", thresh: "0.65 / 0.40", ref: "v1 pass", refN: 106, recall: 0.547, precision: 0.773, anchor: 0.707, n: 58 },
  { rubric: "v3", author: "two rewrites", thresh: "0.65 / 0.40", ref: "v1 pass", refN: 106, recall: 0.698, precision: 0.804, anchor: 0.514, n: 74 },
]

function Bar({ v, tint }: { v: number; tint: string }) {
  const pct = Math.round(v * 1000) / 10
  return (
    <span className="flex items-center justify-end gap-2">
      <span
        aria-hidden
        className="hidden h-1.5 w-16 overflow-hidden rounded-full sm:block"
        style={{ background: "color-mix(in oklab, currentColor 12%, transparent)" }}
      >
        <span
          className="block h-full rounded-full"
          style={{ width: `${pct}%`, background: tint }}
        />
      </span>
      <span className="font-mono text-xs tabular-nums" style={{ color: tint }}>
        {pct.toFixed(1)}%
      </span>
    </span>
  )
}

function Block({ rows, heading }: { rows: Row[]; heading: string }) {
  return (
    <>
      <tr>
        <th
          colSpan={5}
          scope="colgroup"
          className="px-3 pt-4 pb-1 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground"
        >
          {heading}
        </th>
      </tr>
      {rows.map((r) => (
        <tr key={r.rubric + r.thresh + r.ref} className="border-t">
          <td className="px-3 py-2 align-top">
            <span className="font-mono text-xs text-foreground">{r.rubric}</span>{" "}
            <span className="text-xs text-muted-foreground">{r.author}</span>
            <span className="block font-mono text-[10px] text-muted-foreground">
              {r.thresh} · ref {r.ref}, {r.refN} yes
            </span>
          </td>
          <td className="px-3 py-2 text-right align-top">
            <Bar v={r.recall} tint={POS} />
          </td>
          <td className="px-3 py-2 text-right align-top">
            <Bar v={r.precision} tint={MUTE} />
          </td>
          <td className="px-3 py-2 text-right align-top">
            <Bar v={r.anchor} tint={r.anchor >= 0.8 ? POS : r.anchor < 0.6 ? NEG : MUTE} />
          </td>
          <td className="px-3 py-2 text-right align-top font-mono text-[10px] text-muted-foreground tabular-nums">
            {r.n}
          </td>
        </tr>
      ))}
    </>
  )
}

export function RubricDecomposition() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        runs/holdout-v*/block-rows.json — 24 pages, 360 decisions, identical queue in all three
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Recall, precision and anchor agreement for rubric versions 1, 2 and 3, first as
            published and then with the thresholds matched and the reference referee pass held
            fixed.
          </caption>
          <thead>
            <tr>
              <th scope="col" className="px-3 py-2 text-left font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                rubric · thresholds · reference
              </th>
              <th scope="col" className="px-3 py-2 text-right font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                recall
              </th>
              <th scope="col" className="px-3 py-2 text-right font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                precision
              </th>
              <th scope="col" className="px-3 py-2 text-right font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                same anchor
              </th>
              <th scope="col" className="px-3 py-2 text-right font-mono text-[11px] font-medium tracking-wide text-muted-foreground">
                n
              </th>
            </tr>
          </thead>
          <tbody>
            <Block rows={AS_PUBLISHED} heading="as published — each rubric against its own referee pass" />
            <Block
              rows={CONTROLLED}
              heading="thresholds matched at 0.65 / 0.40, reference frozen at the v1 referee pass"
            />
          </tbody>
        </table>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Top block, row one to row three, is the announcement: recall 45% to 65%, anchor agreement
        71% to 88%. Bottom block, row one, is the hand-written rubric with nothing changed but two
        numbers: <span className="font-mono">64.2%</span> recall at{" "}
        <span className="font-mono">84.0%</span> precision, which is the higher precision of the
        two. Bottom row is the trained rubric judged by a referee that never read it, and its
        anchor agreement falls to <span className="font-mono">51.4%</span> — below the rubric it
        replaced. <span className="font-mono">n</span> is the number of decisions both judges
        placed, which is what the anchor column is computed over.
      </p>
    </figure>
  )
}
