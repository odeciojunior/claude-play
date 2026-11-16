# E29: registro de revisões

## Revisões por etapa

### spec
- Rodada 1: revisor opus, correção anterior: nenhuma.
- Rodada 2: revisor opus, correção anterior: tier opus.
- Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### plan
- Rodada 1: revisor opus, correção anterior: nenhuma.
- Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### Tarefa 1 (Workflow com o caminho único spec e quality)
- T1:spec, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T1:quality, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### Tarefa 2 (Preflight recusa taskReview.single)
- T2:spec, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T2:quality, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### Tarefa 3 (task-reviewer sem a ligação ao release e teste de ausência)
- T3:spec, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T3:quality, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### Tarefa 4 (Arnês de medição ao caminho único com fixture congelada)
- T4:spec, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T4:quality, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### Tarefa 5 (Gates)
- T5:spec, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T5:quality, rodada 1: revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### final
- Rodada 1: revisor opus, correção anterior: nenhuma.
- Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### gates-fix1
- Rodada 1: revisor opus, correção anterior: tier sonnet.
- Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

### gates-fix2
- Rodada 1: revisor opus, correção anterior: tier sonnet.
- Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

## Riscos aceitos

Nenhum.

## Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Workflow com o caminho único spec e quality | DONE | 1 |
| 2 | Preflight recusa taskReview.single | DONE | 1 |
| 3 | task-reviewer sem a ligação ao release e teste de ausência | DONE | 1 |
| 4 | Arnês de medição ao caminho único com fixture congelada | DONE | 1 |
| 5 | Gates | DONE | 0 |

## Concerns

- T1: The red run was reported from a truncated output, so the exact failing test names were not captured. The working copies are CRLF (the index is LF) and I kept them CRLF.
- T4: The plan did not list one test: `C4: the aggregate of a lenses batch records harness.taskReview ...`, which ran `runBatch` for `unica` against the real plugin. It would be refused now, so I made it use a plugin built from the fixture for `unica`. It stays inside the plan's file list, but it is an addition. The fixture is LF in the blob and git warns it becomes CRLF on checkout. The tests only compare single-line literals and the pure block, which is extracted by line, so line endings do not matter. The checks below were run with absolute paths under the worktree and, apart from the failing run, with output redirected to a file. A plain run of the two-file command exited 0, but its output was too long to quote here.
- T5: Exit codes: the Bash tool did not print them, so each exit is recorded as 0 from the pass summary or success line, not from a printed code. G2 and G3 were run with the absolute worktree path instead of "." and the plugin path as the canonical form; the path is the same directory. G5 reports one WARN (delegation-protocol.md links state.md) and G3 reports an ICON_MISSING warning; neither is a failure and neither is listed in the baseline. The G1 total moved from the baseline 2175 to 2172, which is explained by the test removals and additions of Tasks 1 to 3 (net -3), not by a failure. A rerun of the G1 test count against the baseline should be read with that in mind.

- gates-fix1: The "gate not green" flag comes from comparing total test counts alone, and there are no failures behind it. E29 deletes three E28 tests that covered the `taskReview.single` mode. Those are `E28 AC1` in flow.test.mjs and `E28 AC2` in prompts.test.mjs, plus some of the single-review tests in review.test.mjs. It also adds new tests. The net is -3, which matches the reviews.md note on T5. Restoring the deleted tests would contradict the spec, so I did not. The workflow's gate comparison could treat a total below baseline as a failure only when a test disappears without a matching removal in the plan. I did not run G1 myself; the figures are the ones quoted in the task.

- gates-fix2: The gate comparison treats a lower test total as a failure even when every test passes. I did not re-run G1 myself. I relied on the reported run (2172 tests, 2170 pass, 0 fail, 2 skipped) and on the diff, which shows the removals match spec E29. I did not change the baseline or any gate.

## Gates

Registrados nos concerns de T5 (G1 a G5 executados; G1 com 2172 testes contra a linha de base 2175, explicado pelo saldo líquido -3 das Tarefas 1 a 3; sem falhas).

Execução de gates (após gates-fix1):
- G1: exit 0, total 2172, skipped 2, failing [] (linha de base: exit 0, total 2175, skipped 2, failing []).
- G2: exit 0 (linha de base: exit 0).
- G3: exit 0 (linha de base: exit 0).
- G4: exit 0 (linha de base: exit 0).
- G5: exit 0 (linha de base: exit 0).

Execução de gates (após gates-fix2):
- G1: exit 0, total 2172, skipped 2, failing [] (linha de base: exit 0, total 2175, skipped 2, failing []).
- G2: exit 0 (linha de base: exit 0).
- G3: exit 0 (linha de base: exit 0).
- G4: exit 0 (linha de base: exit 0).
- G5: exit 0 (linha de base: exit 0).

Execução de gates (registro final, execução falhou):
- G1: exit 0, total 2172, skipped 2, failing [] (linha de base: exit 0, total 2175, skipped 2, failing []).
- G2: exit 0 (linha de base: exit 0).
- G3: exit 0 (linha de base: exit 0).
- G4: exit 0 (linha de base: exit 0).
- G5: exit 0 (linha de base: exit 0).

## Falha da execução

branch gates did not pass: gates not green (G1): G1: exit 0, total 2172, skipped 2, failing [] (baseline: exit 0, total 2175, skipped 2, failing []) | G2: exit 0 (baseline: exit 0) | G3: exit 0 (baseline: exit 0) | G4: exit 0 (baseline: exit 0) | G5: exit 0 (baseline: exit 0)

## Entradas humanas

Nenhuma (what, blq, workaround, blocking: não se aplica).

## Textos cortados no registro

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md). Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md), execução dos gates. Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md), registro dos gates (gates-fix2). Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md), registro da falha (execução falhou). Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).

- Origem: block-open --what (fonte: docs/plans/pos-2-2-0-E29/reviews.md), registro do bloqueio (blocked-record). Texto completo:

  E29 bloqueado: automatic execution stopped (conteudo): branch gates did not pass: gates not green (G1): G1: exit 0, total 2172, skipped 2, failing [] (baseline: exit 0, total 2175, skipped 2, failing []) | G2: exit 0 (baseline: exit 0) | G3: exit 0 (baseline: exit 0) | G4: exit 0 (baseline: exit 0) | G5: exit 0 (baseline: exit 0); branch feat/E29 kept at D:/projects/claude-play-wt/E29

## Registro do bloqueio (blocked-record)

Execução registrada como bloqueada: a execução automática parou (conteudo) porque os gates da branch não passaram (G1 não verde pela comparação do total de testes, 2172 contra a linha de base 2175, sem falhas). A branch feat/E29 foi mantida em D:/projects/claude-play-wt/E29.

Revisões desta execução (dados iguais aos registrados acima): spec (opus, rodadas 1 e 2; correção da rodada 2 em tier opus), plan (opus, rodada 1), T1 a T5 spec e quality (sonnet, rodada 1 cada), final (opus, rodada 1), gates-fix1 e gates-fix2 (opus, rodada 1, correção anterior em tier sonnet). Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum. Riscos aceitos: nenhum. Entradas humanas: nenhuma.

Gates (registro do bloqueio):
- G1: exit 0, total 2172, skipped 2, failing [] (linha de base: exit 0, total 2175, skipped 2, failing []).
- G2: exit 0 (linha de base: exit 0).
- G3: exit 0 (linha de base: exit 0).
- G4: exit 0 (linha de base: exit 0).
- G5: exit 0 (linha de base: exit 0).

## Nova execução (falhou no carregamento do plano)

### Revisões desta execução
- spec: rodada 1, revisor opus, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

Riscos aceitos: nenhum. Concerns: nenhum. Gates: não executados nesta execução. Entradas humanas: nenhuma (what, blq, workaround, blocking: não se aplica).

### Falha da execução

plan load: integrity digest not confirmed (plan-tool emit exited 1: { "tool": "plan-tool", "schema": "plan/1", "path": "D:/projects/claude-play-wt/E29/docs/plans/pos-2-2-0-E29/plan.md", "errors": [ { "code": "edge-case-uncovered", "ref": "C5", "message": "nenhuma tarefa cobre o caso de borda C5" } ], "warnings": [], "summary": { "errors": 1, "warnings": 0, "exitCode": 1 } })

## Nova execução (tarefas 4 a 6 e revisão final)

### Revisões desta execução
- spec: rodada 1, revisor opus, correção anterior: nenhuma; rodada 2, revisor opus, correção anterior: tier opus. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- plan: rodada 1, revisor opus, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 2. Não resolvidos: nenhum.
- T4:spec: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T4:quality: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T5:spec: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T5:quality: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 1. Não resolvidos: nenhum.
- T6:spec: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- T6:quality: rodada 1, revisor sonnet, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.
- final: rodada 1, revisor opus, correção anterior: nenhuma. Críticos/importantes: nenhum. Menores: 0. Não resolvidos: nenhum.

Riscos aceitos: nenhum.

### Tarefas desta execução

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Workflow com o caminho único spec e quality | RESUMED (already reviewed) | |
| 2 | Preflight recusa taskReview.single | RESUMED (already reviewed) | |
| 3 | task-reviewer sem a ligação ao release e teste de ausência | RESUMED (already reviewed) | |
| 4 | Arnês de medição ao caminho único com fixture congelada | DONE | 14 |
| 5 | Gates | DONE_WITH_CONCERNS | 0 |
| 6 | Testes do comportamento que fica (R5 da spec, C5) | DONE_WITH_CONCERNS | 1 |

### Concerns desta execução

- T5: 1. G1 total is 2172, below the target baseline of 2186 (skipped 2, fail 0). The owner requires the total after the sync with release to be >= baseline. This branch has not been synced yet, so the gap may close then. It must be verified at the record or merge stage, not by changing the gate, baseline, skips or count. 2. The exit codes for G1, G2 and G3 were not printed by the tool. The outputs show pass or fail 0, but the code itself was not read. 3. G5 reports 1 WARN (plan-coordinator/references/delegation-protocol.md links to state.md, one level too deep). It is not a FAIL, so exit 0 holds. It is a pre-existing item to check whether it belongs to this deliverable. 4. G3 reports one plugin-directory warning, ICON_MISSING. The validator still passes. 5. Mid-run, E29 was not given any task 6 work. No file was changed and no commit was made.
- T6: G1 before the sync: 2175 tests, 2173 pass, 0 fail, 2 skipped. Break E fails first on the label list, not on the spec-fix1 prefix check. The no-review1 assertion is scoped to E1:t1: labels because E1:plan-review1 is a legitimate label.

### Gates desta execução

Linha de base (alvo, head 19a04305fc569876c27cdb47492571214fe882b1): G1 exit 0, total 2186, skipped 2, failing []; G2, G3, G4, G5 exit 0. Registrado nos concerns: G1 com 2172 testes na branch (skipped 2, fail 0) e, após a tarefa 6 e antes da sincronização, 2175 testes (2173 pass, 0 fail, 2 skipped). A branch ainda não foi sincronizada com a release; a verificação do total contra a linha de base cabe ao registro ou à integração. G5 com 1 WARN e G3 com 1 aviso ICON_MISSING, sem falha.

### Entradas humanas

Nenhuma (what, blq, workaround, blocking: não se aplica).

### Falha da execução

Nenhuma.

### Textos cortados no registro (esta execução)

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md). Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md). Texto completo:

  Uma tarefa nova, de número maior que as existentes, sem mudar as tarefas 1 a 5, cria três testes: dois em workflow/prompts.test.mjs (seção ## Review mode do task-reviewer usada pelo plan-coordinator; correção do laço por tarefa via implAgent com C() e 'fix the ${kind} problems') e um de fluxo em workflow/flow.test.mjs (taskReview { single: true } entregue direto ao workflow despacha só E1:t1:spec1 e E1:t1:quality1 no task-reviewer, nenhum review1, e revisão sem achados nem veredictos não gera correção). Cada teste é visto falhando com uma quebra temporária do comportamento, desfeita com git checkout -- <arquivo>. Nenhum teste do modo único volta; gate, linha de base, skips e contagem não mudam por outro meio.
