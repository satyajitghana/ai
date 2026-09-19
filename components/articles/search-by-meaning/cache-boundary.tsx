// Where the cache boundary goes in a server-side semantic grep, and why.
//
// Next.js 16.3's `use cache` builds the cache key from the build id, a hash of
// the function's identity, and its serialized arguments — including anything
// captured from an enclosing scope (see node_modules/next/dist/docs,
// 01-app/03-api-reference/01-directives/use-cache.md, "Cache keys"). So the key
// is decided entirely by what you choose to pass in.
//
// That makes one placement decision worth more than every other tuning knob in
// this pattern: the threshold must live OUTSIDE the cached function. Jev returns
// a probability; -t / -T / --level are a comparison against it. If the cutoff is
// an argument, every threshold a reader tries is a separate cache entry and a
// separate O(lines) bill. If it is applied to the cached return value, changing
// --level from loose to strict costs nothing at all.
//
// The jev-semgrep CLI puts the threshold inside: change --level and every line
// goes back over the wire. Its own test harness does the opposite — tests/judge.mts
// calls semgrep once with `-t 0` to pull out the raw probabilities, then sweeps
// 361 threshold pairs entirely offline. The right architecture is already in the
// repository; it just lives in the tests instead of the tool.
//
// Server-rendered, zero JS.

const W = 760
const H = 430

const ACCENT = "oklch(0.72 0.15 195)"
const WARM = "oklch(0.68 0.16 40)"
const MUTED = "var(--muted-foreground)"

const CX = 236
const NW = 320
const NH = 44

type Node = { y: number; title: string; sub: string; cached?: boolean }

const NODES: Node[] = [
  { y: 24, title: "POST /api/semantic-grep", sub: "corpus + one or more propositions" },
  { y: 104, title: "chunk — 30 lines per request", sub: "state once, one noul per line × proposition" },
  { y: 200, title: "scoreChunk(lines, proposition)", sub: "returns number[] — nothing else", cached: true },
  { y: 300, title: "apply -t / -T, evaluate AND / OR / NOT", sub: "pure arithmetic on the cached array" },
  { y: 370, title: "stream NDJSON, one line per verdict", sub: "ReadableStream from the Route Handler" },
]

// smooth vertical S-curve between two points
const sCurve = (x1: number, y1: number, x2: number, y2: number) => {
  const my = (y1 + y2) / 2
  return `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
}

export function CacheBoundary() {
  const boxTop = 176
  const boxBottom = 268

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        the cache key decides the bill — put the threshold outside it
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="A vertical pipeline of five boxes. A POST route handler receives a corpus and propositions; it chunks the corpus into thirty lines per request; the third box, scoreChunk of lines and proposition returning an array of numbers, sits inside a dashed boundary labelled 'use cache — key is build id plus function id plus arguments'. A curved arrow leaves that boundary to the right on a cache miss and reaches a box for api.typesafe.ai slash v1 slash systemone; a short looping arrow labelled hit returns without leaving. Below the boundary, two more boxes apply the positive and negative thresholds and evaluate the boolean expression, then stream newline-delimited JSON. A note beside the fourth box reads 'changing --level re-runs only this'."
        >
          <defs>
            <filter id="cb-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker id="cb-arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={MUTED} strokeWidth={1.5} />
            </marker>
            <marker id="cb-arrow-warm" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
              <path d="M0,-4L6,0L0,4" fill="none" stroke={WARM} strokeWidth={1.5} />
            </marker>
          </defs>

          {/* the cache boundary */}
          <rect
            x={CX - NW / 2 - 18}
            y={boxTop}
            width={NW + 36}
            height={boxBottom - boxTop}
            rx={10}
            fill={ACCENT}
            fillOpacity={0.06}
            stroke={ACCENT}
            strokeWidth={1.5}
            strokeDasharray="5 4"
          />
          <text x={CX - NW / 2 - 12} y={boxTop + 16} fontSize={11} fill={ACCENT}>
            &ldquo;use cache&rdquo;
          </text>
          <text x={CX + NW / 2 + 12} y={boxTop + 16} textAnchor="end" fontSize={10} fill={MUTED}>
            key = build id + fn id + arguments
          </text>

          {/* connectors down the spine */}
          {NODES.slice(0, -1).map((n, i) => {
            const from = n.y + NH
            const to = NODES[i + 1].y
            return (
              <path
                key={i}
                d={sCurve(CX, from, CX, to)}
                fill="none"
                stroke={MUTED}
                strokeWidth={1.5}
                strokeOpacity={0.7}
                markerEnd="url(#cb-arrow)"
              />
            )
          })}

          {/* nodes */}
          {NODES.map((n) => (
            <g key={n.title}>
              <rect
                x={CX - NW / 2}
                y={n.y}
                width={NW}
                height={NH}
                rx={8}
                fill="var(--background)"
                stroke={n.cached ? ACCENT : "var(--border)"}
                strokeWidth={1.5}
                filter="url(#cb-soft)"
              />
              <text x={CX} y={n.y + 19} textAnchor="middle" fontSize={12} fill="var(--foreground)">
                {n.title}
              </text>
              <text x={CX} y={n.y + 34} textAnchor="middle" fontSize={10} fill={MUTED}>
                {n.sub}
              </text>
            </g>
          ))}

          {/* miss -> the model */}
          <path
            d={`M ${CX + NW / 2 + 18} 222 C ${CX + NW / 2 + 70} 222, ${600} 222, ${600} 200`}
            fill="none"
            stroke={WARM}
            strokeWidth={1.5}
            markerEnd="url(#cb-arrow-warm)"
          />
          <text x={CX + NW / 2 + 32} y={216} fontSize={10} fill={WARM}>
            miss
          </text>
          <rect
            x={528}
            y={150}
            width={200}
            height={50}
            rx={8}
            fill="var(--background)"
            stroke={WARM}
            strokeWidth={1.5}
            filter="url(#cb-soft)"
          />
          <text x={628} y={172} textAnchor="middle" fontSize={11} fill="var(--foreground)">
            api.typesafe.ai/v1/systemone
          </text>
          <text x={628} y={187} textAnchor="middle" fontSize={10} fill={MUTED}>
            $0.042 / Mtok, 1,200 req/min
          </text>

          {/* hit: never leaves */}
          <path
            d={`M ${CX + NW / 2 + 18} 248 C ${CX + NW / 2 + 54} 248, ${CX + NW / 2 + 54} 262, ${CX + NW / 2 + 18} 262`}
            fill="none"
            stroke={ACCENT}
            strokeWidth={1.5}
            markerEnd="url(#cb-arrow)"
          />
          <text x={CX + NW / 2 + 62} y={258} fontSize={10} fill={ACCENT}>
            hit — no call, no bill
          </text>

          {/* the payoff annotation */}
          <path
            d={`M ${528} 322 C ${480} 322, ${450} 322, ${CX + NW / 2 + 4} 322`}
            fill="none"
            stroke={MUTED}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            markerEnd="url(#cb-arrow)"
          />
          <text x={534} y={318} fontSize={11} fill="var(--foreground)">
            changing --level
          </text>
          <text x={534} y={332} fontSize={11} fill="var(--foreground)">
            re-runs only this
          </text>
        </svg>
      </div>

      <div className="grid gap-0 border-t sm:grid-cols-2">
        <div className="px-4 py-3 sm:border-r">
          <p className="my-0 font-mono text-xs" style={{ color: ACCENT }}>
            belongs in the key
          </p>
          <ul className="mt-1 mb-0 list-none space-y-0.5 pl-0 font-mono text-xs text-muted-foreground">
            <li>the line text, normalised</li>
            <li>the proposition text, verbatim</li>
            <li>the model id (jev-1.13.0, not jev-latest)</li>
            <li>the chunk the line was scored in</li>
          </ul>
        </div>
        <div className="px-4 py-3">
          <p className="my-0 font-mono text-xs" style={{ color: WARM }}>
            must not
          </p>
          <ul className="mt-1 mb-0 list-none space-y-0.5 pl-0 font-mono text-xs text-muted-foreground">
            <li>-t / -T / --level</li>
            <li>the AND / OR / NOT expression</li>
            <li>-A / -B / -C context, -n, --color</li>
            <li>the file name, the user, the request</li>
          </ul>
        </div>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The fourth row of the left-hand list is the uncomfortable one. Jev scores a line against a{" "}
        <span className="font-mono">state</span> holding all thirty lines of its chunk, and the
        README says large chunks &ldquo;start losing lines near the threshold&rdquo; — so the
        probability is conditioned on the neighbours, and a key of{" "}
        <span className="font-mono">(line, proposition)</span> alone is not quite sound. Keying on
        the chunk is honest and caches almost nothing; keying on the line alone caches well and
        quietly asserts an independence the tool&rsquo;s own documentation denies.
      </p>
    </figure>
  )
}
