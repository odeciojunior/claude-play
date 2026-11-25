Estratégia v1.2 -- 2026-11-24

<!-- roadmap:now -->
1. Fechar E35: lote pago AC2 rodado em 2026-11-24 (8 válidas, 26/32, piso da DEC-048 atingido, US$ 8,31); falta a conferência do dono no relatório docs/reports/2026-11-24-E35-confirmacao-revisor-opus.md. Executa: dono. Aprova: dono. Depende de: E34 (publicado), E38 (publicado).
2. E36 e E37 em série, agora que o E41 saiu na 2.5.0 (6abab96). Executa: executor. Aprova: dono via Fable (DEC-012). Depende de: E34 (publicado), E41 (publicado).
<!-- /roadmap:now -->
<!-- roadmap:panel -->
| Entregável | Status | Evidência | Próximo passo |
|---|---|---|---|
| E34 | publicado | `docs/plans/pos-2-3-0-E34/spec.md`, `docs/plans/pos-2-3-0-E34/plan.md`, `docs/plans/pos-2-3-0-E34/progress.json`, `3fd9ed62cbf1a93ed22c1f7fe18dc322da6c7eba`, `c40ca6dbc33ccbdb1ff62714f5fe06d75a3d67bc`, `e0ace0fc6348d33ac3a1daac493cb4e19534af62`, `3f36054` | - |
| E35 | executando | `docs/plans/pos-2-3-0-E35/spec.md`, `docs/plans/pos-2-3-0-E35/plan.md`, `docs/plans/pos-2-3-0-E35/progress.json`, `625e535781c0237cc3f75140c516c984ad6afa9e`, `78a3ad1876e32cd94807e2ae2ef30c6ea7fb20e9`, `fc1d9eef8553ed8c4601c42bbba2093bb6d4cbe0` | Dono confere AC2: docs/reports/2026-11-24-E35-confirmacao-revisor-opus.md e a linha de 2026-11-24 em measurements.md (8 válidas, 26/32, piso da DEC-048 atingido, US$ 8,31) |
| E36 | nao-iniciado | - | Aguarda E41 (DEC-030) |
| E37 | nao-iniciado | - | Aguarda E41 (DEC-030) |
| E38 | publicado | `docs/plans/pos-2-3-0-E38/spec.md`, `docs/plans/pos-2-3-0-E38/plan.md`, `docs/plans/pos-2-3-0-E38/progress.json`, `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md`, `625fcab`, `7a2a470`, `e52c2d7`, `5c9d8ab`, `1b694f2`, `3f36054` | Conferência humana de AC2 em docs/reports/2026-11-21-E38-arnes-e-procs-linux.md; resto em E40 |
| E39 | nao-iniciado | - | - |
| E40 | nao-iniciado | - | - |
| E41 | publicado | `docs/plans/pos-2-3-0-E41/spec.md`, `docs/plans/pos-2-3-0-E41/plano-b2/progress.json`, `2868ced`, `a9d544f`, `7636dd7`, `0090d3c`, `6abab96` | E36 e E37 em série |
<!-- /roadmap:panel -->
<!-- roadmap:blockers -->
| ID | Bloqueio | Afeta | Desde | Desbloqueia quando |
|---|---|---|---|---|
<!-- /roadmap:blockers -->
<!-- roadmap:pending -->
- (dono) Fazer logout da config descartável D:/claude-pos23-cfg ao fim de E40 antes de apagar a pasta (lote do E35 já rodado em 2026-11-24).
- (executor) Manter intocadas as pastas de transcrições pagas dos três lotes do pós-2.2.0 em D:/claude-e3x-out até o fechamento de E35 e E39; apagá-las em E40 (decisão 35 do pós-2.2.0; REQ-008).
- (dono) Conferir o relatório docs/reports/2026-11-21-E38-arnes-e-procs-linux.md para aceite humano de E38 AC2 (conferência Linux/WSL real de verify-run procs).
- (executor) Provas do E41 guardadas em D:/claude-pos23-out/e41-evidencias
<!-- /roadmap:pending -->
<!-- roadmap:inflight -->
| Branch | Tipo | Nota |
|---|---|---|
| release/pos-2.3.0 | viva | E41 publicado na 2.5.0 (6abab96); volta/productivity-tools-2.5.1 local (77fe379, suíte verde) |
<!-- /roadmap:inflight -->
<!-- roadmap:releases -->
| Pacote | Entregáveis | Estado | SHA carimbado | Data | Ambiente |
|---|---|---|---|---|---|
| productivity-tools 2.4.0 (tag `productivity-tools--v2.4.0`) | E34 E35 E38 | publicado; E35 AC2 e E38 AC2 pendentes | `3f36054` | 2026-11-23 | marketplace claude-play (GitHub) |
| productivity-tools 2.5.0 (tag `productivity-tools--v2.5.0`) | E41 | publicado; E41 AC3 com H1 conferida por subagent opus (delegação) | `6abab96` | 2026-11-24 | marketplace claude-play (GitHub) |
<!-- /roadmap:releases -->
