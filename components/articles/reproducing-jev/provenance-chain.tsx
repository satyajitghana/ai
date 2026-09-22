// What a number needs before anyone can check it, drawn twice.
//
// Top chain: a figure used later in this article. Every link is present, so a
// reader can walk from the claim back to a file with a hash in it.
//   75 / 220  <- JevBench v1.3.0 hard tier, benchmarkheaven.com/api/jevbench/v1.2,
//   dataset_hash_all ec200ccd…, hard-tier file frozen 2026-09-19.
//
// Bottom chain: the out-of-distribution figure this article was handed. The
// number exists. Nothing behind it does. Four voids, not four weak links.
//
// The point is that these two are not "a strong claim and a weaker claim".
// They are a measurement and an assertion, and the difference is structural
// rather than a matter of degree. Server-rendered, integer geometry, no JS.

const ACCENT = "oklch(0.72 0.15 195)"

const W = 680
const H = 268

const PILL_W = 110
const PILL_H = 42
const GAP = 22
const X0 = 20

const px = (i: number) => X0 + i * (PILL_W + GAP)

const ROW_A = 60
const ROW_B = 186

type Link = { label: string; value: string }

const CHECKABLE: Link[] = [
  { label: "the number", value: "75 / 220" },
  { label: "denominator", value: "220 items" },
  { label: "benchmark", value: "JevBench 1.3" },
  { label: "who ran it", value: "Bench. Heaven" },
  { label: "artifact", value: "sha256 + api" },
]

const HANDED: Link[] = [
  { label: "the number", value: "OOD 0.541" },
  { label: "denominator", value: "" },
  { label: "benchmark", value: "" },
  { label: "who ran it", value: "" },
  { label: "artifact", value: "" },
]

function Pill({ x, y, link }: { x: number; y: number; link: Link }) {
  const present = link.value !== ""
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={PILL_W}
        height={PILL_H}
        rx={6}
        fill="var(--background)"
        stroke={present ? ACCENT : "var(--border)"}
        strokeWidth={present ? 1.5 : 1}
        strokeDasharray={present ? undefined : "3 3"}
        filter={present ? "url(#rj-soft)" : undefined}
      />
      <text
        x={x + PILL_W / 2}
        y={y + 16}
        textAnchor="middle"
        className="font-mono"
        fontSize="7.5"
        fill="currentColor"
        fillOpacity={present ? 0.55 : 0.4}
      >
        {link.label}
      </text>
      <text
        x={x + PILL_W / 2}
        y={y + 31}
        textAnchor="middle"
        className="font-mono"
        fontSize={present ? 10 : 12}
        fontWeight={present ? 600 : 400}
        fill={present ? "currentColor" : "currentColor"}
        fillOpacity={present ? 0.95 : 0.35}
      >
        {present ? link.value : "—"}
      </text>
    </g>
  )
}

function Connector({ i, y, present }: { i: number; y: number; present: boolean }) {
  const x1 = px(i) + PILL_W
  const x2 = px(i + 1)
  const mid = y + PILL_H / 2
  return (
    <path
      d={`M ${x1 + 2} ${mid} L ${x2 - 6} ${mid}`}
      fill="none"
      stroke={present ? ACCENT : "var(--border)"}
      strokeWidth={1.5}
      strokeOpacity={present ? 0.85 : 0.6}
      strokeDasharray={present ? undefined : "2 4"}
      markerEnd={present ? "url(#rj-arrow)" : undefined}
    />
  )
}

function RowLabel({ y, title, sub }: { y: number; title: string; sub: string }) {
  return (
    <g>
      <text
        x={X0}
        y={y}
        className="font-mono"
        fontSize="10"
        fontWeight={700}
        fill="currentColor"
        fillOpacity="0.95"
      >
        {title}
      </text>
      <text
        x={X0 + Math.round(title.length * 6.1) + 10}
        y={y}
        className="font-mono"
        fontSize="8"
        fill="currentColor"
        fillOpacity="0.5"
      >
        {sub}
      </text>
    </g>
  )
}

export function ProvenanceChain() {
  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        two numbers in this article, and what sits behind each
      </div>
      <div className="p-4">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label="Two chains of five links each. The upper chain, labelled a measurement, runs the number 75 out of 220 back through its denominator of 220 items, the benchmark JevBench 1.3, the party that ran it, Benchmark Heaven, and a committed artifact with a sha256 and a public API; every link is solid and connected by an arrow. The lower chain, labelled an assertion, has one solid link holding the number OOD 0.541 and then four dashed empty boxes where the denominator, the benchmark, the party who ran it and the artifact would be, each showing an em dash. A note under the lower chain reads: the first link is all there is, so nothing downstream can be re-run, re-scored or contradicted."
        >
          <defs>
            <filter id="rj-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <marker
              id="rj-arrow"
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

          <RowLabel
            y={ROW_A - 18}
            title="a measurement"
            sub="· Laya on JevBench's hard tier · every link walkable"
          />
          {CHECKABLE.map((l, i) => (
            <Pill key={l.label} x={px(i)} y={ROW_A} link={l} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Connector key={i} i={i} y={ROW_A} present />
          ))}

          <RowLabel
            y={ROW_B - 18}
            title="an assertion"
            sub="· the out-of-distribution figure I was handed · one link"
          />
          {HANDED.map((l, i) => (
            <Pill key={l.label} x={px(i)} y={ROW_B} link={l} />
          ))}
          {[0, 1, 2, 3].map((i) => (
            <Connector key={i} i={i} y={ROW_B} present={false} />
          ))}

          <text
            x={X0}
            y={ROW_B + PILL_H + 22}
            className="font-mono"
            fontSize="8.5"
            fill="currentColor"
            fillOpacity="0.55"
          >
            the first link is all there is — nothing downstream can be re-run, re-scored, or
            contradicted
          </text>

          <line
            x1={X0}
            y1={ROW_A + PILL_H + 30}
            x2={W - X0}
            y2={ROW_A + PILL_H + 30}
            stroke="var(--border)"
            strokeWidth={1}
          />
        </svg>
      </div>
    </figure>
  )
}
