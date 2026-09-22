// Each published claim, sorted by what kind of evidence stands behind it.
// Server-rendered, zero JS.
//
// The reason to build this rather than write a paragraph: the announcement
// mixes four evidence classes in one breath -- a code change anyone can read, a
// point-in-time observation of a remote system, a negative finding from a
// bounded review, and an unfalsifiable statement about the past. All four are
// reasonable things for a vendor to publish. They are not interchangeable, and
// which one you are reading decides what you are entitled to conclude.
//
// Nothing here disputes any of the claims. The right-hand column is only "what
// would this still be true of", which is the question a reader has to answer
// for themselves and which no assessment summary answers for them.

type Klass = "artifact" | "observation" | "negative" | "assertion"

const KLASS: Record<Klass, { label: string; color: string; gloss: string }> = {
  artifact: {
    label: "checkable artefact",
    color: "oklch(0.55 0.15 155)",
    gloss: "you can verify it yourself, today, from published material",
  },
  observation: {
    label: "point-in-time observation",
    color: "oklch(0.62 0.13 95)",
    gloss: "true of the system when it was looked at; says nothing about before",
  },
  negative: {
    label: "negative finding",
    color: "oklch(0.60 0.14 60)",
    gloss: "nothing was found; the scope of the search bounds the claim",
  },
  assertion: {
    label: "company statement",
    color: "oklch(0.60 0.02 250)",
    gloss: "a claim about internal state, not independently checkable",
  },
}

const CLAIMS: { claim: string; source: string; klass: Klass; still: string }[] = [
  {
    claim: "Remediation is complete in client v3.14.0; the Repo Wiki feature is removed and the local-snapshot generation and upload workflow disabled.",
    source: "ZCode statement · both assessments",
    klass: "artifact",
    still: "The published tree is v3.14.0 and contains no such path. Verifiable in a clone.",
  },
  {
    claim: "The zcode-prod object-storage bucket is in a zero-data state.",
    source: "CAICT",
    klass: "observation",
    still: "True of a bucket that was full yesterday and emptied this morning. A zero-data state is a fact about now.",
  },
  {
    claim: "All data objects and the bucket itself have been deleted.",
    source: "NSFOCUS",
    klass: "observation",
    still: "Deletion is the strongest form of this claim and still describes only that bucket, at that moment.",
  },
  {
    claim: "No functional path capable of triggering local snapshot generation or transmitting local files externally was identified.",
    source: "NSFOCUS",
    klass: "negative",
    still: "A bounded review of a stated scope at a stated time. 'Not identified' is the honest phrasing and it is not 'does not exist'.",
  },
  {
    claim: "The referenced code data is not retained.",
    source: "ZCode statement",
    klass: "assertion",
    still: "A statement about what the company holds. No external party can confirm an absence inside someone else's systems.",
  },
  {
    claim: "The data was never used for model training.",
    source: "ZCode statement",
    klass: "assertion",
    still: "A statement about a process that leaves no external trace. It can be believed; it cannot be checked.",
  },
]

export function EvidenceLedger() {
  return (
    <figure className="my-8 overflow-hidden rounded-xl border bg-gradient-to-b from-muted/15 to-transparent">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-2.5">
        <span className="font-mono text-xs text-muted-foreground">
          six published claims, four kinds of evidence
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">
          none of these is disputed here
        </span>
      </div>

      <div className="divide-y">
        {CLAIMS.map((c) => {
          const k = KLASS[c.klass]
          return (
            <div key={c.claim} className="p-3 sm:px-4">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="rounded-sm px-1.5 py-0.5 font-mono text-[9px] tracking-wide uppercase"
                  style={{ background: `color-mix(in oklch, ${k.color} 18%, transparent)`, color: k.color }}
                >
                  {k.label}
                </span>
                <span className="font-mono text-[10px] text-muted-foreground">{c.source}</span>
              </div>
              <p className="mt-1.5 mb-0 text-sm leading-6 text-foreground">{c.claim}</p>
              <p className="mt-1 mb-0 font-mono text-[11px] leading-relaxed text-muted-foreground">
                {c.still}
              </p>
            </div>
          )
        })}
      </div>

      <figcaption className="border-t px-4 py-2 font-mono text-[11px] leading-relaxed text-muted-foreground">
        {Object.values(KLASS)
          .map((k) => `${k.label}: ${k.gloss}`)
          .join(" · ")}
      </figcaption>
    </figure>
  )
}
