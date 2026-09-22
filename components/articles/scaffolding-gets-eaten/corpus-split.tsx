// The same test, run on this site's own evidence.
//
// Each of these three pieces argued that the decision layer is where the
// engineering lives. Each of them is actually two arguments welded together,
// and only one of the two survives a stronger base model:
//
//   left  — the capability argument. "Use the bounded model here because the
//           model cannot / should not be asked to do that." Depreciating.
//   right — the guarantee. "The runtime will not execute anything that was not
//           already on the list." Not depreciating, but not free either.
//
// Splitting them is the whole exercise; writing them as one claim is what makes
// the warning land harder than it should.
//
// Server-rendered, zero JS.
const CASES: {
  name: string
  href: string
  eaten: string
  kept: string
  price: string
}[] = [
  {
    name: "WindTunnel · WebMCP arm",
    href: "/articles/webmcp-windtunnel",
    eaten:
      "Jev selects the action and Mercury writes the arguments because one model cannot emit a string and the other costs 16× more per token. That split is two capability facts about two particular checkpoints. Astra solves the same WebMCP tasks on its own.",
    kept:
      "The menu is rebuilt from the live page every step, capped, checked for duplicates, and an id that was not offered throws instead of doing something approximate. When a tool refuses, it answers with its legal values — “a property of the code on the website, not of either model.”",
    price:
      "The agent can only ever do what the page currently exposes. A task that needs an unexposed action is unreachable, not merely hard.",
  },
  {
    name: "json-render · composition",
    href: "/articles/generative-ui-by-decision",
    eaten:
      "“Root selection, grouping, and deciding when to stop require planning, which is a documented weakness of Jev.” A weakness is a thing that gets fixed.",
    kept:
      "The catalog bounds component names, props and events; code assembles the tree from the chosen keys and validates the whole thing before it renders; “unavailable” is itself a candidate, so “nothing fits” comes back as a choice rather than as a malformed spec.",
    price:
      "Stated in their own README: “repeating the same field in multiple forms and arbitrary new text/data are not supported.”",
  },
  {
    name: "the design rule itself",
    href: "/articles/what-decision-models-cannot-do",
    eaten:
      "Eight bits per call, no scratchpad, no intermediate state — all true, and all of it true about one family of small bounded models rather than about harnesses. A frontier model has a scratchpad.",
    kept:
      "“Put the bounded model where the answer set is already finite, and where something else owns the composition.” The finite set is a decision the caller made before any model was asked.",
    price:
      "“You do not remove the open-ended part of the problem … you move it to whoever builds the list.”",
  },
]

export function CorpusSplit() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        three arguments this site has made, each one cut in half
      </div>

      <div className="grid gap-px bg-border">
        {CASES.map((c) => (
          <div key={c.name} className="bg-background">
            <div className="border-b px-3 py-2">
              <a
                href={c.href}
                className="font-mono text-[12px] text-foreground underline decoration-foreground/30 underline-offset-4"
              >
                {c.name}
              </a>
            </div>
            <div className="grid gap-px bg-border sm:grid-cols-2">
              <div className="bg-background px-3 py-2.5">
                <p className="font-mono text-[9.5px] tracking-wide text-muted-foreground uppercase">
                  the capability argument &#183; depreciating
                </p>
                <p className="mt-1 text-[12px] leading-5 text-muted-foreground">{c.eaten}</p>
              </div>
              <div className="bg-background px-3 py-2.5">
                <p className="font-mono text-[9.5px] tracking-wide text-foreground uppercase">
                  the guarantee &#183; not depreciating
                </p>
                <p className="mt-1 text-[12px] leading-5 text-foreground/90">{c.kept}</p>
                <p className="mt-2 border-l-2 border-border pl-2 text-[11px] leading-4 text-muted-foreground">
                  what it costs: {c.price}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        The right-hand column is the part that survives, and the line under it is the part
        this site has usually left out. A guarantee with no stated price reads like a free
        win, which is how thirty articles came to sound like a bet on scaffolding.
      </figcaption>
    </figure>
  )
}
