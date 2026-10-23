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
//   #180 to #217 were added at 18:50 UTC on Oct 9 from the GitHub REST API, kappa from each
//     title as it read then. Omitted: PRs whose titles claim no kappa (#180, an audit draft;
//     #183, #190, #192, #201, #203, #208, #209, #212, #214, #215, ceilings, tooling and research)
//     and #200 and #204, whose titles state a bit-side saving or a priced target, not a kappa.
//   #218 to #300 were added at 11:35 UTC on Oct 10 from the GitHub REST API, kappa from each
//     title as it read then. Omitted: titles with no kappa or "no new κ" (#218, #225, #229, #231,
//     #233, #236 (a Lean check of #144's 4.609169e-4), #239, #241, #245, #250, #256, #274, #278,
//     #288, #294, #301), and the priced targets that say they are not witnesses (#219, #224, #232,
//     #246, #262). #275 was opened at 04:17 UTC claiming 7.13690108083058e-4 and retitled five
//     times; it is plotted at its 11:31:42 rename, 7.51075693834608e-4, the best open claim then.
//     Main did not move: GitHub's main is still 3b6b668 (selected-result.json at 27d82eb), although
//     Colkitt posted at 04:13 UTC on Oct 10 that he had verified and merged #210 at about 7.10046e-4.
//   #301 to #485 were added at 19:40 UTC on Oct 11 from the GitHub REST API, kappa from each
//     title as it read then, except #376 and #434, plotted at their opening titles (9.3191e-4
//     and 1.12825e-3) from GitHub's rename events: #376 was retitled fifteen times, past 1e-3
//     at 06:59:21 UTC, ten minutes before #390 opened. Omitted: titles with no kappa, supplier-only
//     or "no new κ" PRs, tooling, audits and archives (#301, #302, #304, #318, #324, #327, #333,
//     #349, #363, #365, #367, #368, #371, #379, #393, #397, #417, #430, #446, #449, #452, #468,
//     #474, #475, #477, #479, #481, #484, #485), #377 (its title is a projection; its body says the
//     combined kappa stays 8.048e-4) and #453 (its author withdrew the gain). #448, #450, #464, #469
//     and #480 rest on #448's cross-copy residual split, which #451 challenges with an exact trace
//     computation; they are drawn hollow and left out of the green best-claim line.
//   #486 to #844 were added at 07:20 UTC on Oct 13 from the GitHub REST API, kappa from each
//     title as it read then. Omitted: titles with no kappa or "no new κ" (most of #486 onward are
//     circuit, tooling, Lean and audit PRs), bit-only savings (#503, #510, #545, #555, #589),
//     Lean checks of an older kappa (#487, #488), DreamingOfClouds' #595 ceiling, and replays or
//     independent verifications of someone else's kappa (#586, #594, #611, #613, #777, #826).
//     #494 and #499 rest on #448's cross-copy split and are drawn hollow.
//   #845 to #2909 were added at 10:15 UTC on Oct 16 without the GitHub API, which was unreachable.
//     Titles and logins come from docs/research/pr-ledger.json on main at 0706e74 (titles as they
//     read in that snapshot), or, for PRs not yet in it, the head commit's subject. Times are not
//     opening times: each point sits at the earliest commit unique to that PR (not on main and not
//     in a lower-numbered PR head), moved later to the time of any higher-placed PR its title builds
//     on; merged PRs, whose commits are on main, sit at their head commit time. Omitted: titles with
//     no kappa, "no new κ", "kappa unchanged", text-only, replay, audit and verification PRs.
//   #2864 to #3204 were added at 17:35 UTC on Oct 17, again without the GitHub API: titles,
//     logins and states from docs/research/pr-ledger.json on main at 463113d (to #3197), else the
//     head commit's subject and author. Times as for #845 onward; "MERGED" PRs from #2908 on are
//     the maintainer's source archives ("does not admit a supplier, outer theorem or improved
//     kappa"), not selections, so they sit at their head commit time like the rest. Omitted:
//     titles with no kappa or "no new kappa", #3021 (no kappa in its title), #3135 (a precision
//     refinement with no kappa stated). #3184, #3190, #3198 and #3200 rest on #3184's idle-star
//     move, for which #3187 gives an exact physical-operator counterexample; they are drawn
//     hollow and left out of the green best-claim line. main did not move: selected-result.json
//     is still #1094 at 463113d (16:52 UTC on Oct 17).
//   #3251 was added at 02:54 UTC on Oct 19 from PR heads #3140 to #3881 fetched without the GitHub
//     API (ledger at 20ecf28 to #3528, else commit subjects). No other title or commit subject in
//     that range states a kappa above #3148's. #3251 stacks on #3200, and #3263 gives an exact
//     operator counterexample for its frozen moves, so it is drawn hollow too. main did not move:
//     selected-result.json is still #1094 at 20ecf28 (04:52 UTC on Oct 18).
//   #3682 to #4626 were added at 04:30 UTC on Oct 23 from docs/research/pr-ledger.json on main at
//     b919568 (to #4954) and PR heads fetched with git. Each sits at the first commit on its head
//     that states its kappa (commit time). #3682, #3734, #3945, #4076, #4085, #4088 and #4181 are
//     the staged T360 line, which the Oct 19 pass missed because #3682's and #3734's titles state no
//     number; #3682 already passed #3148 at 12:33 UTC on Oct 18. #4359 onward are the productive-
//     helper line. #4713 and the other Word RAM transfers are left out (a different machine
//     model), as are BIT-only savings (#4760, #4814) and "not frontier" or "no new kappa" titles.
//     main moved twice: #4359 at ae87507 (19:10:46 UTC on Oct 21) and #4470 at 4f19ced
//     (12:16:48 UTC on Oct 22), kappa from certificates/selected-result.json at each.
//   Four more moves of main on Oct 13, at the committer times of the selection commits (no
//     merged_at without the API): #890 3b83e4f 13:30:30, #942 3825dc0 15:06:01, #1042 87db776
//     18:05:11, #1094 0a31ad8 18:45:23; kappa from certificates/selected-result.json at each.
//     main had not moved again by 0706e74 (10:07 UTC on Oct 16).
//   Eight more moves of main, at GitHub's merged_at times on Oct 12 and 13: #531 (with #523 and
//     #493) 01:55:39, #535 (with #510) 13:10:49, #588 (with #543) 15:45:41, #596 17:00:38,
//     #617 21:01:43, #626 22:36:46, #741 06:10:35 and #799 06:44:20; kappa from
//     certificates/selected-result.json and the checkpoint records at each selection commit.
//   A sixth move of main: GitHub marks #276 merged at 14:08:25 UTC on Oct 10, when main took
//     PR #279's first four commits (Rohan Arun on DreamingOfClouds' gen4 word);
//     certificates/selected-result.json gives 90446448750933/(1.25*10^17). The audited #210
//     (710046193349537/10^18) was imported in the same push as a historical checkpoint only.
//   A fifth move of main: GitHub's push log has d1d6c07 -> 27d82eb at 12:57:37 UTC on Oct 9;
//     certificates/selected-result.json gives 330942774629799/(5*10^17), PR #186 (Dugongue),
//     imported as a package (GitHub still shows #186 open). The same push carried the
//     unpublished 472154791/10^12 overnight candidate (#147/#150/#151), which never stood alone.
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
//     his eleven X posts (fxtwitter mirror), kappa the exact witness in the commit each post
//     announced (round 7 is the 741e7aa witness he posted, 1599247689723/(2.5*10^16), not the
//     later 7.1 headline). Rounds five to eleven ship Lean files (lean/Round5.lean to
//     Round11.lean) that check their moment and assembly arithmetic in the kernel; everything
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
  contested?: boolean
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
  { pr: 181, who: "chafreaky", h: 61.182, l2: -10.567, k: "6.5918e-4" },
  { pr: 182, who: "chafreaky", h: 61.461, l2: -10.565, k: "6.6022e-4" },
  { pr: 184, who: "icekylinx", h: 61.538, l2: -10.573, k: "6.5664e-4", note: "source-assisted recycling; closed five minutes after opening" },
  { pr: 185, who: "rohanarun", h: 61.686, l2: -10.564, k: "6.6063e-4" },
  { pr: 186, who: "Dugongue", h: 61.9, l2: -10.561, k: "6.6189e-4", note: "imported to main at 12:57 UTC" },
  { pr: 187, who: "rohanarun", h: 62.06, l2: -10.561, k: "6.6176e-4" },
  { pr: 188, who: "huxint", h: 62.06, l2: -10.665, k: "6.1603e-4" },
  { pr: 189, who: "chafreaky", h: 62.118, l2: -10.561, k: "6.6176e-4" },
  { pr: 191, who: "ikeboy", h: 62.273, l2: -10.56, k: "6.6263e-4" },
  { pr: 193, who: "ikeboy", h: 62.61, l2: -10.555, k: "6.6479e-4" },
  { pr: 194, who: "ikeboy", h: 62.729, l2: -10.549, k: "6.6743e-4" },
  { pr: 195, who: "huxint", h: 63.005, l2: -10.559, k: "6.6265e-4" },
  { pr: 196, who: "chafreaky", h: 63.395, l2: -10.554, k: "6.6505e-4" },
  { pr: 197, who: "evmckinney9", h: 63.454, l2: -10.531, k: "6.7608e-4", note: "first claim past Jain's round eleven" },
  { pr: 198, who: "sennemmi", h: 63.712, l2: -10.548, k: "6.6791e-4" },
  { pr: 199, who: "maxime-fleury", h: 64.143, l2: -10.528, k: "6.7731e-4" },
  { pr: 202, who: "chafreaky", h: 64.658, l2: -10.529, k: "6.7688e-4" },
  { pr: 205, who: "rohanarun", h: 65.778, l2: -10.516, k: "6.8306e-4" },
  { pr: 206, who: "EcmaXp", h: 65.83, l2: -10.516, k: "6.8306e-4" },
  { pr: 207, who: "Dugongue", h: 66.004, l2: -10.515, k: "6.8319e-4" },
  { pr: 210, who: "eumemic", h: 66.983, l2: -10.514, k: "6.8396e-4", note: "its claim at 18:50 UTC on Oct 9; retitled overnight to 7.1007e-4 with five-stage banks, and the PR Colkitt said he merged at 04:13 UTC on Oct 10" },
  { pr: 211, who: "rohanarun", h: 67.249, l2: -10.514, k: "6.8385e-4" },
  { pr: 213, who: "sennemmi", h: 67.55, l2: -10.514, k: "6.8385e-4" },
  { pr: 216, who: "Dugongue", h: 68.467, l2: -10.514, k: "6.8386e-4" },
  { pr: 217, who: "hcg890", h: 68.637, l2: -10.512, k: "6.847e-4", note: "best open claim at 18:50 UTC on Oct 9" },
  { pr: 223, who: "ikeboy", h: 69.774, l2: -10.497, k: "6.9214e-4" },
  { pr: 226, who: "pCwOrM", h: 70.111, l2: -14.563, k: "4.1311e-5" },
  { pr: 227, who: "Dugongue", h: 70.559, l2: -10.491, k: "6.9478e-4" },
  { pr: 228, who: "tehruhn", h: 70.609, l2: -10.559, k: "6.6283e-4" },
  { pr: 230, who: "sennemmi", h: 70.831, l2: -10.491, k: "6.9479e-4" },
  { pr: 234, who: "hcg890", h: 72.097, l2: -10.473, k: "7.037e-4", note: "first five-stage κ: Sussman's bridged layout on the multiplication side" },
  { pr: 235, who: "gabriele-nespoli", h: 72.129, l2: -10.463, k: "7.0858e-4" },
  { pr: 237, who: "rohanarun", h: 72.338, l2: -10.463, k: "7.0858e-4" },
  { pr: 238, who: "amanforindia", h: 72.858, l2: -10.559, k: "6.6268e-4" },
  { pr: 240, who: "rohanarun", h: 73.01, l2: -10.461, k: "7.0942e-4" },
  { pr: 242, who: "Dugongue", h: 73.488, l2: -10.46, k: "7.1005e-4", note: "the source527 line Colkitt said he merged at 04:13 UTC (main had not moved on GitHub by 11:35)" },
  { pr: 243, who: "rohanarun", h: 73.56, l2: -10.461, k: "7.0942e-4" },
  { pr: 244, who: "eumemic", h: 73.727, l2: -10.459, k: "7.1035e-4" },
  { pr: 247, who: "sennemmi", h: 74.008, l2: -10.459, k: "7.1035e-4" },
  { pr: 248, who: "rohanarun", h: 74.089, l2: -10.459, k: "7.1035e-4" },
  { pr: 249, who: "eumemic", h: 74.106, l2: -10.459, k: "7.1039e-4" },
  { pr: 251, who: "eumemic", h: 74.464, l2: -10.459, k: "7.1043e-4" },
  { pr: 252, who: "rohanarun", h: 74.504, l2: -10.459, k: "7.1039e-4" },
  { pr: 253, who: "sennemmi", h: 75.023, l2: -10.459, k: "7.1043e-4" },
  { pr: 254, who: "Dugongue", h: 75.234, l2: -10.459, k: "7.1047e-4" },
  { pr: 255, who: "hvaliconAI", h: 75.593, l2: -10.459, k: "7.1047e-4" },
  { pr: 257, who: "sennemmi", h: 75.711, l2: -10.459, k: "7.1047e-4" },
  { pr: 258, who: "amanforindia", h: 75.866, l2: -10.459, k: "7.1047e-4" },
  { pr: 259, who: "Dugongue", h: 75.923, l2: -10.458, k: "7.1103e-4" },
  { pr: 260, who: "rohanarun", h: 76.028, l2: -10.459, k: "7.1044e-4" },
  { pr: 261, who: "sennemmi", h: 76.263, l2: -10.458, k: "7.1103e-4" },
  { pr: 263, who: "rohanarun", h: 76.469, l2: -10.458, k: "7.1103e-4" },
  { pr: 264, who: "dataisfire", h: 76.612, l2: -10.56, k: "6.625e-4" },
  { pr: 265, who: "rohanarun", h: 76.676, l2: -10.458, k: "7.1103e-4" },
  { pr: 266, who: "chafreaky", h: 77.009, l2: -10.452, k: "7.1403e-4" },
  { pr: 267, who: "Dugongue", h: 77.016, l2: -10.458, k: "7.1107e-4" },
  { pr: 268, who: "eumemic", h: 77.033, l2: -10.457, k: "7.1119e-4" },
  { pr: 269, who: "rohanarun", h: 77.28, l2: -10.457, k: "7.1143e-4" },
  { pr: 270, who: "utcorvusvolat-dotcom", h: 77.428, l2: -10.457, k: "7.1146e-4" },
  { pr: 271, who: "evmckinney9", h: 77.697, l2: -10.452, k: "7.1366e-4" },
  { pr: 272, who: "Dugongue", h: 77.701, l2: -10.456, k: "7.1207e-4" },
  { pr: 273, who: "rohanarun", h: 77.846, l2: -10.456, k: "7.1195e-4" },
  { pr: 275, who: "lydakis", h: 85.528, l2: -10.379, k: "7.5108e-4", note: "opened 04:17 at 7.1369e-4 and retitled five times; plotted at its 11:31 claim, the best open claim then" },
  { pr: 276, who: "DreamingOfClouds", h: 78.299, l2: -10.434, k: "7.2287e-4", note: "gen4: a new paired-cube bit word in the five-stage banks" },
  { pr: 277, who: "hcg890", h: 78.334, l2: -10.458, k: "7.1105e-4" },
  { pr: 279, who: "rohanarun", h: 78.689, l2: -10.432, k: "7.241e-4" },
  { pr: 280, who: "utcorvusvolat-dotcom", h: 78.903, l2: -10.431, k: "7.2419e-4" },
  { pr: 281, who: "rohanarun", h: 79.214, l2: -10.43, k: "7.2511e-4" },
  { pr: 282, who: "chafreaky", h: 79.338, l2: -10.43, k: "7.2473e-4" },
  { pr: 283, who: "Dugongue", h: 79.52, l2: -10.428, k: "7.2611e-4" },
  { pr: 284, who: "chafreaky", h: 80.624, l2: -10.427, k: "7.2629e-4" },
  { pr: 285, who: "DreamingOfClouds", h: 81.169, l2: -10.395, k: "7.4279e-4", note: "gen5: annealed modules on the gen4 word" },
  { pr: 286, who: "GamingPuzzled", h: 81.564, l2: -10.427, k: "7.2632e-4" },
  { pr: 287, who: "rohanarun", h: 81.774, l2: -10.392, k: "7.4414e-4" },
  { pr: 289, who: "gupt1156", h: 82.629, l2: -10.392, k: "7.4413e-4" },
  { pr: 290, who: "chafreaky", h: 82.665, l2: -10.391, k: "7.4471e-4" },
  { pr: 291, who: "rohanarun", h: 83.264, l2: -10.391, k: "7.4473e-4" },
  { pr: 292, who: "sannidhi-hemanth", h: 83.356, l2: -10.391, k: "7.4472e-4" },
  { pr: 293, who: "jacklightChen", h: 83.558, l2: -10.391, k: "7.4473e-4" },
  { pr: 295, who: "chafreaky", h: 83.676, l2: -10.389, k: "7.4551e-4" },
  { pr: 296, who: "chafreaky", h: 83.787, l2: -10.387, k: "7.4671e-4", note: "gen5b" },
  { pr: 297, who: "rohanarun", h: 83.936, l2: -10.39, k: "7.4529e-4" },
  { pr: 298, who: "M6LI", h: 84.058, l2: -10.391, k: "7.4471e-4" },
  { pr: 299, who: "chafreaky", h: 84.212, l2: -10.381, k: "7.499e-4" },
  { pr: 300, who: "rohanarun", h: 84.674, l2: -10.381, k: "7.4992e-4" },
  { pr: 303, who: "rohanarun", h: 85.971, l2: -10.381, k: "7.4998e-4" },
  { pr: 305, who: "eumemic", h: 86.296, l2: -10.379, k: "7.5114e-4" },
  { pr: 306, who: "chafreaky", h: 87.013, l2: -10.378, k: "7.5146e-4" },
  { pr: 307, who: "rohanarun", h: 87.149, l2: -10.379, k: "7.5115e-4" },
  { pr: 308, who: "rohanarun", h: 87.431, l2: -10.378, k: "7.5147e-4" },
  { pr: 309, who: "Dugongue", h: 87.489, l2: -10.378, k: "7.515e-4" },
  { pr: 310, who: "utcorvusvolat-dotcom", h: 88.23, l2: -10.375, k: "7.5289e-4", note: "Design T: a redesigned w3 bit word that frees helpers" },
  { pr: 311, who: "rohanarun", h: 88.862, l2: -10.374, k: "7.5351e-4" },
  { pr: 312, who: "chafreaky", h: 89.55, l2: -10.372, k: "7.5455e-4" },
  { pr: 313, who: "rohanarun", h: 89.716, l2: -10.373, k: "7.5408e-4" },
  { pr: 314, who: "rohanarun", h: 89.873, l2: -10.371, k: "7.5512e-4" },
  { pr: 315, who: "DreamingOfClouds", h: 89.921, l2: -10.354, k: "7.6423e-4" },
  { pr: 316, who: "rohanarun", h: 90.249, l2: -10.352, k: "7.6515e-4" },
  { pr: 317, who: "eumemic", h: 90.446, l2: -10.346, k: "7.6817e-4" },
  { pr: 319, who: "eumemic", h: 90.719, l2: -10.346, k: "7.6826e-4" },
  { pr: 320, who: "chafreaky", h: 90.85, l2: -10.344, k: "7.6955e-4" },
  { pr: 321, who: "Dugongue", h: 92.038, l2: -10.344, k: "7.6921e-4" },
  { pr: 322, who: "eumemic", h: 92.084, l2: -10.344, k: "7.6956e-4" },
  { pr: 323, who: "eumemic", h: 92.173, l2: -10.344, k: "7.6956e-4" },
  { pr: 325, who: "DreamingOfClouds", h: 92.442, l2: -10.343, k: "7.6968e-4" },
  { pr: 326, who: "eumemic", h: 92.484, l2: -10.344, k: "7.6957e-4" },
  { pr: 328, who: "eumemic", h: 93.187, l2: -10.339, k: "7.7229e-4" },
  { pr: 329, who: "chafreaky", h: 93.295, l2: -10.331, k: "7.7652e-4" },
  { pr: 330, who: "eumemic", h: 93.654, l2: -10.331, k: "7.7652e-4" },
  { pr: 331, who: "eumemic", h: 93.939, l2: -10.331, k: "7.7652e-4" },
  { pr: 332, who: "eumemic", h: 94.298, l2: -10.329, k: "7.7727e-4" },
  { pr: 334, who: "eumemic", h: 95.257, l2: -10.329, k: "7.776e-4" },
  { pr: 335, who: "eumemic", h: 95.581, l2: -10.329, k: "7.7761e-4" },
  { pr: 336, who: "eumemic", h: 96.247, l2: -10.329, k: "7.7763e-4" },
  { pr: 337, who: "eumemic", h: 96.319, l2: -10.329, k: "7.7765e-4" },
  { pr: 338, who: "eumemic", h: 96.69, l2: -10.329, k: "7.7767e-4" },
  { pr: 339, who: "eumemic", h: 96.711, l2: -10.328, k: "7.777e-4" },
  { pr: 340, who: "rohanarun", h: 96.883, l2: -10.329, k: "7.7766e-4" },
  { pr: 341, who: "eumemic", h: 97.074, l2: -10.328, k: "7.7771e-4" },
  { pr: 342, who: "eumemic", h: 97.217, l2: -10.328, k: "7.7773e-4" },
  { pr: 343, who: "eumemic", h: 97.338, l2: -10.328, k: "7.7775e-4" },
  { pr: 344, who: "eumemic", h: 97.476, l2: -10.328, k: "7.7795e-4" },
  { pr: 345, who: "eumemic", h: 97.733, l2: -10.328, k: "7.7809e-4" },
  { pr: 346, who: "LJH-217", h: 97.761, l2: -10.301, k: "7.9258e-4", note: "#310's Design T ported to p = 10; the complex side becomes the wall" },
  { pr: 347, who: "eumemic", h: 97.771, l2: -10.328, k: "7.781e-4" },
  { pr: 348, who: "chafreaky", h: 98.295, l2: -10.3, k: "7.9339e-4" },
  { pr: 350, who: "rohanarun", h: 98.639, l2: -10.3, k: "7.9347e-4" },
  { pr: 351, who: "eumemic", h: 98.696, l2: -10.3, k: "7.9339e-4" },
  { pr: 352, who: "DaysSky", h: 99.063, l2: -10.286, k: "8.0108e-4", note: "Sussman's Lean-checked E8 unit as the complex supplier; the bit side binds again" },
  { pr: 353, who: "rohanarun", h: 99.423, l2: -10.285, k: "8.016e-4" },
  { pr: 354, who: "chafreaky", h: 99.551, l2: -10.282, k: "8.0314e-4" },
  { pr: 355, who: "Dugongue", h: 99.863, l2: -10.284, k: "8.0197e-4" },
  { pr: 356, who: "eumemic", h: 99.965, l2: -10.282, k: "8.0316e-4" },
  { pr: 357, who: "rohanarun", h: 100.116, l2: -10.281, k: "8.0365e-4" },
  { pr: 358, who: "eumemic", h: 100.245, l2: -10.281, k: "8.0368e-4" },
  { pr: 359, who: "chafreaky", h: 100.374, l2: -10.28, k: "8.043e-4" },
  { pr: 360, who: "Dugongue", h: 100.485, l2: -10.281, k: "8.0351e-4" },
  { pr: 361, who: "chafreaky", h: 100.917, l2: -10.279, k: "8.0485e-4" },
  { pr: 362, who: "rohanarun", h: 100.949, l2: -10.279, k: "8.0485e-4" },
  { pr: 364, who: "rohanarun", h: 101.608, l2: -10.279, k: "8.0488e-4" },
  { pr: 366, who: "rohanarun", h: 102.387, l2: -10.279, k: "8.0494e-4" },
  { pr: 369, who: "applecrusher", h: 102.766, l2: -10.279, k: "8.0495e-4" },
  { pr: 370, who: "utcorvusvolat-dotcom", h: 103.096, l2: -10.158, k: "8.7548e-4", note: "first E8 bit word: the 120 root lines of E8 in Q⁸" },
  { pr: 372, who: "DesmondForward", h: 103.287, l2: -10.433, k: "7.2357e-4" },
  { pr: 373, who: "DaysSky", h: 103.438, l2: -10.068, k: "9.3191e-4", note: "E8 bit word with the E8 complex unit in a seven-stage bridged word" },
  { pr: 374, who: "rohanarun", h: 103.678, l2: -10.033, k: "9.544e-4" },
  { pr: 375, who: "DaysSky", h: 103.718, l2: -10.033, k: "9.5424e-4" },
  { pr: 376, who: "applecrusher", h: 103.734, l2: -10.068, k: "9.3191e-4", note: "opened at 9.3191e-4 (plotted); retitled 15 times, to 1.00005e-3 at 06:59 UTC and 1.1209e-3 by 12:40" },
  { pr: 378, who: "chafreaky", h: 103.911, l2: -10.033, k: "9.5465e-4" },
  { pr: 380, who: "rohanarun", h: 104.125, l2: -10.014, k: "9.6726e-4" },
  { pr: 381, who: "DaysSky", h: 104.241, l2: -9.972, k: "9.9566e-4" },
  { pr: 382, who: "chafreaky", h: 104.311, l2: -9.968, k: "9.9824e-4" },
  { pr: 383, who: "rohanarun", h: 104.417, l2: -9.97, k: "9.9676e-4" },
  { pr: 384, who: "chafreaky", h: 104.459, l2: -9.968, k: "9.9863e-4" },
  { pr: 385, who: "rohanarun", h: 104.565, l2: -9.968, k: "9.9839e-4" },
  { pr: 386, who: "jacklightChen", h: 104.684, l2: -9.968, k: "9.9824e-4" },
  { pr: 387, who: "rohanarun", h: 104.763, l2: -9.968, k: "9.9863e-4" },
  { pr: 388, who: "eumemic", h: 104.789, l2: -9.975, k: "9.9395e-4" },
  { pr: 389, who: "ai-nanachi", h: 105.008, l2: -9.968, k: "9.9863e-4" },
  { pr: 390, who: "Dugongue", h: 105.163, l2: -9.965, k: "1.0002e-3", note: "first PR opened above 10⁻³ (07:09:46 UTC): prefix restoration on the E8 complex word" },
  { pr: 391, who: "eumemic", h: 105.233, l2: -9.975, k: "9.9395e-4" },
  { pr: 392, who: "rohanarun", h: 105.293, l2: -9.965, k: "1.0002e-3" },
  { pr: 394, who: "chafreaky", h: 105.633, l2: -9.965, k: "1.0004e-3" },
  { pr: 395, who: "rohanarun", h: 105.692, l2: -9.964, k: "1.0013e-3" },
  { pr: 396, who: "rohanarun", h: 105.879, l2: -9.964, k: "1.0011e-3" },
  { pr: 398, who: "Dugongue", h: 105.968, l2: -9.962, k: "1.0025e-3" },
  { pr: 399, who: "chafreaky", h: 106.18, l2: -9.962, k: "1.0027e-3" },
  { pr: 400, who: "rohanarun", h: 106.447, l2: -9.962, k: "1.0027e-3" },
  { pr: 401, who: "Dugongue", h: 106.744, l2: -9.947, k: "1.0133e-3" },
  { pr: 402, who: "chafreaky", h: 107.089, l2: -9.947, k: "1.0134e-3" },
  { pr: 403, who: "rohanarun", h: 107.147, l2: -9.947, k: "1.0134e-3" },
  { pr: 404, who: "Dugongue", h: 107.278, l2: -9.942, k: "1.0164e-3" },
  { pr: 405, who: "rohanarun", h: 107.302, l2: -9.947, k: "1.0134e-3" },
  { pr: 406, who: "rohanarun", h: 107.442, l2: -9.942, k: "1.0165e-3" },
  { pr: 407, who: "chafreaky", h: 107.575, l2: -9.942, k: "1.0165e-3" },
  { pr: 408, who: "eumemic", h: 107.674, l2: -9.941, k: "1.017e-3" },
  { pr: 409, who: "rohanarun", h: 107.691, l2: -9.941, k: "1.0173e-3" },
  { pr: 410, who: "eumemic", h: 107.963, l2: -9.941, k: "1.0176e-3" },
  { pr: 411, who: "eumemic", h: 108.047, l2: -9.941, k: "1.0176e-3" },
  { pr: 412, who: "chafreaky", h: 108.195, l2: -9.94, k: "1.0178e-3" },
  { pr: 413, who: "rohanarun", h: 108.21, l2: -9.941, k: "1.0177e-3" },
  { pr: 414, who: "eumemic", h: 108.336, l2: -9.941, k: "1.0177e-3" },
  { pr: 415, who: "rohanarun", h: 108.353, l2: -9.94, k: "1.0178e-3" },
  { pr: 416, who: "eumemic", h: 108.409, l2: -9.94, k: "1.0178e-3" },
  { pr: 418, who: "rohanarun", h: 108.628, l2: -9.94, k: "1.0179e-3" },
  { pr: 419, who: "chafreaky", h: 108.668, l2: -9.94, k: "1.018e-3" },
  { pr: 420, who: "eumemic", h: 108.679, l2: -9.94, k: "1.0178e-3" },
  { pr: 421, who: "eumemic", h: 108.854, l2: -9.94, k: "1.0179e-3" },
  { pr: 422, who: "rohanarun", h: 108.865, l2: -9.939, k: "1.0185e-3" },
  { pr: 423, who: "eumemic", h: 108.934, l2: -9.94, k: "1.0183e-3" },
  { pr: 424, who: "chafreaky", h: 109.17, l2: -9.939, k: "1.0185e-3" },
  { pr: 425, who: "jacklightChen", h: 109.228, l2: -9.898, k: "1.048e-3", note: "Hamming packets replace the E8 complex circuit (783 → 680 helpers)" },
  { pr: 426, who: "ai-nanachi", h: 109.285, l2: -9.939, k: "1.0188e-3" },
  { pr: 427, who: "eumemic", h: 109.291, l2: -9.94, k: "1.0184e-3" },
  { pr: 428, who: "eumemic", h: 109.37, l2: -9.939, k: "1.0184e-3" },
  { pr: 429, who: "rohanarun", h: 109.467, l2: -9.938, k: "1.0196e-3" },
  { pr: 431, who: "rohanarun", h: 109.639, l2: -9.886, k: "1.057e-3" },
  { pr: 432, who: "chafreaky", h: 109.871, l2: -9.938, k: "1.0198e-3" },
  { pr: 433, who: "icekylinx", h: 109.916, l2: -9.801, k: "1.1209e-3", note: "split centres (complex) and source-centre reuse (bit)" },
  { pr: 434, who: "rohanarun", h: 110.346, l2: -9.792, k: "1.1283e-3", note: "opened at 1.1283e-3 (plotted); retitled to 1.2490e-3 after #442" },
  { pr: 435, who: "rohanarun", h: 110.356, l2: -9.791, k: "1.1288e-3" },
  { pr: 436, who: "eumemic", h: 110.364, l2: -9.791, k: "1.129e-3" },
  { pr: 437, who: "eumemic", h: 110.441, l2: -9.791, k: "1.1289e-3" },
  { pr: 438, who: "rohanarun", h: 110.606, l2: -9.785, k: "1.1335e-3" },
  { pr: 439, who: "chafreaky", h: 110.776, l2: -9.784, k: "1.1339e-3" },
  { pr: 440, who: "eumemic", h: 111.071, l2: -9.781, k: "1.1364e-3" },
  { pr: 441, who: "eumemic", h: 111.291, l2: -9.778, k: "1.1388e-3" },
  { pr: 442, who: "DaysSky", h: 111.316, l2: -9.658, k: "1.2376e-3", note: "idle-axis hosting: helper residuals ride on idle data arrays (+9.2%)" },
  { pr: 443, who: "chafreaky", h: 111.57, l2: -9.778, k: "1.1388e-3" },
  { pr: 444, who: "chafreaky", h: 111.894, l2: -9.648, k: "1.2461e-3" },
  { pr: 445, who: "chafreaky", h: 112.26, l2: -9.629, k: "1.2634e-3" },
  { pr: 447, who: "rohanarun", h: 112.442, l2: -9.626, k: "1.2658e-3" },
  { pr: 448, who: "higherbeing", h: 112.862, l2: -9.554, k: "1.3307e-3", contested: true, note: "cross-copy hosting; its key identity is challenged by #451's trace obstruction" },
  { pr: 450, who: "DreamingOfClouds", h: 113.042, l2: -9.535, k: "1.3477e-3", contested: true, note: "rests on #448's challenged cross-copy slot" },
  { pr: 451, who: "chafreaky", h: 113.115, l2: -9.626, k: "1.2659e-3" },
  { pr: 454, who: "chafreaky", h: 113.723, l2: -9.625, k: "1.2665e-3" },
  { pr: 455, who: "Dugongue", h: 114.196, l2: -9.625, k: "1.2665e-3" },
  { pr: 456, who: "rohanarun", h: 114.199, l2: -9.625, k: "1.2666e-3" },
  { pr: 457, who: "rohanarun", h: 114.248, l2: -9.625, k: "1.2663e-3" },
  { pr: 458, who: "chafreaky", h: 114.527, l2: -9.616, k: "1.274e-3" },
  { pr: 459, who: "rohanarun", h: 114.564, l2: -9.625, k: "1.2665e-3" },
  { pr: 460, who: "rohanarun", h: 114.708, l2: -9.616, k: "1.2744e-3" },
  { pr: 461, who: "Srikrishnabalaji", h: 114.835, l2: -9.616, k: "1.274e-3" },
  { pr: 462, who: "rohanarun", h: 114.956, l2: -9.616, k: "1.2745e-3" },
  { pr: 463, who: "DreamingOfClouds", h: 114.993, l2: -9.606, k: "1.2835e-3" },
  { pr: 464, who: "ahrazzle", h: 115.02, l2: -9.535, k: "1.3477e-3", contested: true, note: "rests on #448's challenged cross-copy slot" },
  { pr: 465, who: "Srikrishnabalaji", h: 115.147, l2: -9.606, k: "1.2835e-3" },
  { pr: 466, who: "rohanarun", h: 115.199, l2: -9.616, k: "1.2744e-3" },
  { pr: 467, who: "rohanarun", h: 115.29, l2: -9.599, k: "1.2893e-3", note: "Rohan Arun's 'new best', the best claim then that avoids the challenged cross-copy slot" },
  { pr: 469, who: "ahrazzle", h: 115.547, l2: -9.532, k: "1.3506e-3", contested: true, note: "rests on #448's challenged cross-copy slot" },
  { pr: 470, who: "rohanarun", h: 115.587, l2: -9.597, k: "1.2915e-3" },
  { pr: 471, who: "Dugongue", h: 115.726, l2: -9.616, k: "1.2745e-3" },
  { pr: 472, who: "chafreaky", h: 115.832, l2: -9.596, k: "1.2921e-3" },
  { pr: 473, who: "rohanarun", h: 116.049, l2: -9.592, k: "1.2956e-3" },
  { pr: 476, who: "Dugongue", h: 116.242, l2: -9.597, k: "1.2915e-3" },
  { pr: 478, who: "Dugongue", h: 116.526, l2: -9.592, k: "1.2955e-3" },
  { pr: 480, who: "higherbeing", h: 116.669, l2: -9.509, k: "1.3726e-3", contested: true, note: "highest claim of the day; rests on #448's challenged cross-copy slot" },
  { pr: 482, who: "eumemic", h: 117.316, l2: -9.741, k: "1.1689e-3" },
  { pr: 483, who: "Dugongue", h: 117.554, l2: -9.591, k: "1.2966e-3", note: "best claim at 19:40 UTC that avoids the challenged slot" },
  { pr: 490, who: "eumemic", h: 117.974, l2: -9.592, k: "1.2956e-3" },
  { pr: 491, who: "M6LI", h: 118.091, l2: -9.591, k: "1.2966e-3" },
  { pr: 492, who: "Dugongue", h: 118.126, l2: -9.59, k: "1.2974e-3" },
  { pr: 493, who: "eumemic", h: 118.157, l2: -9.583, k: "1.3035e-3" },
  { pr: 494, who: "higherbeing", h: 118.431, l2: -9.444, k: "1.4355e-3", contested: true, note: "computed on #448's challenged cross-copy supplier; its own title says 'not established'" },
  { pr: 495, who: "aliromman", h: 118.734, l2: -9.579, k: "1.307e-3" },
  { pr: 496, who: "eumemic", h: 118.951, l2: -9.552, k: "1.3321e-3" },
  { pr: 497, who: "chafreaky", h: 119.01, l2: -9.56, k: "1.3251e-3" },
  { pr: 498, who: "Dugongue", h: 119.434, l2: -9.585, k: "1.302e-3" },
  { pr: 499, who: "rosswaycaster", h: 119.536, l2: -9.427, k: "1.4529e-3", contested: true, note: "stacked on #494's cross-copy hosting" },
  { pr: 500, who: "rohanarun", h: 119.596, l2: -9.578, k: "1.3085e-3" },
  { pr: 501, who: "eumemic", h: 119.668, l2: -9.54, k: "1.3435e-3" },
  { pr: 502, who: "chafreaky", h: 119.692, l2: -9.54, k: "1.3435e-3" },
  { pr: 505, who: "Dugongue", h: 120.094, l2: -9.525, k: "1.3577e-3" },
  { pr: 506, who: "chafreaky", h: 120.554, l2: -9.512, k: "1.3696e-3" },
  { pr: 507, who: "eumemic", h: 120.555, l2: -9.518, k: "1.3636e-3" },
  { pr: 508, who: "Dugongue", h: 120.659, l2: -9.509, k: "1.3726e-3" },
  { pr: 512, who: "chafreaky", h: 121.097, l2: -9.493, k: "1.388e-3" },
  { pr: 514, who: "Dugongue", h: 121.377, l2: -9.489, k: "1.3915e-3" },
  { pr: 518, who: "Dugongue", h: 121.847, l2: -9.487, k: "1.3937e-3" },
  { pr: 522, who: "Dugongue", h: 122.418, l2: -9.478, k: "1.4022e-3" },
  { pr: 523, who: "icekylinx", h: 122.439, l2: -9.422, k: "1.4579e-3" },
  { pr: 527, who: "rohanarun", h: 122.926, l2: -9.413, k: "1.4673e-3" },
  { pr: 529, who: "chafreaky", h: 123.335, l2: -9.41, k: "1.4696e-3" },
  { pr: 531, who: "icekylinx", h: 123.415, l2: -9.364, k: "1.5178e-3" },
  { pr: 532, who: "Dugongue", h: 123.691, l2: -9.412, k: "1.468e-3" },
  { pr: 533, who: "chafreaky", h: 123.937, l2: -9.358, k: "1.5242e-3" },
  { pr: 534, who: "rohanarun", h: 124.127, l2: -9.356, k: "1.5262e-3" },
  { pr: 535, who: "icekylinx", h: 124.248, l2: -9.301, k: "1.5849e-3" },
  { pr: 536, who: "rohanarun", h: 124.265, l2: -9.352, k: "1.5303e-3" },
  { pr: 537, who: "Dugongue", h: 124.359, l2: -9.344, k: "1.5384e-3" },
  { pr: 538, who: "chafreaky", h: 124.523, l2: -9.352, k: "1.5303e-3" },
  { pr: 539, who: "rohanarun", h: 124.647, l2: -9.301, k: "1.5849e-3" },
  { pr: 541, who: "Dugongue", h: 125.007, l2: -9.299, k: "1.5872e-3" },
  { pr: 542, who: "rohanarun", h: 125.055, l2: -9.299, k: "1.5875e-3" },
  { pr: 543, who: "eumemic", h: 125.468, l2: -9.299, k: "1.5875e-3" },
  { pr: 544, who: "chafreaky", h: 125.495, l2: -9.298, k: "1.5886e-3" },
  { pr: 546, who: "rohanarun", h: 125.538, l2: -9.299, k: "1.5875e-3" },
  { pr: 547, who: "rohanarun", h: 125.634, l2: -9.296, k: "1.591e-3" },
  { pr: 548, who: "Dugongue", h: 125.755, l2: -9.296, k: "1.5906e-3" },
  { pr: 550, who: "eumemic", h: 126.384, l2: -9.296, k: "1.591e-3" },
  { pr: 551, who: "chafreaky", h: 126.559, l2: -9.295, k: "1.592e-3" },
  { pr: 552, who: "Dugongue", h: 126.588, l2: -9.295, k: "1.592e-3" },
  { pr: 554, who: "rohanarun", h: 126.663, l2: -9.296, k: "1.5912e-3" },
  { pr: 558, who: "eumemic", h: 127.163, l2: -9.294, k: "1.5925e-3" },
  { pr: 559, who: "rohanarun", h: 127.333, l2: -9.294, k: "1.5925e-3" },
  { pr: 560, who: "Dugongue", h: 127.636, l2: -9.295, k: "1.592e-3" },
  { pr: 561, who: "eumemic", h: 127.657, l2: -9.294, k: "1.5925e-3" },
  { pr: 562, who: "eumemic", h: 127.946, l2: -9.294, k: "1.5926e-3" },
  { pr: 563, who: "Dugongue", h: 128.132, l2: -9.294, k: "1.5926e-3" },
  { pr: 564, who: "eumemic", h: 128.273, l2: -9.294, k: "1.5931e-3" },
  { pr: 567, who: "jon314159", h: 129.944, l2: -9.293, k: "1.5937e-3" },
  { pr: 568, who: "jeremykothe2", h: 129.999, l2: -9.291, k: "1.5961e-3" },
  { pr: 569, who: "DominikScholz", h: 130.383, l2: -9.288, k: "1.6001e-3" },
  { pr: 571, who: "DominikScholz", h: 131.315, l2: -9.287, k: "1.6007e-3" },
  { pr: 572, who: "chafreaky", h: 131.565, l2: -9.287, k: "1.6005e-3" },
  { pr: 574, who: "jeremykothe2", h: 131.875, l2: -9.287, k: "1.6007e-3" },
  { pr: 575, who: "jon314159", h: 132.14, l2: -9.287, k: "1.6008e-3" },
  { pr: 576, who: "jeremykothe2", h: 132.267, l2: -9.287, k: "1.6011e-3" },
  { pr: 577, who: "chafreaky", h: 132.281, l2: -9.287, k: "1.6008e-3" },
  { pr: 578, who: "jeremykothe2", h: 132.609, l2: -9.287, k: "1.6012e-3" },
  { pr: 579, who: "chafreaky", h: 132.899, l2: -9.287, k: "1.6013e-3" },
  { pr: 582, who: "jeremykothe2", h: 133.599, l2: -9.286, k: "1.6015e-3" },
  { pr: 583, who: "chafreaky", h: 133.819, l2: -9.286, k: "1.6017e-3" },
  { pr: 584, who: "jeremykothe2", h: 134.163, l2: -9.286, k: "1.6021e-3" },
  { pr: 588, who: "jeremykothe2", h: 134.62, l2: -9.286, k: "1.6023e-3" },
  { pr: 591, who: "jeremykothe2", h: 136.18, l2: -9.279, k: "1.6099e-3" },
  { pr: 592, who: "jeremykothe2", h: 136.516, l2: -9.276, k: "1.6127e-3" },
  { pr: 596, who: "jeremykothe2", h: 137.395, l2: -9.276, k: "1.6127e-3" },
  { pr: 600, who: "jeremykothe2", h: 138.721, l2: -9.276, k: "1.6127e-3" },
  { pr: 601, who: "jeremykothe2", h: 139.184, l2: -9.275, k: "1.6142e-3" },
  { pr: 603, who: "jeremykothe2", h: 139.436, l2: -9.275, k: "1.6142e-3" },
  { pr: 604, who: "DreamingOfClouds", h: 139.528, l2: -9.269, k: "1.6213e-3" },
  { pr: 607, who: "jeremykothe2", h: 140.063, l2: -9.27, k: "1.6202e-3" },
  { pr: 608, who: "higherbeing", h: 140.163, l2: -9.276, k: "1.6136e-3" },
  { pr: 609, who: "jeremykothe2", h: 140.227, l2: -9.268, k: "1.6223e-3" },
  { pr: 610, who: "DreamingOfClouds", h: 140.259, l2: -9.265, k: "1.6254e-3" },
  { pr: 614, who: "jeremykothe2", h: 140.971, l2: -9.265, k: "1.6257e-3" },
  { pr: 615, who: "jeremykothe2", h: 141.186, l2: -9.264, k: "1.626e-3" },
  { pr: 616, who: "chafreaky", h: 141.45, l2: -9.265, k: "1.6257e-3" },
  { pr: 617, who: "jeremykothe2", h: 142.035, l2: -9.256, k: "1.6352e-3" },
  { pr: 618, who: "jeremydiviney", h: 142.341, l2: -9.265, k: "1.6254e-3" },
  { pr: 622, who: "jeremykothe2", h: 142.951, l2: -9.256, k: "1.6354e-3" },
  { pr: 623, who: "jeremykothe2", h: 143.461, l2: -9.256, k: "1.6355e-3" },
  { pr: 624, who: "jeremydiviney", h: 143.551, l2: -9.256, k: "1.6354e-3" },
  { pr: 625, who: "jeremykothe2", h: 143.692, l2: -9.256, k: "1.6355e-3" },
  { pr: 626, who: "chafreaky", h: 143.888, l2: -9.256, k: "1.6355e-3" },
  { pr: 627, who: "jeremydiviney", h: 144.649, l2: -9.256, k: "1.6357e-3" },
  { pr: 629, who: "jeremykothe2", h: 145.098, l2: -9.256, k: "1.6358e-3" },
  { pr: 632, who: "chafreaky", h: 145.266, l2: -9.256, k: "1.6359e-3" },
  { pr: 635, who: "jeremykothe2", h: 145.699, l2: -9.255, k: "1.6362e-3" },
  { pr: 636, who: "vectorsss", h: 145.861, l2: -9.255, k: "1.6363e-3" },
  { pr: 637, who: "jeremykothe2", h: 145.948, l2: -9.255, k: "1.6364e-3" },
  { pr: 638, who: "vectorsss", h: 146.226, l2: -9.255, k: "1.6365e-3" },
  { pr: 639, who: "vectorsss", h: 146.434, l2: -9.255, k: "1.6365e-3" },
  { pr: 640, who: "vectorsss", h: 146.597, l2: -9.255, k: "1.6365e-3" },
  { pr: 641, who: "jeremykothe2", h: 146.608, l2: -9.255, k: "1.6365e-3" },
  { pr: 642, who: "vectorsss", h: 146.678, l2: -9.255, k: "1.6365e-3" },
  { pr: 643, who: "jeremykothe2", h: 146.969, l2: -9.255, k: "1.6365e-3" },
  { pr: 644, who: "vectorsss", h: 147.188, l2: -9.255, k: "1.6366e-3" },
  { pr: 645, who: "icekylinx", h: 147.219, l2: -9.244, k: "1.6495e-3" },
  { pr: 648, who: "jeremykothe2", h: 147.458, l2: -9.242, k: "1.6511e-3" },
  { pr: 649, who: "jeremykothe2", h: 147.616, l2: -9.241, k: "1.6525e-3" },
  { pr: 652, who: "jeremykothe2", h: 147.694, l2: -9.241, k: "1.6528e-3" },
  { pr: 653, who: "jaymosley07", h: 147.865, l2: -9.241, k: "1.6527e-3" },
  { pr: 654, who: "GamingPuzzled", h: 148.013, l2: -9.242, k: "1.6514e-3" },
  { pr: 655, who: "jeremykothe2", h: 148.217, l2: -9.24, k: "1.654e-3" },
  { pr: 656, who: "jeremykothe2", h: 148.253, l2: -9.24, k: "1.6541e-3" },
  { pr: 658, who: "jeremydiviney", h: 148.583, l2: -9.24, k: "1.6542e-3" },
  { pr: 659, who: "jeremykothe2", h: 148.935, l2: -9.238, k: "1.6562e-3" },
  { pr: 660, who: "chafreaky", h: 148.939, l2: -9.24, k: "1.6543e-3" },
  { pr: 664, who: "jeremykothe2", h: 149.291, l2: -9.236, k: "1.6586e-3" },
  { pr: 671, who: "jeremykothe2", h: 149.515, l2: -9.236, k: "1.6587e-3" },
  { pr: 676, who: "jeremykothe2", h: 149.732, l2: -9.235, k: "1.6593e-3" },
  { pr: 685, who: "chafreaky", h: 150.048, l2: -9.234, k: "1.6603e-3" },
  { pr: 699, who: "jeremykothe2", h: 150.396, l2: -9.234, k: "1.6607e-3" },
  { pr: 741, who: "chafreaky", h: 151.021, l2: -9.234, k: "1.6612e-3" },
  { pr: 799, who: "jeremykothe2", h: 151.83, l2: -9.233, k: "1.6616e-3" },
  { pr: 869, who: "jeremykothe2", h: 154.188, l2: -9.233, k: "1.6619e-3" },
  { pr: 870, who: "jeremykothe2", h: 154.580, l2: -9.233, k: "1.6620e-3" },
  { pr: 890, who: "chafreaky", h: 156.973, l2: -9.233, k: "1.6620e-3" },
  { pr: 942, who: "jon314159", h: 159.781, l2: -9.233, k: "1.6620e-3" },
  { pr: 962, who: "GamingPuzzled", h: 160.188, l2: -9.233, k: "1.6620e-3" },
  { pr: 1004, who: "jeremykothe2", h: 161.838, l2: -9.231, k: "1.6642e-3" },
  { pr: 1005, who: "jeremykothe2", h: 162.311, l2: -9.225, k: "1.6714e-3" },
  { pr: 1030, who: "AlexS-scale", h: 162.500, l2: -9.233, k: "1.6620e-3" },
  { pr: 1019, who: "1337isnot1337", h: 162.694, l2: -9.233, k: "1.6620e-3" },
  { pr: 1022, who: "jeremykothe2", h: 162.787, l2: -9.224, k: "1.6721e-3" },
  { pr: 1028, who: "jeremykothe2", h: 162.903, l2: -9.224, k: "1.6722e-3" },
  { pr: 1031, who: "jeremykothe2", h: 162.956, l2: -9.224, k: "1.6722e-3" },
  { pr: 1072, who: "davidNbreslauer", h: 163.019, l2: -9.233, k: "1.6620e-3" },
  { pr: 1042, who: "jeremykothe2", h: 163.102, l2: -9.224, k: "1.6722e-3" },
  { pr: 1050, who: "jeremykothe2", h: 163.207, l2: -9.224, k: "1.6722e-3" },
  { pr: 1148, who: "tomdif", h: 163.265, l2: -9.221, k: "1.6756e-3" },
  { pr: 1053, who: "jeremykothe2", h: 163.281, l2: -9.224, k: "1.6722e-3" },
  { pr: 1055, who: "jeremykothe2", h: 163.319, l2: -9.224, k: "1.6723e-3" },
  { pr: 1056, who: "rohanarun", h: 163.392, l2: -9.224, k: "1.6723e-3" },
  { pr: 1061, who: "jeremykothe2", h: 163.418, l2: -9.224, k: "1.6726e-3" },
  { pr: 1065, who: "jeremykothe2", h: 163.495, l2: -9.224, k: "1.6726e-3" },
  { pr: 1063, who: "rohanarun", h: 163.539, l2: -9.224, k: "1.6723e-3" },
  { pr: 1068, who: "jeremykothe2", h: 163.560, l2: -9.224, k: "1.6727e-3" },
  { pr: 987, who: "rohanarun", h: 163.640, l2: -9.233, k: "1.6620e-3" },
  { pr: 1018, who: "jeremykothe2", h: 163.640, l2: -9.224, k: "1.6717e-3" },
  { pr: 1074, who: "jeremykothe2", h: 163.683, l2: -9.224, k: "1.6727e-3" },
  { pr: 1087, who: "jeremykothe2", h: 163.851, l2: -9.224, k: "1.6727e-3" },
  { pr: 1082, who: "rohanarun", h: 163.855, l2: -9.224, k: "1.6727e-3" },
  { pr: 1090, who: "1337isnot1337", h: 163.949, l2: -9.224, k: "1.6724e-3" },
  { pr: 1094, who: "rohanarun", h: 164.109, l2: -9.224, k: "1.6727e-3" },
  { pr: 1104, who: "jeremykothe2", h: 164.224, l2: -9.224, k: "1.6727e-3" },
  { pr: 1107, who: "jeremykothe2", h: 164.299, l2: -9.224, k: "1.6728e-3" },
  { pr: 1111, who: "seslly", h: 164.381, l2: -9.224, k: "1.6728e-3" },
  { pr: 1117, who: "jeremykothe2", h: 164.502, l2: -9.223, k: "1.6728e-3" },
  { pr: 1121, who: "jeremykothe2", h: 164.604, l2: -9.223, k: "1.6730e-3" },
  { pr: 1124, who: "jeremykothe2", h: 164.659, l2: -9.223, k: "1.6730e-3" },
  { pr: 1129, who: "aliromman", h: 164.706, l2: -9.222, k: "1.6741e-3" },
  { pr: 1130, who: "jeremykothe2", h: 164.761, l2: -9.223, k: "1.6730e-3" },
  { pr: 1131, who: "chafreaky", h: 164.806, l2: -9.222, k: "1.6741e-3" },
  { pr: 1172, who: "midhatn", h: 165.141, l2: -9.224, k: "1.6728e-3" },
  { pr: 1152, who: "chafreaky", h: 165.168, l2: -9.222, k: "1.6743e-3" },
  { pr: 1150, who: "rohanarun", h: 165.173, l2: -9.224, k: "1.6727e-3" },
  { pr: 1154, who: "Dugongue", h: 165.227, l2: -9.223, k: "1.6733e-3" },
  { pr: 1157, who: "rohanarun", h: 165.314, l2: -9.222, k: "1.6741e-3" },
  { pr: 1169, who: "rohanarun", h: 165.461, l2: -9.221, k: "1.6756e-3" },
  { pr: 1364, who: "GamingPuzzled", h: 165.526, l2: -9.222, k: "1.6751e-3" },
  { pr: 1176, who: "Dugongue", h: 165.680, l2: -9.221, k: "1.6752e-3" },
  { pr: 1178, who: "rohanarun", h: 165.745, l2: -9.221, k: "1.6752e-3" },
  { pr: 1204, who: "GamingPuzzled", h: 165.775, l2: -9.221, k: "1.6756e-3" },
  { pr: 1183, who: "rohanarun", h: 165.801, l2: -9.221, k: "1.6756e-3" },
  { pr: 1193, who: "jeremydiviney", h: 165.874, l2: -9.221, k: "1.6758e-3" },
  { pr: 1196, who: "chafreaky", h: 165.920, l2: -9.221, k: "1.6756e-3" },
  { pr: 1192, who: "rohanarun", h: 165.921, l2: -9.221, k: "1.6757e-3" },
  { pr: 1195, who: "mdumitrean", h: 165.930, l2: -9.221, k: "1.6757e-3" },
  { pr: 1201, who: "rohanarun", h: 166.013, l2: -9.221, k: "1.6758e-3" },
  { pr: 1225, who: "rohanarun", h: 166.080, l2: -9.221, k: "1.6756e-3" },
  { pr: 1207, who: "rohanarun", h: 166.156, l2: -9.221, k: "1.6758e-3" },
  { pr: 1239, who: "GamingPuzzled", h: 166.284, l2: -9.221, k: "1.6758e-3" },
  { pr: 1218, who: "rohanarun", h: 166.342, l2: -9.221, k: "1.6758e-3" },
  { pr: 1268, who: "jeremykothe2", h: 167.379, l2: -9.221, k: "1.6760e-3" },
  { pr: 1274, who: "jeremykothe2", h: 167.494, l2: -9.221, k: "1.6761e-3" },
  { pr: 1280, who: "jeremykothe2", h: 167.586, l2: -9.220, k: "1.6764e-3" },
  { pr: 1286, who: "rohanarun", h: 167.751, l2: -9.220, k: "1.6763e-3" },
  { pr: 1297, who: "rohanarun", h: 167.954, l2: -9.220, k: "1.6769e-3" },
  { pr: 1305, who: "jeremykothe2", h: 168.205, l2: -9.220, k: "1.6772e-3" },
  { pr: 1319, who: "rohanarun", h: 168.603, l2: -9.220, k: "1.6769e-3" },
  { pr: 1324, who: "jeremykothe2", h: 168.634, l2: -9.220, k: "1.6774e-3" },
  { pr: 1377, who: "jeremykothe2", h: 169.654, l2: -9.220, k: "1.6769e-3" },
  { pr: 1549, who: "midhatn", h: 172.764, l2: -9.220, k: "1.6769e-3" },
  { pr: 1574, who: "rohanarun", h: 173.220, l2: -9.220, k: "1.6769e-3" },
  { pr: 1582, who: "midhatn", h: 173.363, l2: -9.220, k: "1.6769e-3" },
  { pr: 1625, who: "mdumitrean", h: 174.285, l2: -9.220, k: "1.6769e-3" },
  { pr: 1644, who: "jeremykothe2", h: 174.588, l2: -9.220, k: "1.6769e-3" },
  { pr: 1640, who: "midhatn", h: 174.727, l2: -9.220, k: "1.6769e-3" },
  { pr: 1718, who: "Pseudoataraxia", h: 175.200, l2: -9.220, k: "1.6769e-3" },
  { pr: 1661, who: "midhatn", h: 175.611, l2: -9.220, k: "1.6769e-3" },
  { pr: 1672, who: "jeremykothe2", h: 176.119, l2: -9.220, k: "1.6769e-3" },
  { pr: 1673, who: "Vlado-V", h: 176.228, l2: -9.220, k: "1.6772e-3" },
  { pr: 1677, who: "midhatn", h: 176.437, l2: -9.220, k: "1.6769e-3" },
  { pr: 1681, who: "jeremykothe2", h: 176.532, l2: -9.220, k: "1.6772e-3" },
  { pr: 1683, who: "jeremykothe2", h: 176.756, l2: -9.220, k: "1.6772e-3" },
  { pr: 1688, who: "jeremykothe2", h: 177.042, l2: -9.220, k: "1.6773e-3" },
  { pr: 1692, who: "midhatn", h: 177.222, l2: -9.220, k: "1.6769e-3" },
  { pr: 1699, who: "chafreaky", h: 177.345, l2: -9.219, k: "1.6776e-3" },
  { pr: 1712, who: "jeremykothe2", h: 177.499, l2: -9.219, k: "1.6776e-3" },
  { pr: 1721, who: "jeremykothe2", h: 177.841, l2: -9.219, k: "1.6778e-3" },
  { pr: 1724, who: "midhatn", h: 177.972, l2: -9.220, k: "1.6769e-3" },
  { pr: 1725, who: "jeremykothe2", h: 177.978, l2: -9.219, k: "1.6780e-3" },
  { pr: 1731, who: "jeremykothe2", h: 178.079, l2: -9.219, k: "1.6781e-3" },
  { pr: 1754, who: "jeremykothe2", h: 178.712, l2: -9.219, k: "1.6783e-3" },
  { pr: 1758, who: "jeremykothe2", h: 178.917, l2: -9.218, k: "1.6797e-3" },
  { pr: 1786, who: "chafreaky", h: 179.928, l2: -9.218, k: "1.6798e-3" },
  { pr: 1789, who: "midhatn", h: 180.026, l2: -9.219, k: "1.6780e-3" },
  { pr: 1175, who: "gvconly", h: 180.242, l2: -9.221, k: "1.6753e-3" },
  { pr: 1800, who: "jeremykothe2", h: 180.277, l2: -9.218, k: "1.6798e-3" },
  { pr: 1839, who: "jeremykothe2", h: 181.816, l2: -9.218, k: "1.6798e-3" },
  { pr: 1875, who: "rohanarun", h: 182.870, l2: -9.218, k: "1.6798e-3" },
  { pr: 1904, who: "jeremykothe2", h: 183.613, l2: -9.218, k: "1.6798e-3" },
  { pr: 1905, who: "jeremykothe2", h: 183.653, l2: -9.218, k: "1.6798e-3" },
  { pr: 1928, who: "jeremykothe2", h: 183.911, l2: -9.218, k: "1.6798e-3" },
  { pr: 2044, who: "jeremykothe2", h: 186.819, l2: -9.218, k: "1.6798e-3" },
  { pr: 2161, who: "dataisfire", h: 191.448, l2: -9.218, k: "1.6798e-3" },
  { pr: 2180, who: "dataisfire", h: 192.404, l2: -9.218, k: "1.6798e-3" },
  { pr: 2220, who: "jeremykothe2", h: 194.005, l2: -9.218, k: "1.6798e-3" },
  { pr: 2260, who: "Dugongue", h: 196.564, l2: -9.217, k: "1.6805e-3" },
  { pr: 2269, who: "jeremykothe2", h: 196.909, l2: -9.203, k: "1.6962e-3" },
  { pr: 2265, who: "DreamingOfClouds", h: 196.948, l2: -9.214, k: "1.6834e-3" },
  { pr: 2281, who: "jeremykothe2", h: 197.294, l2: -9.203, k: "1.6962e-3" },
  { pr: 2284, who: "Dugongue", h: 197.429, l2: -9.214, k: "1.6836e-3" },
  { pr: 2288, who: "jeremykothe2", h: 197.632, l2: -9.203, k: "1.6963e-3" },
  { pr: 2302, who: "jeremykothe2", h: 198.201, l2: -9.203, k: "1.6964e-3" },
  { pr: 2309, who: "Dugongue", h: 198.504, l2: -9.203, k: "1.6965e-3" },
  { pr: 2312, who: "jeremykothe2", h: 198.792, l2: -9.203, k: "1.6969e-3" },
  { pr: 2322, who: "Vlado-V", h: 199.235, l2: -9.203, k: "1.6971e-3" },
  { pr: 2349, who: "jeremykothe2", h: 200.076, l2: -9.203, k: "1.6971e-3" },
  { pr: 2363, who: "mason-hale", h: 200.636, l2: -9.203, k: "1.6971e-3" },
  { pr: 2374, who: "jeremykothe2", h: 200.853, l2: -9.203, k: "1.6972e-3" },
  { pr: 2435, who: "jeremykothe2", h: 203.648, l2: -9.202, k: "1.6985e-3" },
  { pr: 2530, who: "zxv", h: 204.213, l2: -9.189, k: "1.7137e-3" },
  { pr: 2447, who: "jeremykothe2", h: 204.724, l2: -9.202, k: "1.6985e-3" },
  { pr: 2462, who: "jeremykothe2", h: 205.364, l2: -9.197, k: "1.7036e-3" },
  { pr: 2474, who: "jeremykothe2", h: 205.949, l2: -9.197, k: "1.7037e-3" },
  { pr: 2526, who: "jeremykothe2", h: 207.556, l2: -9.197, k: "1.7037e-3" },
  { pr: 2559, who: "philippeVV", h: 207.969, l2: -9.196, k: "1.7044e-3" },
  { pr: 2169, who: "philippeVV", h: 208.028, l2: -9.223, k: "1.6736e-3" },
  { pr: 2571, who: "rohanarun", h: 208.874, l2: -9.189, k: "1.7138e-3" },
  { pr: 2575, who: "jeremykothe2", h: 208.883, l2: -9.189, k: "1.7139e-3" },
  { pr: 2588, who: "jeremykothe2", h: 209.365, l2: -9.188, k: "1.7143e-3" },
  { pr: 2621, who: "themilkman216", h: 209.365, l2: -9.188, k: "1.7143e-3" },
  { pr: 2679, who: "philippeVV", h: 209.758, l2: -9.188, k: "1.7149e-3" },
  { pr: 2673, who: "jeremykothe2", h: 210.788, l2: -9.188, k: "1.7146e-3" },
  { pr: 2733, who: "mdumitrean", h: 211.397, l2: -9.187, k: "1.7163e-3" },
  { pr: 2696, who: "mason-hale", h: 211.664, l2: -9.187, k: "1.7156e-3" },
  { pr: 2745, who: "jeremykothe2", h: 213.527, l2: -9.187, k: "1.7161e-3" },
  { pr: 2751, who: "tekuuu", h: 214.075, l2: -9.186, k: "1.7171e-3" },
  { pr: 2767, who: "jeremykothe2", h: 214.692, l2: -9.186, k: "1.7173e-3" },
  { pr: 2766, who: "DavidAriasC", h: 214.885, l2: -9.186, k: "1.7173e-3" },
  { pr: 2802, who: "mdumitrean", h: 216.193, l2: -9.185, k: "1.7178e-3" },
  { pr: 2818, who: "jeremykothe2", h: 217.507, l2: -9.185, k: "1.7178e-3" },
  { pr: 2824, who: "Dugongue", h: 217.968, l2: -9.185, k: "1.7178e-3" },
  { pr: 2827, who: "Dugongue", h: 218.425, l2: -9.185, k: "1.7178e-3" },
  { pr: 2833, who: "jeremykothe2", h: 218.831, l2: -9.185, k: "1.7187e-3" },
  { pr: 2843, who: "mdumitrean", h: 218.978, l2: -9.185, k: "1.7187e-3" },
  { pr: 2848, who: "Lyy-iiis", h: 220.356, l2: -9.185, k: "1.7187e-3" },
  { pr: 2856, who: "mdumitrean", h: 220.528, l2: -9.184, k: "1.7194e-3" },
  { pr: 2852, who: "dataisfire", h: 220.823, l2: -9.185, k: "1.7187e-3" },
  { pr: 2853, who: "philippeVV", h: 220.836, l2: -9.184, k: "1.7194e-3" },
  { pr: 2857, who: "Lyy-iiis", h: 221.837, l2: -9.183, k: "1.7201e-3" },
  { pr: 2863, who: "Dugongue", h: 222.761, l2: -9.183, k: "1.7201e-3" },
  { pr: 2894, who: "jeremykothe2", h: 225.549, l2: -9.183, k: "1.7202e-3", note: "commit predates my 10:15 UTC look on Oct 16, but it was not on the chart then; since closed" },
  { pr: 2908, who: "jeremydiviney", h: 228.109, l2: -9.183, k: "1.7204e-3", note: "commit predates my 10:15 UTC look on Oct 16, but it was not on the chart then" },
  { pr: 2917, who: "mason-hale", h: 228.862, l2: -9.182, k: "1.7216e-3" },
  { pr: 2930, who: "mdumitrean", h: 230.299, l2: -9.181, k: "1.7225e-3" },
  { pr: 2942, who: "mdumitrean", h: 231.161, l2: -9.181, k: "1.7228e-3" },
  { pr: 2948, who: "jeremykothe2", h: 231.388, l2: -9.181, k: "1.7234e-3" },
  { pr: 2957, who: "jeremykothe2", h: 231.986, l2: -9.180, k: "1.7237e-3" },
  { pr: 2966, who: "jeremykothe2", h: 232.462, l2: -9.180, k: "1.7240e-3" },
  { pr: 2969, who: "Dugongue", h: 233.003, l2: -9.180, k: "1.7240e-3" },
  { pr: 2979, who: "mdumitrean", h: 233.981, l2: -9.176, k: "1.7290e-3", note: "joint rank-7 end frames; +0.29% over #2969, the day's one real jump" },
  { pr: 3015, who: "jeremykothe2", h: 235.442, l2: -9.176, k: "1.7292e-3" },
  { pr: 3157, who: "rohanarun", h: 236.897, l2: -9.176, k: "1.7292e-3" },
  { pr: 3042, who: "dcharb78", h: 238.239, l2: -9.175, k: "1.7297e-3" },
  { pr: 3051, who: "jeremydiviney", h: 238.868, l2: -9.175, k: "1.7297e-3" },
  { pr: 3064, who: "dataisfire", h: 239.583, l2: -9.175, k: "1.7297e-3" },
  { pr: 3115, who: "dataisfire", h: 244.771, l2: -9.175, k: "1.7297e-3" },
  { pr: 3133, who: "dcharb78", h: 248.914, l2: -9.175, k: "1.7298e-3" },
  { pr: 3143, who: "Gonzalo-Mier", h: 250.088, l2: -9.175, k: "1.7298e-3" },
  { pr: 3148, who: "jeremydiviney", h: 251.483, l2: -9.175, k: "1.7298e-3", note: "T740 packing cap on #3133's words; overtaken by the staged T360 line (#3682) at 12:33 UTC on Oct 18" },
  { pr: 3184, who: "rohanarun", h: 257.371, l2: -9.175, k: "1.7302e-3", contested: true, note: "idle rank-48 star exchanges, idea credited to OpenCode; #3187 gives an exact operator counterexample 25 minutes later" },
  { pr: 3190, who: "rohanarun", h: 258.164, l2: -9.172, k: "1.7334e-3", contested: true, note: "bit-bound; inherits #3184's refuted idle move" },
  { pr: 3198, who: "rohanarun", h: 258.874, l2: -9.171, k: "1.7348e-3", contested: true, note: "R438 bit supplier; inherits #3184's refuted idle move" },
  { pr: 3200, who: "rohanarun", h: 259.175, l2: -9.171, k: "1.7348e-3", contested: true, note: "inherits #3184's refuted idle move" },
  { pr: 3251, who: "rohanarun", h: 260.834, l2: -9.171, k: "1.7348e-3", contested: true, note: "exact per-group idle-donor search on #3200 (+8.75e-9); #3263 gives an exact operator counterexample an hour later" },
  { pr: 3682, who: "zxv", h: 278.552, l2: -9.175, k: "1.7304e-3", note: "staged T360 supplier, retimed donor releases; already past #3148, missed on Oct 19 because the title states no number" },
  { pr: 3734, who: "dataisfire", h: 285.134, l2: -9.175, k: "1.7304e-3", note: "helper544 staged across a returning producer" },
  { pr: 3945, who: "Dugongue", h: 295.778, l2: -9.174, k: "1.7307e-3", note: "26 helper ends widened into idle rank-1 slots" },
  { pr: 4076, who: "rohanarun", h: 303.569, l2: -9.174, k: "1.7308e-3", note: "three staged helper entries, LP-exact T360 fill" },
  { pr: 4085, who: "zxv", h: 305.89, l2: -9.174, k: "1.7310e-3", note: "receiver sharing on the staged T360 supplier" },
  { pr: 4088, who: "1337isnot1337", h: 306.511, l2: -9.174, k: "1.7310e-3", note: "mixed fourth staged entry" },
  { pr: 4181, who: "rohanarun", h: 325.371, l2: -9.174, k: "1.7310e-3", note: "attains #4091's proved pooled ceiling for these words: the second wall" },
  { pr: 4359, who: "zxv", h: 352.343, l2: -8.764, k: "2.3000e-3", note: "productive helper jobs: helpers keep their completed transforms as output; +32.87% over #4181" },
  { pr: 4405, who: "1337isnot1337", h: 354.749, l2: -8.761, k: "2.3051e-3" },
  { pr: 4412, who: "1337isnot1337", h: 355.111, l2: -8.657, k: "2.4776e-3", note: "native tensor strictification" },
  { pr: 4414, who: "1337isnot1337", h: 355.178, l2: -8.544, k: "2.6799e-3", note: "complete p6 native controller" },
  { pr: 4416, who: "1337isnot1337", h: 355.312, l2: -8.54, k: "2.6865e-3", note: "paid target padding; the maintainer's reviewed p7 checkpoint" },
  { pr: 4440, who: "1337isnot1337", h: 358.129, l2: -8.4, k: "2.9600e-3", note: "query-thinned productive controllers (+10.18%)" },
  { pr: 4441, who: "1337isnot1337", h: 358.412, l2: -8.38, k: "3.0011e-3", note: "query thinning plus helper retiming" },
  { pr: 4446, who: "1337isnot1337", h: 358.817, l2: -8.38, k: "3.0011e-3" },
  { pr: 4447, who: "1337isnot1337", h: 359.246, l2: -8.38, k: "3.0012e-3", note: "a missing three-dimensional contact span" },
  { pr: 4453, who: "zxv", h: 359.613, l2: -8.38, k: "3.0012e-3" },
  { pr: 4470, who: "1337isnot1337", h: 361.101, l2: -8.371, k: "3.0202e-3", note: "joint helper boundaries (+0.63% over #4447); selected by main at 12:16 UTC on Oct 22" },
  { pr: 4535, who: "hexapode", h: 366.302, l2: -8.371, k: "3.0202e-3", note: "critical-root transfer" },
  { pr: 4568, who: "hexapode", h: 369.168, l2: -8.371, k: "3.0202e-3" },
  { pr: 4610, who: "intqwq", h: 371.888, l2: -8.37, k: "3.0218e-3", note: "joint helper interfaces and Lean compiler bounds; the best open claim at 04:00 UTC on Oct 23" },
  { pr: 4626, who: "hexapode", h: 373.603, l2: -8.37, k: "3.0216e-3", note: "helper621 and a funded compiler gap" },
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
  {
    who: "Colkitt",
    h: 62.96,
    l2: -10.561,
    k: "6.61885549e-4",
    note: "PR #186 (Dugongue) imported into main · 27d82eb · shared-edge supplier, coordinated frames, completed entrance banks, reviewed",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/186",
    from: { h: 61.9, l2: -10.561 },
  },
  {
    who: "Colkitt",
    h: 88.14,
    l2: -10.433,
    k: "7.23571590007464e-4",
    note: "PR #279 (Rohan Arun) on PR #276's gen4 bit word · 91e29e7 · reviewed; #210's audited 7.10046e-4 imported alongside as a historical checkpoint",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/279",
    from: { h: 78.689, l2: -10.433 },
  },
  {
    who: "Colkitt",
    h: 123.927,
    l2: -9.364,
    k: "1.517760977820331e-3",
    note: "PR #531 (icekylinx) on #523, with eumemic's #493 bit word · a1e7d84 · direct delivery and source carriers, reviewed",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/531",
    from: { h: 123.415, l2: -9.364 },
  },
  {
    who: "Colkitt",
    h: 135.18,
    l2: -9.301,
    k: "1.584931111785787e-3",
    note: "PR #535 (icekylinx) with DreamingOfClouds' #510 bit word · 1c1e42f · post-center rank-four kernels; the bit side binds",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/535",
    from: { h: 124.248, l2: -9.301 },
  },
  {
    who: "Colkitt",
    h: 137.761,
    l2: -9.286,
    k: "1.602278921983212e-3",
    note: "PR #588 (Jeremy Kothe) with eumemic's #543 R420 bit word · 7f6ccd7 · a 43-PR review round",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/588",
    from: { h: 134.62, l2: -9.286 },
  },
  {
    who: "Colkitt",
    h: 139.011,
    l2: -9.276,
    k: "1.6127213726553e-3",
    note: "PR #596 (Jeremy Kothe) with #543 · 1db1fbe · hyperplane-ended helpers; the checkpoint Colkitt posted at 20:01 UTC",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/596",
    from: { h: 137.395, l2: -9.276 },
  },
  {
    who: "Colkitt",
    h: 143.029,
    l2: -9.256,
    k: "1.635183729255778e-3",
    note: "PR #617 (Jeremy Kothe) with #543 · 2e9ed96 · cold helper endpoints, 28 per word",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/617",
    from: { h: 142.035, l2: -9.256 },
  },
  {
    who: "Colkitt",
    h: 144.613,
    l2: -9.256,
    k: "1.635527380375392e-3",
    note: "PR #626 (Chafik Boukhalfa) on Jeremy Kothe's #622/#623 · 5c5567d · K-triangle helpers and owner repair",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/626",
    from: { h: 143.888, l2: -9.256 },
  },
  {
    who: "Colkitt",
    h: 152.176,
    l2: -9.234,
    k: "1.661202643272239e-3",
    note: "PR #741 (Chafik Boukhalfa) with DreamingOfClouds' #589 bit word · 2cdd93d · eight B-frame coalescences on the SW4 word",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/741",
    from: { h: 151.021, l2: -9.234 },
  },
  {
    who: "Colkitt",
    h: 152.739,
    l2: -9.233,
    k: "1.661634653669567e-3",
    note: "PR #799 (Jeremy Kothe) on #741 · d6dfd8f · four paired read exchanges; the best claim anywhere at 07:20 UTC on Oct 13",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/799",
    from: { h: 151.83, l2: -9.233 },
  },
  {
    who: "Colkitt",
    h: 159.508,
    l2: -9.233,
    k: "1.661957774647029e-3",
    note: "PR #890 (Chafik Boukhalfa) on Jeremy Kothe's U8 word · 3b83e4f · T21 whole-owner packing",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/890",
    from: { h: 156.973, l2: -9.233 },
  },
  {
    who: "Colkitt",
    h: 161.1,
    l2: -9.233,
    k: "1.661960547713947e-3",
    note: "PR #942 (Jonathan Capalbo) · 3825dc0 · the same word hosted across 37 replicas",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/942",
    from: { h: 159.781, l2: -9.233 },
  },
  {
    who: "Colkitt",
    h: 164.086,
    l2: -9.224,
    k: "1.672188119205421e-3",
    note: "PR #1042 (Jeremy Kothe) · 87db776 · mutable-leaver cells, seven triangle-hybrid slots and T16 owner packing",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/1042",
    from: { h: 163.102, l2: -9.224 },
  },
  {
    who: "Colkitt",
    h: 164.756,
    l2: -9.224,
    k: "1.672660197076918e-3",
    note: "PR #1094 (Rohan Arun) · 0a31ad8 · rare-pattern T16 exchanges; the selected record until 19:10 UTC on Oct 21",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/1094",
    from: { h: 164.109, l2: -9.224 },
  },
  {
    who: "Colkitt",
    h: 357.179,
    l2: -8.764,
    k: "0.0023",
    note: "PR #4359 (zxv) · ae87507 · productive helper jobs compiled into a uniform supplier",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/4359",
    from: { h: 352.343, l2: -8.764 },
  },
  {
    who: "Colkitt",
    h: 374.28,
    l2: -8.371,
    k: "0.00302015",
    note: "PR #4470 (Cinna Davis) · 4f19ced · joint helper boundaries; still the selected record at 04:02 UTC on Oct 23",
    merged: true,
    url: "https://github.com/CrocSwap/integer-mult-bounds/pull/4470",
    from: { h: 361.101, l2: -8.371 },
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
  { who: "Jain", h: 63.13, l2: -10.547, k: "6.6857e-4", note: "round 11 · dead-copy recycling, terminal sinks · Lean-checked arithmetic · led every claim for 19 minutes", lean: true, url: "https://x.com/SJ_Swapnil_Jain/status/2108544965630648526" },
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
  jeremykothe2: "oklch(0.62 0.2 350)",
}
const JAIN_COLOUR = "oklch(0.45 0.2 295)"
const OTHER = "oklch(0.60 0.04 260)"
const colour = (who: string) => (who === "Jain" ? JAIN_COLOUR : (PALETTE[who] ?? OTHER))

// Two chart geometries over the same data: the wide one for sm and up, and a
// narrow one for a phone column (~330 px), drawn near 1:1 so its type stays legible.
type Geo = { W: number; H: number; L: number; R: number; T: number; B: number; fs: number; narrow: boolean; clip: string }
const WIDE: Geo = { W: 680, H: 340, L: 48, R: 14, T: 14, B: 34, fs: 10, narrow: false, clip: "kappa-race-plot" }
const NARROW: Geo = { W: 340, H: 300, L: 46, R: 8, T: 14, B: 30, fs: 10.5, narrow: true, clip: "kappa-race-plot-narrow" }
// Two views: the whole race, and everything from 10:00 UTC on Oct 8, where everything after 2^-17 lives.
type View = { h0: number; h1: number; y0: number; y1: number }
const FULL: View = { h0: -0.5, h1: 390, y0: -190, y1: 0 }
const ZOOM: View = { h0: 36, h1: 390, y0: -17.5, y1: -8 }

// kappa = 10^-3, and the first PR opened above it: Dugongue's #390 at 07:09:46 UTC on Oct 11.
const MILLI = -9.965784284662087 // log2(10^-3), precomputed
const FIRST_MILLI = { h: 105.163, l2: -9.965 }

const EXTRA_A = { h: 15.933, l2: -78 }
const EXTRA_B = { h: 21.583, l2: -59 }
const SLOPE = (EXTRA_B.l2 - EXTRA_A.l2) / (EXTRA_B.h - EXTRA_A.h)
const HIT_ONE = EXTRA_B.h - EXTRA_B.l2 / SLOPE

const scales = (v: View, { W, H, L, R, T, B }: Geo) => ({
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
  const { inside } = scales(view, WIDE)

  const frontier: Pt[] = []
  let best = -Infinity
  for (const p of [...PRS].sort((a, b) => a.h - b.h)) {
    if (!p.contested && p.l2 > best) {
      best = p.l2
      frontier.push(p)
    }
  }
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
  const ticksY = zoom ? [-17, -16, -15, -14, -13, -12, -11, -10, -9, -8] : [-180, -150, -120, -90, -60, -30, 0]
  const ticksX = zoom
    ? [
        { h: 50, label: "Oct 9" },
        { h: 74, label: "Oct 10" },
        { h: 98, label: "Oct 11" },
        { h: 122, label: "Oct 12" },
        { h: 146, label: "Oct 13" },
        { h: 170, label: "Oct 14" },
        { h: 194, label: "Oct 15" },
        { h: 218, label: "Oct 16" },
        { h: 242, label: "Oct 17" },
        { h: 266, label: "Oct 18" },
        { h: 290, label: "Oct 19" },
        { h: 314, label: "Oct 20" },
        { h: 338, label: "Oct 21" },
        { h: 362, label: "Oct 22" },
      ]
    : [
        { h: 2, label: "Oct 7" },
        { h: 50, label: "Oct 9" },
        { h: 98, label: "Oct 11" },
        { h: 146, label: "Oct 13" },
        { h: 194, label: "Oct 15" },
        { h: 242, label: "Oct 17" },
        { h: 290, label: "Oct 19" },
        { h: 338, label: "Oct 21" },
      ]

  const chart = (g: Geo) => {
    const { W, H, L, R, T, B } = g
    const { x, y } = scales(view, g)
    const path = frontier.map((p, i) => (i === 0 ? `M${x(p.h)},${y(p.l2)}` : `H${x(p.h)}V${y(p.l2)}`)).join("")
    const jainPath = JAIN.map((p, i) => `${i === 0 ? "M" : "L"}${x(p.h)},${y(p.l2)}`).join("")
    const mainPath = MAIN.map((p, i) => (i === 0 ? `M${x(p.h)},${y(p.l2)}` : `H${x(p.h)}V${y(p.l2)}`)).join("") + `H${x(view.h1)}`
    return (
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className={g.narrow ? "mx-auto block w-full max-w-md sm:hidden" : "hidden w-full sm:block"}
        role="img"
        aria-label="Scatter of log base 2 of kappa against time. OpenAI's 2 to the minus 182 at the left, committed at 21:59 UTC on October 6; Colkitt's checkpoints climb to 2 to the minus 30 by 13:10 UTC on October 8; community pull requests climb from 2 to the minus 31 to about 2 to the minus 14.6 by 12:30 UTC, pause, climb to about 2 to the minus 14.2 by the evening and to 2 to the minus 13.9 by 22:40. After 23:00 a run of new constructions lifts them past 2 to the minus 13 at 00:24 UTC on October 9, to 2 to the minus 11.6 at 02:29 with the three-stage cover, to 2 to the minus 10.57 by 08:22, to 2 to the minus 10.51 by 18:38, to 2 to the minus 10.47 at 22:06 with the first five-stage claim, to 2 to the minus 10.40 by 07:10 UTC on October 10, to 2 to the minus 10.38 by 11:31, to 2 to the minus 10.30 by midnight and, with the E8 units, to 2 to the minus 10.16 at 05:05 UTC on October 11. A dotted line marks kappa equals 10 to the minus 3; the first pull request opened above it is number 390 at 07:09 UTC. The best claims reach 2 to the minus 9.60 at 17:17 with pull request 467 and 2 to the minus 9.59 by 19:33; hollow circles up to 2 to the minus 9.51 rest on a contested residual split. A red step line marks main: pull request 39 merged at 15:18 UTC at 2 to the minus 14.65, pull request 49 at 16:47, a reviewed batch at 18:36 at 2 to the minus 14.26, pull request 144 at 05:06 UTC on October 9 at 2 to the minus 11.08, pull request 186 at 12:57 UTC at 2 to the minus 10.56, and pull request 279 at 14:08 UTC on October 10 at 2 to the minus 10.43, where it still stood at 19:40 UTC on October 11. Then main moves eight times in under thirty-one hours: pull request 531 at 01:56 UTC on October 12 at 2 to the minus 9.36, pull request 535 at 13:11, pull request 588 at 15:46, pull request 596 at 17:01 at 2 to the minus 9.28, pull request 617 at 21:02, pull request 626 at 22:37, pull request 741 at 06:11 UTC on October 13 and pull request 799 at 06:44 at 2 to the minus 9.23. The open claims meanwhile run from 2 to the minus 9.59 through 2 to the minus 9.36 at 01:25 UTC on October 12 and reach 2 to the minus 9.23 with pull request 799, which main took fifty-five minutes after it opened, so at 07:20 UTC on October 13 the red and green lines meet. Main moves four more times that day, to 2 to the minus 9.224 with pull request 1094 at 18:45 UTC, stays there until 19:10 UTC on October 21, then jumps to 2 to the minus 8.764 with pull request 4359 and to 2 to the minus 8.371 with pull request 4470 at 12:16 UTC on October 22. The open claims stall near 2 to the minus 9.218 from 10:16 UTC on October 14, jump at 02:54 UTC on October 15 after anticipatory dirty borrowing to 2 to the minus 9.203, jump again at 10:12 with source-partner lifetimes to 2 to the minus 9.189, and creep to 2 to the minus 9.183 by 04:45 UTC on October 16, to 2 to the minus 9.180 by 15:00, jump with joint rank-seven end frames to 2 to the minus 9.176 at 15:59 and reach 2 to the minus 9.175 with pull request 3148 at 09:29 UTC on October 17. Five hollow circles from 15:22 to 18:50 UTC on October 17, up to 2 to the minus 9.171, rest on pull request 3184's idle-star move, which pull request 3187 refutes; pull request 3263 also refutes the last of them, pull request 3251. A staged line had already passed pull request 3148 at 12:33 UTC on October 18 and creeps to 2 to the minus 9.174 by October 20, where a proved ceiling stops it. At 14:20 UTC on October 21 pull request 4359, which counts helpers' completed transforms as output, jumps to 2 to the minus 8.764, and within nine hours a run of pull requests by Cinna Davis reaches 2 to the minus 8.371; the best open claim is 2 to the minus 8.370 on October 22. Two more hollow circles, near 2 to the minus 9.44, rest on the same contested split. Swapnil Jain's separate track, eleven diamonds joined by a line, runs from 2 to the minus 27.6 at 07:20 UTC on October 8 to 2 to the minus 10.67 at 09:50 UTC on October 9 and 2 to the minus 10.55 at 13:08; rounds five to eleven are ringed as Lean-kernel-checked arithmetic. A straight-line extrapolation through 2 to the minus 78 and 2 to the minus 59 reaches kappa equals one at about 13:08 UTC on October 8. A zoom button shows everything from 10:00 UTC on October 8."
      >
        {ticksY.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={t === 0 ? 1.2 : 0.6} />
            <text x={L - 6} y={y(t) + 3} textAnchor="end" fontSize={g.fs} className="fill-muted-foreground font-mono">
              {t === 0 ? "κ=1" : `2^${t}`}
            </text>
          </g>
        ))}
        {(g.narrow ? ticksX.filter((_, i) => i % 2 === 0) : ticksX).map((t) => (
          <text key={t.h} x={x(t.h)} y={H - 12} textAnchor="middle" fontSize={g.fs} className="fill-muted-foreground font-mono">
            {t.label}
          </text>
        ))}
        <defs>
          <clipPath id={g.clip}>
            <rect x={L} y={T - 2} width={W - L - R} height={H - T - B + 4} />
          </clipPath>
        </defs>
        <g clipPath={`url(#${g.clip})`}>
        <line
          x1={L}
          x2={W - R}
          y1={y(MILLI)}
          y2={y(MILLI)}
          stroke="oklch(0.62 0.16 150)"
          strokeDasharray="1 3"
          strokeWidth={1.2}
        />
        {zoom ? (
          <text x={L + 4} y={y(MILLI) - 4} fontSize={g.fs} fill="oklch(0.55 0.16 150)" className="font-mono">
            κ = 10⁻³
          </text>
        ) : null}
        {zoom ? (
          <g>
            <line
              x1={x(FIRST_MILLI.h)}
              x2={x(FIRST_MILLI.h)}
              y1={y(FIRST_MILLI.l2) - 6}
              y2={y(FIRST_MILLI.l2) - (g.narrow ? 11 : 22)}
              stroke="oklch(0.55 0.16 150)"
              strokeWidth={1}
            />
            <text
              x={x(FIRST_MILLI.h) - 3}
              y={y(FIRST_MILLI.l2) - (g.narrow ? 14 : 25)}
              textAnchor="end"
              fontSize={g.fs}
              fill="oklch(0.55 0.16 150)"
              className="font-mono"
            >
              {g.narrow ? "#390 · first past 10⁻³" : "first PR past 10⁻³ · #390, Oct 11 07:09"}
            </text>
          </g>
        ) : null}
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
            {/* Below and right of where the line meets κ=1, in the empty space
                under the post-Oct-8 cluster. Left of the meeting point the label
                ran into Jain's ringed rounds and past the plot's left edge; the
                band above the cluster is too thin once the Lean rings are drawn. */}
            {g.narrow ? (
              <text x={x(HIT_ONE) + 14} y={y(0) + 44} fontSize={g.fs} fill="oklch(0.6 0.15 250)" className="font-mono">
                extrapolated: κ=1
                <tspan x={x(HIT_ONE) + 14} dy={g.fs * 1.25}>
                  at {stamp(HIT_ONE)}
                </tspan>
              </text>
            ) : (
              <text x={x(HIT_ONE) + 16} y={y(0) + 48} fontSize={g.fs} fill="oklch(0.6 0.15 250)" className="font-mono">
                extrapolated: κ=1 at {stamp(HIT_ONE)}
              </text>
            )}
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
        <text x={x(last.h) - 4} y={y(last.l2) + (zoom ? -10 : 22)} textAnchor="end" fontSize={g.fs} fill={PALETTE.Colkitt} className="font-mono">
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
          if (p.contested) {
            return (
              <circle
                key={i}
                cx={x(p.h)}
                cy={y(p.l2)}
                r={on ? 6 : 3.6}
                fill="var(--background)"
                stroke={on ? "var(--foreground)" : colour(p.who)}
                strokeWidth={on ? 2 : 1.4}
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
    )
  }

  return (
    <figure className="not-prose my-8 rounded-xl border border-border bg-card p-3 sm:p-4">
      <figcaption className="mb-2 font-mono text-xs text-muted-foreground">
        log₂ κ against time · every checkpoint and PR, each move of main, and Jain&apos;s eleven rounds, Oct 6 to 04:00 UTC on Oct 23
        {zoom ? " · zoomed to 10:00 UTC on Oct 8 onward" : ""}
      </figcaption>
      {chart(WIDE)}
      {chart(NARROW)}

      <div className="mt-2 rounded-md border border-border p-2 font-mono text-xs">
        <span style={{ color: colour(sel.who) }}>{sel.merged ? "■" : "●"}</span> {who} · {stamp(sel.h)} · κ = {sel.k} · log₂ κ = {sel.l2.toFixed(2)}
        {sel.note ? ` · ${sel.note}` : ""}
        {sel.contested && !sel.note ? " · contested" : ""}
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
          <span style={{ color: OTHER }}>○</span> rests on #448&apos;s cross-copy split, which #451 challenges, or on #3184&apos;s idle-star move, which #3187 refutes (left out of the green best-claim line)
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
