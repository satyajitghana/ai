// Why a per-option scalar scorer cannot score above zero on a question whose
// answer depends on reading two options together.
//
// The left column is what the model sees if each option is encoded and scored
// on its own: three independent (question, option) pairs, none of which
// contains the fact that settles the question. The right column is the same
// three options read as a set, where the answer is available.
//
// Server-rendered, zero JS, integer coordinates only.
const OPTS = [
  { id: "A", text: "Ship to the address on file", key: false },
  { id: "B", text: "Ship to the address in option D", key: false },
  { id: "C", text: "Hold for pickup", key: false },
  { id: "D", text: "14 Almond Row, Reno", key: true },
]

export function RelationalChoice() {
  const row = (o: (typeof OPTS)[number], isolated: boolean) => (
    <div
      key={o.id}
      className={`flex items-start gap-2 rounded-sm border px-2 py-1.5 ${
        isolated ? "border-dashed" : ""
      } ${o.key && !isolated ? "border-foreground/40 bg-foreground/[0.04]" : "border-border"}`}
    >
      <span className="font-mono text-[11px] text-muted-foreground">{o.id}</span>
      <span className="font-mono text-[11px] leading-5">{o.text}</span>
    </div>
  )

  return (
    <figure className="my-8">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="overflow-hidden rounded-md border">
          <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
            scored independently — one option at a time
          </div>
          <div className="space-y-2 px-3 py-3">
            {OPTS.map((o) => (
              <div key={o.id} className="space-y-1">
                <p className="font-mono text-[10px] text-muted-foreground">
                  forward pass {o.id}: (question, {o.id})
                </p>
                {row(o, true)}
              </div>
            ))}
            <p className="pt-1 font-mono text-[11px] leading-5 text-muted-foreground">
              B refers to D. In B&apos;s own forward pass, D does not exist. Nothing the
              scorer sees can tell it whether B is right.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-md border">
          <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
            read as a set — all options in one context
          </div>
          <div className="space-y-2 px-3 py-3">
            {OPTS.map((o) => row(o, false))}
            <p className="pt-1 font-mono text-[11px] leading-5 text-muted-foreground">
              D is visible while B is being judged, so &quot;the address in option D&quot; resolves
              and B becomes answerable.
            </p>
          </div>
        </div>
      </div>
      <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
        An illustration of the failure mode, not a case from the benchmark — the suite&apos;s
        own items are not published. The shape is what matters: if options never share a
        context, a question that spans two of them has no answer to find.
      </figcaption>
    </figure>
  )
}
