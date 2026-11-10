<!-- Três revisões independentes feitas por subagents Fable em 2026-11-10 sobre a primeira redação do roadmap docs/plans/roadmap-evolucao-skills/. Gravadas sem edição pela sessão principal. Fonte SRC-10 do roadmap. As referências a números de entregável e de linha valem para a redação revisada, anterior às correções que estas revisões motivaram. -->


---

# Revisão 1: estratégia e pasta de acompanhamento (Fable 5.2, effort high)

The corrected roadmap is internally consistent on structure (tables, graph, symmetry, counts), but it still has 4 blocking defects and a set of coverage holes. Nothing was edited. All five gates were run and match their stated baselines.

## Findings, most serious first

### Blocking

**1. E5 criterion 5 needs E6's output (ordering inversion on the critical path).**
- Where: strategy, card E5, piece 4 and criterion 5.
- Wrong: E5 must leave zero "superpowers" in the planner and tracker skills, but half of those mentions point to the plan skill, which E6 delivers and whose name is still an open question.
- Evidence: `superpowers:writing-plans` appears in `roadmap-planner/SKILL.md:12` and `:158`, `decompose.md:57`, and the only tracker mention (`roadmap-tracker/SKILL.md:3`, the description). SRC-08 avoided this by putting the plan slice (S2) before the spec slice (S3); the roadmap inverted the order.
- Fix: move the `writing-plans` pointer swap and the "no occurrence" criterion to E6; keep in E5 only the `brainstorming` references.

**2. E13 criterion 2 hard-codes the answer to an open owner question.**
- Where: strategy, card E13, criterion 2 and the test file `migrate-artifacts.test.mjs`; `state.md` blockers.
- Wrong: piece 1 says whether a migration exists "depende da questão em aberto sobre DEC-005", yet the criterion asserts that old artifacts "chegam ao local definido" and "o plano resultante passa na checagem", as `test`.
- Evidence: DEC-005 discards "mantendo a leitura de planos antigos"; SRC-08 E.2 only asks. If the owner says no, the criterion is unsatisfiable and `roadmap-release` rejects a plan that changes a `{verify}` command.
- Fix: open a BLQ for the DEC-005 question (clarify.md §7 requires one when a question blocks a deliverable) and tag the criterion `{verify: blocked BLQ-n}` until answered. The blockers table is empty today.

**3. E5 piece 2 swaps the spec reviewer while the strategy says the review loop is unchanged.**
- Where: strategy, E5 piece 2, against Tese item 4, the last non-goal, E8 risk 1 and E11 piece 4.
- Wrong: the "leitura independente que devolve só as perguntas" is SRC-08 B5's "**Replace** the 3-round loop" with only the round count kept. Nothing says whether E8 runs it instead of, or on top of, today's rubric reviewer.
- Evidence: E8 risk 1 says "o laço atual de revisão de spec e plano é mantido nesta entrega". E11 piece 4 measures the questions-only reader in two models, never against the current reviewer.
- Fix: state that E5/E8 keep the current spec reviewer, and make the questions-only reader an arm of E11 piece 4.

**4. Must cards depend indirectly on Should card E10 for permission rules.**
- Where: strategy, E10 piece 4 and REQ-021, against E3 piece 5, E5, E6 and E8.
- Wrong: those Must cards have subagents run new plugin scripts unattended; the rules covering "os scripts do plugin" are only in E10.
- Evidence: SRC-07:73 says the release stops when a rule is missing; SRC-08 E.6 says preflight should add the rule. E8 depends only on E6.
- Fix: move the plugin-script half of E10 piece 4 into E3, the first Must that has a subagent run a plugin script, and list REQ-021 there.

### Requirement coverage (`requirements.md` and the cards)

**5. Requirements with a half no criterion addresses.**
- REQ-011: no E8 criterion covers reusing the preparation measurement; criterion 3 covers reviews only.
- REQ-013: the plan author's "nenhuma pergunta" is E6 criterion 4, but E6 is not listed. E9's new implementer has no no-ask criterion (criterion 5 only checks for "superpowers").
- REQ-017: says "cada skill", but no card covers `roadmap-release` (SRC-02 §4 names its repeated prose). "Cada regra em um só lugar" has no criterion anywhere.
- REQ-018: the closing-criteria check has no criterion; E3 criterion 6 tests only the contradiction rule.
- REQ-019: a bundle, not one testable statement, and no E13 criterion addresses it (only the definition of done). The checker line-1 rule in `roadmap-checker.md` is covered nowhere, though E2 changes the checker.
- REQ-015: omits the plan-author model, which E11 piece 3 measures.
- REQ-030: cites SRC-08, which never mentions adversarial verification; only SRC-02 §4 and §9K support it.
- Fix: split or extend each row and add the missing criterion.

**6. E1 pieces 3 and 4 trace to no requirement.**
- Where: card E1 (`reqs=REQ-001`), criteria 4 and 5.
- Wrong: REQ-001 covers tokens, cost, time and calls. The planted-defect detection baseline and the feasibility probes have no REQ, yet E8 criterion 6, E9 criterion 6 and DEC-006's revisit condition rely on them.
- Also: SRC-02 §9-I "pré-aprovação por hook" is probed in E1 but is neither a requirement nor marked out of scope.
- Fix: add two `measurement` requirements (sources SRC-08 S0; SRC-02 §8.3 and §10) and one row for the hook.

### Feasibility and criteria

**7. The fixed plan from E1 cannot run on the new coordinator as written.**
- Where: E7 criterion 7 and E12 criterion 3 ("Dado o plano fixo de E1").
- Wrong: E7's coordinator takes its map from the plan tool's data block; the E1 plan is made for today's coordinator. Handling plans without a data block is deferred to the E13 question.
- Fix: say in E7 that the fixed plan is re-emitted in the new format and the comparison records that.

**8. REQ-016 "num só módulo" conflicts with a documented runtime limit.**
- Where: REQ-016, E6 piece 2, criterion 3 and risk 3.
- Evidence: SRC-02 §7 says the workflow script has no `import()`; SRC-08 itself falls back to a copy plus an equality test.
- Fix: reword to "uma definição, com teste de igualdade" and add an `E6:` open question like E2's.

**9. Nothing pins routing to today's rules.**
- Where: E6 criterion 3 ("tabela de roteamento de exemplo"), E7 criterion 3, E9 definition of done.
- Wrong: SRC-08's `route()` keeps the release's reviewer rule (matches `reviewModelFor`, line 387) but drops two of the coordinator's three gate triggers (`routing.md` §4: score ≥ 7, haiku foundations). E9's "o modelo do revisor por tarefa permanece o atual" has no criterion.
- Fix: derive the fixture from `routing.md` §2–§4 and `reviewModelFor`, and add a `test` criterion to E9.

**10. E13 criterion 1 is self-defeating as worded.**
- Where: E13 criterion 1 ("o plugin inteiro… não há ocorrência").
- Wrong: the tests for E5 criterion 5, E7 criterion 5, E8 criterion 1 and E9 criterion 5 live inside the plugin and must contain the word. `flow.test.mjs` already has one occurrence.
- Fix: scope it to shipped non-test files.

**11. Wrong verify kind or non-behavioural criteria.**
- E1 criterion 2 is `test`, but passes only after the paid runs of piece 2. It also puts repo data under a published plugin and gives the baseline a second home besides `measurements.md`. Fix: make it `human`, or limit the test to the schema of a fixture.
- E2 criterion 4 ("usa o mesmo módulo… e não uma cópia") describes implementation. Fix: assert that preflight and checker return the same parse for the fixture.
- E8 criterion 4 and E9 criterion 4 each hold two criteria.

### Remaining instances of SRC-08 proposals presented as decided (item 4)

**12. Not decided by DEC-001 to DEC-008 and not listed as open questions:**
- Questions-only spec reader (finding 3).
- One round of questions and one approval in the interactive spec skill, none in the plan skill (E5 piece 3, criterion 4; E6 criterion 5). SRC-08 E.9 asks the owner.
- Two per-task reviews merged into one (REQ-014, E9); SRC-08 B5 "Merge". Guarded only by E9 criterion 6.
- Re-review restricted to findings and fix diff (E9 piece 2); no criterion.
- "Uma única onda de correção" in the final review (E9 piece 4, criterion 4). Today's workflow loops by round (lines 1796–1813), so this is a review-loop reduction not deferred to E11.
- One retry then infrastructure failure (E8 criterion 2).
- "Terminar na versão anterior" for in-flight deliverables (E8 risk 2, E13 risk 2); half of SRC-08 E.2.
- Version number 2.0.0 (E13); only SRC-08 S6, uncited.
- Non-goal "Compatibilidade com outros harnesses"; only SRC-08, uncited, and in tension with the portability policy in CLAUDE.md.
- Stop on a blocking person-only item (E8 piece 3) is attributed to DEC-007, which covers only contradicting a decision or changing a gate.

### Sources and conflicts (item 7)

**13. `sources.md` conflicts.**
- Seventh item misstates SRC-02: §6 line 100 already says "controlador sonnet deixou passar…", not a reviewer failure. What SRC-08 adds is that sonnet reviewers found 5/5. Fix: reword to that.
- First item, and the first open question, say the release reviews "cada tarefa em sonnet"; the code and SRC-02 §8.1 say sonnet by default, opus for blast radius 2, an opus implementer or an external task.
- Third item is labelled "SRC-06 vs SRC-02", but the second party is the `workflow-authoring` reference, which has no SRC row.
- Fifth item overstates: SRC-02 §6 says "mesmo resultado de execução" and does not attribute the figure to execution. Harmless, since no requirement uses the number.

### Lower severity

**14. Phase exits depend on lower-priority cards.** Phase 2 exit requires "a pasta nasce de um scaffold" (E4, Should); phase 5 exit requires "Medições registradas com decisão" (E11, Could). Fix: restrict exits to the Must cards.

**15. Gates.**
- G5's command is not in CLAUDE.md; it is the fallback in `validate-plugin/SKILL.md:34`, an unregistered source. The command itself is correct.
- G2 says "antes de cada commit" but only E13 cites it.
- E5 edits `formats.md` (line 215 mentions superpowers) and omits G4, whose trigger is any change to the format contract.
- E11's definition of done cites only G1 for a change that would touch the plugin.
- The E1 open question says "G1 só cobre testes sob `plugins/`"; G1 also covers `.claude/hooks/`.

**16. Untraced or mismatched statements.**
- E12 risk 3, "o mapa já limita a largura da onda": no piece or criterion in E6/E7 sets a limit. Today it is prose in `plan-coordinator/SKILL.md:75`.
- E5 risk 2 says E8 "bloqueia a integração… se piorar"; E8 criterion 6 blocks only on detection.
- E10 piece 3 (structured gate output) is not in SRC-02 §4 or §9F.
- E3 and E4 both create `prose-budget.test.mjs` with no order between them.
- E6 piece 3 (brief per task) has no criterion.

## Checked and found correct

- **Requirement-to-card symmetry**: all 30 rows match in both directions; the 26/2/2 coverage count is right.
- **Dependencies**: card `depends`, overview table, panel and the 20 Mermaid edges agree; no card sits in an earlier phase than a dependency.
- **Critical path**: E1, E5, E6, E8, E9, E12, E13 is the unique longest chain (7) and matches the `critical` attributes.
- **No direct Must-to-Should dependency**; priorities match DEC-008.
- **Gates**: G1–G4 match CLAUDE.md and `roadmap-checker.md` verbatim. Run today: G1 717/717 pass, G4 0 errors 0 warnings, G2 and G3 pass, G5 39 OK. The roadmap's own checker gives 0 errors, 3 expected warnings.
- **Numbers**: 31 transitions, about nine files, about ten calls, the 2/3/3 minimum runs, the superpowers counts (10/1/24/5) and plugin version 1.6.0 all trace to source or repo.
- **Verify commands**: every one is G1 narrowed to a file the card names; existing files exist and new paths fit the layout, except those in findings 2 and 11.
- **Assumption 4** is in SRC-07:53; SRC-07:92 says "medido no release".
- **Conflicts** 2, 4, 6 and 8 are accurate.
- **Consistency**: `state.md`, `critical-path.md`, the phases table, strategy section order and the README agree with one another and with `formats.md`.

## Could not verify

- SRC-01 (the brief is not on disk).
- SRC-05 and SRC-06, and SRC-08's line citations into the superpowers cache and release notes.
- SRC-02 §9A figures against the transcripts.
- Whether the checker can detect reuse of a closed identifier from one snapshot (E2 piece 2).
- Whether E8's resume skip can persist approvals before E9's run record exists; SRC-08 has the same ordering.


---

# Revisão 2: pesquisa contra as fontes e script de métricas (Fable 5.2, effort medium)

Most of the report holds against the sources, but five claims the roadmap leans on are wrong or overstated, and four of them sit in section 9A. I reran `skill-runs.mjs` (349 runs, same as the report), ran the test suite (717/717 pass), and fetched the live doc pages for Part C.

## Wrong or overstated, most consequential first

| # | Section | Claim | What the source says | Correction |
|---|---|---|---|---|
| 1 | 9A, "Leituras" | "o registro no tracker custa mais que qualquer revisão isolada" (tracker/registro 15%) | The 15% bucket comes from the role regex at `skill-runs.mjs:88`, which lumps `status-*`, `progress`, `review-log*` and the final `report` agent. Split by label: plan-only is `status-plan` 8.8% + `report` 6.4%; full sandbox is `status-*` 6.3%, `report` 2.7%, `review-log*` 3.8%, `progress` 1.7%. | Tracker status records are about 9% (plan-only) and 6% (full; about 9% counting the docs stage, which also calls the tracker). That is below plan review (12% / 9%) and spec review (10% / 7.5%). The sentence is false as written. |
| 2 | 9A, sufficiency | plan-only "suficiente: 21 execuções, mesma cópia da skill" | The 21 runs load six different skill copies, named like commits: `A_9c5a946` (4), `B_bf9d948` (3), `C_6ab9bf9` (3), `D_8eae04a` (6), `E_aae7825` (3), `F_cb042a4` (2). None is HEAD (`3fbb59b`). One run errored at $0.34 with one agent. | It is a regression series of 2–6 runs per version, not 21 repeats of one copy. Costs are stable across versions ($2.0–2.8), so it works as an approximate baseline. A before/after comparison still needs 3+ runs on the exact starting commit. |
| 3 | 9A, cost method | "tabela de preços de §7 com escrita de cache a 1,25x" | The pricing page gives cache reads at 0.05x for Opus 5.5 and Sonnet 5.5, and 0.025x for Fable 5.1/5.2; `skill-runs.mjs:43` uses 0.1x for all. 1-hour cache writes cost 2x; every main-session cache write in the data is 1-hour, priced at 1.25x. Fable 5.1 (57 agents) is $10/$50, priced as $8/$40. | Absolute dollars for the interactive skills are about 30% too high. Repriced medians (EXT): plan-coordinator 32.6 (was 46), planner 28.3 (was 38), tracker 3.4 (was 5.1), release plan-only 2.13, release full 6.85. Shares barely move, but the ratio of interactive skills to release shrinks. |
| 4 | 9A, table | "roadmap-release completo em sandbox: 9 execuções", 46 subagents | Each "run" is a session. Six of the nine contain 2–3 workflow launches (stop, then resume), and two include a four-deliverable launch (E1–E4, 87 agents). A single completed E4 launch is 29–35 agents. | The row is per session, not per deliverable or per launch. The "insuficiente" verdict is right; the 7.2 and 46 medians should not be quoted as per-deliverable figures. |
| 5 | 3 | "O workflow já confere o resultado depois (`cardStatus`)" for tracker calls | Only the docs stage is measured independently (`roadmap-release.js:1341`, `:1352`). `recordStatus` (`:1172-1182`) trusts the agent's own `checkerErrors` (`:1581`, `:1589`). | True for docs, not for status records. A deterministic tracker CLI would add a check that does not exist today for status records. |
| 6 | 9A, coordinator roles | reviewers "quase todos opus" | 291 opus, 87 sonnet, 8 fable of 386 review agents. | About 75% opus. The role itself is a regex on free-text descriptions (`skill-runs.mjs:96`), so the 26% is approximate. |
| 7 | 7, evaluation | "Tokens por execução não são campo de saída" | The page lists only "the fields a gating script usually reads" and says the document carries more (code.claude.com/docs/en/plugin-evals). | Not established by the page. Also: there are six grader types (the report omits `file_exists`), and `/skill-doctor` is not mentioned on that page. |
| 8 | 7, hooks | PreToolUse `allow` is "a única pré-aprovação determinística que um plugin embarca" | `allow` "skips the permission prompt", but deny and ask rules are still evaluated, and in plan mode a workflow does not start on the hook's approval alone (hooks and workflows pages). The workflows page lists the hook route only under `claude -p` and the Agent SDK. | "Can pre-approve" is confirmed with those caveats. "Única" is not something either page says. Whether the hook skips the interactive per-run workflow dialog is not stated. |
| 9 | 4 | "~22 chamadas por entregável… mais ~3 por tarefa extra" | Completed single-deliverable sandbox launches with two tasks have 29–31 agents; plan-only has 9. | The estimate runs about 20% low against measured runs. |
| 10 | 1 | Size table totals | Current tree: roadmap-release is 553,095 bytes (545,611 as git blobs), not 518,885; roadmap-tracker is 178,468, not 178,264. | Totals for those two are stale or mis-summed (release by about 6%). Every per-file figure, line count, and the planner and coordinator rows match. |
| 11 | 4 | "51 ocorrências de `agent(`… 6 dinâmicas" | 51 textual matches, 3 of them in comments, so 48 calls. 40 have literal models; 8 are dynamic. | Cosmetic. |
| 12 | 9A, real release row | 4.8 / 0.4, 15 min, 7 subagents | That session has grown since: 13.7 / 0.43, 39 min, 49 subagents, two launches both ending `needs-operator`. | Stale; the "em andamento" flag was right. |

Other things in the script that bias numbers, none of which changes a verdict:

- **EXT windows:** a tool-called `writing-plans` or `brainstorming` after plan-coordinator does not close its window (`skill-runs.mjs:279`), so later planning work in the same session is charged to the coordinator. The 46 vs 34 spread reflects this.
- **Peak context:** it is the session's context, not what the skill added.
- **Double counting:** one coordinator run sits entirely inside another ($170 of $4,281). Nested runs are reported separately and do not inflate the main rows.
- **Linking:** five workflow launches could not be linked to transcripts, and seven launches are counted in two runs.
- **Dedup and verification:** de-duplication by `message.id` is sound. The cost-state check now gives 37 exact of 155; 23 sessions are below 80%.

## Confirmed

- **Tracker subagent per status record:** `roadmap-release.js:1172-1179` (sonnet/medium, uses the tracker skill), called at `:1580`, `:1586`, `:2018`; docs stage at `:1343-1351`.
- **Resume re-runs reviews:** spec and plan loops are unconditional (`:1469`, `:1540`), as is the final loop (`:1799`). The run token sits in the first call (`:951`, comments `:780-782`); `operator.md:77` says "every stage runs again". The live workflows page confirms that a changed prompt reruns every later agent.
- **Plan transcribed then re-read:** the plan agent returns the JSON (`:1520`); the reviewer re-reads the rows (`:1546`), compared by `evidenceRowGaps` (`:1559`). The transcriber is the plan-writing agent itself, not a separate one.
- **Per-task review runs two loops:** `for (const kind of ['spec', 'quality'])` at `:1740`.
- **Reviewer model conflict:** `reviewModelFor` defaults to sonnet (`:387-389`); `routing.md:53` fixes opus "without measured evidence"; the design doc `:92` says sonnet was measured. Your global routing policy already records this split as intentional, so it is a known experiment, not a discovered conflict.
- **Checker gaps:** all ten rules are absent from `check-roadmap.mjs`. The CLI accepts only `--version` and `--require-git` (`:916-921`). `formats.md:64` and `:263` admit two of the gaps themselves.
- **BLQ reuse invisible to the checker:** definitions come only from current `state.md` rows (`:568`), with exemptions at `:587` and `:589`. The prose does forbid reuse (`events.md:33`, tracker `SKILL.md:134`), so the gap is enforcement only.
- **plan-coordinator:** four markdown files, no scripts or tests; 31 rows at `delegation-protocol.md:25-55`; no "never ask" line anywhere in the skill.
- **`preflight.mjs:78-99`** copies `scanComments` from the checker (`:98-117`) and says so. Discovery is a third, LLM-based parser (`:951-962`).
- **Other line citations checked:**
  - planner `SKILL.md:63`, `:73`, `:91`, `:116`, `:146`;
  - tracker `SKILL.md:23`, `:33`, `:83-99`; `events.md:57`, `:263`, §9, §10, §19;
  - release `SKILL.md:13`, `:41-47`; `operator.md:38-47`; `config.md:54`;
  - workflow `:270`, `:486`, `:810`, `:868`, `:1047`, `:1230`, `:1325`, `:1877`.
- **Section 1 counts:** superpowers mentions (10/1/24/22/5), model literals (15/15/10), two `parallel` uses, 717 tests, checker line 1 at 1.5.0.
- **Planner draft gap [inferido]:** supported; the draft holds DEC and REQ rows but no cards (`SKILL.md:85`).
- **Part C, live pages:**
  - no filesystem or shell from the script;
  - plugin `workflows/` folder or manifest field, run as `/<plugin>:<meta.name>`;
  - `Workflow` and `AskUserQuestion` removed from all subagents;
  - `claude plugin eval` at v2.1.269+, three runs per arm, with `aggregates.overallScore`, `aggregates.meanDelta`, `costUsd`, `durationSeconds`.
- **Also seen on those pages:** five schema attempts, 16 concurrent / 1,000 agents, the 25-agent / 1.5M-token warning, alias-only model, effort from v2.1.292, `omitClaudeMd` from v2.1.271, depth 3, 20 concurrent, `updatedInput` replacing the whole input, plugin hooks running in subagents, base input/output prices.
- **9A rows that reproduce:** planner, tracker, plan-coordinator (turns 124, subagents 17 after drift), plan-only, full sandbox, the three comparison skills, and both role lists as bucketed. Verdicts for full release, coordinator (five versions), planner (three versions) and tracker (two versions, TURN range 0.34–38.7) hold.

## Not verified

- Section 6 (superpowers) was out of scope.
- **Section 2:** "5 lugares" for the question budget, "~250 linhas" of templates, "cerca de 9 arquivos".
- **Section 3:** the 15–20% repetition estimate and "~20 passos mecânicos".
- **Section 4:** "~10 delas são git ou medição".
- **Section 5:** "5 lugares" and "6 rodadas".
- **Section 8.1:** that the sonnet measurement is absent from the repo.
- **Section 7:** only the five requested claims plus what the same pages showed. I did not fetch the skills, prompt-caching, agent-teams, permission-modes or engineering pages. The hooks page was read from 100k to 200k characters only, and the sub-agents page to 100k.

## What this weakens for the roadmap

- **Opportunity B (tracker CLI):** the cost argument is weaker. Tracker calls are 6–9% of release cost, not the largest single slice. The harness argument is stronger than the report says, because status records are currently unverified.
- **Opportunity A (baseline):** the plan-only series is usable but spans six commits, none at HEAD. Any dollar target copied from 9A for planner, tracker or coordinator should come down by about 30%.
- **Opportunity F (resume):** the code claim stands, but the saving is unmeasured. The sandbox shows a resumed launch using 31–35 agents against 29–31 for a fresh one, which is consistent with it but mixed with other causes.
- **Opportunity I (hook pre-approval):** it is documented for headless runs. For interactive sessions the documented route is "don't ask again", offered only when a plugin workflow is run by name, which the release skill does not do today since it launches by script path. Not being the "única" route also means a permission rule (`Workflow(<name>)`) is an alternative.
- **Opportunity I (missing "never ask" line):** low impact, since subagents cannot call `AskUserQuestion` at all.
- **Unaffected:** "implementing is the smallest slice" (3%, toy deliverables), "main context is the largest share" for coordinator and planner (45% and 63% after repricing), and Opportunities C, D, G and H.

My scratch files are in `<scratchpad da sessão>\review\`; the repriced run is in the `y` subfolder and the per-label breakdown comes from `an.mjs`. Nothing in the repo or `.claude` was changed.


---

# Revisão 3: viabilidade do roadmap como plano de trabalho (Fable 5.2, effort medium)

## Engineering review: roadmap "Evolução das skills de roadmap" v1.0

Read-only review; nothing was run except `git ls-files --eol` and directory listings. Tags: **[V]** = checked by me in a file, **[R]** = stated by the research report and not re-checked, **[I]** = my inference.

Paths used below:
- Strategy: `D:\projects\claude-play\docs\plans\2026-11-10-roadmap-evolucao-skills.md`
- Research: `D:\projects\claude-play\docs\reports\2026-11-10-evolucao-skills-roadmap-pesquisa.md`
- Proposal: `D:\projects\claude-play\docs\reports\2026-11-10-skills-nativas-spec-plano-proposta.md`
- WF: `D:\projects\claude-play\plugins\productivity-tools\skills\roadmap-release\workflow\roadmap-release.js`

## Goal coverage (question 1)

| Goal | Moved by | Size against measured shares (§9A) | Verdict |
|---|---|---|---|
| Fewer tokens, release | E3 (record, 15%), E9 (one per-task review, about 6% plus the unmeasured quality loop), E10 (git and gates, about 5 to 9%) | About a quarter of a full run at best | Spec, plan and their reviews are 37% of a full run and 59% of plan-only, and are frozen until E11 (Could, last) |
| Fewer tokens, coordinator | E12 (main context, 42%) | Large, but at position 12 of 13 | E7 barely touches the 42%; opus reviewers (26%) wait for E11 |
| Fewer tokens, planner | E4 (Should) | Small: main context is 65% over 44 turns with a 424k peak; the scaffold saves output tokens only | Under-served |
| Faster | E9, E10 (Should), E8 on resumes only | Unmeasured; `maxParallel` stays 1 on a generated config (open question) | Weak; no criterion measures wall-clock |
| Deterministic harness | E2, E3, E4, E6, E7, E10 | Strong | Best-served goal |
| Judgment where needed | E3.4, E4.3, E9.4, E11 | Rubrics are in; model and loop policy is deferred | Adequate if E11 runs |
| Workflow orchestration | E12 only | — | Thin; the planner gets none |
| Autonomous subagents | E5, E7.3, E8.3 | Permission prompts, the real cause of stalls, sit in E10 (Should); the hook pre-approval is probed in E1 but no card builds it | Gap |
| Native spec and plan | E5, E6, E8, E9, E13 | Complete | Good |

## Findings, ranked

### 1. No rule says which version executes the roadmap; today it is 1.6.0 from the cache until E13

- **Evidence [V]:**
  - `~/.claude/plugins/known_marketplaces.json` has `claude-play` sourced from GitHub; the cache holds 1.4.0 to 1.6.0.
  - The skill builds `scriptPath` from its own base directory (`roadmap-release\SKILL.md:29`).
  - The workflow tells subagents to use the installed `productivity-tools:roadmap-tracker` (WF:1176, 1347) and `superpowers:brainstorming` / `writing-plans` (WF:1458, 1507).
  - The strategy publishes only at the cut (line 488).
- **Consequences [I]:**
  - All 13 deliverables are run by the old pipeline, so no gain is felt during the roadmap.
  - Superpowers must stay installed until the end.
  - The new pipeline's first real use comes after a big-bang 2.0.0.
- **Conflict with repo rules [V]:**
  - Any checker change requires a plugin bump plus a new line 1 (`.claude\rules\roadmap-checker.md:9`), so E2 must bump mid-roadmap.
  - E2, E3 and E4 in parallel will all touch `plugin.json`, the README row and line 1.
- **Change:** add a "Bootstrapping" section to the strategy with these rules:
  - Each deliverable is executed by the published version recorded at its start; a run in flight finishes on the version that started it.
  - Publish backward-compatible increments (1.7 after E2 and E3, 1.8 after E10) so later deliverables run on them; 2.0.0 is only the breaking cutover.
  - One owner of the version bump per release-branch merge; deliverable branches never bump.
  - The vendored `check-roadmap.mjs` in this roadmap's folder is refreshed only by the tracker after a publish.
  - Rollback is `claude plugin install …@<previous>`, with the previous version folder kept.

### 2. The measurement criteria cannot be executed by the unattended release, and they do not gate the merge the cards say they gate

- **Evidence:**
  - `Workflow` and `AskUserQuestion` are removed from every subagent (§7 [R]), so no implementer task can run `roadmap-release`, `plan-coordinator` or the interactive planner as a measured run.
  - A plan task that edits the roadmap folder is a plan-review defect (WF:1544 [V]), so no task may write `measurements.md` or `decisions.md`.
  - A `{verify: human}` criterion does not block the merge: the workflow merges and emits `human-act` afterwards (WF:2040-2041 [V]).
  - The cards claim otherwise: E5 risk "bloqueia a integração de E8 se piorar" (line 228) and E9 risk "o critério 6 bloqueia a integração" (line 353).
- **Scope:** E1.3–5, E3.6–7, E4.4–5, E5.3–4, E6.4–5, E7.7, E8.6, E9.6, E10.5, E12.3 and E13.4 are all of this kind.
- **Change:**
  - Take paid runs out of the engineering cards. Each engineering card ends at "on the release branch, tests green".
  - Add a measurement checkpoint card after each phase (owner-operated, track `measurement`) that runs the scenario and records the comparison.
  - Reword the "blocks integration" risks to "blocks the next publish, or the release-branch to main merge", which is the gate the owner really holds.

### 3. The feasibility probes decide the architecture of E2, E3, E5, E6, E8, E9 and E12, but sit as piece 4 of E1, and E2 does not depend on them

- **Evidence [V]:**
  - Strategy lines 32-34: three unverified assumptions.
  - E2 has `depends=-`.
  - The proposal's fallback for a failed script probe is "tools are vendored into the roadmap folder like the checker" (E.6), which changes the E2 and E3 design: the CLI would also have to be a single vendorable file.
  - Today the record stage runs `node ${disc.checker}`, a repo-relative path that one stable permission rule covers (WF:954, 1178).
- **Inference [I]:** a CLI under `cache/<version>/` loses that property, because a path-specific allow rule stops matching after each version bump.
- **Change:** new **E0 "Sondas"**, with no code merged and decisions only, before everything. Probes:
  - plugin agent via `agentType` in a workflow;
  - subagent running a plugin script by absolute cache path under the owner's real permission mode, including after a version change;
  - Workflow consent;
  - hook pre-approval;
  - digest-courier mismatch rate (finding 7);
  - whether a workflow script can share code at all.
  
  E2, E3, E5 and E6 depend on E0, not on E1's paid baseline.

### 4. Three deliverables need "one source, several single-file artifacts", and none owns the mechanism

- **Evidence:**
  - The checker is a single file with no local imports (`check-roadmap.mjs:3-8` [V]).
  - Preflight carries a hand copy of `scanComments` (`preflight.mjs:78-80` [V]).
  - The workflow script has no `import()` ([R] §7), and its testable code lives between `// <pure>` markers that `load-pure.mjs` extracts ([V]).
  - E2 leaves "how" open (line 506); E6 wants one `route()` for tool and workflow; E12 will need the authorization, fingerprint and mark functions that the release already has.
- **Change:**
  - Add piece 0 to E2: a generator that inlines `lib/*.mjs` between markers into the checker and the workflow scripts, plus a test that fails when a committed artifact is stale.
  - Settle the E2 open question now with that answer.
  - E6 and E12 reuse it. Without it, E12 duplicates the most-fixed code in the repo (about 40 recent fix commits, §1 [R]).

### 5. The largest release share is frozen behind a Could deliverable placed last

- **Evidence:**
  - §9A: spec 9%, plan 11%, spec review 8%, plan review 9% of a full run; 17, 20, 10 and 12% of plan-only.
  - Loops and models stay "como estão" until E11 (non-objective, line 25; line 504).
  - WF:1467-1487 and 1521-1560 [V]: opus author plus up to three opus review rounds for each document.
  - E5 and E6 remove only the transcription and about 2 to 3K instruction tokens (proposal B7).
  - Coordinator reviewers (26%, opus) are in the same position.
- **Change:**
  - Make E11 Must and split it. **E11a** covers spec and plan (loop against a single read, plan author model) and runs right after E8; it needs only native authors plus planted plan defects. **E11b** covers the per-task reviewer model and runs after E9.
  - Build the planted plan defects in the baseline card so E11a is not waiting on fixtures.

### 6. E8's "skip reviews on resume" depends on a ledger that the roadmap puts in E9, and its skip condition is incomplete

- **Evidence [V]:**
  - `runToken` in the first `agent()` call defeats the cache on purpose (WF:780-782, 951; `operator.md:77`).
  - Approval state exists only as a prose review log written by sonnet (WF:1217-1221) and read back by sonnet (WF:1230).
  - The review loops are unconditional (WF:1469, 1540).
  - The proposal's skip reads `run.json.approved.{specBlob, planBlob}` (B6), but the machine-written ledger is E9 piece 3.
  - The final review runs after a sync with the validated target tip (WF:1781-1783), so "document and branch unchanged" is not sufficient.
  - The plan review is also where `measuredPlanBlob` and `evidenceRows` are measured (WF:1546, 1559).
- **Inference [I]:** recording an approval as a commit moves HEAD, so the skip key must be a tree, a blob or a parent, never HEAD.
- **Change:**
  - Move the ledger script (E9 piece 3) into E8.
  - Reword E8 criterion 3 to: "spec blob, plan blob, branch tree and synced target tip equal those recorded at approval".
  - Add the negative criterion: "target advanced, so the final review runs".

### 7. Digest-verified plan loading is sound in principle but unproven at size, and the digest does not bind the file

- **Evidence:**
  - The proposal (B3) has an agent return `{plan, digest}` and the code recompute FNV-1a.
  - The current design needs an opus transcription and an opus re-read for the same job (WF:1520, 1546 [V]).
- **Inference [I]:**
  - A model relaying several KB of JSON verbatim through a schema will sometimes alter a character, and the card allows one retry before `infra` (E8 criterion 2).
  - As written, the digest covers `plan` but not `blob`, so a courier that ran `emit` in the wrong worktree still passes.
- **Change:**
  - Include `blob` and `planPath` in the digested object.
  - Emit only the fields code acts on; prose stays in the file.
  - Use a digest per task so a retry is partial.
  - Measure the mismatch rate in E0 (20 relays of a 10-task fixture) and set the retry count from that.

### 8. E7 builds a validated state machine for a lifecycle that E12 removes

- **Evidence [V]:**
  - The coordinator's states rest on in-flight agent IDs, `SendMessage` continuation and `Review owed` (`plan-coordinator\references\delegation-protocol.md:21, 118, 182`); a workflow has none of these.
  - E12 says "a skill vira uma entrada curta" (line 420).
  - E7 also pays for a behavioural test and a paid main-context comparison (criterion 7) of an intermediate form.
  - The 14K static prose is small beside a 504k peak over 123 turns (§9A).
- **Inference [I]:** per-transition script calls add turns to the main context.
- **Change:** keep DEC-006's two steps but shrink E7 to what survives:
  - map and briefs from `plan-tool`;
  - a state schema with transitions as pure functions, usable from a CLI and from a workflow `<pure>` block;
  - the tracker contract test.
  
  Drop piece 4's protocol rewrite and criterion 7; move the prose work and the paid comparison to E12. If E0 shows Workflow consent works unattended, let the owner revisit DEC-006 (its own "revisitar quando").

### 9. Parallel deliverables collide on the same files, in the most fragile area

- **Evidence [V]:**
  - E3 and E4 have the same dependencies and both create `plugins/productivity-tools/scripts/prose-budget.test.mjs` (lines 153, 185).
  - E3 piece 5, E8, E9, E10 and E12 all edit the 2,092-line `roadmap-release.js` or its 2,636-line `flow.test.mjs`.
  - E10 depends only on E2 and E3, so the selector may run it beside E8 or E9.
- **Change:**
  - Add the edges E8 → E10 (or E10 → E8) and E3 → E4, or declare a `workflow-file` lock in `release.config.json` and name it in the cards.
  - Give each card its own test file; one `prose-budget` harness is created in E3 and extended later.

### 10. The baseline cannot detect the gains claimed

- **Evidence:**
  - Run counts are 2 (full release) and 3 (coordinator, planner) per variant (line 88).
  - Observed spreads: full sandbox 0.5 to 21 around a median of 7.2; coordinator 3 to 368 (§9A).
  - "Uninterrupted" baseline runs contain no resume, so E8's headline gain is invisible.
  - The sandbox card has few tasks (implementers 3%), so E9's gain is measured on about a 6% slice.
  - "Detection not lower than baseline" has no trial count or margin.
  - The planner is interactive, so a human adds variance.
- **Inference [I]:** on those run counts a median of 2 or 3 gives no variance estimate, so only differences of roughly 2x would be credible.
- **Change:**
  - Make the primary metrics deterministic counters per role: agent calls by model, prompt bytes sent, review rounds.
  - Report cost as median with range, as a secondary metric.
  - Use at least 5 runs where a run is cheap (plan-only costs about US$ 2).
  - Add a scripted stop-and-resume scenario and a card with at least 4 tasks.
  - Use scripted answers for the planner.
  - Pin and record the superpowers version, the model IDs and the price table.
  - State the detection rule as at least 20 defect-trials per arm with a named margin.
  - After the baseline, the owner sets targets through a strategy revision. "Menor que a medida" (E3.4, E4.3, E7.6) passes with a one-byte cut.

### 11. Granularity: four cards are too big for one spec and one plan

- **E1:** tool, paid runs, defect set and probes in one card. Split into E0 (probes), E1a (extractor, automatic) and E1b (baseline and planted defects, owner-operated).
- **E3:** 5 pieces, 7 criteria, 3 skills. Split into E3a (CLI plus the release recording through it, which is where the 15% is) and E3b (lean tracker skill plus rubrics, behavioural).
- **E6:** split into E6a (schema, `plan-tool`, `route()`, map and brief; pure code that needs only the `spec/1` schema, as in the proposal's S1 order) and E6b (author agent plus interactive skill).
- **E5:** split the same way (tool, then author). E6a and E7 can then start in parallel with the spec author instead of after it.
- **E9:** split into E9a (implementer plus single reviewer, gated on detection) and E9b (adversarial verification in the final review, one fix wave).
- **E4:** piece 4 (prose dedup) is small and can merge into piece 3.
- **E12:** underspecified, not too big. It has three criteria for a job that cost the release its whole authorization and resume test suite; it needs criteria for resume after a stop, authorization bound to the plan fingerprint, and a fix round never re-running an effect.

### 12. Work no card holds

- **Writer fidelity (E3):**
  - The checker normalises CRLF, BOM and NFC on read (`check-roadmap.mjs:27-29` [V]).
  - The fixture folder has mixed working-tree line endings (`strategy.md` and `roadmap.config.json` are CRLF, the rest LF [V]).
  - Status cells are multi-segment text such as "code: on-branch; acceptance: blocked (BLQ-2)" (WF:957 [V]).
  - Change: add a criterion "bytes outside the touched lines are identical, for LF and CRLF inputs, including a segmented status cell"; the writer splices lines and never re-serialises.
- **Skill-triggering evals:** two new skills with names close to three existing ones (proposal E.8); no card uses `claude plugin eval`. Add an eval suite as a gate in E5 and E6.
- **Lint and repo docs:** `plugins/productivity-tools` has only `skills/` today [V]. New `agents/`, `workflows/` and plugin-level `scripts/` need `lint-plugin` coverage and a `CLAUDE.md` layout update, and G5 will not check them until then.
- **Migration:** E13 covers specs and plans only. Coordinator progress files change from markdown to JSON in E7, with runs in flight in 8 projects (§9A), and the tracker reads them (`events.md` §14 [V]). Add a rule or recipe, and one for `release.config.json` if its shape changes.
- **Permissions:** `missingRules` cannot see `{verify}` commands (`SKILL.md:23` [V]) and the fix is in E10 (Should). Every card of this roadmap uses `node --test …`; the owner should add that rule by hand before the first run, and REQ-021 should move to Must.
- **Hook pre-approval:** probed in E1 but built nowhere (opportunity I of the research).
- **User-facing changelog and upgrade note for 2.0.0:** add to E13 piece 2.

## Sequencing answers (question 2)

- **Baseline first:** right for the extractor and the scenario; wrong to let paid runs block E3 and E5. Only the probes must precede everything.
- **Spec before plan:** right for the authors; unnecessary for the tools (finding 11).
- **Tracker CLI and checker against the native line:** independent of each other; run them in parallel, subject to the file collisions in finding 9.
- **E7 then E12:** partly throwaway (finding 8).
- **Review policy last and optional:** the costliest ordering choice in the plan (finding 5).

## Verdict

**Change before starting E1:**
1. Write the bootstrapping and version rule, and decide on incremental publishes (finding 1).
2. Create E0 for the probes and re-point the dependencies (finding 3).
3. Separate paid measurement from engineering cards and correct the "blocks integration" wording (finding 2).
4. Fix the baseline design: counters, a resume scenario, a multi-task card, run counts, a detection rule (finding 10).
5. Add the dependency edges or lock for the workflow file and the shared test file (finding 9).
6. Decide the single-file generator, which answers E2's open question (finding 4).

**Can wait until the phase arrives:**
- the E3, E5, E6 and E9 splits (at each card's spec);
- moving the ledger into E8 and rewording its criterion 3;
- trimming E7;
- promoting and splitting E11 (must be settled before E8 ends);
- E12's extra criteria;
- the missing items in finding 12, except the permission rule, which is needed for the first run.

**Verified in code or files:** WF line references, the `SKILL.md`, `operator.md`, checker, preflight, `load-pure`, delegation-protocol and `events.md` references, line endings, the installed marketplace source and cache versions, and the plugin directory layout.

**Taken from the research without re-checking:** Workflow runtime limits (no import, no filesystem, no Workflow tool in subagents) and the §9A numbers.

**Inferred:** the courier mismatch rate, permission-rule behaviour across cache versions, E7's effect on main-context cost, and the statistical power statements.
