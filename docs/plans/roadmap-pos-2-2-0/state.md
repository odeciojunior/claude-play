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
| E30 | spec | `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md` | Sondas sonnet A e opus A, depois o lote (teto US$ 16) |
| E31 | spec | `docs/plans/2026-11-17-measure-e31-parada-retomada-design.md` | Lote depois de E30 (US$ 15 firmes) |
| E32 | na-branch | `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md`, `92096976de66b3ab0f8af81c96b7da08b55f3e19` | Aguarda E33 (publicação); AC1 aceito |
| E33 | nao-iniciado | - | - |
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
- (executor) E31: no desenho, ler a S3-08 e a parte de parada-retomada da S2-17 no relatório docs/reports/2026-11-15-E32-triagem-backlog.md.
- (executor) S3-24 (task-reviewer.md: verdicts só no modo restrito, spec e quality só no modo review) não entrou em E29. Corrigir com teste só depois do lote de E30: a linha toca os modos spec e quality, que o lote mede. Destino: branch de E30 ou fix antes de E33.
- (executor) Roadmap futuro: as 22 notas com dono executor e a S3-13 (dono) da seção Pendências com dono de docs/reports/2026-11-15-E32-triagem-backlog.md entram como fonte do próximo roadmap.
- (executor) verify-run procs: o caminho Linux (ps, lsof, SIGTERM) só rodou com fakes; conferir num host Linux ou WSL real. Destino: roadmap futuro.
- (dono) E33: na primeira tag publicada, conferir a receita de fixar a loja numa tag (S3-01 de docs/reports/2026-11-15-E32-triagem-backlog.md).
- (executor) Estratégia v1.1 (fim da fase): trocar a premissa de custo de parada-retomada de US$ 2,26 para cerca de 4,39 por execução (2,26 era só a sessão de retomada).
- (executor) Roadmap futuro: spec para o revisor por tarefa opus (E30 R2 aprovou: 28 contra 20 capturas, custo 1,56x) e regra da R3 para 1 captura marginal por braço. Fonte: docs/reports/2026-11-17-E30-revisor-opus.md.
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
