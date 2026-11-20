"use client"

// The three.js names scene code reaches for, sorted by what ThreeRT does with them, and what the same code gets when
// it runs as three.js in a browser. Click a name for both answers.

import { useState } from "react"

import { ENTRIES, GROUPS, STATUS, type Status } from "./api-map"

const ORDER: Status[] = ["same", "mapped", "ignored", "absent", "extra"]

export function ApiCoverage() {
  const [sel, setSel] = useState(ENTRIES.findIndex((e) => e.name === "Emissive surfaces"))
  const [only, setOnly] = useState<Status | null>(null)
  const e = ENTRIES[sel]
  const counts = ORDER.map((s) => ENTRIES.filter((x) => x.status === s).length)

  return (
    <figure className="not-prose my-8 rounded-xl border">
      <div className="flex flex-wrap gap-2 border-b px-3 py-3 text-xs sm:px-4">
        {ORDER.map((s, i) => (
          <button key={s} type="button" onClick={() => setOnly(only === s ? null : s)}
            className={`rounded-full border px-2.5 py-1 ${STATUS[s].cls} ${only && only !== s ? "opacity-40" : ""}`}>
            {STATUS[s].label} · {counts[i]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 px-3 py-3 sm:px-4 md:grid-cols-[1.4fr_1fr]">
        <div className="space-y-3">
          {GROUPS.map((g) => (
            <div key={g}>
              <div className="mb-1 font-mono text-[11px] uppercase tracking-wide text-muted-foreground">{g}</div>
              <div className="flex flex-wrap gap-1.5">
                {ENTRIES.map((x, i) =>
                  x.group !== g ? null : (
                    <button key={x.name} type="button" onClick={() => setSel(i)}
                      className={`rounded-md border px-2 py-0.5 text-left font-mono text-[11.5px] ${STATUS[x.status].cls} ${i === sel ? "ring-2 ring-foreground/60" : ""} ${only && only !== x.status ? "opacity-25" : ""}`}>
                      {x.name}
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
        <div className="rounded-lg border bg-muted/30 p-3 text-sm md:sticky md:top-4 md:self-start">
          <div className="font-mono text-[13px] font-semibold">{e.name}</div>
          <div className={`mt-1 inline-block rounded-full border px-2 py-0.5 text-[11px] ${STATUS[e.status].cls}`}>{STATUS[e.status].label}</div>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">In the ThreeRT engine</div>
          <p className="mt-1 leading-snug">{e.native}</p>
          <div className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">As three.js in a browser</div>
          <p className="mt-1 leading-snug">{e.web}</p>
        </div>
      </div>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground sm:px-4">
        Read from @threert/scene&apos;s exports, its compat.ts, tests/three-compat/README.md and tools/three/engine.ts at commit 65a4eb9. A red name is one I searched for and did not find; the list is a sample of what three.js code commonly uses, not all of three.js.
      </figcaption>
    </figure>
  )
}
