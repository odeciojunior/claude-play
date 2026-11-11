# E3: CLI de eventos do tracker, registro de revisões

Execução de 2026-11-11 (branch `feat/E3`). Registro transcrito do relatório do orquestrador, sem resumir.

## Rodadas de revisão por estágio ou tarefa

Colunas: rodada, modelo do revisor, tier da correção que precedeu a rodada (`-` quando não houve correção antes). Nenhum estágio teve problema crítico ou importante (lista de bloqueantes vazia em todos). "Menores" é a contagem de problemas menores. Pendências: nenhuma em todos os estágios.

| Estágio | Rodadas (n: revisor, correção anterior) | Críticos/importantes | Menores | Pendências |
|---|---|---|---|---|
| spec | 1: opus, - | nenhum | 2 | nenhuma |
| plan | 1: opus, -; 2: opus, sonnet | nenhum | 0 | nenhuma |
| T1:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T1:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T2:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T3:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T4:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T4:quality | 1: sonnet, -; 2: sonnet, sonnet | nenhum | 0 | nenhuma |
| T5:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T5:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T6:spec | 1: sonnet, - | nenhum | 1 | nenhuma |
| T6:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:spec | 1: sonnet, - | nenhum | 0 | nenhuma |
| T7:quality | 1: sonnet, - | nenhum | 0 | nenhuma |
| final | 1: opus, -; 2: opus, sonnet | nenhum | 1 | nenhuma |

Riscos aceitos: nenhum.

## Tarefas

| n | Título | Status | Commits |
|---|---|---|---|
| 1 | funções novas do parser e checker regenerado | DONE | 1 |
| 2 | escritor por linhas | DONE | 1 |
| 3 | núcleo da CLI e comandos de leitura | DONE | 1 |
| 4 | transação de escrita, log, set-status, integrate | DONE | 1 |
| 5 | bloqueios, prune e refresh-checker | DONE | 1 |
| 6 | acréscimo, ratificação e rejeição | DONE | 1 |
| 7 | varredura de bytes do critério 1, linha da regra e gates | DONE | 1 |

Falha da execução: nenhuma.

## Concerns (transcritos como registrados)

- T1: G2 and G3 (`claude plugin validate`) were not run. No manifest changed, so I expect no effect. G1 went from 959 to 965 because of the 6 new tests.
- T2: I did not run G2 (`claude plugin validate .`). Only G3 ran, and no marketplace files changed.
- T3: Os 13 comandos de escrita ainda não existem, pertencem às Tarefas 4 a 6. Por enquanto qualquer um deles sai 2 com `usage` e a mensagem "unknown command", mas aparece no --help. Com valor de opção repetido (exceto --evidence e --next), a CLI recusa com `usage`; a spec não fixa esse caso. Em modo texto, os comandos de leitura imprimem antes da linha-resumo o `result` em JSON indentado, para a saída ser útil; a última linha segue o formato da spec.
- T4:quality fix1: The dirty-tree finding no longer reproduces. The likely cause is that the finding was raised before the T4 commit, or that CRLF-only noise was cleared. I did not run the full G1, G2, G3 or G5, since this fix changed nothing.
- T5: The worktree's end-of-line setting printed "LF will be replaced by CRLF" warnings on `git add`. These are standard for this repo's CRLF checkouts, and `git status --porcelain` is empty after the commit.
- T6: 1) TDD order: I wrote the implementation first and added the tests afterwards. I checked the red phase by reverting roadmap.mjs to T5 (11 failures), then restored it. 2) The spec text says pending-no-owner, but the plan test and the refusal-code list say owner-missing, so add-pending refuses an empty --owner with owner-missing, exit 1. 3) add-decision and reject also refuse any cell over limits.cellChars with cell-too-long, which the plan did not list. 4) The tests for add-pending and inflight-add define DEC-002 in decisions.md first, because the checker correctly refuses a pending item that cites an undefined DEC.
- T7: The sweep matches changed lines with a line-level LCS alignment (exact text plus terminator) instead of the plan's longest common prefix and suffix. A prefix/suffix window would span far-apart edits such as a panel row plus a blockers row, so it could not bound the number of changed lines. The checks the plan lists (exit 0, `changed` not empty, checker errors 0, lines outside the touched ones, BOM, EOL and the NFD line byte-identical, files outside `changed` identical) are all there. The `add-decision` case expects only one added line in decisions.md and none in state.md, matching actual CLI behavior. I did not run a mutation check to prove the sweep fails when the CLI misbehaves.

## Gates

O relatório não traz resultado de gates registrado nesta execução; os gates aparecem apenas nos concerns acima (G1 de 959 para 965 testes na T1; G2 e G3 não rodados em T1, T2 e T4 como descrito).

## Entradas humanas

- O quê: Ratificação pelo dono das decisões autônomas de E3 (DEC-030); as de alcance contrato seguram o início de E18 e E22.
  - BLQ: nenhum registrado.
  - Workaround: E3 é entregue com as decisões registradas como pendentes; só os dependentes esperam a ratificação.
  - Bloqueante: não.
- O quê: Ratificação pelo dono das decisões de contrato de E2 em que E3 se apoia (DEC-102, DEC-103, DEC-107, DEC-111, DEC-112, DEC-115), ainda pendentes.
  - BLQ: nenhum registrado.
  - Workaround: O desenho segue as decisões como estão; uma rejeição posterior abre bloqueio de correção em E3 pela regra de ratificação.
  - Bloqueante: não.
