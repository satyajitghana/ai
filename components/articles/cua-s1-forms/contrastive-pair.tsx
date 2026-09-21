// Bespoke's contrastive data curation, drawn as the thing it actually is: two
// examples that are byte-identical except for one sentence, where that sentence
// is the only thing in either document that settles the question — and it flips
// the label. The claim is that training on pairs like this forces discrimination
// rather than pattern-matching. That claim is untested; the article says so.
//
// Server-rendered, zero JS.
const SHARED = [
  "Policy: expedite an order only when the customer",
  "holds an active Priority membership.",
  "Order #4471 placed 2026-09-02, ships from Reno.",
  "Customer has contacted support twice this month.",
]

export function ContrastivePair() {
  const card = (
    variant: "a" | "b",
    focus: string,
    answer: string,
    tone: string,
  ) => (
    <div className="flex-1 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="font-mono text-xs text-muted-foreground">
          example {variant.toUpperCase()}
        </span>
        <span className={`font-mono text-xs font-semibold ${tone}`}>{answer}</span>
      </div>
      <div className="space-y-1 px-3 py-3">
        {SHARED.map((line) => (
          <p key={line} className="font-mono text-[11px] leading-5 text-muted-foreground">
            {line}
          </p>
        ))}
        <p
          className={`rounded-sm px-1 font-mono text-[11px] leading-5 font-semibold ${tone} bg-foreground/[0.06]`}
        >
          {focus}
        </p>
      </div>
      <div className="border-t px-3 py-2">
        <p className="font-mono text-[11px] text-muted-foreground">
          Q: expedite this order?
        </p>
      </div>
    </div>
  )

  return (
    <figure className="my-8">
      <div className="flex flex-col gap-3 sm:flex-row">
        {card("a", "Membership: Priority, active since 2024.", "YES", "text-emerald-600 dark:text-emerald-400")}
        {card("b", "Membership: Priority, lapsed in March.", "NO", "text-rose-600 dark:text-rose-400")}
      </div>
      <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
        One edited sentence. Same question, same policy, same everything else — and the
        answer flips. Remove that sentence from either card and the fact it settles is
        unknowable from the rest, which is the property the pipeline checks for.
      </figcaption>
    </figure>
  )
}
