import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { profile } from "@/data/profile"
import { JsonLd } from "@/lib/jsonld"
import { absoluteUrl } from "@/lib/site"

// The third trust anchor. Written to describe what this site actually does
// rather than to recite a template — it has no accounts, no ad network and no
// analytics cookies, and saying so plainly is more useful than a generic policy
// that implies otherwise.

export const metadata: Metadata = {
  title: "Privacy",
  description:
    "What ai.thesatyajit.com collects, what it does not, and what happens to the questions you type into the site's AI console. No accounts, no advertising, no cross-site tracking.",
  alternates: { canonical: "/privacy" },
}

export default function Page() {
  return (
    <PageShell
      title="Privacy"
      lede="A short policy, because the site does very little that needs one."
      agentPath={{ md: "/llms.txt" }}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebPage",
          name: "Privacy",
          url: absoluteUrl("/privacy"),
          description:
            "Privacy policy for ai.thesatyajit.com: no accounts, no advertising, no cross-site tracking.",
          dateModified: "2026-08-15",
        }}
      />

      <section className="space-y-4">
        <p className="max-w-prose leading-7 text-muted-foreground">
          This is a personal site. There are no accounts, no logins, no shopping cart, no
          advertising network and no cross-site tracking pixels. Nothing here tries to build a
          profile of you, and there is no third party being paid for your attention.
        </p>
        <p className="max-w-prose leading-7 text-muted-foreground">
          The rest of this page describes the three places where any data touches the site at all.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">Hosting and request logs</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          The site is served by Vercel. Like every web host, it records standard request
          information — IP address, user agent, requested path, timestamp, response status — for
          the purpose of serving traffic and defending against abuse. Those logs are retained by
          the host under its own policy and are not exported, sold, or joined to anything else. The
          site&rsquo;s own rate limiter derives a short-lived counter from the request IP and holds
          it in memory only, for at most sixty seconds; it is never written to disk.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">The AI console</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          The chat box on the homepage and the{" "}
          <code className="font-mono text-xs">/api/ask</code> endpoint send your question, plus
          context assembled from this site&rsquo;s own published pages, to a third-party model
          provider so an answer can be generated. That provider processes the question under its
          own terms and retention policy. The site does not store your questions, does not
          associate them with an identity, and does not use them for training anything.
        </p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          Treat the console as public. Do not paste anything into it that you would not post in a
          comment — credentials, personal data about other people, or confidential material from
          your employer. If the model is offline the endpoint returns a 503 and nothing leaves the
          site at all.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">Cookies and storage</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          The site sets no tracking cookies. Your theme preference (light, dark, or system) is kept
          in your browser&rsquo;s local storage so the page does not flash the wrong colours on
          load. That value never leaves your device and is not readable by anyone but you. Clearing
          site data removes it.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">Agents and crawlers</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Automated clients are welcome. Every public surface — the{" "}
          <Link href="/developers" className="underline underline-offset-4 hover:text-foreground">
            JSON API
          </Link>
          , the MCP server, the markdown twins, <code className="font-mono text-xs">llms.txt</code>{" "}
          — is unauthenticated and free to use, and the content is published for reading and
          citation. Crawl policy is in{" "}
          <a href="/robots.txt" className="underline underline-offset-4 hover:text-foreground">
            /robots.txt
          </a>
          ; the rate limits are documented on the developer page. If you are building on the API,
          cache what you fetch rather than re-requesting it — that is the whole of the etiquette
          being asked for.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">Your rights, and contact</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Because the site holds no personal data of yours beyond transient host logs, there is
          generally nothing to access, correct, or delete. If you believe otherwise, or you want
          something about you that appears in the published content removed or corrected, write to{" "}
          <a
            href={`mailto:${profile.links.email}`}
            className="underline underline-offset-4 hover:text-foreground"
          >
            {profile.links.email}
          </a>{" "}
          and it will be dealt with. Other channels are on the{" "}
          <Link href="/contact" className="underline underline-offset-4 hover:text-foreground">
            contact page
          </Link>
          .
        </p>
        <p className="mt-3 max-w-prose leading-7 text-muted-foreground">
          This policy changes when the site does. Last updated 15 August 2026.
        </p>
      </section>
    </PageShell>
  )
}
