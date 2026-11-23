# Fontes

<!-- roadmap:sources -->
| ID | Fonte | O que é | Lida em | Confiabilidade |
|---|---|---|---|---|
| SRC-01 | `docs/plans/2026-11-20-proximo-roadmap-plano.md (com as 12 decisões da seção 7 aprovadas pelo dono em 2026-11-21)` | plano de insumos e backlog consolidado B01 a B25 para o roadmap pós-2.3.0 | 2026-11-21 | executor e dono, primário, vigente |
| SRC-02 | `docs/reports/2026-11-20-retrospectiva-evolucao-skills.md` | retrospectiva empírica, lições e estado final dos roadmaps 1.6.0 a 2.3.0 | 2026-11-21 | executor, primário, vigente |
| SRC-03 | `docs/plans/roadmap-pos-2-2-0/state.md, decisions.md (decisão 17 e decisões 20 a 36 do pós-2.2.0) e measurements.md` | pendências, decisões e medições pagas do roadmap pós-2.2.0 | 2026-11-21 | executor e dono via Fable, primário, vigente |
| SRC-04 | `Relatório de triagem do backlog de 2026-11-15 (com adendo de 2026-11-17) em docs/reports` | triagem das 47 notas de backlog e pendências com dono | 2026-11-21 | executor e dono via Fable, primário |
| SRC-05 | `Relatório e desenho do lote do revisor opus de 2026-11-17 em docs/reports e docs/plans` | desenho e relatório do lote pago do revisor sonnet contra opus e laço quality | 2026-11-21 | executor, medição paga, primário |
| SRC-06 | `Relatório e desenho do lote de parada-retomada de 2026-11-17 em docs/reports e docs/plans` | desenho e relatório do lote pago da causa da correção extra em parada-retomada e cargas haiku | 2026-11-21 | executor, medição paga, primário |
| SRC-07 | `Roteiro de publicação da 2.3.0 de 2026-11-17 em docs/reports e docs/plans/2026-11-15-roadmap-pos-2-2-0.md` | roteiro de publicação da 2.3.0, não objetivos, premissas e portões canônicos G1 a G5 | 2026-11-21 | executor e dono, primário, vigente |
| SRC-08 | `docs/reports/2026-11-23-saida-de-script-sem-recopia.md` | relatório de diagnóstico: saída de script recopiada por LLM (script-runner, implementer, revisores) perde linhas, exit code e digest, com e sem context-mode; recomenda capture.mjs, paginação de até 3 KB, extrator de testes e critérios de aceite | 2026-11-23 | executor, testes de 2026-11-23 com fixtures em D:/claude-pos23-out/cm-tests (leitura assinada em execução única, a reproduzir), primário; decisões em aberto resolvidas pelo dono via Fable (DEC-024 a DEC-028) |
<!-- /roadmap:sources -->

## Conflitos

<!-- roadmap:conflicts -->
- SRC-03 (state.md do pós-2.2.0: 244.453 chars LF em roadmap-release.js) vs SRC-01/SRC-02 (245.049 chars LF após correções finais da publicação da 2.3.0): resolvido por medição direta do arquivo atual (245.049 chars LF) e por DEC-003.
- SRC-03 (decisão 26 do pós-2.2.0: gatilho opus > 5 em parada-retomada) vs SRC-01 (B01/E35 promove revisor por tarefa padrão a opus, elevando chamadas opus por construção): resolvido por DEC-001 e E39, que recalibra a linha de base de parada-retomada após E35, E37 e E38.
- SRC-08 (a leitura assinada por nonce e digest de 19 KB falha quando recopiada pelo script-runner, mesmo sem corte) vs SRC-01 (B07 previa conferir as cargas de spec e plano mecanicamente, com envelope assinado ou leitura direta em aberto): resolvido por DEC-024 e DEC-030 (B07 vai para E41, com captura por script e fatias de até 3 KB).
<!-- /roadmap:conflicts -->
