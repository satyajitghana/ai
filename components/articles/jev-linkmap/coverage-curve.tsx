// Inbound coverage: what fraction of a corpus has at least k internal links
// pointing at it. The orphan rate is the point at k = 1.
//
// Ours, measured with `npx tsx scripts/check-links.mts` and a walk of the
// bodies on 2026-09-20: 254 articles, 634 hand-written prose links, then 1,036
// edges added by lib/related.ts.
//
// Theirs, recomputed from out/linkmap.json and out/linkmap-verified.json in
// stas4000/jev-linkmap at commit 58f636e, over the 566 pages the run covered.
//
// The two are NOT the same measurement and the caption says so: ours is every
// internal edge in the corpus, theirs is only the edges the run ADDED. The
// site's pre-existing links are in the crawl file, which is gitignored, so the
// comparable baseline cannot be computed from the repository.
//
// Log-spaced x so the tail is visible; mlog10 from lib/dmath keeps the SSR and
// client coordinate strings identical.

import { mlog10 } from "@/lib/dmath"

const W = 760
const H = 310
const L = 52
const R = 210
const T = 22
const B = 44
const PW = W - L - R
const PH = H - T - B

const KS = [1, 2, 3, 5, 8, 13, 21, 34]

const OURS = "oklch(0.55 0.16 250)"
const OURS_PRE = "oklch(0.60 0.05 250)"
const THEIRS = "oklch(0.58 0.19 27)"
const THEIRS_PRE = "oklch(0.70 0.10 40)"

type Series = { name: string; note: string; tint: string; dash?: string; v: number[] }

const SERIES: Series[] = [
  {
    name: "this site, after lib/related.ts",
    note: "254 articles · 1,670 edges",
    tint: OURS,
    v: [100, 81.9, 71.3, 53.5, 31.9, 13.8, 2.4, 1.6],
  },
  {
    name: "this site, prose links only",
    note: "254 articles · 634 edges",
    tint: OURS_PRE,
    dash: "4 3",
    v: [52.0, 39.0, 30.3, 17.7, 9.1, 3.5, 1.2, 0.4],
  },
  {
    name: "jev-linkmap, links kept",
    note: "566 pages · 287 new edges",
    tint: THEIRS,
    v: [26.7, 10.8, 5.1, 1.8, 0.7, 0, 0, 0],
  },
  {
    name: "jev-linkmap, links placed",
    note: "566 pages · 679 new edges",
    tint: THEIRS_PRE,
    dash: "4 3",
    v: [42.4, 23.7, 14.1, 6.5, 2.8, 1.2, 0, 0],
  },
]

const lo = mlog10(1)
const hi = mlog10(34)
const x = (k: number) => L + ((mlog10(k) - lo) / (hi - lo)) * PW
const y = (p: number) => T + PH - (p / 100) * PH

function path(v: number[]): string {
  return v
    .map((p, i) => `${i === 0 ? "M" : "L"}${x(KS[i]).toFixed(2)} ${y(p).toFixed(2)}`)
    .join(" ")
}

export function CoverageCurve() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        inbound coverage — <span className="text-foreground">share of pages with at least k inbound internal links</span>
      </div>

      <div className="px-3 pt-3 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Four coverage curves on a log x-axis from 1 to 34 inbound links. This site after the related-articles planner starts at 100 percent of articles having at least one inbound link, falls to 53.5 percent at five and 13.8 percent at thirteen. This site with hand-written prose links only starts at 52 percent, meaning 122 of 254 articles were orphans. The jev-linkmap run's kept links reach 26.7 percent of its 566 pages at one link and 1.8 percent at five; the links it placed before the editor pass reach 42.4 percent at one. The two sites are not measured the same way: ours counts every internal edge, theirs counts only the edges the run added."
        >
          {[0, 25, 50, 75, 100].map((p) => (
            <g key={p}>
              <line x1={L} y1={y(p)} x2={L + PW} y2={y(p)} stroke="var(--border)" strokeWidth={1} strokeOpacity={p === 0 ? 1 : 0.45} />
              <text x={L - 8} y={y(p) + 3} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
                {p}%
              </text>
            </g>
          ))}

          {KS.map((k) => (
            <g key={k}>
              <line x1={x(k)} y1={T} x2={x(k)} y2={T + PH} stroke="var(--border)" strokeWidth={1} strokeOpacity={0.3} />
              <text x={x(k)} y={T + PH + 16} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                {k}
              </text>
            </g>
          ))}
          <text x={L + PW / 2} y={T + PH + 34} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
            k inbound links (log)
          </text>

          {SERIES.map((s, i) => (
            <g key={s.name}>
              <path d={path(s.v)} fill="none" stroke={s.tint} strokeWidth={s.dash ? 1.5 : 2} strokeDasharray={s.dash} strokeLinejoin="round" />
              {s.v.map((p, j) =>
                p > 0 ? <circle key={KS[j]} cx={x(KS[j])} cy={y(p)} r={2.4} fill={s.tint} /> : null
              )}
              <g transform={`translate(${L + PW + 14} ${T + 8 + i * 42})`}>
                <line x1={0} y1={-4} x2={18} y2={-4} stroke={s.tint} strokeWidth={s.dash ? 1.5 : 2} strokeDasharray={s.dash} />
                <text x={24} y={0} fontSize={10.5} fill="var(--foreground)">
                  {s.name}
                </text>
                <text x={24} y={14} fontSize={9.5} fill="var(--muted-foreground)">
                  {s.note}
                </text>
              </g>
            </g>
          ))}

          <circle cx={x(1)} cy={y(52)} r={4.5} fill="none" stroke={OURS_PRE} strokeWidth={1.5} />
          <text x={x(1) + 9} y={y(52) - 6} fontSize={10} fill="var(--muted-foreground)">
            122 of 254 orphaned
          </text>
        </svg>
      </div>

      <p className="my-0 border-t px-4 py-3 text-xs text-muted-foreground">
        The two solid lines are not the same measurement, and the difference flatters us. Ours
        counts every internal edge in the corpus; theirs counts only the edges their run{" "}
        <em>added</em>, on a site that already had its own links. Their crawler records exactly the
        baseline that would make this comparable —{" "}
        <span className="font-mono">links_out</span>, body-copy links with nav and footer stripped —
        and <span className="font-mono">data/</span> is in{" "}
        <span className="font-mono">.gitignore</span>, so it is not in the repository. What the
        curves do compare honestly is shape: both methods put most of their new edges on a small
        set of pages, and both leave a tail.
      </p>
    </figure>
  )
}
