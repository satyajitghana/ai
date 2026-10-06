import { KINDS, LEVELS, runsOnById } from "@/data/taxonomy"
import { type ArticleFacts, RUBRIC, type RubricKey, TIER_COLOR, type TierId } from "@/lib/content/rating"
import { cn } from "@/lib/utils"

// The visual pieces of the article scoring system, shared by the /articles
// list (client) and the "What you get" card on an article page (server). No
// hooks and no server imports, so either side can render them.

export type TierView = { id: TierId; label: string; level: number }

/** Five ascending bars, filled to the tier's level. Decorative: pair it with text. */
export function TierBars({ tier, className }: { tier: TierView; className?: string }) {
  const color = TIER_COLOR[tier.id]
  return (
    <span className={cn("flex items-end gap-[2px]", className)} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((b) => (
        <span
          key={b}
          className="w-[3px] rounded-[1px]"
          style={{
            height: `${3 + b * 2}px`,
            background: b <= tier.level ? color : "var(--border)",
          }}
        />
      ))}
    </span>
  )
}

/** "▂▄▆ High · 79": tier bars, the tier's name and the 0–100 score. */
export function TierLabel({ tier, score }: { tier: TierView; score: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-xs">
      <TierBars tier={tier} />
      <span className="text-foreground">{tier.label}</span>
      <span className="tabular-nums text-muted-foreground">{Math.round(score)}</span>
    </span>
  )
}

/**
 * The eight rubric dimensions as 0–3 segment bars. A definition list: each
 * term is the dimension and its description is the score, spoken as "2 of 3";
 * the segments themselves are decorative.
 */
export function RubricBars({
  rating,
  tier,
  className,
}: {
  rating: Record<RubricKey, number>
  tier: TierView | null
  className?: string
}) {
  const color = tier ? TIER_COLOR[tier.id] : "var(--foreground)"
  return (
    <dl className={cn("grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2", className)}>
      {RUBRIC.map((d) => {
        const v = rating[d.key]
        return (
          <div key={d.key} className="grid grid-cols-[6.5rem_1fr] items-center gap-2" title={`${d.asks} ${v}/3: ${d.anchors[v]}`}>
            <dt className="font-mono text-[11px] text-muted-foreground">{d.label}</dt>
            <dd className="flex items-center gap-2">
              <span className="flex flex-1 gap-[3px]" aria-hidden="true">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className="h-1.5 flex-1 rounded-full"
                    style={{ background: s <= v ? color : "var(--border)" }}
                  />
                ))}
              </span>
              <span className="w-7 text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {v}
                <span className="sr-only"> of 3, {d.anchors[v]}</span>
                <span aria-hidden="true">/3</span>
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

export type FactMeta = {
  licence?: string
  runsOn?: string
  level?: string
  kind?: string
}

const label = (list: readonly { id: string; label: string }[], id?: string) =>
  id ? list.find((x) => x.id === id)?.label : undefined

/** Small chips for what the page carries and what its subject needs. */
export function FactChips({
  facts,
  meta,
  className,
}: {
  facts: Pick<ArticleFacts, "figures" | "interactives" | "measured" | "film" | "readingTimeMins">
  meta: FactMeta
  className?: string
}) {
  const runs = meta.runsOn ? runsOnById(meta.runsOn) : undefined
  const chips: { k: string; v: string }[] = []
  const kind = label(KINDS, meta.kind)
  const level = label(LEVELS, meta.level)
  if (kind) chips.push({ k: "kind", v: kind })
  if (level) chips.push({ k: "level", v: level })
  if (runs) chips.push({ k: "runs on", v: runs.label })
  if (meta.licence && meta.licence !== "n/a") chips.push({ k: "licence", v: meta.licence })
  if (facts.figures) chips.push({ k: "figures", v: String(facts.figures) })
  if (facts.interactives) chips.push({ k: "interactives", v: String(facts.interactives) })
  if (facts.measured) chips.push({ k: "measured", v: `${facts.measured}×` })
  if (facts.film) chips.push({ k: "film", v: "yes" })
  chips.push({ k: "read", v: `${facts.readingTimeMins} min` })
  return (
    <ul className={cn("flex flex-wrap gap-1.5", className)} aria-label="Facts">
      {chips.map((c) => (
        <li
          key={c.k}
          className="rounded-md border bg-muted/40 px-1.5 py-0.5 font-mono text-[11px] leading-5 text-muted-foreground"
        >
          {c.k} <span className="text-foreground">{c.v}</span>
        </li>
      ))}
    </ul>
  )
}
