// What is actually in a decision model's checkpoint — four open reproductions,
// four different answers, every shape read out of the real safetensors header
// over an HTTP range request (8-byte little-endian length prefix, then the JSON
// header; no weights downloaded).
//
//   com-kotobalabs/open-jev-deberta-v3-large  head.safetensors, 4 tensors
//   heman10x/rlcd-modernbert-151m             model.safetensors, 143 tensors
//   DavidHatley/system-one-mini               model.safetensors, 120 tensors
//   Foodoo1/Qwen3-14B-RLCD-Decision-LoRA      adapter_config.json, modules_to_save: null
//
// The point of the figure is the right-hand column: the output space is a
// different object in each family, and that is the architecture question. It is
// not "how many parameters" — it is "what set does a probability get spread
// over, and who decides that set, and when".
//
// Server-rendered, zero JS.

const ACCENT = "oklch(0.72 0.15 195)"
const WARN = "oklch(0.68 0.16 40)"
const MUTED = "oklch(0.62 0.02 260)"

const W = 780
const LANE = 104
const TOP = 30
const N = 4
const H = TOP + LANE * N + 8

type Lane = {
  id: string
  family: string
  repo: string
  backbone: string
  head: string
  headSub: string
  answerSet: string
  newParams: string
}

const LANES: Lane[] = [
  {
    id: "lm",
    family: "vocabulary readout",
    repo: "Foodoo1/Qwen3-14B-RLCD-Decision-LoRA · TheoLeeCJ/openjev",
    backbone: "decoder + its own LM head",
    head: "no head at all",
    headSub: "adapter_config modules_to_save: null",
    answerSet: "one vocabulary row, sliced to the candidate tokens",
    newParams: "0 new output params",
  },
  {
    id: "scalar",
    family: "per-option scalar scorer",
    repo: "com-kotobalabs/open-jev-deberta-v3-large",
    backbone: "DeBERTa-v3-large · 24L · 1024",
    head: "Linear[1024,3072] → Linear[1,1024]",
    headSub: "head.safetensors · 4 tensors · 3,147,777",
    answerSet: "one scalar per option; softmax inside the question",
    newParams: "3.1M new params",
  },
  {
    id: "bi",
    family: "bi-encoder similarity",
    repo: "heman10x/rlcd-modernbert-151m",
    backbone: "ModernBERT-base · 22L · 768",
    head: "text/class projectors + logit_scale",
    headSub: "2 × (768→768→768) + scalar · 151,378,177",
    answerSet: "a dot product per option description",
    newParams: "no fixed width in the weights",
  },
  {
    id: "fixed",
    family: "fixed heads",
    repo: "DavidHatley/system-one-mini",
    backbone: "DistilBERT · 6L · 768",
    head: "5 × (Linear[768,768] → Linear[k,768])",
    headSub: "k = 2, 2, 5, 5, 2 — baked into the file",
    answerSet: "five fixed questions, fixed option sets, forever",
    newParams: "schema is in the weights",
  },
]

function OutputGlyph({ id, x, y }: { id: string; x: number; y: number }) {
  // Each family's output space, drawn as itself.
  if (id === "lm") {
    const cells = 26
    return (
      <g transform={`translate(${x} ${y})`}>
        {Array.from({ length: cells }, (_, i) => (
          <rect
            key={i}
            x={i * 5.2}
            y={-7}
            width={3.8}
            height={14}
            rx={1}
            fill={[4, 9, 17].includes(i) ? ACCENT : "var(--muted)"}
            opacity={[4, 9, 17].includes(i) ? 1 : 0.55}
          />
        ))}
        <text
          x={cells * 5.2 + 8}
          y={4}
          className="font-mono"
          fill={MUTED}
          fontSize={8.5}
        >
          151,936 wide
        </text>
      </g>
    )
  }
  if (id === "scalar") {
    const n = 6
    return (
      <g transform={`translate(${x} ${y})`}>
        {Array.from({ length: n }, (_, i) => (
          <g key={i}>
            <line
              x1={i * 15}
              y1={-9}
              x2={i * 15}
              y2={9}
              stroke={ACCENT}
              strokeWidth={1.5}
              strokeOpacity={0.8}
            />
            <circle cx={i * 15} cy={-9 + i * 2.6} r={2.6} fill={ACCENT} />
          </g>
        ))}
        <path
          d={`M ${-6} 14 L ${-6} 18 L ${(n - 1) * 15 + 6} 18 L ${(n - 1) * 15 + 6} 14`}
          fill="none"
          stroke={MUTED}
          strokeWidth={1.2}
        />
        <text
          x={(n - 1) * 15 + 16}
          y={4}
          className="font-mono"
          fill={MUTED}
          fontSize={8.5}
        >
          ≤ 255, chosen per request
        </text>
      </g>
    )
  }
  if (id === "bi") {
    return (
      <g transform={`translate(${x} ${y})`}>
        <rect x={0} y={-11} width={26} height={9} rx={2} fill={ACCENT} opacity={0.75} />
        <rect x={0} y={2} width={26} height={9} rx={2} fill={MUTED} opacity={0.5} />
        <path
          d="M 30 -6 C 42 -6, 42 0, 50 0"
          fill="none"
          stroke={MUTED}
          strokeWidth={1.3}
        />
        <path
          d="M 30 6 C 42 6, 42 0, 50 0"
          fill="none"
          stroke={MUTED}
          strokeWidth={1.3}
        />
        <circle cx={53} cy={0} r={4} fill="var(--background)" stroke={ACCENT} strokeWidth={1.5} />
        <text x={66} y={4} className="font-mono" fill={MUTED} fontSize={8.5}>
          state · option, one dot product each
        </text>
      </g>
    )
  }
  const ks = [2, 2, 5, 5, 2]
  let cx = 0
  return (
    <g transform={`translate(${x} ${y})`}>
      {ks.map((k, hi) => {
        const g = (
          <g key={hi} transform={`translate(${cx} 0)`}>
            {Array.from({ length: k }, (_, i) => (
              <rect
                key={i}
                x={i * 6}
                y={-7}
                width={4.4}
                height={14}
                rx={1}
                fill={WARN}
                opacity={0.7}
              />
            ))}
          </g>
        )
        cx += k * 6 + 10
        return g
      })}
      <text x={cx + 4} y={4} className="font-mono" fill={MUTED} fontSize={8.5}>
        frozen at training time
      </text>
    </g>
  )
}

export function HeadAnatomy() {
  const bx = 14
  const bw = 186
  const hx = 214
  const hw = 232
  const ox = 460

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        four open decision checkpoints, four output spaces — shapes read from the
        real safetensors headers
      </div>

      <div className="overflow-x-auto px-3 py-3">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full min-w-[680px]"
          role="img"
          aria-label="Four rows, one per open reproduction. Row one, vocabulary readout: a decoder with its ordinary language-model head and no new parameters, whose answer set is one row of the 151,936-wide vocabulary sliced to the candidate tokens. Row two, per-option scalar scorer: DeBERTa-v3-large plus a 3.1-million-parameter head that maps a 3072-wide vector to one scalar per option, softmaxed inside each question, up to 255 options chosen per request. Row three, bi-encoder similarity: ModernBERT-base with a text projector, a class projector and a single logit scale, where nothing in the weights has an option-count shape. Row four, fixed heads: DistilBERT with five classification heads of widths 2, 2, 5, 5 and 2 baked into the checkpoint, which can only ever answer those five questions."
        >
          <defs>
            <filter id="ha-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="ha-arrow"
              viewBox="0 -5 10 10"
              markerWidth="7"
              markerHeight="7"
              orient="auto"
              refX="7"
              refY="0"
            >
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUTED} strokeWidth={1.4} />
            </marker>
          </defs>

          <text x={bx} y={16} className="font-mono" fill={MUTED} fontSize={9}>
            backbone
          </text>
          <text x={hx} y={16} className="font-mono" fill={MUTED} fontSize={9}>
            what the checkpoint adds
          </text>
          <text x={ox} y={16} className="font-mono" fill={MUTED} fontSize={9}>
            the set a probability is spread over
          </text>

          {LANES.map((l, i) => {
            const cy = TOP + LANE * i + LANE / 2
            return (
              <g key={l.id}>
                {i > 0 ? (
                  <line
                    x1={bx}
                    y1={TOP + LANE * i}
                    x2={W - 14}
                    y2={TOP + LANE * i}
                    stroke="var(--border)"
                    strokeWidth={1}
                    strokeOpacity={0.7}
                  />
                ) : null}

                <text
                  x={bx}
                  y={cy - 24}
                  className="fill-foreground font-mono"
                  fontSize={11}
                  fontWeight={600}
                >
                  {l.family}
                </text>

                <rect
                  x={bx}
                  y={cy - 14}
                  width={bw}
                  height={28}
                  rx={7}
                  fill="var(--background)"
                  stroke="var(--border)"
                  strokeWidth={1.4}
                  filter="url(#ha-soft)"
                />
                <text
                  x={bx + 10}
                  y={cy + 4}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={9}
                >
                  {l.backbone}
                </text>

                <path
                  d={`M ${bx + bw + 3} ${cy} C ${bx + bw + 12} ${cy}, ${hx - 14} ${cy}, ${hx - 5} ${cy}`}
                  fill="none"
                  stroke={MUTED}
                  strokeWidth={1.4}
                  markerEnd="url(#ha-arrow)"
                />

                <rect
                  x={hx}
                  y={cy - 18}
                  width={hw}
                  height={36}
                  rx={7}
                  fill="var(--background)"
                  stroke={ACCENT}
                  strokeWidth={1.4}
                  filter="url(#ha-soft)"
                />
                <text
                  x={hx + 10}
                  y={cy - 3}
                  className="font-mono"
                  fill={ACCENT}
                  fontSize={9.5}
                >
                  {l.head}
                </text>
                <text
                  x={hx + 10}
                  y={cy + 11}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={8}
                >
                  {l.headSub}
                </text>

                <OutputGlyph id={l.id} x={ox} y={cy - 12} />
                <text
                  x={ox}
                  y={cy + 20}
                  className="fill-foreground"
                  fontSize={10}
                >
                  {l.answerSet}
                </text>
                <text
                  x={bx}
                  y={cy + 32}
                  className="font-mono"
                  fill={MUTED}
                  fontSize={8}
                >
                  {l.repo}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <figcaption className="border-t px-4 py-3 text-xs leading-5 text-muted-foreground">
        Nothing here is a redrawing of a published diagram — none of these four
        repositories ships one. Every shape is the tensor shape in the file: I read
        each safetensors header by range request and summed it. The row that
        matters for Jev is the second one, because TypeSafe&apos;s own documentation
        says a Score&apos;s levels are &ldquo;evaluated separately&rdquo; and that
        high-cardinality Choices go through &ldquo;scoring independently then making
        an explicit choice&rdquo; — which is what a per-option scalar scorer does and
        what a single vocabulary softmax does not.
      </figcaption>
    </figure>
  )
}
