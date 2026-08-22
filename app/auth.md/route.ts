import { MCP_ENDPOINT } from "@/lib/discovery"
import { siteUrl } from "@/lib/site"

// auth.md (workos.com/auth.md) — where an agent looks to find out how to
// register and authenticate.
//
// The honest answer here is "you don't". There is no authorization server, no
// registration, no credentials and no protected resource, so this file says so
// in the place an agent already checks. That is the useful thing it can do: stop
// a client from hunting for /.well-known/oauth-authorization-server, failing,
// and concluding the API is broken rather than open.
//
// Deliberately NOT published alongside this: /.well-known/openid-configuration
// and /.well-known/oauth-protected-resource. Those describe an issuer, token
// endpoint and JWKS that do not exist here; serving them would be fabricating
// infrastructure, and an agent that trusted them would fail in a much more
// confusing way than one that reads this file.
export const dynamic = "force-static"

export function GET() {
  const body = `# Authentication

**There is none, and none is needed.**

Every surface on ${siteUrl} is public, unauthenticated and free to use. There is
no signup, no API key, no OAuth client registration, and no rate-limit tier that
requires identifying yourself.

## What this means for an agent

- Do **not** look for \`/.well-known/openid-configuration\`,
  \`/.well-known/oauth-authorization-server\` or
  \`/.well-known/oauth-protected-resource\`. They are intentionally absent:
  publishing them would describe an authorization server that does not exist.
- Do **not** send an \`Authorization\` header. It is ignored.
- A \`401\` or \`403\` from this origin is a bug. Please report it.

## Just call it

\`\`\`bash
curl ${siteUrl}/api/v1/articles
curl -H "Accept: text/markdown" ${siteUrl}/about
\`\`\`

MCP, also unauthenticated, over Streamable HTTP:

\`\`\`bash
claude mcp add --transport http satyajit ${MCP_ENDPOINT}
\`\`\`

## What is asked of you instead of credentials

Rate limits are enforced by IP rather than by identity: 240 requests per minute
with a 30-request burst window. Every \`/api/*\` response carries \`RateLimit\` and
\`RateLimit-Policy\` headers (RFC 9331) — read them and pace yourself. A \`429\`
carries \`Retry-After\`.

Cache what you fetch. The content changes a few times a day at most, and most
of it is served with a \`cache-control\` you can honour.

## If that ever changes

If a protected surface is added, this file will describe how to register for it,
and the corresponding \`/.well-known/oauth-protected-resource\` document will
appear at the same time. Until both exist, assume open access.

## Elsewhere

- Developer documentation: ${siteUrl}/developers
- OpenAPI description: ${siteUrl}/openapi.json
- API catalog: ${siteUrl}/.well-known/api-catalog
- Index for agents: ${siteUrl}/llms.txt
- Contact: ${siteUrl}/contact
`

  return new Response(body, {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*",
    },
  })
}
