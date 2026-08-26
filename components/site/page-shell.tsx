import { cn } from "@/lib/utils"
import { AgentChip } from "@/components/site/agent-chip"

// The single editorial column every page lives in. `agentPath` renders the
// md·json·mcp chip — the visible machine-legibility affordance (§9 of the plan).
export function PageShell({
  title,
  lede,
  agentPath,
  className,
  children,
}: {
  title?: string
  lede?: string
  agentPath?: { md?: string; json?: string }
  className?: string
  children: React.ReactNode
}) {
  return (
    <main
      className={cn("mx-auto w-full max-w-3xl flex-1 px-6 pt-12 pb-4", className)}
    >
      {title ? (
        <div className="mb-10">
          {/* The agent chip is a fixed ~140px and does not shrink, so on a
              phone it was taking a third of the line and leaving the h1 to wrap
              a word or two at a time. Stack until there is room for both. */}
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
              {title}
            </h1>
            {agentPath ? <AgentChip {...agentPath} /> : null}
          </div>
          {lede ? (
            <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
              {lede}
            </p>
          ) : null}
        </div>
      ) : null}
      {children}
    </main>
  )
}
