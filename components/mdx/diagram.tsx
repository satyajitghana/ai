import { Zoomable } from "@/components/mdx/zoomable"

// Architecture diagrams for explainers. Two modes, both server-rendered:
// - `ascii` prop: monospace box-drawing diagram (agent/print friendly by nature)
// - children: inline SVG you author directly in MDX
// SVG diagrams get an expand-to-fullscreen control (via Zoomable); ascii stays
// plain text. Both degrade to static output with no JS.
export function Diagram({
  ascii,
  caption,
  children,
}: {
  ascii?: string
  caption?: string
  children?: React.ReactNode
}) {
  return (
    <figure className="my-8">
      {ascii ? (
        <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 font-mono text-xs leading-5">
          {ascii.replace(/^\n+|\s+$/g, "")}
        </pre>
      ) : (
        <Zoomable label="diagram">
          <div className="overflow-x-auto rounded-md border p-4">{children}</div>
        </Zoomable>
      )}
      {caption ? (
        <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
