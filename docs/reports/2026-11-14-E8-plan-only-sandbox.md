# E8: plan-only no sandbox (trio de DEC-709, passo 1)

Data: 2026-11-14. Commit medido: 4594315 (productivity-tools 1.7.0 da ponta, por `--plugin-dir` numa worktree destacada em D:/claude-e8-release). CLI 2.1.325, superpowers 7.0.2. Modo `bypassPermissions` (só na orquestração e nas medições, DEC-311/312), teto de US$ 5, 1 execução, rodando sozinha no host (DEC-710). Conduzido pelo orquestrador (DEC-204). É registro de evidência.

## Comando

`env -u CLAUDE_CONFIG_DIR node tools/measure/run-batch.mjs --variant plan-only --runs 1 --work D:/claude-e8-work/plan-only --out D:/claude-e8-out --config-dir C:/Users/odeci/.claude --permission-mode bypassPermissions --max-budget-usd 5 --plugin-dir D:/claude-e8-release/plugins/productivity-tools`

Resultado do harness: 1 válida, 0 inválidas, 0 negadas. Agregado em `D:/claude-e8-out/plan-only-20261114-013244/aggregate.json`.

## Critérios de DEC-709

| Critério | Resultado | Evidência |
|---|---|---|
| Spec e plano nativos | atendido | `docs/plans/sandbox-E1/spec.md` (4f4a52b) e `plan.md` (df4d445) em feat/E1; caminho de DEC-510 (slug `sandbox`) |
| Nada em docs/superpowers | atendido | nenhum arquivo em nenhuma branch do sandbox |
| Nenhuma pergunta a pessoa | atendido | 0 chamadas a AskUserQuestion nas transcrições |
| Painel de E1 em `plan` | atendido | 18195d1 "docs(roadmap): E1 at plan" em release/sandbox |
| Checker com 0 erros | atendido | `check-roadmap: 0 error(s), 1 warning(s)` (pending-no-owner) |

## Defeito do produto: releitura do registro

O workflow terminou E1 como `FAILED (failKind: infra)`: "the roadmap record failed (reread status --json is missing or has no panel; reread pending-decisions --json is missing or is not JSON of the CLI)".

O registro estava correto (painel, log e DEC-003 gravados, árvore limpa). O agente haiku de releitura `E1:status-plan-read` rodou os cinco comandos certos, mas preencheu mal o schema `S_RECORD_READ`: no campo `status` pôs `"ok"` em vez do stdout de `status --deliverable E1 --json`; no campo `pendingDecisions` pôs só o objeto `result`, sem o envelope da CLI. `recordVerdict` rejeitou um registro bom.

Causas no código (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`): o nome de campo `status` é ambíguo (outros schemas usam `status` para o resultado do agente; `S_DOCMEAS` usa `statusStdout`), e a releitura é uma cópia de stdout por modelo, sem digest e sem nova tentativa, embora seja só leitura. A descoberta faz até 5 tentativas com digest. Schema na linha ~1417, mensagens em ~1006/1024, releitura em `recordStatus`.

Efeitos colaterais: `reviews.md` foi gravado com o título "FAILED" (commit "E1: review log (failed)"), e o relatório do run classifica a falha como infraestrutura e manda "rodar de novo", o que esconde o defeito.

Leitura do executor: os critérios de DEC-709 foram atendidos, mas o run terminou em falha por defeito do produto. A sonda acceptEdits não rodou (DEC-709) e o caso foi ao dono.

## Trechos do registro (DEC-668)

| Status | Partes | Comando completo (caracteres) | Passos | Digest |
|---|---|---|---|---|
| E1:plan | 1 | 2.037 (teto 6.000) | 3 | confere (`d55e6d83:E1:plan:0`) |

Nenhum status passou de 1 parte no cenário fixo.

## Custo

| Papel | US$ |
|---|---|
| plan (opus) | 0,295 |
| plan-review (opus) | 0,268 |
| spec (opus) | 0,265 |
| spec-review (opus) | 0,236 |
| report (sonnet) | 0,161 |
| review-log (sonnet) | 0,119 |
| preflight (sonnet) | 0,101 |
| haiku (setup, descoberta, cargas, commits, registro e releitura) | 0,040 |
| sessão principal (opus, 7 turnos) | 0,465 |
| **Total** | **1,484** |

Chamadas estruturais: haiku 8, sonnet 3, opus 4. O medidor da CLI marcava US$ 1,57 já na releitura; a diferença vem de `prices.json` (2026-11-10).

## Sonda acceptEdits (não rodou)

Regras exatas do preflight para o `completo` (lidas de um sandbox de rascunho sem `settings.local.json`): `Bash(node:*)`, `Bash(node *roadmap.mjs" *)`, `Bash(node *run-record.mjs" *)`, `Bash(node *preflight.mjs" *)`, `Bash(node *verify-run.mjs" *)`, `Bash(git:*)` e `Workflow(productivity-tools:release-workflow)`. Risco: o mesmo defeito da releitura pode encerrar o `completo` como FAILED antes de qualquer negação.

## Pastas

Trabalho: `D:/claude-e8-work/plan-only/plan-only-1` e `-wt/{_integracao,E1}`; rascunho `D:/claude-e8-work/_preflight-probe`. Transcrições: `C:/Users/odeci/.claude/projects/D--claude-e8-work-plan-only-plan-only-1/cb60cd13-9afc-4a9f-a5f6-ae0fed95b2e8/` (releitura: `subagents/workflows/wf_6d1d6156-63d/agent-a87306928f64043e0.jsonl`).
