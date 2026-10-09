"use client"

import { useState } from "react"

import { cn } from "@/lib/utils"

// log2(kappa) against time for every exponent claim in CrocSwap/integer-mult-bounds.
//
// Sources (all read on 2026-10-08):
//   Colkitt's checkpoints: commit times from `git log` on main / release/ternary-30
//     (5cf29ec, 52ce3be, bcd4ebd, 6e56487, 1c09a58, 1a74950), converted to UTC.
//   Community PRs: `created_at` from the GitHub REST API, kappa from each PR title or
//     body (the exact rationals are in the PR descriptions). #11 and #26 claim no
//     kappa and are omitted, as is #45 (a Lean audit, no kappa). #46 to #48 were added
//     on a second pass at 15:24 UTC, #49 on a third at 15:46 UTC, and #50 to #77 on a
//     fourth at 19:46 UTC. #73 (withdrawn, no kappa) is omitted. #64's title states no
//     kappa; its body gives 20411033624901463/(4*10^20).
//   #78 to #179 were added on 2026-10-09 at 11:00 UTC from the GitHub REST API and the
//     tracker's /api/research JSON (fetched 10:53 UTC), with kappa from each PR's title or
//     body as it read then. PRs are edited in place, so a few points (#168 most of all) show
//     a later version's claim at the PR's opening time. Omitted: PRs with no kappa (#83, #90,
//     #101, #105, #156, #166, #167, #172, #174, #175), #149 (the integration PR for #144),
//     #154 (a verification-speed PR the tracker parses as 4.76e-5) and #159 (kappa = 0.127865,
//     closed eleven minutes after it was opened, by its own author's "AI is not to be blindly
//     trusted"). #148's title value 4.611281e-4 is used, not the tracker's 4.609169e-4.
//   A fourth move of main: GitHub marks #144 (via #149) merged at 05:06:02 UTC on Oct 9;
//     README at d1d6c07 gives 4609169/10^10.
//   The merge: GitHub marks PR #39 merged at 15:18:18 UTC, when main moved to 0605a24
//     ("Publish audited community bound with contributor attribution"). The merge commit
//     itself, fd8c563, was made on integration/community at 13:23 UTC; main stayed at the
//     2^-30 checkpoint until the audit (c9fca20, 15:12 UTC) and the release commit landed.
//     kappa on main is 971668963/25000000000000, the PR #39 witness, unchanged.
//   Two later moves of main, at GitHub's merged_at times: 16:46:58 UTC (#45, #46, #48,
//     #49 and #26 marked merged; README at ed8201c gives 4123863984/10^14) and 18:35:34
//     UTC (#50 to #58 and #60 to #62; README at 0d235fe gives
//     25508460085039/(5*10^17), the #61 refinement of #62 stacked on #57).
//   Swapnil Jain's parallel track (github.com/Swapnil-jain/integer-mult-kappa): times are
//     his ten X posts (fxtwitter mirror), kappa the exact witness in the commit each post
//     announced (round 7 is the 741e7aa witness he posted, 1599247689723/(2.5*10^16), not the
//     later 7.1 headline). Rounds five to ten ship Lean files (lean/Round5.lean to
//     Round10.lean) that check their moment and assembly arithmetic in the kernel; everything
//     else on the chart is an exact-rational Python certificate.
//   The 2^-182 origin sits at 21:58:50 UTC on Oct 6, the commit time of openai/math
//     adc7f12 ("Initial commit"), the same time Aurel Prosz's tracker uses. Julian
//     Schiavo's chart labels it 3:19 PM Pacific (22:19 UTC).
// "Extrapolation" is my straight line in log2(kappa) through Colkitt's two announcement
// posts that preceded Julian's first chart: 2^-78 at 13:56 UTC and 2^-59 at 19:35 UTC
// on Oct 7. It reaches kappa = 1 at about 13:08 UTC on Oct 8.
// x is hours after 2026-10-06 22:00 UTC; y is log2(kappa), precomputed.

type Pt = {
  pr?: number
  who: string
  h: number
  l2: number
  k: string
  note?: string
  lean?: boolean
  merged?: boolean
  url?: string
}

const ORIGIN: Pt = { who: "OpenAI", h: -0.019, l2: -182, k: "2^-182", note: "original manuscript (family 109)" }

const COLKITT: Pt[] = [
  { who: "Colkitt", h: 4.367, l2: -107.088, k: "5.8e-33", note: "5cf29ec · parameters only" },
  { who: "Colkitt", h: 15.583, l2: -78, k: "2^-78", note: "52ce3be · direct axis routing" },
  { who: "Colkitt", h: 21.45, l2: -59, k: "2^-59", note: "bcd4ebd · paired circuits" },
  { who: "Colkitt", h: 26.45, l2: -33.488, k: "8.3e-11", note: "6e56487 · compact controls" },
  { who: "Colkitt", h: 27.167, l2: -31, k: "2^-31", note: "1c09a58 · complex compression" },
  { who: "Colkitt", h: 39.167, l2: -30, k: "2^-30", note: "1a74950 · ternary checkpoint" },
]

const PRS: Pt[] = [
  { pr: 1, who: "Paureel", h: 22.979, l2: -58.985, k: "1.752e-18" },
  { pr: 2, who: "Bortlesboat", h: 24.333, l2: -58.913, k: "1.843e-18" },
  { pr: 3, who: "eumemic", h: 28.385, l2: -30.659, k: "5.9e-10" },
  { pr: 4, who: "dleen", h: 28.888, l2: -30.656, k: "5.91e-10" },
  { pr: 5, who: "eumemic", h: 30.153, l2: -29.333, k: "1.479e-9" },
  { pr: 6, who: "eumemic", h: 31.39, l2: -29.198, k: "1.624e-9" },
  { pr: 7, who: "jacklightChen", h: 32.201, l2: -27.998, k: "3.73e-9" },
  { pr: 8, who: "rohanarun", h: 33.557, l2: -30.659, k: "5.9e-10" },
  { pr: 9, who: "rohanarun", h: 34.121, l2: -27.971, k: "3.8e-9" },
  { pr: 10, who: "icekylinx", h: 34.44, l2: -22.955, k: "1.23e-7" },
  { pr: 12, who: "rohanarun", h: 34.67, l2: -22.914, k: "1.265e-7" },
  { pr: 13, who: "eumemic", h: 35.023, l2: -20.309, k: "7.699e-7" },
  { pr: 14, who: "rohanarun", h: 35.281, l2: -20.071, k: "9.08e-7" },
  { pr: 15, who: "eumemic", h: 35.439, l2: -19.825, k: "1.077e-6" },
  { pr: 16, who: "jacklightChen", h: 35.607, l2: -19.961, k: "9.799e-7" },
  { pr: 17, who: "rohanarun", h: 35.894, l2: -19.612, k: "1.248e-6" },
  { pr: 18, who: "icekylinx", h: 36.028, l2: -19.017, k: "1.885e-6" },
  { pr: 19, who: "rohanarun", h: 36.322, l2: -18.866, k: "2.093e-6" },
  { pr: 20, who: "hipotures", h: 36.344, l2: -19.709, k: "1.167e-6" },
  { pr: 21, who: "jacklightChen", h: 36.413, l2: -17.472, k: "5.499e-6" },
  { pr: 22, who: "DominikScholz", h: 36.582, l2: -17.418, k: "5.711e-6" },
  { pr: 23, who: "jacklightChen", h: 36.732, l2: -16.473, k: "1.099e-5" },
  { pr: 24, who: "icekylinx", h: 36.775, l2: -17.35, k: "5.986e-6" },
  { pr: 25, who: "rohanarun", h: 36.867, l2: -16.415, k: "1.145e-5" },
  { pr: 27, who: "DominikScholz", h: 36.959, l2: -16.35, k: "1.197e-5" },
  { pr: 28, who: "rohanarun", h: 37.166, l2: -16.316, k: "1.226e-5" },
  { pr: 29, who: "jacklightChen", h: 37.336, l2: -15.974, k: "1.554e-5" },
  { pr: 30, who: "DominikScholz", h: 37.35, l2: -16.231, k: "1.3e-5" },
  { pr: 31, who: "rohanarun", h: 37.49, l2: -15.943, k: "1.588e-5" },
  { pr: 32, who: "icekylinx", h: 37.559, l2: -16.285, k: "1.252e-5" },
  { pr: 33, who: "DominikScholz", h: 37.599, l2: -15.898, k: "1.638e-5" },
  { pr: 34, who: "jamesyc", h: 38.168, l2: -15.897, k: "1.639e-5" },
  { pr: 35, who: "DominikScholz", h: 38.457, l2: -15.876, k: "1.663e-5" },
  { pr: 36, who: "icekylinx", h: 38.458, l2: -14.666, k: "3.846e-5" },
  { pr: 37, who: "rohanarun", h: 38.664, l2: -14.664, k: "3.851e-5" },
  { pr: 38, who: "DominikScholz", h: 38.822, l2: -14.651, k: "3.886e-5" },
  { pr: 39, who: "rohanarun", h: 38.979, l2: -14.651, k: "3.887e-5" },
  { pr: 40, who: "rohanarun", h: 39.266, l2: -14.639, k: "3.919e-5" },
  { pr: 41, who: "hipotures", h: 39.551, l2: -14.597, k: "4.034e-5" },
  { pr: 42, who: "rohanarun", h: 39.86, l2: -14.574, k: "4.099e-5" },
  { pr: 43, who: "chafreaky", h: 39.931, l2: -14.574, k: "4.1e-5" },
  { pr: 44, who: "rohanarun", h: 40.406, l2: -14.574, k: "4.101e-5" },
  { pr: 46, who: "chafreaky", h: 40.734, l2: -14.574, k: "4.1006e-5" },
  { pr: 47, who: "rohanarun", h: 40.943, l2: -14.572, k: "4.1051e-5" },
  { pr: 48, who: "chafreaky", h: 41.248, l2: -14.567, k: "4.1186e-5" },
  { pr: 49, who: "rohanarun", h: 41.616, l2: -14.566, k: "4.1239e-5" },
  { pr: 50, who: "gupt1156", h: 42.053, l2: -14.564, k: "4.1294e-5" },
  { pr: 51, who: "hipotures", h: 42.308, l2: -14.549, k: "4.1712e-5" },
  { pr: 52, who: "rohanarun", h: 42.381, l2: -14.561, k: "4.136e-5" },
  { pr: 53, who: "ikeboy", h: 42.521, l2: -14.44, k: "4.4981e-5" },
  { pr: 54, who: "chafreaky", h: 42.69, l2: -14.43, k: "4.529e-5" },
  { pr: 55, who: "gupt1156", h: 43.089, l2: -14.427, k: "4.541e-5" },
  { pr: 56, who: "rohanarun", h: 43.103, l2: -14.424, k: "4.5487e-5" },
  { pr: 57, who: "eumemic", h: 43.123, l2: -14.386, k: "4.6694e-5" },
  { pr: 58, who: "chafreaky", h: 43.411, l2: -14.361, k: "4.7507e-5" },
  { pr: 59, who: "rohangar1", h: 43.615, l2: -14.408, k: "4.5989e-5" },
  { pr: 60, who: "chafreaky", h: 43.675, l2: -14.357, k: "4.7645e-5" },
  { pr: 61, who: "alejandrozu", h: 43.687, l2: -14.259, k: "5.1017e-5" },
  { pr: 62, who: "ikeboy", h: 43.764, l2: -14.292, k: "4.9861e-5" },
  { pr: 63, who: "DominikScholz", h: 44.09, l2: -14.258, k: "5.1028e-5" },
  { pr: 64, who: "rfu08", h: 44.34, l2: -14.258, k: "5.1028e-5" },
  { pr: 65, who: "rohanarun", h: 44.415, l2: -14.258, k: "5.1029e-5" },
  { pr: 66, who: "chafreaky", h: 44.588, l2: -14.337, k: "4.8311e-5" },
  { pr: 67, who: "rohanarun", h: 44.657, l2: -14.258, k: "5.1034e-5" },
  { pr: 68, who: "DominikScholz", h: 44.671, l2: -14.258, k: "5.1035e-5" },
  { pr: 69, who: "eumemic", h: 45.031, l2: -14.249, k: "5.1368e-5" },
  { pr: 70, who: "alejandrozu", h: 45.061, l2: -14.258, k: "5.104e-5" },
  { pr: 71, who: "chafreaky", h: 45.116, l2: -14.247, k: "5.1415e-5" },
  { pr: 72, who: "maxime-fleury", h: 45.132, l2: -14.565, k: "4.125e-5" },
  { pr: 74, who: "tomdif", h: 45.443, l2: -14.25, k: "5.1329e-5" },
  { pr: 75, who: "alejandrozu", h: 45.579, l2: -14.247, k: "5.1415e-5" },
  { pr: 76, who: "DominikScholz", h: 45.737, l2: -14.238, k: "5.1739e-5" },
  { pr: 77, who: "huxint", h: 45.761, l2: -14.244, k: "5.1548e-5" },
  { pr: 78, who: "rohanarun", h: 45.809, l2: -14.247, k: "5.1429e-5" },
  { pr: 79, who: "chafreaky", h: 45.863, l2: -14.238, k: "5.1746e-5" },
  { pr: 80, who: "rohanarun", h: 45.958, l2: -14.237, k: "5.1779e-5" },
  { pr: 81, who: "DominikScholz", h: 46.217, l2: -14.233, k: "5.1916e-5" },
  { pr: 82, who: "rohanarun", h: 46.237, l2: -14.23, k: "5.2033e-5" },
  { pr: 84, who: "chafreaky", h: 46.545, l2: -14.224, k: "5.2271e-5" },
  { pr: 85, who: "rohanarun", h: 46.798, l2: -14.224, k: "5.2272e-5" },
  { pr: 86, who: "rohanarun", h: 46.924, l2: -14.224, k: "5.2275e-5" },
  { pr: 87, who: "gupt1156", h: 47.178, l2: -14.219, k: "5.2432e-5" },
  { pr: 88, who: "chafreaky", h: 47.208, l2: -14.217, k: "5.2514e-5" },
  { pr: 89, who: "rohanarun", h: 47.366, l2: -14.219, k: "5.2445e-5" },
  { pr: 91, who: "chafreaky", h: 47.616, l2: -14.209, k: "5.279e-5" },
  { pr: 92, who: "maxime-fleury", h: 47.642, l2: -14.228, k: "5.2112e-5" },
  { pr: 93, who: "rohanarun", h: 47.893, l2: -14.209, k: "5.2791e-5" },
  { pr: 94, who: "maxime-fleury", h: 48.013, l2: -14.209, k: "5.2791e-5" },
  { pr: 95, who: "rohanarun", h: 48.117, l2: -14.209, k: "5.2791e-5" },
  { pr: 96, who: "eumemic", h: 48.233, l2: -14.141, k: "5.5355e-5" },
  { pr: 97, who: "jacklightChen", h: 48.665, l2: -13.932, k: "6.3966e-5" },
  { pr: 98, who: "rohanarun", h: 48.692, l2: -14.209, k: "5.2791e-5" },
  { pr: 99, who: "djsmanchanda", h: 48.944, l2: -13.932, k: "6.3979e-5" },
  { pr: 100, who: "rohanarun", h: 48.957, l2: -13.932, k: "6.3979e-5" },
  { pr: 102, who: "SovereignSteak", h: 48.981, l2: -13.932, k: "6.3975e-5" },
  { pr: 103, who: "rohanarun", h: 49.17, l2: -13.932, k: "6.3983e-5" },
  { pr: 104, who: "icekylinx", h: 49.201, l2: -13.647, k: "7.7948e-5", note: "stopped product-ring interchange" },
  { pr: 106, who: "Th0rgal", h: 49.359, l2: -14.209, k: "5.2805e-5" },
  { pr: 107, who: "rohanarun", h: 49.408, l2: -13.646, k: "7.7984e-5" },
  { pr: 108, who: "rohanarun", h: 49.903, l2: -13.612, k: "7.9883e-5" },
  { pr: 109, who: "rohanarun", h: 49.994, l2: -13.61, k: "7.9962e-5" },
  { pr: 110, who: "ikeboy", h: 50.047, l2: -13.508, k: "8.5848e-5" },
  { pr: 111, who: "rohanarun", h: 50.069, l2: -13.509, k: "8.5782e-5" },
  { pr: 112, who: "jamesyc", h: 50.179, l2: -13.604, k: "8.0325e-5" },
  { pr: 113, who: "rohanarun", h: 50.226, l2: -13.378, k: "9.3907e-5" },
  { pr: 114, who: "eumemic", h: 50.394, l2: -12.978, k: "1.2399e-4" },
  { pr: 115, who: "icekylinx", h: 50.449, l2: -13.398, k: "9.2634e-5" },
  { pr: 116, who: "rohanarun", h: 50.567, l2: -13.307, k: "9.8699e-5" },
  { pr: 117, who: "eumemic", h: 50.656, l2: -13.224, k: "1.0449e-4" },
  { pr: 118, who: "rohanarun", h: 50.78, l2: -13.169, k: "1.0854e-4" },
  { pr: 119, who: "seanabreau", h: 50.918, l2: -13.373, k: "9.428e-5" },
  { pr: 120, who: "eumemic", h: 50.943, l2: -13.162, k: "1.0912e-4" },
  { pr: 121, who: "Th0rgal", h: 51.091, l2: -13.604, k: "8.0325e-5" },
  { pr: 122, who: "SovereignSteak", h: 51.193, l2: -13.158, k: "1.0942e-4" },
  { pr: 123, who: "rohanarun", h: 51.249, l2: -13.16, k: "1.0929e-4" },
  { pr: 124, who: "jamesyc", h: 51.317, l2: -13.145, k: "1.1038e-4" },
  { pr: 125, who: "GamingPuzzled", h: 51.337, l2: -13.142, k: "1.1059e-4" },
  { pr: 126, who: "DanieleCorso", h: 51.413, l2: -13.135, k: "1.1119e-4" },
  { pr: 127, who: "GamingPuzzled", h: 51.576, l2: -13.119, k: "1.124e-4" },
  { pr: 128, who: "an664", h: 51.589, l2: -12.988, k: "1.231e-4" },
  { pr: 129, who: "eumemic", h: 52.124, l2: -12.918, k: "1.2919e-4" },
  { pr: 130, who: "icekylinx", h: 52.484, l2: -11.634, k: "3.146e-4", note: "three-stage Cayley cover" },
  { pr: 131, who: "eumemic", h: 52.698, l2: -11.556, k: "3.3221e-4" },
  { pr: 132, who: "ikeboy", h: 52.778, l2: -11.515, k: "3.4162e-4" },
  { pr: 133, who: "Th0rgal", h: 52.851, l2: -13.13, k: "1.1151e-4" },
  { pr: 134, who: "GamingPuzzled", h: 52.867, l2: -11.488, k: "3.481e-4" },
  { pr: 135, who: "DanieleCorso", h: 52.969, l2: -11.431, k: "3.6211e-4" },
  { pr: 136, who: "geckods", h: 53.223, l2: -11.431, k: "3.6211e-4" },
  { pr: 137, who: "eumemic", h: 53.309, l2: -11.239, k: "4.136e-4", note: "posted on X by @dysmemic, eumemic's account" },
  { pr: 138, who: "geckods", h: 53.411, l2: -11.239, k: "4.136e-4" },
  { pr: 139, who: "DanieleCorso", h: 53.484, l2: -11.117, k: "4.502e-4" },
  { pr: 140, who: "sennemmi", h: 53.6, l2: -13.139, k: "1.1088e-4" },
  { pr: 141, who: "chafreaky", h: 53.664, l2: -13.114, k: "1.128e-4" },
  { pr: 142, who: "eumemic", h: 53.789, l2: -11.217, k: "4.2015e-4" },
  { pr: 143, who: "eumemic", h: 54.159, l2: -11.201, k: "4.2483e-4" },
  { pr: 144, who: "icekylinx", h: 54.326, l2: -11.083, k: "4.6092e-4", note: "merged to main at 05:06 UTC" },
  { pr: 145, who: "Th0rgal", h: 54.356, l2: -11.533, k: "3.3755e-4" },
  { pr: 146, who: "Th0rgal", h: 54.758, l2: -11.083, k: "4.6103e-4" },
  { pr: 147, who: "hpst3r", h: 54.824, l2: -11.072, k: "4.6466e-4" },
  { pr: 148, who: "gupt1156", h: 54.831, l2: -11.083, k: "4.6113e-4" },
  { pr: 150, who: "DaysSky", h: 55.429, l2: -11.05, k: "4.7181e-4" },
  { pr: 151, who: "SovereignSteak", h: 55.759, l2: -11.048, k: "4.7215e-4" },
  { pr: 152, who: "eumemic", h: 56.085, l2: -10.935, k: "5.1083e-4" },
  { pr: 153, who: "geckods", h: 56.194, l2: -10.935, k: "5.1083e-4" },
  { pr: 155, who: "eumemic", h: 56.674, l2: -10.826, k: "5.5081e-4" },
  { pr: 157, who: "eumemic", h: 56.901, l2: -10.814, k: "5.555e-4" },
  { pr: 158, who: "geckods", h: 57.117, l2: -10.813, k: "5.5573e-4" },
  { pr: 160, who: "GamingPuzzled", h: 57.205, l2: -10.798, k: "5.6164e-4" },
  { pr: 161, who: "eumemic", h: 57.394, l2: -10.732, k: "5.8787e-4" },
  { pr: 162, who: "DaysSky", h: 57.634, l2: -10.727, k: "5.9019e-4" },
  { pr: 163, who: "chafreaky", h: 57.737, l2: -10.717, k: "5.9397e-4" },
  { pr: 164, who: "eumemic", h: 58.081, l2: -10.717, k: "5.9404e-4" },
  { pr: 165, who: "chafreaky", h: 58.139, l2: -10.717, k: "5.9427e-4" },
  { pr: 168, who: "eumemic", h: 58.371, l2: -10.574, k: "6.5589e-4", note: "updated in place; its three earlier versions claimed 6.0964e-4, 6.4571e-4 and 6.4891e-4" },
  { pr: 169, who: "GamingPuzzled", h: 58.608, l2: -10.678, k: "6.1056e-4" },
  { pr: 170, who: "huxint", h: 58.788, l2: -10.71, k: "5.9682e-4" },
  { pr: 171, who: "jon314159", h: 58.961, l2: -10.676, k: "6.1107e-4" },
  { pr: 173, who: "GamingPuzzled", h: 59.302, l2: -10.672, k: "6.1297e-4" },
  { pr: 176, who: "chafreaky", h: 59.92, l2: -10.59, k: "6.4894e-4" },
  { pr: 177, who: "gabriele-nespoli", h: 60.054, l2: -11.082, k: "4.6114e-4" },
  { pr: 178, who: "rohanarun", h: 60.483, l2: -10.574, k: "6.5592e-4" },
  { pr: 179, who: "chafreaky", h: 60.684, l2: -10.574, k: "6.5592e-4" },
]

// Each move of main: the PR that supplied the witness, when it was opened, and when GitHub
// marks it merged (main moved). PR #39 opened 12:58 UTC, merged 15:18 after the audit.
type MainMove = Pt & { from: { h: number; l2: number } }
const MAIN: MainMove[] = [
  {
    who: "Colkitt",
    h: 41.305,
    l2: -14.651,
    k: "3.886675852e-5",
    note: "PR #39 (Rohan Arun) merged into main · 0605a24 · maintainer-audited, still conditional on the manuscript",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/39",
    from: { h: 38.979, l2: -14.651 },
  },
  {
    who: "Colkitt",
    h: 42.783,
    l2: -14.566,
    k: "4.123863984e-5",
    note: "PR #49 (Rohan Arun) merged into main · ed8201c · reviewed follow-up",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/49",
    from: { h: 41.616, l2: -14.566 },
  },
  {
    who: "Colkitt",
    h: 44.593,
    l2: -14.259,
    k: "5.1016920170078e-5",
    note: "PRs #50 to #62 reviewed; main takes #62's network with #57's compiler and #61's parameters · 0d235fe",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/61",
    from: { h: 43.687, l2: -14.259 },
  },
  {
    who: "Colkitt",
    h: 55.1,
    l2: -11.083,
    k: "4.609169e-4",
    note: "PR #144 (icekylinx) merged into main through #149 · d1d6c07 · three-stage cover with paired cubes, reviewed",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/144",
    from: { h: 54.326, l2: -11.083 },
  },
]

const JAIN_REPO = "https://github.com/Swapnil-jain/integer-mult-kappa"
const JAIN: Pt[] = [
  { who: "Jain", h: 33.339, l2: -27.581, k: "4.98e-9", note: "round 1 · ε → 1 stack", url: "https://x.com/SJ_Swapnil_Jain/status/2108095135024304240" },
  { who: "Jain", h: 34.266, l2: -26.991, k: "7.499e-9", note: "round 2 · recentred Gaussian inverse", url: "https://x.com/SJ_Swapnil_Jain/status/2108109123774796281" },
  { who: "Jain", h: 36.098, l2: -17.865, k: "4.188e-6", note: "round 3 · batched two-stage bit side", url: "https://x.com/SJ_Swapnil_Jain/status/2108136796886548867" },
  { who: "Jain", h: 37.167, l2: -16.35, k: "1.1972e-5", note: "round 4 · PR #24's bit network", url: "https://x.com/SJ_Swapnil_Jain/status/2108152926959284315" },
  { who: "Jain", h: 38.665, l2: -15.979, k: "1.5479e-5", note: "round 5 · flag basis · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108175552549118371" },
  { who: "Jain", h: 40.055, l2: -14.735, k: "3.6666e-5", note: "round 6 · copied centres · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108196538568851574" },
  { who: "Jain", h: 46.949, l2: -13.932, k: "6.397e-5", note: "round 7 · deferred garbage readout · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108300632738386419" },
  { who: "Jain", h: 54.294, l2: -12.953, k: "1.2613e-4", note: "round 8 · opposite bank orders, shared cores · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108411540672336133" },
  { who: "Jain", h: 55.425, l2: -11.066, k: "4.6637e-4", note: "round 9 · his bit word inside PR #144's three-stage cover · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108428623191605299" },
  { who: "Jain", h: 59.836, l2: -10.666, k: "6.1534e-4", note: "round 10 · paired-cube words with birth reuse · Lean-checked arithmetic", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108495221369757968" },
]

const PALETTE: Record<string, string> = {
  OpenAI: "oklch(0.55 0 0)",
  Colkitt: "oklch(0.55 0.2 25)",
  eumemic: "oklch(0.62 0.16 150)",
  jacklightChen: "oklch(0.62 0.15 260)",
  rohanarun: "oklch(0.70 0.15 70)",
  icekylinx: "oklch(0.60 0.17 320)",
  DominikScholz: "oklch(0.62 0.12 200)",
  ikeboy: "oklch(0.62 0.14 115)",
}
const JAIN_COLOUR = "oklch(0.45 0.2 295)"
const OTHER = "oklch(0.60 0.04 260)"
const colour = (who: string) => (who === "Jain" ? JAIN_COLOUR : (PALETTE[who] ?? OTHER))

const W = 680
const H = 340
const L = 48
const R = 14
const T = 14
const B = 34
// Two views: the whole race, and everything from 10:00 UTC on Oct 8, where everything after 2^-17 lives.
type View = { h0: number; h1: number; y0: number; y1: number }
const FULL: View = { h0: -0.5, h1: 61.5, y0: -190, y1: 0 }
const ZOOM: View = { h0: 36, h1: 61.5, y0: -17.5, y1: -10 }

const EXTRA_A = { h: 15.933, l2: -78 }
const EXTRA_B = { h: 21.583, l2: -59 }
const SLOPE = (EXTRA_B.l2 - EXTRA_A.l2) / (EXTRA_B.h - EXTRA_A.h)
const HIT_ONE = EXTRA_B.h - EXTRA_B.l2 / SLOPE

const scales = (v: View) => ({
  x: (h: number) => L + ((h - v.h0) / (v.h1 - v.h0)) * (W - L - R),
  y: (l2: number) => T + ((v.y1 - l2) / (v.y1 - v.y0)) * (H - T - B),
  inside: (p: { h: number; l2: number }) => p.h >= v.h0 && p.h <= v.h1 && p.l2 >= v.y0 && p.l2 <= v.y1,
})

function stamp(h: number) {
  const mins = Math.round(h * 60) + 22 * 60
  const day = 6 + Math.floor(mins / (24 * 60))
  const m = mins % (24 * 60)
  const hh = String(Math.floor(m / 60)).padStart(2, "0")
  const mm = String(m % 60).padStart(2, "0")
  return `Oct ${day}, ${hh}:${mm} UTC`
}

export function KappaRace() {
  const [showPrs, setShowPrs] = useState(true)
  const [showLine, setShowLine] = useState(true)
  const [showJain, setShowJain] = useState(true)
  const [zoom, setZoom] = useState(false)
  const [sel, setSel] = useState<Pt>(PRS[11])
  const view = zoom ? ZOOM : FULL
  const { x, y, inside } = scales(view)

  const frontier: Pt[] = []
  let best = -Infinity
  for (const p of [...PRS].sort((a, b) => a.h - b.h)) {
    if (p.l2 > best) {
      best = p.l2
      frontier.push(p)
    }
  }
  const path = frontier.map((p, i) => (i === 0 ? `M${x(p.h)},${y(p.l2)}` : `H${x(p.h)}V${y(p.l2)}`)).join("")

  const jainPath = JAIN.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.h)},${y(p.l2)}`).join("")

  const mainPath = MAIN.map((p, i) => (i === 0 ? `M${x(p.h)},${y(p.l2)}` : `H${x(p.h)}V${y(p.l2)}`)).join("") + `H${x(view.h1)}`
  const last = MAIN[MAIN.length - 1]

  const all = [ORIGIN, ...COLKITT, ...MAIN, ...(showPrs ? PRS : []), ...(showJain ? JAIN : [])]
  const shown = all.filter(inside)
  const who = sel.pr
    ? `PR #${sel.pr} by ${sel.who}`
    : sel.merged
      ? "main"
      : sel.who === "Jain"
        ? "Swapnil Jain (own repo)"
        : sel.who
  const ticksY = zoom ? [-17, -16, -15, -14, -13, -12, -11] : [-180, -150, -120, -90, -60, -30, 0]
  const ticksX = zoom
    ? [
        { h: 38, label: "Oct 8 12:00" },
        { h: 44, label: "18:00" },
        { h: 50, label: "Oct 9 00:00" },
        { h: 56, label: "06:00" },
      ]
    : [
        { h: 2, label: "Oct 7 00:00" },
        { h: 14, label: "12:00" },
        { h: 26, label: "Oct 8 00:00" },
        { h: 38, label: "12:00" },
        { h: 50, label: "Oct 9 00:00" },
      ]

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        log₂ κ against time · every checkpoint and PR, each move of main, and Jain&apos;s ten rounds, Oct 6 to 11:00 UTC on Oct 9
        {zoom ? " · zoomed to 10:00 UTC on Oct 8 onward" : ""}
      </figcaption>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Scatter of log base 2 of kappa against time. OpenAI's 2 to the minus 182 at the left, committed at 21:59 UTC on October 6; Colkitt's checkpoints climb to 2 to the minus 30 by 13:10 UTC on October 8; community pull requests climb from 2 to the minus 31 to about 2 to the minus 14.6 by 12:30 UTC, pause, climb to about 2 to the minus 14.2 by the evening and to 2 to the minus 13.9 by 22:40. After 23:00 a run of new constructions lifts them past 2 to the minus 13 at 00:24 UTC on October 9, to 2 to the minus 11.6 at 02:29 with the three-stage cover, and to 2 to the minus 10.57 by 08:22. A red step line marks main: pull request 39 merged at 15:18 UTC at 2 to the minus 14.65, pull request 49 at 16:47, a reviewed batch at 18:36 at 2 to the minus 14.26, and pull request 144 at 05:06 UTC on October 9 at 2 to the minus 11.08. Swapnil Jain's separate track, ten diamonds joined by a line, runs from 2 to the minus 27.6 at 07:20 UTC on October 8 to 2 to the minus 10.67 at 09:50 UTC on October 9; rounds five to ten are ringed as Lean-kernel-checked arithmetic. A straight-line extrapolation through 2 to the minus 78 and 2 to the minus 59 reaches kappa equals one at about 13:08 UTC on October 8. A zoom button shows everything from 10:00 UTC on October 8."
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.2 : 0.6} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={10} className="fill-muted-foreground font-mono">
              {t === 0 ? "κ=1" : `2^${t}`}
            </text>
          </g>
        ))}
        {ticksX.map((t) => (
          <text key={t.h} x={x(t.h)} y={H - 12} textAnchor="middle" fontSize={10} className="fill-muted-foreground font-mono">
            {t.label}
          </text>
        ))}
        <defs>
          <clipPath id="kappa-race-plot">
            <rect x={L} y={T - 2} width={W - L - R} height={H - T - B + 4} />
          </clipPath>
        </defs>
        <g clipPath="url(#kappa-race-plot)">
        {showLine ? (
          <g>
            <line
              x1={x(EXTRA_A.h)}
              y1={y(EXTRA_A.l2)}
              x2={x(HIT_ONE)}
              y2={y(0)}
              stroke="oklch(0.6 0.15 250)"
              strokeDasharray="3 4"
              strokeWidth={1.6}
            />
            <line x1={x(HIT_ONE)} y1={y(0)} x2={W - R} y2={y(0)} stroke="oklch(0.6 0.15 250)" strokeDasharray="3 4" strokeWidth={1.6} />
            <text x={x(HIT_ONE) - 6} y={y(0) + 14} textAnchor="end" fontSize={10} fill="oklch(0.6 0.15 250)" className="font-mono">
              extrapolated: κ=1 at {stamp(HIT_ONE)}
            </text>
          </g>
        ) : null}
        {showPrs ? <path d={path} fill="none" stroke="oklch(0.62 0.16 150)" strokeWidth={1.2} opacity={0.6} /> : null}
        {MAIN.map((p, i) => (
          <line
            key={i}
            x1={x(p.from.h)}
            y1={y(p.from.l2)}
            x2={x(p.h)}
            y2={y(p.l2)}
            stroke={PALETTE.Colkitt}
            strokeDasharray="2 3"
            strokeWidth={1.4}
          />
        ))}
        <path d={mainPath} fill="none" stroke={PALETTE.Colkitt} strokeWidth={1.4} opacity={0.75} />
        <text x={x(last.h) - 4} y={y(last.l2) + (zoom ? -10 : 22)} textAnchor="end" fontSize={10} fill={PALETTE.Colkitt} className="font-mono">
          main
        </text>
        {showJain ? <path d={jainPath} fill="none" stroke={JAIN_COLOUR} strokeWidth={1.2} opacity={0.7} /> : null}
        </g>
        {shown.map((p, i) => {
          const on = p === sel
          if (p.who === "Jain") {
            const r = on ? 6.5 : 4.6
            const cx = x(p.h)
            const cy = y(p.l2)
            return (
              <g key={i} style={{ cursor: "pointer" }} onClick={() => setSel(p)}>
                {p.lean ? <circle cx={cx} cy={cy} r={r + 3.6} fill="none" stroke={JAIN_COLOUR} strokeWidth={1.3} /> : null}
                <path
                  d={`M${cx},${cy - r}L${cx + r},${cy}L${cx},${cy + r}L${cx - r},${cy}Z`}
                  fill={JAIN_COLOUR}
                  stroke={on ? "var(--foreground)" : "var(--background)"}
                  strokeWidth={on ? 2 : 1}
                />
              </g>
            )
          }
          if (p.merged) {
            const r = on ? 6.5 : 5
            const cx = x(p.h)
            const cy = y(p.l2)
            return (
              <rect
                key={i}
                x={cx - r}
                y={cy - r}
                width={2 * r}
                height={2 * r}
                fill={PALETTE.Colkitt}
                stroke={on ? "var(--foreground)" : "var(--background)"}
                strokeWidth={on ? 2 : 1}
                style={{ cursor: "pointer" }}
                onClick={() => setSel(p)}
              />
            )
          }
          return (
            <circle
              key={i}
              cx={x(p.h)}
              cy={y(p.l2)}
              r={on ? 6 : p.pr ? 3.4 : 4.6}
              fill={colour(p.who)}
              stroke={on ? "var(--foreground)" : "var(--background)"}
              strokeWidth={on ? 2 : 1}
              style={{ cursor: "pointer" }}
              onClick={() => setSel(p)}
            />
          )
        })}
      </svg>

      <div className="mt-2 rounded-md border border-border p-2 font-mono text-xs">
        <span style={{ color: colour(sel.who) }}>{sel.merged ? "■" : "●"}</span> {who} · {stamp(sel.h)} · κ = {sel.k} · log₂ κ = {sel.l2.toFixed(2)}
        {sel.note ? ` · ${sel.note}` : ""}
        {sel.merged ? (
          <>
            {" "}·{" "}
            <a className="underline" href={sel.url}>
              merged PR
            </a>
          </>
        ) : null}
        {sel.pr ? (
          <>
            {" "}·{" "}
            <a className="underline" href={`https://github.com/CrocSwap/integer-mult-bounds/pull/${sel.pr}`}>
              open PR
            </a>
          </>
        ) : null}
        {sel.url && !sel.merged ? (
          <>
            {" "}·{" "}
            <a className="underline" href={sel.url}>
              post
            </a>{" "}
            ·{" "}
            <a className="underline" href={JAIN_REPO}>
              repo
            </a>
          </>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <button
          type="button"
          onClick={() => setZoom((v) => !v)}
          aria-pressed={zoom}
          className={cn("rounded-md border px-2 py-0.5 font-mono", zoom ? "border-foreground" : "border-border text-muted-foreground")}
        >
          zoom: from Oct 8, 10:00
        </button>
        <button
          type="button"
          onClick={() => setShowPrs((v) => !v)}
          aria-pressed={showPrs}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showPrs ? "border-foreground" : "border-border text-muted-foreground")}
        >
          community PRs
        </button>
        <button
          type="button"
          onClick={() => setShowLine((v) => !v)}
          aria-pressed={showLine}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showLine ? "border-foreground" : "border-border text-muted-foreground")}
        >
          straight-line extrapolation
        </button>
        <button
          type="button"
          onClick={() => setShowJain((v) => !v)}
          aria-pressed={showJain}
          className={cn("rounded-md border px-2 py-0.5 font-mono", showJain ? "border-foreground" : "border-border text-muted-foreground")}
        >
          Jain&apos;s track
        </button>
        <label className="flex items-center gap-2 font-mono text-muted-foreground">
          step through
          <select
            className="rounded-md border border-border bg-background px-1 py-0.5"
            value={Math.max(0, all.indexOf(sel))}
            onChange={(e) => setSel(all[Number(e.target.value)] ?? ORIGIN)}
            aria-label="Select a checkpoint or pull request"
          >
            {all.map((p, i) => (
              <option key={i} value={i}>
                {p.pr
                  ? `#${p.pr} ${p.who}`
                  : p.merged
                    ? `main ${p.k}`
                    : `${p.who} ${p.k}${p.lean ? " (Lean)" : ""}`}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 font-mono text-[11px] text-muted-foreground">
        {[...Object.keys(PALETTE), "others"].map((k) => (
          <span key={k}>
            <span style={{ color: k === "others" ? OTHER : PALETTE[k] }}>●</span> {k}
          </span>
        ))}
        <span>
          <span style={{ color: PALETTE.Colkitt }}>■</span> main moves, each after the maintainer&apos;s review (dashed from the PR&apos;s opening)
        </span>
        <span>
          <span style={{ color: JAIN_COLOUR }}>◆</span> Jain (own repo)
        </span>
        <span>
          <span style={{ color: JAIN_COLOUR }}>◎</span> arithmetic checked in Lean&apos;s kernel; the other checkpoints and PRs ship exact Python certificates
        </span>
      </div>
    </figure>
  )
}
