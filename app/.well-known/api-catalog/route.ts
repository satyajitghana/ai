import { apiCatalog } from "@/lib/discovery"

// RFC 9727 — "An API Catalog is a machine-readable document that describes the
// APIs available at a given origin." Served as an RFC 9264 linkset so an agent
// that finds the `api-catalog` Link relation on any page can walk straight to
// the OpenAPI description, the docs, and the MCP server without scraping.
export const dynamic = "force-static"

export function GET() {
  return new Response(JSON.stringify(apiCatalog(), null, 2), {
    headers: {
      "content-type": "application/linkset+json; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
