Estratégia v1.0 -- 2026-11-21

<!-- roadmap:now -->
1. Iniciar E35 (Revisor por tarefa opus com modos alinhados). Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (na-branch).
2. Iniciar E36 (Gate de testes com remoção declarada) ou E37 (Cargas e commits conferidos contra a fonte) em série. Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (na-branch).
3. Iniciar E38 (Arnês e limpeza de processos confiáveis), que não toca roadmap-release.js, desde que nenhum lote pago rode em paralelo. Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: -.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E34 | na-branch | `docs/plans/pos-2-3-0-E34/spec.md`, `docs/plans/pos-2-3-0-E34/plan.md`, `docs/plans/pos-2-3-0-E34/progress.json`, `3fd9ed62cbf1a93ed22c1f7fe18dc322da6c7eba`, `c40ca6dbc33ccbdb1ff62714f5fe06d75a3d67bc`, `e0ace0fc6348d33ac3a1daac493cb4e19534af62` | - |
| E35 | executando | `docs/plans/pos-2-3-0-E35/spec.md`, `docs/plans/pos-2-3-0-E35/plan.md`, `docs/plans/pos-2-3-0-E35/progress.json`, `625e535781c0237cc3f75140c516c984ad6afa9e`, `78a3ad1876e32cd94807e2ae2ef30c6ea7fb20e9`, `fc1d9eef8553ed8c4601c42bbba2093bb6d4cbe0` | Logar config descartável (ou concluir E38) e rodar lote pago de confirmação (10x opus, teto US$ 7) |
| E36 | nao-iniciado | - | - |
| E37 | nao-iniciado | - | - |
| E38 | executando | `docs/plans/pos-2-3-0-E38/spec.md, docs/plans/pos-2-3-0-E38/plan.md` | Executar Tarefas 1 a 5 (AC1, B12/AC2 e G1-G5) |
| E39 | nao-iniciado | - | - |
| E40 | nao-iniciado | - | - |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) Logar a config descartável quando o primeiro lote pago (E35) estiver pronto para rodar e fazer logout ao fim de E40 antes de apagar a pasta da config.
- (executor) Manter intocadas as pastas de transcrições pagas dos três lotes do pós-2.2.0 em D:/claude-e3x-out até o fechamento de E35 e E39; apagá-las em E40 (decisão 35 do pós-2.2.0; REQ-008).
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
<!-- /roadmap:inflight -->
