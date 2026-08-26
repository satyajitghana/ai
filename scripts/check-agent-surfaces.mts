/**
 * check-agent-surfaces — probes every machine-readable surface the site exposes
 * and fails loudly when one regresses.
 *
 * This repo has no unit-test runner; its safety net is a set of scripts that
 * load the real thing and assert on it (validate-content, validate-mdx,
 * check-space-drops). This is the same idea for the agent surfaces: the contract
 * an agent depends on — a 404 that is really a 404, problem+json errors, Vary on
 * negotiated responses, RateLimit headers, a spec whose every operation has an
 * operationId and a response schema — is exactly the kind of thing that breaks
 * silently, because nothing on the page looks different when it does.
 *
 * Needs a server. Point it at a dev server or a deployment:
 *   pnpm dev &&  pnpm check:agents
 *   BASE=https://ai.thesatyajit.com pnpm check:agents
 */

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "")

type Check = { name: string; ok: boolean; detail: string }
const results: Check[] = []

function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail })
}

async function check(name: string, fn: () => Promise<string>) {
  try {
    record(name, true, await fn())
  } catch (err) {
    record(name, false, err instanceof Error ? err.message : String(err))
  }
}

function assert(cond: boolean, message: string): asserts cond {
  if (!cond) throw new Error(message)
}

const get = (path: string, init?: RequestInit) =>
  fetch(`${BASE}${path}`, { redirect: "manual", ...init })

// ── 1. a nonexistent path must be a real 404, in both representations ────────

await check("404 · HTML status", async () => {
  const res = await get("/this-path-does-not-exist-9f3a")
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const body = await res.text()
  assert(body.length > 200, "404 body is suspiciously empty")
  assert(/llms\.txt/.test(body), "404 body should point agents at /llms.txt")
  return "404 with recovery links"
})

await check("404 · markdown recovery body", async () => {
  const res = await get("/blog/definitely-not-a-real-post-9f3a", {
    headers: { accept: "text/markdown" },
  })
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("text/markdown"), `expected text/markdown, got ${ct}`)
  const body = await res.text()
  assert(body.startsWith("# 404"), "markdown 404 should open with an H1")
  for (const link of ["/llms.txt", "/sitemap.xml", "/openapi.json"]) {
    assert(body.includes(link), `markdown 404 should link ${link}`)
  }
  return "markdown 404 with sitemap + llms.txt + openapi links"
})

// ── 2. content negotiation (acceptmarkdown.com) ──────────────────────────────

await check("negotiation · Accept: text/markdown returns markdown", async () => {
  const res = await get("/about", { headers: { accept: "text/markdown" } })
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("text/markdown"), `expected text/markdown, got "${ct}"`)
  return ct
})

await check("negotiation · Vary includes Accept", async () => {
  const res = await get("/about", { headers: { accept: "text/markdown" } })
  const vary = res.headers.get("vary") ?? ""
  assert(/\baccept\b/i.test(vary), `Vary missing Accept, got "${vary}"`)
  return vary
})

await check("negotiation · a browser still gets HTML", async () => {
  const res = await get("/about", {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  })
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("text/html"), `browser Accept must keep HTML, got "${ct}"`)
  return ct
})

await check("negotiation · */* does not trigger markdown", async () => {
  const res = await get("/about", { headers: { accept: "*/*" } })
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("text/html"), `wildcard Accept must keep HTML, got "${ct}"`)
  return ct
})

// ── 3. JSON errors are RFC 9457 problem documents ────────────────────────────

const PROBLEM_KEYS = ["type", "title", "status", "code", "detail"]

await check("errors · unknown /api path returns problem+json", async () => {
  const res = await get("/api/definitely-not-an-endpoint")
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("application/problem+json"), `expected problem+json, got "${ct}"`)
  const body = await res.json()
  for (const k of PROBLEM_KEYS) assert(k in body, `problem document missing "${k}"`)
  assert(typeof body.hint === "string" && body.hint.length > 0, "problem should carry a recovery hint")
  return `code=${body.code}`
})

await check("errors · missing query param returns problem+json", async () => {
  const res = await get("/api/search")
  assert(res.status === 400, `expected 400, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("application/problem+json"), `expected problem+json, got "${ct}"`)
  const body = await res.json()
  assert(body.code === "invalid_request", `expected code=invalid_request, got ${body.code}`)
  return `code=${body.code}`
})

await check("errors · unknown post slug returns problem+json", async () => {
  const res = await get("/api/posts/not-a-real-slug-9f3a")
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const body = await res.json()
  assert(body.code === "not_found", `expected code=not_found, got ${body.code}`)
  return `code=${body.code}`
})

// ── 4. rate-limit headers on ordinary successful responses ───────────────────

await check("rate limits · RFC 9331 headers on a 200", async () => {
  const res = await get("/api/profile")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const rl = res.headers.get("ratelimit")
  const policy = res.headers.get("ratelimit-policy")
  assert(!!rl, "missing RateLimit header")
  assert(!!policy, "missing RateLimit-Policy header")
  assert(/limit=\d+/.test(rl!), `malformed RateLimit: "${rl}"`)
  assert(/remaining=\d+/.test(rl!), `RateLimit missing remaining: "${rl}"`)
  return `${rl} | ${policy}`
})

// ── 5. versioned API alias ───────────────────────────────────────────────────

await check("versioning · /api/v1 mirrors /api", async () => {
  const [v1, root] = await Promise.all([get("/api/v1/profile"), get("/api/profile")])
  assert(v1.ok, `/api/v1/profile returned ${v1.status}`)
  const [a, b] = await Promise.all([v1.json(), root.json()])
  assert(JSON.stringify(a) === JSON.stringify(b), "/api/v1 and /api payloads differ")
  return "identical payloads"
})

// ── 6. the OpenAPI spec is function-calling ready ────────────────────────────

await check("openapi · every operation is callable", async () => {
  const res = await get("/openapi.json")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const spec = await res.json()

  const ops: { path: string; method: string; op: Record<string, unknown> }[] = []
  for (const [path, item] of Object.entries(spec.paths as Record<string, Record<string, unknown>>)) {
    for (const [method, op] of Object.entries(item)) {
      if (["get", "post", "put", "patch", "delete"].includes(method)) {
        ops.push({ path, method, op: op as Record<string, unknown> })
      }
    }
  }
  assert(ops.length > 0, "spec has no operations")

  const ids = new Set<string>()
  for (const { path, method, op } of ops) {
    const id = op.operationId as string | undefined
    assert(!!id, `${method.toUpperCase()} ${path} has no operationId`)
    assert(!ids.has(id!), `duplicate operationId "${id}"`)
    ids.add(id!)
    assert(typeof op.description === "string" && (op.description as string).length > 20,
      `${id} needs a real description`)

    const responses = op.responses as Record<string, { content?: Record<string, unknown> }>
    const ok = responses["200"]
    assert(!!ok, `${id} documents no 200`)
    const schema = ok.content?.["application/json"]
    assert(!!schema, `${id} has no typed 200 response schema`)

    for (const p of (op.parameters as { schema?: unknown; description?: string }[] | undefined) ?? []) {
      assert(!!p.schema, `${id} has an untyped parameter`)
      assert(!!p.description, `${id} has an undescribed parameter`)
    }
  }

  const problem = spec.components?.schemas?.Problem
  assert(!!problem, "spec has no Problem schema")
  assert(problem.properties?.code, "Problem schema has no machine-readable code")

  return `${ops.length} operations, ${ids.size} unique operationIds, all typed`
})

// ── 7. discovery files ───────────────────────────────────────────────────────

for (const [path, needles] of [
  ["/llms.txt", ["When to use this site", "/developers", "/openapi.json"]],
  ["/ai.txt", ["when-to-use", "mcp-manifest", "developer-docs"]],
  ["/.well-known/mcp.json", ["streamable-http", "whenToUse"]],
  ["/.well-known/ai-plugin.json", ["openapi"]],
] as const) {
  await check(`discovery · ${path}`, async () => {
    const res = await get(path)
    assert(res.ok, `expected 2xx, got ${res.status}`)
    const body = await res.text()
    for (const n of needles) assert(body.includes(n), `${path} missing "${n}"`)
    return `${body.length} bytes`
  })
}

// ── 8. trust anchors are real pages with real content ────────────────────────

for (const path of ["/about", "/contact", "/privacy", "/developers"]) {
  await check(`trust anchor · ${path}`, async () => {
    const res = await get(path)
    assert(res.ok, `expected 2xx, got ${res.status}`)
    const html = await res.text()
    const text = html
      .replace(/<script[\s\S]*?<\/script>/g, " ")
      .replace(/<style[\s\S]*?<\/style>/g, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    assert(text.length >= 500, `only ${text.length} chars of text (need 500+)`)
    assert(/<h1[\s>]/.test(html), "no H1")
    return `${text.length} chars`
  })
}

// ── 9. the homepage renders without JavaScript, with real structure ──────────

await check("no-JS · homepage has H1 + H2s + 500 chars", async () => {
  const res = await get("/")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const html = await res.text()
  const h1 = (html.match(/<h1[\s>]/g) ?? []).length
  const h2 = (html.match(/<h2[\s>]/g) ?? []).length
  assert(h1 === 1, `expected exactly 1 H1, found ${h1}`)
  assert(h2 >= 3, `expected a nested heading structure, found ${h2} H2s`)
  const text = html
    .replace(/<script[\s\S]*?<\/script>/g, " ")
    .replace(/<style[\s\S]*?<\/style>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
  assert(text.length >= 500, `only ${text.length} chars in raw HTML`)
  return `${h1} H1, ${h2} H2, ${text.length} chars`
})

// ── 10. JSON-LD identity is complete ─────────────────────────────────────────

await check("json-ld · Person and Organization are complete", async () => {
  const res = await get("/")
  const html = await res.text()
  const blocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(
    (m) => JSON.parse(m[1].replace(/\\u003c/g, "<")),
  )
  assert(blocks.length > 0, "homepage has no JSON-LD")

  const person = blocks.find((b) => b["@type"] === "Person")
  assert(!!person, "no Person node")
  for (const field of ["name", "description", "url", "jobTitle", "address", "contactPoint", "sameAs"]) {
    assert(field in person, `Person missing "${field}"`)
  }

  const org = person.worksFor
  assert(!!org, "Person has no worksFor Organization")
  for (const field of ["name", "url", "address", "contactPoint"]) {
    assert(field in org, `Organization missing "${field}"`)
  }
  return "Person + Organization complete"
})

// ── 11. RFC 8288 Link headers ────────────────────────────────────────────────

await check("link headers · RFC 8288 relations on the homepage", async () => {
  const res = await get("/")
  const link = res.headers.get("link")
  assert(!!link, "no Link header")
  for (const rel of ["api-catalog", "service-desc", "service-doc", "describedby"]) {
    assert(link!.includes(`rel="${rel}"`), `Link header missing rel="${rel}"`)
  }
  assert(/<https:\/\/[^>]+>/.test(link!), "Link targets must be absolute URIs")
  return `${link!.split(",").length} relations`
})

// ── 12. RFC 9727 API catalog ─────────────────────────────────────────────────

await check("api-catalog · RFC 9727 linkset", async () => {
  const res = await get("/.well-known/api-catalog")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("application/linkset+json"), `expected linkset+json, got "${ct}"`)
  const body = await res.json()
  assert(Array.isArray(body.linkset), "no linkset array")
  assert(body.linkset.length > 0, "empty linkset")
  for (const entry of body.linkset) {
    assert(typeof entry.anchor === "string", "linkset entry has no anchor")
  }
  const api = body.linkset[0]
  assert(!!api["service-desc"], "first anchor has no service-desc")
  assert(!!api["service-doc"], "first anchor has no service-doc")
  return `${body.linkset.length} anchors`
})

// ── 13. MCP server card ──────────────────────────────────────────────────────

await check("mcp · server card (SEP-1649)", async () => {
  const res = await get("/.well-known/mcp/server-card.json")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const card = await res.json()
  assert(!!card.serverInfo?.name, "no serverInfo.name")
  assert(!!card.serverInfo?.version, "no serverInfo.version")
  assert(card.transport?.type === "streamable-http", `unexpected transport ${card.transport?.type}`)
  assert(/^https:\/\//.test(card.transport?.endpoint ?? ""), "transport endpoint must be absolute")
  assert(!!card.capabilities, "no capabilities")
  assert(Array.isArray(card.tools) && card.tools.length > 0, "no tools listed")
  return `${card.tools.length} tools, ${card.transport.type}`
})

// ── 14. ARD capability manifest ──────────────────────────────────────────────

await check("ard · ai-catalog.json", async () => {
  const res = await get("/.well-known/ai-catalog.json")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  assert(res.headers.get("access-control-allow-origin") === "*", "ARD manifest must be CORS-open")
  const cat = await res.json()
  assert(!!cat.specVersion, "no specVersion")
  assert(!!cat.host, "no host object")
  assert(Array.isArray(cat.entries) && cat.entries.length > 0, "no entries")
  for (const e of cat.entries) {
    assert(/^urn:air:/.test(e.id ?? ""), `entry id is not a urn:air identifier: ${e.id}`)
    assert(!!e.displayName, `${e.id} has no displayName`)
    assert(!!e.type, `${e.id} has no media type`)
    assert(!!e.url !== !!e.data, `${e.id} must have exactly one of url or data`)
    const q = e.representativeQueries
    assert(Array.isArray(q) && q.length >= 2 && q.length <= 5,
      `${e.id} needs 2-5 representativeQueries, has ${q?.length ?? 0}`)
  }
  return `${cat.entries.length} entries`
})

// ── 15. agent skills index, with verifiable digests ──────────────────────────

await check("agent-skills · index and sha256 digests", async () => {
  const res = await get("/.well-known/agent-skills/index.json")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const index = await res.json()
  assert(!!index.$schema, "no $schema")
  assert(Array.isArray(index.skills) && index.skills.length > 0, "no skills")

  for (const s of index.skills) {
    for (const f of ["name", "type", "description", "url", "sha256"]) {
      assert(f in s, `skill "${s.name ?? "?"}" missing "${f}"`)
    }
    assert(/^[0-9a-f]{64}$/.test(s.sha256), `skill "${s.name}" has a malformed sha256`)
  }

  // Verify one digest end to end — the whole point of publishing them. The
  // index carries absolute production URLs, so map the path onto whatever BASE
  // we are actually probing.
  const first = index.skills[0]
  const skillRes = await get(new URL(first.url).pathname)
  assert(skillRes.ok, `skill URL ${first.url} returned ${skillRes.status}`)
  const bytes = new Uint8Array(await skillRes.arrayBuffer())
  const digest = [...new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  assert(digest === first.sha256, `digest mismatch for ${first.name}: served ${digest}, index says ${first.sha256}`)

  return `${index.skills.length} skills, digest verified for "${first.name}"`
})

// ── 16. Content Signals in robots.txt ────────────────────────────────────────

await check("robots.txt · Content-Signal directives", async () => {
  const res = await get("/robots.txt")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const body = await res.text()
  const signals = body.match(/^Content-Signal:.*$/gm) ?? []
  assert(signals.length > 0, "no Content-Signal directive")
  const first = signals[0]!
  for (const key of ["ai-train", "search", "ai-input"]) {
    assert(first.includes(`${key}=`), `Content-Signal missing "${key}"`)
  }
  assert(/^Sitemap:/m.test(body), "robots.txt lost its Sitemap line")
  assert(/^User-agent: \*/m.test(body), "robots.txt lost its wildcard group")
  return first.replace("Content-Signal: ", "")
})

// ── 17. auth.md tells an agent to stop looking ───────────────────────────────

await check("auth.md · states that no auth exists", async () => {
  const res = await get("/auth.md")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const ct = res.headers.get("content-type") ?? ""
  assert(ct.includes("text/markdown"), `expected text/markdown, got "${ct}"`)
  const body = await res.text()
  assert(/there is none/i.test(body), "auth.md should say plainly that there is no auth")
  assert(body.includes("oauth-protected-resource"), "auth.md should name the absent documents")
  return `${body.length} bytes`
})

await check("auth · OAuth metadata is absent, not fabricated", async () => {
  for (const path of [
    "/.well-known/openid-configuration",
    "/.well-known/oauth-authorization-server",
    "/.well-known/oauth-protected-resource",
  ]) {
    const res = await get(path)
    assert(res.status === 404, `${path} should 404 (no authorization server exists), got ${res.status}`)
  }
  return "3 documents correctly absent"
})

// ── 18. the MCP server actually serves what its card advertises ──────────────

await check("mcp · live server matches its server card", async () => {
  const rpc = async (method: string, id: number) => {
    const res = await get("/api/mcp/mcp", {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params: method === "initialize" ? {
        protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check-agent-surfaces", version: "1.0" },
      } : {} }),
    })
    assert(res.ok, `${method} returned ${res.status}`)
    const text = await res.text()
    // The endpoint answers as SSE; the JSON-RPC payload is on the data: line.
    const line = text.split("\n").find((l) => l.startsWith("data:"))
    assert(!!line, `${method} returned no data frame`)
    return JSON.parse(line!.slice(5).trim())
  }

  const init = await rpc("initialize", 1)
  assert(!!init.result?.serverInfo?.name, "initialize returned no serverInfo")
  assert(!!init.result?.capabilities?.tools, "server does not advertise tools capability")

  const list = await rpc("tools/list", 2)
  const live: string[] = (list.result?.tools ?? []).map((t: { name: string }) => t.name)
  assert(live.length > 0, "tools/list returned nothing")

  // The card is a published promise — hold it to what the server does.
  const cardRes = await get("/.well-known/mcp/server-card.json")
  const card = await cardRes.json()
  const advertised: string[] = card.tools.map((t: { name: string }) => t.name)

  const missing = advertised.filter((n) => !live.includes(n))
  const undocumented = live.filter((n) => !advertised.includes(n))
  assert(missing.length === 0, `card advertises tools the server does not serve: ${missing.join(", ")}`)
  assert(undocumented.length === 0, `server serves tools the card omits: ${undocumented.join(", ")}`)
  assert(card.transport.endpoint.endsWith("/api/mcp/mcp"), "card endpoint does not match the live route")

  return `${live.length} tools, card matches server exactly`
})

// ── 19. markdown token hint ──────────────────────────────────────────────────

await check("markdown · x-markdown-tokens hint", async () => {
  const res = await get("/about", { headers: { accept: "text/markdown" } })
  const tokens = res.headers.get("x-markdown-tokens")
  assert(!!tokens, "no x-markdown-tokens header")
  assert(Number(tokens) > 0, `implausible token count "${tokens}"`)
  return `${tokens} tokens`
})

// ── 27. the 404 body a non-browser gets ──────────────────────────────────────
//
// The audit that prompted these checks probed with plain curl, which sends
// `Accept: */*` and names no type. That caller used to get 40 KB of app shell.
// It now gets the markdown recovery map, while a browser keeps the styled page —
// so both halves have to be asserted or one will quietly swallow the other.

await check("404 · wildcard Accept gets markdown", async () => {
  const res = await get("/some-path-that-does-not-exist", { headers: { accept: "*/*" } })
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  assert(type.includes("text/markdown"), `expected text/markdown, got "${type}"`)
  const body = await res.text()
  assert(body.startsWith("# 404"), "body does not start with an h1")
  for (const link of ["/llms.txt", "/sitemap.xml", "/openapi.json", "/developers"]) {
    assert(body.includes(link), `recovery body does not link ${link}`)
  }
  assert(/\baccept\b/i.test(res.headers.get("vary") ?? ""), "Vary does not include Accept")
  return `404 markdown, ${body.length} chars`
})

await check("404 · a browser still gets the HTML page", async () => {
  const res = await get("/some-path-that-does-not-exist", {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  })
  assert(res.status === 404, `expected 404, got ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  assert(type.includes("text/html"), `expected text/html, got "${type}"`)
  return "html 404 preserved"
})

await check("404 · no Accept header at all gets markdown", async () => {
  const res = await get("/nope-9f3a/deeper/still")
  assert(res.status === 404, `expected 404, got ${res.status}`)
  assert(
    (res.headers.get("content-type") ?? "").includes("text/markdown"),
    "a caller that named no type should not be handed HTML",
  )
  return "markdown 404"
})

// ── 28. the homepage negotiates markdown like every other page ───────────────

await check("negotiation · the homepage has a markdown twin", async () => {
  const res = await get("/", { headers: { accept: "text/markdown" } })
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  assert(type.includes("text/markdown"), `expected text/markdown, got "${type}"`)
  assert(/\baccept\b/i.test(res.headers.get("vary") ?? ""), "Vary does not include Accept")
  const body = await res.text()
  assert(body.startsWith("# "), "markdown homepage has no h1")
  assert(/when to use/i.test(body), "markdown homepage has no when-to-use guidance")
  return `${body.length} chars`
})

await check("negotiation · the homepage still serves HTML to a browser", async () => {
  const res = await get("/", {
    headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
  })
  assert(res.ok, `expected 2xx, got ${res.status}`)
  assert((res.headers.get("content-type") ?? "").includes("text/html"), "browser did not get HTML")
  return "html preserved"
})

// `Vary: Accept` on the HTML half comes from vercel.json, because a Next page
// render overwrites whatever the proxy or next.config sets (see the note in
// next.config.ts). So it is asserted only against a deployment — running this
// against `next start` locally would fail for a reason that does not exist in
// production, and a check that cries wolf gets ignored.
const IS_DEPLOYMENT = /^https:\/\//.test(BASE)

if (IS_DEPLOYMENT) {
  await check("negotiation · HTML half declares Vary: Accept", async () => {
    const res = await get("/", {
      headers: { accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8" },
    })
    const vary = res.headers.get("vary") ?? ""
    assert(/\baccept\b/i.test(vary), `Vary does not include Accept (got "${vary}")`)
    return vary
  })
}

// ── 29. versioning and deprecation are observable, not just documented ───────

await check("versioning · API-Version header on /api/*", async () => {
  const res = await get("/api/profile")
  const v = res.headers.get("api-version")
  assert(!!v, "no API-Version header")
  assert(/^\d+$/.test(v), `implausible version "${v}"`)
  const link = res.headers.get("link") ?? ""
  assert(/rel="deprecation"/.test(link), "no Link rel=deprecation pointing at the policy")
  return `API-Version: ${v}`
})

await check("versioning · policy page exists at its own URL", async () => {
  const res = await get("/developers/versioning")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const html = await res.text()
  const text = html.replace(/<[^>]+>/g, " ")
  assert(/<h1/i.test(html), "policy page has no h1")
  for (const term of ["Sunset", "Deprecation", "180"]) {
    assert(text.includes(term), `policy page never mentions ${term}`)
  }
  return "policy page reachable"
})

await check("versioning · machine-readable policy", async () => {
  const res = await get("/developers/versioning.json")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const doc = (await res.json()) as {
    current?: string
    versions?: { version: string; status: string; sunset: string | null }[]
    deprecation?: { minimumNoticeDays?: number; signals?: unknown[] }
  }
  assert(!!doc.current, "no current version named")
  assert(Array.isArray(doc.versions) && doc.versions.length > 0, "no versions listed")
  assert(
    doc.versions.some((v) => v.version === doc.current && v.status === "current"),
    "the named current version is not marked current in the table",
  )
  assert(
    typeof doc.deprecation?.minimumNoticeDays === "number",
    "no minimum notice window declared",
  )
  return `v${doc.current}, ${doc.versions.length} version(s)`
})

// ── 30. the spec states its errors where a converter will look ───────────────
//
// The failure this guards against is subtle: `$ref` into components/responses
// validates fine and reads fine, and a function-calling converter walking
// responses[code].content still sees an operation with no typed error.

await check("openapi · every operation types its errors inline", async () => {
  const spec = (await (await get("/openapi.json")).json()) as {
    paths: Record<string, Record<string, { responses?: Record<string, Record<string, unknown>> }>>
  }
  const METHODS = ["get", "post", "put", "patch", "delete"]
  let checked = 0
  for (const [path, item] of Object.entries(spec.paths)) {
    for (const [method, op] of Object.entries(item)) {
      if (!METHODS.includes(method)) continue
      const responses = op.responses ?? {}
      const errorCodes = Object.keys(responses).filter((c) => /^[45]/.test(c))
      assert(errorCodes.length > 0, `${method.toUpperCase()} ${path} declares no error responses`)
      for (const code of errorCodes) {
        const res = responses[code] as {
          $ref?: string
          content?: Record<string, { schema?: { $ref?: string } }>
        }
        assert(!res.$ref, `${method.toUpperCase()} ${path} ${code} is a $ref, not an inline response`)
        const problem = res.content?.["application/problem+json"]
        assert(!!problem, `${method.toUpperCase()} ${path} ${code} has no problem+json content`)
        assert(
          problem.schema?.$ref === "#/components/schemas/Problem",
          `${method.toUpperCase()} ${path} ${code} does not reference the Problem schema`,
        )
        checked++
      }
    }
  }
  return `${checked} error responses, all typed`
})

await check("errors · unsupported method returns problem+json", async () => {
  const res = await get("/api/profile", { method: "POST" })
  assert(res.status === 405, `expected 405, got ${res.status}`)
  const type = res.headers.get("content-type") ?? ""
  assert(type.includes("application/problem+json"), `expected problem+json, got "${type}"`)
  assert(!!res.headers.get("allow"), "405 without an Allow header")
  const body = (await res.json()) as { code?: string; status?: number }
  assert(body.code === "method_not_allowed", `unexpected code "${body.code}"`)
  assert(body.status === 405, `body status ${body.status} disagrees with the response`)
  return `code=${body.code}, Allow: ${res.headers.get("allow")}`
})

await check("errors · POST /api/ask is still accepted", async () => {
  // The 405 guard must not swallow the one endpoint that takes a body. A 503
  // here is a correct answer — the model backend is optional — so anything
  // other than 405 proves the method is reaching the handler.
  const res = await get("/api/ask", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ question: "who is satyajit" }),
  })
  assert(res.status !== 405, "POST /api/ask was rejected as a bad method")
  return `reached the handler (${res.status})`
})

// ── 31. the MCP handshake survives a client that only accepts JSON ───────────
//
// The Streamable HTTP spec says a client MUST accept both application/json and
// text/event-stream, and the SDK returns 406 when it does not. Being right about
// that is why an audit reported the handshake as failing.

await check("mcp · handshake with Accept: application/json only", async () => {
  const res = await fetch(`${BASE}/api/mcp/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } },
    }),
  })
  assert(res.status === 200, `expected 200, got ${res.status}`)
  const body = await res.text()
  const line = body.split("\n").find((l) => l.startsWith("data:")) ?? body
  const parsed = JSON.parse(line.replace(/^data:\s*/, "")) as {
    result?: { serverInfo?: { name?: string }; protocolVersion?: string }
  }
  assert(!!parsed.result?.serverInfo?.name, "no serverInfo in the initialize result")
  return `initialize ok as ${parsed.result.serverInfo.name}`
})

await check("mcp · handshake with no Accept header", async () => {
  const res = await fetch(`${BASE}/api/mcp/mcp`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "check", version: "1" } },
    }),
  })
  assert(res.status === 200, `expected 200, got ${res.status}`)
  return "initialize ok"
})

await check("mcp · the base path points at the endpoint", async () => {
  const res = await get("/api/mcp")
  assert(res.ok, `GET /api/mcp expected 2xx, got ${res.status}`)
  const doc = (await res.json()) as { endpoint?: string }
  assert(doc.endpoint?.endsWith("/api/mcp/mcp") === true, `base path names "${doc.endpoint}"`)

  const post = await fetch(`${BASE}/api/mcp`, {
    method: "POST",
    redirect: "manual",
    headers: { "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
  })
  assert(post.status === 308, `POST /api/mcp should 308 to the endpoint, got ${post.status}`)
  return "base path resolves"
})

// ── 32. when-to-use guidance on the agent-instruction surfaces ───────────────

await check("when-to-use · agent-skills index", async () => {
  const doc = (await (await get("/.well-known/agent-skills/index.json")).json()) as {
    whenToUse?: string
  }
  assert(!!doc.whenToUse, "agent-skills index has no whenToUse")
  assert(doc.whenToUse.length > 120, "whenToUse is too short to be guidance")
  assert(/\bnot\b/i.test(doc.whenToUse), "whenToUse names no negative case")
  return `${doc.whenToUse.length} chars`
})

await check("when-to-use · ai-plugin manifest", async () => {
  const doc = (await (await get("/.well-known/ai-plugin.json")).json()) as {
    when_to_use?: string
  }
  assert(!!doc.when_to_use, "ai-plugin.json has no when_to_use")
  return `${doc.when_to_use.length} chars`
})

// ── 33. the homepage has real heading depth without JavaScript ───────────────

await check("no-JS · homepage headings nest", async () => {
  const html = await (await get("/")).text()
  const count = (tag: string) => (html.match(new RegExp(`<${tag}[\\s>]`, "gi")) ?? []).length
  assert(count("h1") === 1, `expected exactly 1 h1, found ${count("h1")}`)
  assert(count("h2") >= 3, `expected at least 3 h2, found ${count("h2")}`)
  assert(count("h3") >= 3, `expected at least 3 h3 — a flat h1/h2 outline scores as partial`)
  return `h1×${count("h1")} h2×${count("h2")} h3×${count("h3")}`
})

// ── 9. share cards and icons ─────────────────────────────────────────────────
//
// Next compiles file-based metadata (opengraph-image.tsx, icon.tsx) into route
// handlers that hang off the segment they sit in, so an article's card lives at
// `/articles/<slug>/opengraph-image` — three segments deep, no file extension.
// That is indistinguishable from a path the site does not serve unless the
// proxy is told otherwise, and when it was not, every per-item share card
// returned the markdown 404 instead of a PNG. Nothing on the page changes when
// this breaks; you find out when someone pastes a link into a chat and gets a
// favicon.

for (const path of [
  "/opengraph-image",
  "/articles/opengraph-image",
  "/articles/paint-with-code/opengraph-image",
  "/blog/opengraph-image",
  "/projects/opengraph-image",
] as const) {
  await check(`share card · ${path}`, async () => {
    const res = await get(path)
    assert(res.ok, `expected 2xx, got ${res.status}`)
    const ct = res.headers.get("content-type") ?? ""
    assert(ct.startsWith("image/"), `expected an image, got "${ct}"`)
    const bytes = (await res.arrayBuffer()).byteLength
    assert(bytes > 1000, `only ${bytes} bytes — that is not a rendered card`)
    return `${ct}, ${Math.round(bytes / 1024)}KB`
  })
}

await check("icons · every referenced icon resolves", async () => {
  const html = await (await get("/articles/paint-with-code")).text()
  const hrefs = [...html.matchAll(/<link[^>]+rel="(?:apple-touch-)?icon"[^>]+href="([^"]+)"/g)].map(
    (m) => m[1],
  )
  assert(hrefs.length > 0, "no icon <link> in the document head")
  for (const href of hrefs) {
    const res = await get(href)
    assert(res.ok, `${href} returned ${res.status}`)
    const ct = res.headers.get("content-type") ?? ""
    assert(ct.startsWith("image/"), `${href} served "${ct}", not an image`)
  }
  return `${hrefs.length} icon(s): ${hrefs.map((h) => h.split("?")[0]).join(", ")}`
})

await check("icons · favicon is not the framework default", async () => {
  // The create-next-app placeholder is the Vercel triangle, and it shipped here
  // for months because a favicon is the one asset nobody looks at until it turns
  // up in a link preview. It is 25,931 bytes and starts with a BMP-in-ICO
  // directory; ours is PNG-in-ICO at six sizes.
  const res = await get("/favicon.ico")
  assert(res.ok, `expected 2xx, got ${res.status}`)
  const buf = Buffer.from(await res.arrayBuffer())
  assert(buf.readUInt16LE(2) === 1, "not an ICO container")
  const frames = buf.readUInt16LE(4)
  assert(frames >= 4, `expected at least 4 sizes, found ${frames}`)
  assert(buf.length !== 25931, "this is still the default Vercel favicon.ico")
  // first frame's payload should be a PNG, not a BMP header
  const offset = buf.readUInt32LE(6 + 12)
  assert(buf.readUInt32BE(offset) === 0x89504e47, "frames are not PNG-encoded")
  return `${frames} frames, ${Math.round(buf.length / 1024)}KB, PNG-encoded`
})

// ── report ───────────────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok)
const pad = Math.max(...results.map((r) => r.name.length))

for (const r of results) {
  const mark = r.ok ? "[32m✓[0m" : "[31m✗[0m"
  console.log(`${mark} ${r.name.padEnd(pad)}  ${r.detail}`)
}

console.log("")
if (failed.length) {
  console.error(`[31m${failed.length} of ${results.length} agent-surface checks failed[0m (BASE=${BASE})`)
  process.exit(1)
}
console.log(`[32m✓ all ${results.length} agent-surface checks passed[0m (BASE=${BASE})`)
