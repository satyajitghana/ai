import {
  API_VERSION,
  API_VERSIONS,
  DEPRECATION_NOTICE_DAYS,
  DEPRECATION_POLICY_URL,
} from "@/lib/discovery"
import { absoluteUrl } from "@/lib/site"

// The versioning policy, machine-readable.
//
// The prose version at /developers/versioning is the one a person reads. This
// is the one a client checks on a schedule: which versions exist, which is
// current, and whether anything now has a sunset date it did not have last
// week. Same source of truth (lib/discovery.ts) as the page and the headers, so
// the three cannot disagree.

export const dynamic = "force-static"

export function GET() {
  return Response.json(
    {
      $schema: "https://ai.thesatyajit.com/developers/versioning.json",
      policy: DEPRECATION_POLICY_URL,
      documentation: absoluteUrl("/developers"),
      current: API_VERSION,
      versioning: {
        style: "url-path",
        pattern: "/api/v{major}/*",
        unversionedAlias: "/api/*",
        note: "The unversioned path always mirrors the current version. Pin the versioned prefix for a contract that cannot move.",
      },
      deprecation: {
        minimumNoticeDays: DEPRECATION_NOTICE_DAYS,
        signals: [
          { header: "API-Version", spec: "n/a", note: "On every /api/* response; names the contract it was produced under." },
          { header: "Deprecation", spec: "RFC 9745", note: "IMF-fixdate. Absent while a version is current." },
          { header: "Sunset", spec: "RFC 8594", note: "IMF-fixdate. Never sooner than the minimum notice window after Deprecation." },
          { header: "Link", spec: "RFC 8288", rel: "deprecation", note: `Points at ${DEPRECATION_POLICY_URL}.` },
        ],
        breaking: [
          "removing a field",
          "renaming a field",
          "changing a field's type",
          "changing the meaning of an existing value",
        ],
        nonBreaking: ["adding an endpoint", "adding an optional field"],
      },
      versions: API_VERSIONS,
    },
    {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "public, max-age=3600, s-maxage=86400",
        vary: "Accept, Accept-Encoding",
      },
    },
  )
}
