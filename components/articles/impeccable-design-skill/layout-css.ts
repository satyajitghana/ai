// The stylesheet for impeccable-design-skill's page shell (layout.tsx). Every
// selector sits under .imx, the shell's <main>, so nothing reaches another
// article. Notes name the Impeccable reference (pbakaus/impeccable at d98b0be)
// each choice answers.
export const CSS = `
/* ---- Tokens ---------------------------------------------------------------
   colorize.md:29-36 asks for roles, not swatches. One colour, a shocking pink,
   owns the verdict, the run log's commands, the findings, links on hover and
   the selection (colorize.md:42); everything else is ink. Light is ink on a
   white with a breath of the pink's hue; dark is not that inverted
   (colorize.md:48) but an aubergine ground, a lighter pink that carries dark
   text, and a little more weight and leading in the text (typeset.md:48).
   Every text pair was computed. Light: ink 18.8:1, secondary 7.7:1 (6.8:1 on
   the blush wash), pink text 5.8:1, ink on the pink 5.0:1. Dark: ink 17.0:1,
   secondary 10.0:1 (9.2:1 on the wash), pink text 9.4:1, ground on the pink
   7.1:1. */
.imx {
  --imx-paper: oklch(0.993 0.004 350);
  --imx-ink: oklch(0.17 0.012 350);
  --imx-ink-2: oklch(0.44 0.02 350);
  --imx-rule: oklch(0.84 0.02 350);
  --imx-wash: oklch(0.955 0.022 355);
  --imx-pink: oklch(0.64 0.25 356);
  --imx-on-pink: var(--imx-ink);
  --imx-pink-ink: oklch(0.53 0.22 356);
  --imx-focus: var(--imx-ink);
  --imx-text-weight: 400;
  --imx-display-weight: 500;

  /* The site's own tokens, remapped inside this page only, so the shared
     pieces (repo card, sliders, related links, citation) take the palette. */
  --background: var(--imx-paper);
  --foreground: var(--imx-ink);
  --card: var(--imx-paper);
  --card-foreground: var(--imx-ink);
  --popover: var(--imx-paper);
  --popover-foreground: var(--imx-ink);
  --muted: var(--imx-wash);
  --muted-foreground: var(--imx-ink-2);
  --border: var(--imx-rule);
  --input: var(--imx-rule);
  --ring: var(--imx-ink-2);
  /* The two widgets read these names. */
  --imp-rule: var(--imx-rule);
  --imp-quiet: var(--imx-ink-2);
  --imp-wash: var(--imx-wash);
  --imp-flag: var(--imx-pink);
  --imp-flag-ink: var(--imx-on-pink);

  /* Faces. The site's utilities (font-sans, font-heading, font-mono) resolve
     to the site's font variables, and the widgets read --font-sans and
     --font-mono, so redefining all of them here re-sets the shared pieces in
     this page's faces without touching any other page. */
  --imx-display: var(--font-imx-display), "Bodoni 72", Didot, serif;
  --imx-text: var(--font-imx-text), "Futura", system-ui, sans-serif;
  --imx-code: var(--font-imx-code), ui-monospace, monospace;
  --font-hanken: var(--imx-text);
  --font-ibm-plex-mono: var(--imx-code);
  --font-sans: var(--imx-text);
  --font-heading: var(--imx-text);
  --font-mono: var(--imx-code);

  /* Type roles (typeset.md:42): meta 14, interface 16, body 19, standfirst
     22-28, long quote 24, section 36-60, claim 28-52, quote 30-46, and the
     masthead, which fills the measure. */
  --imx-t-meta: 0.875rem;
  --imx-t-ui: 1rem;
  --imx-t-body: 1.1875rem;
  --imx-t-lede: 1.375rem;
  --imx-t-stand: clamp(1.3125rem, 1.05rem + 0.75vw, 1.75rem);
  --imx-t-quote-long: 1.5rem;
  --imx-t-quote: clamp(1.75rem, 1.2rem + 1.8vw, 2.75rem);
  --imx-t-h2: clamp(2.125rem, 1.3rem + 3vw, 3.75rem);
  --imx-t-claim: clamp(1.625rem, 1rem + 2.5vw, 3.25rem);
  --imx-t-spread: clamp(1.625rem, 1.1rem + 1.9vw, 2.75rem);

  /* One spacing scale on a 4px base (layout.md:49). */
  --imx-1: 0.25rem;
  --imx-2: 0.5rem;
  --imx-3: 0.75rem;
  --imx-4: 1rem;
  --imx-6: 1.5rem;
  --imx-8: 2rem;
  --imx-12: 3rem;
  --imx-16: 4rem;
  --imx-24: 6rem;
  --imx-32: 8rem;

  --imx-col: 36rem;
  --imx-margin: 12rem;
  --imx-gutter: 1rem;
  --imx-frame: 80rem;

  display: block;
  width: 100%;
  background: var(--imx-paper);
  color: var(--imx-ink);
  font-family: var(--imx-text);
  font-weight: var(--imx-text-weight);
  font-kerning: normal;
  font-variant-numeric: proportional-nums;
  caret-color: var(--imx-pink-ink);
}
.dark .imx {
  --imx-paper: oklch(0.165 0.026 345);
  --imx-ink: oklch(0.955 0.008 350);
  --imx-ink-2: oklch(0.79 0.02 350);
  --imx-rule: oklch(0.36 0.025 348);
  --imx-wash: oklch(0.21 0.034 348);
  --imx-pink: oklch(0.72 0.2 356);
  --imx-on-pink: oklch(0.165 0.026 345);
  --imx-pink-ink: oklch(0.79 0.14 356);
  --imx-focus: var(--imx-pink);
  --imx-text-weight: 420;
  --imx-display-weight: 560;
}

/* ---- Browser surfaces (craft-floor.md:15) -------------------------------- */
.imx ::selection { background: var(--imx-pink); color: var(--imx-on-pink); }
.imx :focus-visible { outline: 2px solid var(--imx-focus); outline-offset: 3px; border-radius: 1px; }
.imx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---- The opener ------------------------------------------------------------
   A magazine opener on one twelve-column grid: the folio across the top, the
   name across the full measure, the claim locked to the right edge under it,
   then the standfirst on the left seven columns and the byline, the agent
   links and the credits on the right four, both starting on the same line.
   The verdict box closes it. Every block shares the frame's two edges. */
.imx-hero {
  width: min(100% - 2 * var(--imx-gutter), var(--imx-frame));
  margin-inline: auto;
  padding-top: var(--imx-6);
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
}
.imx-hero > * { grid-column: 1 / -1; min-width: 0; }
@media (min-width: 64rem) {
  .imx-hero { padding-top: var(--imx-8); grid-template-columns: repeat(12, minmax(0, 1fr)); column-gap: var(--imx-6); }
  .imx-hero > .imx-stand { grid-column: 1 / span 7; }
  .imx-hero > .imx-aside { grid-column: 9 / -1; }
}

/* The folio: what kind of piece this is and its date, set as a line of the
   page's own text on a rule, not as tracked capitals above the title. */
.imx-folio {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  align-items: baseline;
  gap: var(--imx-1) var(--imx-6);
  margin: 0;
  padding-bottom: var(--imx-3);
  border-bottom: 1px solid var(--imx-ink);
  font-size: var(--imx-t-meta);
  line-height: 1.4;
  color: var(--imx-ink-2);
}
.imx-folio-kind { font-family: var(--imx-display); font-size: 1.125rem; font-weight: var(--imx-display-weight); font-optical-sizing: auto; color: var(--imx-ink); }
.imx-folio time { color: var(--imx-ink); }

/* The masthead. The name fills the frame's width, as a magazine's does: the
   size comes from the container, 15rem at most and about 4.3rem on a phone.
   That is past craft-floor.md:12's 6rem display maximum, on purpose; the name
   is the one place the page performs, and the column under it does not.
   Upright, never italic (the detector's italic-serif-display). */
.imx-h1 { margin: var(--imx-6) 0 0; font-family: var(--imx-display); font-weight: var(--imx-display-weight); color: var(--imx-ink); }
.imx-mast {
  display: block;
  margin-left: -0.035em;
  font-size: min(100cqi / 5.25, 15rem);
  font-variation-settings: "opsz" 96;
  line-height: 0.86;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
/* The claim: the deck line, on the optical size nearest its pixel size. */
.imx-claim {
  display: block;
  margin-top: var(--imx-6);
  max-width: 17em;
  font-size: var(--imx-t-claim);
  font-weight: 400;
  font-variation-settings: "opsz" 40;
  line-height: 1.3;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.dark .imx-claim { font-weight: 460; }
@media (min-width: 48rem) { .imx-claim { margin-left: auto; text-align: right; } }
.imx-h1 mark {
  color: var(--imx-on-pink);
  /* The pink sits from just above the x-height to just under the baseline,
     not across the whole line box, so it never covers the line above. */
  background: linear-gradient(var(--imx-pink), var(--imx-pink)) no-repeat 0 72% / 100% 78%;
  padding: 0 0.1em;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
/* Kept on one line wherever it fits; on the narrowest phones it breaks
   between words and each line carries its own pink. */
@media (min-width: 24rem) { .imx-h1 mark { white-space: nowrap; } }
/* The page's one authored moment (craft-floor.md:13): the pink is laid down
   once, left to right, ease-out. Light theme only, because in dark the words
   are dark and need the pink under them; reduced motion gets the finished mark. */
@media (prefers-reduced-motion: no-preference) {
  html:not(.dark) .imx-h1 mark { animation: imx-mark 800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both; }
}
@keyframes imx-mark { from { background-size: 0% 78%; } to { background-size: 100% 78%; } }

/* The standfirst: the dek, a step above the column, beside the byline. */
.imx-stand {
  margin: var(--imx-12) 0 0;
  max-width: 34rem;
  font-size: var(--imx-t-stand);
  font-weight: calc(var(--imx-text-weight) - 50);
  line-height: 1.42;
  letter-spacing: -0.005em;
  text-wrap: pretty;
}
.imx-aside { margin-top: var(--imx-8); font-size: var(--imx-t-meta); line-height: 1.55; color: var(--imx-ink-2); }
@media (min-width: 64rem) {
  .imx-stand { margin-top: var(--imx-16); }
  /* The byline's first line sits on the standfirst's first line. */
  .imx-aside { margin-top: calc(var(--imx-16) + 0.35rem); }
}
.imx-aside p { margin: 0; text-wrap: pretty; }
.imx-byline { font-size: var(--imx-t-ui); color: var(--imx-ink); }
.imx-byline-name { font-weight: 600; }
.imx-aside-meta { margin-top: var(--imx-1) !important; }
.imx-chip { margin-top: var(--imx-3) !important; display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--imx-1) var(--imx-3); }
/* The agent links, set as a line of links rather than a bordered chip. */
.imx-chip > span[data-print-hidden] {
  border: 0;
  border-radius: 0;
  padding: 0;
  gap: var(--imx-4);
  font-family: var(--imx-code);
  font-size: 0.8125rem;
  color: var(--imx-ink);
}
.imx-chip > span[data-print-hidden] > a,
.imx-chip > span[data-print-hidden] > button {
  text-decoration-line: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 0.25em;
  text-decoration-color: var(--imx-pink);
}
.imx-chip > span[data-print-hidden] > a:hover,
.imx-chip > span[data-print-hidden] > button:hover { color: var(--imx-pink-ink); }
/* The credits: one run-on paragraph, the way a magazine credits a cover,
   instead of a spec table. Each label is a run-in in the ink. */
.imx-credits { margin-top: var(--imx-6) !important; padding-top: var(--imx-4); border-top: 1px solid var(--imx-rule); line-height: 1.6; }
.imx-credits b { color: var(--imx-ink); font-weight: 600; }
.imx-credits b::after { content: " "; }

.imx-film { margin-top: var(--imx-12); }

/* ---- The verdict -------------------------------------------------------------
   The rating, set as a review's verdict box: a tint panel with the tier in the
   Didone and the pink, the editor's line beside it, and the practical facts
   and the scoring in the third column. No pill, no ticks. */
.imx-verdict {
  margin-top: var(--imx-12);
  padding: var(--imx-6) var(--imx-4);
  background: var(--imx-wash);
  display: grid;
  gap: var(--imx-4) var(--imx-6);
}
@media (min-width: 48rem) {
  .imx-verdict { padding: var(--imx-8); grid-template-columns: minmax(0, 1fr) minmax(0, 2fr); }
  .imx-verdict-facts { grid-column: 2; }
}
@media (min-width: 64rem) {
  .imx-verdict { grid-template-columns: minmax(0, 3fr) minmax(0, 5fr) minmax(0, 4fr); column-gap: var(--imx-8); }
  .imx-verdict-facts { grid-column: auto; }
}
.imx-verdict p { margin: 0; }
.imx-verdict-h { margin: 0; font-family: var(--imx-text); font-size: var(--imx-t-ui); font-weight: 600; line-height: 1.4; color: var(--imx-ink); }
.imx-verdict-tier { margin-top: var(--imx-1) !important; font-family: var(--imx-display); font-size: clamp(2.5rem, 2rem + 1.5vw, 3.25rem); font-weight: var(--imx-display-weight); font-optical-sizing: auto; line-height: 1; letter-spacing: -0.015em; }
.imx-verdict-tier a { color: var(--imx-pink-ink); text-decoration: none; }
.imx-verdict-tier a:hover { text-decoration: underline; text-decoration-thickness: 2px; text-underline-offset: 0.12em; }
.imx-verdict-band { margin-top: var(--imx-2) !important; font-size: var(--imx-t-meta); color: var(--imx-ink-2); }
.imx-verdict-why { font-size: 1.1875rem; line-height: 1.5; text-wrap: pretty; }
.imx-verdict-list { list-style: none; margin: var(--imx-3) 0 0; padding: 0; font-size: var(--imx-t-meta); line-height: 1.6; color: var(--imx-ink); }
.imx-verdict-list li { display: inline; }
.imx-verdict-list li + li::before { content: " · "; color: var(--imx-ink-2); }
.imx-verdict-facts { font-size: var(--imx-t-meta); line-height: 1.6; color: var(--imx-ink-2); }
.imx-verdict-facts a { color: var(--imx-ink); }
.imx-verdict-score { margin-top: var(--imx-2); }
.imx-verdict-score summary { display: inline-flex; align-items: center; min-height: 2.75rem; cursor: pointer; color: var(--imx-ink); text-decoration: underline; text-decoration-color: var(--imx-pink); text-underline-offset: 0.25em; }
.imx-verdict-score[open] summary { text-decoration-thickness: 2px; }
.imx-verdict-score > p { margin-top: var(--imx-3) !important; font-size: 0.8125rem; }
.imx-rubric dt { font-size: 0.8125rem; }
.imx-rubric > div { grid-template-columns: minmax(0, 1fr) !important; }
.imx-rubric dd { font-size: 0.8125rem; }
.imx-rubric [aria-hidden="true"] > span { border-radius: 0; }

/* Fallback for an unrated article: the site's panel, on rules. */
.imx-why { max-width: 48rem; margin-top: var(--imx-12); }

/* ---- The grid --------------------------------------------------------------
   A reading column with a margin either side on wide screens. Section
   openers hang into the left margin, figures take one margin with their
   caption in the other, and plates, the run log and the spread run full width. */
.imx-grid {
  display: grid;
  grid-template-columns:
    [bleed-start] minmax(var(--imx-gutter), 1fr)
    [wide-start col-start] minmax(0, var(--imx-col))
    [col-end wide-end] minmax(var(--imx-gutter), 1fr)
    [bleed-end];
}
@media (min-width: 64rem) {
  .imx-grid {
    grid-template-columns:
      [bleed-start] minmax(var(--imx-gutter), 1fr)
      [wide-start] minmax(0, var(--imx-margin))
      [col-start] minmax(0, var(--imx-col))
      [col-end] minmax(0, var(--imx-margin))
      [wide-end] minmax(var(--imx-gutter), 1fr)
      [bleed-end];
  }
}
.imx-grid > * { grid-column: col; min-width: 0; margin: 0; }

/* ---- The reading column ----------------------------------------------------
   Jost at 19px, about 66 characters a line on a render (typeset.md:47 asks for
   45 to 75). The display face never sets running text (mode-read.md:15).
   Neither face carries old-style figures (the served Jost has only tnum,
   Bodoni Moda pnum and tnum), so the text keeps proportional lining figures
   and the data panels switch to tabular ones. */
.imx-body {
  padding: var(--imx-16) 0 var(--imx-24);
  font-size: var(--imx-t-body);
  line-height: 1.65;
  hanging-punctuation: first allow-end last;
}
.dark .imx-body { line-height: 1.7; letter-spacing: 0.005em; }
.imx-body > * + * { margin-top: var(--imx-6); }
.imx-body > p,
.imx-body > ul,
.imx-body > ol { text-wrap: pretty; }
/* Paragraph spacing alone marks the boundary (typeset.md:55). */
.imx-body > p + p { margin-top: 0.9em; }
.imx-body strong { font-weight: 600; }

/* The first paragraph opens on a lead-in: its first line set in the text
   face's semibold, the way a magazine runs into a feature. A Didone initial
   was tried and dropped: this article's first letter is an I, which as a sunk
   capital is a bare stem that reads as a bar, and as a raised one splits
   "Impeccable" in two. */
.imx-body > p:first-child::first-line { font-weight: 600; }
.dark .imx-body > p:first-child::first-line { font-weight: 640; }

/* Section openers: the Didone at section size, on a smaller optical size than
   its pixel size, because the 72-96 masters thin an H's crossbar to a hairline
   that reads as "I low" at 50px. Hung into the left margin and set flush left,
   so the column's left edge stays the one the eye returns to, with far more
   space above than below and no rule, number or label (craft-floor.md:11, 27). */
.imx-body > h2.imx-h2 {
  grid-column: wide-start / col-end;
  max-width: 14em;
  margin-top: var(--imx-32);
  font-family: var(--imx-display);
  font-size: var(--imx-t-h2);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 36;
  line-height: 1.02;
  letter-spacing: -0.015em;
  text-wrap: balance;
  scroll-margin-top: 6rem;
}
@media (max-width: 40rem) { .imx-body > h2.imx-h2 { margin-top: var(--imx-24); } }
.imx-body > h2.imx-h2 + * { margin-top: var(--imx-8); }
@media (min-width: 64rem) { .imx-body > h2.imx-h2 + * { margin-top: var(--imx-12); } }
.imx-body > h3 { font-family: var(--imx-text); font-size: var(--imx-t-lede); font-weight: 600; margin-top: var(--imx-12); }

/* Links: an underline in the pink; on hover the pink ground. */
.imx-body a,
.imx-end a { color: inherit; text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.22em; text-decoration-color: var(--imx-pink); }
.imx-body > p a:hover,
.imx-pass-body a:hover { background: var(--imx-pink); color: var(--imx-on-pink); text-decoration-color: currentColor; }

/* Code is data, in the mono at a size matched to Jost's x-height. No chip
   behind inline code: this article names a file or a rule in most sentences. */
.imx-body :not(pre) > code { font-family: var(--imx-code); font-size: 0.8em; padding: 0; background: none; color: var(--imx-ink); overflow-wrap: break-word; }

/* The one block of code: set on the wash like a sidebar, ink on tint, with
   the theme's colours folded into the page's roles. Comments go to the
   secondary ink and the numbers, which are the point of the passage (the
   thresholds that make a taste a rule), to the pink. */
.imx-body > figure[data-rehype-pretty-code-figure] { grid-column: col-start / wide-end; margin-block: var(--imx-8) 0; }
.imx-body > figure[data-rehype-pretty-code-figure] + * { margin-top: var(--imx-8); }
.imx-body pre {
  margin: 0;
  padding: var(--imx-6);
  border: 0;
  border-radius: 0;
  background: var(--imx-wash) !important;
  color: var(--imx-ink) !important;
  font-family: var(--imx-code);
  font-size: 0.8125rem;
  line-height: 1.7;
  font-variant-numeric: tabular-nums;
}
.imx-body pre code { font-size: inherit; }
.imx-body pre span[style] { color: var(--imx-ink) !important; }
.imx-body pre span[style*="#768390" i] { color: var(--imx-ink-2) !important; }
.imx-body pre span[style*="#6cb6ff" i] { color: var(--imx-pink-ink) !important; }

/* ---- Pull quotes -------------------------------------------------------------
   A short sentence of the skill's own is set in the Didone and hung into a
   margin, the first into the left one and the next into the right, so the two
   do not stack on one axis. The opening quote hangs outside the text in the
   pink. A long passage stays in the column at a reading size. No side stripe
   (craft-floor.md:35), and no rule either: the space is the frame. */
.imx-body > .imx-pq { margin-top: var(--imx-16); }
.imx-body > .imx-pq + * { margin-top: var(--imx-16); }
.imx-body > .imx-pq--short { grid-column: wide-start / col-end; }
.imx-body > .imx-pq--short ~ .imx-pq--short { grid-column: col-start / wide-end; }
.imx-pq-text {
  margin: 0;
  max-width: 22em;
  font-family: var(--imx-display);
  font-size: var(--imx-t-quote);
  font-weight: 400;
  font-variation-settings: "opsz" 30;
  line-height: 1.14;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.dark .imx-pq-text { font-weight: 460; }
.imx-pq-text code { font-size: 0.62em; }
.imx-pq-open { margin-left: -0.45em; color: var(--imx-pink-ink); }
.imx-pq-src { margin: var(--imx-4) 0 0; }
.imx-body .imx-pq-src code { font-family: var(--imx-code); font-size: 0.8125rem; color: var(--imx-pink-ink); }
.imx-body > .imx-pq--long { grid-column: col; }
.imx-pq--long .imx-pq-text { max-width: none; font-size: var(--imx-t-quote-long); font-variation-settings: "opsz" 24; line-height: 1.35; letter-spacing: 0; text-wrap: pretty; }
.imx-pq--long .imx-pq-open { margin-left: -0.4em; }

/* ---- The spread ----------------------------------------------------------------
   One paragraph, the article's answer to its own question, set as a
   full-bleed band of the pink with the words in the Didone. It is still the
   paragraph in reading order; only its setting changes. */
.imx-body > .imx-spread {
  grid-column: bleed;
  margin-top: var(--imx-16);
  padding: var(--imx-16) max(var(--imx-gutter), (100% - 54rem) / 2);
  background: var(--imx-pink);
  color: var(--imx-on-pink);
}
.imx-body > .imx-spread + * { margin-top: var(--imx-16); }
.imx-spread-in {
  display: block;
  font-family: var(--imx-display);
  font-size: var(--imx-t-spread);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 30;
  line-height: 1.18;
  letter-spacing: -0.012em;
  text-wrap: balance;
}
.imx-spread ::selection { background: var(--imx-ink); color: var(--imx-paper); }
@media (min-width: 64rem) { .imx-body > .imx-spread { padding-block: var(--imx-24); } }

/* ---- Figures ------------------------------------------------------------------
   On wide screens each caption is a side-note in the margin the image leaves
   free, set against the image's foot; below 64rem it sits under the image. */
.imx-body > .imx-fig { margin-top: var(--imx-12); }
.imx-body > .imx-fig + * { margin-top: var(--imx-12); }
.imx-fig img { display: block; width: 100%; height: auto; background: #fff; }
.imx-fig figcaption {
  margin-top: var(--imx-3);
  max-width: 31rem;
  font-size: var(--imx-t-meta);
  line-height: 1.55;
  color: var(--imx-ink-2);
  text-wrap: pretty;
}
/* A short pink rule opens each caption, the one place the pink is ornament. */
.imx-fig figcaption::before { content: ""; display: block; width: 2.5rem; height: 2px; margin-bottom: var(--imx-2); background: var(--imx-pink); }
.imx-body > .imx-fig--right,
.imx-body > .imx-fig--left { grid-column: wide; }
@media (min-width: 64rem) {
  .imx-body > .imx-fig--right,
  .imx-body > .imx-fig--left {
    display: grid;
    column-gap: var(--imx-6);
    align-items: end;
  }
  .imx-body > .imx-fig--right { grid-template-columns: minmax(0, calc(var(--imx-margin) + var(--imx-col))) minmax(0, 1fr); }
  .imx-body > .imx-fig--left { grid-template-columns: minmax(0, 1fr) minmax(0, calc(var(--imx-margin) + var(--imx-col))); }
  .imx-fig--left .imx-fig-img { grid-column: 2; grid-row: 1; }
  .imx-fig--left figcaption { grid-column: 1; grid-row: 1; }
  .imx-fig--right figcaption,
  .imx-fig--left figcaption,
  .imx-plate figcaption { margin-top: 0; }
}
.imx-body > .imx-fig--plate { grid-column: bleed; background: var(--imx-wash); padding-block: var(--imx-12); }
.imx-plate { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; }
@media (min-width: 64rem) {
  .imx-plate { display: grid; grid-template-columns: minmax(0, calc(var(--imx-margin) + var(--imx-col))) minmax(0, 1fr); column-gap: var(--imx-6); align-items: end; }
}

/* The site's figure "expand" control is 10px text at 70% opacity on a blurred
   chip; here it gets 12px, solid ink, a solid ground and square corners. */
.imx figure button[aria-label^="Expand"] { font-size: 0.75rem; color: var(--imx-ink); background: var(--imx-paper); backdrop-filter: none; border-radius: 0; }
@media (max-width: 39.99rem) { .imx figure button[aria-label^="Expand"] { opacity: 1; } }

/* The shared pieces' 9px and 10px labels (repo card, agent chip, citation),
   raised to 12px, the detector's floor for body text. */
.imx [class*="text-[9px]"],
.imx [class*="text-[10px]"] { font-size: 0.75rem; }

/* The shared pieces label their fields in tracked mono capitals, one of the
   looks new-work.md:69 names; here they are plain text-face labels. */
.imx .uppercase { text-transform: none; letter-spacing: 0; font-family: var(--imx-text); font-size: 0.8125rem; }

/* ---- The repo card, as a fact file -------------------------------------------
   The site's card, re-set: an ink rule instead of a rounded box, the repo name
   in the text face, the two headline numbers in the Didone, and the language
   bar in steps of the ink instead of a rainbow. */
.imx-body > .imx-repo { grid-column: col-start / wide-end; margin-top: var(--imx-12); }
.imx-body > .imx-repo + * { margin-top: var(--imx-12); }
.imx-repo figure { margin: 0; border-width: 2px 0 1px; border-style: solid; border-color: var(--imx-ink) transparent var(--imx-rule); border-radius: 0; background: none; }
.imx-repo figure > div:first-child { background: transparent; padding-inline: 0; border-color: var(--imx-rule); }
.imx-repo figure > div:first-child a span { font-family: var(--imx-text); font-size: var(--imx-t-ui); font-weight: 600; }
.imx-repo figure > div + div { padding-inline: 0; }
.imx-repo .text-2xl { font-family: var(--imx-display); font-size: 2.5rem; font-weight: var(--imx-display-weight); font-optical-sizing: auto; font-variant-numeric: lining-nums tabular-nums; line-height: 1.05; }
.imx-repo dd { font-family: var(--imx-text); font-size: 0.9375rem; font-variant-numeric: tabular-nums; }
.imx-repo [role="img"] { border-radius: 0; height: 0.5rem; gap: 2px; background: none; }
.imx-repo [role="img"] > div,
.imx-repo .flex-wrap > span > span[aria-hidden] { background: color-mix(in oklch, var(--imx-ink) var(--imx-tone, 20%), var(--imx-paper)) !important; border-radius: 0; }
.imx-repo [role="img"] > div:nth-child(1), .imx-repo .flex-wrap > span:nth-child(1) > span[aria-hidden] { --imx-tone: 92%; }
.imx-repo [role="img"] > div:nth-child(2), .imx-repo .flex-wrap > span:nth-child(2) > span[aria-hidden] { --imx-tone: 70%; }
.imx-repo [role="img"] > div:nth-child(3), .imx-repo .flex-wrap > span:nth-child(3) > span[aria-hidden] { --imx-tone: 52%; }
.imx-repo [role="img"] > div:nth-child(4), .imx-repo .flex-wrap > span:nth-child(4) > span[aria-hidden] { --imx-tone: 38%; }
.imx-repo [role="img"] > div:nth-child(5), .imx-repo .flex-wrap > span:nth-child(5) > span[aria-hidden] { --imx-tone: 28%; }
.imx-repo .flex-wrap > span { font-family: var(--imx-text); font-size: 0.8125rem; }
.imx-repo p { max-width: 34rem; }
.imx-repo .font-mono.text-\\[10px\\] { font-family: var(--imx-text); }

/* ---- The two widgets ----------------------------------------------------------
   Data panels under an ink rule. They keep their own layout and take the
   page's faces through the remapped tokens; their titles are Didone headings,
   their counts Didone figures, and the bench's count is in the pink because
   it counts findings. */
.imx-body > .imp-bench,
.imx-body > .imp-ledger { grid-column: wide; margin-top: var(--imx-16); margin-bottom: 0; border-top: 2px solid var(--imx-ink); padding-top: var(--imx-4); }
.imx-body > .imp-bench + *,
.imx-body > .imp-ledger + * { margin-top: var(--imx-16); }
.imx .imp-bench-title,
.imx .imp-ledger-title {
  font-family: var(--imx-display);
  font-size: clamp(1.75rem, 1.4rem + 1vw, 2.25rem);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 28;
  line-height: 1.1;
  letter-spacing: -0.01em;
  text-wrap: balance;
}
.imx .imp-ledger-title { margin-bottom: var(--imx-4); }
.imx .imp-bench,
.imx .imp-ledger { font-size: var(--imx-t-ui); }
.imx .imp-bench-count { display: flex; align-items: baseline; gap: var(--imx-2); }
.imx .imp-bench-count b {
  font-family: var(--imx-display);
  font-size: 2.25rem;
  font-weight: var(--imx-display-weight);
  font-optical-sizing: auto;
  font-variant-numeric: lining-nums tabular-nums;
  line-height: 1;
  color: var(--imx-pink-ink);
}
.imx .imp-keys b {
  font-family: var(--imx-display);
  font-size: 1.375rem;
  font-weight: var(--imx-display-weight);
  font-optical-sizing: auto;
  line-height: 1;
}
.imx .imp-bench button.imp-act,
.imx .imp-grounds label,
.imx .imp-filter label,
.imx .imp-keys button,
.imx .imp-grounds i { border-radius: 0; }
.imx .imp-bench button.imp-act:hover { background: var(--imx-pink); color: var(--imx-on-pink); border-color: var(--imx-pink); }
.imx .imp-tag { border-radius: 0; font-family: var(--imx-code); }
.imx .imp-f-name { font-weight: 600; }
.imx .imp-findings li { padding-block: var(--imx-4); }
.imx .imp-f-text summary { gap: var(--imx-2); color: var(--imx-ink); }
.imx .imp-f-text summary::-webkit-details-marker { display: none; }
.imx .imp-f-text summary { list-style: none; }
.imx .imp-f-text summary::before { content: "+"; display: inline-block; width: 0.75em; font-family: var(--imx-code); color: var(--imx-pink-ink); }
.imx .imp-f-text[open] summary::before { content: "\\2212"; }
.imx .imp-stage-note { font-size: var(--imx-t-meta); }
.imx .imp-label { font-variant-numeric: tabular-nums; }

/* Measures for the smaller text. Jost runs narrow, so a cap set in ch (the
   width of a zero) let 15px rule text and 12px notes run past 80 characters a
   line; these caps hold them near 75, measured on a render. */
.imx .imp-row-body,
.imx .imp-f-text p,
.imx .imp-keys button > span { max-width: 31rem; }

/* ---- The run log -------------------------------------------------------------- */
.imx-body > .imx-log { grid-column: bleed; margin-top: var(--imx-16); padding-block: var(--imx-16); background: var(--imx-wash); }
.imx-body > .imx-log + * { margin-top: var(--imx-16); }
.imx-log-in { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; }
.imx-log-top { display: grid; gap: var(--imx-3) var(--imx-8); align-items: end; padding-bottom: var(--imx-6); border-bottom: 2px solid var(--imx-ink); }
@media (min-width: 48rem) { .imx-log-top { grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); } }
.imx-log-t {
  margin: 0;
  font-family: var(--imx-display);
  font-size: var(--imx-t-h2);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 36;
  line-height: 1;
  letter-spacing: -0.015em;
  text-wrap: balance;
}
.imx-log-note { margin: 0; font-size: var(--imx-t-meta); line-height: 1.55; color: var(--imx-ink-2); text-wrap: pretty; }
.imx-log ol { list-style: none; margin: 0; padding: 0; }
.imx-pass { display: grid; gap: var(--imx-3); padding-block: var(--imx-8); }
.imx-pass + .imx-pass { border-top: 1px solid var(--imx-rule); }
@media (min-width: 48rem) {
  .imx-pass { grid-template-columns: 12rem minmax(0, 1fr); gap: var(--imx-8); }
  /* The command stays beside a long entry while it is read. */
  .imx-pass-head { position: sticky; top: 4.5rem; align-self: start; }
}
.imx-pass-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--imx-1) var(--imx-3); }
@media (min-width: 48rem) { .imx-pass-head { flex-direction: column; align-items: flex-start; } }
.imx-cmd {
  font-family: var(--imx-code);
  font-size: 0.9375rem;
  line-height: 1.35;
  padding: 0.3em 0.55em;
  background: var(--imx-pink);
  color: var(--imx-on-pink);
}
.imx-pass-when { font-size: var(--imx-t-meta); color: var(--imx-ink); }
.imx-pass-cite { font-family: var(--imx-code); font-size: 0.8125rem; color: var(--imx-ink-2); }
.imx-pass-body { max-width: var(--imx-col); font-size: var(--imx-t-body); line-height: 1.65; }
.imx-pass-body > p { margin: 0; text-wrap: pretty; }
.imx-pass-body > p + p { margin-top: 0.9em; }

/* ---- The running head ------------------------------------------------------------
   On a screen wide enough to leave an outer margin free, the sections in the
   margin with the one being read in the pink. Text only: no stripe, no dot. It
   appears without a transition. */
.imx-rail { display: none; }
@media (min-width: 84rem) {
  .imx-rail {
    display: block;
    position: fixed;
    top: 6rem;
    left: var(--imx-8);
    z-index: 2;
    width: min(13rem, (100vw - var(--imx-col) - 2 * var(--imx-margin)) / 2 - 2 * var(--imx-8));
    visibility: hidden;
  }
  .imx-rail[data-shown] { visibility: visible; }
}
.imx-rail ol { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--imx-1); }
.imx-rail a {
  display: block;
  padding-block: var(--imx-1);
  font-size: 0.8125rem;
  line-height: 1.35;
  color: var(--imx-ink-2);
  text-decoration: none;
  text-wrap: balance;
}
.imx-rail a:hover { color: var(--imx-ink); text-decoration: underline; text-decoration-color: var(--imx-pink); text-underline-offset: 0.2em; }
.imx-rail a[aria-current] { color: var(--imx-pink-ink); font-weight: 600; }

/* ---- End matter: the back page -------------------------------------------------
   The site's related links, citation and share row, set as a magazine's back
   page: an ink rule, the related pieces in two columns with Didone titles,
   then the citation and the share row side by side. */
.imx-end { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; padding-bottom: var(--imx-16); }
@media (min-width: 64rem) {
  .imx-end { display: grid; grid-template-columns: minmax(0, 2fr) minmax(0, 1fr); column-gap: var(--imx-12); align-items: start; }
  .imx-end > nav { grid-column: 1 / -1; }
}
.imx-end > nav { margin-top: 0; padding-top: var(--imx-6); border-top: 2px solid var(--imx-ink); }
.imx-end #related-heading,
.imx-end section[aria-label="Citation"] > h2 {
  font-family: var(--imx-display);
  font-size: clamp(1.75rem, 1.4rem + 1vw, 2.25rem);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 28;
  line-height: 1.1;
  letter-spacing: -0.01em;
  text-transform: none;
  color: var(--imx-ink);
}
.imx-end nav ul { display: grid; gap: var(--imx-8) var(--imx-12); margin-top: var(--imx-8); }
@media (min-width: 48rem) { .imx-end nav ul { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
.imx-end nav ul > li { margin: 0; padding-top: var(--imx-4); border-top: 1px solid var(--imx-rule); }
.imx-end nav li a {
  font-family: var(--imx-display);
  font-size: 1.375rem;
  font-weight: var(--imx-display-weight);
  font-optical-sizing: auto;
  letter-spacing: -0.005em;
  line-height: 1.3;
  text-decoration-line: none;
  text-wrap: balance;
}
.imx-end nav li a:hover { text-decoration-line: underline; text-decoration-thickness: 2px; text-decoration-color: var(--imx-pink); }
.imx-end nav li p { margin-top: var(--imx-2); font-size: 0.9375rem; line-height: 1.55; -webkit-line-clamp: 3; }
.imx-end section[aria-label="Citation"] { border-top-color: var(--imx-rule); }
.imx-end section[aria-label="Citation"] p { max-width: 34rem; font-size: 0.9375rem; text-wrap: pretty; }
.imx-end section[aria-label="Citation"] > div { border-radius: 0; background: var(--imx-wash); border-color: transparent; }
.imx-end section[aria-label="Citation"] > div > div { border-color: var(--imx-rule); font-family: var(--imx-text); }
/* The share row, on its own rule beside the citation on a wide screen. */
.imx-end > div[data-print-hidden] { flex-wrap: wrap; gap: var(--imx-1) var(--imx-2); border-top-color: var(--imx-rule); font-family: var(--imx-text); font-size: var(--imx-t-meta); color: var(--imx-ink); }
.imx-end > div[data-print-hidden] > span { width: 100%; font-family: var(--imx-display); font-size: 1.375rem; font-weight: var(--imx-display-weight); font-optical-sizing: auto; }
.imx-end > div[data-print-hidden] > span::first-letter { text-transform: uppercase; }
.imx-end > div[data-print-hidden] > a,
.imx-end > div[data-print-hidden] > button { min-width: 2.75rem; min-height: 2.75rem; justify-content: center; color: var(--imx-ink); }
.imx-end > div[data-print-hidden] svg { width: 1.125rem; height: 1.125rem; }
.imx-end > div[data-print-hidden] > a:hover,
.imx-end > div[data-print-hidden] > button:hover { color: var(--imx-pink-ink); }
/* Hacker News keeps its Y in a square, so the mark is still its own, but
   drawn in the ink at rest; its orange comes back on hover, under dark ink
   (6:1) instead of white (2.9:1). */
.imx-end a[aria-label="Share on Hacker News"] > span {
  width: 1.125rem;
  height: 1.125rem;
  border: 1.5px solid currentColor;
  border-radius: 0;
  background: transparent !important;
  color: inherit;
  opacity: 1;
  font-family: var(--imx-text);
  font-size: 0.6875rem;
}
.imx-end a[aria-label="Share on Hacker News"]:hover > span { background: #ff6600 !important; border-color: #ff6600; color: oklch(0.17 0.012 350); }

/* On a phone the standfirst steps down one notch, so it does not run long. */
@media (max-width: 40rem) {
  .imx-stand { margin-top: var(--imx-8); }
  .imx-folio-kind { font-size: 1rem; }
}

@media (prefers-reduced-motion: no-preference) {
  .imx-body a { transition: background-color 120ms ease-out; }
}
`
