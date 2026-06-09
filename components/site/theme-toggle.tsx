"use client"

import { useTheme } from "next-themes"
import { CircleHalfIcon } from "@phosphor-icons/react/dist/ssr"

// Theme toggle. The glyph is theme-independent (identical server + client → no
// hydration mismatch, no mounted-state effect). Default theme is "system".
export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()

  return (
    <button
      type="button"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="flex cursor-pointer items-center text-muted-foreground transition-colors hover:text-foreground"
      aria-label="Toggle theme (or press d)"
      title="Toggle theme (d)"
    >
      <CircleHalfIcon size={16} weight="fill" />
    </button>
  )
}
