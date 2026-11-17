# E31: registro de revisões

## Revisões por etapa

| Etapa | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|---|---|
| spec | 1 | opus | n/a | nenhum | 0 | nenhuma |
| spec | 2 | opus | opus | nenhum | 0 | nenhuma |
| plan | 1 | opus | n/a | nenhum | 0 | nenhuma |
| T1:spec | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| T1:quality | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| T2:spec | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| T2:quality | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| T3:spec | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| T3:quality | 1 | sonnet | n/a | nenhum | 0 | nenhuma |
| final | 1 | opus | n/a | nenhum | 2 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Carga da spec confere o exit code contra o summary.exitCode | DONE | 1 |
| 2 | Commit da spec e do plano sem depender de exit code | DONE | 1 |
| 3 | Gates e medida de tamanho | DONE_WITH_CONCERNS | 0 |

## Concerns

- T2: The green flow.test.mjs run printed more than the tool shows, so the 442 pass / 0 fail summary was read from the saved output file, not from the call's own output. Task 3 (gates and size measure) was not started, as instructed.
- T3: 1) git diff --stat 759d017 HEAD lists docs/plans/pos-2-2-0-E31/plan.md (258 lines) and run.json (48 lines) in addition to the two code files; they are workflow artifacts from the plan and run-record commits (3c21dc7, 96e1fb3), not product code. 2) G1 total is 2194, not the 2186 baseline: the increase comes from the new E31 tests added in T1 and T2, and no test failed. 3) G2 and G3 were run with the absolute worktree path instead of ".", and the plugin path, because the CLI has no directory flag; the effect is the same. 4) G3 and G5 print warnings (ICON_MISSING, and a plugin-level WARN on delegation-protocol.md links) that are pre-existing and do not change the exit code. 5) The exit codes come from calls that returned no error; the size command printed 244453 and its exit was not separately echoed.

## Gates

Não há dados de gates além dos concerns de T3 acima (G1 total 2194 contra baseline 2186, sem falhas; G2 a G5 com exit 0 conforme os concerns).

## Entradas humanas

| O quê | Blq | Workaround | Bloqueante |
|---|---|---|---|
| O dono confere o relatório docs/reports/2026-11-17-E31-parada-retomada.md (critério 1). | n/a | O executor entrega a correção do critério 2; a conferência fica com o dono. | não |

## Falha

Nenhuma.
