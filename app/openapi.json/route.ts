import { problemSchema } from "@/lib/api-error"
import { siteUrl } from "@/lib/site"

// Machine-readable spec of the JSON API so agents can auto-discover it
// (advertised from /.well-known/ai-plugin.json, /llms.txt and /developers).
//
// Written for function calling, not just for humans: every operation carries a
// unique operationId, a description, typed parameters and a typed 200 schema,
// because a tool-calling model turns each operation into a callable and cannot
// invent a name or predict a response shape it was never given.
export const dynamic = "force-static"

const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` })
const arrayOf = (name: string) => ({ type: "array", items: ref(name) })

// Every operation shares the same failure envelope and the same rate-limit
// headers, so they are declared once and referenced everywhere.
const errors = (...codes: ("400" | "404" | "429" | "500" | "502" | "503")[]) =>
  Object.fromEntries(codes.map((c) => [c, { $ref: `#/components/responses/${c}` }]))

const rateLimitHeaders = {
  RateLimit: { $ref: "#/components/headers/RateLimit" },
  "RateLimit-Policy": { $ref: "#/components/headers/RateLimitPolicy" },
}

/** A GET that returns a typed payload, with the shared errors attached. */
function get(opts: {
  id: string
  summary: string
  description: string
  schema: object
  tags: string[]
  parameters?: object[]
  extraErrors?: ("400" | "404")[]
}) {
  return {
    get: {
      operationId: opts.id,
      summary: opts.summary,
      description: opts.description,
      tags: opts.tags,
      ...(opts.parameters ? { parameters: opts.parameters } : {}),
      responses: {
        "200": {
          description: "OK",
          headers: rateLimitHeaders,
          content: { "application/json": { schema: opts.schema } },
        },
        ...errors(...(opts.extraErrors ?? []), "429", "500"),
      },
    },
  }
}

const S = {
  Link: { type: "object", additionalProperties: { type: "string" } },
  Profile: {
    type: "object",
    required: ["name", "title", "location"],
    properties: {
      name: { type: "string" },
      title: { type: "string" },
      company: { type: "object", properties: { name: { type: "string" }, url: { type: "string", format: "uri" } } },
      location: { type: "string" },
      tagline: { type: "string" },
      bio: { type: "array", items: { type: "string" } },
      links: { type: "object", additionalProperties: { type: "string" } },
      seedStats: {
        type: "object",
        properties: { repos: { type: "integer" }, stars: { type: "integer" }, followers: { type: "integer" } },
      },
    },
  },
  ContentSummary: {
    type: "object",
    required: ["slug", "title", "url"],
    description: "A content item without its body. Fetch the body from the .md twin at `url` + '.md'.",
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      date: { type: "string", format: "date" },
      updated: { type: "string", format: "date" },
      tags: { type: "array", items: { type: "string" } },
      url: { type: "string", format: "uri" },
      readingTimeMins: { type: "integer" },
    },
  },
  ContentDetail: {
    allOf: [
      { $ref: "#/components/schemas/ContentSummary" },
      { type: "object", properties: { body: { type: "string", description: "Raw MDX source." } } },
    ],
  },
  Project: {
    type: "object",
    required: ["slug", "title"],
    properties: {
      slug: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      date: { type: "string", format: "date" },
      stack: { type: "array", items: { type: "string" } },
      repo: { type: "string", format: "uri" },
      demo: { type: "string", format: "uri" },
      featured: { type: "boolean" },
      url: { type: "string", format: "uri" },
    },
  },
  ArxivDigest: {
    type: "object",
    required: ["date", "papers"],
    properties: {
      date: { type: "string", format: "date" },
      url: { type: "string", format: "uri" },
      papers: {
        type: "array",
        items: {
          type: "object",
          required: ["arxivId", "title"],
          properties: {
            arxivId: { type: "string" },
            title: { type: "string" },
            authors: { type: "array", items: { type: "string" } },
            categories: { type: "array", items: { type: "string" } },
            abstract: { type: "string" },
            take: { type: "string", description: "Satyajit's one-line assessment." },
            standout: { type: "boolean" },
            links: { type: "object", additionalProperties: { type: "string" } },
          },
        },
      },
    },
  },
  Publication: {
    type: "object",
    properties: {
      title: { type: "string" },
      authors: { type: "array", items: { type: "string" } },
      journal: { type: "string" },
      year: { type: "integer" },
      doi: { type: "string" },
      url: { type: "string", format: "uri" },
    },
  },
  Patent: {
    type: "object",
    properties: {
      title: { type: "string" },
      applicationNumber: { type: "string" },
      status: { type: "string" },
      filed: { type: "string", format: "date" },
    },
  },
  HealthPanel: {
    type: "object",
    properties: {
      updated: { type: "string", format: "date" },
      markers: {
        type: "array",
        items: {
          type: "object",
          properties: {
            name: { type: "string" },
            value: { type: "number" },
            unit: { type: "string" },
            status: { type: "string", enum: ["optimal", "normal", "watch", "high", "low"] },
            range: { type: "string" },
          },
        },
      },
    },
  },
  SearchResult: {
    type: "object",
    required: ["query", "count", "results"],
    properties: {
      query: { type: "string" },
      count: { type: "integer" },
      results: {
        type: "array",
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["article", "blog", "log", "project", "arxiv", "snippet", "note"] },
            slug: { type: "string" },
            title: { type: "string" },
            url: { type: "string", format: "uri" },
            score: { type: "number" },
            heading: { type: "string" },
            snippet: { type: "string" },
          },
        },
      },
    },
  },
  GithubStats: {
    type: "object",
    properties: {
      repos: { type: "integer" },
      stars: { type: "integer" },
      followers: { type: "integer" },
      live: { type: "boolean", description: "false when serving seed stats because no token is configured." },
    },
  },
  KeyValueList: {
    type: "object",
    additionalProperties: true,
    description: "Hand-curated record from data/*.ts. Shape is stable but intentionally open.",
  },
  AskAnswer: {
    type: "object",
    required: ["answer", "model"],
    properties: {
      answer: { type: "string", description: "Grounded answer with inline citations to site pages." },
      model: { type: "string" },
      routed: { type: "string", description: "Which tier the question was routed to." },
    },
  },
  AskStatus: {
    type: "object",
    properties: {
      online: { type: "boolean" },
      model: { type: "string" },
      usage: { type: "string" },
    },
  },
  Problem: problemSchema,
}

export function GET() {
  const spec = {
    openapi: "3.1.0",
    info: {
      title: "Satyajit Ghana — site API",
      summary: "Read-only JSON API over an AI-native personal site.",
      description: [
        "Read-only JSON API over the content layer of ai.thesatyajit.com — writing, projects, daily arXiv digests, resume, publications, patents and a quantified-self health panel.",
        "",
        "**Other agent surfaces on the same site**",
        "- Markdown twin of any page: append `.md`, or send `Accept: text/markdown` to the canonical URL.",
        "- `/llms.txt` — curated index. `/llms-full.txt` — the whole corpus in one file.",
        "- MCP endpoint (Streamable HTTP, read-only tools): `/api/mcp/mcp`.",
        "",
        "**Auth** — none. Everything is public.",
        "",
        "**Versioning** — this is v1. Every endpoint is also mounted under `/api/v1/*`; pin that prefix if you want a stable contract. Breaking changes ship under a new prefix (`/api/v2/*`), and the old prefix keeps serving for at least 180 days carrying `Deprecation` and `Sunset` response headers (RFC 9745 / RFC 8594).",
        "",
        "**Rate limits** — every response carries `RateLimit` and `RateLimit-Policy` (RFC 9331). A 429 adds `Retry-After`. Budget is 240 requests/minute with a 30-request burst; the model-backed endpoints are stricter.",
        "",
        "**Errors** — every non-2xx response is `application/problem+json` (RFC 9457) with a stable `code` field. Switch on `code`, not on the message.",
      ].join("\n"),
      version: "1.0.0",
      contact: {
        name: "Satyajit Ghana",
        email: "satyajitghana7@gmail.com",
        url: `${siteUrl}/contact`,
      },
      license: { name: "Content: CC BY 4.0", url: `${siteUrl}/colophon` },
      termsOfService: `${siteUrl}/privacy`,
    },
    externalDocs: { description: "Developer portal", url: `${siteUrl}/developers` },
    servers: [
      { url: `${siteUrl}/api/v1`, description: "Versioned base path — pin this." },
      { url: siteUrl, description: "Unversioned root (paths below include /api)." },
    ],
    tags: [
      { name: "identity", description: "Who Satyajit is: profile, resume, publications, patents." },
      { name: "content", description: "Writing: articles, blog posts, logs, notes, snippets, arXiv digests." },
      { name: "records", description: "Hand-curated data records: health, now, uses, reading." },
      { name: "search", description: "Full-text search across the corpus." },
      { name: "ai", description: "Model-backed endpoints. These are rate limited and can be offline." },
    ],
    paths: {
      "/api/profile": get({
        id: "getProfile",
        summary: "Profile, links, and GitHub seed stats",
        description: "Identity record: name, title, employer, location, bio, social links and cached GitHub counts. Start here to establish who the site belongs to.",
        schema: ref("Profile"),
        tags: ["identity"],
      }),
      "/api/resume": get({
        id: "getResume",
        summary: "Full structured resume",
        description: "Complete CV as structured JSON: experience, education, skills. A JSON Resume formatted copy is at /resume.json and a PDF at /satyajit-ghana-resume.pdf.",
        schema: ref("KeyValueList"),
        tags: ["identity"],
      }),
      "/api/publications": get({
        id: "listPublications",
        summary: "Peer-reviewed publications",
        description: "Journal and conference publications with DOIs.",
        schema: arrayOf("Publication"),
        tags: ["identity"],
      }),
      "/api/patents": get({
        id: "listPatents",
        summary: "Patent applications",
        description: "Pending USPTO patent applications with application numbers and status.",
        schema: arrayOf("Patent"),
        tags: ["identity"],
      }),
      "/api/projects": get({
        id: "listProjects",
        summary: "Projects with descriptions and stack",
        description: "Every project page, with tech stack, repository and demo links. `featured: true` marks the ones shown on the homepage.",
        schema: arrayOf("Project"),
        tags: ["content"],
      }),
      "/api/articles": get({
        id: "listArticles",
        summary: "Long-form articles and explainers",
        description: "The site's flagship writing — paper explainers and model deep-dives, each with original interactive diagrams. Summaries only; fetch the body from the `.md` twin.",
        schema: arrayOf("ContentSummary"),
        tags: ["content"],
      }),
      "/api/posts": get({
        id: "listPosts",
        summary: "Blog posts and daily logs",
        description: "Combined index of blog posts and dated build logs.",
        schema: arrayOf("ContentSummary"),
        tags: ["content"],
      }),
      "/api/posts/{slug}": {
        get: {
          operationId: "getPost",
          summary: "One blog post or log, with body",
          description: "Full record for a single post including the raw MDX body. Get valid slugs from listPosts.",
          tags: ["content"],
          parameters: [
            {
              name: "slug",
              in: "path",
              required: true,
              description: "Post or log slug, e.g. `contextual-retrieval`.",
              schema: { type: "string", pattern: "^[a-z0-9-]+$" },
            },
          ],
          responses: {
            "200": {
              description: "OK",
              headers: rateLimitHeaders,
              content: { "application/json": { schema: ref("ContentDetail") } },
            },
            ...errors("404", "429", "500"),
          },
        },
      },
      "/api/arxiv": get({
        id: "listArxivDigests",
        summary: "Daily arXiv digests with takes",
        description: "Dated digests of arXiv papers, each entry carrying the abstract plus a one-line editorial take and a standout flag.",
        schema: arrayOf("ArxivDigest"),
        tags: ["content"],
      }),
      "/api/notes": get({
        id: "listNotes",
        summary: "Digital-garden notes",
        description: "Short interlinked notes. Bodies are at the `.md` twin of each URL.",
        schema: arrayOf("ContentSummary"),
        tags: ["content"],
      }),
      "/api/snippets": get({
        id: "listSnippets",
        summary: "Code snippets",
        description: "Small copy-paste code samples, tagged by language (cuda, python, cpp, bash).",
        schema: arrayOf("ContentSummary"),
        tags: ["content"],
      }),
      "/api/architectures": get({
        id: "listArchitectures",
        summary: "Model architecture diagrams",
        description: "Index of the reference-quality model architecture diagrams rendered on the site.",
        schema: arrayOf("ContentSummary"),
        tags: ["content"],
      }),
      "/api/health": get({
        id: "getHealthPanel",
        summary: "Biomarker panel with derived statuses",
        description: "Quantified-self blood panel: each marker with its value, unit, reference range and a derived status.",
        schema: ref("HealthPanel"),
        tags: ["records"],
      }),
      "/api/now": get({
        id: "getNow",
        summary: "Current focus",
        description: "What Satyajit is working on right now, in the /now page convention.",
        schema: ref("KeyValueList"),
        tags: ["records"],
      }),
      "/api/uses": get({
        id: "getUses",
        summary: "Gear and tooling",
        description: "Hardware, editor, and daily-driver software.",
        schema: ref("KeyValueList"),
        tags: ["records"],
      }),
      "/api/reading": get({
        id: "getReading",
        summary: "Reading list",
        description: "Papers and books, with status and notes.",
        schema: ref("KeyValueList"),
        tags: ["records"],
      }),
      "/api/github": get({
        id: "getGithubStats",
        summary: "GitHub stats (live or seed)",
        description: "Repository, star and follower counts. Falls back to cached seed values when no GitHub token is configured; check the `live` flag.",
        schema: ref("GithubStats"),
        tags: ["identity"],
      }),
      "/api/search": get({
        id: "searchContent",
        summary: "Full-text search across all content",
        description: "BM25 search over contextualized chunks of every article, post, log, project, digest, snippet and note. Returns ranked matches with the matching heading and a snippet. This is the fastest way to find the right page before fetching it.",
        schema: ref("SearchResult"),
        tags: ["search"],
        extraErrors: ["400"],
        parameters: [
          {
            name: "q",
            in: "query",
            required: true,
            description: "Search terms.",
            schema: { type: "string", minLength: 1 },
          },
          {
            name: "limit",
            in: "query",
            required: false,
            description: "Maximum results to return.",
            schema: { type: "integer", minimum: 1, maximum: 50, default: 20 },
          },
        ],
      }),
      "/api/ask": {
        get: {
          operationId: "getAskStatus",
          summary: "Check whether the site AI is online",
          description: "Cheap liveness probe for the ask endpoint. Call this before POSTing if you want to avoid a 503.",
          tags: ["ai"],
          responses: {
            "200": {
              description: "OK",
              headers: rateLimitHeaders,
              content: { "application/json": { schema: ref("AskStatus") } },
            },
            ...errors("429", "500"),
          },
        },
        post: {
          operationId: "askSatyajitSite",
          summary: "Ask the site AI a grounded, cited question",
          description: "Answers questions about Satyajit, his writing and his work, grounded in this site's content with inline citations. Use it for synthesis across pages; use searchContent when you only need to locate a page.",
          tags: ["ai"],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["question"],
                  properties: {
                    question: { type: "string", minLength: 1, maxLength: 4000, description: "A natural-language question about the site's subject matter." },
                  },
                },
              },
            },
          },
          responses: {
            "200": {
              description: "OK",
              headers: rateLimitHeaders,
              content: { "application/json": { schema: ref("AskAnswer") } },
            },
            ...errors("400", "429", "502", "503"),
          },
        },
      },
    },
    components: {
      schemas: S,
      headers: {
        RateLimit: {
          description: "RFC 9331 quota state, e.g. `limit=240, remaining=239, reset=60`.",
          schema: { type: "string" },
        },
        RateLimitPolicy: {
          description: "RFC 9331 policy, e.g. `240;w=60, 30;w=10`.",
          schema: { type: "string" },
        },
        RetryAfter: {
          description: "Seconds to wait before retrying.",
          schema: { type: "integer" },
        },
      },
      responses: Object.fromEntries(
        (
          [
            ["400", "Invalid request — a required parameter is missing or malformed."],
            ["404", "No such resource."],
            ["429", "Rate limited. Wait for Retry-After, then resume."],
            ["500", "Unexpected server error."],
            ["502", "Upstream model error after the fallback chain was exhausted."],
            ["503", "Model-backed endpoint is offline. Static surfaces are unaffected."],
          ] as const
        ).map(([code, description]) => [
          code,
          {
            description,
            headers: code === "429" ? { ...rateLimitHeaders, "Retry-After": { $ref: "#/components/headers/RetryAfter" } } : rateLimitHeaders,
            content: { "application/problem+json": { schema: ref("Problem") } },
          },
        ]),
      ),
    },
  }

  return Response.json(spec)
}
