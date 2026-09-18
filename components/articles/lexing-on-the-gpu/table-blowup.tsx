import { mlog10 } from "@/lib/dmath"

// What a lexical grammar costs Pareas's parallel lexer, measured.
//
// The parallel DFA in src/compiler/lexer/lexer.fut does not store transition
// functions. It stores an *identifier* per function and composes two of them
// with one lookup into a k x k merge table, where k is the number of distinct
// unary transition functions reachable by composition of the grammar's DFA.
// k is a property of the grammar alone, so it can be measured without a GPU:
// build pareas-lpg and run it with --verbose-lexer.
//
// Every k below is that tool's own printed output on the shipped grammars and
// on six variants I edited. Bytes are k^2 * 2, because lexer.fut declares
// `merge_table: [n][n]state` with `module state = u16`.
//
// Server-rendered, zero JS. mlog10 for the bar geometry (Math.log10 is only an
// "implementation-dependent approximation" and would differ by an ULP between
// the Node render and the browser render, which React reports as a hydration
// mismatch).

type Row = {
  label: string
  detail: string
  k: number | null
  kLabel: string
  bytes: number
  bytesLabel: string
  tone: "shipped" | "cut" | "added" | "dead"
}

const ROWS: Row[] = [
  {
    label: "json.lex − string",
    detail: "the shipped JSON grammar with the string rule deleted",
    k: 642,
    kLabel: "642",
    bytes: 642 * 642 * 2,
    bytesLabel: "0.82 MB",
    tone: "cut",
  },
  {
    label: "pareas.lex − comment",
    detail: "the shipped language grammar with // comments deleted",
    k: 798,
    kLabel: "798",
    bytes: 798 * 798 * 2,
    bytesLabel: "1.3 MB",
    tone: "cut",
  },
  {
    label: "json.lex − number",
    detail: "the shipped JSON grammar with the number rule deleted",
    k: 1482,
    kLabel: "1,482",
    bytes: 1482 * 1482 * 2,
    bytesLabel: "4.4 MB",
    tone: "cut",
  },
  {
    label: "pareas.lex",
    detail: "shipped: 48 rules, // comments, no string literals",
    k: 1927,
    kLabel: "1,927",
    bytes: 1927 * 1927 * 2,
    bytesLabel: "7.4 MB",
    tone: "shipped",
  },
  {
    label: "json.lex",
    detail: "shipped: 12 rules, RFC 8259 strings and numbers",
    k: 4176,
    kLabel: "4,176",
    bytes: 4176 * 4176 * 2,
    bytesLabel: "34.9 MB",
    tone: "shipped",
  },
  {
    label: "json.lex, uppercase-hex fix",
    detail: "[0-9a-f] → [0-9a-fA-F] inside the \\uXXXX escape",
    k: 4249,
    kLabel: "4,249",
    bytes: 4249 * 4249 * 2,
    bytesLabel: "36.1 MB",
    tone: "added",
  },
  {
    label: "pareas.lex + string literal",
    detail: "one added rule: \"...\" with backslash escapes",
    k: 7952,
    kLabel: "7,952",
    bytes: 7952 * 7952 * 2,
    bytesLabel: "126.5 MB",
    tone: "added",
  },
  {
    label: "pareas.lex + block comment",
    detail: "one added rule: /* ... */ — generator dies with std::bad_alloc",
    k: null,
    kLabel: "> 38,000",
    bytes: 38000 * 38000 * 2,
    bytesLabel: "> 2.8 GB",
    tone: "dead",
  },
]

// GA102 (RTX 3090), the GPU the thesis measured on.
const MARKS = [
  { at: 100 * 1024, label: "100 KB · shared memory per SM" },
  { at: 6 * 1024 * 1024, label: "6 MB · L2" },
  { at: 24 * 1024 * 1024 * 1024, label: "24 GB · VRAM" },
]

const LO = mlog10(64 * 1024) // 64 KB
const HI = mlog10(32 * 1024 * 1024 * 1024) // 32 GB
const pct = (bytes: number) => ((mlog10(bytes) - LO) / (HI - LO)) * 100

const TONE: Record<Row["tone"], string> = {
  shipped: "oklch(0.55 0.16 250)",
  cut: "oklch(0.55 0.13 175)",
  added: "oklch(0.62 0.16 65)",
  dead: "oklch(0.58 0.19 27)",
}

export function TableBlowup() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          merge table size vs lexical grammar
        </span>
        <span className="font-mono text-[10px] text-muted-foreground/70">
          measured &middot; pareas-lpg --verbose-lexer &middot; log scale
        </span>
      </div>

      <div className="p-3 sm:p-5">
        <div className="relative mb-4 h-4 border-b border-dashed border-border">
          {MARKS.map((m) => {
            const at = pct(m.at)
            const right = at > 65
            return (
              <span
                key={m.label}
                className="absolute top-0 h-4 border-l border-dashed border-border"
                style={{ left: `${at.toFixed(3)}%` }}
              >
                <span
                  className={
                    "absolute -top-0.5 whitespace-nowrap font-mono text-[10px] text-muted-foreground/70 " +
                    (right ? "right-1" : "left-1")
                  }
                >
                  {m.label}
                </span>
              </span>
            )
          })}
        </div>

        <div className="space-y-3">
          {ROWS.map((r) => (
            <div key={r.label}>
              <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                <span className="font-mono text-[13px]">{r.label}</span>
                <span className="font-mono text-xs text-muted-foreground">
                  k = {r.kLabel} &middot;{" "}
                  <span className="text-foreground/80">{r.bytesLabel}</span>
                </span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(1, pct(r.bytes)).toFixed(3)}%`,
                    background: TONE[r.tone],
                    opacity: r.tone === "dead" ? 0.75 : 1,
                  }}
                />
              </div>
              <p className="mt-1 font-mono text-[11px] text-muted-foreground/80">
                {r.detail}
              </p>
            </div>
          ))}
        </div>
      </div>

      <figcaption className="border-t px-4 py-2.5 font-mono text-[11px] leading-5 text-muted-foreground">
        k is the number of distinct unary transition functions reachable by composition;
        the table is k&sup2; entries of <code>u16</code>. Nothing here needs a GPU &mdash;
        k falls out of the grammar, and <code>pareas-lpg --verbose-lexer</code> prints it.
        The last bar is a floor: the stock generator aborts on that grammar, and a patched
        build that counts states without allocating the square table was still past 38,000
        and climbing when I stopped it.
      </figcaption>
    </figure>
  )
}
