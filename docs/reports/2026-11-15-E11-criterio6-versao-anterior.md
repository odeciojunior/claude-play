# E11, critério 6: a 1.7.0 diante do plano com bloco de dados e do estado JSON da 2.0.0

Data: 2026-11-15. Conduzida por um agente opus com 2 sessões `claude -p` da 1.7.0 (`e38cb35`, por `--plugin-dir`), config descartável `D:/claude-e17-cfg`, `bypassPermissions` só na medição (DEC-311/312). Sandboxes `D:/claude-crit6/a` e `D:/claude-crit6/b`, clonadas da fixture do coordinator no commit do plano (`docs/plans/fixed-plan/plan.md`, com bloco `plan/1`); estado criado pela CLI da 2.0.0 (`progress.mjs init ... --commits per-step`). Custo: **US$ 1,05** (A 0,75; B 0,30).

| Caso | Estado entregue à 1.7.0 | Comportamento | Evidência |
|---|---|---|---|
| A | `progress.json` em `map-ready` (nunca lançado) | **ignora**: deixou o JSON intacto, criou `progress-plan.md` ao lado e executou os 3 passos (commits sum, mean, median e progress) com portão final opus/high | "The `progress.json` already in the folder uses a different format from what this skill reads, so I left it untouched." Dois arquivos de estado divergentes; código certo |
| B | `progress.json` em `in-progress`, onda 2, passo 1 `pass` com SHA (eventos approve-map, launch, report, commit, wave-gate, advance pela CLI da 2.0.0) | **recusa**: leu o JSON certo ("Step 1 (sum) is done: committed as `05a01fa`"), não mudou nada, sem commit duplicado, e recomendou a 2.0.0 | "Use the 2.0.0 coordinator. Run the version that created `progress.json`, so state stays consistent." |

Bloco de dados do plano: lido junto com o plano nos dois casos; a 1.7.0 não o usa (o estado dela não o cita). Uma execução por caso: o comportamento não é determinístico (em B, com orçamento maior, a sessão ofereceu reconstruir o estado ou terminar inline).

Texto para a nota de atualização: a 1.7.0 não entende o `progress.json` (progress/1) da 2.0.0. Diante de um estado ainda não iniciado, costuma ignorá-lo e criar o próprio `progress-*.md` ao lado (dois estados divergentes); diante de um estado em andamento, tende a parar e recomendar a 2.0.0. Depois de iniciar um plano com a 2.0.0, atualize todas as máquinas e sessões antes de retomá-lo.
