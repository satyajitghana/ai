// The site's discovery surface, in one place.
//
// Several published conventions want the same handful of facts — an OpenAPI
// spec, an MCP endpoint, a docs page, a llms.txt index — expressed in their own
// shape: RFC 8288 Link headers, an RFC 9727 API catalog, an ARD manifest, an MCP
// server card. Rather than restate those URLs in five files that will drift
// apart, they are declared once here and each format is projected from them.

import { siteUrl } from "@/lib/site"

const u = (path: string) => `${siteUrl}${path}`

export const MCP_ENDPOINT = u("/api/mcp/mcp")

/**
 * The API contract this deployment serves, echoed on every `/api/*` response as
 * `API-Version` so a client can record what it integrated against without
 * parsing the spec.
 */
export const API_VERSION = "1"

/** Where the versioning and sunset rules live, in prose and as a Link relation. */
export const DEPRECATION_POLICY_URL = u("/developers/versioning")

/**
 * The lifecycle of every published API version.
 *
 * `status` is the machine-readable state; `sunset` is an RFC 8594 date, present
 * only once a version has been scheduled for removal. Nothing is deprecated
 * today, and saying so explicitly is more useful to an agent than silence —
 * "no sunset scheduled" is a fact it can act on, an absent field is not.
 */
export const API_VERSIONS = [
  {
    version: "1",
    basePath: "/api/v1",
    status: "current" as const,
    since: "2026-07-01",
    deprecated: null,
    sunset: null,
  },
]

/** Minimum notice between announcing a deprecation and switching a version off. */
export const DEPRECATION_NOTICE_DAYS = 180

/** The canonical descriptions, reused across every discovery document. */
export const SITE = {
  name: "Satyajit Ghana — AI-native personal site",
  shortName: "satyajit-ai-site",
  version: "1.0.0",
  description:
    "Satyajit Ghana's personal site: 140+ long-form explainers on model architectures, inference and agent harnesses, daily arXiv digests, projects, resume, publications, patents and a quantified-self health panel. Every page has a markdown twin, a JSON API and an MCP server.",
  whenToUse:
    "Use when a task needs Satyajit Ghana's own writing, records or opinions: who he is and what he has worked on; what he has written about a specific model, paper, architecture or agent harness; what appeared in his dated arXiv digests; or a synthesis across several of his pages. Not a general search engine, a paper database, or a source of truth about anything outside this site's content.",
  contact: "satyajitghana7@gmail.com",
  license: "CC-BY-4.0",
} as const

/**
 * RFC 8288 Link header. Relation types are IANA-registered ones where they
 * exist (`service-desc`, `service-doc`, `describedby`, `author`, `license`,
 * `search`, `terms-of-service`, `privacy-policy`) plus `api-catalog` from
 * RFC 9727 §3.
 */
export const LINK_RELATIONS: { href: string; rel: string; type?: string; title?: string }[] = [
  { href: "/.well-known/api-catalog", rel: "api-catalog", type: "application/linkset+json", title: "API catalog" },
  { href: "/openapi.json", rel: "service-desc", type: "application/openapi+json", title: "OpenAPI 3.1 description" },
  { href: "/developers", rel: "service-doc", type: "text/html", title: "Developer documentation" },
  { href: "/llms.txt", rel: "describedby", type: "text/plain", title: "llms.txt index" },
  { href: "/.well-known/mcp/server-card.json", rel: "related", type: "application/json", title: "MCP server card" },
  { href: "/sitemap.xml", rel: "sitemap", type: "application/xml", title: "Sitemap" },
  { href: "/search?q={q}", rel: "search", type: "text/html", title: "Site search" },
  { href: "/about", rel: "author", type: "text/html", title: "About the author" },
  { href: "/privacy", rel: "privacy-policy", type: "text/html", title: "Privacy policy" },
  { href: "/colophon", rel: "license", type: "text/html", title: "Content licence" },
]

/** Pre-serialised Link header value — built once at module load. */
export const LINK_HEADER = LINK_RELATIONS.map(({ href, rel, type, title }) =>
  [
    `<${u(href)}>`,
    `rel="${rel}"`,
    ...(type ? [`type="${type}"`] : []),
    ...(title ? [`title="${title}"`] : []),
  ].join("; "),
).join(", ")

/**
 * RFC 9727 API catalog, as an RFC 9264 linkset. One anchor per API, each
 * carrying the relations an agent needs to actually call it.
 */
export function apiCatalog() {
  return {
    linkset: [
      {
        anchor: u("/api/v1"),
        "service-desc": [{ href: u("/openapi.json"), type: "application/openapi+json" }],
        "service-doc": [{ href: u("/developers"), type: "text/html" }],
        "service-meta": [{ href: u("/.well-known/ai-plugin.json"), type: "application/json" }],
        status: [{ href: u("/api/ask"), type: "application/json", title: "Liveness of the model-backed endpoint" }],
        author: [{ href: u("/about"), type: "text/html" }],
        license: [{ href: "https://creativecommons.org/licenses/by/4.0/", title: "CC BY 4.0" }],
        "terms-of-service": [{ href: u("/privacy"), type: "text/html" }],
      },
      {
        anchor: MCP_ENDPOINT,
        "service-desc": [{ href: u("/.well-known/mcp/server-card.json"), type: "application/json" }],
        "service-doc": [{ href: u("/developers#mcp"), type: "text/html" }],
        "service-meta": [{ href: u("/.well-known/mcp.json"), type: "application/json" }],
      },
    ],
  }
}
