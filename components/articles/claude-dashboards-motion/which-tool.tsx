"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// "Which tool for which job": Claude Motion against this site's own explainer-film
// pipeline, built only from what the sources say. Every cell is one of three
// states, and each carries the line it rests on:
//   does    the source says so, or the launch film shows it
//   doesnt  the source says the opposite, or the thing is structurally absent
//   unknown nothing published says either way (this is most of Motion's spec sheet)
// For Motion the sources are the announcement (claude.com, 8 Oct 2026), the help
// centre's "Get started with Claude Motion", "What are artifacts", "Share
// artifacts" and the artifacts admin guide, and stills from the launch film. For
// the pipeline they are files in this repo. No hands-on test of Motion was
// possible, so "unknown" is not a polite "no".

type State = "does" | "doesnt" | "unknown"
type Cell = { s: State; why: string }
type Need = { id: string; label: string; motion: Cell; ours: Cell }

const NEEDS: Need[] = [
  {
    id: "freeform",
    label: "Free-form visuals: a 3D city, a custom layout, anything code can draw",
    motion: { s: "does", why: "Claude writes code per animation; the launch example turns the station map into a 3D city grid." },
    ours: { s: "doesnt", why: "A storyboard picks from 15 scene types; the engine owns every drawing." },
  },
  {
    id: "warehouse",
    label: "Built straight from company data that lives in a warehouse",
    motion: { s: "does", why: "The launch example starts from a dashboard artifact; the help asks you to attach the report or data." },
    ours: { s: "doesnt", why: "The only input is the article's MDX and its figures." },
  },
  {
    id: "comments",
    label: "Teammates comment on a moment in the film and Claude acts on it",
    motion: { s: "does", why: "The launch film shows an @Claude comment pinned to a frame, then \"Updating artifact\"." },
    ours: { s: "doesnt", why: "Review is a pull request over a JSON storyboard." },
  },
  {
    id: "spot",
    label: "Change one word, number or timing and leave the rest alone",
    motion: { s: "does", why: "Help centre: change one detail \"and the rest stays as it was\"." },
    ours: { s: "doesnt", why: "Any storyboard edit changes its hash and the whole film re-renders." },
  },
  {
    id: "editor",
    label: "Finish it in a video editor",
    motion: { s: "does", why: "MP4 export, and \"open it in\" Adobe, Descript, HeyGen, Higgsfield, invideo, Luma AI or Runway." },
    ours: { s: "does", why: "A plain MP4 with a WebVTT file beside it; any editor opens it." },
  },
  {
    id: "voice",
    label: "Narration and captions in the deliverable",
    motion: { s: "unknown", why: "No source mentions a voice, music or captions. The launch film's player has a mute button, nothing more." },
    ours: { s: "does", why: "Kokoro voices every line on CPU and a WebVTT track ships with each film." },
  },
  {
    id: "truth",
    label: "Every number on screen is checked against a source text",
    motion: { s: "unknown", why: "Dashboards show each chart's query. Nothing says an animation keeps that link, and an MP4 cannot carry it." },
    ours: { s: "does", why: "validate:films fails any digit a viewer sees or hears that is not in the article." },
  },
  {
    id: "look",
    label: "One house look across every film",
    motion: { s: "unknown", why: "Design systems are documented for designs and decks, not for Motion." },
    ours: { s: "does", why: "Eighteen styles, chosen per film, drawn by one engine." },
  },
  {
    id: "batch",
    label: "Hundreds of films, re-rendered when their source changes",
    motion: { s: "unknown", why: "No API or batch path is documented; artifacts are not offered through third-party clouds." },
    ours: { s: "does", why: "Over 460 storyboards; a freshness hash marks a film stale and build.mjs --stale re-renders it." },
  },
  {
    id: "local",
    label: "Runs on my own machine, outside any plan's usage limit",
    motion: { s: "doesnt", why: "Hosted; it counts toward the plan's usage limits, and longer animations use more." },
    ours: { s: "does", why: "Headless Chromium, Kokoro-82M and ffmpeg on a CPU." },
  },
  {
    id: "pro",
    label: "Available to someone on a Pro or Max plan",
    motion: { s: "doesnt", why: "Motion is in beta on Team and Enterprise only (Dashboards reaches Pro and Max)." },
    ours: { s: "does", why: "No plan involved." },
  },
]

const PRESETS: { name: string; ids: string[] }[] = [
  { name: "All-hands chart from the warehouse", ids: ["warehouse", "comments", "spot", "freeform"] },
  { name: "Published article explainer", ids: ["voice", "truth", "look", "batch"] },
  { name: "Customer onboarding walkthrough", ids: ["freeform", "voice", "editor", "spot"] },
]

const MARK: Record<State, { sym: string; cls: string; word: string }> = {
  does: { sym: "✓", cls: "text-emerald-600 dark:text-emerald-400", word: "does" },
  doesnt: { sym: "✗", cls: "text-rose-600 dark:text-rose-400", word: "does not" },
  unknown: { sym: "?", cls: "text-amber-600 dark:text-amber-400", word: "not documented" },
}

function tally(cells: Cell[]) {
  return {
    does: cells.filter((c) => c.s === "does").length,
    doesnt: cells.filter((c) => c.s === "doesnt").length,
    unknown: cells.filter((c) => c.s === "unknown").length,
  }
}

export function WhichTool() {
  const [picked, setPicked] = useState<string[]>(PRESETS[0].ids)
  const [open, setOpen] = useState<string | null>(null)

  const sel = NEEDS.filter((n) => picked.includes(n.id))
  const m = tally(sel.map((n) => n.motion))
  const o = tally(sel.map((n) => n.ours))

  let verdict = "Pick the needs that matter for the job."
  if (sel.length) {
    if (m.doesnt === 0 && m.unknown === 0 && o.doesnt > 0)
      verdict = "Everything you picked is documented for Motion, and the pipeline misses some of it. Motion fits."
    else if (o.doesnt === 0 && m.doesnt + m.unknown > 0)
      verdict = "The pipeline covers everything you picked; for Motion, some of it is missing or undocumented."
    else if (m.doesnt === 0 && o.doesnt > 0)
      verdict = `Motion is not ruled out, but ${m.unknown} of your needs rest on things nobody has documented. Try it before you plan around it.`
    else if (o.doesnt > 0 && m.doesnt > 0)
      verdict = "Neither covers the whole list. Split the job, or drop a need."
    else verdict = "Both cover it. Pick on cost and on who has to review the result."
  }

  const toggle = (id: string) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const chip = (active: boolean) =>
    cn(
      "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
      active
        ? "border-foreground/30 bg-muted/50 text-foreground"
        : "border-border text-muted-foreground hover:text-foreground",
    )

  const samePreset = (ids: string[]) => ids.length === picked.length && ids.every((i) => picked.includes(i))

  const cellView = (c: Cell, who: string, id: string) => (
    <button
      type="button"
      onClick={() => setOpen(open === id + who ? null : id + who)}
      className="flex w-full cursor-pointer items-center justify-center gap-1 rounded-md py-1 hover:bg-muted/40"
      aria-label={`${who}: ${MARK[c.s].word}. Show the source.`}
    >
      <span className={cn("font-mono text-sm", MARK[c.s].cls)}>{MARK[c.s].sym}</span>
    </button>
  )

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">Which tool for which job</span>
        <span className="font-mono text-[10px] text-muted-foreground">
          documented facts only; tap a mark for its source
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              type="button"
              className={chip(samePreset(p.ids))}
              aria-pressed={samePreset(p.ids)}
              onClick={() => setPicked(p.ids)}
            >
              {p.name}
            </button>
          ))}
          <button type="button" className={chip(false)} onClick={() => setPicked([])}>
            clear
          </button>
        </div>

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className="text-left font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="w-8 py-1.5" />
                <th className="py-1.5 font-normal">need</th>
                <th className="w-20 py-1.5 text-center font-normal">Motion</th>
                <th className="w-20 py-1.5 text-center font-normal">our films</th>
              </tr>
            </thead>
            <tbody>
              {NEEDS.map((n) => {
                const on = picked.includes(n.id)
                const shown = open === n.id + "Motion" ? n.motion : open === n.id + "ours" ? n.ours : null
                return (
                  <tr key={n.id} className={cn("border-t align-top", !on && "opacity-55")}>
                    <td className="py-1.5">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(n.id)}
                        aria-label={n.label}
                        className="mt-1 cursor-pointer"
                      />
                    </td>
                    <td className="py-1.5 pr-2">
                      <span className="leading-snug">{n.label}</span>
                      {shown && (
                        <span className="mt-1 block text-xs text-muted-foreground">
                          <span className={cn("font-mono", MARK[shown.s].cls)}>
                            {open?.endsWith("Motion") ? "Motion" : "Our films"} {MARK[shown.s].word}:
                          </span>{" "}
                          {shown.why}
                        </span>
                      )}
                    </td>
                    <td className="py-1">{cellView(n.motion, "Motion", n.id)}</td>
                    <td className="py-1">{cellView(n.ours, "ours", n.id)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {[
            ["Motion", m],
            ["Our films", o],
          ].map(([name, t]) => {
            const tt = t as ReturnType<typeof tally>
            return (
              <div key={name as string} className="rounded-lg border px-3 py-2">
                <div className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">
                  {name as string}
                </div>
                <div className="mt-1 flex gap-3 font-mono text-xs">
                  <span className={MARK.does.cls}>✓ {tt.does}</span>
                  <span className={MARK.doesnt.cls}>✗ {tt.doesnt}</span>
                  <span className={MARK.unknown.cls}>? {tt.unknown}</span>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-3 text-sm">{verdict}</p>
      </div>

      <figcaption className="border-t px-4 py-2 text-xs text-muted-foreground">
        Motion&apos;s column comes from Anthropic&apos;s announcement, four help-centre pages and the
        launch film; nothing was tested hands-on. &quot;Not documented&quot; means no source says either
        way. Our column comes from this repository.
      </figcaption>
    </figure>
  )
}
