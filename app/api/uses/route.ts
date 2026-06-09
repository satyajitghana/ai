import { uses } from "@/data/uses"

export const dynamic = "force-static"

export function GET() {
  return Response.json(uses)
}
