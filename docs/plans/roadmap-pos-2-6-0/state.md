Estratégia v1.2 -- 2026-11-25

<!-- roadmap:now -->
1. Executar os planos do E50 e do E51, nessa ordem. Runs: executor. Approves: opus por delegação (DEC-021). Depends on: - (E42 integrado em b31ba00).
2. Executar o plano do E45 por último; a tarefa 1 é paga (DEC-025, DEC-026). Runs: executor. Approves: opus por delegação (DEC-021). Depends on: -.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E42 | na-branch | `f30b247`, `docs/plans/pos-2-6-0-E42/spec.md`, `docs/plans/pos-2-6-0-E42/plan.md`, `docs/plans/pos-2-6-0-E42/progress.json`, `38651fb3c74d84d65aa97fde1e5713e54f68bb9f`, `5a48b37e21ec8620603cc5431dbb53041dfb68bc`, `f0119227f102952b3d3aa2502f0e2910be247560`, `13fa3a2e7559e68f98965bc6ad3944d430dbb1fe` | release/pos-2.6.0 (merge b31ba00) entra em main na publicação (E54) |
| E43 | nao-iniciado | - | escrever a spec (E42 e E44 já em release/pos-2.6.0) |
| E44 | na-branch | `8d50af4`, `docs/plans/pos-2-6-0-E44/spec.md`, `docs/plans/pos-2-6-0-E44/plan.md`, `docs/plans/pos-2-6-0-E44/progress.json`, `354392a8dac1cebc1ab5cfefdc4ca0d6bef844c4`, `b88669e2e49cd1d623d6bccc86d24eafb78708e1`, `5fcf32a` | release/pos-2.6.0 entra em main na publicação (E54) |
| E45 | plano | `bc74c70`, `docs/plans/pos-2-6-0-E45/spec.md`, `docs/plans/pos-2-6-0-E45/plan.md` | executar por último; tarefa 1 paga (DEC-025, DEC-026) |
| E46 | nao-iniciado | - | - |
| E47 | nao-iniciado | - | - |
| E48 | nao-iniciado | - | - |
| E49 | nao-iniciado | - | - |
| E50 | plano | `6f69b0c`, `docs/plans/pos-2-6-0-E50/spec.md`, `docs/plans/pos-2-6-0-E50/plan.md` | executar o plano (E42 integrado em b31ba00); antes, rodar de novo os checks dele (DEC-028); piso do G1 na linha de merge do E42 no log |
| E51 | plano | `e65a0aa`, `docs/plans/pos-2-6-0-E51/spec.md`, `docs/plans/pos-2-6-0-E51/plan.md` | executar depois do E50 (DEC-028) |
| E52 | nao-iniciado | - | escrever a spec (E44 já em release/pos-2.6.0) |
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
- (executor) E43: usar extract.format vitest no gateFromCapture (spec do E44, resposta Q3; DEC-022); antes, mais de um resumo vira unknown (DEC-031)
- (executor) teste 'discover --page prints each signed page' (preflight.test.mjs:1027) falhou 1 vez no G1 da revisão final do E42 e passou sozinho; investigar se repetir
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
| release/pos-2.6.0 | viva | branch de release no worktree D:/projects/claude-play-wt/pos-2-6-0 (DEC-020) |
| plan/pos-2-6-0-E44 | viva | integrado em release/pos-2.6.0 (5fcf32a); branch e worktree pos-2-6-0-E44 ainda existem |
| plan/pos-2-6-0-E42 | viva | integrado em release/pos-2.6.0 (b31ba00); branch e worktree pos-2-6-0-E42 ainda existem |
<!-- /roadmap:inflight -->
