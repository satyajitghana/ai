"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Five layers of the roadrash.fun page, from the player down to the data it stands on. Every claim in the detail text
// is read from the site's own JavaScript (app.js, race.js, mano.js, analytics.js, install.js and index.html as served on
// 27 October 2026). The slabs are an isometric drawing with literal coordinates: only + - * / below, so server and
// browser serialise the same numbers.
type Layer = { id: string; title: string; tag: string; tint: string; lines: string[] }

const LAYERS: Layer[] = [
  {
    id: "player",
    title: "What the player holds",
    tag: "new",
    tint: "oklch(0.62 0.15 150)",
    lines: [
      "Menus drawn on the original's 640x480 canvas layout, from the code's own comment in app.js.",
      "A Three.js scene for the race, with touch buttons, tilt steering and keyboard.",
      "A results screen that offers Add to Home Screen from the second race and a WhatsApp or share-sheet link.",
    ],
  },
  {
    id: "services",
    title: "Services the page calls",
    tag: "not public",
    tint: "oklch(0.62 0.15 285)",
    lines: [
      "A WebSocket relay at /mano for friend and public rooms (mano.js).",
      "POST /api/race returns a signed start ticket; POST /api/board scores a finished race (app.js).",
      "PostHog analytics, a Cloudflare beacon, and a service worker at /sw.js.",
      "Server code is not served. We know these only by what the browser sends and expects.",
    ],
  },
  {
    id: "engine",
    title: "The new engine code",
    tag: "new",
    tint: "oklch(0.60 0.16 255)",
    lines: [
      "race.js is 1,941 lines and 169,735 bytes, app.js 591 lines, mano.js 238, as served.",
      "It renders with Three.js and clips roadside geometry with a patched shader.",
      "AI riders, fights, crashes, pedestrians and surfaces are all in this one module.",
    ],
  },
  {
    id: "rules",
    title: "Rules read from the original program",
    tag: "recovered",
    tint: "oklch(0.66 0.14 80)",
    lines: [
      "53 distinct addresses in the 0x4xxxxx range appear in comments across race.js and app.js (50 and 6, with overlap).",
      "Examples: the course table at 0x46c558, level lengths at 0x468f58, surface grip at 0x46dce8.",
      "The physics runs in the original's integers at 60 ticks a second, in speed units of mph x 100.",
    ],
  },
  {
    id: "data",
    title: "Data from the 1996 PC game",
    tag: "original, no licence found",
    tint: "oklch(0.60 0.17 30)",
    lines: [
      "Course records named RPTH, RNOD, RSEC, RHZD and RROB; sprite frames from HIBOB.DAT, numbered up to 322.",
      "A text table (TEXT/ENU.DLL), fonts, music and videos, per the header comment in app.js.",
      "Served from the site as JSON, PNG, WebP and audio. Electronic Arts' game; we found no licence or statement.",
    ],
  },
]

const CX = 150
const HW = 120
const HD = 44
const TH = 18
const GAP = 66
const TOP = 70

function slab(k: number): { top: string; left: string; right: string; cy: number } {
  const cy = TOP + k * GAP
  const top = `${CX},${cy - HD} ${CX + HW},${cy} ${CX},${cy + HD} ${CX - HW},${cy}`
  const left = `${CX - HW},${cy} ${CX},${cy + HD} ${CX},${cy + HD + TH} ${CX - HW},${cy + TH}`
  const right = `${CX + HW},${cy} ${CX},${cy + HD} ${CX},${cy + HD + TH} ${CX + HW},${cy + TH}`
  return { top, left, right, cy }
}

export function LayerStack() {
  const [sel, setSel] = useState(4)
  const cur = LAYERS[sel]

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        five layers of the page · read from the site&apos;s own code, not from running it
      </div>
      <div className="grid gap-4 p-4 md:grid-cols-[300px_1fr]">
        <svg viewBox="0 0 300 380" className="w-full max-w-[300px]" role="img" aria-label="An isometric stack of five slabs: the player's screen on top, then services, the new engine code, rules read from the original program, and the original game's data at the bottom.">
          {LAYERS.map((l, k) => {
            const s = slab(k)
            const on = k === sel
            return (
              <g
                key={l.id}
                role="button"
                tabIndex={0}
                aria-label={l.title}
                aria-pressed={on}
                className="cursor-pointer outline-none"
                onClick={() => setSel(k)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault()
                    setSel(k)
                  }
                }}
              >
                <polygon points={s.left} fill={l.tint} fillOpacity={on ? 0.75 : 0.35} stroke="currentColor" strokeOpacity={0.35} />
                <polygon points={s.right} fill={l.tint} fillOpacity={on ? 0.55 : 0.22} stroke="currentColor" strokeOpacity={0.35} />
                <polygon points={s.top} fill={l.tint} fillOpacity={on ? 0.95 : 0.5} stroke="currentColor" strokeOpacity={on ? 0.8 : 0.35} strokeWidth={on ? 1.6 : 1} />
              </g>
            )
          })}
        </svg>
        <div>
          <div className="flex flex-wrap gap-1.5">
            {LAYERS.map((l, k) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setSel(k)}
                className={cn(
                  "rounded border px-2 py-0.5 font-mono text-[11px] transition-colors",
                  k === sel ? "border-foreground/40 bg-muted text-foreground" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {l.title}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: cur.tint }} />
            <h4 className="text-sm font-medium">{cur.title}</h4>
            <span className="rounded border px-1.5 font-mono text-[10px] text-muted-foreground">{cur.tag}</span>
          </div>
          <ul className="mt-2 space-y-1.5 text-sm leading-relaxed text-muted-foreground">
            {cur.lines.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  )
}
