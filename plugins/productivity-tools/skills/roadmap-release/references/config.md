# release.config.json

Project-specific settings for `roadmap-release`, stored in the roadmap folder next to `roadmap.config.json`. Nothing project-specific lives in the workflow script.

## Contents

- Fields
- Gates
- Generated config
- Permission preflight
- Minimal example

## Fields

| Field | Required | Meaning |
|---|---|---|
| `projectContext` | yes | Project rules, pasted into every briefing. May be an empty string. |
| `install` | yes | Command that installs dependencies in a fresh worktree. Empty string when none is needed. |
| `setup` | no | Command or list of commands that prepare the environment in the preflight, such as starting services. |
| `beforeEvidence` | no | Command or list run before measuring gates that declare `needsLock` and before the acceptance evidence commands, such as recreating a database. Gates without a lock do not run it. |
| `gates` | yes | Non-empty list of gate objects, see below. |
| `locks` | no | Names of shared resources. Gates and tasks that declare `needsLock` serialize on them. |
| `conflictRules` | no | How to resolve conflicts in generated files. |
| `docsStage` | no | Instructions for the docs step: a string, or `{ instructions, measure?, paths? }`. `measure` is a Node script that prints `{"ok":true|false,"details":"..."}`; `paths` are doc prefixes (default `docs/`) whose changes alone skip the late-sync review. |
| `testIntegrity` | no | Own test-integrity Node script (receives the target branch as `argv[2]`, prints `{deletedTests, removedAsserts, skipsAdded, prodChanged, assertsAdded}`), or `false` to disable. A built-in script is the default. |
| `acceptRedBaseline` | no | Accept a red baseline instead of stopping the preflight. |
| `releaseBranch` | no | Target branch for the run. Order: `args.targetBranch`, this field, the roadmap's `releaseBranch` in `roadmap.config.json`, then `integracao/<slug>`. |
| `maxParallel` | no | Parallel deliverables. Default 3. Forced to 1 while `generated` is true. |
| `generated` | no | Set on derived configs. See "Generated config". |

## Gates

Each gate is `{ name, cmd, kind, needsLock?, invariant?, ignoreFailuresWhenChanged? }`.

- `name` is unique. `cmd` is the exact command.
- `kind` is `exit` (only the exit code matters, as for lint and build) or `tests` (an agent reads the output and returns `{ name, ran, exit, total, skipped, failedNames }`).
- `needsLock` is a lock name or a list of names. Each must appear in `locks`.
- `invariant` marks a project invariant, such as schema drift or migration policy. It has no baseline.
- `ignoreFailuresWhenChanged` describes exceptions, such as a smoke test that exercises old code.

A red baseline stops the preflight: an `exit` gate with a non-zero code, a `tests` gate with total zero, or a violated invariant, unless `acceptRedBaseline` is set. A `tests` gate with total zero fails on every deliverable even when accepted, so fix its command or set `kind: exit`. A gate is green when its failing names are a subset of the baseline and the counts do not drop.

## Generated config

When the file does not exist, `scripts/preflight.mjs` derives one from the strategy's `<!-- roadmap:gates -->` table (columns ID, Command, Environment, When, Baseline) and the project `CLAUDE.md`. Commands that name a test runner (such as `npm test`, `vitest`, `pytest`, `node --test`, `go test`) become `tests`; all others become `exit`. `install` comes from a lockfile at the repository root (for example `package-lock.json` gives `npm ci`); with none it stays empty and the preflight adds a `warnings` entry. The result carries `generated: true`, and the preflight prints it as `config` in its JSON. The script never writes it: persisting and committing the file on the target branch is the skill's job.

While `generated` is true the run uses `maxParallel: 1`, because an undetected shared resource would corrupt parallel runs. Review `locks` and `needsLock`, then remove the flag to release parallelism.

## Permission preflight

`node scripts/preflight.mjs <roadmap-folder> [--ref <target>]` prints `{ configPath, generated, errors, missingRules, warnings, config }` and exits 1 when `errors` is not empty. It reads `permissions.allow` from `~/.claude/settings.json`, `<repo>/.claude/settings.json` and `<repo>/.claude/settings.local.json`; a missing file counts as empty. When `CLAUDE_CONFIG_DIR` is set, the user file is read from there instead of `~/.claude`. Managed (enterprise) settings are not read. It never changes any of them. With `--ref <target>`, a `release.config.json` that exists on that ref is loaded, validated and used instead of regenerating (`generated` comes from its content); without it, the working tree and then derivation apply.

Required rules have the form `Bash(<first word>:*)` for every subcommand of every gate, `install`, `setup` and `beforeEvidence`, split on newline, `;`, `&`, `&&`, `|`, `||` and `|&` outside quotes (subshell parens dropped, `$(...)` and backtick contents required too), plus `Bash(git:*)` and `Bash(node:*)`, which the workflow always runs and which only the full rule covers. The `{verify: ...}` commands of the cards are not visible to the preflight: a command they need beyond these rules can still prompt during the run, so allow it beforehand. A rule is covered by `Bash`, `Bash(*)`, the rule itself, an exact `Bash(<command>)`, or a prefix rule such as `Bash(npm run:*)` that matches every command needing it. `Bash(git *)` and `Bash(git:*)` are treated as the same rule. If rules are missing in `run` mode, the skill stops once, before launching any agent, and shows the exact rules to add; in other modes it only reports them.

## Minimal example

```json
{
  "projectContext": "Run all commands from the repo root.",
  "install": "npm ci",
  "gates": [
    { "name": "lint", "cmd": "npm run lint", "kind": "exit" },
    { "name": "unit", "cmd": "npm test", "kind": "tests" }
  ],
  "locks": []
}
```
