# E10: registro de revisões

## Execução: etapa spec (falhou)

Resultado: a etapa spec terminou com questões em aberto após 2 correções. A entrega falhou nesta etapa.

### Rodadas

| Rodada | Modelo do revisor | Tier da correção anterior |
|---|---|---|
| 1 | opus | nenhuma (primeira revisão) |
| 2 | opus | opus |
| 3 | opus | opus |

### Questões críticas/importantes (bloqueantes)

#### I6 (importante, categoria: defeito)

Arquivo: docs/plans/evolucao-skills-E10/spec.md

[I6] R15 fixes the assertions listed in round 1 (lines 366, 526-528, 4132, 3129-3135, 3238-3241, 2268, readWith), and says no flow.test.mjs assertion about what leaves the workflow is removed without an equivalent. But its list, presented as complete ('cada uma tem o destino abaixo'), leaves out other flow.test.mjs assertions on the same removed pieces. (a) 'git truth requires lastGoodReachable' (line 274) mocks the git-truth label to get the 'validated tip' divergence. After the change that label is never called, so the mock is dead and the test fails, unless it is rewritten against the report's truthStdout. (b) 'I2: discovery returns the raw cell' (line 602) asserts calls[0].prompt matches /Status cell verbatim/, which is text from the discovery prompt being deleted. (c) 'I3: discovery requires the fields whose absence fails open' (lines 605-610) asserts that S_DISC.required includes repo and that the cards items require mergeFound and acceptance. S_DISC is deleted. (d) 'item 2: the discovery prompt restricts the ancestor rule' (lines 1057-1061) asserts /several pieces/ and /ONLY when the code segment is finished/ in the deleted prompt. (e) FF/I4 (line 2343) checks !schema.required.includes('wtRoot'), which passes trivially once the schema is S_RUN. (f) 'forma das chamadas de script' (lines 3250-3260) requires seen > 5 occurrences of roadmap.mjs in non-discovery prompts. Once the record and read prompts carry only an encoded verify-run.mjs payload, that count can drop and G1 fails. Built as written, these tests break G1 or get deleted or weakened without a recorded move, which the test-integrity measure flags. Fix: add each to R15 with its destination. (a) becomes a flow case that feeds a signed check output without lastGoodReachable through truthStdout. (b), (c) and (d) go to preflight.test.mjs as the raw cell, the required fields of data (with the stop in flow) and the onTarget code-segment rule. (e) becomes an assertion that data has no wtRoot. (f) counts roadmap.mjs inside the decoded group/read payloads, or the plan fixes an encoding that keeps the commands readable.

### Questões menores

0

### Itens não resolvidos

- I6 (importante, defeito), descrita acima, permaneceu aberta ao fim da rodada 3.

### Riscos aceitos

Nenhum.

### Concerns

Nenhum.

### Gates

Nenhum gate foi executado: a entrega parou na etapa spec.

### Entradas humanas (what, blq, workaround, blocking)

Nenhuma.

### Falha registrada

spec has open issues after 2 fixes:
1. [important/defeito] docs/plans/evolucao-skills-E10/spec.md [I6] [I6] R15 fixes the assertions listed in round 1 (lines 366, 526-528, 4132, 3129-3135, 3238-3241, 2268, readWith), and says no flow.test.mjs assertion about what leaves the workflow is removed without an equivalent. But its list, presented as complete ('cada uma tem o destino abaixo'), leaves out other flow.test.mjs assertions on the same removed pieces. (a) 'git truth requires lastGoodReachable' (line 274) mocks the git-truth label to get the 'validated tip' divergence. After the change that label is never called, so the mock is dead and the test fails, unless it is rewritten against the report's truthStdout. (b) 'I2: discovery returns the raw cell' (line 602) asserts calls[0].prompt matches /Status cell verbatim/, which is text from the discovery prompt being deleted. (c) 'I3: discovery requires the fields whose absence fails open' (lines 605-610) asserts that S_DISC.required includes repo and that the cards items require mergeFound and acceptance. S_DISC is deleted. (d) 'item 2: the discovery prompt restricts the ancestor rule' (lines 1057-1061) asserts /several pieces/ and /ONLY when the code segment is finished/ in the deleted prompt. (e) FF/I4 (line 2343) checks !schema.required.includes('wtRoot'), which passes trivially once the schema is S_RUN. (f) 'forma das chamadas de script' (lines 3250-3260) requires seen > 5 occurrences of roadmap.mjs in non-discovery prompts. Once the record and read prompts carry only an encoded verify-run.mjs payload, that count can drop and G1 fails. Built as written, these tests break G1 or get deleted or weakened without a recorded move, which the test-integrity measure flags. Fix: add each to R15 with its destination. (a) becomes a flow case that feeds a signed check output without lastGoodReachable through truthStdout. (b), (c) and (d) go to preflight.test.mjs as the raw cell, the required fields of data (with the stop in flow) and the onTarget code-segment rule. (e) becomes an assertion that data has no wtRoot. (f) counts roadmap.mjs inside the decoded group/read payloads, or the plan fixes an encoding that keeps the commands readable.

## Execução: registro de bloqueio (bloqueado)

Resultado: a execução automática parou na etapa spec (bloqueio de conteúdo). A branch feat/E10 foi mantida em D:/projects/claude-play-wt/E10. Os dados desta execução repetem os da execução anterior; nada do registro anterior foi removido.

### Rodadas (etapa spec)

| Rodada | Modelo do revisor | Tier da correção anterior |
|---|---|---|
| 1 | opus | nenhuma (primeira revisão) |
| 2 | opus | opus |
| 3 | opus | opus |

### Questões críticas/importantes (bloqueantes)

#### I6 (importante, categoria: defeito)

Arquivo: docs/plans/evolucao-skills-E10/spec.md

Texto transcrito integralmente no bloco "Questões críticas/importantes (bloqueantes)" da primeira execução, acima, sem alteração.

### Questões menores

0

### Itens não resolvidos

- I6 (importante, defeito), mesma descrição, aberta ao fim da rodada 3.

### Riscos aceitos

Nenhum.

### Concerns

Nenhum.

### Gates

Nenhum gate foi executado: a entrega parou na etapa spec.

### Entradas humanas (what, blq, workaround, blocking)

Nenhuma.

### Falha registrada

spec has open issues after 2 fixes (I6, importante/defeito); texto completo na seção "Falha registrada" da primeira execução, acima.

## Textos cortados no registro

Uma entrada por item de recordCuts. As entradas anteriores são mantidas (não havia nenhuma antes desta execução).

### Corte 1

- Origem: docs/plans/evolucao-skills-E10/reviews.md (source)
- Destino: argumento --what de block-open (where)
- Texto completo:

> E10 bloqueado: automatic execution stopped (conteudo): spec has open issues after 2 fixes: 1. [important/defeito] docs/plans/evolucao-skills-E10/spec.md [I6] [I6] R15 fixes the assertions listed in round 1 (lines 366, 526-528, 4132, 3129-3135, 3238-3241, 2268, readWith), and says no flow.test.mjs assertion about what leaves the workflow is removed without an equivalent. But its list, presented as complete ('cada uma tem o destino abaixo'), leaves out ; branch feat/E10 kept at D:/projects/claude-play-wt/E10
