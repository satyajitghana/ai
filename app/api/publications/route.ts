import { publications } from "@/data/publications"

export const dynamic = "force-static"

export function GET() {
  return Response.json(publications)
}
