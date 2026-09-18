import { cn } from "@/lib/utils"

// The three question types every project in this article is built from —
// Choice, Score, Noul — as documented at docs.typesafe.ai/primitives and
// mirrored in both official SDKs (typesafe-sdk-js, typesafe-sdk-python).
// Server-rendered, zero JS: this is reference material, not something a
// reader drags.

const ACCENT = "oklch(0.72 0.15 195)"
const MUTED = "oklch(0.62 0.02 260)"

const PRIMITIVES = [
  {
    name: "Choice",
    asks: "which ONE of up to 255 labeled options",
    returns: "the winning label, a probability for EVERY option, one confidence",
    example: "department: billing / technical / account / other",
  },
  {
    name: "Score",
    asks: "where on this ordered rubric",
    returns: "a probability-weighted score that can land BETWEEN levels, plus per-level probabilities",
    example: "severity: Minor → Material → Critical",
  },
  {
    name: "Noul",
    asks: "the probability this statement is true",
    returns: "one number, 0 to 1 — not a boolean",
    example: "is_urgent: does this convey urgency?",
  },
] as const

export function ThreePrimitives() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border">
      <div className="border-b bg-muted/30 px-4 py-2.5 font-mono text-xs text-muted-foreground">
        every project below is built from exactly three question types
      </div>

      <div className="grid divide-y sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {PRIMITIVES.map((p) => (
          <div key={p.name} className="p-4">
            <div
              className="font-mono text-sm font-semibold"
              style={{ color: ACCENT }}
            >
              {p.name}
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">asks {p.asks}</p>
            <p className="mt-2 text-xs leading-5">returns {p.returns}</p>
            <p className="mt-2.5 rounded-md border bg-muted/20 px-2 py-1.5 font-mono text-[10px] leading-4 text-muted-foreground">
              {p.example}
            </p>
          </div>
        ))}
      </div>

      <div className="border-t p-4">
        <p className="mb-3 font-mono text-[11px] text-muted-foreground">
          0.5 means two different things depending which primitive returned it
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>Score, 3 levels</span>
              <span className="text-foreground">1.5</span>
            </div>
            <div className="relative h-3 rounded-sm bg-muted/40">
              <div className="absolute inset-y-0 left-0 w-1/2 rounded-l-sm bg-muted-foreground/25" />
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rotate-45 rounded-[2px]"
                style={{ left: "75%", background: ACCENT }}
              />
              {[0, 1, 2].map((t) => (
                <span
                  key={t}
                  className="absolute top-0 h-3 w-px bg-border"
                  style={{ left: `${(t / 2) * 100}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>Minor</span>
              <span>Material</span>
              <span>Critical</span>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              A real, in-between reading: the model{"’"}s distribution sits
              across Material and Critical, weighted toward the latter.
            </p>
          </div>
          <div>
            <div className="mb-1 flex justify-between font-mono text-[10px] text-muted-foreground">
              <span>Noul, 0 to 1</span>
              <span className="text-foreground">0.50</span>
            </div>
            <div className="relative h-3 rounded-sm bg-muted/40">
              <div
                className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rotate-45 rounded-[2px]"
                style={{ left: "50%", background: MUTED }}
              />
              <span className="absolute top-0 h-3 w-px bg-border" style={{ left: "50%" }} />
            </div>
            <div className="mt-1 flex justify-between font-mono text-[9px] text-muted-foreground">
              <span>false</span>
              <span className={cn("opacity-0")}>·</span>
              <span>true</span>
            </div>
            <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
              Not a medium answer. TypeSafe{"’"}s own docs: near 0.5 means the
              question is uncertain — the model does not know, it is not
              reporting something moderate.
            </p>
          </div>
        </div>
      </div>
    </figure>
  )
}
