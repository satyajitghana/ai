// Architecture diagrams for explainers. Two modes, both server-rendered:
// - `ascii` prop: monospace box-drawing diagram (agent/print friendly by nature)
// - children: inline SVG you author directly in MDX
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
        <div className="overflow-x-auto rounded-md border p-4">{children}</div>
      )}
      {caption ? (
        <figcaption className="mt-2 text-center font-mono text-xs text-muted-foreground">
          {caption}
        </figcaption>
      ) : null}
    </figure>
  )
}
