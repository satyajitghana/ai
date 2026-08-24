"use client"

import { useSyncExternalStore } from "react"

// True once the client has taken over, false during SSR and the first render.
//
// The usual spelling is `useState(false)` plus `useEffect(() => setMounted(true), [])`,
// which works and sets state from an effect purely to learn something React
// already knows. useSyncExternalStore says it directly: the server snapshot is
// false, the client snapshot is true, and React reconciles the two after
// hydration without a mismatch.
//
// Use it for anything that must render identically on the server and then
// change on the client — a collapsed code block that ships expanded so a no-JS
// reader still sees the whole file, a portal that needs `document`.

const subscribe = () => () => {}

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  )
}
