"use client"

import { useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { mpow } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// What "long-context extraction" actually buys, counted.
//
// Three ways to run a schema over a document that does not fit:
//
//   single window   — encode the first max_len words, return what is in there,
//                     and never look at the rest. This is what GLiNER2 did
//                     unless you wrote the chunking yourself.
//   native window   — GLiNER2.5 trains to 4,096 words, so most contracts,
//                     reports and transcripts are one forward pass.
//   chunked         — the library splits into overlapping word chunks, runs
//                     each, remaps every span to a character offset in the
//                     original document, and merges duplicates from the
//                     overlaps under a policy you pick.
//
// The overlap is not decoration. A span that straddles a chunk boundary is
// fully inside no chunk, so with zero overlap it is missed by every pass — and
// the longer your entity types are, the more often that happens. Drag overlap
// to zero with the long clause types on and watch the recall drop.

const ACCENT = "oklch(0.60 0.15 255)"
const WARM = "oklch(0.68 0.13 85)"
const GOOD = "oklch(0.55 0.16 155)"
const BAD = "oklch(0.58 0.19 27)"

const MAX_LEN = 512 // the illustrative single-window ceiling
const NATIVE = 4096 // GLiNER2.5's trained sequence length, in words

// where the schema's entities actually sit, as a fraction of the document,
// with widths in words — the 40-word one is an indemnification clause
const MENTIONS = [
  { at: 0.02, w: 3 },
  { at: 0.11, w: 40 },
  { at: 0.19, w: 2 },
  { at: 0.28, w: 11 },
  { at: 0.37, w: 3 },
  { at: 0.45, w: 40 },
  { at: 0.52, w: 2 },
  { at: 0.61, w: 11 },
  { at: 0.69, w: 40 },
  { at: 0.77, w: 3 },
  { at: 0.86, w: 11 },
  { at: 0.95, w: 2 },
]

type Mode = "single" | "native" | "chunked"

export function ChunkCoverage() {
  const [mode, setMode] = useState<Mode>("single")
  const [logDoc, setLogDoc] = useState(14) // 2^14 = 16,384 words
  const [chunk, setChunk] = useState(1024)
  const [overlap, setOverlap] = useState(128)

  const docWords = mpow(2, logDoc)

  // the windows each mode actually encodes, as [startWord, endWord)
  let windows: [number, number][] = []
  if (mode === "single") {
    windows = [[0, Math.min(MAX_LEN, docWords)]]
  } else if (mode === "native") {
    windows = [[0, Math.min(NATIVE, docWords)]]
  } else {
    const stride = Math.max(1, chunk - overlap)
    for (let s = 0; s < docWords; s += stride) {
      windows.push([s, Math.min(s + chunk, docWords)])
      if (s + chunk >= docWords) break
    }
  }

  const spans = MENTIONS.map((m) => {
    const s = Math.round(m.at * docWords)
    return { ...m, s, e: Math.min(s + m.w, docWords) }
  })

  // a window recovers a span only if the whole span sits inside it
  const hitsPerSpan = spans.map((sp) => windows.filter((w) => sp.s >= w[0] && sp.e <= w[1]).length)
  const found = hitsPerSpan.filter((n) => n > 0).length
  const dupes = hitsPerSpan.reduce((a, n) => a + Math.max(0, n - 1), 0)
  const coveredWords = Math.min(
    docWords,
    windows.reduce((a, w, i) => a + (w[1] - w[0]) - (i > 0 ? Math.max(0, windows[i - 1][1] - w[0]) : 0), 0),
  )

  const W = 700
  const H = 128
  const X0 = 14
  const BW = W - 28
  const px = (word: number) => X0 + (word / docWords) * BW

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one schema, one {docWords.toLocaleString()}-word document
        </span>
        <span className="font-mono text-[10px]" style={{ color: found === spans.length ? GOOD : BAD }}>
          {found} / {spans.length} mentions recovered
        </span>
      </div>

      <div className="p-3 sm:p-4">
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["single", `single window (max_len ${MAX_LEN})`],
              ["native", `native window (${NATIVE.toLocaleString()})`],
              ["chunked", "chunked with overlap"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => setMode(k)}
              aria-pressed={mode === k}
              className={cn(
                "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10px] transition-colors",
                mode === k
                  ? "border-foreground/30 bg-muted/50 text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="mt-2 overflow-x-auto">
          <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" className="min-w-[660px] max-w-full">
            <title>
              {`A bar representing a ${docWords.toLocaleString()}-word document with twelve entity mentions marked along it, and above it the windows this mode actually encodes. ${found} of the twelve mentions fall entirely inside some window.`}
            </title>

            {/* windows */}
            <text x={X0} y={12} fontSize={8} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              encoded {mode === "chunked" ? `in ${windows.length} forward pass${windows.length > 1 ? "es" : ""}` : "in one forward pass"}
            </text>
            {windows.slice(0, 200).map((w, i) => (
              <rect
                key={`${w[0]}-${w[1]}`}
                x={px(w[0])}
                y={20 + (i % 2) * 9}
                width={Math.max(1, px(w[1]) - px(w[0]))}
                height={7}
                rx={2}
                fill={ACCENT}
                fillOpacity={0.55}
                stroke={ACCENT}
                strokeOpacity={0.35}
                strokeWidth={0.5}
              />
            ))}

            {/* the document */}
            <rect x={X0} y={46} width={BW} height={26} rx={4} fill="currentColor" fillOpacity={0.06} />
            {windows.length ? (
              <rect
                x={px(0)}
                y={46}
                width={Math.max(1, px(coveredWords) - px(0))}
                height={26}
                rx={4}
                fill={ACCENT}
                fillOpacity={0.1}
              />
            ) : null}

            {/* the mentions */}
            {spans.map((sp, i) => {
              const n = hitsPerSpan[i]
              const colour = n === 0 ? BAD : n > 1 ? WARM : GOOD
              const w = Math.max(2.5, px(sp.e) - px(sp.s))
              return (
                <g key={sp.at}>
                  <rect x={px(sp.s)} y={49} width={w} height={20} rx={2} fill={colour} fillOpacity={n === 0 ? 0.3 : 0.8} />
                  {n === 0 ? (
                    <line x1={px(sp.s)} y1={49} x2={px(sp.s) + w} y2={69} stroke={BAD} strokeOpacity={0.9} strokeWidth={1} />
                  ) : null}
                </g>
              )
            })}

            <text x={X0} y={86} fontSize={8} fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              0
            </text>
            <text x={X0 + BW} y={86} fontSize={8} textAnchor="end" fill="currentColor" fillOpacity={0.45} fontFamily="ui-monospace, monospace">
              {docWords.toLocaleString()} words
            </text>

            {/* legend */}
            {(
              [
                ["found once", GOOD, 0],
                ["found in two chunks, merged", WARM, 118],
                ["never encoded", BAD, 320],
              ] as const
            ).map(([label, colour, dx]) => (
              <g key={label}>
                <rect x={X0 + dx} y={100} width={8} height={8} rx={1.5} fill={colour} fillOpacity={0.8} />
                <text x={X0 + dx + 12} y={107} fontSize={8} fill="currentColor" fillOpacity={0.55} fontFamily="ui-monospace, monospace">
                  {label}
                </text>
              </g>
            ))}
          </svg>
        </div>

        <div className="mt-2 grid gap-x-5 gap-y-2 sm:grid-cols-3">
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              document
            </span>
            <Range
              min={9}
              max={17}
              step={1}
              value={logDoc}
              onChange={(e) => setLogDoc(Number(e.target.value))}
              className="flex-1"
              aria-label="document length in words, as a power of two"
              accent={ACCENT}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {docWords >= 1000 ? `${Math.round(docWords / 1000)}k` : docWords}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              chunk
            </span>
            <Range
              min={256}
              max={4096}
              step={128}
              value={chunk}
              onChange={(e) => setChunk(Number(e.target.value))}
              disabled={mode !== "chunked"}
              className="flex-1"
              aria-label="chunk size in words"
              accent={GOOD}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {chunk}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-20 shrink-0 whitespace-nowrap font-mono text-[10px] text-muted-foreground">
              overlap
            </span>
            <Range
              min={0}
              max={512}
              step={16}
              value={overlap}
              onChange={(e) => setOverlap(Number(e.target.value))}
              disabled={mode !== "chunked"}
              className="flex-1"
              aria-label="how many words consecutive chunks share"
              accent={WARM}
            />
            <span className="w-12 shrink-0 text-right font-mono text-[10px] tabular-nums text-foreground">
              {overlap}
            </span>
          </div>
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {[
            { l: "forward passes", v: windows.length.toLocaleString(), c: ACCENT },
            { l: "document seen", v: `${((coveredWords / docWords) * 100).toFixed(0)}%`, c: ACCENT },
            { l: "mentions recovered", v: `${found} / ${spans.length}`, c: found === spans.length ? GOOD : BAD },
            { l: "duplicates merged", v: String(dupes), c: WARM },
          ].map((x) => (
            <div key={x.l} className="rounded-lg border bg-muted/20 px-3 py-2">
              <div className="font-mono text-[9px] uppercase tracking-wide text-muted-foreground">{x.l}</div>
              <div className="font-mono text-sm tabular-nums" style={{ color: x.c }}>
                {x.v}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-sm leading-6 text-muted-foreground">
          The single-window row is the honest picture of running a 512-token encoder at a contract:
          it does not perform badly on page forty, it{" "}
          <span style={{ color: BAD }}>never reads page forty</span>. Whatever recall number you
          quote is a recall number over the first two percent of the document.
          <br />
          <br />
          Chunking fixes coverage and introduces two new problems, which is why having it in the
          library matters more than it sounds. Every span now needs remapping from a chunk-local
          index back to a character offset in the original file, or you cannot verify it against the
          source or redact at it. And the overlap that stops boundary-straddling mentions from
          vanishing is the same overlap that returns them twice — drag overlap to zero with a
          40-word clause type in the schema and watch mentions disappear;{" "}
          <span className="text-foreground">
            raise it and watch the duplicate count climb instead
          </span>
          . Both of those were previously yours to write.
        </p>
      </div>
    </figure>
  )
}
