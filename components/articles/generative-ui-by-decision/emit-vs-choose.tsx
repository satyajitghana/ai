// The two shapes of generative UI, drawn so the bounded-output property is the
// thing you see first.
//
// Left: a model that *writes* the interface. It emits tokens until it stops, so
// its output space is every string its tokenizer can produce — which is why
// json-render ships a 536-line spec-validator with thirteen error codes and a
// lossy repair pass.
//
// Right: a model that *chooses* the interface. json-render's experimental
// composer hands it a finite set of keys and copies the element recipes itself.
// The strip on the right is 161 ticks because that is the real option count of
// the playground's first evaluation call — measured by running the composer.
//
// Server-rendered, zero JS.

const ACCENT = "oklch(0.60 0.15 255)"
const WARN = "oklch(0.60 0.17 25)"

const W = 760
const H = 432
const LX = 22
const RX = 398
const CW = 340
const OPTIONS = 161

function Header({ x, kicker, title }: { x: number; kicker: string; title: string }) {
  return (
    <>
      <text x={x} y={16} className="fill-muted-foreground font-mono" fontSize={10}>
        {kicker}
      </text>
      <text x={x} y={34} className="fill-foreground" fontSize={14} fontWeight={600}>
        {title}
      </text>
    </>
  )
}

function BandLabel({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <text x={x} y={y} className="fill-muted-foreground font-mono" fontSize={9.5}>
      {text}
    </text>
  )
}

export function EmitVsChoose() {
  // ── left: the token tape ────────────────────────────────────────────────
  const tape = ["{", '"root"', ":", '"a"', ",", '"elements"', ":", "{", '"a"']
  let tx = LX
  const tapeCells = tape.map((tok) => {
    const w = Math.max(16, tok.length * 6.4 + 10)
    const cell = { tok, x: tx, w }
    tx += w + 4
    return cell
  })

  // ── right: the enumerated option strip ──────────────────────────────────
  const stripX = RX + 6
  const stripW = CW - 12
  const ticks = Array.from({ length: OPTIONS }, (_, i) => stripX + (i * (stripW - 1)) / (OPTIONS - 1))

  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="A two-column comparison of generative UI approaches. Left: a model that emits a component tree token by token, whose output space is every string its tokenizer can produce, so an element type Timeline that the catalog does not contain can be emitted and must be caught by a validator that prunes or repairs it. Right: a model that chooses from an enumerated set, shown as a strip of 161 discrete ticks — the real option count of the first evaluation call in Vercel's json-render playground — where Timeline has no key and therefore cannot be returned at all."
      >
        <defs>
          <filter id="gvd-soft" x="-40%" y="-40%" width="180%" height="180%">
            <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
          </filter>
          <linearGradient id="gvd-fade" x1="0" x2="1">
            <stop offset="0" stopColor={WARN} stopOpacity="0.85" />
            <stop offset="0.75" stopColor={WARN} stopOpacity="0.45" />
            <stop offset="1" stopColor={WARN} stopOpacity="0" />
          </linearGradient>
          <marker
            id="gvd-arrow"
            viewBox="0 -5 10 10"
            markerWidth="7"
            markerHeight="7"
            orient="auto"
            refX="7"
            refY="0"
          >
            <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
          </marker>
        </defs>

        <line x1={380} y1={8} x2={380} y2={H - 8} stroke="var(--border)" strokeWidth={1} />

        <Header x={LX} kicker="the usual shape" title="The model writes the UI" />
        <Header x={RX} kicker="json-render + jev" title="The model picks the UI" />

        {/* ── Band A: what comes back ───────────────────────────────────── */}
        <BandLabel x={LX} y={62} text="WHAT COMES BACK" />
        <BandLabel x={RX} y={62} text="WHAT COMES BACK" />

        {tapeCells.map((c) => (
          <g key={`${c.tok}-${c.x}`}>
            <rect
              x={c.x}
              y={72}
              width={c.w}
              height={22}
              rx={5}
              fill="var(--background)"
              stroke="var(--border)"
              strokeWidth={1}
            />
            <text
              x={c.x + c.w / 2}
              y={87}
              textAnchor="middle"
              className="fill-muted-foreground font-mono"
              fontSize={9.5}
            >
              {c.tok}
            </text>
          </g>
        ))}
        <text x={LX} y={112} className="fill-muted-foreground font-mono" fontSize={10}>
          …one token at a time, until it stops
        </text>

        <rect
          x={RX}
          y={72}
          width={CW}
          height={40}
          rx={8}
          fill="var(--background)"
          stroke={ACCENT}
          strokeWidth={1.5}
          filter="url(#gvd-soft)"
        />
        <text x={RX + 12} y={88} className="fill-foreground font-mono" fontSize={10}>
          {`{ root: "card", select_12: "use:input_name", … }`}
        </text>
        <text x={RX + 12} y={103} className="fill-muted-foreground font-mono" fontSize={9.5}>
          50 keys, one forward pass, 0 output tokens
        </text>

        {/* ── Band B: the space it came from ────────────────────────────── */}
        <BandLabel x={LX} y={152} text="THE SPACE IT CAME FROM" />
        <BandLabel x={RX} y={152} text="THE SPACE IT CAME FROM" />

        <line x1={LX} y1={176} x2={LX + CW} y2={176} stroke="url(#gvd-fade)" strokeWidth={2} />
        {Array.from({ length: 26 }, (_, i) => LX + i * 13).map((x, i) => (
          <line
            key={x}
            x1={x}
            y1={170}
            x2={x}
            y2={182}
            stroke={WARN}
            strokeWidth={1}
            opacity={Math.max(0, 0.7 - i * 0.026)}
          />
        ))}
        <text x={LX} y={200} className="fill-muted-foreground font-mono" fontSize={10}>
          every string the tokenizer can emit
        </text>
        <text x={LX} y={214} className="fill-muted-foreground font-mono" fontSize={10}>
          — unbounded, and it runs off this page
        </text>

        <line x1={stripX} y1={166} x2={stripX} y2={186} stroke={ACCENT} strokeWidth={2} />
        <line
          x1={stripX + stripW}
          y1={166}
          x2={stripX + stripW}
          y2={186}
          stroke={ACCENT}
          strokeWidth={2}
        />
        {ticks.map((x) => (
          <line key={x} x1={x} y1={170} x2={x} y2={182} stroke={ACCENT} strokeWidth={0.8} opacity={0.75} />
        ))}
        <text x={RX} y={200} className="fill-muted-foreground font-mono" fontSize={10}>
          161 options across 37 questions — every one
        </text>
        <text x={RX} y={214} className="fill-muted-foreground font-mono" fontSize={10}>
          a key your code wrote. Hard stops at both ends.
        </text>

        {/* ── Band C: something you don't have ──────────────────────────── */}
        <BandLabel x={LX} y={252} text="AN ELEMENT YOUR CATALOG DOES NOT CONTAIN" />
        <BandLabel x={RX} y={252} text="AN ELEMENT YOUR CATALOG DOES NOT CONTAIN" />

        <rect
          x={LX}
          y={264}
          width={CW}
          height={46}
          rx={8}
          fill="var(--background)"
          stroke={WARN}
          strokeWidth={1.5}
          filter="url(#gvd-soft)"
        />
        <text x={LX + 12} y={282} className="fill-foreground font-mono" fontSize={10}>
          {`"n7": { "type": "Timeline", "props": { … } }`}
        </text>
        <text x={LX + 12} y={299} className="font-mono" fontSize={9.5} fill={WARN}>
          emitted. It is a legal string, so nothing stopped it.
        </text>
        <path
          d={`M ${LX + CW / 2} 310 C ${LX + CW / 2} 326, ${LX + CW / 2} 326, ${LX + CW / 2} 340`}
          fill="none"
          stroke="var(--muted-foreground)"
          strokeWidth={1.5}
          opacity={0.6}
        />
        <rect
          x={LX}
          y={340}
          width={CW}
          height={58}
          rx={8}
          fill="var(--muted)"
          stroke="var(--border)"
          strokeWidth={1}
        />
        <text x={LX + 12} y={359} className="fill-foreground font-mono" fontSize={10}>
          spec-validator.ts — 536 lines
        </text>
        <text x={LX + 12} y={375} className="fill-muted-foreground font-mono" fontSize={9.5}>
          13 error codes, 6 silent repairs, lossy pruning
        </text>
        <text x={LX + 12} y={390} className="fill-muted-foreground font-mono" fontSize={9.5}>
          of children that point at nothing
        </text>

        <rect
          x={RX}
          y={264}
          width={CW}
          height={46}
          rx={8}
          fill="var(--background)"
          stroke="var(--border)"
          strokeWidth={1}
          strokeDasharray="4 3"
        />
        <text x={RX + 12} y={282} className="fill-muted-foreground font-mono" fontSize={10}>
          Timeline
        </text>
        <text x={RX + 12} y={299} className="fill-muted-foreground font-mono" fontSize={9.5}>
          has no key on the strip above.
        </text>
        <path
          d={`M ${RX + CW / 2} 310 C ${RX + CW / 2} 326, ${RX + CW / 2} 326, ${RX + CW / 2} 340`}
          fill="none"
          stroke={ACCENT}
          strokeWidth={1.5}
          markerEnd="url(#gvd-arrow)"
        />
        <rect
          x={RX}
          y={340}
          width={CW}
          height={58}
          rx={8}
          fill="var(--background)"
          stroke={ACCENT}
          strokeWidth={1.5}
          filter="url(#gvd-soft)"
        />
        <text x={RX + 12} y={359} className="fill-foreground font-mono" fontSize={10}>
          not emitted, not rejected — not expressible
        </text>
        <text x={RX + 12} y={375} className="fill-muted-foreground font-mono" fontSize={9.5}>
          the composer copies your recipe into the spec.
        </text>
        <text x={RX + 12} y={390} className="fill-muted-foreground font-mono" fontSize={9.5}>
          The model never touches a prop.
        </text>
      </svg>
      <figcaption className="border-t px-4 py-3 text-center font-mono text-xs leading-5 text-muted-foreground">
        Both panels describe the same library. The left is how json-render has always
        worked — an LLM streams a spec and a validator repairs it. The right is{" "}
        <code>experimental_composeSpec</code>: 161 options across 37 questions is the real
        first call for the playground&rsquo;s 42 candidate recipes, measured by running the
        composer against a recording evaluator.
      </figcaption>
    </figure>
  )
}
