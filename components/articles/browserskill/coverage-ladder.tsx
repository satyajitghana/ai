import { cn } from "@/lib/utils"

// "The direct smoke lane covers 25 of 28 operations." — evals/browser/README.md
//
// That sentence is true, and running the harness reproduces it exactly. The
// question it does not answer is what the 28 is. BrowserSkill's protocol
// declares 41 tool.* methods; the extension dispatches 40 of them (the daemon
// answers tool.wait_ms itself and it never reaches Chrome). The eval corpus
// names 28 operations, which map onto 28 of those 41. So the honest reading of
// the headline number is 25 of 41 — 61% of the browser surface — and seven of
// the 13 methods with no case at all are exactly what the 0.3.0 release
// announced.
//
// Every number here came out of the repo at commit d1356fd:
//   node evals/browser/cli.mjs coverage
//   grep -c 'rename = "tool\.'  crates/bsk-protocol/src/method.rs
//   distinct case "tool.…" labels in apps/extension/src/tools/dispatcher.ts
//
// Server-rendered, zero JS. The bars are integer percentages of 41, so nothing
// here needs lib/dmath: only division and Math.round, both exact.

const SURFACE = 41

type Band = {
  label: string
  value: number
  sub: string
  color: string
}

const BANDS: Band[] = [
  {
    label: "direct smoke lane",
    value: 25,
    sub: "the number the README prints — 25 of the 28 operations the corpus names",
    color: "oklch(0.58 0.13 165)",
  },
  {
    label: "agent-prompt lane",
    value: 21,
    sub: "operations any case actually asks an agent to perform; the README does not give this one",
    color: "oklch(0.68 0.13 85)",
  },
  {
    label: "named in the inventory",
    value: 28,
    sub: "OPERATION_CATALOG — the denominator the 25 is out of",
    color: "oklch(0.62 0.03 250)",
  },
  {
    label: "dispatched by the extension",
    value: 40,
    sub: "distinct tool.* handlers in the ToolDispatcher switch",
    color: "oklch(0.62 0.03 250)",
  },
  {
    label: "declared by the protocol",
    value: SURFACE,
    sub: "tool.* variants in bsk-protocol; tool.wait_ms is answered by the daemon, never by the browser",
    color: "oklch(0.62 0.03 250)",
  },
]

const UNEVALUATED = [
  "wheel",
  "scroll_to",
  "focus",
  "blur",
  "upload",
  "download",
  "screenshot_full_page",
  "screenshot_read",
  "screenshot_release",
  "evaluate",
  "record_start",
  "record_stop",
  "record_await",
]

export function CoverageLadder() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          &ldquo;25 of 28&rdquo; — out of what, exactly
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          bars scaled to {SURFACE} protocol methods
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="space-y-2.5">
          {BANDS.map((b) => (
            <div key={b.label}>
              <div className="flex items-center gap-2">
                <span className="w-[8.5rem] shrink-0 text-right font-mono text-[10px] leading-4 text-foreground sm:w-44">
                  {b.label}
                </span>
                <div className="h-4 min-w-0 flex-1 rounded-sm bg-muted/40">
                  <div
                    className="h-4 rounded-sm"
                    style={{
                      width: `${Math.round((b.value / SURFACE) * 1000) / 10}%`,
                      background: b.color,
                      opacity: 0.9,
                    }}
                  />
                </div>
                <span
                  className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums"
                  style={{ color: b.color }}
                >
                  {b.value}/{SURFACE}
                </span>
              </div>
              <div className="mt-0.5 pl-2 text-xs leading-5 text-muted-foreground sm:pl-[11.5rem]">
                {b.sub}
              </div>
            </div>
          ))}
        </div>

        <div className={cn("mt-4 rounded-lg border bg-muted/20 px-3 py-2.5")}>
          <div className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
            {UNEVALUATED.length} methods with no case in the corpus
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1">
            {UNEVALUATED.map((m) => (
              <code
                key={m}
                className="rounded border border-border/70 bg-secondary px-1 py-0.5 font-mono text-[10px]"
              >
                tool.{m}
              </code>
            ))}
          </div>
        </div>

        <p className="mt-4 mb-0 text-sm leading-6 text-muted-foreground">
          Seven of those thirteen are exactly the seven methods 0.3.0 introduced — none of them
          exists in the protocol at tag <code className="font-mono text-[0.9em]">cli-v0.2.1</code>,
          so every browser method the current release added is untested. A corpus that grows more
          slowly than the tool surface is the ordinary condition of every test suite I have ever
          shipped, and BrowserSkill&rsquo;s is unusually honest about its own manual lane. It is the
          published <em>fraction</em> that flatters: 25/28 reads as 89%, and the browser surface it
          is drawn from is 41.
        </p>
      </div>
    </figure>
  )
}
