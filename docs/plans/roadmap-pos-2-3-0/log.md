# Log

<!-- roadmap:log -->
| Data | Entregável | O que aconteceu | Evidência |
|---|---|---|---|
| 2026-11-25 | E40 | Preparação da 2.6.0: bump, nota, volta 2.6.1, G1 a G5 verdes nas duas branches, revisão final opus/high aprovada com ressalvas e roteiro de publicação | `docs/reports/2026-11-25-E40-roteiro-publicacao.md` |
| 2026-11-25 | E39 | AC1 e AC2 aceitos com ressalva pelo Fable por delegação do dono: amostra de 2 válidas e limites provisórios; custo corrigido para US$ 14,65 pela regra do arnês, SHA256SUMS conferidos 167 e 174 de 174 | `docs/reports/2026-11-25-E39-linha-de-base-parada-retomada.md` |
| 2026-11-25 | E39 | Lote fechado com 2 válidas integradas, relatório e DEC-060 com limites provisórios | `docs/reports/2026-11-25-E39-linha-de-base-parada-retomada.md` |
| 2026-11-25 | E39 | Segunda correção da DEC-056 commitada, revisão opus aprovada. O digest das linhas do capture é checksum de cópia, sem segredo, mesmo nível de confiança do caminho anterior. HMAC fica como melhoria futura | `e536d5d` |
| 2026-11-25 | E39 | Execução 1 fora da linha de base pela DEC-054. O rodou duas vezes da sonda do E37 é artefato de registro, tool_use duplicado com o mesmo id, e a reprovação vale pelos 12 Grep e rótulos de repetição | `e199792` |
| 2026-11-25 | E37 | Plano concluído; sonda AC2 reprovada (DEC-052); correções 9a16231 e 5b7b059; E37 na branch | `5b7b059` |
| 2026-11-25 | E37 | E37 spec (R1-R16; decisões e aprovação pelo Fable delegado, 5 correções aplicadas) e plano de 11 tarefas (T11 sonda paga externa) | `docs/plans/pos-2-3-0-E37/plan.md` |
| 2026-11-25 | E36 | E36 na-branch: 8 tarefas (plan-coordinator) + revisão final opus/high (4 menores; 3 corrigidas em 1a1df35, 1 aceita: desconto de teste fora do glob do gate, mitigado pela R13); suíte 2570/0/2 em 1a1df35 | `1a1df35` |
| 2026-11-25 | - | estratégia v1.4: absorve DEC-049 a DEC-051 (orçamentos de tamanho do E36 e E37, teto da sonda do E37 em US$ 3,60, correções do cartão E37), decidida pelo Fable delegado | `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-24 | E36 | DEC-049: trava de tamanho do E41 em discovery-slices.test.mjs passa ao orçamento do E36 (263.673 LF), decidido pelo Fable após o gate da onda 1 falhar só nela | `decisions.md` |
| 2026-11-24 | E36 | E36 spec (R1-R16; decisões e aprovação pelo Fable, delegado pelo dono, com 5 correções aplicadas) e plano de 8 tarefas escritos | `docs/plans/pos-2-3-0-E36/plan.md` |
| 2026-11-24 | E38 | E38 AC2 conferido pelo Fable (APROVADO COM RESSALVAS: execução WSL2 real, digest recalculado bate, procs Linux intacto até a 2.5.0) e ratificado pelo dono; versão e payload inferidos anotados no relatório | `docs/reports/2026-11-21-E38-arnes-e-procs-linux.md` |
| 2026-11-24 | - | estratégia v1.3: absorve DEC-044 a DEC-048 | `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-24 | E35 | E35 AC2 ratificado pelo dono; E35 medido (lote de confirmação: 8 válidas, 26/32, US$ 8,31) | `docs/reports/2026-11-24-E35-confirmacao-revisor-opus.md` |
| 2026-11-24 | E35 | E35 AC2 conferido (Fable, delegado pelo dono; ratificação pendente): APROVADO COM RESSALVAS; recontagem dos 8 agregados bate (26/32, spec 16/16, quality 10/16, 4 perdidos, US$ 8,313), SHA256SUMS 158 OK, piso da DEC-048 commitado 12 s antes da A-3; amostra reduzida, não a DEC-004 | `docs/reports/2026-11-24-E35-confirmacao-revisor-opus.md` |
| 2026-11-24 | E35 | lote pago AC2: 8 válidas, 26/32 capturas, piso da DEC-048 atingido, US$ 8,31; conferência do dono pendente | `docs/reports/2026-11-24-E35-confirmacao-revisor-opus.md` |
| 2026-11-24 | - | estratégia v1.2: absorve DEC-042 e DEC-043 | `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-24 | E41 | DEC-043: dono aborta qualquer avaliação do context-mode | `decisions.md` |
| 2026-11-24 | E41 | pacote productivity-tools 2.5.0 publicado no marketplace claude-play (tag productivity-tools--v2.5.0; volta/productivity-tools-2.5.1 local) | `6abab96` |
| 2026-11-24 | E41 | E41 integrada(s) em main via release/pos-2.3.0 | `0090d3c` |
| 2026-11-24 | E41 | Correções pré-2.5.0 fechadas (taskId único, prune de review/ com cortes, list, id-invalid do topo, spec-writer); DEC-040, DEC-041; suíte 2531 pass, 0 fail; T3 aprova a 2.5.0 | `35a0db1..5d1b6cc`, `decisions.md` |
| 2026-11-24 | E41 | DEC-035 a DEC-038 (E41) conferidas: 035 a 037 do executor pendentes de ratificação do dono, 038 vigente; xor-base64 funcionou no relançamento real (10 fatias, 1 tentativa cada, sonda 6/6) | `decisions.md` |
| 2026-11-24 | E41 | H1 da sonda AC2b conferida (subagent opus, delegação do dono): confere com ressalvas; soma 0,392104 e summarize idênticos; retry único na 1-on, fatia 7; context-mode presente só nas on; teto 0,13 não gravado no JSON (custos ≤ 0,042) | `measurements.md` |
| 2026-11-24 | E41 | portão T3 da branch aprovado na 3ª rodada (correções 08ca89b, 45fd130, 5610c42, 918f77c; DEC-039); suíte 2499 testes, 0 fail | `918f77c` |
| 2026-11-24 | E41 | E41 critérios comparados: nenhum mudou (8 critérios iguais ao cartão) | `docs/plans/pos-2-3-0-E41/spec.md` |
| 2026-11-24 | E41 | E41 plano B2 concluído (T11 stopped, substituída pela T12 que passou; portão final na 4ª rodada com 5aaed01, 0e4dfe2, 207aacd, a9d544f); planos A, B1, B2 e B3 na branch, E41 na-branch; provas copiadas para D:/claude-pos23-out/e41-evidencias após o prune | `docs/plans/pos-2-3-0-E41/plano-b2/progress.json, 2868ced` |
| 2026-11-24 | E41 | medição paga AC2b registrada: US$ 0,3921 em 6 execuções (inclui US$ 0,170395 da 1-on abortada, DEC-038); parada authorize 6/6; H1 pendente do dono | `measurements.md` |
| 2026-11-23 | E41 | DEC-034 (folga de size.test.mjs > 10000) decidida pelo dono via Fable | `decisions.md` |
| 2026-11-23 | E41 | cartão E41 cita DEC-033 (ratificada); pendência de ratificação removida | `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-23 | E41 | DEC-033 ratificada pelo dono | `decisions.md` |
| 2026-11-23 | E41 | DEC-033 registrada (ratificação pendente) | `decisions.md` |
| 2026-11-23 | E41 | cartão E41: marcas verify dos critérios de teste alinhadas aos arquivos da spec (DEC-032) | `docs/plans/2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-23 | E41 | DEC-032 ratificada pelo dono via Fable (questão aberta da v1.1 respondida pela spec do E41) | `decisions.md` |
| 2026-11-23 | - | pendência de aprovação da estratégia v1.1 resolvida pela revisão; item de now de E36/E37 substituído pelos itens de E41 e de E36/E37 depois de E41 | `state.md` |
| 2026-11-23 | - | strategy v1.1: absorve DEC-024, DEC-025, DEC-026, DEC-027, DEC-028, DEC-029, DEC-030 (E41 novo; E37 sem B07; E36, E37, E39 e E40 dependem de E41; E40 publica 2.5.0) | `../2026-11-21-roadmap-pos-2-3-0.md` |
| 2026-11-23 | - | REQ-011 adicionado: saída de script sem recópia lossy por LLM (respostas copiadas até 3.500 bytes, exit code vindo de script), coberto por E41; REQ-004 sem B07, REQ-008 com alvo 2.5.0 | `requirements.md` |
| 2026-11-23 | - | SRC-08 adicionada: relatório de saída de script sem recópia por LLM; conflito com SRC-01 (B07) resolvido por DEC-024 e DEC-030 | `docs/reports/2026-11-23-saida-de-script-sem-recopia.md` |
| 2026-11-23 | E41 | DEC-024 a DEC-030 registradas (dono via Fable, DEC-012): conteúdo grande por tipo, escopo, provas, context-mode, versão 2.5.0, até US$ 1 da reserva (DEC-002) para a sonda AC2b e encaixe do E41 | `decisions.md` |
| 2026-11-23 | E40 | achado que afeta a estratégia: 2.4.0 publicada antes de E40; revisão v1.1 pendente de aprovação do dono | `state.md` |
| 2026-11-23 | E34,E35,E38 | pacote productivity-tools 2.4.0 publicado no marketplace claude-play (tag productivity-tools--v2.4.0; leva o código de E35, cuja AC2 segue pendente; volta volta/productivity-tools-2.4.1 em 6f2eaf7) | `3f36054` |
| 2026-11-23 | E34, E38 | E34, E38 integrada(s) em main via release/pos-2.3.0 | `3f36054` |
| 2026-11-21 | E38 | E38 critérios comparados: nenhum mudou; item de now podado e pendência de conferência humana de AC2 registrada em state.md | `docs/plans/pos-2-3-0-E38/spec.md, state.md` |
| 2026-11-21 | E38 | E38 fechada na-branch: T1-T5 concluidas (AC1 298/298, WSL2 Linux procs real B12, G1-G5 verdes); aguarda conferencia humana de AC2 | `docs/plans/pos-2-3-0-E38/progress.json, docs/reports/2026-11-21-E38-arnes-e-procs-linux.md, 625fcab, 7a2a470, e52c2d7, 5c9d8ab, 1b694f2` |
| 2026-11-21 | E38 | DEC-020 a DEC-023 (E38) ratificadas pelo dono via Fable (DEC-012) | `decisions.md` |
| 2026-11-21 | E35 | DEC-016 a DEC-019 (E35) ratificadas pelo dono via Fable (DEC-012) | `decisions.md` |
| 2026-11-21 | E35 | E35 T1 a T3 concluídas na branch (revisor opus, S3-24 e desenho do lote; G1 a G5 verdes); aguarda lote pago (AC2) | `docs/plans/pos-2-3-0-E35/progress.json`, `625e535781c0237cc3f75140c516c984ad6afa9e`, `78a3ad1876e32cd94807e2ae2ef30c6ea7fb20e9`, `fc1d9eef8553ed8c4601c42bbba2093bb6d4cbe0` |
| 2026-11-21 | E35 | E35 passou para executando | `docs/plans/pos-2-3-0-E35/spec.md, docs/plans/pos-2-3-0-E35/plan.md` |
| 2026-11-21 | E34 | DEC-013 a DEC-015 (E34) ratificadas pelo dono via Fable (DEC-012) | `decisions.md` |
| 2026-11-21 | E34 | E34 fechada pelo estado do coordinator: plano concluído e portão final aprovado | `docs/plans/pos-2-3-0-E34/progress.json`, `3fd9ed62cbf1a93ed22c1f7fe18dc322da6c7eba`, `c40ca6dbc33ccbdb1ff62714f5fe06d75a3d67bc`, `e0ace0fc6348d33ac3a1daac493cb4e19534af62` |
| 2026-11-21 | E34 | E34 passou para executando | `docs/plans/pos-2-3-0-E34/spec.md, docs/plans/pos-2-3-0-E34/plan.md` |
| 2026-11-21 | - | Roadmap criado | `../2026-11-21-roadmap-pos-2-3-0.md` |
<!-- /roadmap:log -->
