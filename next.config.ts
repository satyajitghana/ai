import type { NextConfig } from "next"
import createMDX from "@next/mdx"

const nextConfig: NextConfig = {
  // Let .md / .mdx files act as pages/imports alongside ts/tsx.
  pageExtensions: ["ts", "tsx", "js", "jsx", "md", "mdx"],
  // public/ must never reach a serverless function — Vercel serves it from the
  // CDN. It was reaching them anyway: <Receipts> and lib/markdown.ts read their
  // committed JSON with readFileSync(join(process.cwd(), "public", src)), and
  // because `src` is not a literal the tracer cannot tell which file is wanted,
  // so it conservatively pulled in ALL of public/. That is 214 MB of figures and
  // video, and <Receipts> is registered globally, so every MDX-rendering route
  // carried it: /articles/[slug] reached 266 MB against Vercel's 250 MB limit
  // and seven more routes sat just under it. Worse, it compounded — every figure
  // committed inflated eight functions at once.
  //
  // Excluding the media (never read by code) leaves the ~0.3 MB of
  // public/**/data/*.json the two readers actually want. Build-time reads are
  // unaffected: tracing only decides what ships inside a function.
  outputFileTracingExcludes: {
    "/*": [
      "./public/**/*.png",
      "./public/**/*.jpg",
      "./public/**/*.jpeg",
      "./public/**/*.webp",
      "./public/**/*.avif",
      "./public/**/*.gif",
      "./public/**/*.svg",
      "./public/**/*.ico",
      "./public/**/*.mp4",
      "./public/**/*.webm",
      "./public/**/*.mov",
      "./public/**/*.pdf",
      "./public/**/*.bin",
      // onnxruntime-web is ~140 MB of WASM and a browser runtime by definition:
      // it must never reach a server function. Without this the tracer can pull
      // it into every route reachable from a component that imports it, and
      // /articles/[slug] already sits at ~53 MB against a 250 MB hard limit.
      "./node_modules/onnxruntime-web/**",
      "./node_modules/.pnpm/onnxruntime-web*/**",
      "./node_modules/@huggingface/transformers/**",
      "./node_modules/.pnpm/@huggingface+transformers*/**",
    ],
  },
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
  // NOTE on `Vary: Accept` for the HTML half of a negotiated page.
  //
  // It belongs here, and it does not work here. A `headers()` entry lands in
  // routes-manifest.json and is then dropped on the way out: a page render
  // writes its own Vary (the RSC dimensions plus Accept-Encoding) over
  // whatever the manifest or the proxy set, verified in 16.3.2 by shipping a
  // uniquely-named probe header and watching it never arrive. The markdown half
  // is a route handler and keeps its own Vary, so the negotiated representation
  // — the one acceptmarkdown.com checks — is correctly labelled either way.
  //
  // The gap is the HTML half, where a shared cache is told the response does
  // not vary on Accept. It is closed in vercel.json, which the CDN applies
  // after the function returns and Next cannot overwrite. If this ever moves
  // off Vercel, that header has to move with it.

  // Clean `.md` variants for agents: /blog/foo.md -> /md/blog/foo, etc.
  async rewrites() {
    return [
      // Versioned alias for the JSON API. Same handlers, stable prefix: agents
      // that pin /api/v1/* keep a contract that cannot change under them, and a
      // breaking change would ship as /api/v2/* with Deprecation/Sunset headers
      // on v1. Declared first so it wins before the .md rules.
      { source: "/api/v1/:path*", destination: "/api/:path*" },
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
