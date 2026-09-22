// "Search cheap, branch wide, reason only when necessary" — with the three jobs
// separated, because a decision model only does one of them.
//
// Search needs three things: somebody enumerates the successors of a state,
// somebody prices them, and somebody sequences and backtracks. A bounded-output
// model is a pricing function. It never sees the tree, it cannot hold a plan
// between calls, and the branching factor it works over was fixed by whoever
// built the list.
//
// That is why the theory and the disappointment are the same observation: the
// economics favour wide and punish deep, and depth is exactly what a long
// horizon is made of.
//
// Evidence in the boxes: WindTunnel rebuilds its action menu every step from the
// live DOM and throws above 255; a 255-option Choice carries log2(255) = 7.99
// bits and nothing else; Chopra's WikiRouter is ten hops and Jev reached the
// destination on 1 of 120 routes, stopping on 118.
//
// Server-rendered, exact arithmetic, no JS.

const ACCENT = "oklch(0.72 0.15 195)"

const W = 680
const H = 292

const ROOT_X = 158
const ROOT_Y = 42
const L1_Y = 116
const L2_Y = 190
const L1_X = [38, 98, 158, 218, 278]
const L2_X = [110, 134, 158, 182, 206]

const BOX_X = 356
const BOX_W = 308
const BOX_H = 58
const BOX_Y = [40, 114, 188]

type Role = { who: string; what: string; note: string; model?: boolean }

const ROLES: Role[] = [
  {
    who: "harness",
    what: "enumerate the successors",
    note: "rebuilt each step from what is live, capped and de-duped",
  },
  {
    who: "the model",
    what: "price one branch",
    note: "one distribution over the list handed in · 7.99 bits out",
    model: true,
  },
  {
    who: "harness",
    what: "sequence, stop, backtrack",
    note: "nothing carries between calls; the caller rebuilds state",
  },
]

function Node({ x, cy, r, dim }: { x: number; cy: number; r: number; dim?: boolean }) {
  return (
    <circle
      cx={x}
      cy={cy}
      r={r}
      fill="var(--background)"
      stroke="currentColor"
      strokeOpacity={dim ? 0.25 : 0.55}
      strokeWidth={1.4}
    />
  )
}

function Edge({
  x1,
  y1,
  x2,
  y2,
  dim,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  dim?: boolean
}) {
  const my = (y1 + y2) / 2
  return (
    <path
      d={`M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`}
      fill="none"
      stroke="currentColor"
      strokeOpacity={dim ? 0.14 : 0.32}
      strokeWidth={1.3}
    />
  )
}

export function BranchPrice() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the three jobs in a search, and which one a decision model does
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="On the left, a search tree: one root state fans out to five successors, the middle successor fans out to five more, and a row of faint dashes below suggests the next level. Labels read b options at the first level, b times b at the second and b to the d at the bottom, with a note that depth costs a fresh round trip because nothing carries between calls. On the right, three stacked boxes name the three jobs a search needs. The first, owned by the harness, is enumerate the successors, rebuilt each step from what is live, capped and de-duplicated. The second, highlighted and owned by the model, is price one branch: one distribution over the list it was handed, at most 7.99 bits out. The third, owned by the harness again, is sequence, stop and backtrack, with the note that nothing carries between calls so the caller rebuilds the state every time. A curved arrow runs from one edge of the tree into the middle box only."
        >
          <defs>
            <filter id="rj-bp-soft" x="-30%" y="-40%" width="160%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.15" />
            </filter>
            <marker
              id="rj-bp-arrow"
              viewBox="0 -5 10 10"
              markerWidth="7"
              markerHeight="7"
              refX="7"
              refY="0"
              orient="auto"
            >
              <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* ---- the tree ---- */}
          <text
            x={20}
            y={18}
            className="font-mono"
            fontSize="9"
            fontWeight={700}
            fill="currentColor"
            fillOpacity="0.85"
          >
            every action opens more actions
          </text>

          {L1_X.map((x) => (
            <Edge key={`e1${x}`} x1={ROOT_X} y1={ROOT_Y + 8} x2={x} y2={L1_Y - 6} />
          ))}
          {L2_X.map((x) => (
            <Edge key={`e2${x}`} x1={158} y1={L1_Y + 6} x2={x} y2={L2_Y - 5} dim />
          ))}

          <Node x={ROOT_X} cy={ROOT_Y} r={8} />
          <text
            x={ROOT_X}
            y={ROOT_Y + 3}
            textAnchor="middle"
            className="font-mono"
            fontSize="7"
            fill="currentColor"
            fillOpacity="0.7"
          >
            s
          </text>
          {L1_X.map((x) => (
            <Node key={`n1${x}`} x={x} cy={L1_Y} r={6} />
          ))}
          {L2_X.map((x) => (
            <Node key={`n2${x}`} x={x} cy={L2_Y} r={4} dim />
          ))}

          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
            <line
              key={`d${i}`}
              x1={30 + i * 22}
              y1={L2_Y + 30}
              x2={30 + i * 22 + 9}
              y2={L2_Y + 30}
              stroke="currentColor"
              strokeOpacity="0.18"
              strokeWidth={1.4}
            />
          ))}

          <text
            x={312}
            y={L1_Y + 3}
            textAnchor="end"
            className="font-mono"
            fontSize="8"
            fill="currentColor"
            fillOpacity="0.45"
          >
            b
          </text>
          <text
            x={312}
            y={L2_Y + 3}
            textAnchor="end"
            className="font-mono"
            fontSize="8"
            fill="currentColor"
            fillOpacity="0.45"
          >
            b*b
          </text>
          <text
            x={312}
            y={L2_Y + 33}
            textAnchor="end"
            className="font-mono"
            fontSize="8"
            fill="currentColor"
            fillOpacity="0.45"
          >
            b^d
          </text>

          <text
            x={20}
            y={H - 26}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.6"
          >
            width is one call
          </text>
          <text
            x={20}
            y={H - 13}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.6"
          >
            depth is d calls, each re-reading the state
          </text>

          {/* ---- the three jobs ---- */}
          {ROLES.map((r, i) => {
            const y0 = BOX_Y[i]
            return (
              <g key={r.what}>
                <rect
                  x={BOX_X}
                  y={y0}
                  width={BOX_W}
                  height={BOX_H}
                  rx={7}
                  fill="var(--background)"
                  stroke={r.model ? ACCENT : "var(--border)"}
                  strokeWidth={r.model ? 1.8 : 1}
                  filter={r.model ? "url(#rj-bp-soft)" : undefined}
                />
                <text
                  x={BOX_X + 12}
                  y={y0 + 17}
                  className="font-mono"
                  fontSize="7.5"
                  fontWeight={700}
                  fill={r.model ? ACCENT : "currentColor"}
                  fillOpacity={r.model ? 1 : 0.5}
                >
                  {r.who.toUpperCase()}
                </text>
                <text
                  x={BOX_X + 12}
                  y={y0 + 33}
                  className="font-mono"
                  fontSize="10.5"
                  fontWeight={600}
                  fill="currentColor"
                  fillOpacity="0.95"
                >
                  {r.what}
                </text>
                <text
                  x={BOX_X + 12}
                  y={y0 + 48}
                  className="font-mono"
                  fontSize="7.5"
                  fill="currentColor"
                  fillOpacity="0.55"
                >
                  {r.note}
                </text>
              </g>
            )
          })}

          <path
            d={`M 288 ${L1_Y - 20} C 330 ${L1_Y - 20}, 330 ${BOX_Y[1] + BOX_H / 2}, ${BOX_X - 7} ${
              BOX_Y[1] + BOX_H / 2
            }`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            markerEnd="url(#rj-bp-arrow)"
          />
          <text
            x={292}
            y={L1_Y - 26}
            className="font-mono"
            fontSize="7.5"
            fill={ACCENT}
            fillOpacity="0.9"
          >
            one edge
          </text>
        </svg>
      </div>
    </figure>
  )
}
