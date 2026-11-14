# E8: 3º plan-only no sandbox (DEC-717)

Data: 2026-11-14. Commit medido: af782a4 (release com fix/releitura-assinada e fix/grupo-idempotente, DEC-711 e DEC-714/715), por `--plugin-dir` numa worktree destacada em D:/claude-tr-release. CLI 2.1.325. Modo `bypassPermissions` (só na orquestração e nas medições, DEC-311/312), teto de US$ 5, 1 execução, sozinha no host (DEC-710). Conduzido pelo orquestrador (DEC-204). É registro de evidência.

## Comando

`env -u CLAUDE_CONFIG_DIR node tools/measure/run-batch.mjs --variant plan-only --runs 1 --work D:/claude-e8c-work/plan-only --out D:/claude-e8c-out --config-dir C:/Users/odeci/.claude --permission-mode bypassPermissions --max-budget-usd 5 --plugin-dir D:/claude-tr-release/plugins/productivity-tools`

Resultado do harness: 1 válida, 0 inválidas, 0 negadas.

## Resultado

O workflow terminou E1 em `plan`, sem FAILED e sem ação de operador. É o primeiro plan-only do trio a passar.

| Critério de DEC-709 | Resultado | Evidência |
|---|---|---|
| Spec e plano nativos | atendido | `docs/plans/sandbox-E1/spec.md` (6ae32bb) e `plan.md` (14f88df) em feat/E1 |
| Nada em docs/superpowers | atendido | nenhum arquivo em feat/E1 nem em release/sandbox |
| Nenhuma pergunta a pessoa | atendido | 0 chamadas a AskUserQuestion nas transcrições |
| Painel de E1 em `plan` | atendido | 31cfa0b "docs(roadmap): E1 at plan" em release/sandbox |
| Checker com 0 erros | atendido | `check-roadmap: 0 error(s), 1 warning(s)` (pending-no-owner) no alvo |

## Tentativas das cópias (DEC-717)

| Agente | Tentativas | Resultado |
|---|---|---|
| `E1:status-plan` (grupo de escrita, script-runner haiku) | 1 | cópia assinada aceita |
| `E1:status-plan-read` (releitura assinada, script-runner haiku) | 1 | cópia assinada aceita |

Nenhum rótulo `-retry` no diário do workflow. O fix do grupo (DEC-714) não precisou repetir nesta execução: a prova da repetição são os testes determinísticos da branch. O endurecimento do prompt (DEC-715) estava em uso.

Os efeitos colaterais de 9fde041 e 0dda52c sumiram: `reviews.md` sai com "E1: review log (plan)" e o relatório não manda rodar de novo. Novo nesta execução: o commit `E1: run record (spec,plan)` com `run.json` em feat/E1.

Ressalvas do relatório do run: a seção do checker diz `{}`, porque em plan-only o estágio de docs não roda; a evidência do painel (spec e plano) só existe em feat/E1, o que é esperado sem merge; sobra `plan-only-1-wt/_tmp` vazio.

## Custo

| Item | US$ |
|---|---|
| Execução (agentes e sessão principal, `prices.json` de 2026-11-10) | 1,437 |

Chamadas estruturais: haiku 9, sonnet 3, opus 4. Acumulado do trio de E8: 1,57 + 1,88 + 1,44 = 4,89 de US$ 20.

## Pastas

Trabalho: `D:/claude-e8c-work/plan-only/plan-only-1` e `-wt/{_integracao,E1}`. Agregado: `D:/claude-e8c-out/plan-only-20261114-211313/`.
