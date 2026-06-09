import type { StackItem } from "@/data/health"

// Pill tags for the health stack — wearables and supplements feeding the
// dashboard. Linked when a url is present. Minimal mono styling to match the
// editorial column.
function marker(type: StackItem["type"]): string {
  return type === "device" ? "📟" : "💊"
}

function Pill({ item }: { item: StackItem }) {
  const inner = (
    <>
      <span aria-hidden>{marker(item.type)}</span>
      <span>{item.name}</span>
    </>
  )

  const className =
    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-xs text-muted-foreground"

  return item.url ? (
    <a
      href={item.url}
      className={`${className} underline-offset-4 transition-colors hover:text-foreground hover:underline`}
    >
      {inner}
    </a>
  ) : (
    <span className={className}>{inner}</span>
  )
}

export function HealthStack({ stack }: { stack: StackItem[] }) {
  return (
    <ul className="flex flex-wrap gap-2">
      {stack.map((item) => (
        <li key={`${item.type}:${item.name}`}>
          <Pill item={item} />
        </li>
      ))}
    </ul>
  )
}
