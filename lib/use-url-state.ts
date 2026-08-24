"use client"

import { useCallback, useSyncExternalStore } from "react"

// Shareable list state (filter, sort, page) read from the query string during
// render instead of restored from a mount effect.
//
// The effect version worked and had two costs. It rendered the default view
// first and the real one a beat later, so opening a shared `?filter=featured`
// link flashed the unfiltered list; and it set state synchronously inside an
// effect, which React's set-state-in-effect rule flags because that is what
// causes the extra render pass.
//
// useSyncExternalStore supplies the value during the first render. The server
// snapshot is an empty query string, so the prerendered HTML and the first
// client render agree and hydration is clean; React then re-renders with the
// real snapshot, which is precisely what getServerSnapshot exists for.
//
// The URL is the single source of truth here — there is no duplicate copy in
// component state to drift from it. `history.replaceState` does not emit
// `popstate`, so `setParams` announces its own writes on a private event and
// the subscription listens for both. A consequence worth having: the browser's
// Back button now moves through filter changes, which the effect version could
// not do because it only ever read the URL once.

const URL_STATE_EVENT = "urlstatechange"

function subscribe(onStoreChange: () => void) {
  window.addEventListener("popstate", onStoreChange)
  window.addEventListener(URL_STATE_EVENT, onStoreChange)
  return () => {
    window.removeEventListener("popstate", onStoreChange)
    window.removeEventListener(URL_STATE_EVENT, onStoreChange)
  }
}

// Must be referentially stable across calls for the same URL: a string is.
const getSnapshot = () => window.location.search
const getServerSnapshot = () => ""

/**
 * Derive state from the query string, and write it back.
 *
 * @param parse maps the current params to the shape the component wants. Called
 *   during render, so it must be pure and must return defaults for an empty
 *   query string — that is the server snapshot.
 * @returns the parsed value, and a setter taking a mutator that edits a copy of
 *   the current params.
 */
export function useUrlState<T>(parse: (params: URLSearchParams) => T): [
  T,
  (mutate: (params: URLSearchParams) => void) => void,
] {
  const search = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const value = parse(new URLSearchParams(search))

  const setParams = useCallback((mutate: (params: URLSearchParams) => void) => {
    const params = new URLSearchParams(window.location.search)
    mutate(params)
    const qs = params.toString()
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname)
    window.dispatchEvent(new Event(URL_STATE_EVENT))
  }, [])

  return [value, setParams]
}
