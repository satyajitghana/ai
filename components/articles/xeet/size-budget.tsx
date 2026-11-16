"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// What xeet's web build downloads, measured on 16 November 2026 from the live
// deployment (https://xeet-rs.vercel.app/wasm/53630eb97499607a/):
//  - xeet_wasm_bg.wasm fetched three times with Accept-Encoding identity, gzip
//    and br; the section sizes come from walking the module's section headers.
//  - The font bytes inside the data section were found by searching the module
//    for the first and last 4 KiB of every vendored font file in the repo
//    (rauchg/xeet at 71079ff1): the 28 Chirp .ttf subsets and Arial regular and
//    bold are in it, nothing else.
//  - Each pack's raw size is its `bytes` in fonts/packs.json (and the length
//    downloaded); the br size is the length served with Accept-Encoding: br.

type Part = { key: string; label: string; raw: number; br: number | null; tone: string; note: string }

const WASM_RAW = 6_455_325
const WASM_BR = 2_720_342

const CORE: Part[] = [
  { key: "code", label: "code section", raw: 2_951_775, br: null, tone: "bg-sky-600/80", note: "3,663 functions: shaping (harfrust), ICU segmentation, bidi, flexbox frame, the rasterizer, PNG encoder, twitter-text rules." },
  { key: "fonts", label: "Chirp + Arial", raw: 2_072_800, br: null, tone: "bg-amber-500/80", note: "28 Chirp subsets (4 weights × 7 Unicode ranges, 551,160 bytes) plus Arial regular and bold (1,521,640 bytes), embedded with include_bytes!." },
  { key: "data", label: "other data", raw: 935_785, br: null, tone: "bg-amber-300/80", note: "The rest of the data section: icons, design tokens, X's ruleset, Unicode and ICU tables." },
  { key: "names", label: "name section", raw: 484_169, br: null, tone: "bg-zinc-400", note: "Function names for debugging. A renderer does not need them; stripping would save this much raw." },
  { key: "rest", label: "types, imports, exports", raw: 10_796, br: null, tone: "bg-zinc-300", note: "Module bookkeeping." },
]

const PACKS: Part[] = [
  { key: "emoji", label: "emoji", raw: 20_930_352, br: 20_006_162, tone: "bg-rose-500/80", note: "AppleColorEmoji.ttf: PNG bitmaps in an sbix table, which is why brotli barely touches it." },
  { key: "cjk", label: "cjk", raw: 14_733_752, br: 11_583_879, tone: "bg-violet-500/80", note: "Hiragino Sans regular and bold (.otf)." },
  { key: "math", label: "math", raw: 2_313_024, br: 1_391_757, tone: "bg-teal-500/80", note: "STIX Two Math, Noto Sans Math, Noto Sans Symbols and Symbols 2." },
  { key: "latin", label: "latin", raw: 863_740, br: 390_786, tone: "bg-lime-500/80", note: "Noto Sans regular and bold, for Latin characters Chirp lacks." },
  { key: "arabic", label: "arabic", raw: 283_992, br: 115_088, tone: "bg-emerald-500/80", note: "Noto Sans Arabic regular and bold." },
  { key: "hebrew", label: "hebrew", raw: 33_736, br: 14_546, tone: "bg-green-400/80", note: "Noto Sans Hebrew regular and bold." },
]

const POSTS: { key: string; label: string; packs: string[] }[] = [
  { key: "latin", label: "English text only", packs: [] },
  { key: "emoji", label: "English with one emoji", packs: ["emoji"] },
  { key: "ja", label: "Japanese", packs: ["cjk"] },
  { key: "ja-emoji", label: "Japanese with emoji", packs: ["cjk", "emoji"] },
  { key: "all", label: "Everything (the playground preloads all six)", packs: PACKS.map((p) => p.key) },
]

const mb = (n: number) => (n / 1e6).toFixed(2) + " MB"
const fmt = (n: number) => n.toLocaleString("en-US")

export function SizeBudget() {
  const [wire, setWire] = useState(false)
  const [post, setPost] = useState("emoji")
  const [hover, setHover] = useState<string | null>("fonts")

  const need = POSTS.find((p) => p.key === post)!.packs
  const packBytes = (p: Part) => (wire ? (p.br ?? p.raw) : p.raw)
  const coreBytes = wire ? WASM_BR : WASM_RAW
  const total = coreBytes + PACKS.filter((p) => need.includes(p.key)).reduce((s, p) => s + packBytes(p), 0)
  const max = (wire ? WASM_BR : WASM_RAW) + PACKS.reduce((s, p) => s + packBytes(p), 0)
  const all = [...CORE, ...PACKS]
  const shown = all.find((p) => p.key === hover)

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4 text-sm sm:p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <div className="font-medium">What a post costs to download before xeet can draw it</div>
        <div className="flex gap-1 font-mono text-xs">
          {[
            [false, "uncompressed"],
            [true, "over the wire (br)"],
          ].map(([v, l]) => (
            <button
              key={String(v)}
              type="button"
              onClick={() => setWire(v as boolean)}
              className={cn("rounded border px-2 py-0.5", wire === v ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}
            >
              {l as string}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-1 font-mono text-xs text-muted-foreground">
        the wasm module, {mb(coreBytes)} {wire ? "brotli" : "raw"}
        {wire && " (sections are listed uncompressed: the module is compressed as one file)"}
      </div>
      <div className="flex h-7 w-full overflow-hidden rounded" style={{ width: `${(coreBytes / max) * 100}%`, minWidth: "4rem" }}>
        {CORE.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-label={`${p.label}: ${fmt(p.raw)} bytes`}
            onMouseEnter={() => setHover(p.key)}
            onFocus={() => setHover(p.key)}
            onClick={() => setHover(p.key)}
            className={cn(p.tone, "h-full border-r border-background/60", hover === p.key && "ring-2 ring-foreground ring-inset")}
            style={{ width: `${(p.raw / WASM_RAW) * 100}%` }}
          />
        ))}
      </div>

      <div className="mb-1 mt-4 font-mono text-xs text-muted-foreground">font packs, fetched separately and checked against SHA-256</div>
      <div className="flex h-7 w-full overflow-hidden rounded">
        {PACKS.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-label={`${p.label} pack: ${fmt(packBytes(p))} bytes`}
            onMouseEnter={() => setHover(p.key)}
            onFocus={() => setHover(p.key)}
            onClick={() => setHover(p.key)}
            className={cn(
              p.tone,
              "h-full border-r border-background/60 transition-opacity",
              !need.includes(p.key) && "opacity-25",
              hover === p.key && "ring-2 ring-foreground ring-inset",
            )}
            style={{ width: `${(packBytes(p) / max) * 100}%` }}
          />
        ))}
      </div>

      {shown && (
        <div className="mt-3 rounded-md border border-border bg-background p-3 text-xs">
          <div className="font-mono">
            {shown.label}: {fmt(shown.raw)} bytes raw
            {shown.br !== null && <>, {fmt(shown.br)} br</>}
          </div>
          <div className="mt-1 text-muted-foreground">{shown.note}</div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-1.5">
        {POSTS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPost(p.key)}
            className={cn("rounded-full border px-2.5 py-0.5 text-xs", post === p.key ? "border-primary bg-primary/10" : "border-border text-muted-foreground")}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="mt-3 font-mono text-sm">
        {need.length ? `wasm + ${need.join(" + ")}` : "wasm alone"} = <span className="font-semibold">{mb(total)}</span>
      </div>

      <figcaption className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
        Bytes measured from the live deployment on 16 November 2026; the font split inside the module was found by
        matching the repository&apos;s font files against it. A post in Latin script needs only the module. One emoji pulls
        in the 20.9 MB Apple emoji font, which brotli shrinks by 4%.
      </figcaption>
    </figure>
  )
}
