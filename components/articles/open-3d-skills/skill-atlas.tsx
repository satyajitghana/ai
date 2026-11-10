"use client"

import { useState } from "react"

// The eight skills, counted from a depth-1 clone of Moh4696/open-3d-skills at
// 53beb89 (9 November 2026). "desc" is the frontmatter description length in
// characters (the text an agent reads to decide whether to load the skill;
// the repo's own test caps it at 1,024). "words" is the SKILL.md body.
// "code" is lines in scripts/ and assets/ (JS and Python). "gen" is whether the
// README says the skill needs an image or video generation service.

type Row = { name: string; does: string; desc: number; words: number; code: number; gen: boolean; here: string }

const ROWS: Row[] = [
  { name: "threejs-scene", does: "code-built three.js scenes, 60 fps starter", desc: 667, words: 1407, code: 705, gen: false, here: "read; followed its renderer notes" },
  { name: "exploded-view", does: "staged explode, x-ray, section, labels", desc: 558, words: 927, code: 467, gen: false, here: "followed; staging rule re-implemented and run" },
  { name: "frame-capture", does: "virtual-clock 60 fps recorder, comparisons", desc: 525, words: 1031, code: 493, gen: false, here: "technique re-implemented and run" },
  { name: "site-check", does: "Chromium + WebKit shots, frame time, blank canvas", desc: 622, words: 828, code: 295, gen: false, here: "probe re-implemented and run (Chromium)" },
  { name: "scroll-film", does: "scroll-scrubbed films from generated clips", desc: 607, words: 1099, code: 299, gen: true, here: "read only" },
  { name: "motion-assets", does: "plan and log paid image/video generation", desc: 739, words: 956, code: 191, gen: true, here: "read only" },
  { name: "alpha-cutout", does: "chroma-key clips to stacked-alpha video", desc: 642, words: 1035, code: 435, gen: true, here: "read only" },
  { name: "cursor-rig", does: "painted head that follows the cursor", desc: 648, words: 1014, code: 547, gen: true, here: "read only" },
]

const FILTERS = [
  { id: "all", label: "all 8" },
  { id: "local", label: "no generator needed" },
  { id: "gen", label: "needs a generator" },
] as const

export function SkillAtlas() {
  const [f, setF] = useState<(typeof FILTERS)[number]["id"]>("all")
  const rows = ROWS.filter((r) => f === "all" || (f === "gen" ? r.gen : !r.gen))
  const maxWords = Math.max(...ROWS.map((r) => r.words))
  const sum = (k: "words" | "code") => rows.reduce((a, r) => a + r[k], 0)

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>the eight skills · counted from the clone</span>
        <span className="text-muted-foreground/50">53beb89</span>
      </div>
      <div className="space-y-3 p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-1 font-mono text-xs">
          {FILTERS.map((x) => (
            <button
              key={x.id}
              type="button"
              onClick={() => setF(x.id)}
              className={`rounded-md border px-2 py-1 ${f === x.id ? "border-foreground/50 bg-foreground/10" : "text-muted-foreground"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] font-mono text-xs">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-1 pr-3 font-normal">skill</th>
                <th className="py-1 pr-3 font-normal">SKILL.md words</th>
                <th className="py-1 pr-3 text-right font-normal">desc chars</th>
                <th className="py-1 pr-3 text-right font-normal">code lines</th>
                <th className="py-1 font-normal">in this article</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.name} className="border-t align-top">
                  <td className="py-1.5 pr-3">
                    <div>{r.name}</div>
                    <div className="text-muted-foreground">{r.does}</div>
                  </td>
                  <td className="py-1.5 pr-3">
                    <div className="flex items-center gap-2">
                      <span className="inline-block h-2 rounded-sm" style={{ width: `${(r.words / maxWords) * 80}px`, background: r.gen ? "oklch(0.65 0.15 45)" : "oklch(0.6 0.12 240)" }} />
                      {r.words.toLocaleString("en-US")}
                    </div>
                  </td>
                  <td className="py-1.5 pr-3 text-right">{r.desc}</td>
                  <td className="py-1.5 pr-3 text-right">{r.code}</td>
                  <td className="py-1.5 text-muted-foreground">{r.here}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="font-mono text-xs leading-relaxed text-muted-foreground" aria-live="polite">
          {rows.length} skills, {sum("words").toLocaleString("en-US")} words of instructions, {sum("code").toLocaleString("en-US")} lines of scripts and browser modules. Blue bars need nothing but a browser, Python and ffmpeg; orange ones need a paid image or video model to make their input.
        </p>
      </div>
    </figure>
  )
}
