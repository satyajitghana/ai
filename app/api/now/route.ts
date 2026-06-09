import { now } from "@/data/now"

export const dynamic = "force-static"

export function GET() {
  return Response.json(now)
}
