"use client"

import { lazy, Suspense } from "react"

import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs"

import { ui } from "./kit"

// A live tour of the installed @ui-sdk/react 0.1.0-beta.1: fifteen of its
// components, dressed in this site's tokens, each with its keys and a readout
// from observe(). The tab list is the library's own Tabs. Each panel is its
// own chunk, loaded when its tab is first opened, so the date picker, color
// picker and command palette cost nothing until someone asks for them.
//
// The whole gallery sits inside data-agent-hidden. The agent bridge further
// down the page lists every ui-sdk component on the page, and this keeps the
// gallery out of its snapshot, which is also the mark's documented use.

const Choose = lazy(() => import("./gallery-choose"))
const Adjust = lazy(() => import("./gallery-adjust"))
const Dates = lazy(() => import("./gallery-dates"))
const Overlays = lazy(() => import("./gallery-overlays"))
const Lists = lazy(() => import("./gallery-lists"))

const TABS = [
  { value: "choose", label: "Choose", Panel: Choose, count: 4 },
  { value: "adjust", label: "Adjust", Panel: Adjust, count: 3 },
  { value: "dates", label: "Dates & codes", Panel: Dates, count: 2 },
  { value: "overlays", label: "Overlays", Panel: Overlays, count: 3 },
  { value: "lists", label: "Lists", Panel: Lists, count: 2 },
]

function Loading({ count }: { count: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="h-44 animate-pulse rounded-md border border-border bg-muted/40 motion-reduce:animate-none" />
      ))}
    </div>
  )
}

function UiSdkGallery() {
  return (
    <figure data-agent-hidden="" className="not-prose my-8 rounded-lg border border-border bg-card p-3 text-card-foreground sm:p-4">
      <figcaption className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="text-sm font-medium">UI SDK, running on this page</span>
        <code className="font-mono text-[11px] text-muted-foreground">@ui-sdk/react 0.1.0-beta.1</code>
      </figcaption>
      <Tabs defaultValue="choose">
        <TabsList
          aria-label="Component groups"
          className="-mx-3 mb-3 flex gap-1 overflow-x-auto border-b border-border px-3 [scrollbar-width:none] sm:-mx-4 sm:px-4"
        >
          {TABS.map((t) => (
            <TabsTab
              key={t.value}
              value={t.value}
              className={`-mb-px shrink-0 border-b-2 border-transparent px-2.5 py-2 text-sm whitespace-nowrap text-muted-foreground hover:text-foreground data-[selected]:border-foreground data-[selected]:text-foreground ${ui.focusRing}`}
            >
              {t.label}
            </TabsTab>
          ))}
        </TabsList>
        {TABS.map(({ value, Panel, count }) => (
          <TabsPanel key={value} value={value} className="outline-none">
            <Suspense fallback={<Loading count={count} />}>
              <Panel />
            </Suspense>
          </TabsPanel>
        ))}
      </Tabs>
      <p className="mt-3 text-xs text-muted-foreground">
        Tab into the strip above, then use ←→ to switch groups: one tab stop for the whole list. Each chip under a component
        lights when you press that key inside it, and the line under it is what <code className="font-mono">observe()</code>{" "}
        reported: the change, its reason and who made it.
      </p>
    </figure>
  )
}

export { UiSdkGallery }
