Estratégia v1.0 -- 2026-11-15

<!-- roadmap:now -->
1. Dono: logar uma config descartável nova para as medições. Executa: dono.
2. E29: spec, plano e execução da remoção do modo single. Executa: executor.
3. E32: triagem do backlog. Executa: executor.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E29 | na-branch | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md`, `a563e48710c42e1b1adbed3815941d36835a584c` | E29: seguir o fluxo do release após na-branch |
| E30 | nao-iniciado | - | - |
| E31 | nao-iniciado | - | - |
| E32 | na-branch | `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md`, `92096976de66b3ab0f8af81c96b7da08b55f3e19` | E32: seguir o fluxo do release após na-branch |
| E33 | nao-iniciado | - | - |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) Logar uma config descartável nova para as medições de E30 e E31 (a anterior foi apagada na limpeza).
- (executor) Ler as transcrições de E30 e E31 antes de apagar qualquer config descartável.
- (dono) O dono confere o relatório de triagem docs/reports/2026-11-15-E32-triagem-backlog.md (critério 1).
- (dono) E32: critério AC1 sem evidência automática (human)
- (executor) Workflow do release: gate tests recusa total menor mesmo com remoção declarada; aceitar remoção revisada (nomes que somem na spec/plano) e parar o gates-fix na 1ª rodada quando a única falha é o total. Destino: roadmap futuro.
- (executor) Workflow do release: na retomada com notes, a carga do plano congelado sem --spec ainda lê a spec pelo campo spec do plano e falha (edge-case-uncovered) antes do autor rodar; contornado à mão no E29. Destino: roadmap futuro.
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
