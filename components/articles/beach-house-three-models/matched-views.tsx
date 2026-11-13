"use client"

// The blind judgement, replayable. Eleven views of the three beach houses, each
// rendered through the site's own loader (house-gl.ts) in headless Chromium at
// 1600x900 and published here at 1200x675. The two aerials use one camera for
// all three houses; every other view is at eye height (1.6 m above the floor,
// the walk lens, tilted 8 degrees down) at the equivalent spot in each house's
// own floor plan. JUDGES holds each judge's 1st/2nd/3rd per view, transcribed
// from the three reports and mapped back from their A/B/C labels.
// Only the active view's three images are mounted. SSR-safe: plain state.

import { useState } from "react"

import { mediaUrl } from "@/lib/media"

type House = "opus" | "fable" | "sonnet"

const HOUSES: { id: House; name: string; blind: string }[] = [
  // the blind letters here are this widget's own order, not any judge's
  { id: "sonnet", name: "Sonnet 5.5", blind: "House 1" },
  { id: "opus", name: "Opus 5.5", blind: "House 2" },
  { id: "fable", name: "Fable 5.2", blind: "House 3" },
]

const VIEWS: { id: string; label: string }[] = [
  { id: "aerial-sea", label: "Air, sea side" },
  { id: "aerial-land", label: "Air, land side" },
  { id: "beach", label: "Beach" },
  { id: "boardwalk", label: "Boardwalk" },
  { id: "deck", label: "Deck" },
  { id: "balcony", label: "Balcony" },
  { id: "living", label: "Living room" },
  { id: "groundback", label: "Looking back in" },
  { id: "master", label: "Main bedroom" },
  { id: "bed2", label: "Second bedroom" },
  { id: "bath", label: "Bathroom" },
]

// per view, each judge's order, best first. Judge names are the model each ran on.
const JUDGES = ["Opus judge", "Sonnet judge", "Fable judge"] as const
const O: House = "opus", F: House = "fable", S: House = "sonnet"
const RANKS: Record<string, [House[], House[], House[]]> = {
  "aerial-sea": [[O, F, S], [O, S, F], [O, F, S]],
  "aerial-land": [[O, F, S], [O, S, F], [O, F, S]],
  beach: [[F, O, S], [O, S, F], [F, O, S]],
  boardwalk: [[F, O, S], [O, S, F], [F, S, O]],
  deck: [[F, O, S], [F, O, S], [F, S, O]],
  balcony: [[F, O, S], [F, O, S], [F, O, S]],
  living: [[O, F, S], [O, F, S], [O, F, S]],
  groundback: [[F, O, S], [O, F, S], [O, F, S]],
  master: [[F, O, S], [F, O, S], [F, O, S]],
  bed2: [[O, F, S], [O, F, S], [O, F, S]],
  bath: [[F, O, S], [F, O, S], [F, O, S]],
}

const ORD = ["1st", "2nd", "3rd"]

function firsts(h: House): number {
  let n = 0
  for (const v of Object.values(RANKS)) for (const r of v) if (r[0] === h) n++
  return n
}

export function MatchedViews() {
  const [view, setView] = useState("aerial-sea")
  const [shown, setShown] = useState(false)
  const label = VIEWS.find((v) => v.id === view)?.label ?? ""
  const ranks = RANKS[view]

  return (
    <figure className="not-prose my-8 overflow-hidden rounded-xl border" aria-label="The same view of the three beach houses, with the blind judges' rankings">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>11 matched views · 3 houses · 3 blind judges</span>
        <button
          type="button"
          onClick={() => setShown((s) => !s)}
          aria-pressed={shown}
          className={`rounded-md border px-2.5 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${shown ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
        >
          {shown ? "Hide models and ranks" : "Reveal models and ranks"}
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b px-4 py-3 font-mono text-xs" role="group" aria-label="View">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            type="button"
            aria-pressed={v.id === view}
            onClick={() => setView(v.id)}
            className={`rounded-md border px-2 py-1 transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${v.id === view ? "bg-foreground text-background hover:bg-foreground/90" : ""}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-3">
        {HOUSES.map((h) => (
          <div key={h.id} className="bg-background">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={view + h.id}
              src={mediaUrl(`/articles/beach-house-three-models/${h.id}-${view}.jpg`)}
              alt={`${label}, ${shown ? `the house built by ${h.name}` : h.blind}`}
              width={1200}
              height={675}
              loading="lazy"
              className="block aspect-video w-full object-cover"
            />
            <div className="px-3 py-2 font-mono text-xs">
              <div className="font-semibold">{shown ? h.name : h.blind}</div>
              {shown && (
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                  {JUDGES.map((j, i) => {
                    const place = ranks[i].indexOf(h.id)
                    return (
                      <span key={j} className={place === 0 ? "text-foreground" : ""}>
                        {j}: {ORD[place]}
                      </span>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <figcaption className="border-t px-4 py-3 text-sm text-muted-foreground">
        {shown ? (
          <>
            First places over all 33 judgements (3 judges, 11 views): Fable {firsts("fable")}, Opus {firsts("opus")}, Sonnet {firsts("sonnet")}. The judges saw these
            frames labelled A, B and C in a different shuffled order each; the house numbers here are this page&apos;s own.
          </>
        ) : (
          <>Pick a view and make your own call before revealing which model built which house and how the three judges ranked them.</>
        )}
      </figcaption>
    </figure>
  )
}
