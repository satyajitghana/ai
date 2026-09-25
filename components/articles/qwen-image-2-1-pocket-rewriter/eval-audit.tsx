import { cn } from "@/lib/utils"

// The pocket rewriters' image-level evaluation, re-read from its own files.
//
// Source: eval/score_4arm.json in ML-Intern-lab/Qwen-Image-2.1-rewriter-distill
// at revision 48e631c — 40 requests, four arms each (raw request, 9B teacher,
// 0.8B student, 2B student), rendered by Qwen-Image-2.1 at ~1 megapixel and
// 40 steps.
//
// Panel 1, the pairwise judge. `judge.units` holds all 240 comparisons, each
// with the arm that sat in the A slot, the arm in the B slot, and the winner.
// In 240 of 240 the winner is the A slot. The judge (Qwen/Qwen3.5-9B, greedy,
// 256 new tokens) answers in its reasoning voice — "The user wants me to choose
// between Image A and Image B…" — and code/score_images.py parses the verdict
// as the first standalone A or B in the upper-cased text. "Image A" in the
// restatement matches, and so does the English article "a". The plan gives each
// request's six A slots out 2/2/1/1 over the four arms, so per-arm "wins" are
// per-arm A-slot counts: 62, 62, 60, 56, which is the published table.
//
// Panel 2, the OCR arm. `ocr.by_request` holds, for 27 requests, the quoted
// spans the request asked for (29 in all, 112 reference words) and per-arm word
// matches from PaddleOCR-VL-1.6. Each span is scored per arm as matched/ref
// words; two arms are compared span by span as win / loss / tie. The p-value is
// an exact two-sided sign test on the non-tied spans, computed below with
// integer binomial coefficients. Spans within a request share an image and
// every arm renders from its own seed, so this is the generous reading.
//
// Server-rendered, zero JS. Arithmetic: integer + - * and one division per
// p-value; no transcendental functions, so no lib/dmath wrapper is needed.

type SlotRow = { arm: string; label: string; aSlots: number; wins: number }

const SLOTS: SlotRow[] = [
  { arm: "raw", label: "no rewriter", aSlots: 62, wins: 62 },
  { arm: "student2b", label: "Pocket-2B", aSlots: 62, wins: 62 },
  { arm: "student08", label: "Pocket-0.8B", aSlots: 60, wins: 60 },
  { arm: "teacher", label: "9B teacher", aSlots: 56, wins: 56 },
]

type Pair = { a: string; b: string; w: number; l: number; t: number }

const PAIRS: Pair[] = [
  { a: "9B teacher", b: "no rewriter", w: 11, l: 2, t: 16 },
  { a: "Pocket-0.8B", b: "no rewriter", w: 8, l: 7, t: 14 },
  { a: "Pocket-2B", b: "no rewriter", w: 6, l: 3, t: 20 },
  { a: "9B teacher", b: "Pocket-0.8B", w: 12, l: 3, t: 14 },
  { a: "9B teacher", b: "Pocket-2B", w: 11, l: 3, t: 15 },
]

const WORDS = [
  { label: "no rewriter", matched: 52 },
  { label: "9B teacher", matched: 89 },
  { label: "Pocket-0.8B", matched: 64 },
  { label: "Pocket-2B", matched: 61 },
]
const REF_WORDS = 112

function choose(n: number, k: number): number {
  let r = 1
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i
  return Math.round(r)
}

/** Exact two-sided sign test on w wins and l losses (ties dropped). */
function signTest(w: number, l: number): number {
  const n = w + l
  if (n === 0) return 1
  const k = Math.max(w, l)
  let tail = 0
  for (let i = k; i <= n; i++) tail += choose(n, i)
  // 1 << n is exact for n <= 30; every n here is 15 or less
  return Math.min(1, (2 * tail) / (1 << n))
}

const fmtP = (p: number) => (p >= 0.995 ? "1.00" : p.toFixed(3))

export function EvalAudit() {
  const total = SLOTS.reduce((s, r) => s + r.wins, 0)
  const maxSlots = Math.max(...SLOTS.map((r) => r.aSlots))

  return (
    <figure
      className="my-8 overflow-hidden rounded-md border"
      data-eval-audit={total}
      aria-label="Re-reading the pocket rewriters' image evaluation: the pairwise judge's wins equal each arm's A-slot count, and the OCR arm separates only the teacher from no rewriter"
    >
      <div className="border-b px-4 py-2 font-mono text-xs text-muted-foreground">
        eval/score_4arm.json — 40 requests × 4 arms, re-read
      </div>

      <div className="border-b px-4 py-4">
        <p className="my-0 font-mono text-xs">
          1 · pairwise judge{" "}
          <span className="text-muted-foreground">
            — {total} verdicts, and the seat each winner sat in
          </span>
        </p>
        <div className="mt-3 space-y-2">
          {SLOTS.map((r) => (
            <div key={r.arm} className="space-y-1">
              <div className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-x-3 font-mono text-xs sm:grid-cols-[8rem_1fr_3.5rem]">
                <span className="truncate text-right">{r.label}</span>
                <div className="relative h-3 rounded-sm bg-muted/50">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm bg-foreground/80"
                    style={{ width: `${(r.wins * 100) / maxSlots}%` }}
                  />
                </div>
                <span className="text-right tabular-nums">{r.wins} won</span>
              </div>
              <div className="grid grid-cols-[6.5rem_1fr_3rem] items-center gap-x-3 font-mono text-xs sm:grid-cols-[8rem_1fr_3.5rem]">
                <span />
                <div className="relative h-3 rounded-sm bg-muted/50">
                  <div
                    className="absolute inset-y-0 left-0 rounded-sm border border-dashed border-foreground/50"
                    style={{ width: `${(r.aSlots * 100) / maxSlots}%` }}
                  />
                </div>
                <span className="text-right tabular-nums text-muted-foreground">
                  {r.aSlots} in A
                </span>
              </div>
            </div>
          ))}
        </div>
        <p className="mt-3 mb-0 text-xs text-muted-foreground">
          The winner sat in the A slot in{" "}
          <span className="font-mono text-foreground tabular-nums">
            {total} of {total}
          </span>{" "}
          comparisons. The parser takes the first standalone{" "}
          <span className="font-mono text-foreground">A</span> or{" "}
          <span className="font-mono text-foreground">B</span> in the
          judge&rsquo;s reply, after upper-casing it. The reply opens by
          restating the task, which names Image A before Image B, and English
          prose uses the article{" "}
          <span className="font-mono text-foreground">a</span> constantly and a
          standalone{" "}
          <span className="font-mono text-foreground">b</span> almost never. The
          column is a seating plan, not a preference.
        </p>
      </div>

      <div className="border-b px-4 py-4">
        <p className="my-0 font-mono text-xs">
          2 · OCR on the rendered text{" "}
          <span className="text-muted-foreground">
            — {REF_WORDS} words the requests quoted, across 29 spans
          </span>
        </p>
        <div className="mt-3 space-y-1.5">
          {WORDS.map((r) => (
            <div
              key={r.label}
              className="grid grid-cols-[6.5rem_1fr_4rem] items-center gap-x-3 font-mono text-xs sm:grid-cols-[8rem_1fr_5rem]"
            >
              <span className="truncate text-right">{r.label}</span>
              <div className="relative h-4 rounded-sm bg-muted/50">
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-sm",
                    r.label === "no rewriter" ? "bg-foreground/30" : "bg-foreground/70"
                  )}
                  style={{ width: `${(r.matched * 100) / REF_WORDS}%` }}
                />
              </div>
              <span className="text-right tabular-nums">
                {r.matched}/{REF_WORDS}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 overflow-x-auto">
          <div className="grid min-w-[20rem] grid-cols-[1fr_auto_auto_auto_auto] gap-x-3 gap-y-1 font-mono text-xs tabular-nums sm:gap-x-5">
            <span className="text-muted-foreground">span by span</span>
            <span className="text-right text-muted-foreground">better</span>
            <span className="text-right text-muted-foreground">worse</span>
            <span className="text-right text-muted-foreground">tied</span>
            <span className="text-right text-muted-foreground">p</span>
            {PAIRS.map((p) => {
              const pv = signTest(p.w, p.l)
              return (
                <div key={`${p.a}-${p.b}`} className="contents">
                  <span className="truncate">
                    {p.a} <span className="text-muted-foreground">vs</span> {p.b}
                  </span>
                  <span className="text-right">{p.w}</span>
                  <span className="text-right">{p.l}</span>
                  <span className="text-right text-muted-foreground">{p.t}</span>
                  <span
                    className={cn(
                      "text-right",
                      pv < 0.05 ? "font-medium text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {fmtP(pv)}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
        <p className="mt-3 mb-0 text-xs text-muted-foreground">
          Exact two-sided sign test on the spans that differ. The teacher beats
          no rewriter 11 spans to 2. Neither student can be told apart from no
          rewriter at all on this sample; the 0.8B&rsquo;s record against it is
          8 to 7.
        </p>
      </div>

      <p className="my-0 px-4 py-3 text-xs text-muted-foreground">
        Both panels are computed from the dataset&rsquo;s own published scores;
        I re-ran no model. Every arm of a request was rendered from its own seed
        and at the ratio its rewriter chose, so the arms differ in noise and
        framing as well as in prompt.
      </p>
    </figure>
  )
}
