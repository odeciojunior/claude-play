Copied from: plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js at commit 3fbb59b2c85f8f961678ca67e8b3de3d29d70e1a
Fix the plan {{artifactPath}} according to the review below and commit. Stop after the commit.
{{issues}}
Every ac of the evidence list is ONLY the criterion id (e.g. AC1), nothing else; if the review reports an ac mismatch, use exactly the expected id.
Return planPath, planBlob (output of git rev-parse HEAD:<planPath>, measured after the commit), roadmapHeader, ac (full list, each command copied verbatim from the file with a table-escaped | written as |, with external and externalDedupe) and tasks (full list, with files copied from the plan, noCommit (same rule as the plan stage), tier, reviewTier, needsLock, external and externalDedupe).
