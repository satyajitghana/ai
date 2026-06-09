import { resume } from "@/data/resume"

// Static JSON Resume (jsonresume.org schema) — a machine-readable resume surface
// for agents and resume tooling. Route handlers are uncached by default in
// Next.js 16, so opt into static generation explicitly.
export const dynamic = "force-static"

// "2024-01" → "2024-01-01" (JSON Resume uses ISO 8601 dates).
function isoDate(month?: string): string | undefined {
  if (!month) return undefined
  return month.length === 7 ? `${month}-01` : month
}

export function GET() {
  const { contact } = resume

  const jsonResume = {
    $schema:
      "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: contact.name,
      label: `${contact.title} @ ${contact.company.name}`,
      email: contact.email,
      summary: resume.summary,
      location: {
        city: "Bengaluru",
        countryCode: "IN",
        region: "Karnataka",
      },
      url: contact.website,
      profiles: [
        {
          network: "GitHub",
          username: "satyajitghana",
          url: contact.github,
        },
        {
          network: "LinkedIn",
          username: "satyajitghana",
          url: contact.linkedin,
        },
      ],
    },
    work: resume.experience.flatMap((job) =>
      job.roles.map((role) => ({
        name: job.organization,
        position: role.title,
        url: job.url,
        location: job.location,
        startDate: isoDate(role.start),
        endDate: isoDate(role.end),
        summary: job.summary,
        highlights: job.highlights,
      }))
    ),
    education: resume.education.map((edu) => ({
      institution: edu.institution,
      area: edu.degree,
      studyType: edu.degree,
      endDate: edu.end,
      courses: edu.highlights,
    })),
    skills: resume.skills.map((group) => ({
      name: group.name,
      keywords: group.skills,
    })),
    projects: resume.projects.map((project) => ({
      name: project.name,
      description: project.description,
      url: project.url,
    })),
    publications: resume.publications.map((pub) => ({
      name: pub.title,
      publisher: pub.publisher,
      releaseDate: pub.date,
      url: pub.url,
      summary: pub.details,
    })),
    // JSON Resume has no native "patents" field; expose under custom `patents`.
    patents: resume.patents.map((patent) => ({
      title: patent.title,
      status: patent.status,
      applicationNumber: patent.applicationNumber,
      filed: patent.filed,
      assignee: patent.assignee,
    })),
  }

  return Response.json(jsonResume)
}
