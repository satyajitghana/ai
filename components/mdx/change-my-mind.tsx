import { Children, isValidElement } from "react"

// A standing falsifiability section: for each load-bearing claim the article
// makes, the specific observation that would overturn it.
//
// The point is discipline, not decoration. Writing "what would change my mind"
// forces a claim to be stated sharply enough to be wrong — a claim with no
// falsifier is either trivially true or too vague to have been worth making.
// It also dates the work honestly: most findings here are one measurement on
// one build on one day, and this is where that gets said out loud.
//
// Server-rendered, zero JS. Renders its own <h2> so it anchors like any other
// section in the article's outline.

export function Falsifier({
  claim,
  children,
}: {
  claim: string
  children: React.ReactNode
}) {
  return (
    <li className="border-l-2 border-foreground/20 pl-4">
      <p className="my-0 font-medium">{claim}</p>
      <div className="mt-1 text-muted-foreground [&>p]:my-0 [&>p+p]:mt-2">
        {children}
      </div>
    </li>
  )
}

export function ChangeMyMind({
  title = "What would change my mind",
  children,
}: {
  title?: string
  children: React.ReactNode
}) {
  const count = Children.toArray(children).filter(isValidElement).length
  if (count === 0) {
    throw new Error("<ChangeMyMind> is empty — it needs at least one <Falsifier>.")
  }

  return (
    <section data-change-my-mind={count} className="my-10">
      <h2
        id="what-would-change-my-mind"
        className="font-heading mt-10 mb-1 scroll-mt-24 text-2xl font-semibold tracking-tight"
      >
        {title}
      </h2>
      <p className="mt-0 mb-4 font-mono text-xs text-muted-foreground">
        {count} claim{count === 1 ? "" : "s"} above, and what would falsify each
      </p>
      <ol className="my-0 list-none space-y-4 pl-0">{children}</ol>
    </section>
  )
}
