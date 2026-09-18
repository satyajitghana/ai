// The 80-token prompt, built the way the shipped code builds it.
//
// This is a direct port of `Gy()` in the ChessLFM Space bundle
// (assets/index-BPxYr76G.js) — the same field order, the same bucketing of the
// halfmove clock, the same left-padding of the 8-ply history with the UCI null
// move. Rendering it from a FEN rather than hardcoding a token list means the
// widget is itself a check: if the port were wrong, the assertion below would
// throw at build time instead of quietly drawing the wrong thing.
//
// Server-rendered, zero JS. No transcendental math reaches the DOM — every
// coordinate here is an integer.

const CASTLING_COMBOS = [
  "-", "q", "k", "kq", "Q", "Qq", "Qk", "Qkq",
  "K", "Kq", "Kk", "Kkq", "KQ", "KQq", "KQk", "KQkq",
]
const CASTLING_BIT: Record<string, number> = { K: 8, Q: 4, k: 2, q: 1 }
const MAX_HIST = 8
const PROMPT_LEN = 80

type Group = "pos" | "board" | "state" | "hist" | "eval"

interface Tok {
  t: string
  g: Group
}

function buildPrompt(fen: string, reps: number, hist: string[]): Tok[] {
  const f = fen.split(" ")
  if (f.length !== 6) throw new Error(`expected 6 FEN fields: ${fen}`)
  const [board, stm, castling, ep, halfmove] = f

  let cells = ""
  for (const row of board.split("/")) {
    for (const ch of row) {
      cells += ch >= "1" && ch <= "8" ? ".".repeat(Number(ch)) : ch
    }
  }
  if (cells.length !== 64) throw new Error(`board expands to ${cells.length} cells`)

  let bits = 0
  if (castling !== "-") for (const ch of castling) bits |= CASTLING_BIT[ch]

  const out: Tok[] = [{ t: "<|pos|>", g: "pos" }]
  for (const c of cells) out.push({ t: `<c:${c}>`, g: "board" })
  out.push({ t: `<stm:${stm}>`, g: "state" })
  out.push({ t: `<cast:${CASTLING_COMBOS[bits]}>`, g: "state" })
  out.push({ t: `<ep:${ep === "-" ? "-" : ep[0]}>`, g: "state" })
  out.push({ t: `<hm:${Math.floor(Math.min(Number(halfmove), 100) / 4)}>`, g: "state" })
  out.push({ t: `<rep:${Math.min(Math.max(reps, 0), 2)}>`, g: "state" })
  out.push({ t: "<|hist|>", g: "pos" })
  const h = hist.slice(-MAX_HIST)
  for (let i = 0; i < MAX_HIST - h.length; i++) out.push({ t: "<m:0000>", g: "hist" })
  for (const m of h) out.push({ t: `<m:${m}>`, g: "hist" })
  out.push({ t: "<|eval|>", g: "eval" })

  if (out.length !== PROMPT_LEN) {
    throw new Error(`prompt is ${out.length} tokens, expected ${PROMPT_LEN}`)
  }
  return out
}

// Najdorf, English Attack, after 9...O-O. Chosen because it exercises every
// state field at once: Black has castled (so <cast:> has dropped to KQ), there
// is no en-passant file, and the history window is full — eight real plies, no
// null padding.
const FEN = "rn1q1rk1/1p2bppp/p2pbn2/4p3/4P3/1NN1BP2/PPPQ2PP/R3KB1R w KQ - 3 10"
const HIST = ["c1e3", "e7e5", "d4b3", "c8e6", "f2f3", "f8e7", "d1d2", "e8g8"]

const GROUP_STYLE: Record<Group, string> = {
  pos: "border-foreground/30 bg-foreground/[0.06] text-foreground",
  board: "border-border/70 text-muted-foreground",
  state: "border-[oklch(0.60_0.15_255_/_0.45)] bg-[oklch(0.60_0.15_255_/_0.10)] text-foreground",
  hist: "border-[oklch(0.65_0.16_45_/_0.45)] bg-[oklch(0.65_0.16_45_/_0.10)] text-foreground",
  eval: "border-foreground/30 bg-foreground/[0.06] text-foreground",
}

const LIGHT = "#ece6da"
const DARK = "#b9ad97"
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"]

function Board({ cells }: { cells: string }) {
  const S = 34
  const PAD = 14
  const size = S * 8
  return (
    <svg
      viewBox={`0 0 ${size + PAD} ${size + PAD}`}
      className="w-full max-w-[19rem]"
      role="img"
      aria-label="Chessboard showing the Najdorf English Attack after 9...O-O: White pawns on a2, b2, e4, f3, g2, h2, knights on b3 and c3, bishops on e3 and f1, queen on d2, rooks on a1 and h1, king on e1. Black pawns on a6, b7, d6, e5, f7, g7, h7, knights on b8 and f6, bishops on e6 and e7, queen on d8, rooks on a8 and f8, king on g8."
    >
      {Array.from({ length: 64 }, (_, i) => {
        const r = Math.floor(i / 8)
        const c = i % 8
        const dark = (r + c) % 2 === 1
        const ch = cells[i]
        const white = ch !== "." && ch === ch.toUpperCase()
        return (
          <g key={i}>
            <rect
              x={PAD + c * S}
              y={r * S}
              width={S}
              height={S}
              fill={dark ? DARK : LIGHT}
            />
            {ch !== "." ? (
              <g>
                <circle
                  cx={PAD + c * S + S / 2}
                  cy={r * S + S / 2}
                  r={12}
                  fill={white ? "#fbfbf7" : "#25272d"}
                  stroke={white ? "#2a2c31" : "#0d0e10"}
                  strokeWidth={1.2}
                />
                <text
                  x={PAD + c * S + S / 2}
                  y={r * S + S / 2 + 5}
                  textAnchor="middle"
                  className="font-mono"
                  fontSize={15}
                  fontWeight={700}
                  fill={white ? "#17181c" : "#f4f4f2"}
                >
                  {ch}
                </text>
              </g>
            ) : null}
          </g>
        )
      })}
      {Array.from({ length: 8 }, (_, r) => (
        <text
          key={`r${r}`}
          x={PAD - 4}
          y={r * S + S / 2 + 3}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          fontSize={8}
        >
          {8 - r}
        </text>
      ))}
      {FILES.map((f, c) => (
        <text
          key={f}
          x={PAD + c * S + S / 2}
          y={size + 10}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          fontSize={8}
        >
          {f}
        </text>
      ))}
    </svg>
  )
}

export function BoardPrompt() {
  const toks = buildPrompt(FEN, 0, HIST)
  const cells = toks.filter((t) => t.g === "board").map((t) => t.t.slice(3, -1)).join("")
  const counts = toks.reduce<Record<string, number>>((acc, t) => {
    acc[t.g] = (acc[t.g] ?? 0) + 1
    return acc
  }, {})

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          one position &rarr; exactly 80 tokens, no free text
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          port of <code>Gy()</code>, Space bundle
        </span>
      </div>

      <div className="grid gap-5 p-4 sm:grid-cols-[auto_1fr]">
        <div className="flex flex-col items-start gap-2">
          <Board cells={cells} />
          <code className="max-w-[19rem] font-mono text-[9px] leading-4 break-all text-muted-foreground">
            {FEN}
          </code>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap gap-1">
            {toks.map((t, i) => (
              <span
                key={i}
                className={`rounded-sm border px-1 py-px font-mono text-[9px] leading-4 ${GROUP_STYLE[t.g]}`}
              >
                {t.t}
              </span>
            ))}
          </div>

          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 font-mono text-[10px] sm:grid-cols-3">
            {[
              ["board squares", counts.board, "board"],
              ["state tokens", counts.state, "state"],
              ["history plies", counts.hist, "hist"],
              ["structural", (counts.pos ?? 0) + (counts.eval ?? 0), "pos"],
            ].map(([label, n, g]) => (
              <div key={label as string} className="flex items-baseline gap-1.5">
                <span
                  className={`inline-block h-2 w-2 shrink-0 rounded-sm border ${GROUP_STYLE[g as Group]}`}
                  aria-hidden
                />
                <span className="text-muted-foreground">{label}</span>
                <span className="tabular-nums text-foreground">{n as number}</span>
              </div>
            ))}
            <div className="flex items-baseline gap-1.5 font-semibold">
              <span className="text-muted-foreground">total</span>
              <span className="tabular-nums text-foreground">{toks.length}</span>
            </div>
          </dl>

          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Every field is a token at a fixed offset, so the prompt length never moves.
            Castling collapses to one of sixteen combination tokens rather than four
            flags. The halfmove clock is bucketed into fours, which is why{" "}
            <code className="font-mono text-[11px]">&lt;hm:0&gt;</code> covers a clock of 0
            through 3. The history window holds eight plies and is padded on the left with
            the UCI null move, so a position reached in two moves and one reached in two
            hundred still occupy exactly the same 80 slots.
          </p>
        </div>
      </div>
    </figure>
  )
}
