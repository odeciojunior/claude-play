#!/usr/bin/env node
// Generates a disposable git repository used to verify roadmap-release end to end.
// Usage: node make-sandbox.mjs <dir>
// Creates four deliverables: E1 (pure function), E2 (depends on E1), E3 (independent, with an
// acceptance criterion that cannot be satisfied on purpose), E4 (independent, with an external
// delivery step: one line appended to ../outbox.log, outside the repository). No npm dependencies, no remote.
import { mkdirSync, writeFileSync, readdirSync, existsSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const here = dirname(fileURLToPath(import.meta.url));
const checkerSrc = join(here, '..', '..', 'roadmap-tracker', 'scripts', 'check-roadmap.mjs');

const FOLDER = 'docs/plans/roadmap-sandbox';
const DATE = '2026-11-09';

const files = {
  'package.json': JSON.stringify({ name: 'roadmap-sandbox', version: '0.0.0', private: true, type: 'module' }, null, 2) + '\n',
  '.gitignore': 'node_modules/\n',
  'README.md': '# Roadmap sandbox\n\nDisposable repository for verifying roadmap-release. Safe to delete.\n',
  'src/greet.mjs': 'export function greet(name) {\n  return `hello, ${name}`;\n}\n',
  'tests/baseline.test.mjs': `import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import { greet } from '../src/greet.mjs';

test('greet formats a name', () => {
  assert.equal(greet('sandbox'), 'hello, sandbox');
});

// Real shared resource: a fixed local port, hence the "sandbox-port" lock in release.config.json.
test('sandbox-port can be bound and released', async () => {
  await new Promise((ok, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(48731, '127.0.0.1', () => s.close(ok));
  });
});
`,
  [`${FOLDER}/release.config.json`]: JSON.stringify({
    projectContext: 'Plain Node ESM project without dependencies. Source in src/, tests in tests/ named *.test.mjs, run with `node --test`. Run all commands from the repo root.',
    install: '',
    gates: [{ name: 'unit', cmd: 'node --test', kind: 'tests', needsLock: 'sandbox-port' }],
    locks: ['sandbox-port'],
  }, null, 2) + '\n',
  [`${FOLDER}/roadmap.config.json`]: JSON.stringify({
    formatVersion: 1,
    language: 'en',
    strategy: 'strategy.md',
    integrationBranch: 'main',
    releaseBranch: 'release/sandbox',
    files: {
      readme: 'README.md', state: 'state.md', decisions: 'decisions.md', log: 'log.md',
      criticalPath: 'critical-path.md', measurements: null, sources: 'sources.md', requirements: 'requirements.md',
    },
    vocab: {
      deliverableStatuses: ['not-started', 'spec', 'plan', 'executing', 'on-branch', 'integrated', 'released', 'measured', 'blocked', 'discarded'],
      integratedStatuses: ['integrated', 'released', 'measured'],
      decisionInForce: 'in-force',
      decisionPending: 'pending',
      decisionSupersededBy: 'superseded by',
      coverageCovered: 'covered',
      coverageOutOfScope: 'out-of-scope',
      coverageNeedsClarification: 'needs-clarification',
      branchLive: 'live',
      branchDeleted: 'deleted',
      markers: ['ASSUMPTION', 'UNSOURCED'],
      bannedPhrases: ['this commit'],
    },
    tracks: ['engineering', 'decisions', 'external', 'release', 'measurement'],
    limits: { nowItems: 5, cellChars: 300, pendingItems: 20 },
  }, null, 2) + '\n',
  [`${FOLDER}/README.md`]: `# Sandbox Roadmap -- tracking folder

Disposable roadmap used to verify roadmap-release. The strategy document is \`strategy.md\`.

## Files

| File | Nature |
|---|---|
| \`strategy.md\` | Versioned strategy; no state |
| \`state.md\` | Overwritten snapshot: Now, panel, blockers, pending, in flight |
| \`decisions.md\` | Append-only decisions |
| \`log.md\` | Append-only events, newest first |
| \`critical-path.md\` | Dependency graph and next gates |
| \`sources.md\` | Source inventory and conflicts |
| \`requirements.md\` | Requirements and their coverage |
| \`roadmap.config.json\` | Paths, vocabulary, limits |
| \`release.config.json\` | Gates, locks and install for roadmap-release |

## Check

Run \`node <roadmap-folder>/check-roadmap.mjs\` (Node 18 or newer). It exits 1 on errors; warnings pass.

## When to update

| Event | Update |
|---|---|
| A decision is made | \`decisions.md\` first, then whatever uses it |
| A piece or step closes | \`log.md\` and the panel in \`state.md\` |
| A branch is integrated or deleted | "in flight" in \`state.md\` and \`log.md\` |
| A blocker opens or closes | \`state.md\` and \`critical-path.md\` |
| A piece or phase ends | propose a strategy revision |
`,
  [`${FOLDER}/state.md`]: `# State

Strategy v1.0 -- ${DATE}

Snapshot. Overwritten on every update; history goes to \`log.md\`.

## Now

<!-- roadmap:now -->
1. Run roadmap-release on E1, E2, E3 and E4.
<!-- /roadmap:now -->

## Panel

<!-- roadmap:panel -->
| Deliverable | Status | Evidence | Next step |
|---|---|---|---|
| E1 | not-started | - | Run the release skill |
| E2 | not-started | - | Wait for E1 |
| E3 | not-started | - | Run the release skill |
| E4 | not-started | - | Run the release skill |
<!-- /roadmap:panel -->

## Blockers

<!-- roadmap:blockers -->
| ID | Blocker | Affects | Since | Unblocks when |
|---|---|---|---|---|
<!-- /roadmap:blockers -->

## Pending

<!-- roadmap:pending -->
- None.
<!-- /roadmap:pending -->

## In flight

<!-- roadmap:inflight -->
| Branch | Kind | Note |
|---|---|---|
<!-- /roadmap:inflight -->
`,
  [`${FOLDER}/decisions.md`]: `# Decisions

Append-only. IDs are global and never reused.

<!-- roadmap:decisions -->
| ID | Date | Deliverable | Decision | Discarded alternative | Contradicts | Revisit when | Origin | Status |
|---|---|---|---|---|---|---|---|---|
| DEC-001 | ${DATE} | E3 | E3 keeps one acceptance criterion that cannot pass, to exercise the operator-action path | Make every criterion satisfiable | - | The sandbox is retired | SRC-01 | in-force |
<!-- /roadmap:decisions -->
`,
  [`${FOLDER}/log.md`]: `# Log

Append-only, newest first.

<!-- roadmap:log -->
| Date | Deliverable | What happened | Evidence |
|---|---|---|---|
| ${DATE} | - | Sandbox roadmap created | \`strategy.md\` |
<!-- /roadmap:log -->
`,
  [`${FOLDER}/critical-path.md`]: `# Critical path

\`\`\`mermaid
graph LR
  E1 --> E2
  E3
  E4
\`\`\`

Critical path: E1, E2. Next gate: run roadmap-release.
`,
  [`${FOLDER}/sources.md`]: `# Sources

<!-- roadmap:sources -->
| ID | Source | What it is | Read on | Reliability |
|---|---|---|---|---|
| SRC-01 | \`docs/plans/roadmap-sandbox/README.md\` | Sandbox description | ${DATE} | Generated, current |
<!-- /roadmap:sources -->

## Conflicts

<!-- roadmap:conflicts -->
- None.
<!-- /roadmap:conflicts -->
`,
  [`${FOLDER}/requirements.md`]: `# Requirements

<!-- roadmap:requirements -->
| ID | Requirement | Type | Sources | Deliverables | Coverage |
|---|---|---|---|---|---|
| REQ-001 | Numbers can be clamped to a range | functional | SRC-01 | E1 | covered |
| REQ-002 | Numbers can be normalized to a 0..1 scale | functional | SRC-01 | E2 | covered |
| REQ-003 | Text can be reversed, with an impossible extra check | functional | SRC-01 | E3 | covered |
| REQ-004 | A report can be published once to an outbox outside the repository | functional | SRC-01 | E4 | covered |
<!-- /roadmap:requirements -->
`,
  [`${FOLDER}/strategy.md`]: `<!-- roadmap:version 1.0 ${DATE} -->
# Sandbox Roadmap -- Strategy v1.0

## Changelog

- v1.0 (${DATE}): first version. Absorbs DEC-001.

## Objective

Exercise roadmap-release on a tiny project. Acceptance criterion: E1 and E2 merge into the release branch and E3 is reported as an operator action. Definition of done: E1 and E2 integrated.

## Non-goals

- Any real product behaviour. This repository is disposable.

## Assumptions

None recorded.

## Where we are

No deliverable started. See \`state.md\`.

## Thesis

Four tiny deliverables cover the dependency, the independent, the failing and the external-delivery path.

## Deliverables overview

| ID | Title | Phase | Depends on |
|---|---|---|---|
| E1 | Clamp function | Core | - |
| E2 | Normalize function | Core | E1 |
| E3 | Reverse function | Extras | - |
| E4 | Publish report | Extras | - |

## Phases

| Phase (outcome) | Entry criteria | Exit criteria | Deliverables |
|---|---|---|---|
| Numeric helpers work | Roadmap approved | clamp and normalize are tested and merged | E1, E2 |
| Text helper attempted | Roadmap approved | reverse is merged or reported as an operator action | E3 |
| Delivery step works | Roadmap approved | publish is merged and the outbox holds exactly one line | E4 |

## Deliverables

<!-- roadmap:card id=E1 phase=core track=engineering priority=Must size="not estimated" depends=- reqs=REQ-001 critical=true -->
### E1 -- Clamp function

Why: REQ-001. Add \`clamp(n, min, max)\` in \`src/clamp.mjs\`, a named export, with tests in \`tests/e1.test.mjs\`.

Pieces:

- Piece 1: the pure function and its tests.

<!-- roadmap:acceptance -->
1. Given a number inside the range, when clamp is called, then the number is returned. {verify: test; evidence: node --test tests/e1.test.mjs}
2. Given a number outside the range, when clamp is called, then the nearest bound is returned. {verify: test; evidence: node --test tests/e1.test.mjs}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 green.

<!-- roadmap:risks -->
- None significant: the function is pure.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E2 phase=core track=engineering priority=Must size="not estimated" depends=E1 reqs=REQ-002 critical=true -->
### E2 -- Normalize function

Why: REQ-002. Add \`normalize(n, min, max)\` in \`src/normalize.mjs\`, a named export that reuses \`clamp\` from E1 and returns a value in 0..1, with tests in \`tests/e2.test.mjs\`.

Pieces:

- Piece 1: the function and its tests.

<!-- roadmap:acceptance -->
1. Given a number in range, when normalize is called, then the position between min and max is returned as 0..1. {verify: test; evidence: node --test tests/e2.test.mjs}
2. Given a number out of range, when normalize is called, then the result is clamped to 0 or 1. {verify: test; evidence: node --test tests/e2.test.mjs}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 green.

<!-- roadmap:risks -->
- Depends on the clamp export name -> import it exactly as specified in E1.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E3 phase=extras track=engineering priority=Should size="not estimated" depends=- reqs=REQ-003 critical=false -->
### E3 -- Reverse function

Why: REQ-003. Add \`reverse(text)\` in \`src/reverse.mjs\`, a named export, with tests in \`tests/e3.test.mjs\`.

INTENTIONAL FAILURE: criterion 2 below cannot be satisfied. It runs a command that always exits non-zero. This is deliberate for the sandbox, to exercise the operator-action path. Do not edit the criterion, the command or the test infrastructure to make it pass; report the deliverable as blocked instead.

Pieces:

- Piece 1: the pure function and its tests.

<!-- roadmap:acceptance -->
1. Given a string, when reverse is called, then the characters come back in reverse order. {verify: test; evidence: node --test tests/e3.test.mjs}
2. Given any input, when reverse is called, then the result is both reversed and identical to the input for every string (impossible on purpose). {verify: test; evidence: node -e "process.exit(1)"}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 green. It cannot be reached by design.

<!-- roadmap:risks -->
- Criterion 2 is unsatisfiable by design -> expect an operator action, not a merge.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

<!-- roadmap:card id=E4 phase=extras track=engineering priority=Should size="not estimated" depends=- reqs=REQ-004 critical=false -->
### E4 -- Publish report

Why: REQ-004. Add \`publish(report)\` in \`src/publish.mjs\`; the delivery step appends exactly one line \`E4 published\` to \`../outbox.log\`, one level above the working directory and outside the repository (a stand-in for sending a message), once even if the step is repeated.

Pieces:

- Piece 1: the function, the delivery step and their tests.

<!-- roadmap:acceptance -->
1. Given a report, when publish is called, then exactly one line \`E4 published\` is appended to \`../outbox.log\`. {verify: test; evidence: node --test tests/e4.test.mjs}
2. Given the delivery step is repeated, when publish is called again, then \`../outbox.log\` still holds exactly one such line. {verify: test; evidence: node --test tests/e4.test.mjs}
<!-- /roadmap:acceptance -->

Definition of done: acceptance passes in the integration branch; G1 green.

<!-- roadmap:risks -->
- The outbox is outside the repository, so a rollback cannot undo it -> make the delivery idempotent.
<!-- /roadmap:risks -->
<!-- /roadmap:card -->

## Gates and verification

<!-- roadmap:gates -->
| ID | Command | Environment | When | Baseline |
|---|---|---|---|---|
| G1 | \`node --test\` | local | every task and merge | 2 passing |
<!-- /roadmap:gates -->

## Metrics and targets

None supplied.

## Flags

None.

## Cross-cutting risks

- None.

## Decisions

Decisions live in \`decisions.md\`. This strategy absorbs DEC-001.

## External pending items

None.

## Open questions

None.

## Coverage summary

Four requirements covered.

## Version history

| Version | Date | Summary |
|---|---|---|
| 1.0 | ${DATE} | First version |

## Sources

See \`sources.md\`.
`,
};

function git(cwd, ...args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function makeSandbox(target) {
  const dir = resolve(target);
  if (existsSync(dir) && readdirSync(dir).length > 0) {
    throw new Error(`target directory is not empty: ${dir}`);
  }
  mkdirSync(dir, { recursive: true });
  for (const [rel, content] of Object.entries(files)) {
    const p = join(dir, rel);
    mkdirSync(dirname(p), { recursive: true });
    writeFileSync(p, content);
  }
  copyFileSync(checkerSrc, join(dir, FOLDER, 'check-roadmap.mjs'));
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', '--local', 'user.name', 'Sandbox');
  git(dir, 'config', '--local', 'user.email', 'sandbox@example.invalid');
  git(dir, 'config', '--local', 'commit.gpgsign', 'false');
  git(dir, 'config', '--local', 'core.autocrlf', 'false');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'chore: sandbox baseline');
  return dir;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const target = process.argv[2];
  if (!target) {
    console.error('usage: node make-sandbox.mjs <dir>');
    process.exit(2);
  }
  try {
    const dir = makeSandbox(target);
    console.log(JSON.stringify({ dir, roadmapFolder: join(dir, FOLDER), integrationBranch: 'main', releaseBranch: 'release/sandbox' }, null, 2));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}
