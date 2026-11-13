import type { KeyboardEvent } from "react"

// Keyboard support for the WAI-ARIA tabs pattern (automatic activation), shared
// by every article tablist. It reads the tabs from the DOM rather than taking
// an index and a setter, because the widgets key their selection differently
// (indices, string ids, generics) and some tab clicks do more than set state
// (reset a scrubber, clear a hover). Moving with the keyboard therefore clicks
// the target tab, so it runs exactly what a mouse click runs.
//
//   <div role="tablist" onKeyDown={tablistKeys()}>
//     <button role="tab" aria-selected={on} tabIndex={on ? 0 : -1} …>
//
// Pair it with a roving tabIndex on the tabs (selected 0, the rest -1) so Tab
// lands on the selected tab and the next Tab leaves the tablist.
//
// Horizontal: ArrowLeft/ArrowRight. Vertical: ArrowUp/ArrowDown. Both wrap.
// Home/End go to the first/last tab.
export function tablistKeys(orientation: "horizontal" | "vertical" = "horizontal") {
  const prev = orientation === "vertical" ? "ArrowUp" : "ArrowLeft"
  const next = orientation === "vertical" ? "ArrowDown" : "ArrowRight"

  return (e: KeyboardEvent<HTMLElement>) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return
    if (e.key !== prev && e.key !== next && e.key !== "Home" && e.key !== "End") return

    const list = e.currentTarget
    const tabs = Array.from(list.querySelectorAll<HTMLElement>('[role="tab"]')).filter(
      (t) => t.closest('[role="tablist"]') === list && !t.hasAttribute("disabled") && t.getAttribute("aria-disabled") !== "true"
    )
    const at = tabs.indexOf(e.target as HTMLElement)
    if (at < 0 || tabs.length === 0) return

    const n = tabs.length
    const to =
      e.key === "Home" ? 0 : e.key === "End" ? n - 1 : e.key === next ? (at + 1) % n : (at - 1 + n) % n

    e.preventDefault()
    if (to === at) return
    const target = tabs[to]
    target.focus()
    target.click()
  }
}
