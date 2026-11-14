# E12: registro cortado pelo Git Bash

Data: 2026-11-13. Investigação do "null record agent" do registro "executando" de E12 r1. Decisão: correção `fix/registro-8k` (dono via Fable). É registro de evidência.

## Sintoma

Na execução E12 r1, o estágio de registro montou um único comando `node verify-run.mjs group <carga>` com 16.618 caracteres (20 passos: set-status, log, 16 add-decision, add-pending e inflight-add; carga codificada de 16.493 caracteres, 41% em escapes `%XX`). O agente `productivity-tools:script-runner` (haiku) devolveu `{"exit":2,"stdout":""}` e o workflow falhou com "null record agent"; as decisões de E12 foram gravadas depois pelo orquestrador. O registro pós-merge (na-branch), pequeno, funcionou.

## Causa

Quando um processo Windows nativo (o Claude Code) lança o Git Bash com `bash -c "<string>"`, o bash recebe a string cortada em silêncio em **8.186 caracteres**. A ferramenta Bash embrulha o comando (`... && eval '<cmd>' && pwd -P >| <tmp>`) em cerca de 450 a 505 caracteres, então qualquer comando acima de **cerca de 7.700 caracteres** é cortado no meio do `eval '...'`: o bash acha uma aspa simples sem par, sai com exit 2 e não escreve nada no stdout. O `verify-run.mjs` nunca rodou.

## Evidências

- Transcript do subagente de E12: uma única chamada Bash, com o comando idêntico byte a byte ao do prompt (16.493 caracteres de carga); resultado `Exit code 2 /usr/bin/bash: -c: line 1: unexpected EOF while looking for matching '`. O haiku copiou literalmente e relatou com fidelidade.
- Reprodução fora do Claude Code: o comando real de E12, com o verify-run trocado por um `node -e` inofensivo, pelo mesmo embrulho e via spawn no bash: status 2, stdout vazio, o mesmo stderr. Com 7.667 caracteres, funcionou.
- Ferramenta Bash real (sessão headless haiku, US$ 0,015): 7.000 caracteres passam; 8.500 falham com o erro de E12.
- Os dois executáveis do Git (`Git/bin/bash.exe` e `Git/usr/bin/bash.exe`) cortam em 8.186. O `node.exe` chamado direto recebe 16.493 caracteres intactos, e o bash repassando ao `node.exe` passa 20.000 intactos: o gargalo é só a entrada Windows → bash do Git (runtime MSYS2).
- Hipóteses refutadas: o haiku não conseguir copiar a carga (a cópia foi literal) e o agente ter descartado a saída (o stdout estava vazio de fato; o erro saiu no stderr).

## Medições do registro de E12

| Teto | Trechos | Maior comando |
|---|---|---|
| 28.000 (antes) | 1 | 16.618 (falha) |
| 7.000 | 3 | 6.812 |
| **6.000 (correção)** | **3** | **5.960** |
| 5.000 | 4 | 5.039 |

## Correção

`CMD_CAP = 6000` medido sobre o comando completo (folga de cerca de 1.700 sob o corte, contando o embrulho); passo único ou comando de checagem da verdade do git acima do teto não é despachado e falha com o tamanho. Descartadas: grupo em sonnet (o limite é do shell), carga por arquivo via heredoc (o heredoc passa pelo mesmo `-c`), repetir no exit 2 (a falha é determinística e exit 2 não prova que nada rodou) e passar só ids (mudança grande). Conferência: `docs/reports/2026-11-13-fix-registro-8k-comportamental.md`.
