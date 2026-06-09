import type {
  Article,
  BlogPosting,
  Person,
  ScholarlyArticle,
  SoftwareSourceCode,
  WebSite,
  WithContext,
} from "schema-dts"

import { profile } from "@/data/profile"
import type { Publication } from "@/data/publications"
import type { Article as ContentArticle, BlogPost, Project } from "@/lib/content"
import { absoluteUrl, siteUrl } from "@/lib/site"

// Centralized JSON-LD builders (schema-dts-typed). Injected via <JsonLd /> with
// the `<` escape the Next.js json-ld guide requires.

export function personJsonLd(): WithContext<Person> {
  return {
    "@context": "https://schema.org",
    "@type": "Person",
    "@id": `${siteUrl}/#person`,
    name: profile.name,
    jobTitle: profile.title,
    email: `mailto:${profile.links.email}`,
    url: siteUrl,
    worksFor: {
      "@type": "Organization",
      name: profile.company.name,
      url: profile.company.url,
    },
    address: { "@type": "PostalAddress", addressLocality: profile.location },
    sameAs: [
      profile.links.github,
      profile.links.linkedin,
      profile.links.x,
      profile.links.medium,
      profile.links.scholar,
      profile.links.website,
    ],
    knowsAbout: [
      "Deep Learning",
      "Computer Vision",
      "3D Perception",
      "LiDAR",
      "Point Clouds",
      "CUDA",
      "MLOps",
      "PyTorch",
    ],
  }
}

export function websiteJsonLd(): WithContext<WebSite> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${siteUrl}/#website`,
    name: `${profile.name} — AI site`,
    url: siteUrl,
    description:
      "Dual-native personal site: human-readable pages with agent-readable markdown, JSON, and MCP surfaces. Managed by Claude.",
    author: { "@id": `${siteUrl}/#person` },
    // `query-input` is the Google sitelinks-searchbox extension to SearchAction,
    // which schema-dts does not model — cast to keep the spec-required shape.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${siteUrl}/search?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    } as WebSite["potentialAction"],
  }
}

export function blogPostingJsonLd(post: BlogPost): WithContext<BlogPosting> {
  return {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    ...(post.updated ? { dateModified: post.updated } : {}),
    url: absoluteUrl(`/blog/${post.slug}`),
    keywords: post.tags.join(", "),
    author: { "@id": `${siteUrl}/#person` },
  }
}

export function articleJsonLd(article: ContentArticle): WithContext<Article> {
  return {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.description,
    datePublished: article.date,
    ...(article.updated ? { dateModified: article.updated } : {}),
    url: absoluteUrl(`/articles/${article.slug}`),
    keywords: article.tags.join(", "),
    author: { "@id": `${siteUrl}/#person` },
  }
}

export function scholarlyArticleJsonLd(
  pub: Publication
): WithContext<ScholarlyArticle> {
  return {
    "@context": "https://schema.org",
    "@type": "ScholarlyArticle",
    headline: pub.title,
    author: pub.authors.map((name) =>
      name === profile.name
        ? { "@id": `${siteUrl}/#person` }
        : { "@type": "Person" as const, name }
    ),
    datePublished: String(pub.year),
    sameAs: pub.url,
    identifier: `doi:${pub.doi}`,
    isPartOf: {
      "@type": "PublicationIssue",
      issueNumber: pub.issue,
      isPartOf: {
        "@type": "PublicationVolume",
        volumeNumber: pub.volume,
        isPartOf: { "@type": "Periodical", name: pub.journal },
      },
    },
    pagination: pub.pages,
  }
}

export function softwareSourceCodeJsonLd(
  project: Project
): WithContext<SoftwareSourceCode> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareSourceCode",
    name: project.title,
    description: project.description,
    url: absoluteUrl(`/projects/${project.slug}`),
    ...(project.repo ? { codeRepository: project.repo } : {}),
    programmingLanguage: project.stack.join(", "),
    author: { "@id": `${siteUrl}/#person` },
  }
}

export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  )
}
