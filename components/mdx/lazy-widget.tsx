"use client"

// Renders one article widget, loaded on demand. MDX imports of client widgets
// are rewritten to this component at compile time (lib/mdx/remark-lazy-widgets.mjs),
// so a page fetches the chunks of the widgets it renders and no others.
//
// `__w` is "<module under components/articles>#<export>". The registry is
// generated (scripts/gen-widget-registry.mts) because each import() needs a
// literal path to become its own chunk. Suspense with a null fallback keeps the
// server-rendered HTML on screen until the chunk arrives, so nothing flashes.

import { Suspense, lazy, type ComponentType } from "react"

import { WIDGETS } from "./widget-registry.generated"

type AnyProps = Record<string, unknown>
const cache = new Map<string, ComponentType<AnyProps>>()

function widget(key: string): ComponentType<AnyProps> {
  let C = cache.get(key)
  if (!C) {
    const [file, name] = key.split("#")
    const load = WIDGETS[file]
    if (!load) throw new Error(`Unknown article widget "${file}": run pnpm gen:widgets`)
    C = lazy(() =>
      load().then((mod) => {
        const component = mod[name] as ComponentType<AnyProps> | undefined
        if (!component) throw new Error(`"${file}" has no export "${name}"`)
        return { default: component }
      }),
    )
    cache.set(key, C)
  }
  return C
}

export function LazyWidget({ __w, ...props }: { __w: string } & AnyProps) {
  const C = widget(__w)
  return (
    <Suspense fallback={null}>
      {/* eslint-disable-next-line react-hooks/static-components -- `widget` caches one component per key, so every render gets the same type and state survives */}
      <C {...props} />
    </Suspense>
  )
}
