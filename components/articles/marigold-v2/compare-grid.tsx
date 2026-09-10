// A plain static comparison grid: one row per scene, one column per method,
// real committed renders. No toggle here — unlike the depth viewer, these
// are small enough sets (3 scenes each) that showing every column at once is
// more legible than hiding six of them behind a click. Zero JS, degrades to
// a normal image grid for the .md/no-JS/agent path.

type Method = { slug: string; label: string; ours?: boolean }
type Scene = { slug: string; label: string; note: string }

export function CompareGrid({
  basePath,
  scenes,
  methods,
  ext = "webp",
}: {
  basePath: string
  scenes: readonly Scene[]
  methods: readonly Method[]
  ext?: string
}) {
  return (
    <div className="my-8 overflow-hidden rounded-xl border">
      {scenes.map((s, si) => (
        <div key={s.slug} className={si > 0 ? "border-t" : ""}>
          <div className="border-b bg-muted/20 px-3 py-1.5 font-mono text-[10px] text-muted-foreground">
            {s.label} — {s.note}
          </div>
          <div
            className="grid gap-px bg-border"
            style={{ gridTemplateColumns: `repeat(${methods.length}, minmax(0, 1fr))` }}
          >
            {methods.map((m) => (
              <figure key={m.slug} className="m-0 bg-background">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`${basePath}/${s.slug}/${m.slug}.${ext}`}
                  alt={`${s.label} (${s.note}) — ${m.label}`}
                  className="aspect-square w-full object-cover"
                />
                <figcaption
                  className={`px-1.5 py-1 text-center font-mono text-[9px] ${
                    m.ours ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {m.label}
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
