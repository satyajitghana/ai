import type { MDXComponents } from "mdx/types"

import { mdxComponents } from "@/components/mdx"

// Required by @next/mdx with the App Router. Maps markdown-generated elements
// and the custom explainer kit (math, diagrams, interactive viz) into MDX.
export function useMDXComponents(
  components: MDXComponents = {}
): MDXComponents {
  return {
    ...mdxComponents,
    ...components,
  }
}
