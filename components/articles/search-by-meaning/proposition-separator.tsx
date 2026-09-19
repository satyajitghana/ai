// The refund example, drawn from jev-semgrep's own published output.
//
// Every probability here is quoted from the repository's README, which prints
// the run it made against tests/contrast.txt:
//
//   $ ./semgrep -n -p -t 0 -e "customer is asking for a refund" tests/contrast.txt
//   1:返金してほしい。商品が壊れていた                          [0.98]
//   2:返金処理が完了しましたのでご確認ください                   [0.10]
//   3:当社の返金ポリシーは購入後30日以内です                     [0.10]
//   4:The manager denied the refund request yesterday           [0.17]
//   5:I demand a full refund immediately                        [0.94]
//   6:Refunds are processed within 5 business days              [0.08]
//
// The point the README makes is that all six lines are "about a refund" and
// only two are a customer asking for one. The point this component adds is the
// *size of the gap*: 0.17 to 0.94 is 0.77 of the unit interval with nothing in
// it, which is why the demo is insensitive to the threshold — all three
// --level presets (0.3 / 0.5 / 0.7) land inside the empty band. That is a
// property of this eight-line fixture, not a property of the model, and it is
// the reason the fixture cannot tell you whether the threshold is tuned right.
//
// Panel B is the pair the README uses for the AND case. Lines 7 and 8 of the
// same file differ only in the subject noun and share the trailing nine
// characters 怒って電話を切った verbatim; the support-agent line scores 0.05 on
// "the customer, not the staff, is the one acting". The README also asserts the
// cosine similarity of the pair "is close to 1" — that number is the author's,
// not measured here, and the shared-suffix arithmetic below is what is checkable
// from the file itself.
//
// Server-rendered, zero JS.

const W = 760
const AX0 = 56
const AX1 = W - 42
const SPAN = AX1 - AX0

const POS = "oklch(0.58 0.15 152)"
const NEG = "oklch(0.58 0.19 27)"
const ACCENT = "oklch(0.72 0.15 195)"

type Line = {
  n: number
  text: string
  gloss: string
  p: number
}

// tests/contrast.txt, lines 1-6, with the probabilities the README prints.
const LINES: Line[] = [
  { n: 1, text: "返金してほしい。商品が壊れていた", gloss: "I want a refund. The item was broken.", p: 0.98 },
  { n: 2, text: "返金処理が完了しましたのでご確認ください", gloss: "Refund processing is complete, please confirm.", p: 0.1 },
  { n: 3, text: "当社の返金ポリシーは購入後30日以内です", gloss: "Our refund policy is within 30 days of purchase.", p: 0.1 },
  { n: 4, text: "The manager denied the refund request yesterday", gloss: "", p: 0.17 },
  { n: 5, text: "I demand a full refund immediately", gloss: "", p: 0.94 },
  { n: 6, text: "Refunds are processed within 5 business days", gloss: "", p: 0.08 },
]

const PRESETS = [
  { name: "loose", t: 0.3 },
  { name: "normal", t: 0.5 },
  { name: "strict", t: 0.7 },
]

const x = (p: number) => AX0 + p * SPAN

// Two lines sit at exactly 0.10; stagger the dots so neither is hidden.
function lanes(items: Line[]) {
  const sorted = [...items].sort((a, b) => a.p - b.p)
  const out = new Map<number, number>()
  let prev = -1
  let lane = 0
  for (const it of sorted) {
    lane = prev >= 0 && it.p - prev < 0.04 ? lane + 1 : 0
    out.set(it.n, lane)
    prev = it.p
  }
  return out
}

export function PropositionSeparator() {
  const lane = lanes(LINES)
  const lowest = Math.min(...LINES.map((l) => l.p))
  const hiNeg = Math.max(...LINES.filter((l) => l.p < 0.5).map((l) => l.p))
  const loPos = Math.min(...LINES.filter((l) => l.p >= 0.5).map((l) => l.p))
  const margin = loPos - hiNeg

  const AXIS_Y = 132
  const H = 224

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        tests/contrast.txt · P(&ldquo;customer is asking for a refund&rdquo;) per line
      </div>

      <div className="px-3 pt-4 pb-2">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          role="img"
          aria-label={`A probability axis from 0 to 1. Six lines from the file tests/contrast.txt are plotted by the probability Jev assigns to the proposition "customer is asking for a refund". Four sit between 0.08 and 0.17: the refund-complete notice, the refund policy, the denied request and the processing-times line. Two sit at 0.94 and 0.98: "I demand a full refund immediately" and the Japanese "I want a refund, the item was broken". A shaded empty band ${margin.toFixed(2)} wide separates the two groups, and all three --level threshold presets at 0.3, 0.5 and 0.7 fall inside that empty band. A bracket above all six dots is labelled "one topic: every line is about a refund".`}
        >
          <defs>
            <filter id="sbm-soft" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
            </filter>
            <pattern id="sbm-empty" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="7" stroke={ACCENT} strokeWidth="1" strokeOpacity="0.35" />
            </pattern>
          </defs>

          {/* topic bracket: all six lines share one topic */}
          <path
            d={`M ${x(lowest) - 10} 42 L ${x(lowest) - 10} 30 L ${x(0.98) + 10} 30 L ${x(0.98) + 10} 42`}
            fill="none"
            stroke="var(--border)"
            strokeWidth={1.5}
          />
          <text
            x={(x(lowest) + x(0.98)) / 2}
            y={22}
            textAnchor="middle"
            fontSize={12}
            fill="var(--muted-foreground)"
          >
            one topic — all six lines are about a refund
          </text>

          {/* the empty band between the two groups */}
          <rect
            x={x(hiNeg)}
            y={52}
            width={x(loPos) - x(hiNeg)}
            height={AXIS_Y - 52}
            fill="url(#sbm-empty)"
          />
          <text
            x={(x(hiNeg) + x(loPos)) / 2}
            y={70}
            textAnchor="middle"
            fontSize={12}
            fill={ACCENT}
          >
            nothing lands here
          </text>
          <text
            x={(x(hiNeg) + x(loPos)) / 2}
            y={86}
            textAnchor="middle"
            fontSize={11}
            fill="var(--muted-foreground)"
          >
            {hiNeg.toFixed(2)} → {loPos.toFixed(2)}, a band {margin.toFixed(2)} wide
          </text>

          {/* preset thresholds */}
          {PRESETS.map((pr) => (
            <g key={pr.name}>
              <line
                x1={x(pr.t)}
                y1={94}
                x2={x(pr.t)}
                y2={AXIS_Y + 6}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
                strokeDasharray="3 3"
              />
              <text
                x={x(pr.t)}
                y={106}
                textAnchor="middle"
                fontSize={10}
                fill="var(--muted-foreground)"
              >
                {pr.name}
              </text>
            </g>
          ))}

          {/* axis */}
          <line x1={AX0} y1={AXIS_Y} x2={AX1} y2={AXIS_Y} stroke="var(--border)" strokeWidth={1.5} />
          {[0, 0.25, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={x(t)} y1={AXIS_Y} x2={x(t)} y2={AXIS_Y + 5} stroke="var(--border)" strokeWidth={1} />
              <text x={x(t)} y={AXIS_Y + 18} textAnchor="middle" fontSize={10} fill="var(--muted-foreground)">
                {t.toFixed(2)}
              </text>
            </g>
          ))}
          <text x={AX0 - 8} y={AXIS_Y + 4} textAnchor="end" fontSize={10} fill="var(--muted-foreground)">
            p
          </text>

          {/* the six lines */}
          {LINES.map((l) => {
            const cy = AXIS_Y - 12 - (lane.get(l.n) ?? 0) * 22
            const yes = l.p >= 0.5
            return (
              <g key={l.n}>
                <line
                  x1={x(l.p)}
                  y1={cy + 9}
                  x2={x(l.p)}
                  y2={AXIS_Y}
                  stroke={yes ? POS : NEG}
                  strokeWidth={1}
                  strokeOpacity={0.5}
                />
                <circle
                  cx={x(l.p)}
                  cy={cy}
                  r={9}
                  fill="var(--background)"
                  stroke={yes ? POS : NEG}
                  strokeWidth={1.5}
                  filter="url(#sbm-soft)"
                />
                <text
                  x={x(l.p)}
                  y={cy + 3.5}
                  textAnchor="middle"
                  fontSize={10}
                  fill={yes ? POS : NEG}
                >
                  {l.n}
                </text>
                <text
                  x={x(l.p)}
                  y={AXIS_Y + 32}
                  textAnchor="middle"
                  fontSize={10}
                  fill={yes ? POS : NEG}
                >
                  {l.p.toFixed(2)}
                </text>
              </g>
            )
          })}

          {/* verdicts */}
          <text x={AX0} y={H - 12} fontSize={11} fill={NEG}>
            four say no
          </text>
          <text x={AX1} y={H - 12} textAnchor="end" fontSize={11} fill={POS}>
            two say yes
          </text>
        </svg>
      </div>

      <ol className="my-0 list-none space-y-1 border-t px-4 py-3 pl-4 text-sm">
        {LINES.map((l) => (
          <li key={l.n} className="flex gap-3">
            <span className="w-4 shrink-0 font-mono text-xs text-muted-foreground">{l.n}</span>
            <span className="min-w-0">
              <span className="break-words">{l.text}</span>
              {l.gloss ? (
                <span className="text-muted-foreground"> — {l.gloss}</span>
              ) : null}
            </span>
            <span
              className="ml-auto shrink-0 font-mono text-xs"
              style={{ color: l.p >= 0.5 ? POS : NEG }}
            >
              {l.p.toFixed(2)}
            </span>
          </li>
        ))}
      </ol>

      <div className="border-t px-4 py-3 text-sm">
        <p className="my-0 font-mono text-xs text-muted-foreground">
          the pair the README uses for AND — lines 7 and 8 of the same file
        </p>
        <ul className="mt-2 mb-0 list-none space-y-1 pl-0">
          <li className="flex gap-3">
            <span className="min-w-0 break-words">
              カスタマー<span className="text-muted-foreground">サポート担当者が</span>
              <span style={{ color: ACCENT }}>怒って電話を切った</span>
              <span className="text-muted-foreground"> — the support agent hung up angrily</span>
            </span>
            <span className="ml-auto shrink-0 font-mono text-xs" style={{ color: NEG }}>
              0.05
            </span>
          </li>
          <li className="flex gap-3">
            <span className="min-w-0 break-words">
              <span className="text-muted-foreground">顧客が</span>
              <span style={{ color: ACCENT }}>怒って電話を切った</span>
              <span className="text-muted-foreground"> — the customer hung up angrily</span>
            </span>
            <span className="ml-auto shrink-0 font-mono text-xs" style={{ color: POS }}>
              matched
            </span>
          </li>
        </ul>
        <p className="mt-2 mb-0 text-xs text-muted-foreground">
          Nine of the second line&rsquo;s twelve characters are the tinted suffix, which both lines
          share verbatim; only the subject noun differs. That is the easiest possible case for
          &ldquo;an embedding cannot tell these apart&rdquo; and the hardest for a bag of words. The
          0.05 is the README&rsquo;s; the second line&rsquo;s probability is not published, only the
          fact that it matched.
        </p>
      </div>
    </figure>
  )
}
