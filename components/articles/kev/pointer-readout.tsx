// The third family, drawn.
//
// /articles/cua-s1-forms split open decision models into two: a vocabulary
// readout (options are lettered text in one shared prompt; you slice three rows
// out of a 151,936-wide logit vector) and a per-option scalar scorer (each
// option is encoded alone and scored alone). Kev is neither. Every option is a
// span in one shared sequence, each closed by a `</opt>` delimiter, and a
// trained bilinear head scores each `</opt>` hidden state against the hidden
// state at `<decide>`.
//
// The consequence is the whole article. `<decide>` comes last and sees every
// option; option spans see the state, their own question's instructions, and —
// because the mask is only block-causal by question — each other. Questions are
// isolated. Options within a question are not, and that is where the flips come
// from.
//
// Server-rendered SVG, zero JS, integer coordinates only.

type Tok = { text: string; kind: "state" | "instr" | "opt" | "decide" }

const SEQ: Tok[] = [
  { text: "<state>", kind: "state" },
  { text: "…the ticket…", kind: "state" },
  { text: "<q>", kind: "instr" },
  { text: "which team?", kind: "instr" },
  { text: "<opt>", kind: "opt" },
  { text: "returns", kind: "opt" },
  { text: "</opt>", kind: "opt" },
  { text: "<opt>", kind: "opt" },
  { text: "billing", kind: "opt" },
  { text: "</opt>", kind: "opt" },
  { text: "<decide>", kind: "decide" },
]

const FILL: Record<Tok["kind"], string> = {
  state: "fill-foreground/10 stroke-foreground/40",
  instr: "fill-background stroke-border",
  opt: "fill-background stroke-foreground/45",
  decide: "fill-foreground/20 stroke-foreground/70",
}

export function PointerReadout() {
  const W = 820
  const seqY = 96
  const tokH = 28
  const H = 330

  const xStart = 16
  const widths = SEQ.map((t) => Math.max(52, t.text.length * 7 + 14))
  const xs: number[] = []
  let cursor = xStart
  for (const w of widths) {
    xs.push(cursor)
    cursor += w + 5
  }

  const closeIdx = [6, 9]
  const decideIdx = 10
  const xDecide = xs[decideIdx] + widths[decideIdx] / 2
  const headY = 214

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one sequence, one forward pass, one scalar per option
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[740px]"
        role="img"
        aria-label="A diagram of Kev's pointer readout. A single token sequence runs left to right: a state delimiter and the ticket text, then a question delimiter and its instructions, then two option spans each opened by an opt delimiter and closed by a slash-opt delimiter, and finally a decide token. Curved lines carry the hidden state at each slash-opt delimiter down into a head, which also takes the hidden state at decide. The head computes k of the option state dotted with q of the decide state, divided by the square root of 256, then divided by a stored temperature, giving one scalar per option and a softmax across them. A note records that decide comes last and can read every option, that option spans can read each other, and that a separate question's tokens are masked out entirely."
      >
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={xStart} y={26}>
            options are spans in one shared sequence, not separate passes
          </text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xStart} y={44}>
            the block-causal mask isolates question from question; inside a
            question nothing is isolated
          </text>
          <text x={xStart} y={seqY - 14}>
            packed record (attention-only backbones; Qwen3.5 runs each question
            as its own row, same positions)
          </text>
        </g>

        {SEQ.map((tok, i) => (
          <g key={`${tok.text}-${i}`}>
            <rect
              x={xs[i]}
              y={seqY}
              width={widths[i]}
              height={tokH}
              rx={3}
              className={FILL[tok.kind]}
              strokeWidth={tok.kind === "decide" ? 1.5 : 1}
            />
            <text
              x={xs[i] + widths[i] / 2}
              y={seqY + 18}
              textAnchor="middle"
              className={
                tok.kind === "instr"
                  ? "fill-muted-foreground font-mono"
                  : "fill-foreground font-mono"
              }
              style={{ fontSize: 10 }}
            >
              {tok.text}
            </text>
          </g>
        ))}

        {closeIdx.map((idx, n) => {
          const x = xs[idx] + widths[idx] / 2
          return (
            <path
              key={idx}
              d={`M ${x} ${seqY + tokH} C ${x} ${seqY + 70}, ${xDecide - 120 + n * 40} ${headY - 30}, ${xDecide - 60 + n * 40} ${headY - 6}`}
              className="stroke-foreground/50"
              strokeWidth={1.25}
              fill="none"
            />
          )
        })}
        <path
          d={`M ${xDecide} ${seqY + tokH} C ${xDecide} ${seqY + 90}, ${xDecide + 60} ${headY - 40}, ${xDecide + 20} ${headY - 6}`}
          className="stroke-foreground/70"
          strokeWidth={1.5}
          fill="none"
        />

        <rect
          x={xDecide - 150}
          y={headY}
          width={330}
          height={54}
          rx={4}
          className="fill-foreground/5 stroke-foreground/55"
          strokeWidth={1.5}
        />
        <text
          x={xDecide - 138}
          y={headY + 21}
          className="fill-foreground font-mono"
          style={{ fontSize: 11 }}
        >
          z = k(h_opt) · q(h_decide) / √256
        </text>
        <text
          x={xDecide - 138}
          y={headY + 39}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 9 }}
        >
          then / T at inference · softmax across the options
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xStart} y={headY + 12}>
            trained: two Linear(d → 256)
          </text>
          <text x={xStart} y={headY + 28}>
            2,097,664 params at 9B
          </text>
          <text x={xStart} y={headY + 44}>
            plus a rank-16 LoRA
          </text>
          <text x={xStart} y={headY + 60}>
            43,278,336 params at 9B
          </text>
        </g>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          <text x={xStart} y={H - 24}>
            `&lt;decide&gt;` is last, so it reads every option — which is also why
            option 2 is computed in a context containing option 1
          </text>
          <text x={xStart} y={H - 8}>
            option_isolation=1 gives every span its own sub-branch and one shared
            position, making the readout permutation-invariant by construction
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Drawn from <code>kev/model.py</code> — <code>encode</code>,{" "}
        <code>branch_mask_batch</code> and <code>PointerHead.forward</code>. The
        five delimiters are not new tokens: the code reuses five rarely-used Qwen
        specials (<code>&lt;|fim_prefix|&gt;</code> and friends) so no embedding
        rows have to be added, and rewrites any <code>&lt;|name|&gt;</code> in
        caller text to <code>&lt;¦name¦&gt;</code> before tokenising, so an option
        boundary cannot be forged from the outside.
      </figcaption>
    </figure>
  )
}
