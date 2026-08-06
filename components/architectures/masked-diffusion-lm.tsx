"use client"

// A masked-diffusion language model (e.g. LLaDA) drawn distill-style on a light
// "paper" card so the pastel cells read in both site themes. Unlike a left-to-right
// autoregressive model, it generates the whole sequence NON-autoregressively: it
// starts from an all-[M] (masked) sequence and, under bidirectional attention,
// unmasks a few tokens each step and re-predicts the rest, refining the sentence in
// parallel over T denoising steps (columns left -> right). The bottom strip shows the
// bidirectional attention that AR generation forbids.

const CY = [86, 122, 158, 194, 230, 266]

const STEPS = [
  { x: 40, cx: 71, title: "step 0", tag: "all [M]", cells: ["M", "M", "M", "M", "M", "M"], fresh: [] as number[] },
  { x: 232, cx: 263, title: "step 1", tag: "4× [M]", cells: ["the", "M", "M", "on", "M", "M"], fresh: [0, 3] },
  { x: 424, cx: 455, title: "step 2", tag: "2× [M]", cells: ["the", "cat", "M", "on", "M", "mat"], fresh: [1, 5] },
  { x: 616, cx: 647, title: "step T", tag: "text ✓", cells: ["the", "cat", "sat", "on", "the", "mat"], fresh: [2, 4] },
]

const NODES = [
  { x: 180, w: "the" },
  { x: 260, w: "cat" },
  { x: 340, w: "sat" },
  { x: 420, w: "on" },
  { x: 500, w: "the" },
]

export function MaskedDiffusionLm() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        non-autoregressive &middot; bidirectional &middot; denoise a masked sequence over T steps
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 760 460"
          className="w-full"
          role="img"
          aria-label="A masked-diffusion language model generating text non-autoregressively. Four columns left to right show denoising steps over a six-token sequence. Step 0 is all masked, shown as [M] cells. Each step unmasks a few tokens and re-predicts the rest, indicated by bold arrows labelled unmask a few and re-predict, until step T shows the full sentence the cat sat on the mat. Below, a strip of tokens connected by double-headed arrows shows the bidirectional attention that lets every token condition on all others, in contrast to left-to-right autoregressive generation."
        >
          <defs>
            <marker id="mdl-head" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto-start-reverse">
              <path d="M0,0 L6,3 L0,6 Z" fill="#2a2a2a" />
            </marker>
          </defs>

          <rect x="0" y="0" width="760" height="460" rx="10" fill="#f7f4ea" />

          {/* ───────── legend ───────── */}
          <rect x="170" y="28" width="14" height="14" rx="3" fill="#efece3" stroke="#b8b4a8" strokeWidth="1" />
          <text x="190" y="35" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
            [M] masked
          </text>
          <rect x="300" y="28" width="14" height="14" rx="3" fill="#cfe8cf" stroke="#2a2a2a" strokeWidth="1" />
          <text x="320" y="35" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
            filled
          </text>
          <rect x="430" y="28" width="14" height="14" rx="3" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1" />
          <text x="450" y="35" textAnchor="start" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
            just unmasked
          </text>

          {/* ───────── step columns ───────── */}
          {STEPS.map((s) => (
            <g key={s.title}>
              <text x={s.cx} y="66" textAnchor="middle" dominantBaseline="central" fontSize="11" fontWeight={600} fill="#2a2a2a">
                {s.title}
              </text>
              {CY.map((cy, i) => {
                const v = s.cells[i]
                const masked = v === "M"
                const fresh = s.fresh.includes(i)
                const fill = masked ? "#efece3" : fresh ? "#cfe0f5" : "#cfe8cf"
                const stroke = masked ? "#b8b4a8" : "#2a2a2a"
                const textFill = masked ? "#8a877e" : "#2a2a2a"
                return (
                  <g key={i}>
                    <rect x={s.x} y={cy} width="62" height="28" rx="6" fill={fill} stroke={stroke} strokeWidth="1.5" />
                    <text x={s.cx} y={cy + 14} textAnchor="middle" dominantBaseline="central" fontSize="11" fill={textFill}>
                      {masked ? "[M]" : v}
                    </text>
                  </g>
                )
              })}
              <text x={s.cx} y="312" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#6b6b6b">
                {s.tag}
              </text>
            </g>
          ))}

          {/* ───────── bold "unmask + re-predict" arrows between steps ───────── */}
          {[
            { x1: 102, x2: 232, cx: 167 },
            { x1: 294, x2: 424, cx: 359 },
            { x1: 486, x2: 616, cx: 551 },
          ].map((g) => (
            <g key={g.cx}>
              <line x1={g.x1} y1="190" x2={g.x2} y2="190" stroke="#2a2a2a" strokeWidth="3" markerEnd="url(#mdl-head)" />
              <text x={g.cx} y="175" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#2a2a2a">
                unmask a few
              </text>
              <text x={g.cx} y="208" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#2a2a2a">
                re-predict
              </text>
            </g>
          ))}

          {/* ───────── bidirectional attention strip ───────── */}
          <text x="362" y="344" textAnchor="middle" dominantBaseline="central" fontSize="10" fontWeight={600} fill="#2a2a2a">
            bidirectional attention
          </text>
          {NODES.map((n) => (
            <g key={n.x}>
              <rect x={n.x} y="380" width="44" height="26" rx="6" fill="#cfe0f5" stroke="#2a2a2a" strokeWidth="1.3" />
              <text x={n.x + 22} y="393" textAnchor="middle" dominantBaseline="central" fontSize="10" fill="#2a2a2a">
                {n.w}
              </text>
            </g>
          ))}
          {[
            { x1: 224, x2: 260 },
            { x1: 304, x2: 340 },
            { x1: 384, x2: 420 },
            { x1: 464, x2: 500 },
          ].map((a) => (
            <line
              key={a.x1}
              x1={a.x1}
              y1="393"
              x2={a.x2}
              y2="393"
              stroke="#2a2a2a"
              strokeWidth="1.4"
              markerStart="url(#mdl-head)"
              markerEnd="url(#mdl-head)"
            />
          ))}
          <text x="362" y="420" textAnchor="middle" dominantBaseline="central" fontSize="8.5" fill="#6b6b6b">
            each token attends both left &amp; right (not causal)
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          Unlike a left-to-right autoregressive model that commits one token at a time, a masked-diffusion LM starts from
          an all-<code>[M]</code> sequence and, under <em>bidirectional</em>{" "}attention, unmasks a few tokens each step and
          re-predicts the rest &mdash; refining the whole sentence in parallel over <em>T</em>{" "}steps.
        </p>
      </div>
    </figure>
  )
}
