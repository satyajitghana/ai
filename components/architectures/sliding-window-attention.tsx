"use client"

// Sliding-window (local) attention interleaved with global layers, on the
// gallery's paper card. Left: the two attention masks over ten positions, a
// local layer whose query sees only the last W = 4 keys (plus an attention sink
// at position 0) and a global layer that sees every earlier key. Right: one
// block of a 5:1 local/global stack with what each layer caches at long
// context. Masks are single staircase paths over a grid pattern, so the figure
// stays small. All coordinates are literals or integer arithmetic (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const RED = "#8a2b2b"

const N = 10 // positions drawn
const C = 16 // cell size
const W = 4 // window

// lower-triangular (causal) mask as one staircase path
function causalPath(x0: number, y0: number) {
  let d = `M ${x0} ${y0}`
  for (let i = 0; i < N; i++) d += ` H ${x0 + (i + 1) * C} V ${y0 + (i + 1) * C}`
  return `${d} H ${x0} Z`
}

// band mask: row i sees keys max(0, i - W + 1) .. i
function bandPath(x0: number, y0: number) {
  let d = `M ${x0} ${y0}`
  for (let i = 0; i < N; i++) d += ` H ${x0 + (i + 1) * C} V ${y0 + (i + 1) * C}`
  d += ` H ${x0 + (N - W) * C}`
  for (let i = N - 1; i >= W; i--) d += ` V ${y0 + i * C} H ${x0 + (i - W) * C}`
  return `${d} V ${y0} Z`
}

const MASK_Y = 92
const LOCAL_X = 44
const GLOBAL_X = 256

const STACK = [
  { y: 92, global: true },
  { y: 134, global: false },
  { y: 176, global: false },
  { y: 218, global: false },
  { y: 260, global: false },
  { y: 302, global: false },
]

export function SlidingWindowAttention() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        sliding-window attention &middot; local layers with a global layer every few
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 420"
          className="w-full"
          role="img"
          aria-label="Left: two attention masks over ten positions, queries down the side and keys along the top. In the local layer each query sees only the last four keys, a diagonal band, plus the very first position, an attention sink. In the global layer each query sees every earlier key, a full lower triangle. Right: one block of a hybrid stack read bottom to top, five local layers and then one global layer. Each local layer caches at most W tokens no matter how long the context is; the global layer caches every token, so its cache grows with the context."
        >
          <defs>
            <pattern id="swa-grid" width={C} height={C} patternUnits="userSpaceOnUse">
              <path d={`M ${C} 0 L 0 0 0 ${C}`} fill="none" stroke="#cfc8b4" strokeWidth="0.7" />
            </pattern>
            <marker id="swa-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="420" rx="10" fill={PAPER} />

          {/* ---- masks ---- */}
          <text x="124" y="44" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
            local layer
          </text>
          <text x="124" y="62" textAnchor="middle" fontSize="10.5" fill="#6b6b6b">
            each query sees the last W = 4 keys
          </text>
          <text x="336" y="44" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
            global layer
          </text>
          <text x="336" y="62" textAnchor="middle" fontSize="10.5" fill="#6b6b6b">
            each query sees every earlier key
          </text>

          <path d={bandPath(LOCAL_X, MASK_Y)} fill={BLUE} />
          <rect x={LOCAL_X} y={MASK_Y + W * C} width={C} height={(N - W) * C} fill={YELLOW} />
          <rect x={LOCAL_X} y={MASK_Y} width={N * C} height={N * C} fill="url(#swa-grid)" stroke={INK} strokeWidth="1.3" />
          <path d={bandPath(LOCAL_X, MASK_Y)} fill="none" stroke={INK} strokeWidth="1.3" />

          <path d={causalPath(GLOBAL_X, MASK_Y)} fill={SALMON} />
          <rect x={GLOBAL_X} y={MASK_Y} width={N * C} height={N * C} fill="url(#swa-grid)" stroke={INK} strokeWidth="1.3" />
          <path d={causalPath(GLOBAL_X, MASK_Y)} fill="none" stroke={INK} strokeWidth="1.3" />

          {/* axes */}
          <text x={LOCAL_X + 80} y={MASK_Y + 176} textAnchor="middle" fontSize="10" fill="#6b6b6b">
            keys &rarr;
          </text>
          <text x={GLOBAL_X + 80} y={MASK_Y + 176} textAnchor="middle" fontSize="10" fill="#6b6b6b">
            keys &rarr;
          </text>
          <text x={LOCAL_X - 10} y={MASK_Y + 80} textAnchor="middle" fontSize="10" fill="#6b6b6b" transform={`rotate(-90 ${LOCAL_X - 10} ${MASK_Y + 80})`}>
            queries &rarr;
          </text>
          <text x={GLOBAL_X - 10} y={MASK_Y + 80} textAnchor="middle" fontSize="10" fill="#6b6b6b" transform={`rotate(-90 ${GLOBAL_X - 10} ${MASK_Y + 80})`}>
            queries &rarr;
          </text>

          {/* sink note */}
          <line x1={LOCAL_X + 8} y1={MASK_Y + 196} x2={LOCAL_X + 8} y2={MASK_Y + 164} stroke={RED} strokeWidth="1.3" markerEnd="url(#swa-a)" />
          <text x={LOCAL_X} y={MASK_Y + 210} fontSize="10" fill={RED}>
            sink: position 0 stays visible
          </text>
          <text x={LOCAL_X} y={MASK_Y + 224} fontSize="10" fill={RED}>
            (in models that keep one)
          </text>

          <text x={GLOBAL_X} y={MASK_Y + 210} fontSize="10" fill="#6b6b6b">
            reads grow with position:
          </text>
          <text x={GLOBAL_X} y={MASK_Y + 224} fontSize="10" fill="#6b6b6b">
            the cost window layers avoid
          </text>

          <line x1="452" y1="36" x2="452" y2="380" stroke="#d9d4c3" strokeWidth="1" />

          {/* ---- one block of the stack ---- */}
          <text x="610" y="44" textAnchor="middle" fontSize="12" fontWeight="600" fill={INK}>
            one block, read bottom to top
          </text>
          <text x="690" y="70" textAnchor="middle" fontSize="10.5" fill="#6b6b6b">
            cached at long context
          </text>
          {STACK.map((l) => (
            <g key={l.y}>
              <rect x="486" y={l.y} width="96" height="30" rx="6" fill={l.global ? SALMON : BLUE} stroke={INK} strokeWidth="1.4" />
              <text x="534" y={l.y + 15} textAnchor="middle" dominantBaseline="central" fontSize="11.5" fill={INK}>
                {l.global ? "global" : "local"}
              </text>
              {l.global ? (
                <g>
                  <rect x="598" y={l.y + 7} width="150" height="16" fill={SALMON} stroke={INK} strokeWidth="1.1" />
                  <line x1="748" y1={l.y + 15} x2="764" y2={l.y + 15} stroke={INK} strokeWidth="1.3" markerEnd="url(#swa-a)" />
                </g>
              ) : (
                <g>
                  <rect x="598" y={l.y + 7} width="24" height="16" fill={BLUE} stroke={INK} strokeWidth="1.1" />
                  <text x="630" y={l.y + 15} dominantBaseline="central" fontSize="10" fill="#3a6ea5">
                    W tokens, then flat
                  </text>
                </g>
              )}
            </g>
          ))}
          <text x="673" y="136" textAnchor="middle" fontSize="10" fill={RED}>
            every token, growing
          </text>
          <path d="M 476 92 L 468 92 L 468 332 L 476 332" fill="none" stroke={INK} strokeWidth="1.3" />
          <text x="462" y="352" textAnchor="start" fontSize="11" fontWeight="600" fill={INK}>
            &times;N blocks
          </text>

          <text x="390" y="402" textAnchor="middle" fontSize="11.5" fill="#6b6b6b">
            a window caps memory by position &middot; the global layers carry everything older
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          A{" "}<span style={{ color: "#3a6ea5" }}>local layer</span>{" "}attends over a fixed window of recent keys, so its cache
          stops growing once the context passes W tokens. Stacking windows widens what the top of the stack can reach, and a{" "}
          <span style={{ color: RED }}>global layer</span>{" "}every few layers reads the whole past. Some models also keep the
          first tokens visible to every query as an attention sink.
        </p>
      </div>
    </figure>
  )
}
