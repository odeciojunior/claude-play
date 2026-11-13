# Log

<!-- roadmap:log -->
| Data | Entregável | O que aconteceu | Evidência |
|---|---|---|---|
| 2026-11-13 | E23 | r1 parou em defeito (T3 sem vermelho válido: saída por \| grep). US$ 7,47. Fable decidiu: rebase de T3, correção do implementer.md antes da retomada, limites de workflowChars em escada (T3 238800 a T6 239800). | `docs/reports/2026-11-13-E23-run.md` |
| 2026-11-13 | E23 | BLQ-12 aberto: E23 bloqueado: automatic execution stopped (conteudo): task 3: test-first without a failing check then the same check passing (4 checks). A rerun takes the task as done and skips this check: first drop its [...] texto completo em docs/plans/evolucao-skills-E23/reviews.md | `branch feat/E23` |
| 2026-11-13 | E23 | E23 passou para executando | `docs/plans/evolucao-skills-E23/spec.md`, `docs/plans/evolucao-skills-E23/plan.md` |
| 2026-11-13 | E21 | E21 integrada (07e625c) e ratificada por delegação (Fable): 17 decisões, 6 de contrato; 14 como estão e DEC-587, DEC-589 e DEC-594 com emenda. Script em 239.866 LF (folga 134). Custo US$ 38,37 (r1 13,65; r2 6,80; r3 4,50; r4 4,35; r5 7,73; T8 1,34). E23 liberado (DEC-030). | `decisions.md` |
| 2026-11-13 | E21 | Item humano de E21 (DEC-204, comportamental do task-reviewer) fechado por delegação (Fable): relatório em c72dafc, padrão e restrita aprovados (portão de DEC-601), review informativo; US$ 1,34. Ressalva: no modo restrito o agente não leu o arquivo do pacote; correção em fix/pos-E21. | `docs/reports/2026-11-12-E21-revisor-comportamental.md` |
| 2026-11-13 | E21 | DEC-594 (E21) ratificada com emenda por delegação (Fable): comportamental por claude -p com --plugin-dir, portão padrão e restrita | `decisions.md` |
| 2026-11-13 | E21 | DEC-589 (E21) ratificada com emenda por delegação (Fable): a revisão única não vale em E21 e é o desenho de partida de E28 | `decisions.md` |
| 2026-11-13 | E21 | DEC-587 (E21, contrato) ratificada com emenda por delegação (Fable): vale só restricted, no texto de DEC-602 | `decisions.md` |
| 2026-11-13 | E21 | DEC-602 e DEC-604 (contrato), DEC-603 e DEC-605 de E21 ratificadas por delegação (Fable), conferidas em 07e625c. Repetições: DEC-602 é o texto de referência de DEC-587 e DEC-603 o de DEC-589; DEC-604 e DEC-605 executam DEC-599 e DEC-598, do dono. | `decisions.md` |
| 2026-11-13 | E21 | DEC-584, DEC-586 e DEC-590 (contrato) e DEC-585, DEC-588, DEC-591, DEC-592, DEC-593, DEC-595 e DEC-596 de E21 ratificadas pelo dono por delegação (Fable), conferidas contra o código integrado em 07e625c; nenhuma repete outra. | `decisions.md` |
| 2026-11-13 | E21 | E21 passou para na-branch | `07e625c7dd022cd7aefef72e5ffbe7bb255b51c2`, `gates G1, G2, G3, G4, G5`, `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md`, `docs/plans/evolucao-skills-E21/reviews.md` |
| 2026-11-13 | E21 | E21 passou para executando | `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md` |
| 2026-11-13 | E21 | BLQ-11 resolvido: desbloqueio de E21 pelo release | `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md` |
| 2026-11-13 | E21 | Execução r2: BLOCKED parcial. Código da T5 revertido (0ee4677), script em 239866 caracteres LF, 134 sob o teto. Custo US$ 6,80 (r1: US$ 13,65). Metade da revisão única do AC3 vai para E28 (DEC-597, DEC-598, estratégia v1.6). | `docs/reports/2026-11-13-E21-run.md` |
| 2026-11-13 | E21 | DEC-599 a DEC-601 (E21) ratificadas por delegação (Fable) | `decisions.md` |
| 2026-11-13 | E21 | DEC-597 (E21) ratificada com emenda por delegação (Fable) | `decisions.md` |
| 2026-11-13 | E21 | BLQ-11 aberto: E21 bloqueado: automatic execution stopped (conteudo): task 9 BLOCKED: Partial BLOCKED, as the plan's reversal path (R14/C5) and the owner instruction require. Text freed in the per-task review wording [...] texto completo em docs/plans/evolucao-skills-E21/reviews.md | `branch feat/E21` |
| 2026-11-13 | E21 | E21 passou para executando | `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md` |
| 2026-11-13 | E21 | BLQ-10 resolvido: desbloqueio de E21 pelo release | `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md` |
| 2026-11-13 | E21 | BLQ-10 aberto: E21 bloqueado: automatic execution stopped (conteudo): final: fix BLOCKED: Item 2 foi corrigido, com teste, no commit 3b5c950. No item 1 os comentários dos outros estágios voltaram ao texto original (commit [...] texto completo em docs/plans/evolucao-skills-E21/reviews.md | `branch feat/E21` |
| 2026-11-12 | E21 | E21 passou para executando | `docs/plans/evolucao-skills-E21/spec.md`, `docs/plans/evolucao-skills-E21/plan.md` |
| 2026-11-12 | E9 | Comportamental do implementer (DEC-576): modo A falhou 2x (comando anotado em checks quebra testFirstGap); texto do agente corrigido em c8ee19a (comando literal idêntico, saída sem paráfrase, humanInputs restrito); reexecução: A e B passam. US$ 1,56. E21 liberado. | `docs/reports/2026-11-12-E9-implementador-comportamental.md` |
| 2026-11-12 | E9 | E9 integrada (2d1c5e1) e ratificada por delegação (Fable): DEC-569 (contrato), DEC-570 a DEC-578 e DEC-582, sem repetições; DEC-576 com emenda (comportamental após o merge, despacho pelo nome em claude -p). Script em 239.997 LF (folga 3). E21 liberado (DEC-030) depois do comportamental. | `decisions.md` |
| 2026-11-12 | E9 | DEC-576 (E9) ratificada com emenda por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E9 | DEC-569 (contrato) e DEC-570 a DEC-575, DEC-577, DEC-578 e DEC-582 de E9 ratificadas pelo dono por delegação (Fable), conferidas contra o código integrado em 2d1c5e1; nenhuma repete outra. | `decisions.md` |
| 2026-11-12 | E20 | 2ª passada opus da suíte de gatilho (DEC-581): 22/24, 0 erros, 2 inconclusivos (spec-3 pt/en passa a spec-author sem Skill); plan-execution-1 vai a plan-coordinator nas 2 línguas; gatilho de DEC-579/580 não disparou. US$ 7,04. Portão de spec-writer/plan-writer cumprido. | `docs/reports/2026-11-13-E20-suite-gatilho-2.md` |
| 2026-11-12 | E17 | productivity-tools 1.7.0 publicado pelo dono a partir de feat/E17-medicao (DEC-445): main 3fbb59b -> 73cd476 (árvore do plugin 214fb3b), push feito; G1 1434/0, G2-G5, X1, X2 verdes; cache 1.7.0 com gitCommitSha 73cd476. marketplace-tools não está instalado na config do dono. | `73cd476` |
| 2026-11-12 | E9 | E9 passou para na-branch | `2d1c5e1ed83190e968ead9977c6f428779721e2b`, `gates G1, G2, G3, G4, G5`, `docs/plans/evolucao-skills-E9/spec.md`, `docs/plans/evolucao-skills-E9/plan.md`, `docs/plans/evolucao-skills-E9/reviews.md` |
| 2026-11-12 | E9 | E9 passou para executando | `docs/plans/evolucao-skills-E9/spec.md`, `docs/plans/evolucao-skills-E9/plan.md` |
| 2026-11-12 | E9 | BLQ-9 resolvido: desbloqueio de E9 pelo release | `docs/plans/evolucao-skills-E9/spec.md`, `docs/plans/evolucao-skills-E9/plan.md` |
| 2026-11-12 | E20 | Critério 5 aceito com condição por delegação (Fable): suíte de gatilho em 2 passadas (haiku 15/24, opus 19/24, US$ 6,04), sem confusão entre skills do plugin; plan-execution-1 é caso inválido e será corrigido; nova passada opus é portão da publicação de spec-writer e plan-writer. | `docs/reports/2026-11-13-E20-suite-gatilho.md` |
| 2026-11-12 | E20 | DEC-579, DEC-580, DEC-581 (E20, critério 5) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E9 | BLQ-9 aberto: E9 bloqueado: automatic execution stopped (conteudo): final has open issues after 2 fixes: 1. [important/defeito] plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js The new test-first [...] texto completo em docs/plans/evolucao-skills-E9/reviews.md | `branch feat/E9` |
| 2026-11-12 | E9 | E9 passou para executando | `docs/plans/evolucao-skills-E9/spec.md`, `docs/plans/evolucao-skills-E9/plan.md` |
| 2026-11-12 | E9 | 1ª execução de E9 falhou por infraestrutura: o agente productivity-tools:spec-author não existe no 1.6.0 instalado. DEC-566, DEC-567, DEC-568: o release passa a rodar em claude -p com --plugin-dir na árvore de _integracao. | `docs/reports/2026-11-12-E9-run.md` |
| 2026-11-12 | E9 | DEC-566, DEC-567, DEC-568 (execução do release sem interface com --plugin-dir) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E8 | E8 fechado por delegação (Fable): 28 decisões da rodada integrada ratificadas (8 de contrato; DEC-548 com emenda), 47 repetições ratificadas e DEC-493, DEC-502 e DEC-532 rejeitadas; gatilho de DEC-442 aceito; sonda acceptEdits autorizada. E9, E11 e E26 liberados (DEC-030). | `decisions.md` |
| 2026-11-12 | E8 | DEC-565 (gatilho de DEC-442, E8) decidida pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E8 | DEC-480 a DEC-506 e DEC-510 a DEC-536 de E8 ratificadas como repetição das rodadas 1 e 2 do mesmo spec (precedente: DEC-459 a DEC-474), salvo DEC-493, DEC-502 e DEC-532, rejeitadas, e as quatro da rodada integrada. O texto de referência é o de DEC-537 a DEC-560. | `decisions.md` |
| 2026-11-12 | E8 | DEC-532 rejeitada pelo dono; DEC-564 a substitui | `decisions.md` |
| 2026-11-12 | E8 | DEC-502 rejeitada pelo dono; DEC-563 a substitui | `decisions.md` |
| 2026-11-12 | E8 | DEC-493 rejeitada pelo dono; DEC-562 a substitui | `decisions.md` |
| 2026-11-12 | E8 | DEC-548 (E8, contrato) ratificada com emenda por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E8 | Decisões de E8 ratificadas por delegação (Fable): registro da rodada integrada (3723436), DEC-537 a DEC-560 mais DEC-517, DEC-518, DEC-531 e DEC-534 (itens 8, 9, 22 e 25 do spec, não regravados). Contrato: 518, 537, 542, 546, 547, 548, 549 e 551; libera os dependentes de E8 (DEC-030). | `decisions.md` |
| 2026-11-12 | E8 | E8 passou para na-branch | `37234367718719ba7e155d07efee76356e734627`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E8-release-spec-plano-nativos-paradas-design.md`, `docs/superpowers/plans/2026-11-12-E8-release-spec-plano-nativos-paradas.md` |
| 2026-11-12 | E8 | E8 passou para executando | `docs/superpowers/specs/2026-11-12-E8-release-spec-plano-nativos-paradas-design.md`, `docs/superpowers/plans/2026-11-12-E8-release-spec-plano-nativos-paradas.md` |
| 2026-11-12 | E8 | BLQ-8 resolvido: desbloqueio de E8 pelo release | `docs/superpowers/specs/2026-11-12-E8-release-spec-plano-nativos-paradas-design.md`, `docs/superpowers/plans/2026-11-12-E8-release-spec-plano-nativos-paradas.md` |
| 2026-11-12 | E17 | Ponto de medição do 1.7.0 concluído e liberado por delegação (DEC-507, DEC-508, DEC-509): detecção sem queda, contadores dentro de DEC-448, haiku +5 de parada-retomada liberado, deriva do superpowers aceita, metas de E4 e E22 atingidas. Gasto cerca de US$ 87,4. Relatórios em 73cd476, merge 4c4027e. | `docs/reports/2026-11-12-e17-ponto-de-medicao/comparacao.md, achados-1.7.0.md` |
| 2026-11-12 | E17 | DEC-507, DEC-508, DEC-509 (fechamento da medição de E17) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E8 | BLQ-8 aberto: E8 bloqueado: automatic execution stopped (conteudo): final has open issues after 2 fixes: 1. [important/defeito] [...] texto completo em docs/superpowers/reviews/2026-11-12-E8-release-spec-plano-nativos-paradas-reviews.md | `branch feat/E8` |
| 2026-11-12 | E8 | E8 passou para executando | `docs/superpowers/specs/2026-11-12-E8-release-spec-plano-nativos-paradas-design.md`, `docs/superpowers/plans/2026-11-12-E8-release-spec-plano-nativos-paradas.md` |
| 2026-11-12 | E20 | Decisões de E20 ratificadas por delegação (Fable): DEC-425 a DEC-440, DEC-459 a DEC-474 como repetição, DEC-475 rejeitada (nota). DEC-477 aceita o id E<n> no spec-writer, DEC-478 delega o critério 5, DEC-479 libera E8 antes da publicação do 1.7.0. | `decisions.md` |
| 2026-11-12 | E20, E8 | DEC-477 (id E<n> no spec-writer), DEC-478 (critério 5 pelo orquestrador) e DEC-479 (E8 antes da publicação do 1.7.0) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E20 | DEC-475 rejeitada pelo dono; DEC-476 a substitui | `decisions.md` |
| 2026-11-12 | E20 | DEC-459 a DEC-474 ratificadas pelo dono (delegação, Fable) como repetição de DEC-425 a DEC-440 (execução retomada de E20); DEC-461, DEC-462 e DEC-463 já trazem as emendas DEC-450 a DEC-452 | `decisions.md` |
| 2026-11-12 | E20 | DEC-427, DEC-429, DEC-430 e DEC-432 a DEC-439 (local, E20) ratificadas pelo dono por delegação (Fable); DEC-427 e DEC-429 valem com DEC-450 e DEC-451; DEC-436 com a forma de reserva aceita em DEC-453 | `decisions.md` |
| 2026-11-12 | E20 | DEC-425, DEC-426, DEC-428, DEC-431 e DEC-440 (contrato, E20) ratificadas pelo dono por delegação (Fable); DEC-428 vale com a busca do spec de DEC-452; libera E8 (DEC-030) | `decisions.md` |
| 2026-11-12 | E20 | E20 passou para na-branch | `4cbf12881845aadf0289c4634b7b5f7f039957b4`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E20-autor-plano-plan-writer-ponteiros-design.md`, `docs/superpowers/plans/2026-11-12-E20-autor-plano-plan-writer-ponteiros.md` |
| 2026-11-12 | E20 | Critério 4 aceito por delegação em bf4712d (DEC-456): F4-1 a F4-3, F4-4 (a)-(e) e check final passam em claude -p (US$ 2,2). N5-1 e N5-2 (DEC-457) viram pendências com portão na publicação de plan-writer (DEC-458). | `docs/reports/2026-11-12-E20-autor-plano-comportamental.md` |
| 2026-11-12 | E20 | BLQ-7 resolvido: Critério 4 refeito em bf4712d e aceito por delegação (DEC-456); critérios 1 e 2 aceitos (DEC-453); E20 volta a executando para a revisão final da branch. | `bf4712d, 5a4161a` |
| 2026-11-12 | E20 | DEC-456, DEC-457, DEC-458 (E20, critério 4) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E20 | Decisão do dono por delegação (Fable): critérios 1 e 2 aceitos e pendência de DEC-400 fechada; critério 4 corrigido em E20 em 3ª e última rodada (conta fechada da Adoção, diff mecânico, check antes do move, busca do spec do card), em opus. | `decisions.md` |
| 2026-11-12 | E20 | DEC-449 a DEC-455 (E20) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E17 | Medição paga de E17 parada pela regra de duas inválidas seguidas em codigo-semeado-A (US$ 52,4); roteiro B de E25 PASS no cache; decisões DEC-441 a DEC-448 por delegação; codigo-semeado-B em curso e parada-retomada a refazer com arnês corrigido. | `scratchpad/e17-medicao, fix/e17-harness-retomada 5205d1c` |
| 2026-11-12 | E17 | DEC-441 a DEC-448 (medição de E17) decididas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E20 | BLQ-7 aberto: E20 bloqueado: automatic execution stopped (conteudo): final: fix BLOCKED: I changed nothing and made no commit. Items 1 to 4 (two pairs of duplicates) need new [...] texto completo em docs/superpowers/reviews/2026-11-12-E20-autor-plano-plan-writer-ponteiros-reviews.md | `branch feat/E20` |
| 2026-11-12 | E20 | E20 passou para executando | `D:/projects/claude-play-wt/E20/docs/superpowers/specs/2026-11-12-E20-autor-plano-plan-writer-ponteiros-design.md`, `docs/superpowers/plans/2026-11-12-E20-autor-plano-plan-writer-ponteiros.md` |
| 2026-11-12 | - | Decisões de E19 e E7 ratificadas pelo dono por delegação (Fable), emendas a DEC-370, DEC-376, DEC-386 e DEC-394; pendências do dono de E19 resolvidas por DEC-400. | `decisions.md` |
| 2026-11-12 | E7 | DEC-385, DEC-387, DEC-388, DEC-389, DEC-390, DEC-391, DEC-392, DEC-393, DEC-395, DEC-396, DEC-397, DEC-398, DEC-399 ratificadas pelo dono | `decisions.md` |
| 2026-11-12 | E7 | DEC-394 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E7 | DEC-386 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E19 | DEC-420 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E19 | DEC-404 a DEC-419 ratificadas pelo dono como repetição de DEC-369 a DEC-384 (execução retomada de E19); DEC-405 e DEC-411 valem com as emendas a DEC-370 e DEC-376 | `decisions.md` |
| 2026-11-12 | E19 | DEC-369, DEC-371, DEC-372, DEC-373, DEC-374, DEC-375, DEC-377, DEC-378, DEC-379, DEC-380, DEC-381, DEC-382, DEC-383, DEC-384 ratificadas pelo dono | `decisions.md` |
| 2026-11-12 | E19 | DEC-376 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E19 | DEC-370 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E19 | E19 passou para na-branch | `a03329f62ee1c76ece45767d218f3ba326cfe7bb`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E19-autor-spec-skill-interativa-design.md`, `docs/superpowers/plans/2026-11-12-E19-autor-spec-skill-interativa.md` |
| 2026-11-12 | E19 | BLQ-6 resolvido: Tarefa 6 rodada pelo orquestrador (relatório em a277199), critérios aceitos por delegação e correção do SKILL.md em 01b3634; E19 volta a executando. | `a277199, 01b3634` |
| 2026-11-12 | E19 | E19: critérios 1 e 2 aceitos por delegação do dono sobre o relatório das execuções comportamentais (critério 1 com 3/3, critério 2 aprovado, forma de reserva); correção de texto do SKILL.md (01b3634) antes do merge. | `docs/reports/2026-11-12-E19-autor-spec-comportamental.md, a277199` |
| 2026-11-12 | E19 | DEC-400, DEC-401, DEC-402, DEC-403 ratificadas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E7 | E7 passou para na-branch | `ae16fa55b143503921f58a5041b40b9113a47b77`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E7-coordinator-mapa-estado-codigo-design.md`, `docs/superpowers/plans/2026-11-12-E7-coordinator-mapa-estado-codigo.md` |
| 2026-11-12 | E7 | E7 passou para executando | `docs/superpowers/specs/2026-11-12-E7-coordinator-mapa-estado-codigo-design.md`, `docs/superpowers/plans/2026-11-12-E7-coordinator-mapa-estado-codigo.md` |
| 2026-11-12 | E19 | BLQ-6 aberto: E19 bloqueado: automatic execution stopped (conteudo): task 6 BLOCKED: Task 6 was not run. It needs a subagent tool to dispatch the spec-author agent, and this session has [...] texto completo em docs/superpowers/reviews/2026-11-12-E19-autor-spec-skill-interativa-reviews.md | `branch feat/E19` |
| 2026-11-12 | E19 | E19 passou para executando | `docs/superpowers/specs/2026-11-12-E19-autor-spec-skill-interativa-design.md`, `docs/superpowers/plans/2026-11-12-E19-autor-spec-skill-interativa.md` |
| 2026-11-12 | E17 | Critério 4 aceito por delegação do dono (Fable, precedente DEC-280/283): volta/productivity-tools-1.7.1 em a951ed5 parte de M; o plugin difere da tag 1.6.0 só na versão, linha 1 do checker e asserções; G1-G5 exit 0 em volta.md. | `volta.md, a951ed5` |
| 2026-11-12 | E17 | DEC-368 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E17 | DEC-365 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E17 | DEC-366 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E17 | DEC-314 a DEC-364 ratificadas pelo dono por delegação (Fable); repetem DEC-285 a DEC-299 e DEC-310, que prevalecem onde o texto diferir | `decisions.md` |
| 2026-11-12 | E17 | DEC-300 a DEC-309 ratificadas pelo dono | `decisions.md` |
| 2026-11-12 | E17 | E17 passou para na-branch | `452a841354acf7f3bbe72c5d115c61c6167b84ba`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E17 | E17 passou para na-branch | `452a841354acf7f3bbe72c5d115c61c6167b84ba`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E17 | E17 passou para executando | `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E17 | BLQ-5 resolvido: desbloqueio de E17 pelo release | `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E17 | BLQ-5 aberto: E17 bloqueado: automatic execution stopped (conteudo): final has open issues after 2 fixes: 1. [critical/defeito] dirty working tree (uncommitted files); branch feat/E17 kept at D:/projects/claude-play-wt/E17 | `branch feat/E17` |
| 2026-11-12 | - | Problemas de permissão analisados por delegação (Fable): bypass só na operação (DEC-311), produto sem bypass como padrão (DEC-312, DEC-313); seis pendências para E8 e o arnês. | `scratchpad/permissoes-fable-pendente.md` |
| 2026-11-12 | E17 | Braço de plano: decisão delegada (Fable) DEC-310; armMatches corrigido em feat/E17, linha de base da classe plano mantida. | `c7efe09` |
| 2026-11-12 | E8 | DEC-313 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E8 | DEC-312 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | - | DEC-311 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E17 | DEC-310 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E17 | E17 passou para executando | `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E17 | Decisões DEC-285 a DEC-296 de E17 ratificadas pelo dono por delegação (Fable); emendas às decisões 1, 10 e 12 como DEC-298 (a DEC-285), DEC-299 (a DEC-294) e DEC-297 (a DEC-296). Nenhuma decisão do executor pendente. | `decisions.md` |
| 2026-11-12 | E17 | Decisão 10 de E17 ratificada com emenda do dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E17 | Decisão 1 de E17 ratificada com emenda do dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E17 | Decisão 12 de E17 ratificada com emenda do dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E17 | Decisões 2 a 9 e 11 de E17 ratificadas pelo dono por delegação (Fable) | `decisions.md` |
| 2026-11-12 | E25 | Critério 4 conferido por agente opus delegado no commit 0b5c1d3 (anterior à concessão), modo padrão: sem regra, negado, e o preflight mostrou Workflow(productivity-tools:release-workflow); com essa regra em .claude/settings.local.json, o lançamento seguinte começou sem diálogo. | `e25-dono/c4-regra/run1-sem-regra.jsonl, run2-com-regra.jsonl` |
| 2026-11-12 | E17 | E17 passou para plano | `docs/superpowers/specs/2026-11-12-E17-ponto-medicao-primeira-publicacao-design.md`, `docs/superpowers/plans/2026-11-12-E17-ponto-medicao-primeira-publicacao.md` |
| 2026-11-12 | E25 | Roteiro B parado: instalação a partir da worktree criou o cache 1.6.0 com a concessão e a chave workflows, mas a pasta descartável não tem conta (loggedIn false); nenhuma credencial copiada. settings.json do usuário inalterado; skipWorkflowUsageWarning não apareceu. | `e25-dono/cfg, e25-dono/hash-before.txt` |
| 2026-11-12 | E25 | Critério 4, roteiro A, sessão interativa no commit anterior à concessão: o diálogo diz que o script de 213.337 caracteres não pode ser mostrado e oferece só "No". Critério emendado (DEC-282, estratégia v1.5); falta rodar o lançamento com a regra exata. | `e25-dono/c4-A-s1.snap06-workflow-dialog.txt` |
| 2026-11-12 | E25 | Critério 6 conferido por agente delegado (roteiro A, modo padrão, sem regra): workflow lançado pelo nome, permission_denials vazio, journal criado, nenhuma regra gravada; controle sem concessão negado. Sem interface o preflight precisa de Bash(git:*) e Bash(node:*). | `e25-dono/c6-A-com2.json, e25-dono/c6-A-ctl.json` |
| 2026-11-12 | E25 | DEC-282 a DEC-284 ratificadas pelo dono | `decisions.md` |
| 2026-11-12 | E15 | Estratégia v1.4: tabela de metas derivadas após a linha de base de E15 (DEC-034), aprovada por delegação do dono; medições de E15 registradas em measurements.md | `docs/reports/2026-11-11-e15-linha-de-base/linha-de-base.md` |
| 2026-11-12 | E15 | Aceite de E15 e tabela de metas por delegação do dono | `decisions.md` |
| 2026-11-12 | E15 | DEC-279 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E15 | Etapa 2 da linha de base completa (bypassPermissions): planner 1, tracker 1, plan-only 5, coordinator 3, completo 3 com E5 integrado, parada-retomada 3. Arnês corrigido no caminho (preflight, teto de 10 min, integrated, DEC-278, journal real). | `tools/measure/out` |
| 2026-11-12 | E15 | DEC-051, dado: nas 2 tentativas de plano-semeado-A pelo pipeline completo o agente de plano devolveu reused=false e corrigiu os defeitos semeados antes da revisão (2 de 2 inválidas por plano-reescrito); tentativas guardadas em _dados-dec051-plano-pipeline, fora da classe | `tools/measure/out/_dados-dec051-plano-pipeline` |
| 2026-11-12 | E25 | Correção de DEC-275 e DEC-276 integrada: disable-model-invocation no SKILL.md do release, exigido pelo lint com a concessão; F2 e F4; CONTRIBUTING.md e README do plugin; portão opus high aprovado com ressalvas, aplicadas | `df10773` |
| 2026-11-12 | E15 | DEC-278 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E25 | Teste comportamental (DEC-271) rodado pela sessão principal em dry-run nos três cenários, sem Workflow; revisão adversarial aprovada com ressalvas; resumo no log de revisões | `docs/superpowers/reviews/2026-11-12-E25-release-lancado-pelo-nome-reviews.md` |
| 2026-11-12 | E25 | O commit 48524fb (rótulo T6) é correção da peça 5: chave de frontmatter repetida dá FAIL no lint. Mantido pelo dono, com revisão em opus e portão final. | `48524fb` |
| 2026-11-12 | E25 | DEC-274 rejeitada pelo dono; DEC-277 a substitui | `decisions.md` |
| 2026-11-12 | E25 | DEC-268 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E25 | DEC-265 ratificada pelo dono | `decisions.md` |
| 2026-11-12 | E25 | DEC-256, DEC-257, DEC-258, DEC-259, DEC-260, DEC-261, DEC-262, DEC-263, DEC-264, DEC-266, DEC-267, DEC-269, DEC-270, DEC-271, DEC-272, DEC-273 ratificadas pelo dono | `decisions.md` |
| 2026-11-12 | E25 | E25 passou para na-branch | `1524260022d7e955bb9c1406cf717b9f74189f30`, `gates G1, G2, G3, G4, G5`, `docs/superpowers/specs/2026-11-12-E25-release-lancado-pelo-nome-design.md`, `docs/superpowers/plans/2026-11-12-E25-release-lancado-pelo-nome.md`, `docs/superpowers/reviews/2026-11-12-E25-release-lancado-pelo-nome-reviews.md` |
| 2026-11-12 | E25 | E25 passou para executando | `docs/superpowers/specs/2026-11-12-E25-release-lancado-pelo-nome-design.md`, `docs/superpowers/plans/2026-11-12-E25-release-lancado-pelo-nome.md` |
| 2026-11-12 | - | Pendentes do executor fechados: ressalvas baixas de E22 (achados 5 a 7) e wtRoot do SKILL.md do release (revisão da tarefa 7 de E18); gates G1 a G5 e embed verdes (1314 testes, 0 falhas) | `01e5807` |
| 2026-11-12 | E4 | fix/E4-w2-w4 integrado (DEC-255): avisos do scaffold em modo completo | `69ab037` |
| 2026-11-12 | - | Pendente do executor fechado: correção de DEC-254 (pendente de critério nomeia o entregável e usa a tabela de frases) e avisos W2/W4 do scaffold (DEC-255) integrados; os quatro pendentes de critério fundidos, todos de E15, renomeados para a forma nova | `645519e` |
| 2026-11-12 | E18 | Teste comportamental da tarefa 7 (DEC-230) rodado pela sessão principal em dry-run até o passo 4, sem Workflow; revisão adversarial aprovada com ressalvas; resumo no log de revisões | `docs/superpowers/reviews/2026-11-11-E18-registro-release-cli-preflight-reviews.md` |
| 2026-11-11 | E4 | DEC-255: W2 e W4 entram sem prosa contada (decisão delegada pelo dono ao Fable) | `decisions.md` |
| 2026-11-11 | E4 | Critério 4 de E4 aceito por delegação do dono ao Fable | `docs/reports/2026-11-11-E4-revisor-planner-comportamental.md` |
| 2026-11-11 | E22 | Critérios 2 e 3 de E22 aceitos por delegação do dono ao Fable | `docs/reports/2026-11-11-E22-tracker-rubricas-comportamental.md` |
| 2026-11-11 | E18 | DEC-226 ratificada pelo dono | `decisions.md` |
| 2026-11-11 | E18, E22, E4 | DEC-213 a DEC-249 (locais de E18, E22 e E4) ratificadas por delegação do dono ao Fable | `decisions.md` |
| 2026-11-11 | E22 | E22 integrado na release: tarefa 8 pelo orquestrador, execução extra, revisão final opus/high aprovada com ressalvas corrigidas | `53fe7d1` |
| 2026-11-11 | E3 | Correção do next-id integrada: ignora o checker vendorizado na raiz da pasta (DEC-253) | `d90420c` |
| 2026-11-11 | E22 | BLQ-4 resolvido: tarefa 8 de E22 feita pelo orquestrador na feat/E22; relatório com os critérios 2 e 3 aguardando o dono | `14fb3e8` |
| 2026-11-11 | E3 | DEC-253: emenda do dono a DEC-145 (next-id ignora o checker vendorizado), recomendada pelo Fable | `decisions.md` |
| 2026-11-11 | E18 | Correção pós-ratificação: preflight avisa quando decisions.md falta ou a pasta não é lida; skill cita só o scope contract (DEC-251) | `52a512d` |
| 2026-11-11 | E22 | DEC-234 ratificada pelo dono | `decisions.md` |
| 2026-11-11 | E18 | DEC-217 ratificada pelo dono | `decisions.md` |
| 2026-11-11 | E18 | DEC-212 ratificada pelo dono | `decisions.md` |
| 2026-11-11 | E18, E22 | DEC-211, DEC-215, DEC-232, DEC-233, DEC-235 ratificadas pelo dono | `decisions.md` |
| 2026-11-11 | E4 | Correção de E4 (W6, W1, cabeçalhos pt, lint 0 WARN, validação de itens) integrada na release | `5a8ab1e` |
| 2026-11-11 | E22 | BLQ-4 aberto: a execução automática de E22 parou na tarefa 8 (despacha subagentes; é do orquestrador da sessão principal, DEC-204; o executor não tem a ferramenta, nada simulado). E22 passa a bloqueado; `feat/E22` mantida. | `8f53396d9d5bb47731d7d4a1fa027d5197922a99` |
| 2026-11-11 | E22 | E22 passa a executando na feat/E22 (execução automática pelo release, depois de E18); feat/E22 sincronizada com a release e spec e plano aprovados pelas revisões. 17 decisões autônomas do spec gravadas como pendentes (DEC-232 a DEC-248). | `docs/superpowers/plans/2026-11-11-E22-tracker-enxuto-rubricas.md` |
| 2026-11-11 | E18 | E18 entrou em `release/roadmap-skills-v2` (merge da `feat/E18`); gates iguais à linha de base: G1 exit 0 com 1286 testes, 0 falhas, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. DEC-211 em diante seguem pendentes de ratificação; critérios do card comparados, sem mudança. | `48f2c0b3c413774c4683d4720e912311a5826610` |
| 2026-11-11 | E18 | E18 passa a executando na feat/E18 (execução automática pelo release); spec e plano aprovados pelas revisões. 21 decisões autônomas do spec gravadas como pendentes (DEC-211 em diante); as 11, 18 e 21 foram cortadas na célula, texto inteiro no spec. | `docs/superpowers/plans/2026-11-11-E18-registro-release-cli-preflight.md` |
| 2026-11-11 | E4 | E4 entrou em release/roadmap-skills-v2 (merge da feat/E4); G1 com 1236 testes, 0 falhas; G2 a G5 exit 0 (lint com 3 avisos novos). Revisão final opus/high aprovou com ressalvas. | `64e9c54` |
| 2026-11-11 | E4 | BLQ-1 resolvido: A tarefa 9 rodou pela sessão principal (DEC-204); E4 mesclado em release/roadmap-skills-v2 | `64e9c54` |
| 2026-11-11 | E15, E2, E3, E6 | Correções de código das ratificações entraram em `release/roadmap-skills-v2`: G1 com 1169 testes, 0 falhas; G2 a G5 exit 0; revisão final opus/high aprovada com ressalvas, achados corrigidos. | `8303bc9` |
| 2026-11-11 | E6 | O dono ratificou DEC-210 (padrões de efeito externo do plan-tool). | `decisions.md` |
| 2026-11-11 | E3, E6 | O dono decidiu Contradiz "-" na linha de emenda de ratify --amend (DEC-209); DEC-210 registrada, de origem executor e pendente, sobre os padrões de efeito externo do plan-tool. | `decisions.md` |
| 2026-11-11 | - | BLQ-2 e BLQ-3 fechados pela ratificação; E18 e E22 voltam a `nao-iniciado`. BLQ-2 não listava DEC-137 a DEC-139, de que E18 também depende; ficaram cobertas pela mesma ratificação. | `decisions.md` |
| 2026-11-11 | - | Desvio de DEC-030 registrado: E3 e E6 foram mesclados e E4 rodou 8 tarefas com decisões de contrato de E2 (e de E5 para E6) ainda pendentes; só E18 e E22 pararam. Sem retrabalho segundo a revisão; até E8 (DEC-031), o orquestrador confere `pending-decisions` antes de iniciar cada entregável. | `decisions.md` |
| 2026-11-11 | E15, E2, E5, E3, E4, E6 | O dono ratificou DEC-088 a DEC-192 em bloco, por delegação ao revisor Fable após três revisões opus: 89 como estavam e 16 com emendas registradas como DEC-193 a DEC-208; gatilhos de revisão gravados nas decisões de contrato que estavam sem. | `decisions.md` |
| 2026-11-11 | E22 | BLQ-3 aberto: a execução automática de E22 parou por entrada humana (ratificação pelo dono das decisões de contrato de E3, DEC-136 a DEC-153 em parte). E22 passa a bloqueado; `feat/E22` mantida. | `8f53396d9d5bb47731d7d4a1fa027d5197922a99` |
| 2026-11-11 | E18 | BLQ-2 aberto: a execução automática de E18 parou por entrada humana (ratificação pelo dono das decisões de contrato de E3 ainda pendentes: DEC-136, DEC-140, DEC-141, DEC-143, DEC-145, DEC-146, DEC-148 a DEC-150, DEC-153). E18 passa a bloqueado; `feat/E18` mantida em `D:/projects/claude-play-wt/E18`. | `c137ac190b801f255572648d40261f021139a437` |
| 2026-11-11 | E6 | E6 entrou em `release/roadmap-skills-v2` (merge da `feat/E6`); gates iguais à linha de base: G1 exit 0 com 1138 testes, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. DEC-176 a DEC-192 seguem pendentes de ratificação; critérios do card comparados, sem mudança. | `db19e0e37dcef2965d210f9c20732b6184b55239` |
| 2026-11-11 | E6 | Execução do plano iniciada na branch `feat/E6`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E6-formato-ferramenta-plano.md` |
| 2026-11-11 | E6 | DEC-176 a DEC-192 registradas, de origem executor e pendentes de ratificação, vindas do spec de E6. | `decisions.md` |
| 2026-11-11 | E4 | BLQ-1 aberto: a execução automática parou na tarefa 9 (exige despachar subagentes; sem ferramenta de subagente no executor, o revisor não foi simulado). E4 passa a bloqueado; `feat/E4` mantida. | `1362158c1ec3a43f8b19f32cb5695dcd11224004` |
| 2026-11-11 | E4 | Execução do plano iniciada na branch `feat/E4`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E4-planner-scaffold-rubrica.md` |
| 2026-11-11 | E4 | DEC-158 a DEC-175 registradas, de origem executor e pendentes de ratificação, vindas do spec de E4. | `decisions.md` |
| 2026-11-11 | E4 | Plano escrito, na branch `feat/E4`. | `docs/superpowers/plans/2026-11-11-E4-planner-scaffold-rubrica.md` |
| 2026-11-11 | E4 | Spec escrito, na branch `feat/E4`. | `docs/superpowers/specs/2026-11-11-E4-planner-scaffold-rubrica-design.md` |
| 2026-11-11 | E3 | E3 entrou em `release/roadmap-skills-v2` (merge da `feat/E3`); gates iguais à linha de base: G1 exit 0 com 1051 testes, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. DEC-136 a DEC-157 seguem pendentes de ratificação; critérios do card comparados, sem mudança. | `ee7a3d70995f903f260b897327361b2573d5c624` |
| 2026-11-11 | E3 | Execução do plano iniciada na branch `feat/E3`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E3-cli-eventos-tracker.md` |
| 2026-11-11 | E3 | DEC-136 a DEC-157 registradas, de origem executor e pendentes de ratificação, vindas do spec de E3. | `decisions.md` |
| 2026-11-11 | E3 | Plano escrito, na branch `feat/E3`. | `docs/superpowers/plans/2026-11-11-E3-cli-eventos-tracker.md` |
| 2026-11-11 | E3 | Spec escrito, na branch `feat/E3`. | `docs/superpowers/specs/2026-11-11-E3-cli-eventos-tracker-design.md` |
| 2026-11-11 | E5 | E5 entrou em `release/roadmap-skills-v2` (merge da `feat/E5`); gates iguais à linha de base: G1 exit 0 com 959 testes, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. DEC-117 a DEC-135 seguem pendentes de ratificação; critérios do card comparados, sem mudança. | `8685133067f25af8ed6a53cfa720af0aaeb59445` |
| 2026-11-11 | E5 | Execução do plano iniciada na branch `feat/E5`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E5-formato-ferramenta-spec.md` |
| 2026-11-11 | E5 | DEC-117 a DEC-135 registradas, de origem executor e pendentes de ratificação, vindas do spec de E5. | `decisions.md` |
| 2026-11-11 | E5 | Plano escrito, na branch `feat/E5`. | `docs/superpowers/plans/2026-11-11-E5-formato-ferramenta-spec.md` |
| 2026-11-11 | E5 | Spec escrito, na branch `feat/E5`. | `docs/superpowers/specs/2026-11-11-E5-formato-ferramenta-spec-design.md` |
| 2026-11-11 | E2 | E2 entrou em `release/roadmap-skills-v2` (merge da `feat/E2`); gates iguais à linha de base: G1 exit 0 com 894 testes, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. DEC-102 a DEC-116 seguem pendentes de ratificação; critérios do card comparados, sem mudança. | `0202e00f1be5032c95d759a41883de84c57e54b3` |
| 2026-11-11 | E2 | Execução do plano iniciada na branch `feat/E2`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E2-formato-roadmap-verificado.md` |
| 2026-11-11 | E2 | DEC-102 a DEC-116 registradas, de origem executor e pendentes de ratificação, vindas do spec de E2. | `decisions.md` |
| 2026-11-11 | E2 | Plano escrito, na branch `feat/E2`. | `docs/superpowers/plans/2026-11-11-E2-formato-roadmap-verificado.md` |
| 2026-11-11 | E2 | Spec escrito, na branch `feat/E2`. | `docs/superpowers/specs/2026-11-11-E2-formato-roadmap-verificado-design.md` |
| 2026-11-11 | E15 | E15 entrou em `release/roadmap-skills-v2` (merge da `feat/E15`); gates iguais à linha de base: G1 exit 0 com 847 testes, G2, G3, G4 e G5 exit 0. Ainda não está em `main`. As execuções pagas e a conferência dos critérios 1 a 4 seguem com o dono. | `edeb2b9e7c10b5154f4a40c3c095377b11b08322` |
| 2026-11-11 | E15 | Execução do plano iniciada na branch `feat/E15`, pelo release (execução automática). Spec e plano aprovados pelas revisões. | `docs/superpowers/plans/2026-11-11-E15-linha-de-base.md` |
| 2026-11-11 | E15 | DEC-088 a DEC-101 registradas, de origem executor e pendentes de ratificação, vindas do spec de E15. | `decisions.md` |
| 2026-11-11 | E15 | Plano escrito, na branch `feat/E15`. | `docs/superpowers/plans/2026-11-11-E15-linha-de-base.md` |
| 2026-11-11 | E15 | Spec escrito, na branch `feat/E15`. | `docs/superpowers/specs/2026-11-11-E15-linha-de-base-design.md` |
| 2026-11-11 | E1 | Correção após a integração: o cenário de medição chega ao sandbox em LF mesmo num checkout CRLF (um teste de `tools/` falhava em checkout novo, fora do G1 antigo). G1 passa a incluir `tools/**`, com 800 testes; G4 deixa de ser tratado como restrito. Estratégia v1.3. | `0e443ce` |
| 2026-11-10 | E1 | E1 entrou em `release/roadmap-skills-v2` (merge da `feat/E1`); gates iguais à linha de base: G1 exit 0 com 720 testes, G2, G3 e G5 exit 0. Ainda não está em `main`. | `21d1979fb70266b94508ec2b8a64da29a1c2af0f` |
| 2026-11-10 | E1 | Execução do plano iniciada na branch `feat/E1`, pelo release (execução automática). Spec e plano aprovados pelas revisões; DEC-085 a DEC-087 já ratificadas. | `docs/superpowers/plans/2026-11-10-E1-ferramentas-medicao-cenario.md` |
| 2026-11-10 | E1 | Registro do plano de E1 conferido (status plano, spec e plano na branch `feat/E1`). DEC-085 a DEC-087 registradas, de origem executor e pendentes de ratificação, vindas do spec de E1. | `decisions.md` |
| 2026-11-10 | E1 | DEC-062 a DEC-080 registradas, de origem executor e pendentes de ratificação, vindas do spec de E1. | `decisions.md` |
| 2026-11-10 | E1 | Plano escrito, na branch `feat/E1`. | `docs/superpowers/plans/2026-11-10-E1-ferramentas-medicao-cenario.md` |
| 2026-11-10 | E1 | Spec escrito, na branch `feat/E1`. | `docs/superpowers/specs/2026-11-10-E1-ferramentas-medicao-cenario-design.md` |
| 2026-11-10 | - | Roadmap criado (modo completo), com 27 entregáveis em 6 fases, após as revisões independentes, as divisões de cards e a revisão e ratificação das decisões com o dono. | `docs/plans/2026-11-10-roadmap-evolucao-skills.md` |
| 2026-11-10 | E14 | Experimentos de DEC-052 executados por subagents, a pedido do dono: versão menor substitui a instalada; plano semeado preservado e revisado (uma execução); permissão do Workflow medida sem interface. Sete decisões e os cards E14, E1 e E25 emendados; resta o diálogo interativo. | `docs/reports/2026-11-10-roadmap-experimentos-resultados.md` |
| 2026-11-10 | E25 | Consentimento do workflow conferido na sessão interativa por pseudo-terminal: o diálogo grava a regra no projeto e a sessão seguinte lança sem diálogo. DEC-035 confirmada; o dono decidiu que a concessão por `allowed-tools` entra (DEC-049); REQ-033 coberto. | `docs/reports/2026-11-10-roadmap-experimentos-resultados.md` |
| 2026-11-10 | - | Pasta do roadmap e relatórios commitados na branch `release/roadmap-skills-v2`, criada de `main`; tag local `productivity-tools--v1.6.0` na ponta de `main`. Caminhos do diretório pessoal e ids de sessão trocados por marcadores nos relatórios. Sem push. | `git log release/roadmap-skills-v2` |
| 2026-11-10 | E14 | Sondas rodadas por três subagents, a pedido do dono, e não na sessão principal como DEC-029 previa. Agente do plugin em workflow funciona; script de workflow é arquivo único; plano com schema sem falha em 80 tentativas; cache não legível para caminho. DEC-057 a DEC-061 registradas, pendentes. | `docs/reports/2026-11-10-e14-sondas-resultados.md` |
| 2026-11-10 | E14 | O dono ratificou DEC-057 a DEC-061 e aprovou a revisão da estratégia para a v1.1, que absorve as decisões das sondas em E2, E8, E18, E19, E21, E23 e E25, sem mudar entregável, dependência ou critério. | `docs/plans/2026-11-10-roadmap-evolucao-skills.md` |
| 2026-11-10 | E14 | Fechado: as cinco sondas têm resultado registrado como decisão ratificada, e a estratégia v1.1 absorve o que contrariava os cards. Nenhum arquivo do plugin foi alterado. | `baa77bf` |
| 2026-11-10 | - | O dono ratificou DEC-053 a DEC-056, de alcance local: teste próprio de E4, nota de atualização em `docs/releases/`, artefatos de E1 a E8 na pasta do superpowers e a receita de fixar a loja numa tag. Nenhuma decisão do executor fica pendente. | `decisions.md` |
| 2026-11-10 | E1 | O dono ratificou DEC-062 a DEC-080, as decisões do spec de E1, com quatro emendas registradas como DEC-081 a DEC-084: detecção inconclusiva bloqueia, diário sem os campos invalida a tentativa, o arnês registra que o prompt é cópia, e a variante de defeitos por código fica fora do pago em E15. | `decisions.md` |
| 2026-11-10 | E1 | O dono ratificou DEC-085 a DEC-087, as três decisões que o spec de E1 tomou ao absorver as emendas. Nenhuma decisão do executor fica pendente; o plano de E1 está pronto para execução. | `decisions.md` |
<!-- /roadmap:log -->
