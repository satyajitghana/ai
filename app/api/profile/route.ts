import { profile } from "@/data/profile"

export const dynamic = "force-static"

export function GET() {
  return Response.json(profile)
}
