import type { Metadata } from "next"
import Link from "next/link"

import { PageShell } from "@/components/site/page-shell"
import { profile } from "@/data/profile"
import { JsonLd } from "@/lib/jsonld"
import { absoluteUrl, siteUrl } from "@/lib/site"

// A trust-anchor page. Agents check /about, /contact and /privacy before they
// treat a site as a citable source, and a contact page that is just a mailto
// link fails that check. This one states who you are reaching, for what, and how
// quickly — and carries ContactPage JSON-LD so the same facts are machine-readable.

export const metadata: Metadata = {
  title: "Contact",
  description: `How to reach ${profile.name} — email, GitHub, LinkedIn and X — and what he does and does not respond to.`,
  alternates: { canonical: "/contact" },
}

const CHANNELS = [
  {
    label: "Email",
    value: profile.links.email,
    href: `mailto:${profile.links.email}`,
    note: "Best for anything substantive. Read daily; replies usually within a few days, sometimes longer during a shipping crunch.",
  },
  {
    label: "GitHub",
    value: "@satyajitghana",
    href: profile.links.github,
    note: "Issues and pull requests on any of the repositories, including the one this site is built from. Fastest route for a bug in the site, the API or the MCP server.",
  },
  {
    label: "LinkedIn",
    value: "in/satyajitghana",
    href: profile.links.linkedin,
    note: "Professional enquiries and hiring conversations. Connection requests without a note are usually ignored.",
  },
  {
    label: "X",
    value: "@thesudoer_",
    href: profile.links.x,
    note: "Short-form thoughts on models and infrastructure. DMs are open but email is more reliable.",
  },
  {
    label: "Google Scholar",
    value: "Publications",
    href: profile.links.scholar,
    note: "Citations and peer-reviewed work. See /publications for the same list with DOIs.",
  },
] as const

export default function Page() {
  return (
    <PageShell
      title="Contact"
      lede={`${profile.name} — ${profile.title} at ${profile.company.name}, based in ${profile.location}.`}
      agentPath={{ json: "/api/profile" }}
    >
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "ContactPage",
          name: `Contact ${profile.name}`,
          url: absoluteUrl("/contact"),
          description: `How to reach ${profile.name}.`,
          mainEntity: { "@id": `${siteUrl}/#person` },
        }}
      />

      <section className="space-y-4">
        <p className="max-w-prose leading-7 text-muted-foreground">
          I&rsquo;m {profile.name}, {profile.title} at{" "}
          <a
            href={profile.company.url}
            className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            {profile.company.name}
          </a>
          , working on industrial AI — 3D perception, LiDAR and point-cloud pipelines, and the
          high-performance services that put them into production. I&rsquo;m in {profile.location},
          which is UTC+5:30, so if you&rsquo;re writing from the Americas expect a reply the
          following day.
        </p>
        <p className="max-w-prose leading-7 text-muted-foreground">
          Email is the front door. Everything else below works, but email is the channel I actually
          keep on top of.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">Channels</h2>
        <ul className="mt-4 space-y-5">
          {CHANNELS.map((c) => (
            <li key={c.label}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-mono text-sm text-foreground">{c.label}</h3>
                <a
                  href={c.href}
                  className="font-mono text-xs text-muted-foreground underline underline-offset-4 hover:text-foreground"
                >
                  {c.value}
                </a>
              </div>
              <p className="mt-1 max-w-prose text-sm leading-6 text-muted-foreground">{c.note}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          What I&rsquo;m glad to hear about
        </h2>
        <ul className="mt-4 max-w-prose space-y-2 text-sm leading-6 text-muted-foreground">
          <li>
            <span className="text-foreground">Corrections.</span> If something on this site is
            wrong, I want to know. Numbers especially — most articles here reconstruct published
            figures from primary sources, and when a reconstruction is off, that is a real bug.
          </li>
          <li>
            <span className="text-foreground">Papers and releases worth writing up.</span> Send a
            link. I read more than I publish.
          </li>
          <li>
            <span className="text-foreground">Engineering work in 3D perception, CUDA, or
            inference infrastructure.</span>{" "}
            Collaboration, consulting, or comparing notes.
          </li>
          <li>
            <span className="text-foreground">Problems with the machine-readable surfaces.</span> A
            broken endpoint, a wrong schema, an MCP tool that misbehaves — see the{" "}
            <Link href="/developers" className="underline underline-offset-4 hover:text-foreground">
              developer portal
            </Link>
            .
          </li>
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">
          What I&rsquo;ll probably not reply to
        </h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          Unsolicited sales, recruiter mail with no role attached, link-exchange and guest-post
          requests, and anything asking me to promote a product I have not used. Nothing personal —
          there is simply more of it than there is time.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-heading text-xl font-bold tracking-tight">For agents</h2>
        <p className="mt-4 max-w-prose leading-7 text-muted-foreground">
          The same identity facts are available as JSON at{" "}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- API endpoint for agents, not a page */}
          <a href="/api/profile" className="underline underline-offset-4 hover:text-foreground">
            /api/profile
          </a>{" "}
          and as markdown at{" "}
          <a href="/about.md" className="underline underline-offset-4 hover:text-foreground">
            /about.md
          </a>
          . Please don&rsquo;t send automated mail to the address above; if you need something the
          site does not expose, the{" "}
          <Link href="/developers" className="underline underline-offset-4 hover:text-foreground">
            developer portal
          </Link>{" "}
          says how to ask for it.
        </p>
      </section>
    </PageShell>
  )
}
