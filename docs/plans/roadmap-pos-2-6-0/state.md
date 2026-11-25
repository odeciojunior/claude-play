Estratégia v1.1 -- 2026-11-25

<!-- roadmap:now -->
1. Escrever o plano do E42 com plan-writer (docs/plans/pos-2-6-0-E42/spec.md --roadmap docs/plans/roadmap-pos-2-6-0). Runs: executor. Approves: opus por delegação (DEC-021). Depends on: -.
2. Escrever os planos do E44, E45, E50 e E51 com plan-writer. Runs: executor. Approves: opus por delegação (DEC-021). Depends on: -.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E42 | spec | `f30b247`, `docs/plans/pos-2-6-0-E42/spec.md` | plan-writer; plano inclui teste de paridade do motivo com gateFromCapture |
| E43 | nao-iniciado | - | - |
| E44 | spec | `8d50af4`, `docs/plans/pos-2-6-0-E44/spec.md` | plan-writer; citar coordinator.js (extract.failedNames null) no efeito no workflow |
| E45 | spec | `bc74c70`, `docs/plans/pos-2-6-0-E45/spec.md` | plan-writer; tarefa 1 é a confirmação headless |
| E46 | nao-iniciado | - | - |
| E47 | nao-iniciado | - | - |
| E48 | nao-iniciado | - | - |
| E49 | nao-iniciado | - | - |
| E50 | spec | `6f69b0c`, `docs/plans/pos-2-6-0-E50/spec.md` | plan-writer; não reescrever a linha t.skip de flow.test.mjs:3097 |
| E51 | spec | `e65a0aa`, `docs/plans/pos-2-6-0-E51/spec.md` | plan-writer; considerar checagem de --model no parseCli do run-baseline.mjs |
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
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
| release/pos-2.6.0 | viva | branch de release no worktree D:/projects/claude-play-wt/pos-2-6-0 (DEC-020) |
<!-- /roadmap:inflight -->
