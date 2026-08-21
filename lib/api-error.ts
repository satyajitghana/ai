// RFC 9457 "Problem Details for HTTP APIs" — the one error shape every JSON
// surface on this site returns.
//
// Why this and not `{ error: "..." }`: an agent that hits a failure needs three
// things to recover without guessing — a stable machine-readable code, a human
// sentence, and somewhere to go next. RFC 9457 standardises the first two
// (`type`, `title`, `status`, `detail`) and lets us add the third as an
// extension member (`hint`, `docs`). The media type is application/problem+json
// so a client can tell a problem from a payload without parsing it.

import { absoluteUrl } from "@/lib/site"

export type ProblemCode =
  | "not_found"
  | "invalid_request"
  | "method_not_allowed"
  | "rate_limited"
  | "bad_gateway"
  | "service_unavailable"
  | "internal_error"

const STATUS: Record<ProblemCode, number> = {
  not_found: 404,
  invalid_request: 400,
  method_not_allowed: 405,
  rate_limited: 429,
  bad_gateway: 502,
  service_unavailable: 503,
  internal_error: 500,
}

const TITLE: Record<ProblemCode, string> = {
  not_found: "Not Found",
  invalid_request: "Invalid Request",
  method_not_allowed: "Method Not Allowed",
  rate_limited: "Too Many Requests",
  bad_gateway: "Upstream Error",
  service_unavailable: "Service Unavailable",
  internal_error: "Internal Error",
}

export type ProblemInit = {
  /** Machine-readable code. Also becomes the `type` URI fragment. */
  code: ProblemCode
  /** One human-readable sentence about this specific occurrence. */
  detail: string
  /** What the caller should do next. Agents act on this. */
  hint?: string
  /** The request path, when known. */
  instance?: string
  /** Extra response headers (e.g. Retry-After on a 429). */
  headers?: Record<string, string>
}

/**
 * Build an RFC 9457 problem response. Every non-2xx JSON response on this site
 * goes through here so the shape is identical everywhere.
 */
export function problem({ code, detail, hint, instance, headers }: ProblemInit): Response {
  const status = STATUS[code]
  const body = {
    type: absoluteUrl(`/developers#error-${code}`),
    title: TITLE[code],
    status,
    code,
    detail,
    ...(hint ? { hint } : {}),
    ...(instance ? { instance } : {}),
    docs: absoluteUrl("/openapi.json"),
  }

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/problem+json; charset=utf-8",
      "cache-control": "no-store",
      ...headers,
    },
  })
}

/** The JSON Schema for the problem object, embedded in /openapi.json. */
export const problemSchema = {
  type: "object",
  required: ["type", "title", "status", "code", "detail"],
  properties: {
    type: { type: "string", format: "uri", description: "Link to documentation for this error code." },
    title: { type: "string", description: "Short, human-readable summary of the problem type." },
    status: { type: "integer", description: "HTTP status code, repeated in the body." },
    code: {
      type: "string",
      enum: Object.keys(STATUS),
      description: "Stable machine-readable error code. Switch on this, not on the message.",
    },
    detail: { type: "string", description: "Human-readable explanation of this occurrence." },
    hint: { type: "string", description: "What to do next to recover." },
    instance: { type: "string", description: "The request path that produced this problem." },
    docs: { type: "string", format: "uri", description: "Link to the OpenAPI spec." },
  },
} as const
