// Generated from pbakaus/impeccable at d98b0be (crates/live/assets/antipatterns.json,
// crates/foundation/src/registry.rs) and impeccable.style/slop for the six
// design-review entries. `bucket` is this article's classification, not theirs.

export type Bucket = "taste" | "reading" | "defect" | "system" | "review"
export type Engine = "source" | "browser" | "review"

export type Rule = {
  id: string
  name: string
  cat: string
  sev: string
  line: number
  engine: Engine
  bucket: Bucket
  text: string
}

export const RULES: Rule[] = [
  {
    "id": "side-tab",
    "name": "Side-tab accent border",
    "cat": "slop",
    "sev": "warning",
    "line": 34,
    "engine": "source",
    "bucket": "taste",
    "text": "Thick colored border on one side of a card — the most recognizable tell of AI-generated UIs. Use a subtler accent or remove it entirely."
  },
  {
    "id": "border-accent-on-rounded",
    "name": "Border accent on rounded element",
    "cat": "slop",
    "sev": "warning",
    "line": 44,
    "engine": "source",
    "bucket": "taste",
    "text": "Thick accent border on a rounded card — the border clashes with the rounded corners. Remove the border or the border-radius."
  },
  {
    "id": "overused-font",
    "name": "Overused font",
    "cat": "slop",
    "sev": "warning",
    "line": 54,
    "engine": "source",
    "bucket": "taste",
    "text": "Inter, Roboto, Fraunces, Geist, Plus Jakarta Sans, and Space Grotesk are used on so many sites they no longer feel distinctive. Each new wave of AI-generated UIs converges on the same handful of faces. Choose a face that gives your interface personality."
  },
  {
    "id": "flat-type-hierarchy",
    "name": "Flat type hierarchy",
    "cat": "slop",
    "sev": "warning",
    "line": 64,
    "engine": "source",
    "bucket": "taste",
    "text": "Dominant heading and body roles are separated by less than 1.25× at every step, leaving the size hierarchy flat. Add at least one stronger size step."
  },
  {
    "id": "gradient-text",
    "name": "Gradient text",
    "cat": "slop",
    "sev": "warning",
    "line": 74,
    "engine": "source",
    "bucket": "taste",
    "text": "Gradient text is decorative rather than meaningful — a common AI tell, especially on headings and metrics. Use solid colors for text."
  },
  {
    "id": "ai-color-palette",
    "name": "AI color palette",
    "cat": "slop",
    "sev": "warning",
    "line": 84,
    "engine": "source",
    "bucket": "taste",
    "text": "Purple/violet gradients and cyan-on-dark are the most recognizable tells of AI-generated UIs. A gradient in one of those hues is the tell on its own; flat neon ink on a dark ground is charged once a second tell hue joins it. Choose a distinctive, intentional palette."
  },
  {
    "id": "cream-palette",
    "name": "Cream / beige palette",
    "cat": "slop",
    "sev": "warning",
    "line": 94,
    "engine": "source",
    "bucket": "taste",
    "text": "A warm cream or beige page background has become the default \"tasteful\" AI surface, reached for by reflex. Choose a background that comes from a deliberate palette, not the safe warm off-white."
  },
  {
    "id": "nested-cards",
    "name": "Nested cards",
    "cat": "slop",
    "sev": "warning",
    "line": 104,
    "engine": "source",
    "bucket": "taste",
    "text": "Cards inside cards create visual noise and excessive depth. Flatten the hierarchy — use spacing, typography, and dividers instead of nesting containers."
  },
  {
    "id": "monotonous-spacing",
    "name": "Monotonous spacing",
    "cat": "slop",
    "sev": "warning",
    "line": 114,
    "engine": "source",
    "bucket": "taste",
    "text": "The same spacing value used everywhere — no rhythm, no variation. Use tight groupings for related items and generous separations between sections."
  },
  {
    "id": "bounce-easing",
    "name": "Bounce or elastic easing",
    "cat": "slop",
    "sev": "advisory",
    "line": 124,
    "engine": "source",
    "bucket": "taste",
    "text": "Bounce and elastic easing feel dated and tacky. Real objects decelerate smoothly — use exponential easing (ease-out-quart/quint/expo) instead."
  },
  {
    "id": "pulsing-dot",
    "name": "Pulsing status dot",
    "cat": "slop",
    "sev": "warning",
    "line": 134,
    "engine": "source",
    "bucket": "taste",
    "text": "Small pulsing status dots simulate liveness decoratively. Reserve pulse animation for indicators tied to genuinely live, changing data; a static indicator with clear labeling is honest and calmer."
  },
  {
    "id": "blinking-cursor",
    "name": "Decorative blinking cursor",
    "cat": "slop",
    "sev": "advisory",
    "line": 144,
    "engine": "browser",
    "bucket": "taste",
    "text": "A blinking text cursor animated into a hero or landing section simulates typing where no input exists. It borrows the dev-tool aesthetic as decoration. Real editable fields draw their own caret; anywhere else, let the composition hold attention without a fake prompt."
  },
  {
    "id": "shape-assembled-illustration",
    "name": "Shape-assembled illustration",
    "cat": "slop",
    "sev": "advisory",
    "line": 154,
    "engine": "source",
    "bucket": "taste",
    "text": "A large inline SVG that builds a pictorial scene from a pile of primitive shapes reads as placeholder clip art, not illustration. Icons, logos, and data graphics are fine at their scale; a hero-sized visual deserves real artwork, a photograph, or a deliberately drawn graphic."
  },
  {
    "id": "organic-clip-path",
    "name": "Organic contour drawn as clip-path",
    "cat": "quality",
    "sev": "warning",
    "line": 164,
    "engine": "source",
    "bucket": "taste",
    "text": "A clip-path polygon with many arbitrary vertices, or a curved clip-path path(), is CSS approximating a torn edge, blob, or silhouette. It reads as the cheap version of the effect and is usually a produced or photographic material replaced with code. Derive an alpha matte from the real image, or ship the shape as a cut-out raster; keep clip-path for geometry (cut corners, diagonals, hexagons)."
  },
  {
    "id": "buried-raster",
    "name": "Raster buried under a wash or opacity",
    "cat": "quality",
    "sev": "warning",
    "line": 174,
    "engine": "source",
    "bucket": "defect",
    "text": "A background image under a near-opaque gradient wash, or a raster on an element at near-zero opacity, never reaches the screen: the page shows the wash, and the produced texture or photo ships as a compliance token. Let the material show (a tint under 0.9 alpha, a blend mode, an opacity you can see) or remove the file."
  },
  {
    "id": "dark-glow",
    "name": "Glowing shadow accents",
    "cat": "slop",
    "sev": "warning",
    "line": 184,
    "engine": "source",
    "bucket": "taste",
    "text": "Colored glow shadows — a zero-offset chromatic halo (box- or text-shadow) on any background, or any colored blurred shadow on a dark background — are the default \"cool\" look of AI-generated UIs. Use neutral elevation shadows and subtle, purposeful lighting instead."
  },
  {
    "id": "radial-halo",
    "name": "Radial-gradient background halo",
    "cat": "slop",
    "sev": "warning",
    "line": 194,
    "engine": "source",
    "bucket": "taste",
    "text": "A chromatic radial-gradient wash — saturated at the center, fading to transparent — used as a decorative background glow on a dark page. Same tell as glowing shadows, drawn with a gradient instead of a shadow. Ground the surface with a solid or subtly shifted background instead."
  },
  {
    "id": "radial-spotlight-glow",
    "name": "Decorative radial spotlight glow",
    "cat": "slop",
    "sev": "warning",
    "line": 204,
    "engine": "source",
    "bucket": "taste",
    "text": "An accent-colored radial gradient fading to transparent, dropped behind a hero or section as a \"spotlight\" and bright enough against that surface to read as a cloud floating over the copy. It is a reflex AI decoration — the translucent cousin of the saturated radial halo. Let the surface stand on its own, or light the composition with a deliberate material accent rather than a floating colored haze."
  },
  {
    "id": "marquee",
    "name": "Auto-scrolling marquee",
    "cat": "slop",
    "sev": "warning",
    "line": 214,
    "engine": "source",
    "bucket": "taste",
    "text": "Continuously auto-scrolling content demands attention it has not earned and hides half its content at any moment. Reserve motion for content that changes; let readers move at their own pace."
  },
  {
    "id": "icon-tile-stack",
    "name": "Icon tile stacked above heading",
    "cat": "slop",
    "sev": "warning",
    "line": 224,
    "engine": "source",
    "bucket": "taste",
    "text": "A small rounded-square icon container above a heading is the universal AI feature-card template — every generator outputs this exact shape. Try a side-by-side icon and heading, or let the icon sit in flow without its own container."
  },
  {
    "id": "italic-serif-display",
    "name": "Italic serif display headline",
    "cat": "slop",
    "sev": "warning",
    "line": 234,
    "engine": "source",
    "bucket": "taste",
    "text": "Oversized italic serif (Fraunces, Recoleta, Playfair, Newsreader-italic) as the primary hero headline reads as taste in isolation but has become the universal AI-startup landing page hero. Set roman, or move to a non-serif display face. Editorial / magazine register may legitimately want this — judge by context."
  },
  {
    "id": "hero-eyebrow-chip",
    "name": "Hero eyebrow / pill chip",
    "cat": "slop",
    "sev": "warning",
    "line": 244,
    "engine": "source",
    "bucket": "taste",
    "text": "A tiny uppercase letter-spaced label sitting immediately above an oversized hero headline — or the same shape rendered as a pill chip — is now the default AI SaaS hero. Drop the eyebrow, integrate the kicker into the headline, or run it as a navigation breadcrumb instead."
  },
  {
    "id": "kicker-above-heading",
    "name": "Kicker / eyebrow label above heading",
    "cat": "slop",
    "sev": "warning",
    "line": 254,
    "engine": "source",
    "bucket": "taste",
    "text": "A tiny tracked uppercase or small-caps label sitting as its own block directly above a heading is banned outright, repeated or not. Generated kickers never earn their place: the heading carries its own weight. Delete the label and let the heading speak; if the words matter, work them into the heading or the body."
  },
  {
    "id": "numbered-section-labels",
    "name": "Tiny numbered section labels",
    "cat": "slop",
    "sev": "advisory",
    "line": 264,
    "engine": "source",
    "bucket": "taste",
    "text": "Small numeric index labels riding next to section headings, repeated section after section, are AI editorial scaffolding — a page numbering its own chapters instead of earning structure. Let hierarchy, content, and rhythm carry the sequence."
  },
  {
    "id": "em-dash-overuse",
    "name": "Em-dash overuse",
    "cat": "slop",
    "sev": "advisory",
    "line": 274,
    "engine": "source",
    "bucket": "taste",
    "text": "Em-dash saturation in body copy is an AI cadence tell. Advisory only: humans use em-dashes legitimately, so this fires only on saturation — at least 8 em-dashes (— or --) at a density near one per 500 characters of body text — never on a long article that uses a few. Prefer commas, colons, periods, or parentheses."
  },
  {
    "id": "marketing-buzzword",
    "name": "Marketing buzzword",
    "cat": "slop",
    "sev": "warning",
    "line": 284,
    "engine": "source",
    "bucket": "taste",
    "text": "Generic SaaS phrases (streamline / empower / supercharge / world-class / enterprise-grade / next-generation / cutting-edge / etc) are instant AI tells. Pick a specific verb and noun that says what the product literally does."
  },
  {
    "id": "aphoristic-cadence",
    "name": "Aphoristic-cadence copy",
    "cat": "slop",
    "sev": "warning",
    "line": 294,
    "engine": "source",
    "bucket": "taste",
    "text": "Three or more sections landing on a short rebuttal sentence (\"X. No Y.\" / \"X. Just Y.\") or a manufactured-contrast aphorism (\"Not a feature. A platform.\") reads as AI cadence, not voice. Once is fine; the pattern is the tell."
  },
  {
    "id": "oversized-h1",
    "name": "Oversized hero headline",
    "cat": "slop",
    "sev": "warning",
    "line": 304,
    "engine": "source",
    "bucket": "taste",
    "text": "A full-sentence headline set at display size ends up dominating the viewport, leaving no room for anything else above the fold. A punchy one- or two-word headline at that size is fine — the problem is a long headline blown up too large. Set long headlines smaller, or tighten the copy."
  },
  {
    "id": "extreme-negative-tracking",
    "name": "Crushed letter spacing",
    "cat": "slop",
    "sev": "warning",
    "line": 314,
    "engine": "source",
    "bucket": "taste",
    "text": "Letter-spacing pulled tighter than the point where characters keep their own shapes costs legibility. Tighten display type optically, not destructively."
  },
  {
    "id": "broken-image",
    "name": "Broken or placeholder image",
    "cat": "quality",
    "sev": "warning",
    "line": 324,
    "engine": "source",
    "bucket": "defect",
    "text": "<img> tags with empty src, missing src, or placeholder values ship as broken-image boxes. Use real images, generated assets, or remove the tag."
  },
  {
    "id": "script-error",
    "name": "Uncaught script error on load",
    "cat": "quality",
    "sev": "error",
    "line": 334,
    "engine": "browser",
    "bucket": "defect",
    "text": "A script threw an uncaught exception or failed to parse while the page loaded. Broken JavaScript silently kills reveals, interactions, and dynamic content, and can leave most of a page invisible. Fix the error before judging anything else."
  },
  {
    "id": "content-hidden-at-rest",
    "name": "Content invisible at rest",
    "cat": "quality",
    "sev": "error",
    "line": 344,
    "engine": "browser",
    "bucket": "defect",
    "text": "A large share of the page text sits at opacity 0 or visibility hidden even after every reveal handler had a chance to run. This is the failed-reveal signature: the content shipped but never becomes visible. Make content visible by default and let JavaScript enhance its entrance instead of gating its existence."
  },
  {
    "id": "edge-flush-cards",
    "name": "Cards flush against the scroller edge",
    "cat": "quality",
    "sev": "warning",
    "line": 354,
    "engine": "browser",
    "bucket": "defect",
    "text": "Cards inside a horizontal scroller or tab panel sit flush against the container edge at rest while keeping a gutter on the other side, so their edges and rounded corners get cut off. Usually the panel is sized wider than its clip box. Keep a consistent inset on both sides."
  },
  {
    "id": "text-occlusion",
    "name": "Text occluded by an overlapping element",
    "cat": "quality",
    "sev": "warning",
    "line": 364,
    "engine": "browser",
    "bucket": "defect",
    "text": "Text is painted under an opaque element or a second text run, so part of it cannot be read. A decorative box, a stacked layer, or an inline element with leaked padding lands on the words instead of beside them. Give overlapping layers room, or move the text out from under the layer above it."
  },
  {
    "id": "first-viewport-column-overflow",
    "name": "One column stretches the first viewport",
    "cat": "quality",
    "sev": "warning",
    "line": 374,
    "engine": "browser",
    "bucket": "defect",
    "text": "A multi-column opening section lets one column run far past the fold while its sibling fits in a single viewport, so the short column floats in dead space and the fold falls deep inside one section. Balance the columns, cap the tall one, or let the long content flow below the opening row."
  },
  {
    "id": "gray-on-color",
    "name": "Gray text on colored background",
    "cat": "quality",
    "sev": "warning",
    "line": 384,
    "engine": "source",
    "bucket": "reading",
    "text": "Gray text looks washed out on colored backgrounds. Use a darker shade of the background color instead, or white/near-white for contrast."
  },
  {
    "id": "low-contrast",
    "name": "Low contrast text",
    "cat": "quality",
    "sev": "warning",
    "line": 394,
    "engine": "source",
    "bucket": "reading",
    "text": "Text does not meet WCAG AA contrast requirements (4.5:1 for body, 3:1 for large text). Increase the contrast between text and background."
  },
  {
    "id": "line-length",
    "name": "Line length too long",
    "cat": "quality",
    "sev": "warning",
    "line": 404,
    "engine": "browser",
    "bucket": "reading",
    "text": "Text lines wider than ~80 characters are hard to read. The eye loses its place tracking back to the start of the next line, so it is measured on the lines that rendered and charged when more than one of them runs long. Add a max-width (65ch to 75ch) to text containers."
  },
  {
    "id": "cramped-padding",
    "name": "Cramped padding",
    "cat": "quality",
    "sev": "warning",
    "line": 414,
    "engine": "browser",
    "bucket": "reading",
    "text": "Text is too close to the edge of its container. Two shapes: (1) an element with its own text where the space between the rendered text and the border box is too small for the font size, and (2) a wrapper whose children's text lands flush against a visible boundary (border, outline, or non-transparent background) with nothing to inset it. Add at least 8px (ideally 12–16px) of space inside bordered, outlined, or colored containers."
  },
  {
    "id": "body-text-viewport-edge",
    "name": "Body text touching viewport edge",
    "cat": "quality",
    "sev": "warning",
    "line": 424,
    "engine": "browser",
    "bucket": "reading",
    "text": "Body paragraphs render flush against the left or right viewport edge with no container providing horizontal padding: closer than 16px, or 12px on viewports 480px wide or narrower. Wrap content in a container with at least 16px (ideally 24-32px) of horizontal padding, or apply max-width with mx-auto. Body text that runs past the viewport edge is reported once per page as overflow, naming the widest element: constrain that element's width instead of adding padding."
  },
  {
    "id": "tight-leading",
    "name": "Tight line height",
    "cat": "quality",
    "sev": "warning",
    "line": 434,
    "engine": "source",
    "bucket": "reading",
    "text": "Line height below 1.3x the font size makes multi-line text hard to read. Use 1.5 to 1.7 for body text so lines have room to breathe."
  },
  {
    "id": "skipped-heading",
    "name": "Skipped heading level",
    "cat": "quality",
    "sev": "warning",
    "line": 444,
    "engine": "source",
    "bucket": "reading",
    "text": "Heading levels should not skip (e.g. h1 then h3 with no h2). Screen readers use heading hierarchy for navigation. Skipping levels breaks the document outline."
  },
  {
    "id": "heading-rhythm",
    "name": "Heading crowded against the previous block",
    "cat": "quality",
    "sev": "warning",
    "line": 454,
    "engine": "browser",
    "bucket": "reading",
    "text": "A heading binds to the content it introduces, so the rendered space above it should exceed the space below it. When headings across a page sit as close or closer to the block above than to their own content, every section reads as if it captions the previous one. Open up the space above each heading."
  },
  {
    "id": "justified-text",
    "name": "Justified text",
    "cat": "quality",
    "sev": "warning",
    "line": 464,
    "engine": "source",
    "bucket": "reading",
    "text": "In a column this narrow, justifying without hyphenation stretches the word spaces until vertical rivers of white run down the block. Use text-align: left, widen the measure, or enable hyphens: auto if you must justify. Scripts that justify on a character grid or by elongating glyphs, such as CJK, Thai and Arabic, are not affected and are not reported."
  },
  {
    "id": "tiny-text",
    "name": "Tiny body text",
    "cat": "quality",
    "sev": "warning",
    "line": 474,
    "engine": "source",
    "bucket": "reading",
    "text": "Body text below 12px is hard to read, especially on high-DPI screens. Use at least 14px for body content, 16px is ideal."
  },
  {
    "id": "undersized-ui-text",
    "name": "Undersized functional text",
    "cat": "quality",
    "sev": "warning",
    "line": 484,
    "engine": "source",
    "bucket": "reading",
    "text": "Interactive and content-bearing UI text (links, buttons, nav items, labels, table cells, meta rows, timecodes) below 11px is a legibility failure, not a style choice. WCAG sets no absolute pixel floor, but functional text under 11px is a defensible quality bar: it fails on high-DPI and small viewports and it degrades tap and read targets. The 11px floor holds even inside a footer; only non-interactive legal smallprint gets the softer 10px floor. Being ON the DESIGN.md size ramp does not exempt a value here: adding 8px to the ramp launders the token but not the legibility problem, and that is exactly the escape hatch this rule closes. Exempts sup/sub, visually-hidden (sr-only) text, and code/terminal contexts. Decorative letterspaced micro-labels are still functional and stay in scope."
  },
  {
    "id": "all-caps-body",
    "name": "All-caps body text",
    "cat": "quality",
    "sev": "warning",
    "line": 494,
    "engine": "source",
    "bucket": "reading",
    "text": "Long passages in uppercase are hard to read. We recognize words by shape (ascenders and descenders), which all-caps removes. Reserve uppercase for short labels and headings. Only a run that reads as a sentence counts: 80 characters or more of an element's own text. Buttons, nav items, kickers and eyebrows set in caps are a convention and stay silent."
  },
  {
    "id": "wide-tracking",
    "name": "Wide letter spacing on body text",
    "cat": "quality",
    "sev": "warning",
    "line": 504,
    "engine": "source",
    "bucket": "reading",
    "text": "Letter spacing above 0.05em on body text disrupts natural character groupings and slows reading. Reserve wide tracking for short uppercase labels only."
  },
  {
    "id": "text-overflow",
    "name": "Content overflowing its container",
    "cat": "quality",
    "sev": "warning",
    "line": 514,
    "engine": "browser",
    "bucket": "defect",
    "text": "Content renders wider than its container and the spill does harm: a clipping ancestor cuts it off, it runs into another box, or it reaches the viewport edge. Let text wrap, constrain widths, or give the region a deliberate scroll affordance."
  },
  {
    "id": "repeated-container-text",
    "name": "Same text repeated inside one container",
    "cat": "quality",
    "sev": "warning",
    "line": 524,
    "engine": "source",
    "bucket": "taste",
    "text": "The same literal text rendered three or more times in structurally different spots inside a single card or panel is redundant messaging — usually a status or label wired into every slot of a template. Say it once, in the slot where it matters most."
  },
  {
    "id": "clipped-overflow-container",
    "name": "Positioned child clipped by overflow container",
    "cat": "quality",
    "sev": "advisory",
    "line": 534,
    "engine": "browser",
    "bucket": "defect",
    "text": "A clipping container (overflow hidden or clip) wrapping an absolutely-positioned child cuts off tooltips, menus, and popovers that need to escape. Let the overflow be visible, or move the positioned layer out of the clip."
  },
  {
    "id": "design-system-font",
    "name": "Font outside DESIGN.md",
    "cat": "quality",
    "sev": "warning",
    "line": 544,
    "engine": "source",
    "bucket": "system",
    "text": "A font is used that is not declared in DESIGN.md typography. Use the documented type system or update DESIGN.md if this is an intentional brand addition."
  },
  {
    "id": "design-system-color",
    "name": "Color outside DESIGN.md",
    "cat": "quality",
    "sev": "advisory",
    "line": 554,
    "engine": "source",
    "bucket": "system",
    "text": "A literal color is outside the DESIGN.md palette and sidecar tonal ramps. This may be legitimate, but it should be an intentional design-system addition rather than drift."
  },
  {
    "id": "design-system-radius",
    "name": "Radius outside DESIGN.md",
    "cat": "quality",
    "sev": "advisory",
    "line": 564,
    "engine": "source",
    "bucket": "system",
    "text": "A border-radius value is outside the DESIGN.md rounded scale. Use a documented radius token or update the design system if the new shape is intentional."
  },
  {
    "id": "design-system-font-size",
    "name": "Font size outside DESIGN.md",
    "cat": "quality",
    "sev": "advisory",
    "line": 574,
    "engine": "source",
    "bucket": "system",
    "text": "A literal font-size is off the type ramp documented in DESIGN.md typography. Use a documented size step or update the design system if the new step is intentional."
  },
  {
    "id": "gpt-thin-border-wide-shadow",
    "name": "Hairline border with wide shadow",
    "cat": "slop",
    "sev": "advisory",
    "line": 584,
    "engine": "source",
    "bucket": "taste",
    "text": "Every card of this row wears a hairline border paired with a wide, diffuse shadow, which is a recurring generated-UI signature. One floating panel earns both; a whole row wearing them reads as a default nobody chose. Across the row, commit to one: a defined edge or a soft elevation."
  },
  {
    "id": "repeating-stripes-gradient",
    "name": "Repeating-gradient stripes",
    "cat": "slop",
    "sev": "advisory",
    "line": 594,
    "engine": "source",
    "bucket": "taste",
    "text": "Repeating-gradient stripes used as surface decoration are a recurring generated-UI signature. Reach for a deliberate texture or leave the surface plain."
  },
  {
    "id": "codex-grid-background",
    "name": "Decorative grid-line background",
    "cat": "slop",
    "sev": "advisory",
    "line": 604,
    "engine": "source",
    "bucket": "taste",
    "text": "A decorative grid or line-field background drawn with hairline linear-gradient layers tiled by a fixed pixel cell is a recurring generated-UI signature. Reserve grid overlays for actual canvas, map, blueprint, or measurement surfaces; elsewhere use product structure or a plain surface."
  },
  {
    "id": "theater-slop-phrase",
    "name": "Theater framing copy",
    "cat": "slop",
    "sev": "advisory",
    "line": 614,
    "engine": "source",
    "bucket": "taste",
    "text": "Dismissing something as \"theater\" is a recurring generated-copy tic. Say plainly what the thing does or does not do."
  },
  {
    "id": "glassmorphism",
    "name": "Glassmorphism everywhere",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "Blur effects, glass cards, and glow borders used as decoration rather than to solve a real layering problem."
  },
  {
    "id": "over-round",
    "name": "Extreme border-radius on cards",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "Large corner radii can squeeze the content and make every card look alike. Reduce the curve to suit the card’s size and give its contents room."
  },
  {
    "id": "sketchy-svg",
    "name": "Rough SVG illustrations",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "A hastily drawn mascot or scene can make a finished page feel unfinished. Use a well-made illustration or photo, or leave it out."
  },
  {
    "id": "single-font",
    "name": "Single font for everything",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "One font family can work well across a whole page. If everything feels flat, vary size, weight, and spacing before deciding whether a second family would help."
  },
  {
    "id": "hero-metric-layout",
    "name": "Hero metric layout",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "A huge number with a small label and supporting stats is a familiar landing-page template. Lead with a metric when it helps explain the product, and give it enough context to mean something."
  },
  {
    "id": "identical-card-grids",
    "name": "Identical card grids",
    "cat": "slop",
    "sev": "review",
    "line": 0,
    "engine": "review",
    "bucket": "review",
    "text": "Repeated icon, heading, and text cards give every point the same weight. Group related ideas and vary the layout when the content needs different treatment."
  }
]
