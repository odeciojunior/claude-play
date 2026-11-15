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
| `projectContext` | yes | Project rules for every briefing. Prefer the one-line pointer the preflight derives (`Project rules: CLAUDE.md at the repository root (already in your context; if not, read it).`): the text is pasted into every agent prompt, about 40 per deliverable. May be an empty string. A committed file that holds the text of `CLAUDE.md` should get the pointer at its next review. |
| `install` | yes | Command that installs dependencies in a fresh worktree. Empty string when none is needed. |
| `setup` | no | Command or list of commands that prepare the environment in the preflight, such as starting services. |
| `beforeEvidence` | no | Command or list run before measuring gates that declare `needsLock` and before the acceptance evidence commands, such as recreating a database. Gates without a lock do not run it. |
| `taskReview` | no | Object with the optional boolean `restricted`, read with `=== true`; absent or any other value than `true` means false. `restricted` makes a re-review of a task read only the open findings and the fix diff, through the review package script. It is off by default (two loops, today's model). `single` (single review, E28) was removed in E29 after pass C: the preflight refuses the key with a message asking to delete it. The preflight also refuses a `taskReview` that is not an object, a `restricted` that is not a boolean and any other key, naming it. |
| `finalReview` | no | Object with the optional booleans `adversarial` and `singleWave`, each read with `=== true`; absent means both off. They are off by default and E27 decides turning them on. The preflight refuses a `finalReview` that is not an object, a value that is not a boolean and any other key, naming it. |
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

Each gate is `{ name, cmd, kind, needsLock?, invariant?, ignoreFailuresWhenChanged?, restricted? }`.

- `name` is unique. `cmd` is the exact command. A `restricted` gate's name must not contain spaces, because it becomes the `gate:<name>` authorization item; other gates may.
- `kind` is `exit` (only the exit code matters, as for lint and build) or `tests` (an agent reads the output and returns `{ name, ran, exit, total, skipped, failedNames }`).
- `needsLock` is a lock name or a list of names. Each must appear in `locks`.
- `invariant` marks a project invariant, such as schema drift or migration policy. It has no baseline.
- `ignoreFailuresWhenChanged` describes exceptions, such as a smoke test that exercises old code.
- `restricted` (optional boolean) marks a gate that touches a restricted environment. The derivation sets it from the strategy table's `Environment` and `When` cells, cell by cell, on lowercase tokens. A restriction mark (any token starting with `prod`, as `prod`, `prods`, `production`, `produção`, `produções`, `producao`, except words that are something else: `product*` (not `production`), `produto*`, `produtiv*`, `produce*`, `produz*`; a token starting with `staging`, `owner` or `dono`; or the phrase `release only`) in either cell makes the gate `restricted`, even beside a local word. A cell is free when it is empty, `-`, `—`, or has a local mark (`local`, `every`, `each`, `before`, `merge`, `task`, `cada`, `todo`, `antes`, `always`, `sempre`); the gate is free only when both cells are free. Anything else is `unknown`, which counts as restricted and adds a `warnings` entry; a free cell does not absolve the other one. A restricted gate stays in the config, needs no permission rule until it is authorized, and the preflight warns with the rule to add. A restricted gate only runs with `authorizeExternal: ["gate:<id>"]`. The preflight fails with `every gate is restricted` when all gates are restricted: it never sees an authorization, so it needs at least one gate that is not restricted (on one row of the gates table, leave no restriction mark and make both its `Environment` and `When` cells free; or set `restricted` to false). The unknown-cell warning names the cell to change: Environment, When, or both.

A red baseline stops the preflight: an `exit` gate with a non-zero code, a `tests` gate with total zero, or a violated invariant, unless `acceptRedBaseline` is set. An explicit `acceptRedBaseline` is honoured, but a `tests` gate with total zero fails any deliverable that adds no tests, so fix the gate or set `kind: exit`. A gate is green when its failing names are a subset of the baseline and the counts do not drop.

## Generated config

When the file does not exist, `scripts/preflight.mjs` derives one from the strategy's `<!-- roadmap:gates -->` table (columns ID, Command, Environment, When, Baseline). `projectContext` is a one-line pointer to the repository's `CLAUDE.md` when that file exists (its content is not copied), and empty otherwise; a hand-written config keeps its own text. Commands that name a test runner (such as `npm test`, `vitest`, `pytest`, `node --test`, `go test`) become `tests`; all others become `exit`. `install` comes from a lockfile at the repository root (for example `package-lock.json` gives `npm ci`); with none it stays empty and the preflight adds a `warnings` entry. The result carries `generated: true`, and the preflight prints it as `config` in its JSON. A row of that table with other than five columns is skipped and the preflight adds a `warnings` entry naming it (a pipe inside a cell is written `\|`). The block is found the way the roadmap checker finds it, so a malformed opening comment gives no rows. The script never writes it: persisting and committing the file on the target branch is the skill's job.

While `generated` is true the run uses `maxParallel: 1`, because an undetected shared resource would corrupt parallel runs. Review `locks` and `needsLock`, then remove the flag to release parallelism.

## Permission preflight

`node scripts/preflight.mjs <roadmap-folder> [--ref <target>] [--wt-root <path>]` prints `{ configPath, generated, errors, missingRules, warnings, config, runToken }` plus `missingDirs`, `trackerCli` and `pendingDecisions` (`runToken` is new on every call, never inside `config`; `trackerCli` is the absolute path of the tracker CLI, passed to the workflow; `pendingDecisions` are the executor decisions still pending on the target) and exits 1 when `errors` is not empty. It reads `permissions.allow` from `~/.claude/settings.json`, `<repo>/.claude/settings.json` and `<repo>/.claude/settings.local.json`; a missing file counts as empty. When `CLAUDE_CONFIG_DIR` is set, the user file is read from there instead of `~/.claude`. Managed (enterprise) settings are not read. It never changes any of them. With `--ref <target>`, a `release.config.json` that exists on that ref is loaded, validated and used instead of regenerating (`generated` comes from its content); without it, the working tree and then derivation apply. The preflight also adds to `warnings` the rule `Workflow(productivity-tools:release-workflow)` when none of the three settings has that rule or `Workflow` without content; it is only a warning (it never enters `missingRules` and never stops step 2), and the launch through the skill is granted by the skill's `allowed-tools` or by the "don't ask again" of the dialog; the rule is needed only to run without the interface (`claude -p`) or to launch outside the skill.

`--wt-root <path>` sets the folder where the workflow creates worktrees; the default is `<main checkout>-wt` (the sibling of the main checkout, derived from `git rev-parse --git-common-dir`, so it is the same when run from a linked worktree). The output also has `missingDirs` and `missingDirsHint`. `missingDirs` is `[<wtRoot>]` when no entry of `permissions.additionalDirectories` in the same three settings equals `wtRoot` or is an ancestor of it, or when `wtRoot` does not exist (Claude Code grants an additional directory only if it exists when the session starts, so a folder created mid-session stays denied; preflight never creates it); otherwise `[]`. `missingDirsHint` says what to do (create the folder before starting Claude Code, and/or add the entry), or is `null`. Only absolute entries count: a relative entry never covers `wtRoot`, because how Claude Code resolves it from a subfolder is unverified. Entries are compared with `/` separators, no trailing slash, `.`/`..` normalized, case-insensitive on Windows; `~` or `~/` always expands to home, in any settings file. A sibling such as `<repo>-wt2` does not cover `<repo>-wt`. Like `missingRules`, `missingDirs` never enters `errors` and never changes the exit code. Preflight cannot see `--add-dir`: state it with `--declare-permissions`. Without the folder granted, `--permission-mode acceptEdits` denies the agents' writes in `wtRoot` (DEC-719).

Required rules have the form `Bash(<first word>:*)` for every subcommand of every gate, `install`, `setup` and `beforeEvidence`, split on newline, `;`, `&`, `&&`, `|`, `||` and `|&` outside quotes (subshell parens dropped, `$(...)` and backtick contents required too), plus `Bash(git:*)` and `Bash(node:*)`, which the workflow always runs and which only the full rule covers. The required rules also include the form `Bash(node *roadmap.mjs" *)` for the tracker CLI (one per name in `WORKFLOW_SCRIPTS`, the shape of DEC-060) the rule `Bash(node *review-package.mjs" *)` for the review package script at `<plugin root>/scripts/review-package.mjs`, only when `taskReview.restricted` is `true` (not in the default configuration), the rule `Bash(node *run-record.mjs" *)` for the run record script at `<plugin root>/scripts/run-record.mjs`, required in every run, the rules `Bash(node *preflight.mjs" *)` (the `discover` subcommand, which the discovery runs through the `script-runner` agent) and `Bash(node *verify-run.mjs" *)` (the `check` subcommand of the report, the grouped run of the record and its signed `read` re-read, also used by the docs stage) for the two scripts at `<plugin root>/skills/roadmap-release/scripts/`, both required in every run, and the rules of the executable `{verify: ...}` commands of the open cards. A rule is covered by `Bash`, `Bash(*)`, the rule itself, an exact `Bash(<command>)`, or a prefix rule such as `Bash(npm run:*)` that matches every command needing it. `Bash(git *)` and `Bash(git:*)` are treated as the same rule. If rules are missing in `run` mode, the skill stops once, before launching any agent, and shows the exact rules to add; in other modes it only reports them.

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
