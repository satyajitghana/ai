// The same weights, three serving modes. This is the whole argument of the
// article in one picture: nothing below the dashed line changes between the
// panels — same checkpoint, same forward pass, same logits — and yet one panel
// is a chatbot and the other two are decision models.
//
// Panel A is /generate: sample from the full vocabulary, append, run again.
// Panel B is /v1/score with the options in the prompt and the option letters as
// label_token_ids: ONE forward pass, three rows of the last-position logit
// vector sliced out and renormalised. Panel C is /v1/score with the options as
// `items` and a fixed Yes/No pair as label_token_ids: N forward passes, one per
// option, two rows each. B and C are different model families in every way that
// matters (see the article) and they are the same endpoint.
//
// Server-rendered SVG, zero JS. Every coordinate is integer arithmetic, so there
// is no Math.* whose last bit could differ between Node and the browser.

const LETTERS = ["A", "B", "C"] as const
const OPTIONS = ["refund", "replace", "escalate"] as const

// openjev's committed option_logits for the first row of authored144, reused
// here because they are real numbers from a real readout of this exact shape.
const LOGITS = [22.0, 26.375, 24.375] as const
const PROBS = ["0.011", "0.871", "0.118"] as const

// Per-item p(Yes) under mode C. Illustrative: no public run scores this prompt
// this way, and the article says so.
const YES = ["0.08", "0.79", "0.13"] as const

function Vocab({ x, y, tall }: { x: number; y: number; tall: number }) {
  // The logit vector at the last position, drawn to scale-ish: a tall thin
  // column, because the point is that the candidate rows are a rounding error
  // inside it.
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={34}
        height={tall}
        rx={2}
        className="fill-muted/50 stroke-border"
        strokeWidth={1}
      />
      <text
        x={x + 17}
        y={y + tall + 14}
        textAnchor="middle"
        className="fill-muted-foreground font-mono"
        style={{ fontSize: 9 }}
      >
        129,280
      </text>
    </g>
  )
}

export function ScoreModes() {
  const W = 940
  const H = 396
  const colY = 92
  const colH = 176

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one checkpoint · three serving modes · nothing below the dashed line changes
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[720px]"
        role="img"
        aria-label="Three panels sharing one row of model weights drawn along the bottom below a dashed line. Panel A, labelled slash generate, shows a prompt feeding a tall narrow column of 129,280 logits, with an arrow looping back labelled sample, append, run again, and the note many forward passes, one token each. Panel B, labelled slash v1 slash score with options in the prompt, shows the same tall column with three of its rows boxed and labelled A, B and C carrying logits 22.0, 26.375 and 24.375, a softmax over just those three rows, and probabilities 0.011, 0.871 and 0.118, with the note one forward pass, all options share a context. Panel C, labelled slash v1 slash score with options as items, shows three separate short columns, one per option — refund, replace and escalate — each with two rows boxed and labelled Yes and No, giving p of Yes equal to 0.08, 0.79 and 0.13, with the note N forward passes, no option sees another."
      >
        {/* ---- panel titles ---- */}
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={16} y={22}>A · /generate</text>
          <text x={318} y={22}>B · /v1/score — options in the prompt</text>
          <text x={664} y={22}>C · /v1/score — options as `items`</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          <text x={16} y={38}>a chatbot</text>
          <text x={318} y={38}>vocabulary readout — one context, shared</text>
          <text x={664} y={38}>per-option scoring — N contexts, isolated</text>
        </g>

        {/* panel separators */}
        <line x1={306} y1={10} x2={306} y2={300} className="stroke-border" strokeWidth={1} strokeDasharray="2 5" />
        <line x1={652} y1={10} x2={652} y2={300} className="stroke-border" strokeWidth={1} strokeDasharray="2 5" />

        {/* ---------------- PANEL A ---------------- */}
        <rect x={16} y={52} width={150} height={26} rx={3} className="fill-background stroke-border" strokeWidth={1} />
        <text x={24} y={69} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          prompt
        </text>
        <line x1={91} y1={78} x2={91} y2={colY - 4} className="stroke-border" strokeWidth={1.5} />
        <Vocab x={74} y={colY} tall={colH} />
        {/* the loop */}
        <path
          d={`M 108 ${colY + 88} L 184 ${colY + 88} L 184 65 L 166 65`}
          className="fill-none stroke-border"
          strokeWidth={1.5}
        />
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          <text x={192} y={colY + 62}>sample</text>
          <text x={192} y={colY + 76}>append</text>
          <text x={192} y={colY + 90}>run again</text>
        </g>
        <text x={16} y={296} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          many passes · one token each
        </text>

        {/* ---------------- PANEL B ---------------- */}
        <rect x={318} y={52} width={196} height={26} rx={3} className="fill-background stroke-border" strokeWidth={1} />
        <text x={326} y={69} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          prompt + &quot;A refund B replace…&quot;
        </text>
        <line x1={416} y1={78} x2={416} y2={colY - 4} className="stroke-border" strokeWidth={1.5} />
        <Vocab x={399} y={colY} tall={colH} />
        {/* three sliced rows */}
        {LETTERS.map((L, i) => {
          const ry = colY + 42 + i * 34
          return (
            <g key={L}>
              <rect
                x={397}
                y={ry}
                width={38}
                height={16}
                rx={2}
                className="fill-background stroke-foreground"
                strokeWidth={1.25}
              />
              <text x={416} y={ry + 12} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {L}
              </text>
              <line x1={435} y1={ry + 8} x2={470} y2={ry + 8} className="stroke-border" strokeWidth={1} />
              <text x={476} y={ry + 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
                {LOGITS[i].toFixed(3)}
              </text>
              <text x={546} y={ry + 12} className="fill-foreground font-mono" style={{ fontSize: 9.5 }}>
                {PROBS[i]}
              </text>
              <text x={578} y={ry + 12} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                {OPTIONS[i]}
              </text>
            </g>
          )
        })}
        <rect x={528} y={colY + 34} width={106} height={110} rx={3} className="fill-none stroke-border" strokeWidth={1} strokeDasharray="3 3" />
        <text x={532} y={colY + 158} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          softmax over 3 rows
        </text>
        <text x={318} y={296} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          one pass · options share a context
        </text>

        {/* ---------------- PANEL C ---------------- */}
        {OPTIONS.map((o, i) => {
          const cx = 664 + i * 88
          return (
            <g key={o}>
              <rect x={cx} y={52} width={72} height={26} rx={3} className="fill-background stroke-border" strokeWidth={1} />
              <text x={cx + 6} y={69} className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                {`q + ${o}`}
              </text>
              <line x1={cx + 36} y1={78} x2={cx + 36} y2={colY - 4} className="stroke-border" strokeWidth={1.5} />
              <rect x={cx + 19} y={colY} width={34} height={colH} rx={2} className="fill-muted/50 stroke-border" strokeWidth={1} />
              {/* Yes / No rows */}
              <rect x={cx + 17} y={colY + 54} width={38} height={16} rx={2} className="fill-background stroke-foreground" strokeWidth={1.25} />
              <text x={cx + 36} y={colY + 66} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 9 }}>
                Yes
              </text>
              <rect x={cx + 17} y={colY + 88} width={38} height={16} rx={2} className="fill-background stroke-border" strokeWidth={1} />
              <text x={cx + 36} y={colY + 100} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                No
              </text>
              <text x={cx + 36} y={colY + 134} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 10 }}>
                {YES[i]}
              </text>
              <text x={cx + 36} y={colY + 150} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 8.5 }}>
                p(Yes)
              </text>
            </g>
          )
        })}
        <text x={664} y={296} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          N passes · no option sees another
        </text>

        {/* ---------------- the shared weights ---------------- */}
        <line x1={16} y1={318} x2={W - 16} y2={318} className="stroke-border" strokeWidth={1} strokeDasharray="4 4" />
        <rect x={16} y={332} width={W - 32} height={40} rx={4} className="fill-muted/40 stroke-border" strokeWidth={1} />
        <text x={30} y={357} className="fill-foreground font-mono" style={{ fontSize: 10.5 }}>
          one checkpoint, unchanged — same weights, same tokenizer, same forward pass, no head, no adapter, no fine-tune
        </text>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs text-muted-foreground">
        The logits in panel B are openjev&apos;s committed{" "}
        <code className="font-mono">option_logits</code> for the first row of its
        authored144 set. The vocabulary width is DeepSeek-V4&apos;s. The{" "}
        <code className="font-mono">p(Yes)</code> figures in panel C are
        illustrative — they show the shape of the output, not a measured run.
      </figcaption>
    </figure>
  )
}
