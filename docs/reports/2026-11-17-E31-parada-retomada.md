# E31: causa da correção extra na variante parada-retomada

Data: 2026-11-17. Desenho: `docs/plans/2026-11-17-measure-e31-parada-retomada-design.md` (decisões do dono DEC-021, DEC-022, DEC-024). Lote pago na config descartável `D:\claude-pos22-cfg`, worktree `D:/claude-pos22-release` em `a15165b` (árvores `plugins` 8eae29d e `tools/measure` 9ac17eb). Sessão principal `claude-opus-5-5` em todas as execuções.

## Desfecho

**Causa provável (n=1), defeito do produto.** Saída mecânica de um agente haiku aceita pelo workflow sem conferência vira achado sintético e correção opus da spec. A variante parada-retomada se expõe mais porque refaz as cargas da spec na retomada, onde a falha ainda derruba o pulo das revisões de spec e plano. A ligação com os lotes antigos (E11 e E13) é inferência: mesmo estágio, mesmo modelo, fora de tarefas e portões, e o código envolvido existe desde a 2.0.0 (ausente na 1.6.0/1.7.0, quando o salto apareceu); esses lotes não têm transcrição que confirme.

Correção decidida pelo dono: peça "Correção no produto" de E31, antes de E33, só com G1.

## Execuções

| Exec. | Situação | Correções | Custo (US$, transcrições) |
|---|---|---|---|
| x1 | válida | 0 | 3,761 |
| x2 | válida | 0 | 3,543 |
| x3 | inválida: arnês morto por processo externo (DEC-024) | – | 1,177 |
| x4 | válida | 2 (`spec-fix1` opus, uma por sessão) | 4,764 |
| **Total** | | | **13,24** de 15 firmes; reserva não usada |

Nenhuma execução passou de US$ 6. O custo por execução válida ficou entre 3,5 e 4,8 (premissa corrigida: cerca de 4,39).

**x3:** outra sessão da máquina rodou `D:/projects/bdesk/tools/release-bdesk.ps1`, cuja linha 558 faz `Stop-Process -Name "node" -Force`; o Git Bash mostra isso como saída 127. Horários conferidos ao segundo (log do bdesk 15:31:18, morte do arnês 15:31:19). A x4 rodou com pré-voo e sentinela; a sentinela só casou menções no texto de um prompt de outra sessão, sem execução do script, e as transcrições não têm saída 127.

## As duas ocorrências da x4

**S1, antes do corte (assinatura "outra": achado sintético sem relação com a parada).** O `E5:spec-commit` (haiku) devolveu `{"ok":true,"commit":""}` sem commitar: o `git diff --cached --quiet` com o arquivo novo no stage saiu 1, mas o Bash mostrou "(Bash completed with no output)" e o agente concluiu que não havia nada a commitar. O workflow aceita commit vazio sem conferir (`specReused = !cm.commit`, `roadmap-release.js:2232`), `reviewTruth` gera "dirty working tree" (`:417`) e uma correção opus faz o commit. O revisor `spec-review1` tinha passado sem achados.

**S2, retomada (H3, com a assinatura de H2).** O `E5:spec-load1` (haiku) devolveu `checkExit:1, emitExit:2`, mas o stdout mostrava `summary.exitCode: 0`. `checkSpecLoad` (`:1154`) devolve `checkFailed` sem olhar o stdout; isso desliga o pulo da spec (`:2237`) e o do plano (`:2405`), injeta achado crítico sintético (`:2236`), dispara uma correção opus vazia, `spec-review2` e `plan-review1` refeitos, e regrava o `run.json` (`7fb31a2`). Custo dessas 4 chamadas opus: cerca de US$ 0,72. Causa provável do valor errado: o texto de `R_LOAD` (`:2170`) diz "checkExit = 1, emitStdout and emitExit = 2", querendo dizer "do comando 1/2"; os dois casos com check ≠ 0 no lote devolveram exatamente 1 e 2.

## Hipóteses

| Hipótese | Resultado |
|---|---|
| H1 achado real do revisor | refutada: as revisões de spec e plano passaram sem achados nas 3 válidas |
| H2 retomada revisa de novo porque o pulo pelo `run.json` falha | refutada como causa própria: em x1 e x2 o pulo funcionou ("spec review skipped", "plan review skipped"); na x4 o pulo caiu por causa de H3 |
| H3 achado sintético | **confirmada na x4** (S2), e uma variante na S1 |
| H4 falta de ratificação | refutada: `pendingAtResume: []` |
| H5 erro de contagem do arnês | refutada neste lote (nota do extrator segue no backlog) |

## Cargas por haiku

Das 21 cargas de spec e plano do lote, 7 vieram com erro de transcrição (4 com código de saída errado, 3 com emit que não é JSON). Na carga do plano isso só custa nova tentativa; na da spec vira correção opus.

## Contadores e gatilhos

| | x1 | x2 | x4 | Limite |
|---|---|---|---|---|
| extraRounds / fixCalls | 0 / 0 | 0 / 0 | 1 / 2 | – |
| haiku / sonnet / opus | 22 / 12 / 5 | 22 / 11 / 5 | 23 / 11 / 7 | sonnet 11, opus 5 |
| ponderado sem haiku | 440 | 420 | 500 | 420 |

Os gatilhos da x4 saem inteiros das duas correções sintéticas. Os da x1 vêm da carga da spec repetida em sonnet (`spec-load3`) depois de dois emits haiku que não eram JSON. Os limites não mudam (decisão do dono).

## S3-08

A retomada repete setup, cargas, registro de status e progress: cerca de 6 a 9 haiku e 2 sonnet, de US$ 0,02 a 0,22 por execução. É releitura de estado, aceita sem otimização. O risco de a carga repetida virar correção opus fecha com a correção de E31. A parte de E31 da S2-17 fecha com este relatório.

## Saídas

- Transcrições, uma pasta por execução, cada uma com `SHA256SUMS`: `D:/claude-e31-out/parada-retomada-20261117-180415`, `-181650`, `-182828` e `-184110`, em `private/transcripts/`.
- Sandboxes intactos: `D:/claude-e31-work/x1` a `x4`.
- A config descartável fica até o fim do roadmap; o dono faz logout e só então ela é apagada.

## Adendo de aceitação (2026-11-17)

Critério 1 de E31 aceito pelo dono via Fable (DEC-006): estágio, agente e motivo das duas ocorrências conferidos nas transcrições da x4; custos e as 21 cargas recontados por script. Três correções de texto:

1. O "saiu 1" do `git diff --cached --quiet` na S1 é inferência: o resultado da ferramenta não mostra código de saída nem erro.
2. Das 21 cargas, 20 foram por haiku e 1 por sonnet (`spec-load3` da x1); os 7 erros são todos de haiku, ou seja, 7 de 20.
3. As linhas de `roadmap-release.js` citadas acima são da árvore medida `a15165b`; a correção está no merge `8fcc042`.
