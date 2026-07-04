# Interactive diagram quality bar (distill.pub-grade)

Our interactive components must read as **composed diagrams**, not dashboards. The failure mode
to eliminate: flat rows of colored `<div>` squares, chip rows, stat-tile grids, and text `"→"`
arrows. Rebuild those as **SVG scenes**. (Ignore typography — keep our existing `font-mono`/sans
classes and CSS-var colors; do NOT set `font-family`.)

**Reference exemplar:** `components/articles/minimax-sparse-attention/block-select.tsx` — a query
node with curved bezier arrows fanning up to only the KV blocks it attends, soft-shadow nodes,
reader scrub + group toggle + stage control. Read it before starting.

## The construction rules (from distill's own SVG)

1. **Draw in one `<svg viewBox="0 0 W H">`.** Compose on a deliberate coordinate grid; align
   nodes; leave generous whitespace. `className="w-full"` so it scales. Give it a real `role="img"`
   + `aria-label`.

2. **Nodes = rounded rects / pills** (`rx` 6–12), `fill` + a separate thin `stroke` (1.5). Use CSS
   vars so they're theme-aware: `fill="var(--background)"`, `stroke={ACCENT}` or `var(--border)`.
   Give important nodes **depth** with a soft drop-shadow filter:
   ```jsx
   <filter id="soft" x="-40%" y="-40%" width="180%" height="180%">
     <feDropShadow dx="0" dy="1" stdDeviation="1.4" floodOpacity="0.14" />
   </filter>
   // ...then filter="url(#soft)" on the node's rect
   ```

3. **Connectors = curved cubic-bezier paths** (never straight 1px divs, never text arrows),
   `fill="none" stroke-width="1.5"`, ending in a small **open-chevron** arrowhead marker:
   ```jsx
   <marker id="arrow" viewBox="0 -5 10 10" markerWidth="7" markerHeight="7" orient="auto" refX="7" refY="0">
     <path d="M0,-4L6,0L0,4" fill="none" stroke={ACCENT} strokeWidth={1.5} />
   </marker>
   // curve helper: smooth vertical S between (x1,y1)->(x2,y2)
   const my = (y1+y2)/2; const d = `M ${x1} ${y1} C ${x1} ${my}, ${x2} ${my}, ${x2} ${y2}`
   ```
   Only draw a connector where two things are **actually related** — selective arrows tell the story.

4. **Restrained palette.** One accent (oklch) + a light tint of it + muted structure via CSS vars
   (`var(--muted-foreground)`, `var(--border)`, `var(--muted)`). No rainbow of flat squares.
   Encode state with opacity/stroke, not new hues.

5. **Reader-driven, continuous.** Prefer a `range` scrubber / hover / segmented "stage" control the
   reader drives (immediate response) over a pure autoplay stepper. Keep any autoplay pausable.
   Controls live in a clean bar below the SVG.

6. **Charts** (line/area over data) are fine as SVG charts (see `paw/cost-crossover.tsx`,
   `leanstral/test-time-scaling.tsx`) — gridlines, a drawn curve, a draggable marker, live readout.
   Keep them; just make sure they're SVG, not div-bars, and elegant.

## Hard constraints (unchanged)
- **No layout shift**: grid-stack variable-height regions or reserve min-height; verify page
  `scrollHeight` is stable across animation.
- **Theme-aware**: must look right in light AND dark (use CSS vars for surfaces/structure).
- **Degrade**: `"use client"`, but SSR initial render must be sensible.
- **Preserve behavior, data, and honesty**: don't change the numbers, the mechanism, or the honest
  caveats — only the visual construction.
- Typecheck clean (`pnpm typecheck`). Don't run a dev server / Playwright (central verification).
