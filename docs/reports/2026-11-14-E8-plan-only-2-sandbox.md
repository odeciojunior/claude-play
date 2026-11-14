# E8: 2º plan-only no sandbox (DEC-713)

Data: 2026-11-14. Commit medido: b734c12 (release com fix/releitura-assinada, DEC-711), por `--plugin-dir` numa worktree destacada em D:/claude-tr-release. CLI 2.1.325. Modo `bypassPermissions` (só na orquestração e nas medições, DEC-311/312), teto de US$ 5, 1 execução, sozinha no host (DEC-710). Conduzido pelo orquestrador (DEC-204). É registro de evidência.

## Comando

`env -u CLAUDE_CONFIG_DIR node tools/measure/run-batch.mjs --variant plan-only --runs 1 --work D:/claude-e8b-work/plan-only --out D:/claude-e8b-out --config-dir C:/Users/odeci/.claude --permission-mode bypassPermissions --max-budget-usd 5 --plugin-dir D:/claude-tr-release/plugins/productivity-tools`

Resultado do harness: 1 válida, 0 inválidas, 0 negadas.

## Critérios de DEC-709

| Critério | Resultado | Evidência |
|---|---|---|
| Spec e plano nativos | atendido | `docs/plans/sandbox-E1/spec.md` (d902bd3) e `plan.md` (9734262) em feat/E1 |
| Nada em docs/superpowers | atendido | nenhum arquivo em feat/E1 nem em release/sandbox |
| Nenhuma pergunta a pessoa | atendido | 0 chamadas a AskUserQuestion nas transcrições |
| Painel de E1 em `plan` | atendido | 9c6f19d "docs(roadmap): E1 at plan" em release/sandbox |
| Checker com 0 erros | atendido | releitura assinada: `errors: 0`, 1 warning (pending-no-owner) |

O workflow terminou E1 de novo como `FAILED (infra)`, agora com "plan-only: the roadmap record failed (null record agent)". Pela DEC-713, não há 3º lançamento sem o dono.

## O fix da releitura funcionou

O agente `E1:status-plan-read` (script-runner, haiku) rodou `verify-run.mjs read` uma vez e copiou a saída assinada inteira: painel com `plan`, checker com 0 erros, DEC-003 e DEC-004 em pendentes, head 9c6f19d, árvore limpa. O defeito de 9fde041 (campo `status` com "ok") não voltou.

## Defeito novo: a cópia do grupo de escrita

O agente `E1:status-plan` (script-runner, haiku) rodou `verify-run.mjs group` e o script fez tudo certo: 4 passos com exit 0 (set-status, log, DEC-003, DEC-004), commit 9c6f19d. Mas o agente chamou `StructuredOutput` com `{"exit":0,"stdout":"PLACEHOLDER"}` no mesmo turno da chamada Bash, antes de ver o resultado. O `checkRun` rejeitou a cópia, e `recordStatus` tratou o caso como agente nulo (`results = null`), porque o grupo grava e por isso nunca é repetido (comentário em `recordStatus`).

Leitura do executor: o registro estava correto e a releitura assinada o confirmou na mesma execução, mas o veredito descarta o grupo antes de olhar a releitura. A causa é a mesma classe de 9fde041, a cópia de stdout por modelo, agora no caminho de escrita. O prompt do script-runner (`agents/script-runner.md`) não diz para esperar o resultado do Bash antes de responder.

Efeitos colaterais repetidos de 9fde041: `reviews.md` com "(failed)" no commit, e o relatório manda "rodar de novo" como infraestrutura. O relatório do run apontou também que a evidência do painel (spec e plano) só existe em feat/E1, não no alvo, o que é esperado em plan-only.

## Custo

| Item | US$ |
|---|---|
| Execução (agentes e sessão principal, `prices.json` de 2026-11-10) | 1,881 |

Chamadas estruturais: haiku 11, sonnet 3, opus 4. Acumulado do trio de E8: 1,57 (passo 1) + 1,88 = 3,45 de US$ 20.

## Pastas

Trabalho: `D:/claude-e8b-work/plan-only/plan-only-1` e `-wt/{_integracao,E1}`. Agregado: `D:/claude-e8b-out/plan-only-20261114-203858/`. Transcrição do workflow: `C:/Users/odeci/.claude/projects/D--claude-e8b-work-plan-only-plan-only-1/29a3bca5-2459-47f2-b6dd-d7b9fa10b0ba/subagents/workflows/wf_30fdda5c-f08/` (grupo: `agent-abbad9cc5431b8df3`; releitura: `agent-a92d477907b6852f5`).
