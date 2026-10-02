"use client"

import { useState } from "react"

import { mlog10 } from "@/lib/dmath"
import { cn } from "@/lib/utils"

// Week three's entrants, grouped by what they actually are, with the caveat made
// structural: the `evidence` field says who ran the Jev comparison and on which
// split, because that is what decides whether a "beats Jev" number means
// anything. Everything here is from the research notes behind the article:
// parameter counts are safetensors header/metadata sums (measured), the readout
// family and option caps are read from each release's card, config or code (not
// run), and every benchmark number is the publisher's own, labelled so. All of
// it is also in the article prose; this grid is a reference, not the argument.

type Group = "model" | "serving" | "packaging" | "oddball"

const GROUP: Record<Group, { label: string; blurb: string }> = {
  model: {
    label: "new model",
    blurb: "a checkpoint or adapter trained for typed decisions",
  },
  serving: {
    label: "serving layer",
    blurb: "infrastructure that turns ordinary models into drop-in Jev endpoints",
  },
  packaging: {
    label: "packaging",
    blurb: "an existing decision model wrapped for local deployment",
  },
  oddball: {
    label: "oddball",
    blurb: "a tiny, task-specific decider — a decision model of a different flavour",
  },
}

// How strong is the "vs Jev" evidence? Encoded, not described, so the empty
// column is visible: nothing this week carries an independent or sealed number.
type Evidence = "ownHeldout" | "selfPublic" | "none" | "na"

const EVIDENCE: Record<Evidence, { label: string; tone: string }> = {
  selfPublic: {
    label: "self-run · JevBench public",
    tone: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  },
  ownHeldout: {
    label: "self-run · own held-out set",
    tone: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  },
  none: {
    label: "no JevBench number at all",
    tone: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
  },
  na: {
    label: "makes no beats-Jev claim",
    tone: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  },
}

type Entrant = {
  name: string
  who: string
  group: Group
  size: string
  modality: string
  readout: string
  cap: string
  jev: string
  evidence: Evidence
  calib: string
  license: string
}

const ENTRANTS: Entrant[] = [
  {
    name: "Intern-Decision",
    who: "Shanghai AI Lab",
    group: "model",
    size: "0.85B / 2.2B / 4.5B params",
    modality: "text + up to 8 images",
    readout: "symbol readout (A–Z, a–z, 0–9)",
    cap: "62 options, 16 questions",
    jev: "4B avg 90.02 vs Jev 88.74 across seven benches (self-run)",
    evidence: "selfPublic",
    calib: "4B ECE 0.065 vs Jev 0.095 (self-run)",
    license: "Apache-2.0",
  },
  {
    name: "JEMM",
    who: "MaestroYan",
    group: "model",
    size: "117M LoRA on Qwen3.8-27B",
    modality: "text + screenshot",
    readout: "letter readout (A–Z, 0–5)",
    cap: "32 options",
    jev: "wins its own held-out splits; JevBench public 198 vs 200 of 231 (−2)",
    evidence: "selfPublic",
    calib: "none published",
    license: "Apache-2.0",
  },
  {
    name: "Lumma-fev",
    who: "FrontiersMind",
    group: "model",
    size: "0.15B / 0.6B / 4B / 9B params",
    modality: "text",
    readout: "Kev-style pointer head",
    cap: "255 options",
    jev: "4B avg 0.90 vs Jev 0.75 on four tasks; Jev column copied from Laya's card",
    evidence: "ownHeldout",
    calib: "none published",
    license: "Apache-2.0",
  },
  {
    name: "clef / clef-flash",
    who: "Cloudflare",
    group: "model",
    size: "27.4B + 128M head / 9.4B + 122M head",
    modality: "text, JSON, images, video",
    readout: "trained joint schema head",
    cap: "schema-scored",
    jev: "wins most of its own Decision Index; Jev wins the reasoning benches; no JevBench",
    evidence: "none",
    calib: "ForecastBench Brier 13.9 vs Jev 17.4 (self-run)",
    license: "Apache-2.0",
  },
  {
    name: "SGLang /v1/decisions",
    who: "SGLang",
    group: "serving",
    size: "any served chat model",
    modality: "text (VLM in the demo)",
    readout: "label logprobs via /v1/score",
    cap: "26 (255 with two-letter labels)",
    jev: "/v1/systemone speaks the TypeSafe SDK; no accuracy claim in the docs",
    evidence: "na",
    calib: "label_mass only; docs say it is not calibrated",
    license: "Apache-2.0 (SGLang)",
  },
  {
    name: "Laya on Unsloth",
    who: "Unsloth",
    group: "packaging",
    size: "678–846 MB (the Laya model)",
    modality: "text",
    readout: "Laya, unchanged",
    cap: "Laya's",
    jev: "runs Laya locally behind a Jev-compatible API; no new numbers",
    evidence: "na",
    calib: "Laya's own",
    license: "Laya + Unsloth",
  },
  {
    name: "taiga-s1",
    who: "shhivv",
    group: "oddball",
    size: "1.2M params, from scratch",
    modality: "FreeCAD state (no text model)",
    readout: "per-command scorer",
    cap: "available commands",
    jev: "not a Jev competitor: a ~1 ms FreeCAD action decider",
    evidence: "na",
    calib: "held-out ECE 0.0272 (measured, in config)",
    license: "MIT",
  },
]

// Jev's own median single-request latency, as four of this week's publishers
// measured it. Same closed model, four very different numbers — the baseline is
// not a constant. Milliseconds (reported by each publisher).
const JEV_LATENCY: { who: string; ms: number }[] = [
  { who: "Intern-Decision (RTX 4090, local HF)", ms: 106.3 },
  { who: "Lumma-fev (card P50)", ms: 256 },
  { who: "JEMM (paired, short)", ms: 455 },
  { who: "clef (Decision Index median)", ms: 524.1 },
]

type Filter = "all" | Group

const FILTERS: Filter[] = ["all", "model", "serving", "packaging", "oddball"]

const FIELDS: { key: keyof Entrant; label: string }[] = [
  { key: "size", label: "size" },
  { key: "modality", label: "modality" },
  { key: "readout", label: "decides by" },
  { key: "cap", label: "option cap" },
  { key: "jev", label: "vs Jev" },
  { key: "calib", label: "calibration" },
  { key: "license", label: "license" },
]

// Log x-position (0–100%) for a latency on a 50–700 ms axis. mlog10 keeps the
// SSR and client strings bit-identical, so no hydration mismatch in the SVG.
const LO = 50
const HI = 700
function logX(ms: number): number {
  const lo = mlog10(LO)
  const hi = mlog10(HI)
  return ((mlog10(ms) - lo) / (hi - lo)) * 100
}

export function EntrantMatrix() {
  const [filter, setFilter] = useState<Filter>("all")
  const shown = ENTRANTS.filter((e) => filter === "all" || e.group === filter)

  return (
    <figure className="my-8 overflow-hidden rounded-md border">
      <div className="border-b px-3 py-2 font-mono text-xs text-muted-foreground">
        week three · seven entrants, and who ran the Jev comparison
      </div>

      {/* One model, four stopwatches: Jev's own reported latency spread. */}
      <div className="border-b p-3">
        <p className="mb-1 font-mono text-[11px] text-muted-foreground">
          Jev&apos;s median single-request latency, as four publishers measured it (ms, log axis)
        </p>
        <div className="relative mt-3 mb-5 h-11">
          <div className="absolute inset-x-0 top-5 h-px bg-border" />
          {[50, 100, 200, 500].map((t) => (
            <div
              key={t}
              className="absolute top-3 flex -translate-x-1/2 flex-col items-center"
              style={{ left: `${logX(t).toFixed(3)}%` }}
            >
              <span className="h-2 w-px bg-border" />
              <span className="mt-1 font-mono text-[9px] text-muted-foreground">{t}</span>
            </div>
          ))}
          {JEV_LATENCY.map((j, i) => (
            <div
              key={j.who}
              className="group absolute top-5 -translate-x-1/2 -translate-y-1/2"
              style={{ left: `${logX(j.ms).toFixed(3)}%` }}
            >
              <span className="block size-2.5 rounded-full border-2 border-foreground bg-background" />
              <span
                className={cn(
                  "absolute left-1/2 -translate-x-1/2 whitespace-nowrap font-mono text-[9px] font-semibold",
                  i % 2 === 0 ? "top-3" : "bottom-3"
                )}
              >
                {j.ms}
              </span>
            </div>
          ))}
        </div>
        <ul className="grid gap-x-4 gap-y-0.5 font-mono text-[10px] text-muted-foreground sm:grid-cols-2">
          {JEV_LATENCY.map((j) => (
            <li key={j.who}>
              {j.ms} ms — {j.who}
            </li>
          ))}
        </ul>
      </div>

      <div
        className="flex flex-wrap gap-2 border-b px-3 py-2"
        role="group"
        aria-label="Filter by what the entrant is"
      >
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              "cursor-pointer rounded-md border px-2.5 py-1 font-mono text-[11px] transition-colors",
              filter === f ? "bg-foreground text-background" : "hover:bg-muted"
            )}
          >
            {f === "all" ? `all (${ENTRANTS.length})` : GROUP[f].label}
          </button>
        ))}
      </div>
      {filter !== "all" ? (
        <p className="border-b px-3 py-2 font-mono text-[11px] text-muted-foreground">
          {GROUP[filter].blurb}
        </p>
      ) : null}

      <div className="grid gap-3 p-3 sm:grid-cols-2">
        {shown.map((e) => (
          <section key={e.name} className="flex flex-col rounded-md border p-3">
            <header className="mb-2 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
              <h4 className="font-heading text-sm font-semibold">
                {e.name}{" "}
                <span className="font-mono text-[11px] font-normal text-muted-foreground">
                  {e.who}
                </span>
              </h4>
              <span className="rounded border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                {GROUP[e.group].label}
              </span>
            </header>
            <dl className="grid grid-cols-[5rem_1fr] gap-x-2 gap-y-1 text-xs leading-5">
              {FIELDS.map((fld) => (
                <div key={fld.key} className="contents">
                  <dt className="font-mono text-[10px] tracking-wide text-muted-foreground uppercase">
                    {fld.label}
                  </dt>
                  <dd className="m-0">{e[fld.key] as string}</dd>
                </div>
              ))}
            </dl>
            <div
              className={cn(
                "mt-2 rounded border px-2 py-1 text-center font-mono text-[10px] font-semibold",
                EVIDENCE[e.evidence].tone
              )}
            >
              evidence: {EVIDENCE[e.evidence].label}
            </div>
          </section>
        ))}
      </div>

      <figcaption className="border-t px-3 py-2 font-mono text-[11px] text-muted-foreground">
        No entrant this week carries an independent or sealed-item JevBench score. The chip
        colour is who ran the comparison, not how it turned out.
      </figcaption>
    </figure>
  )
}
