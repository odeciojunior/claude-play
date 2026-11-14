# E27: revisor por tarefa, sonnet contra opus (passada A)

Data: 2026-11-13. Decisões: DEC-697 (duas passadas), DEC-698 (desenho da peça 1), DEC-699 (regra), DEC-700 (correção do arnês). Medição conduzida pelo orquestrador (sessões `claude -p` em `bypassPermissions`, só na orquestração e nas medições, DEC-311/312). É registro de evidência; a linha de política só entra na ratificação.

## Método

- Estágio `task-review`, braço `atual`: o prompt vem do próprio workflow (`buildTaskReviewPrompt`, modo `spec`) e o revisor roda como o agente `productivity-tools:task-reviewer`. O corretor é sonnet nos dois braços.
- Os defeitos são sintéticos, semeados na Task 3 do cenário E5: codigo-semeado-A (C1..C4) e codigo-semeado-B (C5..C8).
- O revisor roda com effort `medium` nos dois braços; só o modelo muda (sonnet ou opus).
- Plano: 2 cenários × 2 braços × 5 tentativas válidas. Cada braço soma 40 oportunidades de captura (10 tentativas × 4 defeitos).
- Captura por sentinela: um defeito conta como capturado quando sumiu de `feat/E5` depois do ciclo revisor + corretor. Indeterminados ficam fora da conta (DEC-051).
- Sonda de 1 execução por braço antes das baterias. As baterias rodaram em série, com `--permission-mode bypassPermissions` e `--max-budget-usd 3` por sessão.

## Ambiente

- Commit do arnês e do plugin medido: `20658405ef7b5158d4bea46e82586cc447a1a482` (worktree destacada, `--plugin-dir` productivity-tools 1.7.0).
- CLI 2.1.325, superpowers 7.0.2, tabela de preços de 2026-11-10.
- Conferido em todas as tentativas: o subagente revisor tem `agentType` `productivity-tools:task-reviewer` e roda no modelo do braço (`claude-sonnet-5-5` ou `claude-opus-5-5`). O corretor é sempre sonnet. A transcrição não grava o prompt de sistema; a numeração F1..Fn e a categoria `defeito`, que só existem em `agents/task-reviewer.md`, confirmam o agente.

## Resultados

| Cenário | Modelo | Tentativas | Válidas | Inválidas | Capturas | Custo dos agentes (US$) |
|---|---|---|---|---|---|---|
| A | sonnet | 5 | 5 | 0 | C1 5/5, C2 5/5, C3 5/5, C4 5/5 | 0,607 |
| A | opus | 5 | 5 | 0 | C1 5/5, C2 5/5, C3 5/5, C4 5/5 | 0,854 |
| B | sonnet | 5 | 5 | 0 | C5 5/5, C6 5/5, C7 5/5, C8 5/5 | 0,620 |
| B | opus | 5 | 5 | 0 | C5 5/5, C6 5/5, C7 5/5, C8 5/5 | 0,907 |

| Braço | Capturas | Determinadas | Custo por tentativa (agentes) | Bloqueantes por tentativa | Menores (total) |
|---|---|---|---|---|---|
| sonnet | 40/40 | 40 | US$ 0,123 | 4 (8×), 5 (2×) | 5 |
| opus | 40/40 | 40 | US$ 0,176 | 4 (9×), 5 (1×) | 2 |

Achados fora dos defeitos semeados:
- Sonnet marcou "nenhum check reportado" como bloqueante em 2 de 10 tentativas. É falso positivo: o `task-reviewer.md` isenta tarefas retomadas, e o resumo dizia "resumed".
- Opus apontou uma vez, como bloqueante, a falta de teste para texto em branco (AC3). É plausível como lacuna real.

## Regra de decisão (DEC-699)

- Diferença: opus 40 − sonnet 40 = 0, abaixo do limiar de 6.
- Tentativas determinadas: 40 por braço, acima do mínimo de 32.
- Os dois braços ficaram em ≥ 38/40.
- Ajuste "perdido do corretor" (o revisor listou o defeito e o corretor não corrigiu): 0 casos, porque não houve nenhum perdido. Bruto e ajustado coincidem.

**Resultado: sem diferença mensurável neste cenário. Pela regra, o revisor por tarefa continua sonnet (a linha de política entra na ratificação).**

## Custos

| Item | Agentes (arnês) | Sessão principal (estimada) | Total |
|---|---|---|---|
| Sondas | 0,36 | 0,47 | 0,83 |
| Braço sonnet | 1,23 | 2,40 | 3,63 |
| Braço opus | 1,76 | 2,39 | 4,15 |
| **Total** | **3,34** | **5,26** | **≈ 8,60** |

Teto: US$ 35 no total (sonnet 12, opus 18). O custo da sessão principal (orquestrador em opus, cerca de US$ 0,24 por tentativa) foi estimado pelos tokens das transcrições, porque o arnês não o registra.

## Limites

- **Efeito teto:** os defeitos semeados não separam os modelos, porque os dois capturaram tudo. O resultado não mostra equivalência em defeitos difíceis. O gatilho de DEC-699 (2 execuções reais com um bloqueante na revisão final que a revisão por tarefa deveria ter pego) pede uma nova medição com defeitos mais difíceis.
- **O que "capturado" mede:** a cadeia revisor + corretor, não só o revisor. Pelos achados extraídos, todos os revisores listaram os 4 defeitos de cada cenário.
- **Custo e papéis no agregado:** o agregado não inclui a sessão principal e junta revisor e corretor no papel `other`. O modelo do revisor foi conferido pelo `.meta.json` de cada subagente.
- **Effort:** `medium` vem do agregado e do script do arnês; a transcrição não grava o effort.
- **Amostra:** n = 5 válidas por artefato e braço, fixado antes de ver os resultados e sem extensão.

## Arquivos

Agregados (fora do repositório): `D:/claude-e27-out/sonda/codigo-semeado-A-task-review-atual-{sonnet-20261114-005731,opus-20261114-005900}/aggregate.json`; `D:/claude-e27-out/codigo-semeado-A-task-review-atual-sonnet-20261114-010025`, `...-A-...-opus-20261114-010447`, `...-B-...-sonnet-20261114-010933`, `...-B-...-opus-20261114-011358` (`aggregate.json` em cada).
