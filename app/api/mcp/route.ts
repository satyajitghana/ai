import { NextResponse } from "next/server"

import { MCP_ENDPOINT } from "@/lib/discovery"

// `/api/mcp` is the base path, not the endpoint — the Streamable HTTP transport
// lives one segment down at `/api/mcp/mcp`, which is what every manifest on this
// site advertises. Clients and audit tools nonetheless try the base path first,
// and answering that with the generic API 404 makes a working server look
// broken.
//
// 308 rather than 307 or a rewrite: the method and body must survive (the
// handshake is a POST carrying JSON-RPC), and 308 is the permanent form, which
// is accurate — the endpoint is not moving back.

export function POST() {
  return NextResponse.redirect(MCP_ENDPOINT, 308)
}

export function GET() {
  return NextResponse.json(
    {
      name: "satyajit-ai",
      transport: "streamable-http",
      endpoint: MCP_ENDPOINT,
      manifest: "https://ai.thesatyajit.com/.well-known/mcp.json",
      serverCard: "https://ai.thesatyajit.com/.well-known/mcp/server-card.json",
      documentation: "https://ai.thesatyajit.com/developers#mcp",
      hint: `This is the MCP base path. POST JSON-RPC to ${MCP_ENDPOINT} with 'Accept: application/json, text/event-stream'.`,
    },
    { headers: { "cache-control": "public, max-age=3600" } },
  )
}
