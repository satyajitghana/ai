import {
  Document,
  Link,
  Page,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer"
import type { ReactElement } from "react"

import type { Resume, ResumeExperienceRole } from "@/data/resume"

// Build-time PDF resume. IMPORTANT: this module is imported ONLY by
// scripts/build-resume-pdf.mts — never by a Next.js page or route — because
// @react-pdf/renderer is a build/runtime-only dependency. It uses the built-in
// Helvetica/Courier font families (no remote fonts fetched) so the build is
// hermetic and offline-safe.

const COLORS = {
  text: "#1a1a1a",
  muted: "#666666",
  rule: "#d4d4d4",
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 26,
    paddingBottom: 18,
    paddingHorizontal: 44,
    fontFamily: "Helvetica",
    fontSize: 9,
    lineHeight: 1.35,
    color: COLORS.text,
  },
  name: {
    fontFamily: "Helvetica-Bold",
    fontSize: 20,
    letterSpacing: -0.4,
  },
  title: {
    marginTop: 3,
    fontSize: 10,
    color: COLORS.muted,
  },
  contactLine: {
    marginTop: 4,
    fontFamily: "Courier",
    fontSize: 7.5,
    color: COLORS.muted,
  },
  summary: {
    marginTop: 7,
    color: COLORS.muted,
    lineHeight: 1.2,
  },
  sectionHeading: {
    marginTop: 8,
    marginBottom: 4,
    fontFamily: "Courier",
    fontSize: 8,
    letterSpacing: 1,
    color: COLORS.muted,
    textTransform: "uppercase",
    borderBottomWidth: 0.5,
    borderBottomColor: COLORS.rule,
    paddingBottom: 3,
  },
  entry: {
    marginBottom: 6,
  },
  rowBetween: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
  },
  orgName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10.5,
  },
  metaMono: {
    fontFamily: "Courier",
    fontSize: 8,
    color: COLORS.muted,
  },
  roleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 1.5,
  },
  roleTitle: {
    fontSize: 9,
  },
  bullet: {
    flexDirection: "row",
    marginTop: 1,
  },
  bulletMark: {
    width: 10,
    color: COLORS.muted,
  },
  bulletText: {
    flex: 1,
    color: COLORS.muted,
    lineHeight: 1.35,
  },
  skillRow: {
    flexDirection: "row",
    marginBottom: 2,
  },
  skillGroup: {
    fontFamily: "Courier",
    fontSize: 8,
    width: 78,
    color: COLORS.muted,
  },
  skillList: {
    flex: 1,
  },
  link: {
    color: COLORS.text,
    textDecoration: "none",
  },
  projectGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  projectCell: {
    width: "50%",
    paddingRight: 14,
    marginBottom: 4,
  },
  projectName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    color: COLORS.text,
    textDecoration: "none",
  },
  projectDesc: {
    color: COLORS.muted,
    marginTop: 1,
  },
})

// "2024-01" → "Jan 2024"; undefined → "Present".
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

function SectionHeading({ children }: { children: string }) {
  return <Text style={styles.sectionHeading}>{children}</Text>
}

function Bullet({ children }: { children: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={styles.bulletMark}>—</Text>
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  )
}

export function ResumeDocument({ resume }: { resume: Resume }): ReactElement {
  const { contact } = resume
  const contactLine = [
    contact.email,
    "github.com/satyajitghana",
    "linkedin.com/in/satyajitghana",
    "ai.thesatyajit.com",
  ].join("  ·  ")

  return (
    <Document
      title={`${contact.name} — Resume`}
      author={contact.name}
      subject="Resume"
    >
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <Text style={styles.name}>{contact.name}</Text>
        <Text style={styles.title}>
          {contact.title} · {contact.company.name} · {contact.location}
        </Text>
        <Text style={styles.contactLine}>{contactLine}</Text>
        <Text style={styles.summary}>{resume.summary}</Text>

        {/* Experience */}
        <SectionHeading>Experience</SectionHeading>
        {resume.experience.map((job) => (
          <View key={job.organization} style={styles.entry} wrap={false}>
            <View style={styles.rowBetween}>
              <Text style={styles.orgName}>{job.organization}</Text>
              {job.location ? (
                <Text style={styles.metaMono}>{job.location}</Text>
              ) : null}
            </View>
            {job.roles.map((role) => (
              <View key={role.title} style={styles.roleRow}>
                <Text style={styles.roleTitle}>{role.title}</Text>
                <Text style={styles.metaMono}>{roleRange(role)}</Text>
              </View>
            ))}
            <View style={{ marginTop: 2 }}>
              {job.highlights.map((h) => (
                <Bullet key={h}>{h}</Bullet>
              ))}
            </View>
          </View>
        ))}

        {/* Education */}
        <SectionHeading>Education</SectionHeading>
        {resume.education.map((edu) => (
          <View key={edu.institution} style={styles.entry} wrap={false}>
            <View style={styles.rowBetween}>
              <Text style={styles.orgName}>{edu.institution}</Text>
              <Text style={styles.metaMono}>{edu.end}</Text>
            </View>
            <Text style={{ color: COLORS.muted, marginTop: 1 }}>
              {[edu.degree, edu.location, ...edu.highlights]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        ))}

        {/* Skills */}
        <SectionHeading>Skills</SectionHeading>
        {resume.skills.map((group) => (
          <View key={group.name} style={styles.skillRow}>
            <Text style={styles.skillGroup}>{group.name}</Text>
            <Text style={styles.skillList}>{group.skills.join(" · ")}</Text>
          </View>
        ))}

        {/* Selected Projects — two-column grid to stay compact */}
        <SectionHeading>Selected Projects</SectionHeading>
        <View style={styles.projectGrid}>
          {resume.projects.map((project) => (
            <View key={project.name} style={styles.projectCell} wrap={false}>
              <Link src={project.url} style={styles.projectName}>
                {project.name}
              </Link>
              <Text style={styles.projectDesc}>{project.description}</Text>
            </View>
          ))}
        </View>

        {/* Publications */}
        <SectionHeading>Publications</SectionHeading>
        {resume.publications.map((pub) => (
          <View key={pub.title} style={{ marginBottom: 2 }}>
            {pub.url ? (
              <Link
                src={pub.url}
                style={{
                  ...styles.projectName,
                  fontSize: 9.5,
                }}
              >
                {pub.title}
              </Link>
            ) : (
              <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>
                {pub.title}
              </Text>
            )}
            <Text style={styles.projectDesc}>
              {[
                pub.publisher,
                pub.details,
                pub.date.slice(0, 4),
                pub.doi ? `DOI ${pub.doi}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Text>
          </View>
        ))}

        {/* Patents */}
        <SectionHeading>Patents</SectionHeading>
        {resume.patents.map((patent) => (
          <View key={patent.applicationNumber} style={{ marginBottom: 3 }}>
            <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 9.5 }}>
              {patent.title}
            </Text>
            <Text style={styles.metaMono}>
              {[
                patent.status,
                patent.applicationNumber,
                `filed ${patent.filed}`,
                patent.assignee,
              ].join(" · ")}
            </Text>
          </View>
        ))}
      </Page>
    </Document>
  )
}
