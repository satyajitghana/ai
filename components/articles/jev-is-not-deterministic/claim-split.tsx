// The article in one picture: one complaint, three claims, three experiments.
//
// The point of the drawing is the middle band. Each claim needs a DIFFERENT
// arm of a benchmark to settle it — reorder the array, or repeat the request
// byte for byte, or just read what the vendor wrote. Running the wrong arm
// gets you a number that mixes two effects, which is exactly what the one
// published figure for this (13%) turns out to be.
//
// Geometry: three 280-wide columns at x = 20, 320, 620 inside a 920 viewBox,
// with 20px gutters. Every row of every column is laid out off the same
// baseline table (ROWS) so the three columns line up horizontally and a
// reader can scan across a band instead of down a column.
//
// Server-rendered SVG, zero JS, integer coordinates only — no Math.* anywhere,
// so nothing can serialize differently on the server and in the browser.
const W = 920
const H = 612

const COL_X = [20, 320, 620]
const CW = 280

// Shared baselines, so the three columns read as three rows of a table.
const Y_HEAD = 168 // claim header box top
const Y_ASSERT = 232 // "what it asserts" box top
const Y_EXP = 330 // "the experiment" box top
const Y_FOUND = 428 // "what it found" box top
const Y_VERDICT = 540 // verdict chip top

type Column = {
  n: string
  title: string[]
  assert: string[]
  experiment: string[]
  found: string[]
  verdict: string
  tone: "true" | "reading"
}

const COLUMNS: Column[] = [
  {
    n: "1",
    title: ["order changes the output"],
    assert: [
      "the same question with the option",
      "list permuted returns different",
      "probabilities, and sometimes a",
      "different answer",
    ],
    experiment: [
      "REORDER ARM",
      "send each item twice, second time",
      "with the array permuted; compare",
      "the vectors option by option",
    ],
    found: [
      "hosted Jev · 100 items × 3 perms",
      "answer changed on 12",
      "median |Δp| 0.04 · max 0.69",
      "",
      "openjev · 36 reversal pairs",
      "answer changed on 10 of 36",
      "slot A worth +1.71 logits",
    ],
    verdict: "TRUE — measured twice",
    tone: "true",
  },
  {
    n: "2",
    title: ["identical input, different", "output"],
    assert: [
      "the same request bytes, sent",
      "again, return a different",
      "probability vector — with nothing",
      "changed on the caller's side",
    ],
    experiment: [
      "REPEAT ARM",
      "send the same body K times, pin",
      "the version, and check the model",
      "field the response echoes back",
    ],
    found: [
      "hosted Jev · 1,300 items × 3",
      "67.2% differ on some repeat",
      "answer changed on 3.3%",
      "",
      "every response said jev-1.13.0",
      "no seed or temperature exists",
      "to have been set differently",
    ],
    verdict: "TRUE — cause unidentified",
    tone: "true",
  },
  {
    n: "3",
    title: ["…so the no-hallucination", "claim is suspect"],
    assert: [
      "if the answer moves with the",
      "arrangement, then a guarantee",
      "about the answer cannot mean",
      "very much",
    ],
    experiment: [
      "NO EXPERIMENT — READ IT",
      "the guarantee is a closure",
      "property of the output set, not",
      "a statement about correctness",
    ],
    found: [
      "the answer is always an element",
      "of the list you sent: permuting",
      "the list permutes the set, and",
      "the answer is still in it",
      "",
      "what order sensitivity does kill",
      "is a reading nobody published",
    ],
    verdict: "MISREAD — the guarantee holds",
    tone: "reading",
  },
]

function Box({
  x,
  y,
  w,
  h,
  tone = "plain",
}: {
  x: number
  y: number
  w: number
  h: number
  tone?: "plain" | "root" | "muted" | "found"
}) {
  const cls =
    tone === "root"
      ? "fill-foreground/[0.06] stroke-foreground/50"
      : tone === "muted"
        ? "fill-muted/40 stroke-border"
        : tone === "found"
          ? "fill-foreground/[0.04] stroke-foreground/40"
          : "fill-background stroke-border"
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={5}
      className={cls}
      strokeWidth={tone === "root" || tone === "found" ? 1.5 : 1}
    />
  )
}

function Lines({
  x,
  y,
  lines,
  strong,
}: {
  x: number
  y: number
  lines: string[]
  strong?: number
}) {
  return (
    <g className="font-mono" style={{ fontSize: 10.5 }}>
      {lines.map((line, i) => (
        <text
          key={`${i}-${line}`}
          x={x}
          y={y + i * 14}
          className={
            strong !== undefined && i === strong
              ? "fill-foreground"
              : "fill-muted-foreground"
          }
        >
          {line}
        </text>
      ))}
    </g>
  )
}

export function ClaimSplit() {
  return (
    <figure className="my-8 overflow-x-auto rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        one complaint · three claims · three different experiments
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full min-w-[780px]"
        role="img"
        aria-label="A diagram splitting one complaint into three claims. At the top, a quoted complaint: JEV does not run deterministically, the same prompts give different probabilities, the order of the choices drastically changes the output probabilities, and the writer is confused by the no-hallucination claim. Three columns branch from it. Column one, order changes the output: it asserts that permuting the option list returns different probabilities and sometimes a different answer; the experiment is a reorder arm, sending each item twice with the array permuted; the finding is that on hosted Jev across a hundred items and three permutations the answer changed on twelve, with a median probability movement of 0.04 and a maximum of 0.69, and on the open model openjev ten of thirty-six reversal pairs flipped with the first slot worth plus 1.71 logits; verdict, true, measured twice. Column two, identical input and different output: it asserts that the same request bytes return a different probability vector; the experiment is a repeat arm, sending the same body several times with the version pinned and the model field checked on every response; the finding is that across thirteen hundred items sent three times each, 67.2 percent differed on some repeat and the answer changed on 3.3 percent, with every response reporting jev-1.13.0 and no seed or temperature parameter existing to have been set differently; verdict, true, with the cause unidentified. Column three, the no-hallucination claim: it asserts that a guarantee about the answer cannot mean much if the answer moves with the arrangement; there is no experiment, only reading, because the guarantee is a closure property of the output set rather than a statement about correctness; the finding is that the answer is always an element of the list the caller sent, so permuting the list permutes the set and the answer is still in it, and what order sensitivity does kill is a reading nobody published; verdict, misread, the guarantee holds. A band across the bottom states that the one published figure for order instability, thirteen percent, is the union of both effects: twelve items flip under permutation, five flip under repetition, four do both, and the union is thirteen."
      >
        {/* ---------- the complaint ---------- */}
        <Box x={20} y={14} w={880} h={84} tone="root" />
        <text
          x={36}
          y={34}
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          THE COMPLAINT, QUOTED WHOLE
        </text>
        <g className="fill-foreground font-mono" style={{ fontSize: 11 }}>
          <text x={36} y={54}>
            “JEV actually doesn’t even run deterministically. Exact same prompts give you
            different probabilities
          </text>
          <text x={36} y={70}>
            when you run it multiple times. The ORDER of the choices DRASTICALLY changes the
            output probs. I am
          </text>
          <text x={36} y={86}>
            more and more confused by their ‘no-hallucination’ claim.”
          </text>
        </g>

        {/* ---------- fan-out ---------- */}
        <g className="stroke-foreground/40" strokeWidth={1.5} fill="none">
          <line x1={460} y1={98} x2={460} y2={126} />
          <line x1={160} y1={126} x2={760} y2={126} />
          <line x1={160} y1={126} x2={160} y2={Y_HEAD} />
          <line x1={460} y1={126} x2={460} y2={Y_HEAD} />
          <line x1={760} y1={126} x2={760} y2={Y_HEAD} />
        </g>
        <text
          x={460}
          y={146}
          textAnchor="middle"
          className="fill-muted-foreground font-mono"
          style={{ fontSize: 10 }}
        >
          three assertions — not one grievance
        </text>

        {COLUMNS.map((col, i) => {
          const x = COL_X[i]
          const tx = x + 12
          return (
            <g key={col.n}>
              {/* header */}
              <Box x={x} y={Y_HEAD} w={CW} h={52} tone="muted" />
              <text
                x={tx}
                y={Y_HEAD + 18}
                className="fill-foreground font-mono"
                style={{ fontSize: 11 }}
              >
                CLAIM {col.n} · {col.title[0]}
              </text>
              {col.title[1] ? (
                <text
                  x={tx}
                  y={Y_HEAD + 34}
                  className="fill-foreground font-mono"
                  style={{ fontSize: 11 }}
                >
                  {col.title[1]}
                </text>
              ) : null}

              {/* what it asserts */}
              <Box x={x} y={Y_ASSERT} w={CW} h={86} />
              <text
                x={tx}
                y={Y_ASSERT + 16}
                className="fill-muted-foreground font-mono"
                style={{ fontSize: 9.5 }}
              >
                WHAT IT ASSERTS
              </text>
              <Lines x={tx} y={Y_ASSERT + 34} lines={col.assert} />

              {/* the experiment */}
              <Box x={x} y={Y_EXP} w={CW} h={86} />
              <Lines x={tx} y={Y_EXP + 20} lines={col.experiment} strong={0} />

              {/* what it found */}
              <Box x={x} y={Y_FOUND} w={CW} h={100} tone="found" />
              <Lines x={tx} y={Y_FOUND + 20} lines={col.found} />

              {/* verdict */}
              <rect
                x={x}
                y={Y_VERDICT}
                width={CW}
                height={24}
                rx={3}
                className={
                  col.tone === "true"
                    ? "fill-foreground/[0.08] stroke-foreground/50"
                    : "fill-muted/40 stroke-border"
                }
                strokeWidth={1.25}
              />
              <text
                x={x + CW / 2}
                y={Y_VERDICT + 16}
                textAnchor="middle"
                className="fill-foreground font-mono"
                style={{ fontSize: 10.5 }}
              >
                {col.verdict}
              </text>
            </g>
          )
        })}

        {/* ---------- the band that ties 1 and 2 together ---------- */}
        <line
          x1={20}
          y1={578}
          x2={900}
          y2={578}
          className="stroke-border"
          strokeWidth={1}
          strokeDasharray="5 5"
        />
        <g className="font-mono" style={{ fontSize: 10.5 }}>
          <text x={20} y={596} className="fill-foreground">
            the one published number for this — 13% — is the union of claims 1 and 2:
          </text>
          <text x={556} y={596} className="fill-muted-foreground">
            12 flip on order · 5 on repetition · 4 on both · union 13
          </text>
        </g>
      </svg>
      <figcaption className="border-t px-3 py-2 font-mono text-xs leading-5 text-muted-foreground">
        Two of the three are true and one is a misreading, but the thing worth taking away is
        the middle band: the reorder arm and the repeat arm are different experiments, and a
        benchmark that runs only one of them reports a number that contains both.
      </figcaption>
    </figure>
  )
}
