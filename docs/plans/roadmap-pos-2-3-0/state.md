Estratégia v1.0 -- 2026-11-21

<!-- roadmap:now -->
1. Criar a branch release/pos-2.3.0 a partir de main (0e363b0) e iniciar E34 (Espaço no workflow e diagnóstico de 512 KiB). Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: -.
2. Iniciar E38 (Arnês e limpeza de processos confiáveis), que não toca roadmap-release.js, desde que nenhum lote pago rode em paralelo. Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: -.
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E34 | executando | `docs/plans/pos-2-3-0-E34/spec.md`, `docs/plans/pos-2-3-0-E34/plan.md` | Executar tarefas T1 a T3 |
| E35 | nao-iniciado | - | - |
| E36 | nao-iniciado | - | - |
| E37 | nao-iniciado | - | - |
| E38 | nao-iniciado | - | - |
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
