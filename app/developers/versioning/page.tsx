import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { API_VERSIONS, DEPRECATION_NOTICE_DAYS } from "@/lib/discovery"
import { JsonLd } from "@/lib/jsonld"
import { absoluteUrl } from "@/lib/site"

// The versioning and deprecation policy, at its own URL.
//
// It was already written, as an anchor on /developers. An anchor is fine for a
// person and useless to anything that probes for a policy by URL — and "how
// will you tell me before this breaks" is a question an agent should be able to
// answer by fetching one page. So the policy lives here, /developers#versioning
// links to it, and the machine-readable form is at /developers/versioning.json.

export const metadata: Metadata = {
  title: "API versioning & deprecation policy — Satyajit Ghana site API",
  description:
    "How the ai.thesatyajit.com JSON API is versioned and how deprecation is announced: URL-path versioning at /api/v1, a minimum 180-day sunset window, and RFC 9745 Deprecation plus RFC 8594 Sunset headers on every superseded response.",
  alternates: { canonical: "/developers/versioning" },
  keywords: [
    "Satyajit Ghana API versioning",
    "API deprecation policy",
    "Sunset header",
    "Deprecation header",
    "RFC 8594",
    "RFC 9745",
  ],
}

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

const RULES = [
  {
    h: "Versions live in the URL path",
    p: "Every endpoint is served at both /api/* and /api/v1/*. The two are byte-identical today. Pin the versioned prefix and the shape of what you get back cannot move under you.",
  },
  {
    h: "Breaking changes get a new prefix",
    p: "Removing a field, renaming one, changing its type, or changing the meaning of an existing value is breaking, and ships as /api/v2/* rather than as an edit to v1.",
  },
  {
    h: "Additive changes land in place",
    p: "A new endpoint, or a new optional field on an existing response, is not breaking and does not wait for a version bump. Parse defensively and ignore fields you do not recognise.",
  },
  {
    h: "A superseded version serves for at least 180 days",
    p: "From the day a replacement ships, the old prefix keeps working for a minimum of 180 days. The clock starts at announcement, not at your next deploy.",
  },
  {
    h: "Retirement is announced in the response itself",
    p: "Once a version is scheduled for removal its responses carry Deprecation (RFC 9745) and Sunset (RFC 8594) headers naming the date, plus a Link rel=\"deprecation\" pointing back at this page. You do not have to poll a changelog to find out.",
  },
]

export default function Page() {
  return (
    <PageShell
      title="Versioning and deprecation"
      lede="How this API changes, and how you will be told before it does."
      agentPath={{ json: "/developers/versioning.json" }}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "TechArticle",
          name: "API versioning and deprecation policy",
          headline: "API versioning and deprecation policy — Satyajit Ghana site API",
          url: absoluteUrl("/developers/versioning"),
          description: metadata.description as string,
          isPartOf: { "@type": "WebSite", url: absoluteUrl("/") },
          about: { "@type": "WebAPI", name: "Satyajit Ghana site API", documentation: absoluteUrl("/developers") },
        }}
      />

      <p className="max-w-prose leading-7 text-muted-foreground">
        This API has no keys and no accounts, which means there is no mailing list to warn you
        through. The contract has to be legible from the responses themselves, so everything below
        is something you can observe by making a request.
      </p>

      <Section id="current" title="What is current">
        <div className="overflow-x-auto">
          <table className="w-full text-left font-mono text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-4 font-normal">version</th>
                <th className="py-2 pr-4 font-normal">base path</th>
                <th className="py-2 pr-4 font-normal">status</th>
                <th className="py-2 pr-4 font-normal">since</th>
                <th className="py-2 font-normal">sunset</th>
              </tr>
            </thead>
            <tbody>
              {API_VERSIONS.map((v) => (
                <tr key={v.version} className="border-b last:border-0">
                  <td className="py-2 pr-4 text-foreground">v{v.version}</td>
                  <td className="py-2 pr-4">{v.basePath}</td>
                  <td className="py-2 pr-4 text-foreground">{v.status}</td>
                  <td className="py-2 pr-4">{v.since}</td>
                  <td className="py-2">{v.sunset ?? "none scheduled"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          The same table as JSON, for anything that would rather not parse HTML:{" "}
          <Link href="/developers/versioning.json" className="underline underline-offset-4 hover:text-foreground">
            /developers/versioning.json
          </Link>
          . Every response under <code className="font-mono text-xs">/api/*</code> also carries an{" "}
          <code className="font-mono text-xs">API-Version</code> header naming the contract it was
          produced under.
        </p>
      </Section>

      <Section id="rules" title="The rules">
        <ol className="max-w-prose space-y-5">
          {RULES.map((r, i) => (
            <li key={r.h} className="flex gap-4">
              <span className="shrink-0 font-mono text-xs text-muted-foreground">{i + 1}</span>
              <div>
                <h3 className="font-mono text-sm text-foreground">{r.h}</h3>
                <p className="mt-1 leading-7 text-muted-foreground">{r.p}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="headers" title="The headers to watch">
        <div className="max-w-prose space-y-4 leading-7 text-muted-foreground">
          <p>
            <code className="font-mono text-xs text-foreground">API-Version</code>{" "}— on every{" "}
            <code className="font-mono text-xs">/api/*</code> response. Record it with whatever you
            cache; if it changes, so did the contract.
          </p>
          <p>
            <code className="font-mono text-xs text-foreground">Deprecation</code>{" "}(RFC 9745) — an
            IMF-fixdate naming when the version was deprecated. Absent while a version is current.
          </p>
          <p>
            <code className="font-mono text-xs text-foreground">Sunset</code>{" "}(RFC 8594) — an
            IMF-fixdate naming when the version stops responding. Never less than{" "}
            <span className="text-foreground">{DEPRECATION_NOTICE_DAYS} days</span>{" "}after the
            Deprecation date.
          </p>
          <p>
            <code className="font-mono text-xs text-foreground">Link: rel=&quot;deprecation&quot;</code>{" "}—
            points at this page, so a client that sees the header can fetch the reasoning without
            being told where to look.
          </p>
        </div>
        <p className="mt-6 max-w-prose leading-7 text-muted-foreground">
          Nothing is deprecated today, so no <code className="font-mono text-xs">Deprecation</code>{" "}
          or <code className="font-mono text-xs">Sunset</code>{" "}header is being sent. That absence
          is the signal: if you are not seeing them, you are on a version with no end date.
        </p>
      </Section>

      <Section id="stability" title="What is not covered">
        <p className="max-w-prose leading-7 text-muted-foreground">
          The content itself is not versioned. Articles get edited, digests get added, the health
          panel gets a new draw — those are data changes, not contract changes, and they happen
          without notice. Version numbers describe the <em>shape</em>{" "}of a response, not its
          contents. If you need a fixed snapshot of the writing, cache it.
        </p>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Back to the{" "}
          <Link href="/developers" className="underline underline-offset-4 hover:text-foreground">
            developer portal
          </Link>
          {" "}for the full surface list, or{" "}
          <Link href="/openapi.json" className="underline underline-offset-4 hover:text-foreground">
            /openapi.json
          </Link>
          {" "}for the spec.
        </p>
      </Section>
    </PageShell>
  )
}
