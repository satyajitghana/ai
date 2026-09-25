import { cn } from "@/lib/utils"

// What the pocket rewriters were actually trained on, by request category.
//
// Measured from the ML-Intern-lab dataset at revision 48e631c: the 8,797 rows
// of data/requests_full.jsonl carry each request's `category`, and the 1,776
// chat rows of data/sft_train.jsonl carry the request text as the user turn.
// Joining on that text matches all 1,776. "kept" is the share of a category's
// requests whose teacher rewrite survived every filter rule and landed in the
// training set.
//
// The filter was never meant to select by category. It selects by length —
// 80 to 400 words — and the teacher's rewrites are long: median 599 words over
// all 8,797 rows, and only 2,289 of them (26.0%) at 400 or under, counting
// words with filter.py's own regex. The short
// ones are overwhelmingly single-emblem images, which the teacher's own
// system prompt describes in fewer words. So a length cut became a curriculum.
//
// Server-rendered, zero JS. Arithmetic is + - * / and toFixed only.

type Row = { category: string; label: string; all: number; kept: number; textHeavy: boolean }

// Sorted by kept share, descending. `textHeavy` marks the categories whose
// requests are layouts built around legible text.
const ROWS: Row[] = [
  { category: "sticker", label: "sticker", all: 813, kept: 581, textHeavy: false },
  { category: "logo_icon", label: "logo / icon", all: 924, kept: 655, textHeavy: false },
  { category: "product_shot", label: "product shot", all: 792, kept: 252, textHeavy: false },
  { category: "scene", label: "scene", all: 982, kept: 116, textHeavy: false },
  { category: "portrait", label: "portrait", all: 976, kept: 100, textHeavy: false },
  { category: "photo", label: "photo", all: 940, kept: 27, textHeavy: false },
  { category: "infographic", label: "infographic", all: 795, kept: 19, textHeavy: true },
  { category: "poster", label: "poster", all: 866, kept: 11, textHeavy: true },
  { category: "illustration", label: "illustration", all: 885, kept: 10, textHeavy: false },
  { category: "ui_screen", label: "UI screen", all: 824, kept: 5, textHeavy: true },
]

const TOTAL_ALL = ROWS.reduce((s, r) => s + r.all, 0) // 8,797
const TOTAL_KEPT = ROWS.reduce((s, r) => s + r.kept, 0) // 1,776
const EMBLEM = ROWS.filter((r) => r.category === "sticker" || r.category === "logo_icon").reduce(
  (s, r) => s + r.kept,
  0
)
const TEXT_HEAVY = ROWS.filter((r) => r.textHeavy).reduce((s, r) => s + r.kept, 0)

const pct = (n: number, of: number) => ((n * 100) / of).toFixed(1)

export function CurriculumSkew() {
  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-curriculum-skew={TOTAL_KEPT}
      aria-label="Share of each request category that survived the pocket rewriters' training filter"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        {TOTAL_ALL.toLocaleString("en-US")} teacher-labelled requests →{" "}
        {TOTAL_KEPT.toLocaleString("en-US")} training rows, by category
      </div>

      <div className="space-y-2 px-4 py-4">
        <div className="grid grid-cols-[6.5rem_1fr_5.5rem] gap-x-3 font-mono text-xs text-muted-foreground sm:grid-cols-[8rem_1fr_7rem]">
          <span className="text-right">category</span>
          <span>share of its requests kept</span>
          <span className="text-right">kept / all</span>
        </div>
        {ROWS.map((r) => (
          <div
            key={r.category}
            className="grid grid-cols-[6.5rem_1fr_5.5rem] items-center gap-x-3 font-mono text-xs sm:grid-cols-[8rem_1fr_7rem]"
          >
            <span className={cn("truncate text-right", r.textHeavy && "font-medium")}>
              {r.label}
            </span>
            <div className="relative h-5 rounded-sm bg-muted/50">
              <div
                className={cn(
                  "absolute inset-y-0 left-0 rounded-sm",
                  r.textHeavy ? "bg-foreground/85" : "bg-foreground/35"
                )}
                style={{ width: `${(r.kept * 100) / r.all}%` }}
              />
              <span className="absolute inset-y-0 left-1.5 flex items-center tabular-nums">
                {pct(r.kept, r.all)}%
              </span>
            </div>
            <span className="text-right tabular-nums">
              {r.kept.toLocaleString("en-US")} / {r.all.toLocaleString("en-US")}
            </span>
          </div>
        ))}
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Stickers and logos are{" "}
        <span className="font-mono text-foreground tabular-nums">
          {pct(EMBLEM, TOTAL_KEPT)}%
        </span>{" "}
        of the training set. Posters, infographics and UI screens — the dark bars,
        the layouts that exist to carry legible text — are{" "}
        <span className="font-mono text-foreground tabular-nums">{TEXT_HEAVY}</span>{" "}
        rows between them, out of{" "}
        <span className="font-mono text-foreground tabular-nums">
          {(866 + 795 + 824).toLocaleString("en-US")}
        </span>{" "}
        such requests the teacher labelled. And{" "}
        <span className="font-mono text-foreground tabular-nums">73.0%</span>{" "}
        of the training targets carry a 1:1 ratio, against 35.6% of the
        teacher&rsquo;s answers overall.
      </p>
    </figure>
  )
}
