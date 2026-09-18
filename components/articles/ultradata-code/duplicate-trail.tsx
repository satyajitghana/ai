import { DUP, DUP_EXAMPLES, LANGS } from "./data"

// What survived "near-duplicate deduplication" — one sample, shown honestly.
//
// L1 of the pipeline is where MinHash + LSH near-dedup runs, and L2 is drawn
// from L1. So exact byte-for-byte repeats in L2 are the easiest possible case
// for that stage: identical files have identical signatures and Jaccard 1.0.
// 178 of 5,500 sampled rows have a byte-identical twin inside the same sample,
// and every one of the 178 pairs crosses a repository boundary.
//
// The left panel is the rate per language. The right panel is one group in
// full, because the rate on its own is abstract and the group is not: five
// copies of Flutter's generated Windows runner, each from a different student's
// project, each scored separately.
//
// Server-rendered, zero JS. All widths are count/max.

const SHOWN: (keyof typeof DUP_EXAMPLES)[] = ["cpp", "php", "py"]

const BLURB: Record<string, string> = {
  cpp: "Flutter generates this file into every new desktop project. Nobody wrote these five.",
  php: "Laravel's stock database config, unedited, from seven unrelated repositories.",
  py: "pip's vendored copy of rich, inside three people's committed virtualenvs — labelled ALGO.",
}

export function DuplicateTrail() {
  const rows = LANGS.map((l) => ({
    name: l.name,
    sampled: l.dup.sampled,
    dup: l.dup.dup_rows,
    rate: l.dup.dup_rows / l.dup.sampled,
  }))
  const max = Math.max(...rows.map((r) => r.rate))

  return (
    <figure className="my-8 rounded-md border bg-muted/20 p-4">
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        <div>
          <p className="my-0 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            byte-identical rows, 500 sampled per language
          </p>
          <ul className="mt-3 list-none space-y-1.5 pl-0">
            {rows.map((r) => (
              <li key={r.name} className="my-0 flex items-center gap-2">
                <span className="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">
                  {r.name}
                </span>
                <span className="h-3 min-w-0 flex-1 rounded-sm bg-muted">
                  <span
                    className="block h-3 rounded-sm bg-[oklch(0.62_0.16_25)]"
                    style={{
                      width: `${max === 0 ? 0 : (r.rate / max) * 100}%`,
                    }}
                  />
                </span>
                <span className="w-16 shrink-0 text-right font-mono text-[11px]">
                  {(r.rate * 100).toFixed(1)}%
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 mb-0 text-xs leading-5 text-muted-foreground">
            {DUP.dup} of {DUP.sampled.toLocaleString("en-US")} sampled L2 rows,{" "}
            {((DUP.dup / DUP.sampled) * 100).toFixed(2)}%, across {DUP.groups}{" "}
            groups. Java and Rust: zero.
          </p>
        </div>

        <div className="space-y-4">
          {SHOWN.map((k) => {
            const ex = DUP_EXAMPLES[k]
            const scores = new Set(ex.rows.map((r) => r.q))
            return (
              <div key={k} className="border-l-2 border-foreground/20 pl-3">
                <p className="my-0 font-mono text-[11px] break-words">
                  {ex.path}
                </p>
                <p className="my-0 font-mono text-[10px] text-muted-foreground">
                  {ex.copies} identical copies · {ex.chars.toLocaleString("en-US")}{" "}
                  bytes each · category {ex.category}
                </p>
                <p className="mt-1 mb-1 text-xs leading-5 text-muted-foreground">
                  {BLURB[k]}
                </p>
                <ul className="my-0 list-none space-y-0.5 pl-0 font-mono text-[10px] text-muted-foreground">
                  {ex.rows.map((r) => (
                    <li key={r.idx} className="my-0 flex gap-2 break-all">
                      <span className="shrink-0 tabular-nums">
                        row {r.idx.toLocaleString("en-US")}
                      </span>
                      <span className="min-w-0">{r.repo}</span>
                      <span className="ml-auto shrink-0 tabular-nums">
                        q {r.q.toFixed(6)}
                      </span>
                    </li>
                  ))}
                </ul>
                {scores.size > 1 ? (
                  <p className="mt-1 mb-0 text-[11px] leading-5 text-[oklch(0.62_0.16_25)]">
                    Same bytes, {scores.size} different quality scores.
                  </p>
                ) : null}
              </div>
            )
          })}
        </div>
      </div>

      <figcaption className="mt-4 border-t pt-3 font-mono text-[11px] leading-5 text-muted-foreground">
        5 windows of 100 rows per split at offsets 0/20/40/60/80% via
        datasets-server <span className="text-foreground/70">/rows</span>, SHA-256
        over the UTF-8 bytes of <span className="text-foreground/70">content</span>.
        A floor on the corpus rate, not an estimate of it.
      </figcaption>
    </figure>
  )
}
