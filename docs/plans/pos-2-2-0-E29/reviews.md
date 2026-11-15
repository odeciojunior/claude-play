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

## Gates

Registrados nos concerns de T5 (G1 a G5 executados; G1 com 2172 testes contra a linha de base 2175, explicado pelo saldo líquido -3 das Tarefas 1 a 3; sem falhas).

## Entradas humanas

Nenhuma (what, blq, workaround, blocking: não se aplica).

## Textos cortados no registro

- Origem: add-decision --decision (fonte: docs/plans/pos-2-2-0-E29/reviews.md). Texto completo:

  checkLoopWorkflow exige os literais do modo único só no braço unica (opção arm); o braço atual roda no workflow novo e mantém H_TR e harness.taskReview com single: false; os testes do braço unica leem a cópia congelada tools/measure/fixtures/workflow-com-single/roadmap-release.js (workflow em ccac3c5).
