"use client"

// The ten abridged reasoning summaries in reasoning_traces/, measured from the
// PDFs with pdftotext. "sections" is the number of numbered sections; "audit"
// counts the sections whose own title is about auditing, stress-testing,
// checking or repairing a candidate (my reading of the titles, so treat it as
// approximate); "excerpts" counts the VERBATIM EXCERPT boxes, the only places
// the model's own words appear; "words" is the body before the reference list.
//
// Dual-native: the prose section on the reasoning summaries quotes the same
// numbers and the excerpts that matter.

import { useState } from "react"

type Trace = {
  id: string
  fam: string
  title: string
  sections: number
  audit: number
  excerpts: number
  words: number
  refs: number
  arc: string
}

const TRACES: Trace[] = [
  { id: "pi", fam: "017", title: "Irrationality exponent of π", sections: 45, audit: 12, excerpts: 69, words: 16314, refs: 23, arc: "Aims for μ(π) < 5/2 (enough for Flint–Hills), reaches 62/25 only after some thirty sections of failed routes, then notices its own inequality μ > 1 + 1/√a tends to 2 as a → 1. Sections 36–37 are titled 'unexpectedly strong exponent'. Part II restarts from the 62/25 technique and claims exactly 2." },
  { id: "mahler", fam: "087", title: "Mahler conjectures", sections: 49, audit: 5, excerpts: 52, words: 20250, refs: 67, arc: "The longest summary. Most sections are failed reductions (transport, Gaussian regularization, toric residues) before a conditional cone reduction and the error-estimate checks." },
  { id: "ap", fam: "159", title: "Quasipolynomial AP bounds", sections: 39, audit: 7, excerpts: 54, words: 18287, refs: 55, arc: "Density-increment work: repeated attempts to control dimension and width, a renewed circularity concern in section 26, then a stronger quantitative target after the reciprocal-sum proof closes." },
  { id: "kap", fam: "197", title: "Kaplansky in char 2", sections: 23, audit: 10, excerpts: 25, words: 10420, refs: 42, arc: "Eleven sections of construction, then ten consecutive sections (13–22) that audit and stress-test one candidate counterexample, before turning it into a cellular automaton." },
  { id: "sdp", fam: "102", title: "NP-hardness at the SDP threshold", sections: 12, audit: 0, excerpts: 10, words: 6266, refs: 56, arc: "From BasicSDP projection leakage to a decoder gap, then assembling a proposed reduction. No section is titled as an audit." },
  { id: "fgf", fam: "287", title: "Free group factors", sections: 7, audit: 0, excerpts: 8, words: 3815, refs: 54, arc: "Six sections of failed invariants (entropy, L²-homology, rigidity, cost) and one constructive turn: a missing-root construction, then a trace-preserving flow that absorbs a free generator. It ends with a 'proposed affirmative resolution'." },
  { id: "chowla", fam: "007", title: "Two-point Chowla", sections: 5, audit: 2, excerpts: 4, words: 2200, refs: 17, arc: "Single-scale obstruction, weighted divisor graphs, then auditing the graph and closing the quantitative argument." },
  { id: "heis", fam: "271", title: "Heisenberg ferromagnet", sections: 6, audit: 3, excerpts: 2, words: 2393, refs: 9, arc: "A simultaneous pin test, routing and stopping rules, then testing the construction against traps and correlations." },
  { id: "vm", fam: "362", title: "Relativistic Vlasov–Maxwell", sections: 5, audit: 4, excerpts: 1, words: 1922, refs: 6, arc: "One idea (signed impulses and angular event counts) and four sections repairing and stress-testing it." },
  { id: "mp", fam: "221", title: "Mézard–Parisi formula", sections: 3, audit: 1, excerpts: 2, words: 1593, refs: 5, arc: "The shortest summary: marked hierarchies, shifting branching depths, checking the identities." },
]

export function TraceAnatomy() {
  const [sel, setSel] = useState("pi")
  const t = TRACES.find((x) => x.id === sel) ?? TRACES[0]
  const maxS = 49

  return (
    <div className="my-8 rounded-lg border bg-muted/20 p-4">
      <div className="font-mono text-xs text-muted-foreground">
        the ten reasoning summaries &middot; bar = sections, dark = audit/stress-test sections
      </div>
      <ul className="mt-3 space-y-1">
        {TRACES.map((x) => (
          <li key={x.id}>
            <button
              type="button"
              aria-pressed={x.id === sel}
              onClick={() => setSel(x.id)}
              className={`grid w-full grid-cols-[minmax(0,10rem)_1fr_3.5rem] items-center gap-2 rounded px-1 py-0.5 text-left ${
                x.id === sel ? "bg-background ring-1 ring-foreground/30" : "hover:bg-background/60"
              }`}
            >
              <span className="truncate text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">{x.fam} </span>
                {x.title}
              </span>
              <span className="relative h-3 rounded-sm bg-muted" aria-hidden>
                <span
                  className="absolute inset-y-0 left-0 rounded-sm bg-blue-500/30"
                  style={{ width: `${(x.sections / maxS) * 100}%` }}
                />
                <span
                  className="absolute inset-y-0 rounded-sm bg-orange-500/80"
                  style={{
                    left: `${((x.sections - x.audit) / maxS) * 100}%`,
                    width: `${(x.audit / maxS) * 100}%`,
                  }}
                />
              </span>
              <span className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
                {x.audit}/{x.sections}
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-3 rounded-md border bg-background/60 p-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-sm font-semibold">{t.title}</span>
          <span className="font-mono text-[11px] text-muted-foreground">
            {t.words.toLocaleString("en-US")} words &middot; {t.excerpts} verbatim excerpts &middot; {t.refs} refs
          </span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t.arc}</p>
      </div>
      <p className="mt-2 text-[11px] leading-4 text-muted-foreground">
        Audit sections are drawn at the end of each bar for comparison; in the PDFs they are mostly,
        but not always, at the end.
      </p>
    </div>
  )
}
