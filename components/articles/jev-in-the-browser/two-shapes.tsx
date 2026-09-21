// The two ways to answer from a caller-supplied option list, drawn as what they
// cost a browser rather than as what they mean.
//
// LEFT — cross-encoder / per-option scalar scorer. The Jev shape: each option is
// packed with the context in its own row, the head emits one scalar per row, and
// the softmax happens afterwards over those scalars. No option is ever in another
// option's context. The cost is that the encoder runs N times.
//
// RIGHT — uni-encoder. GLiClass, which is what the open `rlcd-modernbert-151m`
// build actually is: every option is a `<<LABEL>>` span inside ONE sequence,
// ahead of a `<<SEP>>` and the context, and one forward pass emits all N logits
// at once. The cost is that every option can attend to every other option, which
// is precisely the property the per-option shape exists to deny.
//
// Server-rendered SVG, zero JS, integer coordinates only.

const OPTS = ["refund", "shipping", "bug", "spam"]

export function TwoShapes() {
  const W = 760
  const H = 340
  const colL = 24
  const colR = 400
  const colW = 336
  const rowTop = 96
  const rowH = 40

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the same question, two graph shapes — and two very different bills in a browser tab
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[680px]"
        role="img"
        aria-label="Two architectures side by side. On the left, a cross-encoder: four rows, each one containing the same context plus a single option, each row entering its own encoder pass and producing one scalar, with the four scalars joined by a softmax at the end; the encoder is marked as running four times. On the right, a uni-encoder: one sequence containing four label spans followed by a separator and the context, entering a single encoder pass that emits four logits at once; the encoder is marked as running once, and an arc shows the options attending to each other inside the shared sequence."
      >
        {/* ── column headings ─────────────────────────────────────────── */}
        <g className="fill-foreground font-mono" style={{ fontSize: 12 }}>
          <text x={colL} y={24}>cross-encoder — one pass per option</text>
          <text x={colR} y={24}>uni-encoder — one pass, all options</text>
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={colL} y={42}>Jev, CUA-S1, an NLI head. Options never meet.</text>
          <text x={colR} y={42}>GLiClass, rlcd-modernbert-151m. Options meet.</text>
          <text x={colL} y={rowTop - 16}>N rows in, N scalars out</text>
          <text x={colR} y={rowTop - 16}>1 row in, N logits out</text>
        </g>

        <line x1={W / 2 - 18} y1={12} x2={W / 2 - 18} y2={H - 12}
          className="stroke-border" strokeWidth={1} strokeDasharray="4 5" />

        {/* ── LEFT: N rows, N passes ──────────────────────────────────── */}
        {OPTS.map((o, i) => {
          const y = rowTop + i * rowH
          return (
            <g key={o}>
              <rect x={colL} y={y} width={196} height={30} rx={4}
                className="fill-background stroke-border" strokeWidth={1} />
              <text x={colL + 10} y={y + 20} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                context
              </text>
              <line x1={colL + 62} y1={y + 4} x2={colL + 62} y2={y + 26}
                className="stroke-border" strokeWidth={1} />
              <text x={colL + 72} y={y + 20} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {o}
              </text>
              <line x1={colL + 196} y1={y + 15} x2={colL + 228} y2={y + 15}
                className="stroke-border" strokeWidth={1.5} />
              <rect x={colL + 228} y={y + 1} width={58} height={28} rx={4}
                className="fill-muted/40 stroke-border" strokeWidth={1} />
              <text x={colL + 240} y={y + 20} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
                encode
              </text>
              <line x1={colL + 286} y1={y + 15} x2={colL + 310} y2={y + 15}
                className="stroke-border" strokeWidth={1.5} />
              <rect x={colL + 310} y={y + 1} width={26} height={28} rx={4}
                className="fill-background stroke-foreground/40" strokeWidth={1.5} />
              <text x={colL + 318} y={y + 20} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                s{i + 1}
              </text>
            </g>
          )
        })}
        <path
          d={`M${colL + 323} ${rowTop + 30} L${colL + 323} ${rowTop + 3 * rowH + 30}`}
          className="stroke-border" strokeWidth={1} fill="none"
        />
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={colL} y={rowTop + 4 * rowH + 24}>softmax over the 4 scalars, after the fact</text>
          <text x={colL} y={rowTop + 4 * rowH + 42} className="fill-foreground">
            encoder runs 4× · latency ∝ N
          </text>
        </g>

        {/* ── RIGHT: one packed sequence ──────────────────────────────── */}
        <rect x={colR} y={rowTop} width={colW} height={46} rx={4}
          className="fill-background stroke-border" strokeWidth={1} />
        <g className="font-mono" style={{ fontSize: 10 }}>
          {OPTS.map((o, i) => (
            <g key={o}>
              <rect x={colR + 6 + i * 56} y={rowTop + 8} width={52} height={18} rx={3}
                className="fill-muted/50 stroke-border" strokeWidth={1} />
              <text x={colR + 10 + i * 56} y={rowTop + 21} className="fill-foreground">
                {o}
              </text>
            </g>
          ))}
          <text x={colR + 6} y={rowTop + 40} className="fill-muted-foreground">
            &lt;&lt;LABEL&gt;&gt; spans · &lt;&lt;SEP&gt;&gt; · question + context
          </text>
        </g>
        {/* the attention arc that the left column does not have */}
        <path
          d={`M${colR + 32} ${rowTop + 8} C${colR + 60} ${rowTop - 16} ${colR + 140} ${rowTop - 16} ${colR + 172} ${rowTop + 8}`}
          className="stroke-foreground/45" strokeWidth={1.25} fill="none"
        />
        <text x={colR + 186} y={rowTop - 2} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          options attend to each other
        </text>

        <line x1={colR + colW / 2} y1={rowTop + 46} x2={colR + colW / 2} y2={rowTop + 74}
          className="stroke-border" strokeWidth={1.5} />
        <rect x={colR + colW / 2 - 44} y={rowTop + 74} width={88} height={28} rx={4}
          className="fill-muted/40 stroke-border" strokeWidth={1} />
        <text x={colR + colW / 2 - 30} y={rowTop + 93} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          encode ×1
        </text>
        <line x1={colR + colW / 2} y1={rowTop + 102} x2={colR + colW / 2} y2={rowTop + 126}
          className="stroke-border" strokeWidth={1.5} />
        <g>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect x={colR + 40 + i * 62} y={rowTop + 126} width={38} height={28} rx={4}
                className="fill-background stroke-foreground/40" strokeWidth={1.5} />
              <text x={colR + 52 + i * 62} y={rowTop + 145} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                s{i + 1}
              </text>
            </g>
          ))}
        </g>
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={colR} y={rowTop + 4 * rowH + 24}>one logit vector, sliced to the live option count</text>
          <text x={colR} y={rowTop + 4 * rowH + 42} className="fill-foreground">
            encoder runs 1× · latency ≈ flat in N
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 text-xs leading-relaxed text-muted-foreground">
        Left is what TypeSafe describes for Jev — &ldquo;every level is evaluated separately, the
        model doesn&rsquo;t see a level&rsquo;s number or its neighbours&rdquo; — and what an NLI
        cross-encoder does natively. Right is what the open{" "}
        <code>rlcd-modernbert-151m</code> build actually is, read from its own{" "}
        <code>worker.js</code>: all candidates are <code>&lt;&lt;LABEL&gt;&gt;</code> spans in one
        sequence. Right is the shape a browser wants. It is also the shape that cannot make the
        isolation guarantee.
      </figcaption>
    </figure>
  )
}
