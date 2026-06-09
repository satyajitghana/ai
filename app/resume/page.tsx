import type { Metadata } from "next"

import { PageShell } from "@/components/site/page-shell"
import { resume } from "@/data/resume"
import type { ResumeExperienceRole } from "@/data/resume"

export const metadata: Metadata = {
  title: "Resume",
  description:
    "Resume of Satyajit Ghana — Head of Engineering at Inkers Technology. Deep learning, 3D perception, and high-performance systems.",
}

const PDF_PATH = "/satyajit-ghana-resume.pdf"

// "2024-01" → "Jan 2024"; undefined end → "Present".
function formatMonth(iso?: string): string {
  if (!iso) return "Present"
  const [year, month] = iso.split("-")
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ]
  const m = months[Number(month) - 1]
  return m ? `${m} ${year}` : (year ?? iso)
}

function roleRange(role: ResumeExperienceRole): string {
  return `${formatMonth(role.start)} – ${formatMonth(role.end)}`
}

function SectionHeader({ label }: { label: string }) {
  return (
    <h2 className="mt-12 mb-4 font-mono text-xs tracking-wide text-muted-foreground uppercase">
      {label}
    </h2>
  )
}

export default function ResumePage() {
  const { contact } = resume

  return (
    <PageShell agentPath={{ md: "/resume.md", json: "/api/resume" }}>
      {/* Header */}
      <header>
        <div className="flex items-baseline justify-between gap-4">
          <h1 className="font-heading text-3xl font-bold tracking-tight text-balance">
            {contact.name}
          </h1>
          <a
            href={PDF_PATH}
            download
            className="shrink-0 rounded border px-3 py-1.5 font-mono text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            download pdf ↓
          </a>
        </div>
        <p className="mt-2 font-mono text-sm text-muted-foreground">
          {contact.title} ·{" "}
          <a
            href={contact.company.url}
            className="underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground"
          >
            {contact.company.name}
          </a>{" "}
          · {contact.location}
        </p>
        <p className="mt-3 font-mono text-xs text-muted-foreground">
          <a className="hover:text-foreground" href={`mailto:${contact.email}`}>
            {contact.email}
          </a>{" "}
          ·{" "}
          <a className="hover:text-foreground" href={contact.github}>
            github
          </a>{" "}
          ·{" "}
          <a className="hover:text-foreground" href={contact.linkedin}>
            linkedin
          </a>{" "}
          ·{" "}
          <a className="hover:text-foreground" href={contact.website}>
            ai.thesatyajit.com
          </a>
        </p>
        <p className="mt-6 max-w-prose leading-7 text-muted-foreground">
          {resume.summary}
        </p>
      </header>

      {/* Experience */}
      <section>
        <SectionHeader label="Experience" />
        <ul className="space-y-8">
          {resume.experience.map((job) => (
            <li key={job.organization}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium">
                  {job.url ? (
                    <a
                      href={job.url}
                      className="underline-offset-4 hover:underline"
                    >
                      {job.organization}
                    </a>
                  ) : (
                    job.organization
                  )}
                </h3>
                {job.location ? (
                  <span className="shrink-0 font-mono text-xs text-muted-foreground">
                    {job.location}
                  </span>
                ) : null}
              </div>
              <ul className="mt-2 space-y-1">
                {job.roles.map((role) => (
                  <li
                    key={role.title}
                    className="flex items-baseline justify-between gap-4"
                  >
                    <span className="text-sm">{role.title}</span>
                    <span className="shrink-0 font-mono text-xs text-muted-foreground">
                      {roleRange(role)}
                    </span>
                  </li>
                ))}
              </ul>
              <ul className="mt-3 space-y-1.5">
                {job.highlights.map((h) => (
                  <li
                    key={h}
                    className="text-sm leading-6 text-muted-foreground"
                  >
                    <span className="text-foreground/40">—</span> {h}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </section>

      {/* Education */}
      <section>
        <SectionHeader label="Education" />
        <ul className="space-y-4">
          {resume.education.map((edu) => (
            <li key={edu.institution}>
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-medium">{edu.institution}</h3>
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {edu.end}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {edu.degree}
                {edu.location ? ` · ${edu.location}` : ""}
                {edu.highlights.length
                  ? ` · ${edu.highlights.join(" · ")}`
                  : ""}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Skills */}
      <section>
        <SectionHeader label="Skills" />
        <dl className="space-y-3">
          {resume.skills.map((group) => (
            <div
              key={group.name}
              className="flex flex-col gap-1 sm:flex-row sm:gap-4"
            >
              <dt className="w-32 shrink-0 font-mono text-xs text-muted-foreground">
                {group.name}
              </dt>
              <dd className="text-sm">{group.skills.join(" · ")}</dd>
            </div>
          ))}
        </dl>
      </section>

      {/* Selected Projects */}
      <section>
        <SectionHeader label="Selected Projects" />
        <ul className="space-y-4">
          {resume.projects.map((project) => (
            <li key={project.name}>
              <a
                href={project.url}
                className="font-medium underline-offset-4 hover:underline"
              >
                {project.name}
              </a>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                {project.description}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Publications */}
      <section>
        <SectionHeader label="Publications" />
        <ul className="space-y-4">
          {resume.publications.map((pub) => (
            <li key={pub.title}>
              {pub.url ? (
                <a
                  href={pub.url}
                  className="font-medium underline-offset-4 hover:underline"
                >
                  {pub.title}
                </a>
              ) : (
                <span className="font-medium">{pub.title}</span>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                {pub.publisher} · {pub.details} · {pub.date.slice(0, 4)}
                {pub.doi ? (
                  <>
                    {" "}
                    · <span className="font-mono text-xs">DOI {pub.doi}</span>
                  </>
                ) : null}
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* Patents */}
      <section>
        <SectionHeader label="Patents" />
        <ul className="space-y-4">
          {resume.patents.map((patent) => (
            <li key={patent.applicationNumber}>
              <h3 className="font-medium">{patent.title}</h3>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {patent.status} · {patent.applicationNumber} · filed{" "}
                {patent.filed} · {patent.assignee}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </PageShell>
  )
}
