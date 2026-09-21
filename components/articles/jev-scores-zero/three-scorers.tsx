// Three ways to turn a question and a list of options into one typed answer,
// drawn as the token windows each one actually builds. The relational-choice
// score falls out of the geometry, and the geometry is quoted from source:
//
//   per-option scoring  — openjev src/semif_phase1/reranker.py (ca3ba65)
//                         one sequence per (question, option); options never meet
//   letter readout      — openjev src/semif_phase1/direct.py   (ca3ba65)
//                         one sequence, all options, argmax over A/B/C/D logits
//   marker readout      — laya    laya/common.py               (6a58191)
//                         one sequence, a [MASK] marker per option, shared head
//
// Only the first one makes a relational question unanswerable. Server-rendered,
// integer geometry, no JS.

const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.65 0.02 260)"

const W = 680
const H = 324

// Pill layout: width tracks the label so nothing overflows its rect at 390px.
const pw = (text: string, size: number) => Math.round(text.length * size * 0.58 + 13)

function layout(labels: string[], x0: number, size: number, gap: number) {
  let x = x0
  return labels.map((label) => {
    const w = pw(label, size)
    const at = x
    x += w + gap
    return { label, x: at, w }
  })
}

type PillProps = {
  x: number
  y: number
  w: number
  h: number
  label: string
  size: number
  strong?: boolean
}

function Pill({ x, y, w, h, label, size, strong }: PillProps) {
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={4}
        fill="var(--background)"
        stroke={strong ? ACCENT : "var(--border)"}
        strokeWidth={strong ? 1.5 : 1}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + size * 0.35}
        textAnchor="middle"
        className="font-mono"
        fontSize={size}
        fill="currentColor"
        fillOpacity={strong ? 0.95 : 0.7}
      >
        {label}
      </text>
    </g>
  )
}

function Header({
  y,
  name,
  source,
  score,
  accent,
}: {
  y: number
  name: string
  source: string
  score: string
  accent: boolean
}) {
  return (
    <g>
      <text
        x={12}
        y={y}
        className="font-mono"
        fontSize="10"
        fontWeight={700}
        fill="currentColor"
        fillOpacity="0.95"
      >
        {name}
      </text>
      <text
        x={12 + Math.round(name.length * 6.1) + 10}
        y={y}
        className="font-mono"
        fontSize="8"
        fill="currentColor"
        fillOpacity="0.5"
      >
        {source}
      </text>
      <text
        x={668}
        y={y}
        textAnchor="end"
        className="font-mono"
        fontSize="11"
        fontWeight={700}
        fill={accent ? ACCENT : "currentColor"}
        fillOpacity={accent ? 1 : 0.7}
      >
        {score}
      </text>
    </g>
  )
}

// --- panel 1: one forward pass per option -----------------------------------
const P1_TOP = 28
const P1_BOX_X = 110
const P1_BOX_W = 165
const P1_BOX_H = 24
const P1_STEP = 28
const P1_OPTS = ["A", "B", "C", "D"]
const p1BoxY = (i: number) => P1_TOP + i * P1_STEP
const P1_PILLS = layout(["question", "option A", "state"], P1_BOX_X + 7, 8, 6)

// --- panel 2: one prompt, letter readout ------------------------------------
const P2_TOP = 180
const P2_BOX_X = 110
const P2_BOX_H = 42
const P2_PILLS = layout(["system", "question", "A", "B", "C", "D", "state"], P2_BOX_X + 7, 8, 5)
const P2_BOX_W =
  P2_PILLS[P2_PILLS.length - 1].x + P2_PILLS[P2_PILLS.length - 1].w + 7 - P2_BOX_X

// --- panel 3: one sequence, marker readout ----------------------------------
const P3_TOP = 262
const P3_BOX_X = 110
const P3_BOX_H = 42
const P3_PILLS = layout(
  ["[CLS]", "instr", "[SEP]", "[M]A", "[M]B", "[M]C", "[M]D", "[SEP]", "state"],
  P3_BOX_X + 7,
  7.5,
  4
)
const P3_BOX_W =
  P3_PILLS[P3_PILLS.length - 1].x + P3_PILLS[P3_PILLS.length - 1].w + 7 - P3_BOX_X

// Arc from the top of one pill to the top of another, bulging upward.
function arcOver(a: { x: number; w: number }, b: { x: number; w: number }, y: number, rise: number) {
  const x1 = a.x + a.w / 2
  const x2 = b.x + b.w / 2
  return `M ${x1} ${y} C ${x1} ${y - rise}, ${x2} ${y - rise}, ${x2} ${y}`
}

export function ThreeScorers() {
  const bMid = p1BoxY(1) + P1_BOX_H / 2
  const dMid = p1BoxY(3) + P1_BOX_H / 2
  const cut = P1_BOX_X + P1_BOX_W
  const bulge = cut + 62

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        three readouts, three token windows · relational choice, 100 cases
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Three architectures drawn as the token windows they build. Per-option scoring runs one forward pass per option, so option B's window contains no option D and the two never meet; it scores 0 of 100. A letter readout puts the system prompt, the question, all four options and the state in one window and reads the A/B/C/D logits; it scores 53. Laya's marker readout puts a [M] mask marker before each option in one bidirectional sequence and gathers a shared scalar head at each marker; it scores 8."
        >
          <defs>
            <marker
              id="ts-arrow"
              viewBox="0 -5 10 10"
              markerWidth="6"
              markerHeight="6"
              refX="6"
              refY="0"
              orient="auto"
            >
              <path d="M0,-3.5L5,0L0,3.5" fill="none" stroke={MUTED} strokeWidth={1.4} />
            </marker>
          </defs>

          {/* ---------------- panel 1 ---------------- */}
          <Header
            y={16}
            name="per-option scoring"
            source="· shape: openjev reranker.py · claimed for Jev"
            score="0 / 100"
            accent
          />
          {P1_OPTS.map((o, i) => {
            const y = p1BoxY(i)
            const key = o === "B" || o === "D"
            return (
              <g key={o}>
                <text
                  x={100}
                  y={y + P1_BOX_H / 2 + 3}
                  textAnchor="end"
                  className="font-mono"
                  fontSize="8"
                  fill="currentColor"
                  fillOpacity="0.5"
                >
                  pass {o}
                </text>
                <rect
                  x={P1_BOX_X}
                  y={y}
                  width={P1_BOX_W}
                  height={P1_BOX_H}
                  rx={5}
                  fill={key ? ACCENT : MUTED}
                  fillOpacity={key ? 0.07 : 0.04}
                  stroke={key ? ACCENT : "var(--border)"}
                  strokeWidth={key ? 1.4 : 1}
                  strokeOpacity={key ? 0.7 : 1}
                />
                {P1_PILLS.map((p) => (
                  <Pill
                    key={p.label}
                    x={p.x}
                    y={y + 5}
                    w={p.w}
                    h={14}
                    size={8}
                    label={p.label === "option A" ? `option ${o}` : p.label}
                    strong={key && p.label === "option A"}
                  />
                ))}
              </g>
            )
          })}

          {/* the edge that does not exist */}
          <path
            d={`M ${cut} ${bMid} C ${bulge} ${bMid}, ${bulge} ${dMid}, ${cut} ${dMid}`}
            fill="none"
            stroke={ACCENT}
            strokeWidth="1.3"
            strokeOpacity="0.5"
            strokeDasharray="3 3"
          />
          <g transform={`translate(${cut + 47} ${(bMid + dMid) / 2})`}>
            <circle r="7.5" fill="var(--background)" stroke={ACCENT} strokeWidth="1.2" />
            <path d="M-3.4,-3.4 L3.4,3.4 M3.4,-3.4 L-3.4,3.4" stroke={ACCENT} strokeWidth="1.4" />
          </g>
          <text
            x={cut + 62}
            y={(bMid + dMid) / 2 - 3}
            className="font-mono"
            fontSize="8.5"
            fill={ACCENT}
          >
            option B cannot see option D.
          </text>
          <text
            x={cut + 62}
            y={(bMid + dMid) / 2 + 9}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.55"
          >
            Not down-weighted — absent from the window.
          </text>

          <line
            x1={12}
            y1={156}
            x2={W - 12}
            y2={156}
            stroke="currentColor"
            strokeOpacity="0.12"
          />

          {/* ---------------- panel 2 ---------------- */}
          <Header
            y={170}
            name="letter readout"
            source="· shape: openjev direct.py · scored by the 4-bit Qwen3-4B"
            score="53 / 100"
            accent={false}
          />
          <rect
            x={P2_BOX_X}
            y={P2_TOP}
            width={P2_BOX_W}
            height={P2_BOX_H}
            rx={5}
            fill={MUTED}
            fillOpacity="0.04"
            stroke="var(--border)"
          />
          {P2_PILLS.map((p) => (
            <Pill
              key={p.label}
              x={p.x}
              y={P2_TOP + 22}
              w={p.w}
              h={14}
              size={8}
              label={p.label}
              strong={p.label === "B" || p.label === "D"}
            />
          ))}
          <path
            d={arcOver(P2_PILLS[3], P2_PILLS[5], P2_TOP + 22, 14)}
            fill="none"
            stroke={MUTED}
            strokeWidth="1.3"
            markerEnd="url(#ts-arrow)"
          />
          <text
            x={P2_BOX_X + P2_BOX_W + 14}
            y={P2_TOP + 27}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.6"
          >
            one window, so B can read D
          </text>

          <line
            x1={12}
            y1={238}
            x2={W - 12}
            y2={238}
            stroke="currentColor"
            strokeOpacity="0.12"
          />

          {/* ---------------- panel 3 ---------------- */}
          <Header
            y={252}
            name="marker readout"
            source="· code and score: laya/common.py · Laya English 421M"
            score="8 / 100"
            accent={false}
          />
          <rect
            x={P3_BOX_X}
            y={P3_TOP}
            width={P3_BOX_W}
            height={P3_BOX_H}
            rx={5}
            fill={MUTED}
            fillOpacity="0.04"
            stroke="var(--border)"
          />
          {P3_PILLS.map((p, i) => (
            <Pill
              key={`${p.label}-${i}`}
              x={p.x}
              y={P3_TOP + 22}
              w={p.w}
              h={14}
              size={7.5}
              label={p.label}
              strong={p.label === "[M]B" || p.label === "[M]D"}
            />
          ))}
          <path
            d={arcOver(P3_PILLS[4], P3_PILLS[6], P3_TOP + 22, 14)}
            fill="none"
            stroke={MUTED}
            strokeWidth="1.3"
            markerEnd="url(#ts-arrow)"
          />
          <text
            x={P3_BOX_X + P3_BOX_W + 14}
            y={P3_TOP + 22}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.6"
          >
            also one window, bidirectional —
          </text>
          <text
            x={P3_BOX_X + P3_BOX_W + 14}
            y={P3_TOP + 33}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.6"
          >
            but 192 head tokens, 48 per option
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The bottom two rows can represent a relational question and still get it wrong; only the
          top row cannot represent it at all. That is the whole distance between 8 and 0. Laya at 8
          is badly wrong — far below chance — but it is wrong from inside a window that contains the
          answer, which is a fixable problem: a wider head budget, more training, better option
          packing. Nothing in the top row is fixable by training. The referent is not in the tensor.
        </p>
      </div>
      <figcaption className="border-t px-3 py-2 text-center font-mono text-xs leading-5 text-muted-foreground">
        Every shape here is drawn from source I can read; only row three is the same codebase that
        produced its score. Row one is openjev&apos;s reranker readout{" "}(
        <code>src/semif_phase1/reranker.py</code>), which is the shape TypeSafe&apos;s docs describe
        for Jev and which nobody outside TypeSafe can confirm — treat it as the hypothesis the 0/100
        is evidence for, not as Jev&apos;s published architecture. Row two is openjev&apos;s{" "}
        <code>direct.py</code>{" "}on Qwen3.5-4B; Chopra&apos;s 53 comes from a separate 4-bit
        Qwen3-4B built the same way — &ldquo;a single forward pass scores answer-label
        probabilities&rdquo; — not from openjev. Row three is Laya&apos;s own{" "}
        <code>laya/common.py</code>, and the 8 is Laya&apos;s.
      </figcaption>
    </figure>
  )
}
