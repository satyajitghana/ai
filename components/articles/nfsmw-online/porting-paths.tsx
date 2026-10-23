"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// Four ways to put a 2005 Windows game in a browser tab, and how each piece of
// public evidence about NFSMW Online sits with each one. "fits" means the
// evidence is what that path would produce; "strains" means the path would have
// to be stretched to explain it; "neutral" means it does not tell the paths
// apart. Every cell is the article's reasoning, written out in `why`; nothing
// here is a measurement of the game's code, which is behind the login.

type Path = "source" | "decomp" | "emulate" | "rewrite"
type Cell = "fits" | "strains" | "neutral"

const PATHS: { k: Path; name: string; sub: string; example: string }[] = [
  { k: "source", name: "Original source", sub: "recompile the studio's code", example: "GTA V on playgta5.com" },
  { k: "decomp", name: "Decompiled source", sub: "rebuild code from the binary", example: "reVC in the browser" },
  { k: "emulate", name: "Shipped binary", sub: "run the .exe, translate x86 and D3D9", example: "Windows-in-wasm runners" },
  { k: "rewrite", name: "New engine", sub: "read the original data", example: "OpenMW for Morrowind" },
]

type Ev = {
  id: string
  text: string
  label: "measured" | "reported" | "reasoned"
  cells: Record<Path, Cell>
  why: string
}

const EVIDENCE: Ev[] = [
  {
    id: "gpu",
    text: "Needs WebGPU; runs out of graphics memory on the player's machine",
    label: "measured",
    cells: { source: "neutral", decomp: "neutral", emulate: "neutral", rewrite: "neutral" },
    why: "The log-in page checks navigator.gpu, and the notes talk about the player's GPU memory and drivers. That rules out cloud streaming, but every one of the four paths renders on the player's GPU, so it does not choose between them.",
  },
  {
    id: "original",
    text: "Original behaviours restored one at a time: police routing, milestones, the 130 km/h speeding line, the pursuit camera, the drag HUD",
    label: "reported",
    cells: { source: "strains", decomp: "fits", emulate: "strains", rewrite: "fits" },
    why: "If the shipped game logic were running, the police would already drive the road map lane by lane and milestones would already count the original way. Fixes worded 'like the original game' mean that logic was missing or replaced and is being put back. That is what a rewrite does, and what a partial decompilation with gaps filled by new code does.",
  },
  {
    id: "carbon",
    text: "Carbon's canyons, Carbon's 661 vinyls and Carbon's cliff-crash camera inside Most Wanted",
    label: "reported",
    cells: { source: "fits", decomp: "fits", emulate: "strains", rewrite: "fits" },
    why: "Most Wanted and Carbon come from the same studio and share file formats closely enough that one plugin SDK covers both. Owning the loader makes moving Carbon's content across a data job. Doing it to an unmodified binary under emulation means patching machine code at a scale nobody would choose.",
  },
  {
    id: "features",
    text: "Cockpit with hands and head motion, working mirrors, a new sky, horns other players hear, a livery editor",
    label: "reported",
    cells: { source: "fits", decomp: "fits", emulate: "strains", rewrite: "fits" },
    why: "Each one is a change inside the renderer, the camera or the vehicle code. Modders have added features to the PC game through injected DLLs for years, so it is not impossible on a binary, but at this pace, three days of notes, it points to code the team can edit and rebuild.",
  },
  {
    id: "phones",
    text: "An Android app, iPhone always in lite mode, about 200 MB trimmed from the phone build",
    label: "reported",
    cells: { source: "fits", decomp: "fits", emulate: "strains", rewrite: "fits" },
    why: "Translating 32-bit x86 to wasm or ARM on the fly costs a large factor in speed and memory; a phone browser has neither to spare. A build compiled for the target, from any kind of source, starts from native speed.",
  },
  {
    id: "public",
    text: "The public decompilation matches 13.94% of the PC code",
    label: "measured",
    cells: { source: "neutral", decomp: "strains", emulate: "neutral", rewrite: "neutral" },
    why: "decomp.dev reports 7,012 of 54,366 functions matched for the PC build. A matching decompilation that far from done cannot run the game by itself. A private, non-matching one could exist; nothing public says either way, and nothing public links the two projects.",
  },
  {
    id: "leak",
    text: "No public report of Most Wanted's own source leaking",
    label: "reasoned",
    cells: { source: "strains", decomp: "neutral", emulate: "neutral", rewrite: "neutral" },
    why: "The GTA V port was possible because RAGE's source leaked. I found no report of Most Wanted's source getting out. Absence of a report is weak evidence, so this cell strains rather than rules out.",
  },
]

const CELL_STYLE: Record<Cell, string> = {
  fits: "bg-[oklch(0.72_0.14_150/0.25)] text-foreground",
  strains: "bg-[oklch(0.68_0.16_30/0.22)] text-foreground",
  neutral: "text-muted-foreground",
}

export function PortingPaths() {
  const [on, setOn] = useState<Record<string, boolean>>(() => Object.fromEntries(EVIDENCE.map((e) => [e.id, true])))
  const [sel, setSel] = useState<string>("original")
  const strains = (p: Path) => EVIDENCE.filter((e) => on[e.id] && e.cells[p] === "strains").length
  const fits = (p: Path) => EVIDENCE.filter((e) => on[e.id] && e.cells[p] === "fits").length
  const ev = EVIDENCE.find((e) => e.id === sel) ?? EVIDENCE[0]

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>four ways into a browser tab · public evidence only</span>
        <span className="hidden @min-[560px]:inline">tick evidence off to see what it carries</span>
      </div>

      <div className="overflow-x-auto px-2 pt-3">
        <table className="w-full min-w-[560px] border-separate border-spacing-1 text-xs">
          <thead>
            <tr>
              <th className="w-[38%] text-left font-mono font-normal text-muted-foreground">evidence</th>
              {PATHS.map((p) => (
                <th key={p.k} className="align-bottom font-normal">
                  <div className="text-sm font-semibold">{p.name}</div>
                  <div className="text-muted-foreground">{p.sub}</div>
                  <div className="mt-0.5 font-mono text-[10px] text-muted-foreground">e.g. {p.example}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EVIDENCE.map((e) => (
              <tr key={e.id} className={cn(!on[e.id] && "opacity-40")}>
                <td className={cn("rounded-md px-1.5 py-1 align-top", sel === e.id && "bg-muted")}>
                  <label className="flex cursor-pointer items-start gap-1.5">
                    <input
                      type="checkbox"
                      checked={on[e.id]}
                      onChange={() => setOn((o) => ({ ...o, [e.id]: !o[e.id] }))}
                      className="mt-0.5"
                      aria-label={`count: ${e.text}`}
                    />
                    <button type="button" onClick={() => setSel(e.id)} className="cursor-pointer text-left leading-snug">
                      {e.text}{" "}
                      <span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{e.label}</span>
                    </button>
                  </label>
                </td>
                {PATHS.map((p) => (
                  <td
                    key={p.k}
                    onClick={() => setSel(e.id)}
                    className={cn("cursor-pointer rounded-md text-center font-mono", CELL_STYLE[e.cells[p.k]])}
                  >
                    {e.cells[p.k]}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-1.5 py-1 text-right font-mono text-muted-foreground">fits / strains</td>
              {PATHS.map((p) => (
                <td key={p.k} className="py-1 text-center font-mono text-sm font-semibold tabular-nums">
                  {fits(p.k)} / {strains(p.k)}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed" aria-live="polite">
        <div className="font-mono text-xs text-muted-foreground">
          {ev.label} · {ev.text}
        </div>
        <p className="mt-1">{ev.why}</p>
      </figcaption>
    </figure>
  )
}
