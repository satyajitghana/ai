"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What the itch.io build of the NFS: Most Wanted port transfers before the
// game's first file read, in the order it asks for it.
//
// Sizes are bytes on the wire (gzip where the server compressed), from my
// headless Chromium run on 23 October 2026 for phases 1-2, and from fetching
// each engine file directly with the same Accept-Encoding for phase 4. My run
// stopped at speed.exe: request interception aborted it, and its size is the
// CDN's Content-Length from a HEAD request. Nothing in phase 5 was fetched;
// its numbers come from the served assets.json and the fetch backend's code.

type Row = {
  file: string
  bytes: number
  what: string
  how: "run" | "direct" | "head" | "code"
}

type Phase = { id: string; title: string; note: string; rows: Row[] }

const PHASES: Phase[] = [
  {
    id: "page",
    title: "1 · the launch page",
    note: "html.itch.zone, inside itch's iframe; served with COOP same-origin and COEP require-corp",
    rows: [
      { file: "index.html", bytes: 2175, what: "launch page: Start game, resolution, GPU check", how: "run" },
      { file: "ui/player.css", bytes: 2643, what: "styles", how: "run" },
      { file: "ui/RobotoCondensed.ttf", bytes: 220836, what: "font", how: "run" },
      { file: "htmlgame.js (itch)", bytes: 353, what: "itch's embed helper", how: "run" },
      { file: "ui/player.mjs", bytes: 2743, what: "session lock, full screen, runtime iframe", how: "run" },
      { file: "ui/gpu.mjs", bytes: 920, what: "WebGPU adapter probe", how: "run" },
      { file: "ui/nfsmw-poster.jpg", bytes: 725804, what: "EA's box art", how: "run" },
    ],
  },
  {
    id: "setup",
    title: "2 · Start game: check and plan",
    note: "a second iframe, nfsmw/runtime.html, and a worker that owns the OPFS folder",
    rows: [
      { file: "nfsmw/runtime.html", bytes: 6969, what: "runtime page: checks isolation and WebGPU", how: "run" },
      { file: "games.json", bytes: 564, what: "one game: speed.exe, its SHA-256, the CDN base", how: "run" },
      { file: "nfsmw/input-hints.js", bytes: 1444, what: "on-screen key hints", how: "run" },
      { file: "worker.js", bytes: 3442, what: "OPFS import and save worker", how: "direct" },
      { file: "core.js", bytes: 6377, what: "import rules shared with the native launcher", how: "run" },
      { file: "nfsmw/assets.json", bytes: 18022, what: "1,398 file names, sizes and URLs", how: "run" },
    ],
  },
  {
    id: "exe",
    title: "3 · the one file copied whole",
    note: "cdn.justplayweb.com; I aborted it and took the size from a HEAD request",
    rows: [{ file: "speed.exe", bytes: 6029312, what: "EA's PC 1.3 executable, written to OPFS", how: "head" }],
  },
  {
    id: "engine",
    title: "4 · the engine",
    note: "html.itch.zone again; not reached in my run, sizes from fetching each file",
    rows: [
      { file: "ui/launch-settings.mjs", bytes: 1000, what: "resolution into the mod settings", how: "direct" },
      { file: "nfsmw/profile-settings.js", bytes: 737, what: "saved controls and graphics", how: "direct" },
      { file: "nfsmw/SpeedRecomp.js", bytes: 62366, what: "Emscripten glue and the range-request backend", how: "direct" },
      { file: "nfsmw/SpeedRecomp.wasm", bytes: 16086019, what: "the recompiled game and its Windows", how: "direct" },
      { file: "nfsmw/SpeedRecomp.data", bytes: 499085, what: "symbols.json and two mod files", how: "direct" },
      { file: "nfsmw/audio-worklet.js", bytes: 973, what: "plays the mixer's ring buffer", how: "direct" },
    ],
  },
  {
    id: "data",
    title: "5 · game files, on demand",
    note: "Range requests in 8 MiB blocks, kept in Cache Storage; not fetched by me",
    rows: [
      { file: "first 8 MiB block of a file", bytes: 8388608, what: "the unit of every game-file read", how: "code" },
      { file: "all 1,397 other files", bytes: 2966874921, what: "what the CDN holds besides speed.exe", how: "code" },
    ],
  },
]

const HOW: Record<Row["how"], string> = {
  run: "seen in my run",
  direct: "fetched directly",
  head: "HEAD only",
  code: "from the code",
}

function fmt(n: number): string {
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)} GB`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)} MB`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)} KB`
  return `${n} B`
}

const LOG_MIN = 2 // 100 B
const LOG_MAX = 10 // 10 GB

export function LoadWaterfall() {
  const [log, setLog] = useState(true)
  const [open, setOpen] = useState<string>("engine")

  const maxLinear = 16086019 // the wasm: the largest row before game data
  const width = (b: number) => {
    if (log) return Math.max(1, Math.min(100, ((mlog10(b) - LOG_MIN) / (LOG_MAX - LOG_MIN)) * 100))
    return Math.max(0.5, Math.min(100, (b / maxLinear) * 100))
  }

  const before = PHASES.filter((p) => p.id !== "data").reduce((s, p) => s + p.rows.reduce((t, r) => t + r.bytes, 0), 0)

  return (
    <figure className="@container my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        <span>bytes on the wire, in request order · 23 Oct 2026</span>
        <span className="flex gap-1">
          {[
            [true, "log scale"],
            [false, "linear"],
          ].map(([v, l]) => (
            <button
              key={String(l)}
              type="button"
              onClick={() => setLog(v as boolean)}
              className={cn("rounded px-2 py-0.5", log === v ? "bg-foreground text-background" : "hover:bg-muted")}
            >
              {l as string}
            </button>
          ))}
        </span>
      </div>

      <div className="space-y-1 px-3 py-3">
        {PHASES.map((p) => {
          const total = p.rows.reduce((s, r) => s + r.bytes, 0)
          const isOpen = open === p.id
          return (
            <div key={p.id} className="rounded-lg border bg-background/40">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? "" : p.id)}
                className="flex w-full flex-wrap items-baseline justify-between gap-x-3 px-3 py-2 text-left"
                aria-expanded={isOpen}
              >
                <span className="text-sm font-semibold">{p.title}</span>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {p.id === "data" ? "up to " : ""}
                  {fmt(p.id === "data" ? p.rows[1].bytes + 6029312 : total)}
                </span>
              </button>
              {isOpen && (
                <div className="border-t px-3 pb-3 pt-2">
                  <p className="mb-2 font-mono text-[11px] text-muted-foreground">{p.note}</p>
                  <ul className="space-y-1.5">
                    {p.rows.map((r) => (
                      <li key={r.file} className="grid grid-cols-1 gap-x-3 @min-[560px]:grid-cols-[13rem_1fr_6rem]">
                        <span className="truncate font-mono text-xs" title={r.file}>
                          {r.file}
                        </span>
                        <span className="relative h-4 self-center rounded bg-muted/50">
                          <span
                            className={cn(
                              "absolute inset-y-0 left-0 rounded",
                              r.how === "code" ? "bg-[oklch(0.7_0.12_250/0.35)]" : r.how === "head" ? "bg-[oklch(0.7_0.15_60/0.6)]" : "bg-[oklch(0.65_0.14_150/0.7)]",
                            )}
                            style={{ width: `${width(r.bytes).toFixed(2)}%` }}
                          />
                        </span>
                        <span className="font-mono text-xs tabular-nums @min-[560px]:text-right">{fmt(r.bytes)}</span>
                        <span className="col-span-full text-[11px] text-muted-foreground">
                          {r.what} · <span className="font-mono">{HOW[r.how]}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-3 text-sm leading-relaxed">
        Phases 1 to 4 add up to <span className="font-mono tabular-nums">{fmt(before)}</span> before the game reads its first
        data file, and about 70% of that is the engine. The game itself is the last row: 2.97 GB that the tab reads in 8
        MiB slices, only where the game asks. Green rows I saw or fetched, amber I sized with HEAD, blue come from the
        code and the manifest.
      </figcaption>
    </figure>
  )
}
