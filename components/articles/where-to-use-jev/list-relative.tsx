// Gate 4, measured. The probability a per-option scorer reports is a softmax
// over the options the CALLER happened to send, so it is a statement about the
// list as much as about the evidence.
//
// Three quantities from the same four runs. The raw entailment logit of the
// original option barely moves — it cannot, because each option is encoded in
// its own row and nothing another option does can reach it. The model's belief
// in the CONCEPT rises, because the paraphrases are also right. And the number
// a threshold reads falls through the cutoff, on evidence that never changed.
//
// Measured on 19 September 2026: DeBERTa-v3-xsmall NLI q8 through
// transformers.js on WASM, adding three paraphrases of the correct option one
// at a time. Numbers are literals from the committed dataset — no transcendental
// arithmetic here, so nothing can disagree between Node and the browser.

const PASS = "oklch(0.60 0.15 255)"
const STOP = "oklch(0.58 0.20 25)"

const RUNS = [
  { n: 5, added: "the list as written", logit: 2.2932, p: 0.6193, concept: 0.6193, flipped: false },
  { n: 6, added: "+ 1 paraphrase", logit: 2.1202, p: 0.4824, concept: 0.5889, flipped: false },
  { n: 7, added: "+ 2 paraphrases", logit: 2.031, p: 0.2647, concept: 0.7619, flipped: true },
  { n: 8, added: "+ 3 paraphrases", logit: 2.1844, p: 0.2151, concept: 0.8211, flipped: true },
]

const XS = [150, 333, 517, 700]

const r2 = (v: number) => Math.round(v * 100) / 100
const yP = (p: number) => r2(246 - 200 * p)
const yL = (l: number) => r2(300 - ((l - 2) / 0.3) * 28)

export function ListRelative() {
  const W = 860
  const H = 372

  const pathFor = (key: "p" | "concept") =>
    RUNS.map((r, i) => `${i === 0 ? "M" : "L"} ${XS[i]} ${yP(r[key])}`).join(" ")

  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        same evidence, same model, same correct answer — three synonyms added to the dropdown
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[760px]"
        role="img"
        aria-label="A plot of four runs in which paraphrases of the correct option are added to a five-option list one at a time. The probability reported for the original correct option falls from 0.619 at five options to 0.482, 0.265 and 0.215 at eight, crossing a dashed 0.5 threshold between the first and second run, so a policy that acts above 0.5 and escalates below it acts on the first list and escalates on the second. The model's belief in the concept, summing every phrasing of the same answer, rises the other way, from 0.619 to 0.589, 0.762 and 0.821. A strip underneath shows the raw entailment logit of the original option at 2.29, 2.12, 2.03 and 2.18 on an exaggerated scale from 2.0 to 2.3, effectively flat: the belief did not move, the softmax denominator did. From the third run onward the argmax is a paraphrase rather than the original option."
      >
        {/* act / escalate bands */}
        <rect x={110} y={46} width={630} height={100} fill={PASS} fillOpacity={0.07} />
        <rect x={110} y={146} width={630} height={100} fill={STOP} fillOpacity={0.07} />
        <text x={748} y={92} className="font-mono" fill={PASS} style={{ fontSize: 10 }}>
          acts on its own
        </text>
        <text x={748} y={105} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          p ≥ 0.5
        </text>
        <text x={748} y={196} className="font-mono" fill={STOP} style={{ fontSize: 10 }}>
          escalates
        </text>
        <text x={748} y={209} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          to a person
        </text>

        {/* axes */}
        {[0, 0.25, 0.5, 0.75, 1].map((g) => (
          <g key={g}>
            <line
              x1={110}
              y1={yP(g)}
              x2={740}
              y2={yP(g)}
              className="stroke-border"
              strokeWidth={1}
              strokeDasharray={g === 0.5 ? "5 4" : "2 6"}
            />
            <text x={104} y={yP(g) + 3.5} textAnchor="end" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {g.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={110} y={36} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          probability returned for the option
        </text>

        {/* the two series */}
        <path d={pathFor("concept")} fill="none" stroke={PASS} strokeWidth={2} strokeDasharray="6 3" />
        <path d={pathFor("p")} fill="none" stroke={STOP} strokeWidth={2.5} />

        {RUNS.map((r, i) => (
          <g key={r.n}>
            <circle cx={XS[i]} cy={yP(r.concept)} r={4} fill="var(--background)" stroke={PASS} strokeWidth={2} />
            <text x={XS[i]} y={yP(r.concept) - 11} textAnchor="middle" className="font-mono" fill={PASS} style={{ fontSize: 10 }}>
              {r.concept.toFixed(3)}
            </text>
            <circle cx={XS[i]} cy={yP(r.p)} r={4.5} fill="var(--background)" stroke={STOP} strokeWidth={2.5} />
            <text x={XS[i]} y={yP(r.p) + 17} textAnchor="middle" className="font-mono" fill={STOP} style={{ fontSize: 10 }}>
              {r.p.toFixed(3)}
            </text>

            {/* x labels */}
            <text x={XS[i]} y={264} textAnchor="middle" className="fill-foreground font-mono" style={{ fontSize: 10 }}>
              {r.n} options
            </text>
            <text x={XS[i]} y={276} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {r.added}
            </text>
            {r.flipped ? (
              <text x={XS[i]} y={334} textAnchor="middle" className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
                argmax is now a paraphrase
              </text>
            ) : null}
          </g>
        ))}

        {/* series legend */}
        <line x1={150} y1={58} x2={176} y2={58} stroke={PASS} strokeWidth={2} strokeDasharray="6 3" />
        <text x={182} y={61.5} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          p(concept) — every phrasing of the right answer, summed
        </text>
        <line x1={150} y1={226} x2={176} y2={226} stroke={STOP} strokeWidth={2.5} />
        <text x={182} y={229.5} className="fill-foreground font-mono" style={{ fontSize: 10 }}>
          p(the original option) — the number your threshold reads
        </text>

        {/* logit strip */}
        <rect x={110} y={270} width={630} height={32} rx={4} className="fill-muted/40 stroke-border" strokeWidth={1} />
        <path
          d={RUNS.map((r, i) => `${i === 0 ? "M" : "L"} ${XS[i]} ${yL(r.logit)}`).join(" ")}
          fill="none"
          className="stroke-muted-foreground"
          strokeWidth={1.6}
        />
        {RUNS.map((r, i) => (
          <g key={`l-${r.n}`}>
            <circle cx={XS[i]} cy={yL(r.logit)} r={3} fill="var(--background)" className="stroke-muted-foreground" strokeWidth={1.6} />
            <text x={XS[i] + 8} y={yL(r.logit) + 3.5} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
              {r.logit.toFixed(2)}
            </text>
          </g>
        ))}
        <text x={116} y={283} className="fill-muted-foreground font-mono" style={{ fontSize: 9 }}>
          raw logit, scale 2.0–2.3
        </text>

        <text x={110} y={352} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          The belief is flat. The denominator grew. A 0.5 policy acts at five options and escalates at six, on identical evidence.
        </text>
        <text x={110} y={365} className="fill-muted-foreground font-mono" style={{ fontSize: 9.5 }}>
          Measured on a local per-option scorer — the architecture the hosted model is argued to share. Nobody has run it against the API.
        </text>
      </svg>
    </figure>
  )
}
