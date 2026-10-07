import type { ReactNode } from "react"

// Article-scoped reading styles for impeccable-design-skill, set by working
// through Impeccable's own references (pbakaus/impeccable at d98b0be) against
// this site's tokens. Every selector is under .imp-page, so nothing leaks to
// other articles; the site's own components keep their markup and only their
// reading-surface details change here. Notes name the rule each value answers.
const CSS = `
.imp-page {
  /* colorize.md:44 lets neutral grey stand where it serves the world; the
     site's tokens are a pure-neutral ramp, so the page keeps them and adds
     one quieter text role mixed from them (both themes, no new hex). */
  --imp-quiet: color-mix(in oklch, var(--foreground) 64%, var(--background));
  --imp-rule: color-mix(in oklch, var(--foreground) 14%, var(--background));
  --imp-wash: color-mix(in oklch, var(--foreground) 4%, var(--background));
  /* The one accent: impeccable.style's annotation yellow, spent only on
     findings (colorize.md:42, "own a deliberate role"). */
  --imp-flag: oklch(0.86 0.17 92);
  --imp-flag-ink: oklch(0.2 0.03 92);
  --imp-measure: 58ch;
}

/* Measure. mode-read.md:15 asks for 60-75 characters near 16px; the site's
   column is 720px, which the detector measured at 98-123 characters a line.
   Prose holds to 58ch: ch is the width of a zero, and in Hanken Grotesk
   68ch measured 85-88 characters a line, 58ch measures 65-75. Figures,
   tables, code and widgets keep the full width. */
.imp-page > p,
.imp-page > ul,
.imp-page > ol,
.imp-page > blockquote,
.imp-page > h2,
.imp-page > h3,
.imp-page > aside,
.imp-page li > p {
  max-width: var(--imp-measure);
}
.imp-page > p { line-height: 1.75; margin-block: 0 1.15em; }
.imp-page > p + p { margin-top: 0; }

/* Hierarchy and rhythm. craft-floor.md:11: more space above a heading than
   below it. typeset.md:42: size and weight together, steps of 1.25x or more
   between body (16px), h3 (20px) and h2 (25px). */
.imp-page > h2 {
  font-size: 1.5625rem;
  line-height: 1.2;
  font-weight: 650;
  letter-spacing: -0.015em;
  margin: 3.25rem 0 0.85rem;
  text-wrap: balance;
}
.imp-page > h3 {
  font-size: 1.25rem;
  line-height: 1.3;
  font-weight: 600;
  margin: 2.25rem 0 0.6rem;
  text-wrap: balance;
}
.imp-page > h2 + p,
.imp-page > h3 + p { margin-top: 0; }

/* Browser surfaces (craft-floor.md:15): selection, link underline, focus. */
.imp-page ::selection {
  background: color-mix(in oklch, var(--imp-flag) 55%, transparent);
  color: inherit;
}
.imp-page a {
  text-decoration-thickness: 1px;
  text-underline-offset: 0.22em;
  text-decoration-color: color-mix(in oklch, currentColor 40%, transparent);
}
.imp-page a:hover { text-decoration-color: currentColor; }
.imp-page :focus-visible {
  outline: 2px solid var(--foreground);
  outline-offset: 2px;
  border-radius: 2px;
}

/* Callouts: no coloured side stripe (craft-floor.md:35); the label is set in
   the reading face, sentence case, so it stops reading as a kicker
   (craft-floor.md:27) or as monospace costume (craft-floor.md:38). */
.imp-page aside[data-callout] {
  border: 0;
  padding: 0.9rem 1.1rem;
  background: var(--imp-wash);
  border-radius: 6px;
  margin-block: 1.75rem;
}
.imp-page aside[data-callout] > span:first-child {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  font-weight: 650;
  letter-spacing: 0;
  text-transform: none;
  color: var(--foreground);
}
.imp-page aside[data-callout] > span:first-child::first-letter { text-transform: uppercase; }
.imp-page aside[data-callout="warn"] { background: color-mix(in oklch, var(--destructive) 9%, var(--background)); }

/* Quotes: a 1px rule at most, upright text (the quoted rules are read, not
   performed). */
.imp-page > blockquote {
  border-left: 1px solid var(--imp-rule);
  padding-left: 1.1rem;
  font-style: normal;
  color: var(--imp-quiet);
}

/* Figures: captions in the reading face, left-aligned with the image; mono is
   for code and data (craft-floor.md:38). */
.imp-page figure { margin-block: 2.25rem; }
.imp-page figure > figcaption {
  font-family: var(--font-sans);
  font-size: 0.875rem;
  line-height: 1.5;
  text-align: left;
  color: var(--imp-quiet);
  max-width: var(--imp-measure);
  margin-top: 0.6rem;
}

/* The site's figure "expand" control is 10px mono at 70% opacity over a
   blurred, translucent chip: the detector reads it as undersized (11px floor)
   and, on a phone over a photo, at 1.6:1. Here it gets 12px, solid ink and a
   solid ground. */
.imp-page figure button[aria-label^="Expand"] {
  font-size: 0.75rem;
  color: var(--foreground);
  background: var(--background);
  backdrop-filter: none;
}
@media (max-width: 39.99rem) {
  .imp-page figure button[aria-label^="Expand"] { opacity: 1; }
}

/* Data: tabular numerals, quiet headers in the reading face. */
.imp-page table { font-variant-numeric: tabular-nums; }
.imp-page th {
  font-family: var(--font-sans);
  font-size: 0.8125rem;
  letter-spacing: 0;
  color: var(--imp-quiet);
}
.imp-page :not(pre) > code { font-size: 0.875em; }

@media (max-width: 40rem) {
  .imp-page > h2 { font-size: 1.375rem; margin-top: 2.5rem; }
  .imp-page > h3 { font-size: 1.1875rem; }
}
`

export function ImpeccablePage({ children }: { children: ReactNode }) {
  return (
    <div className="imp-page">
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {children}
    </div>
  )
}
