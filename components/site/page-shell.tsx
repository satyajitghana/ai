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
          <div className="flex items-baseline justify-between gap-4">
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
