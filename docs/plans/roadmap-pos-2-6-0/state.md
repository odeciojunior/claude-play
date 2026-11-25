Estratégia v1.1 -- 2026-11-25

<!-- roadmap:now -->
1. Integrar plan/pos-2-6-0-E44 em release/pos-2.6.0 com G1 verde (DEC-028). Runs: executor. Approves: dono. Depends on: -.
2. Executar o plano do E42, depois do E44 integrado. Runs: executor. Approves: opus por delegação (DEC-021). Depends on: E44.
3. Executar os planos do E50 e do E51, nessa ordem, depois do E42. Runs: executor. Approves: opus por delegação (DEC-021). Depends on: E42.
4. Executar o plano do E45 por último; a tarefa 1 é paga (DEC-025, DEC-026). Runs: executor. Approves: opus por delegação (DEC-021). Depends on: E42.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E42 | plano | `f30b247`, `docs/plans/pos-2-6-0-E42/spec.md`, `docs/plans/pos-2-6-0-E42/plan.md` | executar depois do E44 (DEC-028) |
| E43 | nao-iniciado | - | - |
| E44 | na-branch | `8d50af4`, `docs/plans/pos-2-6-0-E44/spec.md`, `docs/plans/pos-2-6-0-E44/plan.md`, `docs/plans/pos-2-6-0-E44/progress.json`, `354392a8dac1cebc1ab5cfefdc4ca0d6bef844c4`, `b88669e2e49cd1d623d6bccc86d24eafb78708e1` | integrar plan/pos-2-6-0-E44 em release/pos-2.6.0 com G1 verde (DEC-028) |
| E45 | plano | `bc74c70`, `docs/plans/pos-2-6-0-E45/spec.md`, `docs/plans/pos-2-6-0-E45/plan.md` | executar por último; tarefa 1 paga (DEC-025, DEC-026) |
| E46 | nao-iniciado | - | - |
| E47 | nao-iniciado | - | - |
| E48 | nao-iniciado | - | - |
| E49 | nao-iniciado | - | - |
| E50 | plano | `6f69b0c`, `docs/plans/pos-2-6-0-E50/spec.md`, `docs/plans/pos-2-6-0-E50/plan.md` | executar depois do E42 (DEC-028) |
| E51 | plano | `e65a0aa`, `docs/plans/pos-2-6-0-E51/spec.md`, `docs/plans/pos-2-6-0-E51/plan.md` | executar depois do E50 (DEC-028) |
| E52 | nao-iniciado | - | - |
| E53 | nao-iniciado | - | - |
| E54 | nao-iniciado | - | - |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) autorizar push e tag do E54
- (executor) registrar o shq do coordinator.js como pendente fora do escopo (DEC-015)
- (executor) E43: usar extract.format vitest no gateFromCapture (spec do E44, resposta Q3; DEC-022)
- (owner) ratify DEC-030: o extrator usa o último resumo Tests do vitest
- (executor) E44, revisão final F1 (menor): assuntos 354392a e b88669e fora de type(scope); usar mensagem convencional no merge, sem reescrever os SHAs
- (owner) approve strategy v1.2: marcar respondida a questão aberta do E44 (fixture do vitest, spec do E44) e regenerar Onde estamos
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
| release/pos-2.6.0 | viva | branch de release no worktree D:/projects/claude-play-wt/pos-2-6-0 (DEC-020) |
| plan/pos-2-6-0-E44 | viva | E44 executado, aguarda merge em release/pos-2.6.0 (worktree pos-2-6-0-E44) |
<!-- /roadmap:inflight -->
