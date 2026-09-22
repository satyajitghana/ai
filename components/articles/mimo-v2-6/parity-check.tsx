import { cn } from "@/lib/utils"

// "On par with Claude Opus 5 and GPT-5.6 Sol across most agent benchmarks",
// scored against the model card's own table.
//
// Every number here is transcribed from the evaluation table in
// XiaomiMiMo/MiMo-V2.6-Pro-RL's README, which is the source of the claim. Rows
// where any of the three is missing a score are dropped, because a comparison
// needs all three. Higher is better everywhere, including GDPval-AA, which is an
// Elo.
//
// Server-rendered, zero JS. The tally at the bottom is the whole point: it is
// the same arithmetic any reader would do, just done.

type Row = {
  bench: string
  group: string
  mimo: number
  opus: number
  gpt: number
}

const ROWS: Row[] = [
  { group: "Code", bench: "DeepSWE v1.1", mimo: 71.9, opus: 74.0, gpt: 73.0 },
  { group: "Code", bench: "ProgramBench", mimo: 26.5, opus: 37.0, gpt: 25.0 },
  {
    group: "Code",
    bench: "MiMo Code Bench",
    mimo: 63.2,
    opus: 68.6,
    gpt: 59.3,
  },
  {
    group: "General agent",
    bench: "AutomationBench v1.0.6",
    mimo: 53.1,
    opus: 50.3,
    gpt: 45.8,
  },
  {
    group: "General agent",
    bench: "Toolathlon-Verified",
    mimo: 76.9,
    opus: 80.6,
    gpt: 74.9,
  },
  {
    group: "General agent",
    bench: "GDPval-AA 2.1 (Elo)",
    mimo: 1673,
    opus: 1708,
    gpt: 1588,
  },
  {
    group: "General agent",
    bench: "Agents' Last Exam",
    mimo: 31.6,
    opus: 31.6,
    gpt: 30.8,
  },
  {
    group: "General agent",
    bench: "Terminal Bench 4.0",
    mimo: 34.9,
    opus: 49.0,
    gpt: 39.9,
  },
  {
    group: "General agent",
    bench: "Terminal Bench 2.1",
    mimo: 89.9,
    opus: 89.1,
    gpt: 88.8,
  },
  {
    group: "General agent",
    bench: "OSWorld-Verified",
    mimo: 82.0,
    opus: 83.4,
    gpt: 83.0,
  },
  {
    group: "General agent",
    bench: "JobBench",
    mimo: 62.0,
    opus: 65.7,
    gpt: 45.4,
  },
  { group: "Cyber", bench: "ExploitGym", mimo: 17.8, opus: 22.1, gpt: 30.3 },
  { group: "Cyber", bench: "ExploitBench", mimo: 47.9, opus: 70.0, gpt: 78.5 },
  {
    group: "Visual",
    bench: "MiMo VisualCoding",
    mimo: 72.3,
    opus: 70.0,
    gpt: 73.4,
  },
]

// "Par" band: within 2% of the better of the two frontier scores. Stated rather
// than hidden, because where you draw it changes the tally.
const BAND = 0.02

type Verdict = "ahead" | "par" | "behind"

function verdict(r: Row): Verdict {
  const best = Math.max(r.opus, r.gpt)
  if (r.mimo >= best) return "ahead"
  if (r.mimo >= best * (1 - BAND)) return "par"
  return "behind"
}

const MARK: Record<Verdict, string> = {
  ahead: "ahead",
  par: "par",
  behind: "behind",
}

export function ParityCheck() {
  const verdicts = ROWS.map(verdict)
  const n = (v: Verdict) => verdicts.filter((x) => x === v).length
  const worstGap = ROWS.reduce(
    (w, r) => {
      const best = Math.max(r.opus, r.gpt)
      const g = (best - r.mimo) / best
      return g > w.g ? { g, bench: r.bench, gap: best - r.mimo } : w
    },
    { g: 0, bench: "", gap: 0 }
  )

  // Group headings are derived up front rather than tracked with a mutable
  // cursor during render, so nothing is reassigned mid-render.
  const isFirstOfGroup = ROWS.map(
    (r, i) => i === 0 || ROWS[i - 1].group !== r.group
  )

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        MiMo-V2.6-Pro against the two frontier models it names · the
        card&rsquo;s own table
      </div>
      <div className="overflow-x-auto">
        <table className="my-0 w-full min-w-[520px] border-collapse text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="px-3 py-2 text-left font-mono text-xs font-medium text-muted-foreground">
                benchmark
              </th>
              <th className="px-2 py-2 text-right font-mono text-xs font-medium">
                MiMo Pro
              </th>
              <th className="px-2 py-2 text-right font-mono text-xs font-medium text-muted-foreground">
                Opus 5
              </th>
              <th className="px-2 py-2 text-right font-mono text-xs font-medium text-muted-foreground">
                GPT-5.6 Sol
              </th>
              <th className="px-3 py-2 text-right font-mono text-xs font-medium text-muted-foreground">
                vs best
              </th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r, i) => {
              const v = verdicts[i]
              const head = isFirstOfGroup[i]
              return (
                <tr key={r.bench} className="border-b last:border-b-0">
                  <td className="px-3 py-1.5">
                    {head ? (
                      <div className="mt-1 font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                        {r.group}
                      </div>
                    ) : null}
                    {/* The group label is a block, so this space is invisible on
                        screen -- but without it textContent fuses the two, and
                        the .md twin of this page reads "VisualMiMo VisualCoding". */}
                    {" "}
                    {r.bench}
                  </td>
                  <td
                    className={cn(
                      "px-2 py-1.5 text-right font-mono text-xs tabular-nums",
                      v === "ahead" && "font-semibold"
                    )}
                  >
                    {r.mimo}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {r.opus}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {r.gpt}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-1.5 text-right font-mono text-xs",
                      v === "ahead" &&
                        "text-[var(--hg-accent,oklch(0.72_0.15_195))]",
                      v === "behind" && "text-muted-foreground"
                    )}
                  >
                    {MARK[v]}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t px-4 py-3 font-mono text-xs">
        <span className="text-foreground">
          ahead {n("ahead")} · par {n("par")} · behind {n("behind")}
        </span>
        <span className="text-muted-foreground">
          {" "}
          · of {ROWS.length} rows where all three have a score · widest gap{" "}
          {worstGap.bench}, {(worstGap.g * 100).toFixed(0)}% below the better
          frontier score
        </span>
      </div>
      <figcaption className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        &ldquo;Par&rdquo; is within 2% of the better frontier score, which is my
        threshold, not Xiaomi&rsquo;s — move it and the tally moves. Rows where
        one of the three has no score are dropped. Two of these benchmarks are
        MiMo&rsquo;s own.
      </figcaption>
    </figure>
  )
}
