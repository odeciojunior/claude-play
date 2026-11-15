# E32: registro de revisões

Execução do entregável E32 (branch feat/E32). Este registro transcreve os dados da execução: rodadas de revisão por etapa, problemas, preocupações, gates, entradas humanas e textos cortados no registro.

## Revisões por etapa

Formato das rodadas: número da rodada, modelo do revisor, tier da correção que a precedeu ("-" quando não houve correção antes).

| Etapa | Rodadas (rodada, revisor, tier da correção anterior) | Críticos/importantes | Menores | Não resolvidos |
|---|---|---|---|---|
| spec | 1 (opus, -); 2 (opus, opus) | nenhum | 0 | nenhum |
| plan | 1 (opus, -) | nenhum | 0 | nenhum |
| T1:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T1:quality | 1 (sonnet, -) | nenhum | 1 | nenhum |
| T2:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T2:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T3:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T3:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T4:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T4:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T5:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T5:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T6:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T6:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T7:spec | 1 (sonnet, -) | nenhum | 0 | nenhum |
| T7:quality | 1 (sonnet, -) | nenhum | 0 | nenhum |
| final | 1 (opus, -); 2 (opus, sonnet) | nenhum | 2 | nenhum |

Riscos aceitos: nenhum.

Falha da execução: nenhuma.

## Tarefas

| Tarefa | Título | Status | Commits |
|---|---|---|---|
| 1 | Modo procs no verify-run.mjs | DONE_WITH_CONCERNS | 1 |
| 2 | Limpeza do release pelo procs | DONE | 1 |
| 3 | Revisão de passo retomado no coordinator | DONE | 1 |
| 4 | plan-author descreve o emit enxuto | DONE | 1 |
| 5 | Tracker cita status --deliverable | DONE | 1 |
| 6 | Relatório de triagem | DONE_WITH_CONCERNS | 1 |
| 7 | Gates | DONE_WITH_CONCERNS | 0 |

## Preocupações

- T1: The plan fixed the Windows listing command as `powershell.exe -NoProfile -Command "Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,CommandLine | ConvertTo-Json -Compress"`. The end-to-end test showed that on this machine the output carries raw 0x1A control characters, so the JSON would not parse. The console codepage emits 0x1A for characters it cannot encode, and this machine's process list has non-ASCII text. The listing then went to `unchecked` and nothing was ended. I made two small changes. The command now starts with `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8;`. `parseCimProcs` also replaces raw control characters with a space before `JSON.parse`. I added a parser assertion for this case. The behaviour and output shape match the plan; only the PowerShell command text differs. The `procs` case in the `kill` and `run` injections is exercised only through fakes on linux and win32. The Linux code path (`ps`, `lsof`, SIGTERM) was never run on a real Linux host. `lsof` exit 1 with empty output is treated as "no listeners" rather than unchecked.
- T4: The commit trailer follows the workflow's required line "Co-Authored-By: Claude <noreply@anthropic.com>", not the Haiku attribution line from the session reminder; the two conflict and I used the workflow's explicit rule. The lint-plugin WARN on delegation-protocol.md is pre-existing and outside this task.
- T6: As contagens vêm de buscas por linha com o Grep, não de um script. 9 + 2 + 36 = 47. O mesmo vale para S2-07: a nota diz 6 notas e SRC-03 tem 7 na seção E28, o que está anotado no relatório. Fechei como obsoletas, por DEC-744, DEC-761 e DEC-763, as notas S3-11, S3-12, S3-14, S3-15 e S3-17. Essa leitura é interpretação minha e o dono deve conferi-la. S2-08 e S3-26 ficaram pendentes por R9: T5 e T4 corrigem só uma parte de cada uma. A Task 6 não rodou os gates G1 a G5, que ficam para a Task 7. O git avisou que o arquivo muda de LF para CRLF no commit (core.autocrlf=true). Não afeta o conteúdo.
- T7: 1) The explicit exit code was not captured for G1 and G5 because the output was persisted or reported with a WARN; both completed with pass or 0 FAIL and no tool error. 2) G5 printed one WARN, not a FAIL: skills/plan-coordinator/references/delegation-protocol.md links state.md (one-level-deep rule). That file is not changed by E32 and the plan does not list it as expected; reported as pre-existing-looking, not blocking. 3) git diff --stat against the local release/pos-2.2.0 ref shows changes to docs/plans/roadmap-pos-2-2-0/ (decisions.md, log.md, state.md) and docs/reports/ on the release side: the local release ref has moved ahead of feat/E32 (or feat/E32 lacks commits). This is not a gate failure; the release branch sync should be checked by the operator before merge. 4) G3 printed a plugin directory ICON_MISSING warning that does not change the result. 5) Gate commands were run with absolute paths under the worktree.

## Gates

Baseline do target (HEAD ccac3c57f45e8d2cef1b8ee86a86dbd50125d692, árvore limpa, chave de gates 936533eb): G1 exit 0 (total 2175, skipped 2, nenhum teste falho); G2, G3, G4 e G5 exit 0.

Gates da Task 7 (executados no worktree E32): ver as preocupações de T7 acima. G1 e G5 sem código de saída explícito capturado; G5 com um WARN (não FAIL); G3 com aviso ICON_MISSING sem efeito no resultado.

## Entradas humanas

| O que | blq | Workaround | Bloqueante |
|---|---|---|---|
| O dono confere o relatório de triagem docs/reports/2026-11-15-E32-triagem-backlog.md (critério 1). | - | O executor entrega o relatório e as correções; a aceitação fica para o dono depois do merge. | não |

## Textos cortados no registro

Uma entrada por item de recordCuts: origem, onde entrou e o texto completo.

### Corte 1

- Origem: docs/plans/pos-2-2-0-E32/reviews.md
- Onde entrou: add-decision --decision
- Texto completo: As 47 notas: os 17 pendentes de docs/plans/roadmap-evolucao-skills/state.md e as 30 notas de docs/reports/2026-11-13-pendencias-por-entregavel.md; relatório docs/reports/2026-11-15-E32-triagem-backlog.md com uma linha por nota (situação obsoleta, corrigida ou pendente, e prova) e um quadro que soma 47; as duas notas-ponteiro fecham como obsoletas citando as notas de SRC-03.

### Corte 2

- Origem: docs/plans/pos-2-2-0-E32/reviews.md
- Onde entrou: add-decision --decision
- Texto completo: Pequena: até 3 arquivos de produto além dos testes, com teste, sem execução paga, sem mudar formato de plano ou de estado, portão canônico ou teto de tamanho, e fora das linhas que E29 altera; o resto vira pendente com dono executor, dono ou card (E29, E30, E31, E33) e destino (card deste roadmap ou roadmap futuro).

### Corte 3

- Origem: docs/plans/pos-2-2-0-E32/reviews.md
- Onde entrou: add-decision --decision
- Texto completo: Modo procs em verify-run.mjs (payload { nonce, digest, wt, ports }) que lista por Node os processos com o caminho do worktree na linha de comando, seguido de fronteira (fim do texto, /, \, aspas ou espaço, para que E3 não case E32), ou em escuta na faixa de portas, exclui a própria cadeia e os encerra; o prompt de limpeza de roadmap-release.js roda esse comando no lugar do texto livre; o preflight não muda, porque Bash(node:*) já é exigido.
