"use client"

import { useId, useMemo, useState } from "react"

import { Range } from "@/components/articles/ui/range"
import { RULES, type Rule } from "@/components/articles/impeccable-design-skill/rules"
import {
  contrast,
  FLAT_RATIO,
  grey,
  hex,
  isCream,
  sideTab,
} from "@/components/articles/impeccable-design-skill/slop-logic"

// impeccable-disable side-tab, cream-palette, low-contrast, flat-type-hierarchy, gradient-text, ai-color-palette, pulsing-dot, nested-cards, gpt-thin-border-wide-shadow, marketing-buzzword, kicker-above-heading, italic-serif-display, icon-tile-stack: documentation of bad design, the bench rebuilds these on purpose
//
// A sample status card with fourteen of Impeccable's anti-patterns rebuilt as
// switches. Each check is a small port of the rule it names (slop-logic.ts);
// the rule text in the findings is quoted from crates/foundation/src/registry.rs.

const GROUNDS = [
  { key: "white", label: "White", hex: "#ffffff" },
  { key: "ivory", label: "Ivory", hex: "#fbf8f1" },
  { key: "beige", label: "Beige", hex: "#f3ead8" },
  { key: "cool", label: "Cool grey", hex: "#eef2f6" },
] as const
type Ground = (typeof GROUNDS)[number]["key"]

const SWITCHES = [
  { key: "kicker", rule: "kicker-above-heading", label: "Tracked label above the heading" },
  { key: "tile", rule: "icon-tile-stack", label: "Icon tile above the heading" },
  { key: "serif", rule: "italic-serif-display", label: "Italic serif heading" },
  { key: "gradient", rule: "gradient-text", label: "Gradient on the number" },
  { key: "dot", rule: "pulsing-dot", label: "Pulsing status dot" },
  { key: "nested", rule: "nested-cards", label: "Card inside the card" },
  { key: "ghost", rule: "gpt-thin-border-wide-shadow", label: "Hairline plus wide shadow" },
  { key: "purple", rule: "ai-color-palette", label: "Purple gradient button" },
  { key: "buzz", rule: "marketing-buzzword", label: "Marketing copy" },
] as const
type SwitchKey = (typeof SWITCHES)[number]["key"]
type Switches = Record<SwitchKey, boolean>

const NONE: Switches = {
  kicker: false, tile: false, serif: false, gradient: false, dot: false,
  nested: false, ghost: false, purple: false, buzz: false,
}
const ALL: Switches = {
  kicker: true, tile: true, serif: true, gradient: true, dot: true,
  nested: true, ghost: true, purple: true, buzz: true,
}

type State = {
  sw: Switches
  stripe: number
  ground: Ground
  ink: number
  ratio: number
}

const CLEAN: State = { sw: NONE, stripe: 0, ground: "white", ink: 70, ratio: 1.5 }
const SLOPPY: State = { sw: ALL, stripe: 4, ground: "beige", ink: 150, ratio: 1.15 }

type Finding = { rule: Rule; measured?: string }

const byId = (id: string) => RULES.find((r) => r.id === id) as Rule

function check(s: State): Finding[] {
  const out: Finding[] = []
  const bg = hex(GROUNDS.find((g) => g.key === s.ground)!.hex)
  const ratio = contrast(grey(s.ink), bg)
  if (sideTab(s.stripe, true))
    out.push({ rule: byId("side-tab"), measured: `border-left ${s.stripe}px on a 12px-radius card` })
  if (isCream(bg))
    out.push({ rule: byId("cream-palette"), measured: `r − b = ${bg.r - bg.b}, inside 6 to 48` })
  if (ratio < 4.5)
    out.push({ rule: byId("low-contrast"), measured: `${ratio.toFixed(1)}:1, needs 4.5:1` })
  if (s.ratio < FLAT_RATIO)
    out.push({ rule: byId("flat-type-hierarchy"), measured: `${s.ratio.toFixed(2)}×, needs 1.25×` })
  for (const w of SWITCHES) if (s.sw[w.key]) out.push({ rule: byId(w.rule) })
  return out
}

const CSS = `
/* Chrome: one type ramp (1, 0.9375, 0.8125, 0.75rem) and one spacing scale
   (0.25, 0.5, 0.75, 1, 1.5, 2.5rem), per distill.md:51-56. */
.imp-bench { margin: 2.5rem 0; border-block: 1px solid var(--imp-rule, var(--border)); padding: 1rem 0 1.5rem; }
.imp-bench-top { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 0.5rem 1rem; }
.imp-bench-title { font-weight: 650; font-size: 1rem; margin: 0; }
.imp-bench-count { font-variant-numeric: tabular-nums; color: var(--imp-quiet, var(--muted-foreground)); font-size: 0.9375rem; margin: 0; }
.imp-bench-count b { color: var(--foreground); font-weight: 650; }
.imp-bench-actions { display: flex; gap: 0.25rem; }
.imp-bench button.imp-act { font: inherit; font-size: 0.9375rem; padding: 0.25rem 0.75rem; min-height: 2.5rem; border-radius: 6px; border: 1px solid var(--imp-rule, var(--border)); background: transparent; color: var(--foreground); cursor: pointer; }
.imp-bench button.imp-act:hover { background: var(--imp-wash, var(--muted)); }
.imp-bench button.imp-act:focus-visible, .imp-bench summary:focus-visible { outline: 2px solid var(--foreground); outline-offset: 2px; }
.imp-bench-body { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; margin-top: 1rem; }
@media (min-width: 46rem) { .imp-bench-body { grid-template-columns: minmax(0, 21rem) minmax(0, 1fr); } }

/* the specimen: literal colours on purpose, since the rules read literal colours */
.imp-stage { background: var(--imp-wash, var(--muted)); border-radius: 8px; padding: 1rem; }
.imp-spec { position: relative; border-radius: 12px; padding: 1.1rem 1.1rem 1rem; border: 1px solid #e3e3e3; color: #1c1c1c; font-family: var(--font-sans); }
.imp-spec.is-ghost { border-color: #e9e9e9; box-shadow: 0 18px 50px -12px rgb(0 0 0 / 0.22); }
.imp-spec-k { font-size: 0.6875rem; font-weight: 600; letter-spacing: 0.16em; text-transform: uppercase; color: #6b6b6b; margin: 0 0 0.35rem; }
.imp-spec-tile { width: 2.25rem; height: 2.25rem; border-radius: 9px; display: grid; place-items: center; background: #ece9ff; color: #5b47e8; margin-bottom: 0.6rem; }
.imp-spec-h { margin: 0; font-weight: 650; line-height: 1.15; letter-spacing: -0.01em; }
.imp-spec-h.is-serif { font-family: Georgia, "Times New Roman", serif; font-weight: 400; }
.imp-spec-h.is-serif em { font-style: italic; color: #8a4b2f; }
.imp-spec-row { display: flex; align-items: baseline; gap: 0.5rem; }
.imp-spec-num { font-size: 1.75rem; font-weight: 700; font-variant-numeric: tabular-nums; }
.imp-spec-num.is-grad { background: linear-gradient(90deg, #7c3aed, #2563eb); -webkit-background-clip: text; background-clip: text; color: transparent; }
.imp-spec-p { font-size: 0.875rem; line-height: 1.5; margin: 0.35rem 0 0.75rem; }
.imp-spec-inner { border: 1px solid #dedede; border-radius: 10px; background: #ffffff; padding: 0.6rem 0.75rem; margin-bottom: 0.75rem; font-size: 0.8125rem; }
.imp-spec-live { display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #3d3d3d; }
.imp-spec-live i { width: 0.5rem; height: 0.5rem; border-radius: 50%; background: #16a34a; }
@media (prefers-reduced-motion: no-preference) {
  .imp-spec-live i { animation: imp-pulse 1.6s ease-out infinite; }
}
@keyframes imp-pulse { 0% { box-shadow: 0 0 0 0 rgb(22 163 74 / 0.5); } 100% { box-shadow: 0 0 0 0.5rem rgb(22 163 74 / 0); } }
.imp-spec-cta { margin-top: 0.25rem; font: inherit; font-size: 0.875rem; font-weight: 600; padding: 0.45rem 0.8rem; border-radius: 7px; border: 0; background: #1c1c1c; color: #ffffff; }
.imp-spec-cta.is-purple { background: linear-gradient(90deg, #8b5cf6, #3b82f6); }
.imp-tag { white-space: nowrap; font-family: var(--font-mono); font-size: 0.75rem; font-weight: 500; line-height: 1; padding: 0.25rem 0.5rem; border-radius: 3px; background: var(--imp-flag, oklch(0.86 0.17 92)); color: var(--imp-flag-ink, oklch(0.2 0.03 92)); }
.imp-tags { display: flex; flex-wrap: wrap; gap: 0.25rem; margin: 0.5rem 0 0.25rem; }
.imp-stage > .imp-tags, .imp-spec > .imp-tags:first-child { margin-top: 0; }
.imp-stage-note { font-size: 0.8125rem; color: var(--imp-quiet, var(--muted-foreground)); margin: 0.75rem 0 0; }

.imp-controls { margin-top: 1.5rem; display: grid; gap: 1rem; }
.imp-label { font-size: 0.9375rem; font-weight: 600; margin: 0 0 0.25rem; padding: 0; display: flex; justify-content: space-between; gap: 0.5rem; font-variant-numeric: tabular-nums; }
.imp-label span { font-weight: 400; color: var(--imp-quiet, var(--muted-foreground)); }
.imp-switches, .imp-grounds { border: 0; padding: 0; margin: 0; min-width: 0; }
.imp-switches { display: grid; }
.imp-switches label { display: flex; gap: 0.5rem; align-items: center; font-size: 0.9375rem; min-height: 2rem; cursor: pointer; }
.imp-switches input { width: 1rem; height: 1rem; accent-color: var(--foreground); }
.imp-grounds-row { display: flex; flex-wrap: wrap; gap: 0.25rem; }
.imp-grounds label { position: relative; display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9375rem; padding: 0.25rem 0.75rem; min-height: 2.5rem; border-radius: 6px; border: 1px solid var(--imp-rule, var(--border)); cursor: pointer; }
.imp-grounds label:has(input:checked) { border-color: var(--foreground); font-weight: 600; }
.imp-grounds input { position: absolute; opacity: 0; width: 1px; height: 1px; }
.imp-grounds label:has(input:focus-visible) { outline: 2px solid var(--foreground); outline-offset: 2px; }
.imp-grounds i { width: 1rem; height: 1rem; border-radius: 3px; border: 1px solid rgb(0 0 0 / 0.18); }
@media (pointer: coarse) {
  .imp-switches label, .imp-grounds label, .imp-bench button.imp-act { min-height: 2.75rem; }
}

.imp-findings { list-style: none; margin: 0; padding: 0; }
.imp-findings li { padding: 0.75rem 0; border-top: 1px solid var(--imp-rule, var(--border)); }
.imp-findings li:first-child { border-top: 0; padding-top: 0; }
.imp-f-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.25rem 0.5rem; }
.imp-f-name { font-weight: 650; font-size: 0.9375rem; }
.imp-f-id { font-family: var(--font-mono); font-size: 0.8125rem; color: var(--imp-quiet, var(--muted-foreground)); }
.imp-f-meta { font-size: 0.8125rem; color: var(--imp-quiet, var(--muted-foreground)); margin: 0.25rem 0 0; font-variant-numeric: tabular-nums; }
.imp-f-meta b { font-weight: 600; color: var(--foreground); }
.imp-f-text { font-size: 0.9375rem; line-height: 1.55; margin: 0.25rem 0 0; }
.imp-f-text summary { cursor: pointer; font-size: 0.8125rem; color: var(--imp-quiet, var(--muted-foreground)); width: fit-content; min-height: 2rem; display: flex; align-items: center; }
.imp-f-text p { margin: 0.25rem 0 0; max-width: 60ch; }
.imp-empty { font-size: 0.9375rem; color: var(--imp-quiet, var(--muted-foreground)); margin: 0; max-width: 40ch; }
`

// Annotation labels sit in flow above what they mark, so they never cover
// the element or run off a narrow card.
function TagRow({ tags }: { tags: (string | false)[] }) {
  const t = tags.filter(Boolean) as string[]
  if (!t.length) return null
  return (
    <div className="imp-tags" aria-hidden="true">
      {t.map((x) => (
        <span key={x} className="imp-tag">
          {x}
        </span>
      ))}
    </div>
  )
}

const KIND: Record<string, string> = {
  taste: "taste, set as a threshold",
  reading: "readability, against an outside standard",
}

export function SlopBench({ initial = "clean" }: { initial?: "clean" | "sloppy" }) {
  const [s, setS] = useState<State>(initial === "clean" ? CLEAN : SLOPPY)
  const findings = useMemo(() => check(s), [s])
  const fired = new Set(findings.map((f) => f.rule.id))
  const id = useId()
  const bg = GROUNDS.find((g) => g.key === s.ground)!.hex
  const ink = `rgb(${s.ink} ${s.ink} ${s.ink})`
  const set = (patch: Partial<State>) => setS((p) => ({ ...p, ...patch }))
  const flip = (k: SwitchKey) => setS((p) => ({ ...p, sw: { ...p.sw, [k]: !p.sw[k] } }))

  const cardTags = [
    fired.has("side-tab") && "side-tab",
    fired.has("cream-palette") && "cream-palette",
    fired.has("gpt-thin-border-wide-shadow") && "thin border, wide shadow",
  ].filter(Boolean) as string[]

  return (
    <figure className="imp-bench" aria-labelledby={`${id}-t`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="imp-bench-top">
        <p className="imp-bench-title" id={`${id}-t`}>
          Turn the tells on and off
        </p>
        <p className="imp-bench-count" aria-live="polite">
          <b>{findings.length}</b> of 13 checks fire
        </p>
        <div className="imp-bench-actions">
          <button type="button" className="imp-act" onClick={() => setS(CLEAN)}>
            Remove every tell
          </button>
          <button type="button" className="imp-act" onClick={() => setS(SLOPPY)}>
            Add every tell
          </button>
        </div>
      </div>

      <div className="imp-bench-body">
        <div>
          <div className="imp-stage">
            <TagRow tags={cardTags} />
            <div
              className={`imp-spec${s.sw.ghost ? " is-ghost" : ""}`}
              style={{
                background: bg,
                borderLeft: s.stripe ? `${s.stripe}px solid #6d5dfc` : undefined,
              }}
            >
              {s.sw.tile ? (
                <div className="imp-spec-tile" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M4 19V9M10 19V5M16 19v-7M22 19H2" />
                  </svg>
                </div>
              ) : null}
              {s.sw.kicker ? <p className="imp-spec-k">Eval report</p> : null}
              <div>
                <TagRow
                  tags={[
                    s.sw.kicker && "kicker",
                    s.sw.tile && "icon tile",
                    s.sw.serif && "italic serif",
                    fired.has("flat-type-hierarchy") && "flat type",
                    s.sw.buzz && "buzzwords",
                  ]}
                />
                <p
                  className={`imp-spec-h${s.sw.serif ? " is-serif" : ""}`}
                  style={{ fontSize: `${(15 * s.ratio).toFixed(1)}px` }}
                >
                  {s.sw.buzz ? (
                    <>Supercharge your evals with cutting-edge insights</>
                  ) : s.sw.serif ? (
                    <>
                      Nightly eval <em>finished</em>
                    </>
                  ) : (
                    <>Nightly eval finished</>
                  )}
                </p>
              </div>
              <TagRow tags={[s.sw.gradient && "gradient text", s.sw.dot && "pulsing dot"]} />
              <div className="imp-spec-row">
                <span className={`imp-spec-num${s.sw.gradient ? " is-grad" : ""}`}>412/420</span>
                {s.sw.dot ? (
                  <span className="imp-spec-live">
                    <i aria-hidden="true" /> Live
                  </span>
                ) : null}
              </div>
              <TagRow tags={[fired.has("low-contrast") && "low contrast"]} />
              <p className="imp-spec-p" style={{ color: ink }}>
                                Eight regressions, all in the parser suite.
              </p>
              {s.sw.nested ? <TagRow tags={["nested card"]} /> : null}
              {s.sw.nested ? (
                <div className="imp-spec-inner">Parser suite: 8 failed, 31 passed</div>
              ) : null}
              <TagRow tags={[s.sw.purple && "AI palette"]} />
              <button type="button" tabIndex={-1} className={`imp-spec-cta${s.sw.purple ? " is-purple" : ""}`}>
                Open the report
              </button>
            </div>
          </div>
          <p className="imp-stage-note">
            A sample card. Its colours are literal because the rules read literal colours; it does
            not follow the page theme.
          </p>

          <div className="imp-controls">
            <div>
              <p className="imp-label">
                Left stripe <span>{s.stripe}px (fires at 2px on a rounded card)</span>
              </p>
              <Range min={0} max={6} step={1} value={s.stripe} aria-label="Left stripe width in pixels" onChange={(e) => set({ stripe: Number(e.target.value) })} />
            </div>
            <div>
              <p className="imp-label">
                Body text contrast <span>{contrast(grey(s.ink), hex(bg)).toFixed(1)}:1 (needs 4.5:1)</span>
              </p>
              <Range min={40} max={200} step={5} value={s.ink} aria-label="Body text grey level, sets the contrast" onChange={(e) => set({ ink: Number(e.target.value) })} />
            </div>
            <div>
              <p className="imp-label">
                Heading size, relative to body <span>{s.ratio.toFixed(2)}× (needs 1.25×)</span>
              </p>
              <Range min={1} max={2.2} step={0.05} value={s.ratio} aria-label="Heading to body size ratio" onChange={(e) => set({ ratio: Number(e.target.value) })} />
            </div>
            <fieldset className="imp-grounds">
              <legend className="imp-label">Card background</legend>
              <div className="imp-grounds-row">
              {GROUNDS.map((g) => (
                <label key={g.key}>
                  <input type="radio" name={`${id}-g`} checked={s.ground === g.key} onChange={() => set({ ground: g.key })} />
                  <i style={{ background: g.hex }} aria-hidden="true" />
                  {g.label}
                </label>
              ))}
              </div>
            </fieldset>
            <fieldset className="imp-switches">
              <legend className="imp-label">Patterns</legend>
              {SWITCHES.map((w) => (
                <label key={w.key}>
                  <input type="checkbox" checked={s.sw[w.key]} onChange={() => flip(w.key)} />
                  {w.label}
                </label>
              ))}
            </fieldset>
          </div>
        </div>

        <div>
          {findings.length ? (
            <ul className="imp-findings">
              {findings.map((f) => (
                <li key={f.rule.id}>
                  <div className="imp-f-head">
                    <span className="imp-f-name">{f.rule.name}</span>
                    <span className="imp-f-id">{f.rule.id}</span>
                  </div>
                  <p className="imp-f-meta">
                    {f.measured ? (
                      <>
                        <b>{f.measured}</b> ·{" "}
                      </>
                    ) : null}
                    {f.rule.sev} · {KIND[f.rule.bucket] ?? f.rule.bucket} · registry.rs:{f.rule.line}
                  </p>
                  <details className="imp-f-text">
                    <summary>Rule text</summary>
                    <p>“{f.rule.text}”</p>
                  </details>
                </li>
              ))}
            </ul>
          ) : (
            <p className="imp-empty">
              No rule fires. That says the card avoids thirteen known patterns, not that it is
              well designed.
            </p>
          )}
        </div>
      </div>
    </figure>
  )
}
