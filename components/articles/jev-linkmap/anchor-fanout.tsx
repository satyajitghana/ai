// One phrase, many destinations.
//
// Grouped from out/linkmap-verified.json in stas4000/jev-linkmap at commit
// 58f636e — the 287 links the editor kept, the ones now live on the site.
// 156 distinct anchor phrases; 26 of them carry links to more than one target,
// and those 26 account for 141 of the 287 links.
//
// This is not automatically a mistake. A reader on a page about sync errors who
// clicks "field mapping" probably does want that page's field-mapping guide. But
// anchor text is the one thing a link says about its destination, and ten
// destinations sharing a phrase say nothing to a crawler about any of them.
//
// The contrast is the point of the article: lib/related.ts writes the target's
// own title as the anchor, so the mapping is one-to-one by construction and 254
// targets have 254 distinct anchors. It buys that by being unable to put the
// link in a sentence at all.
//
// Server-rendered, zero JS.

const W = 700
const H = 246
const CX = 232
const TX = 452
const T = 40
const NEG = "oklch(0.58 0.19 27)"
const POS = "oklch(0.58 0.15 152)"

type Phrase = { text: string; targets: number; links: number }

const PHRASES: Phrase[] = [
  { text: "hubspot–salesforce integration", targets: 19, links: 34 },
  { text: "field mapping", targets: 10, links: 24 },
  { text: "bi-directional sync", targets: 3, links: 10 },
  { text: "reverse etl", targets: 3, links: 8 },
  { text: "multi-touch attribution", targets: 3, links: 7 },
  { text: "sync rules", targets: 4, links: 6 },
]

const ROW = 30

export function AnchorFanout() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        out/linkmap-verified.json —{" "}
        <span className="text-foreground">141 of the 287 live links share an anchor phrase with a link that goes somewhere else</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Six anchor phrases from the shipped link map, each fanning out to several different destination pages. The phrase hubspot dash salesforce integration is the anchor for 34 links pointing at 19 different pages. Field mapping is the anchor for 24 links pointing at 10 pages. Bi-directional sync, reverse ETL and multi-touch attribution each point at 3 pages, and sync rules at 4."
        >
          <text x={CX} y={22} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
            anchor phrase
          </text>
          <text x={TX + 8} y={22} fontSize={10} fill="var(--muted-foreground)">
            distinct destinations
          </text>

          {PHRASES.map((p, i) => {
            const y = T + i * ROW
            const spread = Math.min(p.targets, 10)
            return (
              <g key={p.text}>
                <text x={CX - 10} y={y + 4} textAnchor="end" fontSize={11} fill="var(--foreground)" className="font-mono">
                  {p.text}
                </text>
                <circle cx={CX + 4} cy={y} r={3} fill={NEG} />
                {Array.from({ length: spread }, (_, j) => {
                  const dy = (j - (spread - 1) / 2) * 2.1
                  return (
                    <path
                      key={j}
                      d={`M${CX + 6} ${y} C ${CX + 80} ${y} ${TX - 70} ${y + dy} ${TX} ${y + dy}`}
                      fill="none"
                      stroke={NEG}
                      strokeWidth={0.9}
                      strokeOpacity={0.4}
                    />
                  )
                })}
                <text x={TX + 8} y={y + 4} fontSize={11} fill={NEG} className="font-mono">
                  {p.targets}
                </text>
                <text x={TX + 34} y={y + 4} fontSize={10} fill="var(--muted-foreground)">
                  pages · {p.links} links
                </text>
              </g>
            )
          })}

          <line x1={CX - 190} y1={T + PHRASES.length * ROW} x2={W - 24} y2={T + PHRASES.length * ROW} stroke="var(--border)" strokeWidth={1} />
          <text x={CX - 10} y={T + PHRASES.length * ROW + 20} textAnchor="end" fontSize={11} fill="var(--foreground)" className="font-mono">
            this site, every related link
          </text>
          <circle cx={CX + 4} cy={T + PHRASES.length * ROW + 16} r={3} fill={POS} />
          <path d={`M${CX + 6} ${T + PHRASES.length * ROW + 16} C ${CX + 80} ${T + PHRASES.length * ROW + 16} ${TX - 70} ${T + PHRASES.length * ROW + 16} ${TX} ${T + PHRASES.length * ROW + 16}`} fill="none" stroke={POS} strokeWidth={1.4} />
          <text x={TX + 8} y={T + PHRASES.length * ROW + 20} fontSize={11} fill={POS} className="font-mono">
            1
          </text>
          <text x={TX + 34} y={T + PHRASES.length * ROW + 20} fontSize={10} fill="var(--muted-foreground)">
            page · the anchor is its title
          </text>
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        Fifty-nine of the placed links use the bare product pair as their anchor.{" "}
        <span className="font-mono">rubrics/v3.json</span> says in as many words that a product-pair
        head term &ldquo;fits only general complete or end-to-end guides&rdquo;, and the
        editor&apos;s own third rule is to cut &ldquo;a bare brand or product pair&rdquo;. The
        editor cut 21 of the 59 and kept 38, of which 8 point at a page whose title says complete,
        end-to-end or master. Two rules pointing the same way, and thirty of thirty-eight survivors
        break both.
      </p>
    </figure>
  )
}
