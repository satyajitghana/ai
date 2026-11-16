"use client"

// Index-selected sparse attention (DeepSeek Sparse Attention), on the gallery's
// paper card. A new token's query goes two ways: a small, cheap indexer scores
// every cached key (the bars), the top k scores pick positions (red), and the
// main attention reads only those entries of a cache that still holds all of
// them. Drawn with k = 5 of 24 positions; real models pick 2,048 of up to a
// million. All coordinates are literals (SSR-safe).

const INK = "#2a2a2a"
const PAPER = "#f7f4ea"
const BLUE = "#cfe0f5"
const SALMON = "#f5cfcf"
const YELLOW = "#f5eec0"
const RED = "#8a2b2b"

// indexer score per cached position (bar height in px); the five tallest win
const SCORES = [18, 30, 12, 8, 46, 14, 10, 22, 9, 58, 16, 11, 7, 25, 13, 50, 9, 15, 20, 8, 12, 40, 28, 54]
const PICKED = new Set([4, 9, 15, 21, 23])

const X0 = 150 // first cache cell
const CW = 22 // cell width
const CACHE_Y = 214

export function SparseAttentionIndexer() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="border-b px-4 py-2.5 font-mono text-xs text-muted-foreground">
        index-selected sparse attention &middot; a cheap indexer picks which keys the real attention reads
      </div>
      <div className="p-3 sm:p-4">
        <svg
          viewBox="0 0 780 440"
          className="w-full"
          role="img"
          aria-label="A new token goes two ways. Its lightning indexer, a few small low-precision heads, scores every cached position, drawn as a row of bars above the cache. The five highest scores, in red, select five positions. Below, the cache still holds an entry for every past token, but the main attention gathers and reads only the five selected entries, then writes its output. The caption notes that the cache keeps all N entries while each query reads only k of them."
        >
          <defs>
            <marker id="dsa-a" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={INK} />
            </marker>
            <marker id="dsa-r" markerWidth="9" markerHeight="9" refX="5.5" refY="3" orient="auto">
              <path d="M0,0 L6,3 L0,6 Z" fill={RED} />
            </marker>
          </defs>

          <rect x="0" y="0" width="780" height="440" rx="10" fill={PAPER} />

          <text x="390" y="30" textAnchor="middle" fontSize="12" fill={INK}>
            score&nbsp;&nbsp;I&#8348;,&#8347; = &#931;&#11388; w&#8348;,&#11388; &middot; ReLU(q&#8348;,&#11388; &middot; k&#8347;)&nbsp;&nbsp;for every cached s, then attend over the top k
          </text>

          {/* the new token */}
          <rect x="22" y="196" width="96" height="54" rx="8" fill="#efece3" stroke={INK} strokeWidth="1.5" />
          <text x="70" y="216" textAnchor="middle" dominantBaseline="central" fontSize="12" fill={INK}>
            new token
          </text>
          <text x="70" y="233" textAnchor="middle" dominantBaseline="central" fontSize="11" fill={INK}>
            h&#8348;
          </text>

          {/* indexer path (top) */}
          <path d="M 70 194 L 70 76 L 146 76" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#dsa-a)" />
          <rect x="150" y="54" width="230" height="44" rx="7" fill={YELLOW} stroke={INK} strokeWidth="1.4" />
          <text x="265" y="70" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            lightning indexer
          </text>
          <text x="265" y="86" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            few heads, low precision, scores all N
          </text>
          <line x1="265" y1="100" x2="265" y2="140" stroke={INK} strokeWidth="1.4" markerEnd="url(#dsa-a)" />
          <text x="400" y="80" fontSize="10" fill="#6b6b6b">
            one score per cached position
          </text>

          {/* score bars */}
          {SCORES.map((h, i) => (
            <rect
              key={`s${i}`}
              x={X0 + i * CW + 4}
              y={196 - h}
              width={CW - 8}
              height={h}
              fill={PICKED.has(i) ? RED : "#c9b98a"}
            />
          ))}
          <line x1={X0} y1="196" x2={X0 + 24 * CW} y2="196" stroke={INK} strokeWidth="1" />
          <text x={X0 + 24 * CW + 8} y="150" fontSize="10.5" fill={RED}>
            top k
          </text>
          <text x={X0 + 24 * CW + 8} y="164" fontSize="10.5" fill={RED}>
            (5 here)
          </text>

          {/* the cache: every position kept */}
          {SCORES.map((_, i) => (
            <rect
              key={`c${i}`}
              x={X0 + i * CW}
              y={CACHE_Y}
              width={CW}
              height="26"
              fill={PICKED.has(i) ? SALMON : BLUE}
              stroke={PICKED.has(i) ? RED : INK}
              strokeWidth={PICKED.has(i) ? 1.8 : 0.8}
            />
          ))}
          <text x={X0 + 24 * CW + 8} y={CACHE_Y + 12} fontSize="10.5" fill={INK}>
            cache: all N
          </text>
          <text x={X0 + 24 * CW + 8} y={CACHE_Y + 26} fontSize="10.5" fill={INK}>
            entries kept
          </text>

          {/* gather the picked entries into the main attention */}
          {[...PICKED].map((i) => (
            <line
              key={`g${i}`}
              x1={X0 + i * CW + CW / 2}
              y1={CACHE_Y + 28}
              x2={330 + [...PICKED].indexOf(i) * 30}
              y2="318"
              stroke={RED}
              strokeWidth="1.3"
              markerEnd="url(#dsa-r)"
            />
          ))}
          <rect x="250" y="322" width="280" height="46" rx="7" fill={SALMON} stroke={INK} strokeWidth="1.5" />
          <text x="390" y="339" textAnchor="middle" dominantBaseline="central" fontSize="11.5" fontWeight="600" fill={INK}>
            main attention over k entries only
          </text>
          <text x="390" y="356" textAnchor="middle" dominantBaseline="central" fontSize="10" fill={INK}>
            softmax and values as usual, on the gathered rows
          </text>
          <path d="M 70 252 L 70 345 L 246 345" fill="none" stroke={INK} strokeWidth="1.4" markerEnd="url(#dsa-a)" />
          <text x="78" y="300" fontSize="10" fill="#6b6b6b">
            query
          </text>
          <line x1="530" y1="345" x2="600" y2="345" stroke={INK} strokeWidth="1.4" markerEnd="url(#dsa-a)" />
          <text x="606" y="349" fontSize="11.5" fill={INK}>
            output
          </text>

          <text x="390" y="414" textAnchor="middle" fontSize="11.5" fill="#6b6b6b">
            keeps every key, reads only k &middot; the indexer still scans all N, cheaply
          </text>
        </svg>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The indexer is a second, much smaller attention: a few heads in low precision whose ReLU scores rank every cached
          position. The{" "}<span style={{ color: RED }}>top k</span>{" "}positions are the only ones the main attention gathers and
          reads. Nothing is evicted, so the cache is as large as a dense layer&rsquo;s; what shrinks is how much of it each
          query reads.
        </p>
      </div>
    </figure>
  )
}
