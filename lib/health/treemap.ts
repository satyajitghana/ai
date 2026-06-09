// Server-side squarified treemap layout. Runs at request/build time inside a
// server component — d3-hierarchy is pure math, no DOM required.

import {
  hierarchy,
  treemap,
  treemapSquarify,
  type HierarchyRectangularNode,
} from "d3-hierarchy"

import type { Biomarker } from "@/data/health"

export type TreemapCell = {
  marker: Biomarker
  // Normalized 0–100 percentage coordinates (top-left origin).
  x0: number
  y0: number
  x1: number
  y1: number
}

type Root = { children: Biomarker[] }

// Lay biomarkers out as a squarified treemap. `aspect` is width / height of the
// target container (default 16/10 to match the biomap card). Output coordinates
// are normalized to 0–100 (percentages) regardless of the aspect ratio, so the
// consumer can position cells with `left/top/right/bottom` percentages.
export function layoutTreemap(
  biomarkers: Biomarker[],
  aspect = 16 / 10
): TreemapCell[] {
  if (biomarkers.length === 0) return []

  // Internal layout space — area is what matters, aspect drives cell shape.
  const width = 100 * aspect
  const height = 100

  const root = hierarchy<Root | Biomarker>(
    { children: biomarkers },
    (node) => ("children" in node ? node.children : undefined)
  )
    .sum((node) => ("children" in node ? 0 : (node.weight ?? 1)))
    // Larger weights first → more stable, readable squarified layout.
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0))

  const layout = treemap<Root | Biomarker>()
    .tile(treemapSquarify)
    .size([width, height])
    .paddingInner(0)
    .round(false)

  layout(root as HierarchyRectangularNode<Root | Biomarker>)

  const leaves = (root as HierarchyRectangularNode<Root | Biomarker>).leaves()

  return leaves.map((leaf) => {
    const marker = leaf.data as Biomarker
    return {
      marker,
      x0: (leaf.x0 / width) * 100,
      y0: (leaf.y0 / height) * 100,
      x1: (leaf.x1 / width) * 100,
      y1: (leaf.y1 / height) * 100,
    }
  })
}

// Area of a cell in percentage-points² (0–10000). Used to decide whether a cell
// is large enough to render a full status caption vs. a compact status dot.
export function cellArea(cell: TreemapCell): number {
  return (cell.x1 - cell.x0) * (cell.y1 - cell.y0)
}
