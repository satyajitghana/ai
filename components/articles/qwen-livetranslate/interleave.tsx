// What "Interleave" means, as far as it is actually disclosed.
//
// The cascade lane on top is the thing being replaced: three models in series,
// each of which cannot start until the one before it has committed a unit, and
// each of which therefore owns a buffer and a latency budget. The interleave
// lane below is one causal sequence in which the reads (audio, video) and the
// writes (source text, translation) are laid down in temporal order, so a
// translation token can be written between two audio tokens rather than after
// a module boundary.
//
// What is NOT drawn, because Qwen did not publish it: how many audio frames sit
// between writes, what decides when to write, the chunk size, the policy. The
// ribbon below is the shape of the claim, not a trace.
//
// Server-rendered SVG, zero JS. Integer arithmetic only.

type Tok = "A" | "V" | "S" | "T"

// One schematic sequence: audio and video are read, source text and translation
// are written, all in one stream, in time order.
const SEQ: Tok[] = [
  "A", "A", "V", "A", "S", "A", "A", "S", "A", "T",
  "A", "A", "S", "V", "A", "T", "A", "S", "A", "T",
  "A", "A", "S", "A", "T", "A", "V", "A", "S", "T",
]

const TOK_LABEL: Record<Tok, string> = {
  A: "source audio",
  V: "video frame",
  S: "source text",
  T: "translation",
}

// Read tokens are outlined, written tokens are filled — the whole point is that
// both live in one sequence.
const isWrite = (t: Tok) => t === "S" || t === "T"

export function Interleave() {
  const W = 800
  const H = 330
  const padL = 116
  const padR = 20
  const lane = W - padL - padR

  const tw = lane / SEQ.length // token cell width
  const tokW = tw - 2

  // ---- cascade geometry: three stages, each waiting on the one before ----
  const casY = 62
  const casH = 22
  // each stage's blocks, as [start, width] in fractions of the lane
  const stages: { name: string; blocks: [number, number][]; note: string }[] = [
    { name: "ASR", blocks: [[0.08, 0.16], [0.34, 0.16], [0.62, 0.16]], note: "waits for a stable transcript unit" },
    { name: "MT", blocks: [[0.26, 0.12], [0.52, 0.12], [0.80, 0.12]], note: "waits for the transcript" },
    { name: "TTS", blocks: [[0.40, 0.14], [0.66, 0.14]], note: "waits for the translation" },
  ]

  const intY = 224

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        three sequences with boundaries between them, versus one sequence with the boundaries inside it
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[700px]"
        role="img"
        aria-label="Two lanes drawn against the same left-to-right time axis. The top lane is a classical cascade: three rows labelled ASR, MT and TTS, whose blocks are staggered because each stage can only begin once the stage before it has committed a unit, leaving visible dead time between them and three hand-off boundaries. The bottom lane is the interleaved sequence: a single strip of thirty tokens in temporal order, mixing outlined read tokens for source audio and video frames with filled write tokens for source text and translation, so a translation token can be written between two audio tokens with no module boundary to cross. A caption notes that the chunk size and the policy that decides when to write are not disclosed."
      >
        {/* =============== cascade =============== */}
        <text x={16} y={30} className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          cascade
        </text>
        <text x={80} y={30} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          — three models, three hand-offs, three buffers
        </text>

        {stages.map((st, si) => {
          const y = casY + si * (casH + 12)
          return (
            <g key={st.name}>
              <text
                x={padL - 10}
                y={y + 15}
                textAnchor="end"
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                {st.name}
              </text>
              <line
                x1={padL}
                y1={y + casH / 2}
                x2={W - padR}
                y2={y + casH / 2}
                className="stroke-border"
                strokeWidth={1}
                strokeDasharray="2 6"
              />
              {st.blocks.map(([s, w], bi) => (
                <rect
                  key={`${st.name}-${bi}`}
                  x={padL + s * lane}
                  y={y}
                  width={w * lane}
                  height={casH}
                  rx={3}
                  className="fill-muted stroke-muted-foreground"
                  strokeWidth={1}
                />
              ))}
            </g>
          )
        })}

        {/* hand-off arrows between the stages */}
        {(
          [
            [0.24, casY + casH, 0.26, casY + casH + 12],
            [0.38, casY + 2 * casH + 12, 0.4, casY + 2 * casH + 24],
          ] as [number, number, number, number][]
        ).map(([x1, y1, x2, y2], i) => (
          <path
            key={`ho-${i}`}
            d={`M ${padL + x1 * lane} ${y1} L ${padL + x2 * lane} ${y2}`}
            className="stroke-foreground/60"
            strokeWidth={1.5}
          />
        ))}
        <text
          x={W - padR}
          y={casY + 3 * (casH + 12) + 2}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          each gap is a stage waiting for the one before it to commit
        </text>

        {/* =============== interleave =============== */}
        <line x1={16} y1={178} x2={W - padR} y2={178} className="stroke-border" strokeWidth={1} />
        <text x={16} y={196} className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          interleave
        </text>
        <text x={92} y={196} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          — one causal sequence, reads and writes in temporal order
        </text>

        <text
          x={padL - 10}
          y={intY + 16}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          Thinker
        </text>

        {SEQ.map((t, i) => (
          <rect
            key={`${t}-${i}`}
            x={padL + i * tw}
            y={t === "V" ? intY + 4 : intY}
            width={tokW}
            height={t === "V" ? 16 : 24}
            rx={2}
            className={
              isWrite(t)
                ? t === "T"
                  ? "fill-foreground"
                  : "fill-foreground/40"
                : "fill-background stroke-muted-foreground"
            }
            strokeWidth={1}
          />
        ))}

        {/* time arrow under the ribbon */}
        <line
          x1={padL}
          y1={intY + 36}
          x2={W - padR}
          y2={intY + 36}
          className="stroke-border"
          strokeWidth={1}
        />
        <text x={padL} y={intY + 50} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          time →
        </text>
        <text
          x={W - padR}
          y={intY + 50}
          textAnchor="end"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          chunk size and the policy that decides when to write: not disclosed
        </text>

        {/* legend */}
        <g>
          {(["A", "V", "S", "T"] as Tok[]).map((t, i) => {
            const lx = padL + i * 168
            const ly = intY + 66
            return (
              <g key={`leg-${t}`}>
                <rect
                  x={lx}
                  y={ly}
                  width={12}
                  height={12}
                  rx={2}
                  className={
                    isWrite(t)
                      ? t === "T"
                        ? "fill-foreground"
                        : "fill-foreground/40"
                      : "fill-background stroke-muted-foreground"
                  }
                  strokeWidth={1}
                />
                <text
                  x={lx + 18}
                  y={ly + 10}
                  className="fill-muted-foreground font-mono"
                  style={{ fontSize: 10 }}
                >
                  {`${isWrite(t) ? "write" : "read"} · ${TOK_LABEL[t]}`}
                </text>
              </g>
            )
          })}
        </g>
      </svg>
      <div className="border-t px-3 py-2 font-mono text-xs text-muted-foreground">
        schematic — the shape of the claim, drawn from the release post&apos;s own description
      </div>
    </figure>
  )
}
