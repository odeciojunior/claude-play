# Log

<!-- roadmap:log -->
| Data | Entregável | O que aconteceu | Evidência |
|---|---|---|---|
| 2026-11-17 | E33 | Sonda paga plan-only (DEC-033) passou: spec-commit e plan-commit feitos de primeira com pending vazio, sem -commit2; US$ 1,87. Revisão final T3 da release: 0 crítico, 2 importantes e 5 menores (modo procs); correção em fix/e33-procs-revisao. | `docs/plans/roadmap-pos-2-2-0/measurements.md` |
| 2026-11-17 | - | Pendências retiradas do state.md: duas (dono) de E31 (AC1 aceito), notas de E30 no desenho (lote feito), S3-24 antiga (substituída pela do roadmap futuro, DEC-031) e premissa da v1.1 (escrita). Carga haiku corrigida para 7 de 20. | `state.md` |
| 2026-11-17 | - | Estratégia v1.1 (dono via Fable): absorve DEC-007 a DEC-036; custo de parada-retomada cerca de US$ 4,0 por execução (3,54 a 4,76 em E31); questões de E29 e E33 respondidas; card E33 com sonda, revisão final e segundo push. | `../2026-11-15-roadmap-pos-2-2-0.md` |
| 2026-11-17 | E31 | custo registrado para E31: US$ 13,24 pelas transcrições (x1 3,761, x2 3,543, x3 inválida 1,177, x4 4,764) em measurements.md; total 22,46 de 40. | `docs/reports/2026-11-17-E31-parada-retomada.md` |
| 2026-11-17 | E30 | custo registrado para E30: US$ 9,216 pela CLI por sessão (sonnet 3,602, opus 5,613) em measurements.md. | `docs/reports/2026-11-17-E30-revisor-opus.md` |
| 2026-11-17 | - | config: measurements.md habilitado (DEC-036), com a linha de evento no README. | `roadmap.config.json` |
| 2026-11-17 | E33 | DEC-031 a DEC-036 (dono via Fable, DEC-006) registradas e ratificadas: S3-24 adiada, caminho de E33, sonda paga, alcance da autorização, logout e measurements.md. | `decisions.md` |
| 2026-11-17 | E31 | DEC-028 a DEC-030 (correção de E31) ratificadas pelo dono via Fable, sem emenda, conferidas contra o diff do merge e os testes novos. | `decisions.md` |
| 2026-11-17 | E30 | E30 AC1 e AC2 aceitos pelo dono via Fable: os 20 aggregate.json recontados por script dão os números do relatório (sonnet 20/40, opus 28/40, US$ 9,22) e a decisão do modelo e do laço quality está registrada. Linha da medição em measurements.md. | `docs/reports/2026-11-17-E30-revisor-opus.md` |
| 2026-11-17 | E31 | E31 AC1 aceito pelo dono via Fable: estágio, agente e motivo conferidos nas transcrições da x4; custos e as 21 cargas recontados por script. Adendo no relatório com 3 correções de texto (exit 1 do diff é inferido; 7 erros em 20 cargas haiku; linhas citadas da árvore medida). | `docs/reports/2026-11-17-E31-parada-retomada.md` |
| 2026-11-17 | E31 | E31 passou para na-branch | `8fcc042b86100fe7680f422077c7b287fe276c1e`, `gates G1, G2, G3, G4, G5`, `docs/plans/pos-2-2-0-E31/spec.md`, `docs/plans/pos-2-2-0-E31/plan.md`, `docs/plans/pos-2-2-0-E31/reviews.md` |
| 2026-11-17 | E31 | E31 passou para executando | `docs/plans/pos-2-2-0-E31/spec.md`, `docs/plans/pos-2-2-0-E31/plan.md` |
| 2026-11-17 | E31 | Lote de E31: 3 válidas (x1, x2, x4) e 1 inválida por causa externa (x3), US$ 13,24 de 15; reserva não usada. x4 com 2 correções opus de achado sintético (spec não commitada; exit code de carga mal transcrito). Causa provável (n=1), defeito do produto. | `docs/reports/2026-11-17-E31-parada-retomada.md` |
| 2026-11-17 | E31 | DEC-025, DEC-026 e DEC-027 (fecho de E31, dono via Fable) ratificadas | `decisions.md` |
| 2026-11-17 | E31 | DEC-024 (x3 inválida e x4 de E31, dono via Fable) ratificada | `decisions.md` |
| 2026-11-17 | E30 | Lote de E30: 20 execuções válidas, US$ 9,22 de 16. Sonnet 20/40 capturas, opus 28/40; opus passa na R2; laço quality fica (R3 inconclusiva). Sobra 6,78 vai à reserva comum. | `docs/reports/2026-11-17-E30-revisor-opus.md` |
| 2026-11-17 | E30 | DEC-023 (resultado de E30 pela regra do desenho, dono via Fable) ratificada | `decisions.md` |
| 2026-11-17 | E30 | DEC-021 e DEC-022 (dono via Fable, DEC-006) registradas e ratificadas | `decisions.md` |
| 2026-11-17 | E32 | E32 AC1 aceito pelo dono via Fable (DEC-006): 47 notas com situação, contagem refeita por script. Adendo no relatório: S2-02 já feita (10 obsoletas, 1 corrigida, 36 pendentes), parte E29 da S2-17 fechada no merge, S3-24 não entrou em E29 e segue pendente. | `docs/reports/2026-11-15-E32-triagem-backlog.md` |
| 2026-11-17 | E33 | DEC-019 e DEC-020 (dono via Fable, DEC-006) registradas e ratificadas | `decisions.md` |
| 2026-11-17 | E29, E32 | DEC-007 e DEC-009 a DEC-017 ratificadas pelo dono via Fable (DEC-006) | `decisions.md` |
| 2026-11-17 | E29 | DEC-008 ratificada pelo dono via Fable (DEC-006), com emenda sobre o número da versão | `decisions.md` |
| 2026-11-15 | E29 | E29 passou para na-branch | `a563e48710c42e1b1adbed3815941d36835a584c`, `gates G1, G2, G3, G4, G5`, `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md`, `docs/plans/pos-2-2-0-E29/reviews.md` |
| 2026-11-15 | E29 | E29 passou para executando | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md` |
| 2026-11-15 | E29 | BLQ-1 resolvido: desbloqueio de E29 pelo release | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md` |
| 2026-11-15 | E32 | E32 passou para na-branch | `92096976de66b3ab0f8af81c96b7da08b55f3e19`, `gates G1, G2, G3, G4, G5`, `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md`, `docs/plans/pos-2-2-0-E32/reviews.md` |
| 2026-11-15 | E32 | E32 passou para executando | `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md` |
| 2026-11-15 | E29 | BLQ-1 aberto: E29 bloqueado: automatic execution stopped (conteudo): branch gates did not pass: gates not green (G1): G1: exit 0, total 2172, skipped 2, failing [] (baseline: exit 0, total 2175, skipped 2, failing []) \| G2: exit 0 [...] texto completo em docs/plans/pos-2-2-0-E29/reviews.md | `branch feat/E29` |
| 2026-11-15 | E29 | E29 passou para executando | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md` |
| 2026-11-15 | - | Roadmap criado | `../2026-11-15-roadmap-pos-2-2-0.md` |
<!-- /roadmap:log -->
