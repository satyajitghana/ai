# Select text → Ask AI

**Status:** parked (2026-10-07). Design agreed in conversation; not built.

## What

A reader selects a passage in an article and a small "Ask AI" button appears
next to the selection. Clicking it opens a panel (a side sheet on desktop, a
bottom sheet on phones) with the selection as a quote chip and a few quick
actions: *explain simply*, *summarise this section*, *what does this term
mean*, and a free-form question box. The answer streams into the panel.

## Why

Articles here are long and technical. A reader stuck on one paragraph should
be able to ask about that paragraph without leaving the page or retyping it.
It also makes the existing grounded assistant (`/api/ask`, `/api/chat`)
discoverable at the moment it is useful.

## How

- **No special browser API is needed.** Listen to `selectionchange` (debounced),
  read `window.getSelection()`, take `getRangeAt(0).getBoundingClientRect()`,
  and position a floating button over it. Show it only when the selection
  sits inside the article body (`article` element) and is between ~3 and
  ~1,500 characters.
- **Mobile:** iOS and Android always show their own copy / look-up callout on a
  selection, and a page cannot remove it. Place our button below the selection
  (the native bar sits above) so the two do not collide. Never suppress the
  native menu: that breaks copy.
- **Keyboard:** a shortcut (e.g. `?` with a selection) opens the panel; the
  button is a real `<button>` reachable by Tab; `Esc` closes the panel.
- **Backend:** send `{selection, question, slug, title, url}` to `/api/ask`
  (already rate-limited per client, already grounded on the site). The quote
  and the article's own context go in the prompt so the answer is about this
  passage, not the topic in general.
- **Offline:** when `isChatOnline()` is false the button does not render.
- **On-device fast path (optional, see [in-browser-llm.md](in-browser-llm.md)):** where
  the browser has a built-in model (Chrome's Prompt API), answer the quick
  actions locally and mark the answer "on-device"; free-form questions that
  need the rest of the site still go to the server.
- **Scope:** article pages and architecture docs first; not on `/math`, which
  has its own panel.

## Open questions

- Should answers be shareable (a link to the passage plus the answer)?
- Rate-limit budget per visitor per day, and what the button shows once it is
  spent.
- Analytics: count opens and quick-action choice (no selection text stored).
- Does `pnpm check:spacing` need a rule for the injected button?
