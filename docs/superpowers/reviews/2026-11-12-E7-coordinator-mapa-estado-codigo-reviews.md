# E7: coordinator, mapa de estado em código, registro de revisões

Execução de 2026-11-12 (branch `feat/E7`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante registrado (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, - | nenhum | 3 | nenhuma |
| plan | 1: opus, - | nenhum | 3 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 3 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, -; 2: sonnet, correção sonnet | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 2 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 2 | nenhuma |
| T6:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T8:spec | 1: sonnet, - | nenhum | 2 | nenhuma |
| T8:quality | 1: sonnet, - | nenhum | 1 | nenhuma |
| T9:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T9:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| final | 1: opus, -; 2: opus, correção sonnet; 3: opus, correção sonnet | nenhum | 2 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | esquema progress/1, initState e nextAction (critério 3 na lib) | DONE | 1 |
| 2 | applyEvent -- execução, passos não externos e portões (critério 1) | DONE_WITH_CONCERNS | 1 |
| 3 | applyEvent -- passos externos e respostas manuais | DONE_WITH_CONCERNS | 2 |
| 4 | CLI progress.mjs -- init, next, apply, show (critérios 2, 3 e 7 pela CLI) | DONE_WITH_CONCERNS | 1 |
| 5 | seleção de plano por padrão (select, critério 4) | DONE | 1 |
| 6 | tracker close-from-state e teste de contrato (critério 5) | DONE | 1 |
| 7 | prosa do coordinator sobre a CLI e proibição de perguntar (critério 6) | DONE_WITH_CONCERNS | 1 |
| 8 | routing.md remete a lib/routing.mjs; tracker lê progress.json | DONE | 1 |
| 9 | documentação do caminho do estado e gates finais | DONE | 1 |

Falha da execução: nenhuma.

## Entradas humanas

Nenhuma.

## Concerns (transcritos como registrados)

### T1
Choices where the plan was silent. (1) nextAction considers external steps for prelaunch-review and authorize only when their dependencies are satisfied, and treats any preLaunchReview other than 'pass' as needing review. (2) If the current wave has pending steps but none can start, it returns an ask with a Portuguese question, instead of looping. (3) The hold check applies to pending steps of the current wave only, and a skip with outputs null counts as no outputs. Tasks 2 and 3 may refine these. G4 and G5 were not run because nothing under the roadmap checker or the lint scope changed.

### T2
1) The wave gate becomes owed only when the current wave has no step pending, launched or review-owed. The plan says only launched or review-owed. With the literal rule, inline steps (which run one at a time) would owe a gate after each step and block the next inline-start with wave-order. The same would happen on a retry that sends a step back to pending. This is an autonomous decision, recorded here for the owner with status pending.
2) Invalid `value`s are refused as wrong-status with a descriptive message. That covers a bad value for report, review-result, inline-result, wave-gate, final-gate and skip, and a missing sha on commit. I added no new refusal code, because the plan's code list is exact.
3) For final-gate defects with a step, the step goes back to pending and run.wave is set to that step's wave, so launch can follow. The plan does not specify this.
4) `wave-gate fail` with no `step` changes nothing and keeps the gate owed.
5) `hold` on a step that already has a held, waiting or stopped dependency marks it waiting-manual with no manual entry.
6) release of a skip-manual step closes the step's open manual entries but does not check whether its dependencies are held.
7) The G1 check was a single run with exit 0, 1444 tests, 0 failed, 0 skipped. The 1444 total is the baseline of 1421 plus the 23 tests in the file.
8) G4 (check-roadmap on the valid fixture) was not run for this task, because the plan's Step 5 lists only G1, G2 and G3. G5 was run in addition.

### T3
I made these decisions where the plan table was ambiguous, and they need owner confirmation. The other items in the list below are coherence gaps the plan leaves open.

1. `prelaunch-review defects` increments `rounds` and then holds the step as `prelaunch-failed` once `rounds >= 2`, so the second defects event holds it. I took this from the test name "defects twice holds". The plan text "com rounds 2" could instead mean a third defects event.
2. `answer no` closes the manual entry (`open: false`) and reclassifies its kind to `refused`. `authorize` from `skip-manual` looks for any entry of kind `refused` or `not-named` for the step, open or not.
3. `answer rerun` replaces n with N in `waves[].tasks` (a literal reading of "waves passam a apontar N"). The old step keeps its own `wave` field.
4. `answer value` is accepted only on `skip-manual`. `answer done`, `no` and `rerun` apply to `stopped`, and `done` and `no` also apply to `skip-manual`. Any other combination gives `wrong-status`.
5. Dependents of a `stopped` step are not marked `waiting-manual`. `nextAction` still reports `hold` for them, which matches the Task 2 behaviour.
6. When `authorize` moves a step from `skip-manual` to `pending`, its `waiting-manual` dependents stay `waiting-manual` until an explicit `release`. The plan does not say otherwise.
7. `nextAction` returns `final-gate` before asking about open manual entries when no step is pending. With a `stopped` external step and `finalGate` pending, it would offer the final gate before the person answers. I did not change this because it is Task 1 behaviour and outside this task.
8. The new tests state the never-pending invariant as a bounded search (depth 3, deduplicated states) rather than a literal one-step enumeration.

### T4
1) I wrote progress.mjs before the CLI tests, so the strict red-then-green step of TDD was not followed. I wrote the tests right after and ran them against the code. 2) The first run had one failure, in the AC1 test. The test state used wave 1 and launched T2, so it hit wave-order instead of dependency-not-passed. I fixed the test by setting run.wave = 2, not the code. 3) For G2 to G5 the exit codes in the checks come from the command's own run, but I piped the output through tail, so the "$?" I printed after each pipe was tail's. Every command printed its pass line, and G1 ran without a pipe. 4) The plan lists no `--json` shape for the refusal code, so I added a top-level `code` field next to `errors[0]`. The CLI tests read it. 5) In `apply`, the `--value` option is passed to the event as a string. Handlers that compare against strings work. No handler needed a number.

### T6
Two small choices the plan did not specify. Both are recorded here for the owner, not as registered decisions. (1) A progress.json that cannot be read or parsed gives a `usage` refusal with exit 2. (2) With no git repository, close-from-state refuses with git-unavailable, because it cannot resolve plan.roadmap without one.

### T7
1) routing.md (Task 8's file, not edited here) still says "delegation-protocol, § Step lifecycle" at lines 36, 58, 65 and 70, which no longer exists. My link test only forbids progress-template.md across the skill, and forbids § Step lifecycle only in SKILL.md and delegation-protocol.md. Task 8 must fix those pointers. 2) The CLI has no event that records an agent ID after launch (only `launch --agent-id`, which needs the ID before the Agent call), and no setter for `handoff`. The prose says so: after a compaction an `await` step with no known agent gets `no-report`, and HANDOFF lines stay in the conversation. 3) The CLI has no field for Baseline, so the prose keeps it in `baseline.md` beside progress.json. That file name is my invention (autonomous decision, alcance local, pending for the owner). 4) The SKILL.md description now points at docs/plans/<topic>/plan.md and drops docs/superpowers/plans. The plugin README row (plugins/productivity-tools/README.md line 17) still mentions docs/superpowers/plans/ and is outside this task's file list. No version bump was done, since the plan does not list one for this task.

### T9
The G5 WARN about delegation-protocol.md linking state.md (two levels deep) is pre-existing in a file this task does not touch. G5 still exits 0, which matches the baseline. The CLAUDE.md addition is written in Portuguese to match the plan's wording and the surrounding parentheticals, while the rest of that file is mostly English.

### final fix1
Quando o passo reaberto estava numa onda anterior, `run.wave` recua e o portão dessa onda pode ficar devido de novo depois que o passo passar. Isso segue o mesmo mecanismo que `rerun` e `final-gate defects` já usavam. A correção 2 mexe só no código de `progress-state.mjs` e não toca o spec nem o plano.

### final fix2
The step-level `gated` flag is an additive field that is not mentioned in the spec, plan or references/state.md. I did not edit those docs per the rules. The auto-release is applied inside applyEvent rather than as a nextAction `release` action, so history shows no separate release entry for it.
