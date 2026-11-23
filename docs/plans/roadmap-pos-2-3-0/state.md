Estratégia v1.1 -- 2026-11-23

<!-- roadmap:now -->
1. Concluir E35 (AC2: logar a config descartável D:/claude-pos23-cfg e rodar o lote pago de confirmação de 10 execuções do braço opus em lentes-semeadas-A/B, teto US$ 7). Executa: dono + executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (publicado), E38 (publicado).
2. Iniciar E41 (Saída de script sem recópia por LLM): spec via spec-writer no tópico docs/plans/pos-2-3-0-E41/ com AC1 a AC7, depois plan-writer e plan-coordinator (DEC-030). Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (publicado).
3. Depois de E41: E36 e E37 em série. Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (publicado), E41.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E34 | publicado | `docs/plans/pos-2-3-0-E34/spec.md`, `docs/plans/pos-2-3-0-E34/plan.md`, `docs/plans/pos-2-3-0-E34/progress.json`, `3fd9ed62cbf1a93ed22c1f7fe18dc322da6c7eba`, `c40ca6dbc33ccbdb1ff62714f5fe06d75a3d67bc`, `e0ace0fc6348d33ac3a1daac493cb4e19534af62`, `3f36054` | - |
| E35 | executando | `docs/plans/pos-2-3-0-E35/spec.md`, `docs/plans/pos-2-3-0-E35/plan.md`, `docs/plans/pos-2-3-0-E35/progress.json`, `625e535781c0237cc3f75140c516c984ad6afa9e`, `78a3ad1876e32cd94807e2ae2ef30c6ea7fb20e9`, `fc1d9eef8553ed8c4601c42bbba2093bb6d4cbe0` | Logar config descartável (D:/claude-pos23-cfg) e rodar lote pago de confirmação (10x opus, teto US$ 7) |
| E36 | nao-iniciado | - | Aguarda E41 (DEC-030) |
| E37 | nao-iniciado | - | Aguarda E41 (DEC-030) |
| E38 | publicado | `docs/plans/pos-2-3-0-E38/spec.md`, `docs/plans/pos-2-3-0-E38/plan.md`, `docs/plans/pos-2-3-0-E38/progress.json`, `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`, `625fcab`, `7a2a470`, `e52c2d7`, `5c9d8ab`, `1b694f2`, `3f36054` | Conferência humana de AC2 em docs/reports/2026-11-21-E38-arnes-e-procs-linux.md; resto em E40 |
| E39 | nao-iniciado | - | - |
| E40 | nao-iniciado | - | - |
| E41 | nao-iniciado | - | Spec via spec-writer (docs/plans/pos-2-3-0-E41/) |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) Logar a config descartável quando o primeiro lote pago (E35) estiver pronto para rodar e fazer logout ao fim de E40 antes de apagar a pasta da config.
- (executor) Manter intocadas as pastas de transcrições pagas dos três lotes do pós-2.2.0 em D:/claude-e3x-out até o fechamento de E35 e E39; apagá-las em E40 (decisão 35 do pós-2.2.0; REQ-008).
- (dono) Conferir o relatório docs/reports/2026-11-21-E38-arnes-e-procs-linux.md para aceite humano de E38 AC2 (conferência Linux/WSL real de verify-run procs).
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
<!-- roadmap:releases -->
| Pacote | Entregáveis | Estado | SHA carimbado | Data | Ambiente |
|---|---|---|---|---|---|
| productivity-tools 2.4.0 (tag `productivity-tools--v2.4.0`) | E34 E35 E38 | publicado; E35 AC2 e E38 AC2 pendentes | `3f36054` | 2026-11-23 | marketplace claude-play (GitHub) |
<!-- /roadmap:releases -->
