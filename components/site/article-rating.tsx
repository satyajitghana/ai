import { CheckIcon } from "@phosphor-icons/react/dist/ssr"

import { RUBRIC, type RubricKey, TIER_COLOR, type TierId, tierBand } from "@/lib/content/rating"
import { cn } from "@/lib/utils"

// The visual pieces of the article scoring system, shared by the /articles
// list (client), the "Why read this" panel on an article page and the
// homepage (server). No hooks and no server imports, so either side can
// render them. What they say comes from lib/content/rating.ts (highlights,
// practicalFacts, tierBand); these only decide how it looks.

export type TierView = { id: TierId; label: string; level: number }

/** URL of the methodology page, and its tier section. */
export const SCORING_PATH = "/articles/scoring"

/**
 * The tier as one calm mark: a dot in the tier's hue and the word, on a faint
 * tint of the same hue. The text stays the foreground colour, so contrast does
 * not depend on the hue. `band` adds "Top 10%" after the word.
 */
export function TierMark({ tier, band = false, className }: { tier: TierView; band?: boolean; className?: string }) {
  const c = TIER_COLOR[tier.id]
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 font-sans text-[11px] leading-5 font-medium whitespace-nowrap text-foreground",
        className,
      )}
      style={{
        borderColor: `color-mix(in oklch, ${c} 40%, transparent)`,
        background: `color-mix(in oklch, ${c} 9%, transparent)`,
      }}
    >
      <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: c }} />
      {tier.label}
      {band ? (
        <span className="font-normal text-muted-foreground">
          <span aria-hidden="true">· </span>
          {tierBand(tier.id).short.toLowerCase()}
        </span>
      ) : null}
    </span>
  )
}

/** Plain-language highlights, each behind a small check. */
export function HighlightList({
  items,
  className,
  itemClassName,
}: {
  items: { key: string; text: string }[]
  className?: string
  itemClassName?: string
}) {
  if (!items.length) return null
  return (
    <ul className={cn("flex flex-wrap gap-x-3 gap-y-1", className)} aria-label="Highlights">
      {items.map((h) => (
        <li key={h.key} className={cn("inline-flex items-center gap-1 whitespace-nowrap", itemClassName)}>
          <CheckIcon size={12} weight="bold" aria-hidden="true" className="shrink-0 opacity-60" />
          {h.text}
        </li>
      ))}
    </ul>
  )
}

/**
 * The eight dimensions as reader questions with three small dots each, and
 * the plain-words meaning of the score beside them. A definition list: the
 * term is the question, the description is "2 of 3" plus the anchor; the dots
 * are decorative.
 */
export function RubricDots({ rating, className }: { rating: Record<RubricKey, number>; className?: string }) {
  return (
    <dl className={cn("divide-y divide-border/60", className)}>
      {RUBRIC.map((d) => {
        const v = rating[d.key]
        return (
          <div key={d.key} className="grid gap-x-4 gap-y-0.5 py-2 sm:grid-cols-[10.5rem_minmax(0,1fr)] sm:items-baseline">
            <dt className="text-sm text-foreground">{d.q}</dt>
            <dd className="flex items-baseline gap-3 text-[13px] leading-5 text-muted-foreground">
              <span className="flex shrink-0 translate-y-[-1px] items-center gap-1" aria-hidden="true">
                {[1, 2, 3].map((s) => (
                  <span
                    key={s}
                    className={cn(
                      "size-2 rounded-full border",
                      s <= v ? "border-foreground/70 bg-foreground/70" : "border-foreground/25",
                    )}
                  />
                ))}
              </span>
              <span>
                <span className="sr-only">{v} of 3: </span>
                {d.anchors[v].charAt(0).toUpperCase() + d.anchors[v].slice(1)}
              </span>
            </dd>
          </div>
        )
      })}
    </dl>
  )
}

/**
 * "A · B · C", with the separators hidden from screen readers. Each part
 * carries its separator in front, and the row is shifted left by one
 * separator's width and clipped, so a part that wraps to a new line never
 * starts with a stray dot.
 */
export function DotLine({ parts, className }: { parts: React.ReactNode[]; className?: string }) {
  const shown = parts.filter(Boolean)
  if (!shown.length) return null
  return (
    <p className={cn("overflow-hidden px-0.5", className)}>
      <span className="-ml-4 flex flex-wrap">
        {shown.map((p, i) => (
          <span key={i} className="inline-flex items-center">
            <span aria-hidden="true" className="w-4 shrink-0 text-center opacity-50">
              ·
            </span>
            {p}
          </span>
        ))}
      </span>
    </p>
  )
}
