// The CUA-S1 forward pass, drawn. The point of the picture is the asymmetry:
// the context is encoded once, every option is encoded on its own, and the head
// turns each (option, attended context) pair into exactly ONE number. Nothing in
// the weights knows how many options there are — N is a loop bound, which is why
// the caller can change the option set on every request.
//
// Server-rendered SVG, zero JS. All coordinates are integer arithmetic, so there
// is no Math.* to disagree between Node and the browser.
const OPTS = [
  { label: "fill email: a.chen@…", live: true },
  { label: "fill phone: 555-0142", live: true },
  { label: "skip", live: true },
]

export function OptionScorer() {
  const W = 760
  const rowH = 54
  const top = 108
  const boxW = 236
  const headX = 372
  const scoreX = 566

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        cua-s1-forms · one scalar per option, softmax over the live option count
      </div>
      <svg
        viewBox={`0 0 ${W} 320`}
        className="w-full min-w-[640px]"
        role="img"
        aria-label="The context is encoded once into context tokens. Each of three options — fill email, fill phone, and skip — is encoded separately, becomes a query attending over the context tokens, and the shared dot product turns each option and its attended context into a single logit. The three logits go into one softmax over the live option count, producing one probability per option."
      >
        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={16} y={28}>CONTEXT (task · form · current element)</text>
          <text x={16} y={top - 22}>OPTIONS — the caller sends these, and may change them every request</text>
          <text x={headX + 4} y={top - 22}>ATTEND + DOT</text>
          <text x={scoreX + 4} y={top - 22}>LOGIT</text>
        </g>

        {/* context strip, encoded once */}
        <rect x={16} y={38} width={W - 32} height={34} rx={4}
          className="fill-muted/40 stroke-border" strokeWidth={1} />
        <g className="fill-foreground/70 font-mono" style={{ fontSize: 11 }}>
          <text x={26} y={59}>byte-level embedding → 2-layer encoder (width 128, 4 heads) → context tokens</text>
        </g>

        {OPTS.map((o, i) => {
          const y = top + i * rowH
          return (
            <g key={o.label}>
              <rect x={16} y={y} width={boxW} height={36} rx={4}
                className="fill-background stroke-border" strokeWidth={1} />
              <text x={26} y={y + 23} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
                {o.label}
              </text>
              {/* option -> head */}
              <line x1={16 + boxW} y1={y + 18} x2={headX - 6} y2={y + 18}
                className="stroke-border" strokeWidth={1.5} />
              {/* context -> head, one per option: the same context, attended differently */}
              <line x1={16 + boxW / 2} y1={72} x2={headX - 6} y2={y + 18}
                className="stroke-border" strokeWidth={1} strokeDasharray="3 4" />
              <rect x={headX} y={y + 2} width={128} height={32} rx={4}
                className="fill-muted/40 stroke-border" strokeWidth={1} />
              <text x={headX + 10} y={y + 23} className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
                q · attended
              </text>
              <line x1={headX + 128} y1={y + 18} x2={scoreX - 6} y2={y + 18}
                className="stroke-border" strokeWidth={1.5} />
              <rect x={scoreX} y={y + 2} width={46} height={32} rx={4}
                className="fill-background stroke-foreground/40" strokeWidth={1.5} />
              <text x={scoreX + 16} y={y + 23} className="fill-foreground font-mono" style={{ fontSize: 12 }}>
                s{i + 1}
              </text>
              <line x1={scoreX + 46} y1={y + 18} x2={scoreX + 96} y2={y + 18}
                className="stroke-border" strokeWidth={1.5} />
            </g>
          )
        })}

        {/* the softmax spans however many rows there happen to be */}
        <rect x={scoreX + 96} y={top} width={78} height={OPTS.length * rowH - 18} rx={4}
          className="fill-muted/40 stroke-foreground/40" strokeWidth={1.5} />
        <text x={scoreX + 108} y={top + 54} className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          softmax
        </text>
        <text x={scoreX + 104} y={top + 72} className="fill-muted-foreground font-mono" style={{ fontSize: 10 }}>
          over N
        </text>

        <g className="fill-muted-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={16} y={294}>
            N is a loop bound, not a weight. The head&apos;s output dimension is 1 — so nothing in
          </text>
          <text x={16} y={310}>
            the 706,048 parameters changes when the caller sends two options instead of sixteen.
          </text>
        </g>
      </svg>
    </figure>
  )
}
