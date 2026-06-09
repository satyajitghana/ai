---
name: amplify
description: Turn a published post/project/log into platform-native social drafts for ai.thesatyajit.com — an X/Twitter thread, a LinkedIn post, and Hashnode/dev.to crossposts. Use when Satyajit says "amplify", "promote", or "draft social for" a piece. Writes drafts to drafts/<date>/ and NEVER posts anything.
---

# amplify — draft cross-platform social

Turn one published piece into platform-native drafts. **NEVER post.** Everything is written to files under `drafts/<YYYY-MM-DD>/` for Satyajit to review and approve. There is no auto-posting path in this skill.

## Input
A content slug/path (blog/article/project/log/arxiv) or a topic. Read the source MDX and `brand-crew/brand/voice.md`. The canonical link is always back to the site: `https://ai.thesatyajit.com/<kind>/<slug>`.

## Outputs — create under `drafts/<today>/<slug>/`
- `x-thread.md` — a numbered X/Twitter thread (1/, 2/, …), hook first, code/numbers, canonical link in the last tweet. Respect ~280 chars/tweet.
- `linkedin.md` — a LinkedIn post (professional, slightly longer, no hashtag spam), canonical link at the end.
- `hashnode.md` — a dev crosspost with frontmatter-style title + tags + a `canonical:` line pointing to the site URL.
- `devto.md` — same as Hashnode, dev.to-flavored.

Each in Satyajit's voice: precise, engineer-first, dry wit, no marketing fluff, show the substance.

## Steps
1. Read the source piece + voice profile.
2. Create the four draft files under `drafts/<today>/<slug>/`.
3. Report the file paths and tell Satyajit nothing is posted — he reviews in the PR / `drafts/` and approves before anything goes out.

> `drafts/` is not site content, so no `pnpm validate` is needed unless you also edited `content/` or `data/`.
