// The flagship interactive: pick a scene, then flip through six published
// methods plus the input photo, all on the real committed renders from the
// project website. Pure CSS — two independent radio groups (scene, method)
// gate ~35 <img> panels through chained :has() selectors generated below, so
// there is zero client JS. Without :has() support the very first combo
// (dogs / input) still renders as a plain static image, which is a correct
// degraded state, not a broken one.
//
// This is *our* framing of the comparison, not a redraw of the paper's own
// grid (Fig. 6/8) — those are embedded separately as real paper figures.

const SCENES = [
  { slug: "dogs", label: "Dogs", note: "wet fur, thin legs, water spray" },
  { slug: "laundry", label: "Laundry lines", note: "wires against open sky" },
  { slug: "flowers", label: "Hair & petals", note: "flyaway hair, thin stems" },
  { slug: "lobby", label: "Hotel lobby", note: "synthetic scene, glossy floor" },
  { slug: "train", label: "Train", note: "hard edges, railings" },
] as const

const METHODS: readonly { slug: string; label: string; dir: string; ours?: boolean }[] = [
  { slug: "input", label: "Input", dir: "input_images" },
  { slug: "marigoldv1-1", label: "Marigold V1.1", dir: "marigoldv1.1" },
  { slug: "lotus2", label: "Lotus-2", dir: "lotus2_depth" },
  { slug: "moge3", label: "MoGe-3", dir: "moge3" },
  { slug: "ppd", label: "PPD", dir: "ppd" },
  { slug: "infinidepth", label: "InfiniDepth", dir: "infinidepth" },
  { slug: "marigoldv2", label: "Marigold V2", dir: "ours-sinkhorn", ours: true },
]

const NS = "mv2dcv"

export function MethodCompareViewer() {
  const sceneId = (s: string) => `${NS}-s-${s}`
  const methodId = (m: string) => `${NS}-m-${m}`

  const css = `
    .${NS} .panel { display: none; }
    ${SCENES.map((s) =>
      METHODS.map(
        (m) =>
          `.${NS}:has(#${sceneId(s.slug)}:checked):has(#${methodId(m.slug)}:checked) .panel[data-scene="${s.slug}"][data-method="${m.slug}"] { display: block; }`
      ).join("\n")
    ).join("\n")}
    ${SCENES.map((s) => `.${NS}:has(#${sceneId(s.slug)}:checked) label[for="${sceneId(s.slug)}"] { background: var(--foreground); color: var(--background); }`).join("\n")}
    ${METHODS.map((m) => `.${NS}:has(#${methodId(m.slug)}:checked) label[for="${methodId(m.slug)}"] { background: var(--foreground); color: var(--background); }`).join("\n")}
    /* Browsers without :has() (essentially none by 2026) fall back to one static combo. */
    @supports not selector(:has(a)) {
      .${NS} .panel.is-default { display: block; }
    }
  `

  return (
    <figure className={`${NS} my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent`}>
      {/* eslint-disable-next-line react/no-unknown-property */}
      <style>{css}</style>

      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          six published methods, one input, real committed renders
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          Marigold V2 project page
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div role="radiogroup" aria-label="Scene" className="flex flex-wrap gap-1.5">
          {SCENES.map((s, i) => (
            <span key={s.slug}>
              <input
                type="radio"
                name={`${NS}-scene`}
                id={sceneId(s.slug)}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <label
                htmlFor={sceneId(s.slug)}
                className="cursor-pointer rounded-full border border-border px-2.5 py-1 font-mono text-[10px] text-muted-foreground transition-colors hover:text-foreground"
              >
                {s.label}
              </label>
            </span>
          ))}
        </div>

        <div role="radiogroup" aria-label="Method" className="mt-2 flex flex-wrap gap-1.5">
          {METHODS.map((m, i) => (
            <span key={m.slug}>
              <input
                type="radio"
                name={`${NS}-method`}
                id={methodId(m.slug)}
                defaultChecked={i === 0}
                className="sr-only"
              />
              <label
                htmlFor={methodId(m.slug)}
                className={`cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors hover:text-foreground ${
                  m.ours
                    ? "border-foreground/40 text-foreground"
                    : "border-border text-muted-foreground"
                }`}
              >
                {m.label}
              </label>
            </span>
          ))}
        </div>

        <div className="relative mt-3 overflow-hidden rounded-md border">
          {SCENES.map((s) =>
            METHODS.map((m) => (
              <div
                key={`${s.slug}-${m.slug}`}
                className={`panel${s.slug === SCENES[0].slug && m.slug === METHODS[0].slug ? " is-default" : ""}`}
                data-scene={s.slug}
                data-method={m.slug}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/articles/marigold-v2/depth/${s.slug}/${m.slug}.webp`}
                  alt={`${s.label} scene (${s.note}) — ${m.label} output`}
                  className="aspect-square w-full object-cover"
                />
              </div>
            ))
          )}
        </div>

        <p className="mt-2 font-mono text-[10px] text-muted-foreground">
          pick a scene, then flip the method row — look at the edges, not the color
        </p>
      </div>
    </figure>
  )
}
