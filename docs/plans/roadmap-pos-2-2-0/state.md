Estratégia v1.1 -- 2026-11-17

<!-- roadmap:now -->
1. E33: conferir na config descartável a receita de fixar a loja numa tag (S3-01), até US$ 1 da reserva. Executa: executor.
2. Dono: logout da config descartável D:\claude-pos22-cfg (DEC-035). Executa: dono.
3. Limpeza (config, loja fixa, worktree do lote, sandboxes, branches de desenho) e segundo push só de docs (DEC-034). Executa: executor.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E29 | publicado | `docs/plans/pos-2-2-0-E29/spec.md`, `docs/plans/pos-2-2-0-E29/plan.md`, `a563e48710c42e1b1adbed3815941d36835a584c`, `3d30412758bd646fba7778ef4f19e8a0efcc6943` | - |
| E30 | medido | `docs/plans/2026-11-17-measure-e30-revisor-opus-design.md`, `33adadf2918f6cd02abae9cd432e9ac1ea21c815`, `docs/reports/2026-11-17-E30-revisor-opus.md`, `3d30412758bd646fba7778ef4f19e8a0efcc6943` | - |
| E31 | medido | `docs/plans/2026-11-17-measure-e31-parada-retomada-design.md`, `docs/plans/pos-2-2-0-E31/spec.md`, `docs/plans/pos-2-2-0-E31/plan.md`, `8fcc042b86100fe7680f422077c7b287fe276c1e`, `3d30412758bd646fba7778ef4f19e8a0efcc6943`, `docs/reports/2026-11-17-E31-parada-retomada.md` | - |
| E32 | publicado | `docs/plans/pos-2-2-0-E32/spec.md`, `docs/plans/pos-2-2-0-E32/plan.md`, `92096976de66b3ab0f8af81c96b7da08b55f3e19`, `3d30412758bd646fba7778ef4f19e8a0efcc6943` | - |
| E33 | publicado | `3d30412758bd646fba7778ef4f19e8a0efcc6943`, `docs/reports/2026-11-17-E33-roteiro-publicacao.md` | Conferir S3-01; logout do dono; limpeza; segundo push só de docs |
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
- (dono) Logout da config descartável D:\claude-pos22-cfg depois da 2.3.0 conferida no cache e do aviso do executor; só então a pasta é apagada.
- (executor) Roadmap futuro: procs aceita como prova de ancestralidade um ppid reaproveitado pelo Windows (e /T amplia o efeito); listar CreationDate e cortar a cadeia quando o pai for mais novo que o filho, com teste de mock.
- (executor) Roadmap futuro: o reuso da spec compara o head do commit com o head medido depois do autor; se o spec-author commitar (viola R_NOCOMMIT), a revisão de uma spec alterada pode ser pulada. Decidir pelo blob contra o registro.
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
