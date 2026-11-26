Estratégia v1.3 -- 2026-11-26

<!-- roadmap:now -->
1. Executar o plano do E49, último da fila do roadmap-release.js. Runs: executor. Approves: opus por delegação (DEC-021). Depends on: - (E48 integrado em 9b6f08a).
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E42 | na-branch | `f30b247`, `docs/plans/pos-2-6-0-E42/spec.md`, `docs/plans/pos-2-6-0-E42/plan.md`, `docs/plans/pos-2-6-0-E42/progress.json`, `38651fb3c74d84d65aa97fde1e5713e54f68bb9f`, `5a48b37e21ec8620603cc5431dbb53041dfb68bc`, `f0119227f102952b3d3aa2502f0e2910be247560`, `13fa3a2e7559e68f98965bc6ad3944d430dbb1fe` | release/pos-2.6.0 (merge b31ba00) entra em main na publicação (E54) |
| E43 | na-branch | `docs/plans/pos-2-6-0-E43/spec.md`, `45f08d5`, `docs/plans/pos-2-6-0-E43/plan.md`, `plan/pos-2-6-0-E43`, `docs/plans/pos-2-6-0-E43/progress.json`, `c55df7cf21127d85f94fdaec7134750489731d08`, `5525bf64ac5fbdcc388eb51c50a112c9ea0f6ed7`, `18b8e18` | release/pos-2.6.0 (merge 18b8e18) entra em main na publicação (E54) |
| E44 | na-branch | `8d50af4`, `docs/plans/pos-2-6-0-E44/spec.md`, `docs/plans/pos-2-6-0-E44/plan.md`, `docs/plans/pos-2-6-0-E44/progress.json`, `354392a8dac1cebc1ab5cfefdc4ca0d6bef844c4`, `b88669e2e49cd1d623d6bccc86d24eafb78708e1`, `5fcf32a` | release/pos-2.6.0 entra em main na publicação (E54) |
| E45 | na-branch | `bc74c70`, `docs/plans/pos-2-6-0-E45/spec.md`, `docs/plans/pos-2-6-0-E45/plan.md`, `plan/pos-2-6-0-E45`, `docs/plans/pos-2-6-0-E45/progress.json`, `8b559c8` | release/pos-2.6.0 (merge 8b559c8) entra em main na publicação (E54) |
| E46 | na-branch | `docs/plans/pos-2-6-0-E46/spec.md`, `16a1d81`, `docs/plans/pos-2-6-0-E46/plan.md`, `plan/pos-2-6-0-E46`, `docs/plans/pos-2-6-0-E46/progress.json`, `26cfb3c` | release/pos-2.6.0 (merge 26cfb3c) entra em main na publicação (E54) |
| E47 | na-branch | `docs/plans/pos-2-6-0-E47/spec.md`, `53f28be`, `docs/plans/pos-2-6-0-E47/plan.md`, `plan/pos-2-6-0-E47`, `docs/plans/pos-2-6-0-E47/progress.json`, `37294bd` | release/pos-2.6.0 (merge 37294bd) entra em main na publicação (E54) |
| E48 | na-branch | `docs/plans/pos-2-6-0-E48/spec.md`, `92b224f`, `docs/plans/pos-2-6-0-E48/plan.md`, `plan/pos-2-6-0-E48`, `docs/plans/pos-2-6-0-E48/progress.json`, `9b6f08a` | release/pos-2.6.0 (merge 9b6f08a) entra em main na publicação (E54) |
| E49 | executando | `docs/plans/pos-2-6-0-E49/spec.md`, `b43f5bd`, `docs/plans/pos-2-6-0-E49/plan.md`, `plan/pos-2-6-0-E49` | conferir, revisão T2, G1 no merge e integrar em release/pos-2.6.0 |
| E50 | na-branch | `6f69b0c`, `docs/plans/pos-2-6-0-E50/spec.md`, `docs/plans/pos-2-6-0-E50/plan.md`, `plan/pos-2-6-0-E50`, `docs/plans/pos-2-6-0-E50/progress.json`, `e05e78dca19aab0fc5b70abfb4e02ec047110065`, `6b0814f435f24979765c548d774d1af76af29881`, `857624a` | release/pos-2.6.0 (merge 857624a) entra em main na publicação (E54) |
| E51 | na-branch | `e65a0aa`, `docs/plans/pos-2-6-0-E51/spec.md`, `docs/plans/pos-2-6-0-E51/plan.md`, `docs/plans/pos-2-6-0-E51/progress.json`, `4329c5e` | release/pos-2.6.0 (merge 4329c5e) entra em main na publicação (E54) |
| E52 | na-branch | `docs/plans/pos-2-6-0-E52/spec.md`, `97db7d7`, `docs/plans/pos-2-6-0-E52/plan.md`, `plan/pos-2-6-0-E52`, `docs/plans/pos-2-6-0-E52/progress.json`, `0d737f0838c8d85d0a6934fe77786d27eff36277`, `0b072ac1b7c3745226255bebdfd8951e93ba165e`, `9f62dff3289a66a6ad71812ee462395a89afd3fc`, `9062783` | release/pos-2.6.0 (merge 9062783) entra em main na publicação (E54) |
| E53 | spec | `docs/plans/pos-2-6-0-E53/spec.md`, `57ea4ca` | escrever o plano depois do merge do E49 (ou do descarte dele) |
| E54 | nao-iniciado | - | - |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) autorizar push e tag do E54
- (executor) registrar o shq do coordinator.js como pendente fora do escopo (DEC-015)
- (executor) registrar o uso do total do vitest no gateFromCapture como pendente fora do escopo (DEC-033; antes dele, DEC-031)
- (executor) teste 'discover --page prints each signed page' (preflight.test.mjs:1027) falhou 1 vez no G1 da revisão final do E42 e passou sozinho; investigar se repetir
- (executor) E43: numa retomada com o mesmo runToken, a releitura pode aceitar a linha de uma execução anterior com o mesmo nonce (revisão do plano); olhar no lote do E53
- (executor) fora do escopo: o summary() do test-extract usa a primeira linha de contagem, e stdout de teste pode inflar o total nos caminhos .js e agy (revisão do E52)
- (executor) E53: passar --model também ao run-baseline.mjs no roteiro do lote (revisão final do E51, achado m1)
- (executor) fora do escopo: close-from-state recusa plano com muitos commits (célula de evidência acima de 300 caracteres, visto no E51)
- (executor) E43: sem caso de teste para agente de releitura que devolve null (revisão final, achado F2)
- (executor) verify-run.test.mjs:648 (processos, neto do listener): a espera fixa de 500 ms após taskkill /T falhou 1x num gate sob carga. Trocar por espera até o processo sumir (prazo de cerca de 5 s), conferindo a data de criação do PID; o finally pode matar um PID reaproveitado.
- (executor) fora do escopo: no dev loop, o aviso de clone do preflight chama o arquivo do repositório de cópia do cache (revisão final do E45, achado F3; segue o ruling R6 da spec)
- (dono) E53, com o candidato fixado: autorizar o lote (até US$ 18) em DEC que cite o SHA e fazer o login da conta na config descartável; nunca enviar token pelo chat.
- (executor) fora do escopo (#13): no caminho agy o without_approve do .py não tira parallelOk, que pode voltar em resumeArgs (revisão final do E48, achado F1)
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
| release/pos-2.6.0 | viva | branch de release no worktree D:/projects/claude-play-wt/pos-2-6-0 (DEC-020) |
| plan/pos-2-6-0-E44 | viva | integrado em release/pos-2.6.0 (5fcf32a); branch e worktree pos-2-6-0-E44 ainda existem |
| plan/pos-2-6-0-E42 | viva | integrado em release/pos-2.6.0 (b31ba00); branch e worktree pos-2-6-0-E42 ainda existem |
| plan/pos-2-6-0-E50 | viva | integrado em release/pos-2.6.0 (857624a); branch e worktree pos-2-6-0-E50 ainda existem |
| plan/pos-2-6-0-E51 | viva | integrado em release/pos-2.6.0 (4329c5e); branch e worktree pos-2-6-0-E51 ainda existem |
| plan/pos-2-6-0-E43 | viva | integrado em release/pos-2.6.0 (18b8e18); branch e worktree pos-2-6-0-E43 ainda existem |
| plan/pos-2-6-0-E52 | viva | integrado em release/pos-2.6.0 (9062783); branch e worktree pos-2-6-0-E52 ainda existem |
| plan/pos-2-6-0-E45 | viva | integrado em release/pos-2.6.0 (8b559c8); branch e worktree pos-2-6-0-E45 ainda existem |
| plan/pos-2-6-0-E46 | viva | integrado em release/pos-2.6.0 (26cfb3c); branch e worktree pos-2-6-0-E46 ainda existem |
| plan/pos-2-6-0-E47 | viva | integrado em release/pos-2.6.0 (37294bd); branch e worktree pos-2-6-0-E47 ainda existem |
| plan/pos-2-6-0-E48 | viva | integrado em release/pos-2.6.0 (9b6f08a); branch e worktree pos-2-6-0-E48 ainda existem |
| plan/pos-2-6-0-E49 | viva | execução do plano do E49 no worktree D:/projects/claude-play-wt/pos-2-6-0-E49 |
<!-- /roadmap:inflight -->
