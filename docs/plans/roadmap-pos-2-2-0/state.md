Estratégia v1.0 -- 2026-11-15

<!-- roadmap:now -->
1. E30: desenho da medição do revisor opus, com regra de decisão e orçamento fixados antes do lote, sem gasto. Executa: executor.
2. E31: desenho da medição de parada-retomada com transcrição preservada, sem gasto. Executa: executor.
3. Lotes pagos de E30 e E31 na config descartável D:\claude-pos22-cfg (login feito em 2026-11-17). Executa: executor.
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
- (executor) E30: no desenho, ler as notas com dono E30 do relatório docs/reports/2026-11-15-E32-triagem-backlog.md (S2-10, S2-15, S2-16, S2-17, S3-02, S3-03, S3-06, S3-07, S3-09, S3-10) e dizer quais entram antes do lote.
- (executor) S3-24 (task-reviewer.md: verdicts só no modo restrito, spec e quality só no modo review) não entrou em E29. Corrigir com teste só depois do lote de E30: a linha toca os modos spec e quality, que o lote mede. Destino: branch de E30 ou fix antes de E33.
- (executor) Roadmap futuro: as 22 notas com dono executor e a S3-13 (dono) da seção Pendências com dono de docs/reports/2026-11-15-E32-triagem-backlog.md entram como fonte do próximo roadmap.
- (executor) verify-run procs: o caminho Linux (ps, lsof, SIGTERM) só rodou com fakes; conferir num host Linux ou WSL real. Destino: roadmap futuro.
- (dono) E33: na primeira tag publicada, conferir a receita de fixar a loja numa tag (S3-01 de docs/reports/2026-11-15-E32-triagem-backlog.md).
- (executor) Estratégia v1.1 (fim da fase): trocar a premissa de custo de parada-retomada de US$ 2,26 para cerca de 4,39 por execução (2,26 era só a sessão de retomada).
- (executor) Roadmap futuro: spec para o revisor por tarefa opus (E30 R2 aprovou: 28 contra 20 capturas, custo 1,56x) e regra da R3 para 1 captura marginal por braço. Fonte: docs/reports/2026-11-17-E30-revisor-opus.md.
- (executor) Arnês (roadmap futuro): medições pagas exigem pré-voo e sentinela contra matança global de node.exe por outras sessões da máquina (x3 de E31 morreu por Stop-Process -Name node de outro projeto).
- (executor) Roadmap futuro: a carga de spec e plano por agente haiku errou a transcrição em 7 de 21 chamadas no lote de E31 (exit code trocado ou emit que não é JSON); avaliar carga que não dependa de transcrição por modelo. Fonte: relatório de E31.
- (executor) Arnês (roadmap futuro): a regex de correção do extrator conta rótulos *-fix-review e *-fix-probe como correção; corrigir com teste em session-metrics.test.mjs. Não afetou o lote de E31.
- (dono) O dono confere o relatório docs/reports/2026-11-17-E31-parada-retomada.md (critério 1).
- (dono) E31: critério AC1 sem evidência automática (human)
- (executor) Roadmap futuro: S3-24 (task-reviewer.md: verdicts só no modo restrito, spec e quality só no modo review) entra na spec do revisor por tarefa opus e é medida com ela.
- (executor) Roadmap futuro: roadmap-release.js está em 244.453 de 250.000 caracteres (LF); a spec do revisor opus precisa caber ou abrir espaço antes.
- (dono) Autorizar a publicação da 2.3.0 quando o roteiro de E33 estiver pronto: tag v2.2.0, main por fast-forward, push, update do plugin e segundo push só de docs.
- (dono) Logout da config descartável D:\claude-pos22-cfg depois da 2.3.0 conferida no cache e do aviso do executor; só então a pasta é apagada.
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
