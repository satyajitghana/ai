import type { MetadataRoute } from "next"

import { absoluteUrl } from "@/lib/site"

// Welcoming crawler posture: everyone is allowed, AI crawlers explicitly so.
export default function robots(): MetadataRoute.Robots {
  const aiCrawlers = [
    "GPTBot",
    "OAI-SearchBot",
    "ChatGPT-User",
    "ClaudeBot",
    "Claude-User",
    "Claude-SearchBot",
    "anthropic-ai",
    "PerplexityBot",
    "Google-Extended",
    "Applebot-Extended",
    "CCBot",
    "Bytespider",
    "meta-externalagent",
  ]

  return {
    rules: [
      { userAgent: "*", allow: "/" },
      ...aiCrawlers.map((userAgent) => ({ userAgent, allow: "/" })),
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  }
}
