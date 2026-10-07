// The stylesheet for impeccable-design-skill's page shell (layout.tsx). Every
// selector sits under .imx, the shell's <main>, so nothing reaches another
// article. Notes name the Impeccable reference (pbakaus/impeccable at d98b0be)
// each choice answers.
export const CSS = `
/* ---- Tokens ---------------------------------------------------------------
   colorize.md:29-36 asks for roles, not swatches. Ink and paper are tinted a
   little blue (hue 255-260) so the one yellow has something to sit against;
   the README's "always tint" (README.md:89) wins on this page. Every text pair
   was computed: ink on paper 17.5:1, secondary 7.3:1 (6.7:1 on the wash);
   dark: 16.8:1 and 9.6:1. Text on the yellow is always the dark ink, 12.8:1. */
.imx {
  --imx-paper: oklch(0.995 0.002 255);
  --imx-ink: oklch(0.21 0.025 260);
  --imx-ink-2: oklch(0.45 0.025 260);
  --imx-rule: oklch(0.86 0.012 260);
  --imx-wash: oklch(0.962 0.008 255);
  --imx-mark: oklch(0.89 0.165 98);
  --imx-mark-ink: oklch(0.21 0.025 260);
  --imx-focus: var(--imx-ink);

  /* The site's own tokens, remapped inside this page only, so the shared
     pieces (rating panel, repo card, sliders, related links) take the palette
     and the site's 4.3:1 secondary grey becomes 7.3:1. */
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
  --imp-flag: var(--imx-mark);
  --imp-flag-ink: var(--imx-mark-ink);

  /* Faces: the site's grotesk for display and interface, Newsreader for the
     reading column (mode-read.md:15, "a reading face"), Plex Mono for code,
     paths and rule ids only (craft-floor.md:38). */
  --imx-sans: var(--font-sans), system-ui, sans-serif;
  --imx-read: var(--font-imx-read), Georgia, serif;
  --imx-mono: var(--font-mono), ui-monospace, monospace;

  /* Type roles (typeset.md:42, the fewest roles that make the hierarchy
     unmistakable): meta 14, interface 16, body 19, lede 22, quote 26,
     section 30-40, title 26-44 and 52-96 (craft-floor.md:12, display max 6rem). */
  --imx-t-meta: 0.875rem;
  --imx-t-ui: 1rem;
  --imx-t-body: 1.1875rem;
  --imx-t-lede: 1.375rem;
  --imx-t-quote: 1.625rem;
  --imx-t-h2: clamp(1.875rem, 1.25rem + 2.2vw, 2.5rem);
  --imx-t-h1b: clamp(1.625rem, 1.1rem + 2.4vw, 2.75rem);
  --imx-t-h1a: clamp(3.25rem, 1.5rem + 8.5vw, 6rem);

  /* One spacing scale on a 4px base (layout.md:49), used as tight inside a
     group and generous between groups (layout.md:48). */
  --imx-1: 0.25rem;
  --imx-2: 0.5rem;
  --imx-3: 0.75rem;
  --imx-4: 1rem;
  --imx-6: 1.5rem;
  --imx-8: 2rem;
  --imx-12: 3rem;
  --imx-16: 4rem;
  --imx-24: 6rem;

  --imx-col: 34rem;
  --imx-margin: 12rem;
  --imx-gutter: 1rem;

  display: block;
  width: 100%;
  background: var(--imx-paper);
  color: var(--imx-ink);
  font-family: var(--imx-sans);
  caret-color: var(--imx-ink);
}
.dark .imx {
  --imx-paper: oklch(0.17 0.014 260);
  --imx-ink: oklch(0.955 0.006 255);
  --imx-ink-2: oklch(0.78 0.014 255);
  --imx-rule: oklch(0.34 0.018 260);
  --imx-wash: oklch(0.215 0.016 260);
  --imx-mark: oklch(0.87 0.16 98);
  --imx-mark-ink: oklch(0.21 0.025 260);
  --imx-focus: var(--imx-mark);
}

/* ---- Browser surfaces (craft-floor.md:15) -------------------------------- */
.imx ::selection { background: var(--imx-mark); color: var(--imx-mark-ink); }
.imx :focus-visible { outline: 2px solid var(--imx-focus); outline-offset: 2px; border-radius: 2px; }
.imx-sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }

/* ---- The grid --------------------------------------------------------------
   A reading column with a margin either side on wide screens. Headings and
   pull quotes hang into the left margin, figures and widgets take both, and
   two plates run the full width. Below 64rem the margins fold away. */
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

/* ---- Title ------------------------------------------------------------------
   The name at display size, the claim under it, the verdict marked the way
   the detector marks a finding. No label above the heading (craft-floor.md:27). */
.imx-hero { padding-block: var(--imx-16) 0; }
@media (min-width: 64rem) { .imx-hero { padding-top: var(--imx-24); } }
.imx-hero > .imx-h1 { grid-column: wide; }
.imx-h1 { font-family: var(--imx-sans); font-weight: 800; color: var(--imx-ink); }
.imx-h1-name {
  display: block;
  font-size: var(--imx-t-h1a);
  line-height: 0.95;
  letter-spacing: -0.035em;
}
.imx-h1-rest {
  display: block;
  margin-top: var(--imx-4);
  max-width: 21em;
  font-size: var(--imx-t-h1b);
  font-weight: 500;
  line-height: 1.15;
  letter-spacing: -0.022em;
  text-wrap: balance;
}
.imx-h1 mark {
  color: var(--imx-mark-ink);
  background: linear-gradient(var(--imx-mark), var(--imx-mark)) no-repeat 0 0 / 100% 100%;
  padding: 0 0.12em;
  margin: 0 -0.04em;
  -webkit-box-decoration-break: clone;
  box-decoration-break: clone;
}
/* The page's one authored moment (craft-floor.md:13): the mark is laid down
   once, left to right, ease-out. The words are readable before it lands. Light
   theme only, because in dark the words are dark ink that needs the mark under
   them; reduced motion gets the finished mark. */
@media (prefers-reduced-motion: no-preference) {
  html:not(.dark) .imx-h1 mark { animation: imx-mark 700ms cubic-bezier(0.16, 1, 0.3, 1) 250ms both; }
}
@keyframes imx-mark { from { background-size: 0% 100%; } to { background-size: 100% 100%; } }

.imx-hero-foot { grid-column: wide; display: grid; gap: var(--imx-12); margin-top: var(--imx-12); }
@media (min-width: 64rem) {
  .imx-hero-foot { grid-template-columns: minmax(0, 1fr) 21rem; gap: var(--imx-16); align-items: start; }
}
.imx-dek {
  margin: 0;
  max-width: 34em;
  font-family: var(--imx-read);
  font-size: var(--imx-t-lede);
  line-height: 1.45;
  text-wrap: pretty;
}
.imx-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--imx-1) var(--imx-4);
  margin: var(--imx-6) 0 0;
  font-size: var(--imx-t-meta);
  line-height: 1.5;
  color: var(--imx-ink-2);
  font-variant-numeric: tabular-nums;
}
.imx-chip { margin-top: var(--imx-4); }
.imx-chip > span { font-size: 0.75rem; }

/* The colophon: a type specimen's habit, stating what the page is set in. */
.imx-colo { border-top: 2px solid var(--imx-ink); padding-top: var(--imx-3); font-size: var(--imx-t-meta); line-height: 1.45; }
.imx-colo-t { margin: 0 0 var(--imx-3); font-size: var(--imx-t-ui); font-weight: 700; letter-spacing: -0.005em; }
.imx-colo dl { margin: 0; display: grid; gap: var(--imx-3); }
.imx-colo dl > div { display: grid; grid-template-columns: 6rem minmax(0, 1fr); gap: var(--imx-3); }
.imx-colo dt { color: var(--imx-ink-2); }
.imx-colo dd { margin: 0; }
.imx-colo code { font-family: var(--imx-mono); font-size: 0.8125rem; white-space: nowrap; }

.imx-film { grid-column: wide; margin-top: var(--imx-12); }

/* The rating panel, re-set in the page's terms: rules instead of a rounded
   box, and its label as a plain heading instead of tracked capitals. */
.imx-why { margin-top: var(--imx-16); }
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
  font-family: var(--imx-sans);
  font-size: var(--imx-t-ui);
  font-weight: 700;
  letter-spacing: 0;
  text-transform: none;
  color: var(--imx-ink);
}

/* ---- The reading column ---------------------------------------------------- */
.imx-body { padding: var(--imx-12) 0 var(--imx-24); font-size: var(--imx-t-body); line-height: 1.6; }
.imx-body > * + * { margin-top: var(--imx-6); }
.imx-body > p,
.imx-body > ul,
.imx-body > ol { font-family: var(--imx-read); text-wrap: pretty; }
/* Paragraph spacing alone marks the boundary (typeset.md:55). */
.imx-body > p + p { margin-top: 0.85em; }
.imx-body > :first-child { font-size: var(--imx-t-lede); line-height: 1.5; }

/* Section openers: a 2px ink rule (the detector reads 3px as a side-tab), the heading hung into the margin, and a lede
   paragraph under it. Far more space above than below (craft-floor.md:11). */
.imx-body > h2.imx-h2 {
  grid-column: wide;
  margin-top: var(--imx-24);
  padding-top: var(--imx-4);
  border-top: 2px solid var(--imx-ink);
  font-family: var(--imx-sans);
  font-size: var(--imx-t-h2);
  font-weight: 750;
  line-height: 1.1;
  letter-spacing: -0.028em;
  text-wrap: balance;
  scroll-margin-top: 6rem;
}
.imx-body > h2.imx-h2 + * { margin-top: var(--imx-6); }
/* The paragraph that opens a section runs its first line in the reading
   face's semibold, a newspaper's run-in, so the opener reads as one unit. */
.imx-body > h2.imx-h2 + p::first-line { font-weight: 620; }
.imx-body > h3 { font-family: var(--imx-sans); font-size: var(--imx-t-lede); font-weight: 700; margin-top: var(--imx-12); }

/* Links: ink, a quiet underline, and on hover the page's mark. */
.imx-body a,
.imx-why a { color: inherit; text-decoration-line: underline; text-decoration-thickness: 1px; text-underline-offset: 0.2em; text-decoration-color: color-mix(in oklch, currentColor 45%, transparent); }
.imx-body > p a:hover,
.imx-pass-body a:hover { background: var(--imx-mark); color: var(--imx-mark-ink); text-decoration-color: currentColor; }

/* Code is data, set in the mono at a size matched to the serif. */
/* No chip behind inline code: this article names a file or a rule in most
   sentences, and a chip on each made the column busy. */
.imx-body :not(pre) > code { font-family: var(--imx-mono); font-size: 0.8em; padding: 0; border-radius: 0; background: none; color: var(--imx-ink); }
.imx-body > figure[data-rehype-pretty-code-figure] { margin-block: var(--imx-8) 0; }
.imx-body > figure[data-rehype-pretty-code-figure] + * { margin-top: var(--imx-8); }
.imx-body pre { font-size: 0.875rem; line-height: 1.6; border-radius: 2px; }

/* ---- Pull quotes -------------------------------------------------------------
   The skill's own sentences, set large in the reading face, with the file and
   line under them as data. Rules above and below, never a side stripe
   (craft-floor.md:35). */
.imx-body > .imx-pq { margin-top: var(--imx-12); padding-block: var(--imx-6); border-block: 1px solid var(--imx-rule); }
.imx-body > .imx-pq + * { margin-top: var(--imx-12); }
@media (min-width: 64rem) { .imx-body > .imx-pq { grid-column: col-start / wide-end; } }
.imx-pq-text {
  margin: 0;
  font-family: var(--imx-read);
  font-size: var(--imx-t-quote);
  line-height: 1.32;
  letter-spacing: -0.005em;
  text-wrap: pretty;
}
.imx-pq-open { display: inline-block; width: 0; text-indent: -0.42em; }
.imx-pq-text code { font-size: 0.72em; }
.imx-pq-src { margin: var(--imx-3) 0 0; font-size: var(--imx-t-meta); color: var(--imx-ink-2); }
.imx-body .imx-pq-src code { font-family: var(--imx-mono); font-size: 0.8125rem; background: none; padding: 0; }

/* ---- Figures -------------------------------------------------------------- */
.imx-body > .imx-fig { margin-top: var(--imx-12); }
.imx-body > .imx-fig + * { margin-top: var(--imx-12); }
.imx-fig img { display: block; width: 100%; height: auto; border: 1px solid var(--imx-rule); border-radius: 2px; background: #fff; }
.imx-fig figcaption {
  margin-top: var(--imx-3);
  max-width: 62ch;
  font-family: var(--imx-sans);
  font-size: var(--imx-t-meta);
  line-height: 1.5;
  color: var(--imx-ink-2);
  text-wrap: pretty;
}
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
   raised to 12px, the detector's floor for body text, and the repo
   card's tint-to-transparent ground set solid so its contrast is what it looks. */
.imx [class*="text-[9px]"],
.imx [class*="text-[10px]"] { font-size: 0.75rem; }
.imx-body > figure.bg-gradient-to-b { background: var(--imx-paper); border-radius: 3px; }
/* Its tinted header strip made the detector read a card inside the card; a
   rule under the header separates it on its own. */
.imx-body > figure.bg-gradient-to-b > div:first-child { background: transparent; }

/* ---- The two widgets ---------------------------------------------------------- */
.imx-body > .imp-bench,
.imx-body > .imp-ledger { grid-column: wide; margin-top: var(--imx-12); margin-bottom: 0; }
.imx-body > .imp-bench + *,
.imx-body > .imp-ledger + * { margin-top: var(--imx-12); }

/* ---- The run log -------------------------------------------------------------- */
.imx-body > .imx-log { grid-column: bleed; margin-top: var(--imx-12); padding-block: var(--imx-12); background: var(--imx-wash); }
.imx-body > .imx-log + * { margin-top: var(--imx-12); }
.imx-log-in { width: min(100% - 2 * var(--imx-gutter), var(--imx-col) + 2 * var(--imx-margin)); margin-inline: auto; }
.imx-log-t { margin: 0; font-size: var(--imx-t-lede); font-weight: 700; letter-spacing: -0.012em; }
.imx-log-note { margin: var(--imx-2) 0 0; max-width: 60ch; font-size: var(--imx-t-meta); color: var(--imx-ink-2); }
.imx-log ol { list-style: none; margin: var(--imx-8) 0 0; padding: 0; }
.imx-pass { display: grid; gap: var(--imx-3); padding-block: var(--imx-6); border-top: 1px solid var(--imx-rule); }
@media (min-width: 48rem) {
  .imx-pass { grid-template-columns: 11rem minmax(0, 1fr); gap: var(--imx-8); }
}
.imx-pass-head { display: flex; flex-wrap: wrap; align-items: baseline; gap: var(--imx-1) var(--imx-3); }
@media (min-width: 48rem) { .imx-pass-head { flex-direction: column; align-items: flex-start; } }
.imx-cmd {
  font-family: var(--imx-mono);
  font-size: 0.9375rem;
  font-weight: 600;
  line-height: 1.35;
  padding: 0.3em 0.55em;
  border-radius: 2px;
  background: var(--imx-mark);
  color: var(--imx-mark-ink);
}
.imx-pass-when { font-size: var(--imx-t-meta); color: var(--imx-ink-2); }
.imx-pass-cite { font-family: var(--imx-mono); font-size: 0.8125rem; color: var(--imx-ink-2); }
.imx-pass-body { max-width: var(--imx-col); font-family: var(--imx-read); font-size: var(--imx-t-body); line-height: 1.6; }
.imx-pass-body > p { margin: 0; text-wrap: pretty; }
.imx-pass-body > p + p { margin-top: 0.85em; }

/* ---- End matter: the site's own, on the page's ground ------------------------- */
.imx-end { width: min(100% - 2 * var(--imx-gutter), 48rem); margin-inline: auto; padding-bottom: var(--imx-8); }
.imx-end p { max-width: 58ch; }

/* On a phone the two larger reading sizes step down one notch, so the dek
   and the opening paragraph do not run to a dozen lines each. */
@media (max-width: 40rem) {
  .imx-dek,
  .imx-body > :first-child { font-size: 1.25rem; }
}

@media (prefers-reduced-motion: no-preference) {
  .imx-body a { transition: background-color 120ms ease-out; }
}
`
