"use client"

import { useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from "react"
import { CaretRightIcon } from "@phosphor-icons/react/dist/ssr"

import { cn } from "@/lib/utils"

// An IDE-style file tree shared by the article's two trees (the served files and the game
// folder). ARIA tree pattern, flat form: every row is a treeitem with aria-level, setsize and
// posinset. Roving tabindex; Up/Down move, Right opens or steps in, Left closes or steps out,
// Home/End jump, Enter/Space select (and open or close a folder).

export type TreeItem = {
  id: string
  label: string
  icon?: ReactNode
  meta?: ReactNode
  below?: ReactNode
  dim?: boolean
  children?: TreeItem[]
}

type Row = { item: TreeItem; depth: number; parent: string | null; pos: number; size: number }

const INDENT = 14

function flatten(items: TreeItem[], open: Set<string>, depth: number, parent: string | null, out: Row[]): Row[] {
  items.forEach((item, i) => {
    out.push({ item, depth, parent, pos: i + 1, size: items.length })
    if (item.children && open.has(item.id)) flatten(item.children, open, depth + 1, item.id, out)
  })
  return out
}

export function TreeView({
  items,
  label,
  selected,
  onSelect,
  defaultExpanded = [],
  className,
}: {
  items: TreeItem[]
  label: string
  selected?: string
  onSelect?: (id: string) => void
  defaultExpanded?: string[]
  className?: string
}) {
  const [open, setOpen] = useState(() => new Set(defaultExpanded))
  const [focus, setFocus] = useState<string | undefined>(selected)
  const refs = useRef(new Map<string, HTMLLIElement>())
  const rows = useMemo(() => flatten(items, open, 0, null, []), [items, open])
  const focusId = rows.some((r) => r.item.id === focus) ? focus : (selected ?? rows[0]?.item.id)

  const setExpanded = (id: string, want: boolean) =>
    setOpen((prev) => {
      if (prev.has(id) === want) return prev
      const next = new Set(prev)
      if (want) next.add(id)
      else next.delete(id)
      return next
    })
  const moveTo = (id: string | undefined) => {
    if (!id) return
    setFocus(id)
    refs.current.get(id)?.focus()
  }
  const activate = (row: Row) => {
    setFocus(row.item.id)
    onSelect?.(row.item.id)
    if (row.item.children) setExpanded(row.item.id, !open.has(row.item.id))
  }

  const onKey = (e: KeyboardEvent<HTMLLIElement>, i: number) => {
    const row = rows[i]
    const kids = row.item.children
    const isOpen = open.has(row.item.id)
    let handled = true
    switch (e.key) {
      case "ArrowDown":
        moveTo(rows[i + 1]?.item.id)
        break
      case "ArrowUp":
        moveTo(rows[i - 1]?.item.id)
        break
      case "Home":
        moveTo(rows[0]?.item.id)
        break
      case "End":
        moveTo(rows[rows.length - 1]?.item.id)
        break
      case "ArrowRight":
        if (kids && !isOpen) setExpanded(row.item.id, true)
        else if (kids) moveTo(kids[0]?.id)
        break
      case "ArrowLeft":
        if (kids && isOpen) setExpanded(row.item.id, false)
        else moveTo(row.parent ?? undefined)
        break
      case "Enter":
      case " ":
        activate(row)
        break
      default:
        handled = false
    }
    if (handled) {
      e.preventDefault()
      e.stopPropagation()
    }
  }

  return (
    <ul role="tree" aria-label={label} className={cn("m-0 list-none p-0 font-mono text-xs", className)}>
      {rows.map((row, i) => {
        const { item, depth } = row
        const kids = !!item.children
        const isOpen = open.has(item.id)
        const isSel = selected === item.id
        return (
          <li
            key={item.id}
            ref={(el) => {
              if (el) refs.current.set(item.id, el)
              else refs.current.delete(item.id)
            }}
            role="treeitem"
            aria-level={depth + 1}
            aria-setsize={row.size}
            aria-posinset={row.pos}
            aria-expanded={kids ? isOpen : undefined}
            aria-selected={onSelect ? isSel : undefined}
            tabIndex={focusId === item.id ? 0 : -1}
            onKeyDown={(e) => onKey(e, i)}
            onFocus={() => setFocus(item.id)}
            onClick={() => activate(row)}
            className={cn(
              "relative m-0 cursor-pointer list-none p-0 outline-none select-none",
              "focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
              isSel ? "bg-muted" : "hover:bg-muted/50",
            )}
          >
            {Array.from({ length: depth }, (_, k) => (
              <span
                key={k}
                aria-hidden
                className="pointer-events-none absolute inset-y-0 w-px bg-border"
                style={{ left: k * INDENT + 14 }}
              />
            ))}
            <div className="flex min-h-7 items-center gap-1.5 py-1 pr-3" style={{ paddingLeft: depth * INDENT + 8 }}>
              {kids ? (
                <CaretRightIcon
                  aria-hidden
                  weight="bold"
                  className={cn("size-3 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                />
              ) : (
                <span aria-hidden className="size-3 shrink-0" />
              )}
              {item.icon && (
                <span aria-hidden className="flex shrink-0 items-center">
                  {item.icon}
                </span>
              )}
              <span className={cn("min-w-0 truncate", item.dim ? "text-muted-foreground italic" : "text-foreground")}>
                {item.label}
              </span>
              {item.meta !== undefined && (
                <span className="ml-auto shrink-0 pl-3 text-right text-[11px] text-muted-foreground tabular-nums">
                  {item.meta}
                </span>
              )}
            </div>
            {item.below && (
              <div className="pr-3 pb-1.5" style={{ paddingLeft: depth * INDENT + 8 + 12 + 6 }}>
                {item.below}
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}
