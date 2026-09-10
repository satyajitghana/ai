import { cn } from "@/lib/utils"

// The flagship figure of this article: the null result itself. Five bars —
// fly wiring, scrambled wiring, no recurrent connections, audio-only, and a
// constant-score floor — each a mean average precision with its 95% paired
// bootstrap interval (500 resamples over the 45 held-out speaker/corpus
// groups). All four reservoir variants overlap almost completely; only the
// constant baseline is actually distinguishable. Numbers are the paper's own
// (oruk.ai, "Compare the fly with other models" + prose), reproduced exactly.
// Server-rendered, zero JS — the whole point is that you don't need
// interactivity to see four intervals sitting on top of each other.

const DOMAIN: [number, number] = [8, 20]
const TICKS = [8, 10, 12, 14, 16, 18, 20]

type Row = {
  key: string
  label: string
  mean: number
  lo?: number
  hi?: number
  note?: string
  highlight?: boolean
}

const ROWS: Row[] = [
  { key: "connectome", label: "Fly wiring", mean: 16.84, lo: 15.78, hi: 18.84, highlight: true },
  { key: "rewired", label: "Scrambled wiring", mean: 16.88, lo: 15.81, hi: 18.82 },
  { key: "no_recurrence", label: "No recurrent connections", mean: 16.61, lo: 15.53, hi: 18.68 },
  { key: "audio_only", label: "Audio only (bypasses the circuit)", mean: 16.28, lo: 15.51, hi: 18.02 },
  { key: "constant", label: "Constant score (always predict the base rate)", mean: 9.71, note: "no seeds, no interval — a fixed floor" },
]

const pct = (v: number) => ((v - DOMAIN[0]) / (DOMAIN[1] - DOMAIN[0])) * 100

export function WiringComparison() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="flex items-center justify-between border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        <span>mean average precision · 2,022 held-out test clips</span>
        <span className="text-muted-foreground/60">3-seed mean · 95% group bootstrap</span>
      </div>

      <div className="px-4 pt-5 pb-3">
        <div className="space-y-4">
          {ROWS.map((row) => (
            <div key={row.key} className="flex items-center gap-3">
              <span
                className={cn(
                  "w-32 shrink-0 text-right font-mono text-[11px] leading-4 sm:w-44",
                  row.highlight ? "font-medium text-foreground" : "text-muted-foreground"
                )}
              >
                {row.label}
              </span>

              <div className="relative h-6 flex-1">
                <div className="absolute inset-0">
                  {TICKS.map((t) => (
                    <span
                      key={t}
                      className={cn("absolute top-0 bottom-0 w-px", t === 8 ? "bg-border" : "bg-border/40")}
                      style={{ left: `${pct(t)}%` }}
                    />
                  ))}
                </div>

                {row.lo != null && row.hi != null ? (
                  <span
                    className="absolute top-1/2 h-0.5 -translate-y-1/2 rounded-full"
                    style={{
                      left: `${pct(row.lo)}%`,
                      width: `${pct(row.hi) - pct(row.lo)}%`,
                      background: row.highlight ? "oklch(0.6 0.14 155)" : "var(--muted-foreground)",
                      opacity: row.highlight ? 0.9 : 0.55,
                    }}
                  />
                ) : null}

                <span
                  className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-background"
                  style={{
                    left: `${pct(row.mean)}%`,
                    background: row.highlight ? "oklch(0.6 0.14 155)" : "var(--muted-foreground)",
                  }}
                />

                <span
                  className={cn(
                    "absolute top-1/2 -translate-y-1/2 font-mono text-[11px] tabular-nums",
                    row.highlight ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                  style={{ left: `calc(${pct(row.hi ?? row.mean)}% + 10px)` }}
                >
                  {row.mean.toFixed(2)}%{row.note ? <span className="ml-1.5 text-muted-foreground/70">· {row.note}</span> : null}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-3 pl-[8.5rem] sm:pl-[11.5rem]">
          <span className="w-0" aria-hidden />
          <div className="relative h-4 flex-1">
            {TICKS.map((t) => (
              <span
                key={t}
                className="absolute top-0 -translate-x-1/2 font-mono text-[10px] text-muted-foreground tabular-nums"
                style={{ left: `${pct(t)}%` }}
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t px-4 py-3 font-mono text-[11px] leading-5 text-muted-foreground">
        Fly − scrambled: <span className="text-foreground">−0.04 pp</span>, 95% CI{" "}
        <span className="text-foreground">[−0.16, +0.07]</span> — contains zero. Fly − audio-only:{" "}
        <span className="text-foreground">+0.56 pp</span>, CI [−0.24, +1.37] — also contains zero.
      </div>
    </figure>
  )
}
