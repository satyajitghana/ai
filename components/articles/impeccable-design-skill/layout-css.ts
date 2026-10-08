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
     pieces (rating panel, repo card, sliders, related links) take the palette. */
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

  /* Type roles (typeset.md:42): meta 14, interface 16, body 19, lede 22,
     long quote 24, section 36-60, claim 28-52, quote 30-46, and the masthead,
     which fills the measure. */
  --imx-t-meta: 0.875rem;
  --imx-t-ui: 1rem;
  --imx-t-body: 1.1875rem;
  --imx-t-lede: 1.375rem;
  --imx-t-quote-long: 1.5rem;
  --imx-t-quote: clamp(1.875rem, 1.2rem + 2vw, 2.875rem);
  --imx-t-h2: clamp(2.25rem, 1.3rem + 3vw, 3.75rem);
  --imx-t-claim: clamp(1.75rem, 1rem + 2.5vw, 3.25rem);

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

/* ---- The masthead ------------------------------------------------------------
   The name fills the frame's width, as a magazine's does: the size comes from
   the container, 15rem at most and about 4.3rem on a phone. That is past
   craft-floor.md:12's 6rem display maximum, on purpose; the name is the one
   place the page performs, and the column under it does not. Upright, never
   italic (the detector's italic-serif-display), no label above (craft-floor.md:27). */
.imx-hero {
  width: min(100% - 2 * var(--imx-gutter), var(--imx-frame));
  margin-inline: auto;
  padding-top: var(--imx-8);
  container-type: inline-size;
}
@media (min-width: 64rem) { .imx-hero { padding-top: var(--imx-12); } }
.imx-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--imx-1) var(--imx-6);
  margin: 0;
  font-size: var(--imx-t-meta);
  line-height: 1.5;
  color: var(--imx-ink-2);
  font-variant-numeric: tabular-nums;
}
.imx-meta time { color: var(--imx-ink); font-weight: 500; }
.imx-h1 { margin: var(--imx-4) 0 0; font-family: var(--imx-display); font-weight: var(--imx-display-weight); color: var(--imx-ink); }
.imx-mast {
  display: block;
  margin-left: -0.035em;
  font-size: min(100cqi / 5.25, 15rem);
  font-variation-settings: "opsz" 96;
  line-height: 0.86;
  letter-spacing: -0.02em;
  white-space: nowrap;
}
.imx-claim {
  display: block;
  margin-top: var(--imx-6);
  max-width: 17em;
  font-size: var(--imx-t-claim);
  font-weight: 400;
  font-variation-settings: "opsz" 36;
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
  white-space: nowrap;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
/* The page's one authored moment (craft-floor.md:13): the pink is laid down
   once, left to right, ease-out. Light theme only, because in dark the words
   are dark and need the pink under them; reduced motion gets the finished mark. */
@media (prefers-reduced-motion: no-preference) {
  html:not(.dark) .imx-h1 mark { animation: imx-mark 800ms cubic-bezier(0.16, 1, 0.3, 1) 300ms both; }
}
@keyframes imx-mark { from { background-size: 0% 78%; } to { background-size: 100% 78%; } }

.imx-hero-foot { display: grid; gap: var(--imx-8); margin-top: var(--imx-12); }
@media (min-width: 64rem) {
  .imx-hero-foot { grid-template-columns: minmax(0, 36rem) minmax(0, 22rem); justify-content: space-between; align-items: end; margin-top: var(--imx-16); }
}
.imx-dek { margin: 0; font-size: var(--imx-t-lede); line-height: 1.5; text-wrap: pretty; }
.imx-chip { margin-top: var(--imx-4); }
.imx-chip > span { font-size: 0.75rem; }

/* The credits: one run-on paragraph, the way a magazine credits a cover,
   instead of a spec table. Each label is a run-in in the ink. */
.imx-credits { margin: 0; font-size: var(--imx-t-meta); line-height: 1.6; color: var(--imx-ink-2); text-wrap: pretty; }
.imx-credits b { color: var(--imx-ink); font-weight: 600; }
.imx-credits b::after { content: " "; }

.imx-film { margin-top: var(--imx-12); }

/* The rating panel, re-set in the page's terms: rules instead of a rounded
   box, and its label as a plain heading instead of tracked capitals. */
.imx-why { max-width: 48rem; margin-top: var(--imx-12); }
.imx-why > section,
.imx-why > div {
  margin-top: 0;
  border-radius: 0;
  border-width: 1px 0;
  border-style: solid;
  border-color: var(--imx-rule);
  background: transparent;
  padding: var(--imx-4) 0;
}
.imx-why #why-read-this {
  font-family: var(--imx-text);
  font-size: var(--imx-t-ui);
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
  color: var(--imx-ink);
}

/* ---- The grid --------------------------------------------------------------
   A reading column with a margin either side on wide screens. Figures and
   widgets take the margins too, plates and the run log the full width. */
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
   Jost at 19px, about 69 characters a line on a render (typeset.md:47 asks for
   45 to 75). The display face never sets running text (mode-read.md:15). */
.imx-body { padding: var(--imx-16) 0 var(--imx-24); font-size: var(--imx-t-body); line-height: 1.65; }
.dark .imx-body { line-height: 1.7; letter-spacing: 0.005em; }
.imx-body > * + * { margin-top: var(--imx-6); }
.imx-body > p,
.imx-body > ul,
.imx-body > ol { text-wrap: pretty; }
/* Paragraph spacing alone marks the boundary (typeset.md:55). */
.imx-body > p + p { margin-top: 0.9em; }
.imx-body strong { font-weight: 600; }

/* The opening paragraph is set one step up, as a standfirst. */
.imx-body > p:first-child { font-size: var(--imx-t-lede); line-height: 1.55; }

/* Section openers: the Didone at section size, on a smaller optical size
   than its pixel size, because the 72-96 masters thin an H's crossbar to a
   hairline that reads as "I low" at 50px; centred over the column and
   its margins, with far more space above it than below and no rule, no
   number and no label (craft-floor.md:11, 27-28). */
.imx-body > h2.imx-h2 {
  grid-column: wide;
  margin-top: var(--imx-32);
  font-family: var(--imx-display);
  font-size: var(--imx-t-h2);
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 36;
  line-height: 1;
  letter-spacing: -0.015em;
  text-align: center;
  text-wrap: balance;
  scroll-margin-top: 6rem;
}
@media (max-width: 40rem) { .imx-body > h2.imx-h2 { margin-top: var(--imx-24); } }
.imx-body > h2.imx-h2 + * { margin-top: var(--imx-12); }
.imx-body > h3 { font-family: var(--imx-text); font-size: var(--imx-t-lede); font-weight: 600; margin-top: var(--imx-12); }

/* Links: an underline in the pink; on hover the pink ground. */
.imx-body a,
.imx-why a,
.imx-end a { color: inherit; text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.22em; text-decoration-color: var(--imx-pink); }
.imx-body > p a:hover,
.imx-pass-body a:hover { background: var(--imx-pink); color: var(--imx-on-pink); text-decoration-color: currentColor; }

/* Code is data, in the mono at a size matched to Jost's x-height. No chip
   behind inline code: this article names a file or a rule in most sentences. */
.imx-body :not(pre) > code { font-family: var(--imx-code); font-size: 0.8em; padding: 0; border-radius: 0; background: none; color: var(--imx-ink); }
.imx-body > figure[data-rehype-pretty-code-figure] { grid-column: col-start / wide-end; margin-block: var(--imx-8) 0; }
.imx-body > figure[data-rehype-pretty-code-figure] + * { margin-top: var(--imx-8); }
.imx-body pre { font-family: var(--imx-code); font-size: 0.8125rem; line-height: 1.65; border-radius: 0; }

/* ---- Pull quotes -------------------------------------------------------------
   A short sentence of the skill's own is set in the Didone across the column
   and its margins, centred, with the file and line under it in the pink. A
   long passage stays in the column at a reading size. No side stripe
   (craft-floor.md:35), and no rule either: the space is the frame. */
.imx-body > .imx-pq { grid-column: wide; margin-top: var(--imx-16); text-align: center; }
.imx-body > .imx-pq + * { margin-top: var(--imx-16); }
.imx-pq-text {
  max-width: 24em;
  margin: 0 auto;
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
.imx-pq-src { margin: var(--imx-4) 0 0; }
.imx-body .imx-pq-src code { font-family: var(--imx-code); font-size: 0.8125rem; color: var(--imx-pink-ink); }
.imx-body > .imx-pq--long { grid-column: col; text-align: left; }
.imx-pq--long .imx-pq-text { max-width: none; font-size: var(--imx-t-quote-long); font-variation-settings: "opsz" 24; line-height: 1.35; letter-spacing: 0; text-wrap: pretty; }
.imx-pq-open { display: inline-block; width: 0; text-indent: -0.42em; }
.imx-pq:not(.imx-pq--long) .imx-pq-open { width: auto; text-indent: 0; }

/* ---- Figures -------------------------------------------------------------- */
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
.imx-body > .imx-fig--wide { grid-column: wide; }
@media (min-width: 64rem) {
  .imx-body > .imx-fig--col {
    grid-column: col-start / wide-end;
    display: grid;
    grid-template-columns: minmax(0, var(--imx-col)) minmax(0, 1fr);
    column-gap: var(--imx-6);
    align-items: end;
  }
  .imx-fig--col figcaption { margin-top: 0; }
}
.imx-body > .imx-fig--plate { grid-column: bleed; background: var(--imx-wash); padding-block: var(--imx-12); }
.imx-plate { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; }

/* The site's figure "expand" control is 10px text at 70% opacity on a blurred
   chip; here it gets 12px, solid ink and a solid ground. */
.imx figure button[aria-label^="Expand"] { font-size: 0.75rem; color: var(--imx-ink); background: var(--imx-paper); backdrop-filter: none; }
@media (max-width: 39.99rem) { .imx figure button[aria-label^="Expand"] { opacity: 1; } }

/* The shared pieces' 9px and 10px labels (repo card, agent chip, citation),
   raised to 12px, the detector's floor for body text, and the repo card's
   tint-to-transparent ground set solid so its contrast is what it looks. */
.imx [class*="text-[9px]"],
.imx [class*="text-[10px]"] { font-size: 0.75rem; }
.imx-body > figure.bg-gradient-to-b { background: var(--imx-paper); border-radius: 0; }
.imx-body > figure.bg-gradient-to-b > div:first-child { background: transparent; }

/* The shared pieces label their fields in tracked mono capitals, one of the
   looks new-work.md:69 names; here they are plain text-face labels. */
.imx .uppercase { text-transform: none; letter-spacing: 0; font-family: var(--imx-text); font-size: 0.8125rem; }

/* Measures for the smaller text. Jost runs narrow, so a cap set in ch (the
   width of a zero) let 15px rule text and 12px notes run past 80 characters a
   line; these caps hold them near 75, measured on a render. */
.imx .imp-row-body,
.imx .imp-f-text p,
.imx .imp-keys button > span { max-width: 31rem; }
.imx-why p { max-width: 30rem; }
.imx-why p.text-xs,
.imx-body figure p.text-xs { max-width: 25rem; }

/* ---- The two widgets ----------------------------------------------------------
   They keep their own layout and take the page's faces through the remapped
   tokens; their titles become Didone headings at the run log's size. */
.imx-body > .imp-bench,
.imx-body > .imp-ledger { grid-column: wide; margin-top: var(--imx-16); margin-bottom: 0; border-top-width: 1px; }
.imx-body > .imp-bench + *,
.imx-body > .imp-ledger + * { margin-top: var(--imx-16); }
.imx .imp-bench-title,
.imx .imp-ledger-title {
  font-family: var(--imx-display);
  font-size: 1.75rem;
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 36;
  line-height: 1.1;
  letter-spacing: -0.01em;
}
.imx .imp-ledger-title { margin-bottom: var(--imx-4); }
.imx .imp-bench,
.imx .imp-ledger { font-size: var(--imx-t-ui); }
.imx .imp-bench button.imp-act,
.imx .imp-grounds label,
.imx .imp-filter label,
.imx .imp-keys button { border-radius: 0; }
.imx .imp-bench button.imp-act:hover { background: var(--imx-pink); color: var(--imx-on-pink); border-color: var(--imx-pink); }
.imx .imp-tag { border-radius: 0; font-family: var(--imx-code); }
.imx .imp-f-name { font-weight: 600; }

/* ---- The run log -------------------------------------------------------------- */
.imx-body > .imx-log { grid-column: bleed; margin-top: var(--imx-16); padding-block: var(--imx-16); background: var(--imx-wash); }
.imx-body > .imx-log + * { margin-top: var(--imx-16); }
.imx-log-in { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; }
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
.imx-log-note { margin: var(--imx-3) 0 0; max-width: 60ch; font-size: var(--imx-t-ui); color: var(--imx-ink-2); }
.imx-log ol { list-style: none; margin: var(--imx-12) 0 0; padding: 0; }
.imx-pass { display: grid; gap: var(--imx-3); padding-block: var(--imx-8); border-top: 1px solid var(--imx-rule); }
@media (min-width: 48rem) {
  .imx-pass { grid-template-columns: 11rem minmax(0, 1fr); gap: var(--imx-8); }
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
.imx-pass-when { font-size: var(--imx-t-meta); color: var(--imx-ink-2); }
.imx-pass-cite { font-family: var(--imx-code); font-size: 0.8125rem; color: var(--imx-ink-2); }
.imx-pass-body { max-width: var(--imx-col); font-size: var(--imx-t-body); line-height: 1.65; }
.imx-pass-body > p { margin: 0; text-wrap: pretty; }
.imx-pass-body > p + p { margin-top: 0.9em; }

/* ---- End matter: the site's own, set in the page's faces ------------------------ */
.imx-end { width: min(100% - 2 * var(--imx-gutter), 48rem); margin-inline: auto; padding-bottom: var(--imx-12); }
.imx-end p { max-width: 32rem; }
.imx-end #related-heading,
.imx-end section[aria-label="Citation"] > h2 {
  font-family: var(--imx-display);
  font-size: 2rem;
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 30;
  line-height: 1.1;
  letter-spacing: -0.01em;
  text-transform: none;
  color: var(--imx-ink);
}
.imx-end nav li a {
  font-family: var(--imx-display);
  font-size: 1.375rem;
  font-weight: var(--imx-display-weight);
  font-variation-settings: "opsz" 14;
  letter-spacing: -0.005em;
  line-height: 1.3;
}
.imx-end nav li a:hover { text-decoration-thickness: 2px; }
.imx-end nav li p { font-size: 0.9375rem; }
.imx-end section[aria-label="Citation"] > div { border-radius: 0; }

/* On a phone the lede steps down one notch, so the dek does not run long. */
@media (max-width: 40rem) {
  .imx-dek { font-size: 1.25rem; }
}

@media (prefers-reduced-motion: no-preference) {
  .imx-body a { transition: background-color 120ms ease-out; }
}
`
