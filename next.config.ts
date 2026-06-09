import type { NextConfig } from "next"
import createMDX from "@next/mdx"

const nextConfig: NextConfig = {
  // Let .md / .mdx files act as pages/imports alongside ts/tsx.
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // The chat/ask routes build their corpus from content/ at runtime — make sure
  // those files are traced into the serverless bundle on Vercel.
  outputFileTracingIncludes: {
    "/api/chat": ["./content/**/*", "./data/**/*"],
    "/api/ask": ["./content/**/*", "./data/**/*"],
    "/api/mcp/[transport]": ["./content/**/*", "./data/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
      { protocol: "https", hostname: "raw.githubusercontent.com" },
    ],
  },
  // Clean `.md` variants for agents: /blog/foo.md -> /md/blog/foo, etc.
  async rewrites() {
    return [
      { source: "/blog/:slug.md", destination: "/md/blog/:slug" },
      { source: "/articles/:slug.md", destination: "/md/articles/:slug" },
      { source: "/logs/:slug.md", destination: "/md/logs/:slug" },
      { source: "/projects/:slug.md", destination: "/md/projects/:slug" },
      { source: "/arxiv/:slug.md", destination: "/md/arxiv/:slug" },
      { source: "/snippets/:slug.md", destination: "/md/snippets/:slug" },
      { source: "/notes/:slug.md", destination: "/md/notes/:slug" },
      { source: "/about.md", destination: "/md/about" },
      { source: "/resume.md", destination: "/md/resume" },
      { source: "/health.md", destination: "/md/health" },
      { source: "/now.md", destination: "/md/now" },
      { source: "/uses.md", destination: "/md/uses" },
      { source: "/reading.md", destination: "/md/reading" },
    ]
  },
}

// Turbopack (default in Next 16) requires remark/rehype plugins as STRING NAMES,
// not imported functions — functions can't cross the JS↔Rust boundary.
// remark-frontmatter lets the MDX compiler ignore the YAML `---` block so the
// same file can be both gray-matter-read (data layer) and dynamic-import-rendered.
const withMDX = createMDX({
  options: {
    remarkPlugins: ["remark-frontmatter", "remark-gfm", "remark-math"],
    rehypePlugins: [
      "rehype-slug",
      ["rehype-pretty-code", { theme: "github-dark-dimmed" }],
      ["rehype-katex", {}],
    ],
  },
})

export default withMDX(nextConfig)
