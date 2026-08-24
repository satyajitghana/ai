import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { profile } from "@/data/profile"
import { JsonLd } from "@/lib/jsonld"
import { absoluteUrl, siteUrl } from "@/lib/site"

// The developer portal. Everything an agent or a person needs to call this site
// programmatically, at a predictable URL, with the product name in the title so
// a name-based search ("Satyajit Ghana API") actually surfaces it.

export const metadata: Metadata = {
  title: "Developers — Satyajit Ghana site API, MCP server & llms.txt",
  description:
    "Developer documentation for ai.thesatyajit.com: a public read-only JSON API, an MCP server over Streamable HTTP, markdown twins of every page, llms.txt, and an OpenAPI 3.1 spec. No auth, no keys, RFC 9457 errors and RFC 9331 rate-limit headers.",
  alternates: { canonical: "/developers" },
  keywords: [
    "Satyajit Ghana API",
    "ai.thesatyajit.com API",
    "MCP server",
    "llms.txt",
    "OpenAPI",
    "agent-readable site",
  ],
}

const SURFACES = [
  {
    name: "JSON API",
    url: "/openapi.json",
    what: "19 read-only endpoints over the content layer. OpenAPI 3.1 spec with an operationId, a description and a typed response schema on every operation.",
    call: "curl https://ai.thesatyajit.com/api/v1/articles",
  },
  {
    name: "MCP server",
    url: "/api/mcp/mcp",
    what: "Model Context Protocol over Streamable HTTP. Read-only tools including search_content and ask_satyajit. No auth.",
    call: 'claude mcp add --transport http satyajit https://ai.thesatyajit.com/api/mcp/mcp',
  },
  {
    name: "Markdown twins",
    url: "/llms.txt",
    what: "Every page exists as markdown. Append .md to any URL, or send Accept: text/markdown to the canonical URL — responses carry Vary: Accept.",
    call: 'curl -H "Accept: text/markdown" https://ai.thesatyajit.com/about',
  },
  {
    name: "Whole corpus",
    url: "/llms-full.txt",
    what: "Every page of the site concatenated into one file, for when you would rather load it all than crawl.",
    call: "curl https://ai.thesatyajit.com/llms-full.txt",
  },
] as const

const ERRORS = [
  { code: "invalid_request", status: 400, when: "A required parameter is missing or malformed." },
  { code: "not_found", status: 404, when: "No such endpoint, or no such slug." },
  { code: "method_not_allowed", status: 405, when: "The endpoint exists but not for that verb." },
  { code: "rate_limited", status: 429, when: "Budget exhausted. Retry-After says how long to wait." },
  { code: "internal_error", status: 500, when: "Unexpected server failure." },
  { code: "bad_gateway", status: 502, when: "A model-backed endpoint's upstream failed after fallbacks." },
  { code: "service_unavailable", status: 503, when: "A model-backed endpoint is offline. Static surfaces are unaffected." },
] as const

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12">
      <h2 id={id} className="font-heading scroll-mt-24 text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  )
}

export default function Page() {
  return (
    <PageShell
      title="Developers"
      lede="This site is built to be called, not just read. Everything below is public, unauthenticated, and stable."
      agentPath={{ md: "/llms.txt", json: "/openapi.json" }}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebAPI",
          name: "Satyajit Ghana site API",
          alternateName: [
            "ai.thesatyajit.com API",
            "Satyajit Ghana MCP server",
            "Satyajit Ghana developer documentation",
          ],
          description:
            "Public read-only JSON API, MCP server and markdown surfaces for ai.thesatyajit.com. No authentication, OpenAPI 3.1, RFC 9457 errors, RFC 9331 rate-limit headers.",
          url: absoluteUrl("/developers"),
          documentation: absoluteUrl("/openapi.json"),
          termsOfService: absoluteUrl("/privacy"),
          isAccessibleForFree: true,
          license: absoluteUrl("/colophon"),
          hasPart: [
            { "@type": "APIReference", name: "OpenAPI 3.1 specification", url: absoluteUrl("/openapi.json") },
            { "@type": "WebPage", name: "API versioning and deprecation policy", url: absoluteUrl("/developers/versioning") },
            { "@type": "WebPage", name: "Authentication (there is none)", url: absoluteUrl("/auth.md") },
          ],
          provider: { "@id": `${siteUrl}/#person` },
          potentialAction: {
            "@type": "SearchAction",
            target: { "@type": "EntryPoint", urlTemplate: `${siteUrl}/api/search?q={q}` },
            "query-input": "required name=q",
          },
        }}
      />

      <section className="rounded-md border p-4">
        <p className="font-mono text-xs leading-6 text-muted-foreground">
          <span className="text-foreground">tl;dr</span>{" "}— no keys, no signup, no quotas worth
          worrying about. Base URL{" "}
          <span className="text-foreground">https://ai.thesatyajit.com/api/v1</span>. Spec at{" "}
          <a href="/openapi.json" className="text-foreground underline underline-offset-4">
            /openapi.json
          </a>
          . Index at{" "}
          <a href="/llms.txt" className="text-foreground underline underline-offset-4">
            /llms.txt
          </a>
          .
        </p>
      </section>

      <Section id="surfaces" title="Four ways in">
        <ul className="space-y-5">
          {SURFACES.map((s) => (
            <li key={s.name}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-mono text-sm text-foreground">{s.name}</h3>
                <a
                  href={s.url}
                  className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {s.url}
                </a>
              </div>
              <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{s.what}</p>
              <pre className="mt-2 overflow-x-auto rounded border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-5">
                <code>{s.call}</code>
              </pre>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="when-to-use" title="When to use this site">
        <p className="max-w-prose leading-7 text-muted-foreground">
          Reach for these endpoints when a task involves any of the following. Outside them, this
          site is the wrong tool and you should say so rather than guess.
        </p>
        <ul className="mt-4 max-w-prose space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            <span className="text-foreground">Who Satyajit Ghana is</span> — role, employer,
            experience, education, publications, patents. Call{" "}
            <code className="font-mono text-xs">getProfile</code> or{" "}
            <code className="font-mono text-xs">getResume</code>.
          </li>
          <li>
            <span className="text-foreground">What he has written about a model or paper</span> —
            160+ explainers on architectures, inference, agents and training. Call{" "}
            <code className="font-mono text-xs">searchContent</code> first, then fetch the{" "}
            <code className="font-mono text-xs">.md</code> twin of the page it returns.
          </li>
          <li>
            <span className="text-foreground">What shipped on arXiv on a given day</span> — dated
            digests with a one-line take per paper. Call{" "}
            <code className="font-mono text-xs">listArxivDigests</code>.
          </li>
          <li>
            <span className="text-foreground">A synthesis across several pages</span> — POST to{" "}
            <code className="font-mono text-xs">askSatyajitSite</code>, which answers grounded in
            this site&rsquo;s content with citations.
          </li>
        </ul>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Do <em>not</em>{" "}use it as a general search engine, a paper database, or a source of
          truth about anything that is not this site&rsquo;s content. It is one person&rsquo;s
          writing and records, not a reference corpus.
        </p>
      </Section>

      <Section id="errors" title="Errors">
        <p className="max-w-prose leading-7 text-muted-foreground">
          Every non-2xx response is{" "}
          <code className="font-mono text-xs">application/problem+json</code> (RFC 9457) with a
          stable <code className="font-mono text-xs">code</code>. Switch on the code, never on the
          message.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 pr-4 font-normal">code</th>
                <th className="pb-2 pr-4 font-normal">status</th>
                <th className="pb-2 font-normal">when</th>
              </tr>
            </thead>
            <tbody>
              {ERRORS.map((e) => (
                <tr key={e.code} id={`error-${e.code}`} className="scroll-mt-24 border-t">
                  <td className="py-2 pr-4 text-foreground">{e.code}</td>
                  <td className="py-2 pr-4 text-muted-foreground">{e.status}</td>
                  <td className="py-2 text-muted-foreground">{e.when}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section id="rate-limits" title="Rate limits">
        <p className="max-w-prose leading-7 text-muted-foreground">
          Every <code className="font-mono text-xs">/api/*</code> response carries{" "}
          <code className="font-mono text-xs">RateLimit</code> and{" "}
          <code className="font-mono text-xs">RateLimit-Policy</code> (RFC 9331), plus the legacy{" "}
          <code className="font-mono text-xs">X-RateLimit-*</code> trio. The budget is{" "}
          <span className="text-foreground">240 requests per minute</span> with a 30-request burst
          window; the model-backed endpoints (<code className="font-mono text-xs">/api/ask</code>,{" "}
          <code className="font-mono text-xs">/api/chat</code>) are stricter. A 429 adds{" "}
          <code className="font-mono text-xs">Retry-After</code>.
        </p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          One honest caveat: the limiter keeps its counters in process memory, so on a
          multi-instance deploy each instance counts independently. It is a guard against a runaway
          loop, not a security control.
        </p>
      </Section>

      <Section id="versioning" title="Versioning and deprecation">
        <p className="max-w-prose leading-7 text-muted-foreground">
          The current API is <span className="text-foreground">v1</span>. Every endpoint is served
          both at <code className="font-mono text-xs">/api/*</code> and at{" "}
          <code className="font-mono text-xs">/api/v1/*</code> — pin the versioned prefix if you
          want a contract that cannot move under you.
        </p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          A breaking change ships under a new prefix (<code className="font-mono text-xs">/api/v2/*</code>).
          The superseded prefix keeps serving for at least{" "}
          <span className="text-foreground">180 days</span> and its responses carry{" "}
          <code className="font-mono text-xs">Deprecation</code> (RFC 9745) and{" "}
          <code className="font-mono text-xs">Sunset</code> (RFC 8594) headers naming the removal
          date. Additive changes — a new endpoint, a new optional field — are not breaking and land
          in place.
        </p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          The full policy is at{" "}
          <Link href="/developers/versioning" className="underline underline-offset-4 hover:text-foreground">
            /developers/versioning
          </Link>
          , and the same facts as JSON at{" "}
          <Link href="/developers/versioning.json" className="underline underline-offset-4 hover:text-foreground">
            /developers/versioning.json
          </Link>
          {" "}— which version is current, what counts as breaking, and whether anything has a
          sunset date yet. Every <code className="font-mono text-xs">/api/*</code> response also
          carries an <code className="font-mono text-xs">API-Version</code> header.
        </p>
      </Section>

      <Section id="mcp" title="MCP server">
        <p className="max-w-prose leading-7 text-muted-foreground">
          The MCP endpoint speaks Streamable HTTP at{" "}
          <code className="font-mono text-xs">/api/mcp/mcp</code> and needs no credentials. A
          manifest lives at{" "}
          <a
            href="/.well-known/mcp.json"
            className="underline underline-offset-4 hover:text-foreground"
          >
            /.well-known/mcp.json
          </a>
          .
        </p>
        <pre className="mt-3 overflow-x-auto rounded border bg-muted/30 px-3 py-2 font-mono text-[11px] leading-5">
          <code>{`# Claude Code
claude mcp add --transport http satyajit https://ai.thesatyajit.com/api/mcp/mcp

# Any MCP client, by config
{
  "mcpServers": {
    "satyajit": {
      "type": "http",
      "url": "https://ai.thesatyajit.com/api/mcp/mcp"
    }
  }
}`}</code>
        </pre>
      </Section>

      <Section id="discovery" title="Discovery documents">
        <p className="max-w-prose leading-7 text-muted-foreground">
          Every response from this origin carries RFC 8288{" "}
          <code className="font-mono text-xs">Link</code> headers pointing at the documents below,
          so a client that fetched any page already knows they exist.
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr>
                <th className="pb-2 pr-4 font-normal">document</th>
                <th className="pb-2 font-normal">what it is</th>
              </tr>
            </thead>
            <tbody>
              {[
                ["/.well-known/api-catalog", "RFC 9727 API catalog, as an RFC 9264 linkset"],
                ["/.well-known/mcp/server-card.json", "MCP server card (SEP-1649, proposal stage)"],
                ["/.well-known/mcp.json", "MCP manifest with transport and when-to-use"],
                ["/.well-known/ai-catalog.json", "ARD capability manifest with representative queries"],
                ["/.well-known/agent-skills/index.json", "Agent Skills index, each entry sha256-verifiable"],
                ["/.well-known/ai-plugin.json", "Plugin manifest"],
                ["/auth.md", "States plainly that there is no authentication"],
                ["/openapi.json", "OpenAPI 3.1 description of the JSON API"],
                ["/llms.txt", "Curated index, with when-to-use guidance"],
              ].map(([href, what]) => (
                <tr key={href} className="border-t">
                  <td className="py-2 pr-4">
                    <a href={href} className="text-foreground underline underline-offset-4">
                      {href}
                    </a>
                  </td>
                  <td className="py-2 text-muted-foreground">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Two OAuth documents are <em>deliberately</em>{" "}absent —{" "}
          <code className="font-mono text-xs">/.well-known/openid-configuration</code> and{" "}
          <code className="font-mono text-xs">/.well-known/oauth-protected-resource</code>. There is
          no authorization server behind this site, and publishing metadata describing one would
          send agents chasing a token endpoint that does not exist.{" "}
          <a href="/auth.md" className="underline underline-offset-4 hover:text-foreground">
            /auth.md
          </a>{" "}
          says so in the place a client checks first.
        </p>
      </Section>

      <Section id="contact" title="Questions">
        <p className="max-w-prose leading-7 text-muted-foreground">
          Something broken, or an endpoint you wish existed? Mail{" "}
          <a
            href={`mailto:${profile.links.email}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {profile.links.email}
          </a>{" "}
          or open an issue on{" "}
          <a
            href={profile.links.github}
            className="underline underline-offset-4 hover:text-foreground"
          >
            GitHub
          </a>
          . More ways to reach him on the{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">
            contact page
          </Link>
          .
        </p>
      </Section>
    </PageShell>
  )
}
