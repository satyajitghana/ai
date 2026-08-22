import { MCP_ENDPOINT, SITE } from "@/lib/discovery"
import { profile } from "@/data/profile"
import { siteUrl } from "@/lib/site"

// ARD — Agentic Resource Discovery (agenticresourcediscovery.org).
//
// One manifest listing every capability this origin exposes, each with a URN
// identifier and a media type. The `representativeQueries` are the part worth
// getting right: registries embed them to decide whether this site is relevant
// to a question, so they should read like questions a person would actually
// ask, not like keywords.
export const dynamic = "force-static"

const urn = (ns: string, name: string) => `urn:air:ai.thesatyajit.com:${ns}:${name}`

export function GET() {
  const catalog = {
    specVersion: "0.1",
    host: {
      name: SITE.name,
      domain: "ai.thesatyajit.com",
      url: siteUrl,
      description: SITE.description,
      contact: { email: SITE.contact, url: `${siteUrl}/contact` },
      license: SITE.license,
      owner: { name: profile.name, url: siteUrl },
    },
    entries: [
      {
        id: urn("mcp", "site-server"),
        displayName: "Satyajit site MCP server",
        description:
          "Read-only MCP server over the whole site: search, fetch pages, read the profile, resume, publications, patents, arXiv digests and health panel, plus a grounded ask_satyajit tool.",
        type: "application/json",
        url: MCP_ENDPOINT,
        transport: "streamable-http",
        authentication: "none",
        representativeQueries: [
          "What has Satyajit Ghana written about mixture-of-experts routing?",
          "Find Satyajit's article explaining the softmax bottleneck",
          "What papers were in the arXiv digest for a given date?",
          "What is Satyajit Ghana's current role and background?",
          "Summarise Satyajit's take on agent harness design",
        ],
      },
      {
        id: urn("openapi", "site-api"),
        displayName: "Satyajit site JSON API",
        description:
          "Read-only REST API over the content layer. 20 operations, OpenAPI 3.1, RFC 9457 errors, RFC 9331 rate-limit headers, no authentication.",
        type: "application/openapi+json",
        url: `${siteUrl}/openapi.json`,
        representativeQueries: [
          "List every long-form article on ai.thesatyajit.com",
          "Fetch Satyajit Ghana's structured resume as JSON",
          "Search Satyajit's writing for a specific model name",
          "Get the list of Satyajit's patents and publications",
        ],
      },
      {
        id: urn("index", "llms-txt"),
        displayName: "llms.txt index",
        description:
          "Curated index of every page and agent surface on the site, with a when-to-use section stating what the site is and is not the right tool for.",
        type: "text/plain",
        url: `${siteUrl}/llms.txt`,
        representativeQueries: [
          "What is on ai.thesatyajit.com?",
          "How do I read this site as an agent?",
          "Where is the index of Satyajit's writing?",
        ],
      },
      {
        id: urn("corpus", "llms-full-txt"),
        displayName: "Full content corpus",
        description:
          "Every page of the site concatenated into a single markdown file, for loading rather than crawling.",
        type: "text/plain",
        url: `${siteUrl}/llms-full.txt`,
        representativeQueries: [
          "Load the entire text of ai.thesatyajit.com",
          "Give me everything Satyajit Ghana has published in one file",
        ],
      },
      {
        id: urn("docs", "developer-portal"),
        displayName: "Developer documentation",
        description:
          "How to call the site: the four surfaces, the error model, rate limits, versioning and deprecation policy, and MCP setup.",
        type: "text/html",
        url: `${siteUrl}/developers`,
        representativeQueries: [
          "How do I authenticate against the ai.thesatyajit.com API?",
          "What are the rate limits on Satyajit's API?",
          "How do I connect to Satyajit's MCP server?",
        ],
      },
    ],
  }

  return new Response(JSON.stringify(catalog, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
