Copied from: plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js at commit 9085b1756bb4edc9fe7eaaeecc792f9f6acbeb33
Fix the spec {{artifactPath}} according to the review below, in autonomous mode, and commit. Stop after the commit.
{{issues}}
Return specPath, slug (without the ID), decisions (full list), humanInputs (full list).
The spec ends with a json data block in the spec/1 schema, which must stay valid: run node "{{specTool}}" check "{{specAbs}}" --roadmap "{{rmAbs}}" before the commit, one simple command per call. Rulings are read from that block, never from your answer.
