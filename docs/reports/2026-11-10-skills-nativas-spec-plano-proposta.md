<!-- Proposta do subagent Fable 5.2 (effort medium), 2026-11-10, gravada sem edição pela sessão principal. Insumo (SRC-08) do roadmap docs/plans/roadmap-evolucao-skills/. Não é decisão: as perguntas da seção E seguem abertas até o dono responder. -->

# Native replacement for superpowers in `productivity-tools`: design proposal

Markers: **[V file:line]** = I read it in that file; **[I]** = my inference, not measured. `SP` = `~\.claude\plugins\cache\claude-plugins-official\superpowers\7.0.0`, `WF` = `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`, `RN` = `SP\RELEASE-NOTES.md`.

Not read: `delegation-protocol.md`, `operator.md`, `config.md`, `preflight.mjs`, the workflow-authoring reference. Nothing was run.

## 0. Corrections to the research report

- **Lean plans (§6).** The "quarter of the time, a third of the tokens" figure is for writing the plan, not executing it [V RN:53]. Execution parity is a separate result: 9/9 planted-defect probes on Sonnet 5 [V RN:60].
- **Who should write the plan.** An earlier superpowers note attributes the execution cost win to "opus-written complete-code plans" [V SP\docs\superpowers\specs\2026-06-10-strict-cost-sdd-design.md:73-77]. The later 6.4.2 lean-plan result partly supersedes it, so the author-model question is not settled by their data.
- **Sonnet reviewers.** Haiku reviewers flagged 0 of 10 planted defects [V strict-cost:205-213]. Sonnet-tier reviewers flagged 5/5 under an opus controller; the 4-of-5 misses came from a sonnet *controller* absorbing findings [V strict-cost:127-132]. In `roadmap-release` the controller is code, so that failure mode is absent, but so is the controller backstop.
- **Review-loop measurement.** The 5.0.6 result (5 versions × 5 trials, identical quality, ~25 min overhead) was on spec/plan documents that a human then approved [V RN:447-452]. It does not transfer cleanly to an unattended run.
- **Per-task reviews today.** The release runs two review loops per task (`spec`, then `quality`) [V WF:1740]. Superpowers merged these into one reviewer with two verdicts in 6.0.0 [V RN:271].
- **Fix-loop stop rule.** Their design spec says a load-bearing finding at the cap stops the run [V SP\docs\superpowers\specs\2026-07-15-sdd-fix-loop-redesign-design.md:91-95]. The shipped skill says rule and continue, stopping only when every path is a guess [V SP\skills\subagent-driven-development\SKILL.md:420-425].

## A. Practices

### Keep

| # | Practice | Evidence | Source | Here |
|---|---|---|---|---|
| 1 | A plan records decisions (test names and assertions, signatures, spec values, command and expected output), not code | Plan writing ¼ time, ⅓ tokens; 9/9 execution parity [V RN:53-60] | `SP\skills\writing-plans\SKILL.md:140-161` | Task prose rule in `plan-author`; proportion check in code |
| 2 | Global constraints in a fixed, extractable place | A `go 1.26.1` floor shipped because nobody pasted it; elicitation 0→5/5 [V strict-cost:68-72, 97-103] | writing-plans:70-75 | `constraints[]` in the plan data; the brief script appends them to every brief |
| 3 | Per-task interfaces (consumes/produces) | Implementers spent ~13 calls rediscovering context [V strict-cost:104-108] | writing-plans:102-106 | `produces`/`consumes` fields; code checks every consumed name is produced earlier |
| 4 | Task right-sizing | One fix round vs 2–4 in the control [V RN:286]; ~$0.60–1.00 fixed cost per task [V strict-cost:89-96] | writing-plans:34-41 | Rule in `plan-author`; code warns on a task with no test cycle |
| 5 | Inline self-review by the author instead of reviewer loops | [V RN:447-452] | writing-plans:163-177 | Self-review inside the author call, then deterministic check |
| 6 | Builder check: one fresh reader, questions only, one round, three piles | Replaced their spec reviewer [V RN:13] | `SP\skills\brainstorming\SKILL.md:160-177`, `builder-check-prompt.md` | The only LLM review of the spec; "theirs" pile becomes `needsPerson` |
| 7 | Rulings, not stalls: decide, record with cost if wrong, list at the end; few named stop reasons | "A session parked on a question costs their whole day" | SDD SKILL:19-31, 473-480 | `rulings[]` schema; stop rules in code (section B4) |
| 8 | Artifacts move as files: task brief, report file, review package | A 42k-char dispatch was 99% pasted history; missing diff was the biggest reviewer cost [V SDD SKILL:267-271; RN:274] | `SP\skills\subagent-driven-development\scripts\task-brief`, `review-package` | `plan-tool brief`, `review-package.mjs` |
| 9 | Model named on every dispatch | 26 reviewers inherited the top tier [V RN:275] | SDD SKILL:204-206 | Already true in WF; tier now computed by code from scores |
| 10 | One reviewer per task, two verdicts, plus "cannot verify from diff" | [V RN:271] | `task-reviewer-prompt.md` | Replaces the two loops at WF:1740 |
| 11 | Reviewer does not trust the report; a rationale never downgrades a finding; a plan-mandated defect is still a finding | Tripwire took labeled findings 0/6→6/6 [V strict-cost:138-146] | task-reviewer-prompt:64-71, 153-157 | `reviewer` agent body |
| 12 | Scoped re-review (findings plus fix diff), round cap, one fix dispatch for the final review | Unscoped re-reviews were the churn engine [V fix-loop spec:15-21]; a final fix wave cost more than all tasks [V SDD SKILL:458-461] | `re-review-prompt.md` | Finding ids; re-reviewer returns a verdict per id |
| 13 | Cheapen mechanics, never judgment; mid-tier floor for reviewers | Haiku 0/10 [V strict-cost:205-213] | strict-cost:25-52 | No haiku on any verdict; haiku only as courier of script output |
| 14 | Test-first with RED and GREEN evidence in the report; the project suite defines green | Only the named file ran in 11 of 12 probes [V RN:100]; cutting the rebuttals dropped compliance 8/10→5/10 [V RN:179] | `implementer-prompt.md:133-135`, TDD SKILL:185-193 | `checks[].phase` plus a code check; three rebuttal rows kept |
| 15 | Durable ledger with plan identity; trust it and git over memory | Re-dispatching completed tasks was the most expensive failure; 6–13 forensic calls per resume [V SDD SKILL:131-134; RN:171] | `sdd-workspace` | `run.json` committed on the branch, keyed by plan fingerprint |

Two smaller ones are folded into the contracts: the "Review Focus" list of unstated inputs [V RN:87] becomes `edgeCases[]` in the spec, each pinned to a task; "three failed fixes means question the design" [V `SP\skills\systematic-debugging\SKILL.md:191-212`] becomes the existing tier escalation.

### Drop or invert

| Superpowers practice | Decision | Reason |
|---|---|---|
| One question per message, playback chunks, open questions first (brainstorming:41-121) | Drop unattended; interactive mode asks one batched round | The card already carries intent, REQs and acceptance |
| Human approval hard gate (brainstorming:179-193) | Replace with code check, builder check and stop rules | Nobody is there |
| "Offer recon, they decide" (brainstorming:83-85) | Invert: always read the code first | Reading costs less than a wrong ruling |
| Visual companion, spikes, sizing | Drop | The roadmap planner already sized the work |
| Execution handoff question (writing-plans:179-205) | Drop | Today's prompt already says "ignore" [V WF:1519] |
| Implementer "ask them now", "always OK to pause" (implementer-prompt:22-30, 44-45) | Invert: decide and record a ruling; `NEEDS_HUMAN` only for person-only kinds | Subagents cannot ask anyone |
| Iron-law prose and long rationalization tables | Compact to a few lines; enforce by evidence in code | A ~2.4K-token skill load per implementer buys little under no human pressure [I] |
| LLM pre-flight conflict table (SDD SKILL:162-182) | Replace with `plan-tool check` | Shared files and interface mismatches are structural |
| Resume the same implementer for fixes | Keep in plan-coordinator (it has `SendMessage`); in the workflow use the report file plus a fresh fixer | I assume workflow `agent()` cannot resume [I] |
| Five fix rounds | Keep the release's 2, plus 1 on escalation [V WF:430, 809] | Already tested; code is the controller |
| Git-ignored workspace deleted at the end (SDD SKILL:482-485) | Invert: commit the ledger | The workflow keeps no state across sessions; git is its store |
| Strengths and praise in reviews | Drop from output | The consumer is code |
| Harness-neutral vocabulary | Drop | This plugin targets Claude Code only |

## B. The native design

### B1. Pieces

| Piece | Form | Replaces | Why this form |
|---|---|---|---|
| `spec-author` | Plugin agent (`agents/spec-author.md`) | `superpowers:brainstorming` plus the autonomous wrapper [V WF:1455-1467] | A stable system prompt shared by every call (cache prefix); no "did the skill fire" variance |
| `plan-author` | Plugin agent | `superpowers:writing-plans` plus overrides [V WF:1504-1520] | Same |
| `implementer` | Plugin agent, with a fix-mode section | TDD and systematic-debugging skill loads [V WF:486, 1325, 1877] | Discipline is ~450 tokens; plan-coordinator can dispatch the same type |
| `reviewer` | Plugin agent; scope comes in the call prompt (task, re-review, final lens, gates-fix) | `task-reviewer-prompt`, `re-review-prompt`, `code-reviewer.md` | One rubric, one output schema |
| Builder check | ~150-token template in the workflow and in `spec-writer` | Spec review loop [V WF:1469-1487] | Too small for an agent file |
| `spec-writer` | Skill (thin, interactive entry) | Interactive brainstorming | Needs the main session to ask the person |
| `task-planner` | Skill (thin, interactive entry) | Interactive writing-plans | Entry point outside a roadmap |
| `scripts/plan-tool.mjs`, `spec-tool.mjs`, `review-package.mjs`, `run-ledger.mjs`, `lib/data-block.mjs` | Code, at plugin level | Transcription, cross-check, scoring, waves, log writing | Section B6 |
| Pure functions in WF (`route`, `canon`, `digestOf`, `tddGaps`, `stopOrCarry`) | Code, tested through `load-pure.mjs` | LLM judgment on tier, repeats, stops | Same pattern as today |

That is two new skills and four agents. Verification-before-completion gets no piece of its own: it becomes the `checks[]` evidence contract plus gates that code already measures.

The interactive skills dispatch the same author agents, so the artifact format lives in one place (the agent body) and the structure lives in one place (the schema in code).

**Open technical point.** Whether workflow `agent()` accepts `agentType` for a plugin agent is disputed between the two docs (report §8.3). If it does not, the agent bodies are copied into WF constants and a test asserts they equal the files. Verify in slice S0.

### B2. Spec contract

**Inputs**
- Unattended: card object (id, title, why, pieces, `acceptance[{id,text}]`, reqs, deps, critical, risks), paths to `requirements.md` and `decisions.md`, do-not list, open blockers, measured environment, owner note if any, output path.
- Interactive: the request, plus an intake note the skill writes (the person's statements verbatim, guesses marked as guesses).

**Saved at** `docs/plans/<topic>/spec.md`. `<topic>` is `<E>-<slug>` with the slug computed by code from the card title (`cleanSlug` exists [V WF:55]), or a kebab topic for free-form work. The name is fixed and undated, so resume never has to "locate" a file by glob as it does today [V WF:1259-1260].

**Process (one `spec-author` call)**
1. Read the card, its REQs, the decisions it cites and the do-not list.
2. Read the code the card touches, until each acceptance criterion maps to a place in the code.
3. For each open choice, consider at least two options privately and pick one. Classify it: settled by a source (cite it), a ruling (record it), or needs a person.
4. List every external effect the card requires.
5. Write the file. Run the self-review: every criterion has a design answer, no placeholder, no scope outside the card, every ruling has a basis and a cost, every person-only item is in `needsPerson` and not invented.
6. Run `node <plugin>/scripts/spec-tool.mjs check <file> --card <json>`; fix until exit 0, at most three runs.
7. Commit only the spec. Return the output of `spec-tool emit` verbatim.

**Interactive mode (`spec-writer` skill)**
1. Do steps 1–2 above without asking.
2. Ask one batched round of at most five questions that only the person can answer.
3. Write the intake note and dispatch `spec-author`.
4. Run the builder check.
5. Show `spec-tool summary` (rulings and open items) and ask for approval once.

**Artifact**

````markdown
# E18 — Export orders as CSV: spec
Source: card E18, docs/plans/2026-10-01-roadmap-orders.md (strategy v1.2)

## Intent
## Scope            (In / Out / Must not)
## Acceptance       (ordered list, card text verbatim including {verify: …} tags)
## Design           (behavior, data, interfaces, errors; one paragraph per AC naming real files)
## Left to the planner

```json data
{ "schema": "spec/1", "id": "E18", "date": "2026-11-10", "mode": "unattended",
  "rulings": [{ "id": "R1", "question": "Delimiter?", "decision": "semicolon",
    "basis": "src/export/xlsx.ts:40 uses pt-BR locale", "alternative": "comma",
    "costIfWrong": "low", "reversible": true, "contradicts": null }],
  "needsPerson": [{ "id": "H1", "kind": "credential", "what": "SFTP key for the partner drop",
    "why": "AC3 uploads the file", "blocking": false,
    "workaround": "write to ./outbox and mark AC3 human", "blq": "BLQ-2" }],
  "externalEffects": [{ "id": "X1", "what": "upload to partner SFTP", "target": "sftp://…",
    "dedupe": "skip when remote file with same sha exists" }],
  "edgeCases": [{ "id": "C1", "input": "order with a ';' in the customer name",
    "expected": "field quoted" }] }
```
````

Structured lists live only in the data block; prose never restates them. `needsPerson.kind` is one of `data`, `credential`, `acceptance`, `decision`. `edgeCases` is capped at five.

**Completion without a human**
1. `spec-tool check`:
   - sections present and in order;
   - acceptance list equals the card's after whitespace normalization, tags intact (reuses `parseVerifyTag` [V WF:277]);
   - data block parses against `spec/1`;
   - every ruling has basis, cost and reversibility;
   - a non-blocking `needsPerson` has a workaround; a cited `blq` is open;
   - no `TBD`/`TODO`; a warning above ~1,200 words of prose.
2. Builder check, one round: a fresh reader returns `{questions[{q, whyItChangesThePlan}]}`. Empty means done. Otherwise one `spec-author` call sorts each question into answered from sources, ruling, or `needsPerson`; then `spec-tool check` again. There is no second review.
3. Code applies the stop rules (B4).

### B3. Plan contract

**Inputs**: the spec path, gates and commands from the release config, measured environment, lock names, the worktree. Interactive: a spec path, or a request small enough to plan directly (the skill then writes a five-line spec first).

**Saved at** `docs/plans/<topic>/plan.md`.

**Process (one `plan-author` call)**
1. Read the whole spec.
2. Map files: what is created or modified, and each file's responsibility.
3. Cut tasks. A task is the smallest unit with its own test cycle that a reviewer could reject alone; setup, config and docs fold into the task that needs them.
4. Per task, write the prose: test name and assertions, exact signature and file, spec values, command and the output that means pass. Include a body only for an algorithm the signature and tests do not determine.
5. Write one evidence row per acceptance criterion. A `{verify}` command from the card is kept, never replaced.
6. Score each task on ambiguity, reasoning, blast radius and verifiability (0–2 each). The author does not choose the tier.
7. Self-review: spec coverage, one reasonable reading per step, names consistent across tasks, every `edgeCases` id pinned to a task, plan not several times longer than the spec.
8. Run `plan-tool check <file> --spec <spec>`; fix until exit 0, at most three runs.
9. Commit only the plan. Return `plan-tool emit` verbatim.

**Artifact**: a short "Approach" section, then one `### Task N: <title>` section per task holding only the numbered steps, then the data block. The heading shape is generic; plans stay readable by any tool that splits on it, which costs nothing.

**Schema `plan/1` with a filled example**

```json
{ "schema": "plan/1", "id": "E18", "spec": "docs/plans/E18-export-csv/spec.md",
  "roadmap": "docs/plans/roadmap-orders/",
  "commands": { "test": "npm test", "testOne": "npx vitest run {file}" },
  "constraints": ["Node >= 18", "CSV delimiter ';' (R1)", "no new dependencies"],
  "tasks": [
    { "n": 1, "title": "CSV serializer", "deps": [],
      "files": { "create": ["src/export/csv.ts"], "modify": [], "test": ["tests/export/csv.test.ts"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": ["toCsv(rows: Order[]): string"], "consumes": [],
      "covers": ["AC1", "C1"], "testFirst": true,
      "checks": [{ "cmd": "npx vitest run tests/export/csv.test.ts", "expect": "exit 0" }],
      "locks": [], "external": false, "externalDedupe": null, "noCommit": false },
    { "n": 2, "title": "Upload to partner drop", "deps": [1],
      "files": { "create": ["scripts/upload-export.mjs"], "modify": [], "test": ["tests/upload.test.ts"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 2, "verifiability": 1 },
      "produces": [], "consumes": ["T1: toCsv(rows: Order[]): string"],
      "covers": ["AC3"], "testFirst": true,
      "checks": [{ "cmd": "npx vitest run tests/upload.test.ts", "expect": "exit 0" }],
      "locks": [], "external": true,
      "externalDedupe": "skip when remote file with same sha exists", "noCommit": false }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "npx vitest run tests/export/csv.test.ts",
      "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "blocked", "command": null, "external": false,
      "externalDedupe": null, "blq": "BLQ-2" }
  ],
  "rulings": [], "needsPerson": [] }
```

- `writes` lists implicit writes (lockfiles, generated directories, snapshots).
- `testFirst` is `true` or `{ "exempt": "<reason>" }`.

**What `plan-tool check` enforces**
- Schema validity; tasks numbered 1..N.
- `deps` acyclic and pointing backwards.
- Every task heading has a data entry and the reverse.
- Every `consumes` matches an earlier `produces`.
- Every acceptance id and every `edgeCases` id is covered.
- Every evidence row with a command has a boolean `external`; every external item has a dedupe.
- Unknown locks; a task that edits the roadmap folder.
- A lexical scan: a command matching a configurable effect pattern (`git push`, `publish`, `deploy`, `curl -X POST`, `kubectl`, `sendmail`, …) with `external: false` is an error.
- A proportion warning.

**Consumption by code.** `emit` prints `{ok, errors, head, blob, plan, digest}`. `plan` is the data block plus computed fields: `tier`, `review`, `effort`, `wave`, and `scope` from the file count. `digest` is FNV-1a over a canonical serialization. The workflow has no filesystem, so an agent carries the text, and code proves the carriage:

```js
// workflow, pure
const canon = v => Array.isArray(v) ? v.map(canon)
  : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canon(v[k])])) : v
const digestOf = plan => fnv1a(JSON.stringify(canon(plan)))        // same fnv1a as planFingerprint (WF:642)
const loaded = r => !!r && r.ok && digestOf(r.plan) === r.digest   // false -> one haiku courier retry, then 'infra'

// shared with plan-tool (same source, a test asserts identical results)
function route(t) {                       // routing.md §2–§3 as arithmetic
  const scope = t.fileCount <= 1 ? 0 : t.fileCount <= 5 ? 1 : 2
  const s = scope + t.score.ambiguity + t.score.reasoning + t.score.blast + t.score.verifiability
  let tier = s <= 2 ? 'haiku' : (s >= 6 && t.score.blast === 2 && t.score.ambiguity === 2) ? 'opus' : 'sonnet'
  const strict = t.external || t.score.blast === 2 || tier === 'opus'
  if (strict && tier === 'haiku') tier = 'sonnet'                  // risk floor
  return { tier, effort: tier === 'haiku' ? 'low' : (s >= 6 && tier === 'sonnet') ? 'high' : 'medium',
           review: strict ? 'strict' : 'standard' }
}
```

- **Tasks, files, external, noCommit, locks**: read from `r.plan.tasks`. The existing `planGaps`, `evidenceGaps`, `externalGaps` and `evidenceExternalGaps` keep running on this object unchanged [V WF:1523-1533].
- **Fingerprint**: `planFingerprint(tasks, r.blob)` unchanged [V WF:642], so authorization binding keeps its semantics.
- **Removed**: the opus transcription in the plan return [V WF:1520], the reviewer's re-read of evidence rows [V WF:1546], and `planBlobGaps`, `evidenceRowGaps`, `hideRowGaps` [V WF:1534, 717, 735].
- **plan-coordinator**:
  - `plan-tool map <plan> --json` returns waves (topological levels split by write-set overlap over `files` plus `writes`), tiers, review gates and the external list.
  - `plan-tool brief <plan> N` writes one file per task: constraints, the task's data, its prose and the consumed signatures.
  - Steps 4–6 of its Phase 1 [V `plan-coordinator\SKILL.md:66-86`] become two commands, and Step Cards become brief paths.

### B4. Autonomous decisions and person-only questions

Two record types exist everywhere (spec, plan, implementer return, ledger): `rulings[]` and `needsPerson[]`, with the fields shown in B2. External-effect authorization stays a third, separate mechanism, exactly as today.

**Stops the deliverable** (decided by code in `stopOrCarry`):
1. a `needsPerson` with `blocking: true`;
2. a ruling with `contradicts` set (a registered decision or a canonical gate);
3. a ruling with `costIfWrong: "high"` and `reversible: false`;
4. an unauthorized external task or evidence row, or doubt whether an effect ran (unchanged);
5. `spec-tool` or `plan-tool` still failing after the author's attempts plus one fix call;
6. the same finding id still open after a fix at opus.

**Recorded and carried on**: every other ruling goes to `decisions.md` with Origin `executor` and status pending, as today [V WF:1578]. Non-blocking `needsPerson` goes to the pending block with its workaround. Minor findings and accepted risks go to `run.json`. The final report lists every ruling with its cost if wrong.

### B5. Models, effort and review steps

| Role | Model / effort | Decision | Basis |
|---|---|---|---|
| Spec author | opus / medium | Keep | Judgment-dense; moves judgment to the front [V strict-cost:179-189] |
| Spec review | opus / medium, builder check, one round | **Replace** the 3-round loop [V WF:1469] | [V RN:447-452]; reviewer not below the author (your policy) |
| Plan author | sonnet / medium | **Change** from opus [V WF:1521] | Your tier table puts the plan draft at T1; structure is now checked by code |
| Plan review | opus / medium, one round, judgment-only rubric | **Shrink** from a loop to one pass plus one fix call | See below |
| Implementer | computed by `route()` | Keep the rule, move it to code | [V routing.md:19-38] |
| Task review | one reviewer, two verdicts; `standard` = sonnet / medium, `strict` = opus / medium | **Merge** two loops into one [V WF:1740] | [V RN:271] |
| Re-review | scoped to finding ids and fix diff; model = max(reviewer, fix tier) [V WF:439] | **Change** from full re-review | fix-loop spec:40 |
| Final review | opus / high; two lenses when the card is critical | Keep; **one** fix wave, one scoped re-review at opus / high | [V SDD SKILL:458-468]; final gate is always T3 |
| Gates-fix review | opus / medium | Keep | Masked tests are the costly miss |
| Couriers (emit retry, ledger, marks) | haiku / low | Keep | Digest or git verifies the result |

**Per-task reviewer conflict (report §8.1).** I do not move either model, per your rule about measured evidence. The two skills differ less than it looks: the coordinator reviews only gated steps (risk floor, score ≥ 7, haiku foundations) on opus [V routing.md:45-53], and the release reviews every task on sonnet with opus for the risky ones [V WF:387]. One plan field expresses both: `review: standard | strict`, computed by `route()`. The release reviews every task (standard on sonnet, strict on opus). The coordinator reviews only strict tasks, on opus, and leaves the rest to the wave gate and final gate. Each keeps its current model.

**Spec/plan loop conflict (report §8.2).** Superpowers' measurement had a human approving afterwards, so I keep one independent read of each document and remove the loop. The plan reviewer's rubric drops to the items code cannot check:
- does each evidence command prove its criterion;
- does a task touch anything outside the branch while declaring `external: false`;
- does the task order ship code before its effect;
- is a testable criterion labeled human.

**What to measure before changing further**

Build a planted-defect sandbox (`make-sandbox.mjs` exists) and run N=5 per arm.

1. Plan with a mis-declared external and with a non-proving evidence command, with and without the plan review. If the lexical scan plus the final review catch 5/5 without it, make the plan review conditional on external or blast-2 tasks.
2. Task reviewer sonnet against opus on planted defects of Important severity. This settles `standard`.
3. Sonnet against opus plan author: fix rounds per task and gate failures downstream.
4. Builder check on sonnet against opus: count of plan-changing questions found.

### B6. Deterministic code

| Function or script | Input → output | LLM call it removes |
|---|---|---|
| `lib/data-block.mjs` | markdown → `{prose, data}`; replace block | — (shared parser) |
| `spec-tool check / emit / summary` | spec path + card JSON → errors / `{spec, blob, digest}` / table | Most of the spec reviewer's rubric [V WF:1473]; reading "Depends on human input" by LLM [V WF:1230] |
| `plan-tool check` | plan + spec → errors | Structural items of the plan review [V WF:1544]; LLM pre-flight conflict scan |
| `plan-tool emit` | plan → normalized object + digest | Opus transcription and opus re-read [V WF:1520, 1546] |
| `route()` | scores + file count → tier, effort, review | Tier chosen by the plan agent and checked by the reviewer; coordinator Step 4 |
| `plan-tool map` | plan → waves, gates, externals | Coordinator Steps 5–6 |
| `plan-tool brief` | plan, N → brief file | Hand-written Step Cards; implementers reading the whole plan |
| `review-package.mjs` | base, head → one diff file, with range guards | Reviewer's ad-hoc git exploration (run by the reviewer as its first command, no extra call) |
| `run-ledger.mjs append / read` | JSON → `run.json` on the branch / digest-verified read | Sonnet writing the review log [V WF:1217-1221] and sonnet reading it back [V WF:1230] (both become haiku couriers) |
| `tddGaps(task, checks)` | `checks[{cmd, exit, phase}]` → findings | Reviewer judging "followed TDD"; requires a `red` check with nonzero exit before a `green` one, and a test file in the task's files |
| Finding ids | reviewer returns `id`; re-review returns `{id, addressed}` | `sameFinding` string compare [V WF:270] and the "repeat it with the same wording" instruction [V WF:495] |
| `stopOrCarry` | rulings + needsPerson → stop or continue | — (makes the stop rule testable) |
| Approved-blob skip | `run.json.approved.{specBlob, planBlob}` equal to the current blobs → skip reviews on resume | Unconditional re-review on every resume [V WF:1469, 1540] |

### B7. Token budget

Tokens are bytes/4; the "new" column is a design target [I].

| Loaded text | Today | New |
|---|---|---|
| Spec author instructions | brainstorming 10,073 B ≈ 2.5K + wrapper ≈ 0.6K [V WF:1457-1466] | `spec-author` ≈ 0.9K |
| Plan author instructions | writing-plans 10,335 B ≈ 2.6K + overrides ≈ 1.6K [V WF:1506-1520] | `plan-author` ≈ 1.3K, including the filled example |
| Per implementer | TDD skill 9,578 B ≈ 2.4K (plus ≈ 2.1K if it follows the link to `writing-good-tests.md`) | `implementer` ≈ 0.45K; reads a brief, not the plan |
| Per gates or merge fixer | systematic-debugging 9,530 B ≈ 2.4K | fix section ≈ 0.2K inside `implementer` |
| Per task review | two prompts, two calls | `reviewer` ≈ 0.55K, one call |
| Builder check | — | ≈ 0.15K |
| Interactive entry | brainstorming ≈ 2.5K resident in the main session | `spec-writer` ≈ 0.5K, `task-planner` ≈ 0.35K |
| plan-coordinator before the plan | ≈ 14K (SKILL 17,398 B, protocol 26,087 B, routing 9,125 B, measured) | Routing scoring leaves the orchestrator (≈ −2K); Steps 4–6 shrink (target ≈ −1.5K) |

Call count per deliverable with one task [I]:
- **Removed**: a second spec-review round whenever the first finds something, the plan-review rounds beyond one, one task review, the sonnet log write, the sonnet log read on resume.
- **Added**: nothing on the happy path. The builder check replaces the first spec review, and the author returns `emit` itself.
- **Net**: about three fewer calls on a clean run, more on a run with findings, and two opus reviews skipped on every resume.

## C. Why this beats using superpowers here, and what it gives up

**Gains**
- **Speed**: one review per task instead of two; no spec/plan loops; resume skips approved documents; the plan author no longer retypes its plan as JSON for a second agent to recheck.
- **Tokens**: ~2K fewer per implementer and per fixer; no instructions written against a skill ("AUTONOMOUS MODE", "ignore the execution-mode question") that the model must reconcile; implementers read a brief.
- **Harness**: tier, review level, waves, plan validity, repeat detection, test-first evidence and stop decisions are tested functions. Today they are prompt text or reviewer judgment.
- **Judgment where needed**: opus stays on the spec, the plan's judgment-only rubric and the final gate; each reviewer gets a short rubric of things code cannot check.
- **Autonomy**: no agent prompt contains "ask"; person-only items have a schema and a code-enforced stop rule.
- **Independence**: no behavior changes when superpowers ships a release (7.0.0 rewrote brainstorming from scratch [V RN:5]) or is not installed.

**Costs**
- Superpowers' eval lab and its tuned wording. Our prompts start unmeasured, so slice S0 is not optional.
- The conversational depth of their brainstorming for vague ideas. `spec-writer` asks one batched round; a person who wants a long exploratory dialogue gets less.
- Multi-harness portability, the visual companion, spikes.
- We own the maintenance: four agents, two skills, about five scripts.

## D. Deliverables

| # | Slice | Acceptance (checkable) |
|---|---|---|
| S0 | Baseline and feasibility: sandbox run of the current release on a fixed card; probe `agentType` with a plugin agent in a workflow; probe a subagent running a plugin script by absolute path | (1) A committed JSON with calls, tokens, cost and duration for one deliverable. (2) A test workflow returns a marker that only the agent body contains, or the fallback is recorded as chosen. (3) Planted-defect fixtures exist and the current pipeline's catch rate over N=5 is recorded. |
| S1 | `data-block`, `plan-tool` (check, emit, map, brief), `route()`, schema, fixtures | (1) `node --test` passes; each planted plan defect (cycle, write overlap, uncovered AC, unproduced interface, effect command with `external:false`) yields its named error. (2) `emit` digest equals the workflow's `digestOf` on the fixture. (3) `route()` reproduces every row of a routing table fixture. |
| S2 | `plan-author` agent, `task-planner` skill, plan-coordinator consumes `map` and `brief` | (1) Behavioral run ×3 from a fixture spec: plan passes `check` within the author's attempts, with zero questions asked. (2) Coordinator's map for the fixture equals `plan-tool map` output. (3) No "superpowers" string under `skills/plan-coordinator`. |
| S3 | `spec-tool`, `spec-author` agent, `spec-writer` skill, builder check; roadmap-planner and tracker text point to the native skills | (1) `check` rejects an altered criterion and a dropped `{verify}` tag. (2) Unattended run on the sandbox card: zero `AskUserQuestion`; a card needing a credential yields a `needsPerson` entry and no invented value. (3) No "superpowers" string under `roadmap-planner` or `roadmap-tracker`. |
| S4 | Release workflow: native spec and plan stages, fixed paths, digest-verified load, single reviews, approved-blob skip | (1) `flow.test.mjs`: no agent prompt contains "superpowers" in the spec and plan stages. (2) A digest mismatch produces an `infra` failure after one retry. (3) A resume with unchanged blobs makes zero spec-review and plan-review calls. |
| S5 | `implementer` and `reviewer` agents, single task review, finding ids and scoped re-review, `tddGaps`, `review-package`, `run.json` | (1) Flow test: one review call per clean task. (2) Planted-defect sandbox N=5: catch rate not below the S0 baseline. (3) A task with `testFirst: true` and no red check fails in code without a reviewer call. |
| S6 | Cutover: `migrate-artifacts.mjs`, descriptions, README, version 2.0.0, repo test that greps the plugin for "superpowers" | (1) The grep test passes with zero matches. (2) Migration on a fixture moves a legacy spec and plan to `docs/plans/<topic>/` and the adopted plan passes `check`. (3) `claude plugin validate` and the full suite pass. |

Each slice bumps the version in both places. S2 and S3 ship usable skills while the release still runs the old stages; independence is complete at S6.

**Existing plans at the cutover**
- **Plan without a data block**: plan-coordinator treats any such file, from any origin, as needing adoption. One `plan-author` call in adopt mode writes `docs/plans/<topic>/plan.md` from it, then `check`. The skill text never names a legacy directory; the person passes the path.
- **In-flight release deliverables**: finish them on 1.x before upgrading. For the rest, `migrate-artifacts.mjs --from <dir> --id E<n>` does the `git mv` and adoption; the legacy directory is an argument, so nothing shipped names it.
- **Old progress files**: completed work is read from git commits (`E<n> T<m>:` subjects), which do not change.

## E. Risks and owner questions, ranked

1. **Plan author on sonnet with one opus review, or opus with review only when risky?** Recommend the first: it matches your tier table and keeps one independent read while nobody approves. Measurement 3 in B5 would change my mind if it shows more fix rounds downstream.
2. **In-flight work and legacy files.** Recommend finishing in-flight deliverables on 1.x and shipping a migration script that takes the legacy directory as an argument. Does a script that accepts that path as input still count as "total independence" for you?
3. **Artifact location.** Recommend `docs/plans/<topic>/{spec.md, plan.md, run.json}` with fixed names and reports in `docs/reports/`. This changes where people look for specs; confirm.
4. **May a high-cost, irreversible ruling stop a run?** Recommend yes (stop rule 3). The alternative is fewer stops and a larger possible rework.
5. **Plugin agents in `productivity-tools`.** This is the first use outside `sql-server-tools`, and `lint-plugin` must cover them. If the S0 probe fails, the fallback (test-synced constants in the workflow) costs cache sharing but nothing else.
6. **Subagents running scripts from the plugin cache.** This may raise a permission prompt in a worktree session [I]. Preflight should add the rule to `missingRules`. If it cannot be pre-approved, the tools are vendored into the roadmap folder like the checker.
7. **Builder check on opus.** Your policy forbids a reviewer below the author. Recommend opus now and measurement 4 later.
8. **Skill names.** `task-planner` sits close to `roadmap-planner` and `plan-coordinator`. Recommend keeping it and adding trigger cases to the plugin eval; rename if mis-triggers exceed one in ten.
9. **Interactive approval.** Recommend keeping one approval question in `spec-writer` and none in `task-planner` (it reports and offers plan-coordinator).
10. **Prompts start unmeasured.** The mitigation is S0's baseline plus the planted-defect gate in S5; without them, a quality regression would be invisible.
