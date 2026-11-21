---
paths:
  - "tools/measure/**"
---

# Measure Harness Rules

- **Directory isolation:** Always pass `--work` **outside** this repository (prevents dirtying the repo and stops sandboxed sessions from inheriting `claude-play`'s root `CLAUDE.md` and `.claude/rules/`). Any `--out` inside the repo must live under `tools/measure/out/` (gitignored; never commit session IDs, personal paths, or `private/` outputs).
- **Free tests vs. paid runs:** `node --test "tools/**/*.test.mjs"` is offline and free. Running `run-batch.mjs`, `run-baseline.mjs`, or `run-trigger.mjs` invokes real `claude -p` calls that cost money — require explicit owner authorization, set `--max-budget-usd`, and use an isolated disposable `--config-dir` (never run paid batches against the user's real Claude config).
- **Line endings & arm parity:** `.gitattributes` keeps `tools/measure/scenario/**` and `tools/measure/arms/**` LF (and the CRLF trigger fixture CRLF). `arms/*-atual.md` must match `roadmap-release.js` byte-for-byte or `checkpoint.mjs` marks the comparison inconclusive (`braço defasado`).
