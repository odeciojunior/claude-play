Estratégia v1.1 -- 2026-11-17

<!-- roadmap:now -->
1. E33: bump 2.3.0 (plugin.json e README) e nota em docs/releases, G1 a G5, merge na release (DEC-032). Executa: executor.
2. E33: sonda paga só até o plano, com o plugin da ponta da release, até US$ 3 da reserva; passa com commit feito e pending vazio na spec e no plano (DEC-033). Executa: executor.
3. E33: revisão final opus/high da release inteira contra main (DEC-032). Executa: executor.
4. E33: branch de volta 2.3.1 e roteiro de publicação (DEC-032, DEC-034). Executa: executor.
5. E33: autorização do dono para publicar: tag v2.2.0, main por fast-forward, push, update do plugin e segundo push só de docs (DEC-034). Executa: dono.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E29 | na-branch | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md`, `a563e48710c42e1b1adbed3815941d36835a584c` | Aguarda E33 (publicação) |
| E30 | na-branch | `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`, `33adadf2918f6cd02abae9cd432e9ac1ea21c815`, `docs/reports/2026-11-17-E30-revisor-opus.md` | Aguarda E33 (publicação); AC1 e AC2 aceitos; vira medido com a release em main |
| E31 | na-branch | `docs/plans/2026-11-17-measure-e31-parada-retomada-design.md`, `docs/plans/pos-2-2-0-E31/spec.md`, `docs/plans/pos-2-2-0-E31/plan.md`, `8fcc042b86100fe7680f422077c7b287fe276c1e` | Aguarda E33 (publicação); AC1 aceito |
| E32 | na-branch | `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md`, `92096976de66b3ab0f8af81c96b7da08b55f3e19` | Aguarda E33 (publicação); AC1 aceito |
| E33 | executando | - | Bump 2.3.0 e nota, sonda paga, revisão final, branch de volta e roteiro; depois autorização do dono |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (executor) Ler as transcrições de E30 e E31 antes de apagar qualquer config descartável.
- (executor) Workflow do release: gate tests recusa total menor mesmo com remoção declarada; aceitar remoção revisada (nomes que somem na spec/plano) e parar o gates-fix na 1ª rodada quando a única falha é o total. Destino: roadmap futuro.
- (executor) Workflow do release: na retomada com notes, a carga do plano congelado sem --spec ainda lê a spec pelo campo spec do plano e falha (edge-case-uncovered) antes do autor rodar; contornado à mão no E29. Destino: roadmap futuro.
- (executor) Roadmap futuro: as 22 notas com dono executor e a S3-13 (dono) da seção Pendências com dono de docs/reports/2026-11-15-E32-triagem-backlog.md entram como fonte do próximo roadmap.
- (executor) verify-run procs: o caminho Linux (ps, lsof, SIGTERM) só rodou com fakes; conferir num host Linux ou WSL real. Destino: roadmap futuro.
- (dono) E33: na primeira tag publicada, conferir a receita de fixar a loja numa tag (S3-01 de docs/reports/2026-11-15-E32-triagem-backlog.md).
- (executor) Roadmap futuro: spec para o revisor por tarefa opus (E30 R2 aprovou: 28 contra 20 capturas, custo 1,56x) e regra da R3 para 1 captura marginal por braço. Fonte: docs/reports/2026-11-17-E30-revisor-opus.md.
- (executor) Arnês (roadmap futuro): medições pagas exigem pré-voo e sentinela contra matança global de node.exe por outras sessões da máquina (x3 de E31 morreu por Stop-Process -Name node de outro projeto).
- (executor) Roadmap futuro: a carga de spec e plano por agente haiku errou a transcrição em 7 de 20 chamadas haiku no lote de E31 (exit code trocado ou emit que não é JSON); avaliar carga que não dependa de transcrição por modelo. Fonte: relatório de E31.
- (executor) Arnês (roadmap futuro): a regex de correção do extrator conta rótulos *-fix-review e *-fix-probe como correção; corrigir com teste em session-metrics.test.mjs. Não afetou o lote de E31.
- (executor) Roadmap futuro: S3-24 (task-reviewer.md: verdicts só no modo restrito, spec e quality só no modo review) entra na spec do revisor por tarefa opus e é medida com ela.
- (executor) Roadmap futuro: roadmap-release.js está em 244.453 de 250.000 caracteres (LF); a spec do revisor opus precisa caber ou abrir espaço antes.
- (dono) Autorizar a publicação da 2.3.0 quando o roteiro de E33 estiver pronto: tag v2.2.0, main por fast-forward, push, update do plugin e segundo push só de docs.
- (dono) Logout da config descartável D:\claude-pos22-cfg depois da 2.3.0 conferida no cache e do aviso do executor; só então a pasta é apagada.
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
