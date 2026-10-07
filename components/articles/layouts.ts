import type { ComponentType, ReactNode } from "react"
import type { MDXContent } from "mdx/types"

import { ImpeccableLayout } from "@/components/articles/impeccable-design-skill/layout"
import type { Article } from "@/lib/content"
import type { ArticleLayoutId } from "@/lib/content/schema"
import type { Film } from "@/lib/films"

// Bespoke page shells, one per `layout:` id in an article's frontmatter
// (lib/content/schema.ts). An article without the field never reaches this
// file's components: app/articles/[slug]/page.tsx renders its default page.
//
// A shell replaces only the title block and the body column. The route keeps
// everything else: metadata and canonical (generateMetadata), the JSON-LD, and
// the end matter (related articles, citation, share), which it builds and
// passes in as `endMatter` so a shell cannot drop them by accident.
export type ArticleLayoutProps = {
  article: Article
  film: Film | null
  Body: MDXContent
  endMatter: ReactNode
  jsonLd: ReactNode
}

export const ARTICLE_LAYOUTS: Record<ArticleLayoutId, ComponentType<ArticleLayoutProps>> = {
  impeccable: ImpeccableLayout,
}
