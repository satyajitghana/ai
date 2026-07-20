// A zero-JS hero: the BM25 equation, decomposed. Three color-coded factors — rarity
// (IDF), a saturating term-frequency factor (k1), and length normalization (b) — each
// mapped to the plain-English job it does and the section that unpacks it. No hooks, no
// client bundle; it renders once on the server as the article's map of the formula.

const RARITY = "oklch(0.72 0.15 195)" // cyan — IDF
const SAT = "oklch(0.62 0.16 285)" // violet — k1 saturation
const LENGTH = "oklch(0.72 0.14 70)" // amber — b length norm

function Chip({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      className="rounded px-1.5 py-0.5"
      style={{ background: `color-mix(in oklch, ${color} 16%, transparent)`, color }}
    >
      {children}
    </span>
  )
}

function Legend({
  color,
  factor,
  knob,
  desc,
}: {
  color: string
  factor: string
  knob: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
      <div>
        <div className="font-mono text-xs">
          <span style={{ color }}>{factor}</span>
          <span className="text-muted-foreground"> · {knob}</span>
        </div>
        <div className="text-sm leading-6 text-muted-foreground">{desc}</div>
      </div>
    </div>
  )
}

export function FormulaAnatomy() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        anatomy of BM25 · three factors, one score
      </div>
      <div className="p-4 sm:p-6">
        {/* the equation, color-coded */}
        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-4 font-mono text-sm sm:text-base">
          <span className="text-muted-foreground">
            score(<span className="text-foreground">D</span>,<span className="text-foreground">Q</span>) =
          </span>
          <span className="text-lg text-muted-foreground">Σ</span>
          <span className="text-[11px] text-muted-foreground/70">q ∈ Q</span>

          <Chip color={RARITY}>IDF(q)</Chip>
          <span className="text-muted-foreground">×</span>

          {/* the saturating, length-normalized term-frequency fraction */}
          <span className="inline-flex flex-col items-center leading-tight">
            <span className="px-2 pb-1">
              <Chip color={SAT}>
                f · (k1 + 1)
              </Chip>
            </span>
            <span className="my-0.5 h-px w-full" style={{ background: SAT }} />
            <span className="px-2 pt-1">
              <Chip color={SAT}>f</Chip>
              <span className="text-muted-foreground"> + </span>
              <Chip color={SAT}>k1</Chip>
              <span className="text-muted-foreground"> · </span>
              <Chip color={LENGTH}>
                (1 − b + b · |D|/avgdl)
              </Chip>
            </span>
          </span>
        </div>

        {/* legend: each factor -> its job */}
        <div className="mt-6 grid gap-4 border-t pt-5 sm:grid-cols-3">
          <Legend
            color={RARITY}
            factor="rarity"
            knob="IDF"
            desc="Rare terms dominate; a word in every document scores ≈ 0, so there's no stopword list."
          />
          <Legend
            color={SAT}
            factor="saturation"
            knob="k1 = 1.2"
            desc="Term frequency saturates — the first mention is strong evidence, the tenth is nearly noise."
          />
          <Legend
            color={LENGTH}
            factor="length"
            knob="b = 0.75"
            desc="Longer documents are discounted, so they don't rank highly just for having more words."
          />
        </div>
      </div>
    </figure>
  )
}
