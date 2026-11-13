# E24: registro das revisões (execução falhou)

Resultado da execução: falha. A tarefa 4 ficou BLOCKED e nada dela foi commitado.

## Revisões por estágio

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores |
|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 1 (soma das rodadas) |
| spec | 2 | opus | opus | nenhum | |
| plan | 1 | opus | nenhum | nenhum | 2 |
| T1:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T1:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T2:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T2:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T3:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T3:quality | 1 | sonnet | nenhum | nenhum | 0 |

Itens não resolvidos: nenhum em todos os estágios.

Riscos aceitos: nenhum.

## Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Validação de finalReview no preflight | DONE_WITH_CONCERNS | 1 |
| 2 | Agentes da revisão final e espaço no teto | DONE | 1 |
| 3 | Onda única da correção final | DONE | 1 |
| 4 | Verificação adversarial | BLOCKED | 0 |

## Concerns

- T1: The plan's command is written as a relative path (node --test plugins/.../preflight.test.mjs). My first two runs used that relative form without a cd, and the Bash cwd did not resolve to the worktree, so they ran against the main checkout D:/projects/claude-play (read-only; nothing changed there). Those runs are not reported as checks. For the red and green checks I used the absolute worktree path, identical in both calls. The file and test are the same; only the path literal differs from the plan. The output is also truncated by the tool in the middle, marked [...].
- T2: (1) My first attempt to write the test edit used a heredoc script, against the rule for temporary files. It failed on an anchor mismatch before changing anything. I redid it with the Edit tool and deleted the temporary folder. A stray /tmp/edit-test.mjs from that attempt remains outside the allowed temporary area. (2) Measurements between edits ran through a small script in the temporary folder that does not import size.test.mjs. The reported limit check is the plan's exact command. (3) final-reviewer.md does not mention superpowers, so the AC4 check in T5 can assert there is no citation. (4) The test-integrity prompt is now `Program: ...` / `Command: ...` followed by TEST_INTEGRITY. The existing flow tests that check the exact node command in that prompt still pass.
- T3: 1) The limit check script was a temp file, now deleted; it printed workflowChars and exited 1 above 239600. 2) The default-branch assertion in review.test.mjs uses findings whose description changes per round, so runReviewLoop's repeat-finding escalation gives the extra round (fixes 1, 2, 3). 3) With once, a repeated finding still escalates the fixer tier, but the extra round is skipped (bonus = !opt.once). 4) The message after a single wave reads "after 1 fixes". The plan's reserve already allows dropping that number if T4 runs short on size.
- T4: Os testes escritos nesta rodada (3 casos em review.test.mjs e 4 em flow.test.mjs) foram descartados com o revert; um novo despacho precisa reescrevê-los. As variantes que cheguei a usar na implementação mais enxuta merecem decisão do dono:
  - `splitRefuted` com `find`, sem proteção contra dois veredictos contraditórios para o mesmo número, e a verificação sem `x &&` nem `Array.isArray`. A spec só exige que o veredicto "de mesmo número" tenha `refuted === true` e `reason` não vazio.
  - O prompt de verificação traz `Mode: verify "<worktree>".` e a lista numerada, sem a linha `Diff:`. `agents/final-reviewer.md` (fora da lista de T4) não descreve esse formato do modo `verify`.
  - `reason` é checado só por ser verdadeiro (`x.reason`); uma razão de espaços em branco passaria como refutação.
  - Nenhuma dessas variantes foi commitada.

## Gates

Nenhum gate foi executado: a execução falhou na tarefa 4 antes da etapa de gates.

## Entradas humanas

| O quê | BLQ | Workaround | Bloqueante |
|---|---|---|---|
| Corrigir o card E24 por revisão da estratégia para nomear também plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs entre os arquivos de teste (validação de finalReview). | não informado | O spec nomeia o arquivo e o teste roda no G1. | não |

## Falha

task 4 BLOCKED: T4 (verificação adversarial) não coube no limite de 239800 caracteres de roadmap-release.js, então nada foi commitado. O déficit medido é 150 caracteres, na implementação mais enxuta que respeita a spec. A árvore de trabalho está limpa (git status --porcelain vazio) e o HEAD continua em a636183 (E24 T3). Escrevi o teste primeiro nos dois arquivos e vi a falha. Depois implementei `S_VERIFY`, `splitRefuted` e o ramo `final-verify` no callback de `finalLoop`. `review.test.mjs` (66 testes) e `flow.test.mjs` (380 testes) passaram, mas o check de tamanho deu exit 1. Como o plano manda, voltei os três arquivos com `git checkout` e apaguei a pasta temporária.

Medidas de `workflowChars` (início de T4: 239022, folga de 778):
- Primeira versão, com comentário e proteção contra veredictos duplicados e contraditórios: 240286, cerca de 486 acima do limite.
- Versão compactada: 240134 e depois 240102.
- `splitRefuted` com `filter` e `find`, mais curta: 240062.
- Sem o comentário de `splitRefuted` e com `Mode: verify "${wt}".`: 239950, que é o déficit de 150 contra 239800.

Por que a estimativa da spec (~750-790) não bate: o código real custa cerca de 930. `S_VERIFY` com `required` só no topo custa cerca de 179. `splitRefuted` custa cerca de 300 sem comentário. O callback (`const r = {...}, bl = blocking(r)`, o `if`, a chamada com `...FRA`, o `out.reviews.push` e o filtro de `r.issues`) custa cerca de 450, já descontada a linha de retorno antiga de cerca de 90. A reserva da spec dá pouco: o `required` só no topo já está aplicado e a chave `'all'` já tem 3 caracteres. Tirar o número da mensagem da onda única rende cerca de 19 e, mesmo com isso, o déficit fica em cerca de 131.

Não encontrei folga no bloco da revisão final sem tirar regra ou encurtar outro estágio, o que as regras vedem. As saídas que fecham a conta exigem trocar a spec: numerar todos os achados em vez de só os bloqueantes, deixar `splitRefuted` devolver `keep` já filtrado, empurrar `final-verify` sem o guard de `refuted.length` e tirar o `required` do topo de `S_VERIFY`. Mesmo as quatro somadas chegam a 239805, cinco acima do limite.

Se o orquestrador re-despachar a tarefa, precisa de uma destas duas decisões: elevar o limite de T4 em pelo menos 150 (e manter 240000 como teto absoluto), ou liberar mais espaço no bloco da revisão final com um encurtamento aprovado pelo dono.

## Textos cortados no registro

### 1. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Num agente do plugin, productivity-tools:final-reviewer (agents/final-reviewer.md), com os modos review e verify, só leitura, NO_ASK literal no corpo; as chamadas da revisão final e da verificação o despacham por agentType, com o modelo e o esforço de hoje, por um objeto de opções FRA do bloco; o prompt guarda só os dados, e as lentes viram chaves curtas definidas no corpo.

### 2. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Medir workflowChars depois de cada edição; liberar espaço antes de somar código, só no bloco da revisão final (do agente de integridade dos testes ao fim de finalLoop, 2.776 caracteres), pelas fontes da tabela do Desenho: texto genérico da revisão para final-reviewer.md (cerca de -570), lentes por chave (-224), retorno do callback compacto (-52), instrução do agente de integridade para test-integrity.md (-210), a frase do prompt de correção que repete o modo de correção de implementer.md (-52), menos FRA (+63): cerca de -1.090 na primeira tarefa; onda única cerca de +135 e verificação cerca de +790 depois; reserva nomeada para a última; limites por tarefa 239.300 (primeira), 239.600 (meio), 239.800 (última); nenhuma correção acima de 240.000; tarefa fora do limite não faz commit e devolve BLOCKED com o déficit.

### 3. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

O orquestrador da sessão principal, no worktree de E24 antes do merge, com sessões claude -p e --plugin-dir que despacham final-reviewer pelo nome nos modos review e verify sobre fixture sintética marcada; relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.

### 4. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Para um agente próprio, productivity-tools:test-integrity (agents/test-integrity.md, tools Read, Write, Bash, NO_ASK literal); a chamada <E>:test-integrity o despacha por agentType com haiku e low, e o prompt guarda o caminho do programa, o comando exato e TEST_INTEGRITY; a medida, os campos e os alertas não mudam; resume-test-integrity, do estágio de merge, não muda.

### 5. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

flow.test.mjs entra no escopo; a asserção da linha 2189 vira três no mesmo teste: E1:final-1-r2 despacha agentType productivity-tools:final-reviewer, seu prompt traz Mode: review e os achados anteriores, e agents/final-reviewer.md traz no modo review a frase Blocks (defeito): an edit to the spec or the plan made by a fix round.

### 6. block-open --what

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --what de block-open.

E24 bloqueado: automatic execution stopped (conteudo): task 4 BLOCKED: T4 (verificação adversarial) não coube no limite de 239800 caracteres de roadmap-release.js, então nada foi commitado. O déficit medido é 150 caracteres, na implementação mais enxuta que respeita a spec. A árvore de trabalho está limpa (git status --porcelain vazio) e o HEAD continua em a636183 (E24 T3). Escrevi o teste primeiro nos dois arquivos e vi a falha. Depois implementei `S; branch feat/E24 kept at D:/projects/claude-play-wt/E24

## Registro do estágio blocked-record

Esta execução (estágio blocked-record) repete os dados acima sem alteração: nenhum item crítico ou importante em nenhuma revisão, menores somados conforme a tabela, nenhum item não resolvido, nenhum risco aceito, tarefas 1 a 3 concluídas e tarefa 4 BLOCKED. O corte 6 acima foi acrescentado nesta execução; os cortes 1 a 5 foram mantidos.

## Registro da execução com falha de integridade do plano

Esta execução falhou antes das tarefas: plan load: integrity digest not confirmed (the emit digest does not match the plan and source).

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores |
|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 2 |

Itens não resolvidos: nenhum.

Riscos aceitos: nenhum.

Concerns: nenhum.

Gates: nenhum gate foi executado, pois a execução falhou no carregamento do plano.

### Entradas humanas desta execução

| O quê | BLQ | Workaround | Bloqueante |
|---|---|---|---|
| Corrigir o card E24 por revisão da estratégia para nomear também plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs entre os arquivos de teste (validação de finalReview). | não informado | O spec nomeia o arquivo e o teste roda no G1. | não |

### Falha

plan load: integrity digest not confirmed (the emit digest does not match the plan and source)

## Registro da execução final (tarefas 1 a 6)

Os registros anteriores acima foram mantidos sem alteração. Nesta execução as tarefas 1 e 2 foram retomadas (já revisadas), a 3 e a 4 foram concluídas, a 5 terminou com concerns e a 6 devolveu NEEDS_HUMAN. Nenhuma falha de execução.

### Revisões por estágio

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores |
|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 1 |
| plan | 1 | opus | nenhum | nenhum | 0 |
| T3:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T3:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T4:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T4:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T5:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T5:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T6:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T6:quality | 1 | sonnet | nenhum | nenhum | 0 |
| final | 1 | opus | nenhum | nenhum | 1 |

Itens não resolvidos: nenhum em todos os estágios.

Riscos aceitos: nenhum.

### Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Validação de finalReview no preflight | RESUMED (already reviewed) | |
| 2 | Agentes da revisão final e espaço no teto | RESUMED (already reviewed) | |
| 3 | Onda única da correção final | DONE | 7 |
| 4 | Verificação adversarial | DONE | 1 |
| 5 | Teste dos prompts, README e gates | DONE_WITH_CONCERNS | 1 |
| 6 | Teste comportamental pelo orquestrador | NEEDS_HUMAN | 0 |

### Concerns

- the "executing" roadmap record failed (the integration worktree is not clean after the record (git status --porcelain is not empty): the record agent did not commit; reread status --json is missing or has no panel; reread brief --json is missing or is not JSON of the CLI; reread pending-decisions --json is missing or is not JSON of the CLI); decisions and the in-flight entry are not recorded yet
- T4: The WARN from G5 (plan-coordinator delegation-protocol links) is pre-existing and unrelated to T4. The 32-character margin left in the final review block is small for later fixes (239898 against 239930, with a hard ceiling of 240000). Two commands that were not among the plan's T4 checks gave only exploratory output: node --test on integrity.test.mjs (never run) and a measurement piped to head, run to see the size after each edit. Neither is reported as a check. The flow.test.mjs check was run as a plain call, but the tool truncated its output, so the full pass count comes from an earlier run redirected to a file.
- T5: 1) Trailer: the call prompt requires "Co-Authored-By: Claude <noreply@anthropic.com>" and the commit uses it; the Claude Code attribution reminder asks for a Haiku 5.5 trailer. I followed the call prompt. 2) The cwd for the gate commands is set with "env -C <worktree>", because the agent shell's cwd resets and the primary directory is the main checkout, which must not be used. The command strings are the literal ones run. 3) The tool printed no explicit exit code for the successful calls; the "exit 0" entries mean the call returned without error and the output shows no failures. 4) Pre-existing, outside this diff: G3 has an ICON_MISSING plugin-directory warning, and G5 has a WARN on plan-coordinator's delegation-protocol.md links. G4 is not in the plan's list for T5 and was not run. 5) The G1 total is 1709, not the baseline 1704, because the E24 branch adds the T1-T4 tests.

### Gates

Linha de base (alvo ab86d2559c3b6d17f09a1ca432d1051b64b0e084, chave 936533eb, árvore limpa): G1 rodou, exit 0, 1704 testes, 0 ignorados, nenhum falhou; G2, G3, G4 e G5 rodaram, exit 0. Na branch, o T5 reportou G1 com 1709 testes (os testes de T1 a T4 somam 5); G4 não rodou no T5.

### Entradas humanas desta execução

| O quê | BLQ | Workaround | Bloqueante |
|---|---|---|---|
| Corrigir o card E24 por revisão da estratégia para nomear também plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs entre os arquivos de teste (validação de finalReview). | não informado | O spec nomeia o arquivo e o teste roda no G1. | não |
| execução comportamental do orquestrador da sessão principal (DEC-204) | não informado | Nenhum relatório foi escrito. O orquestrador deve rodar sessões `claude -p --plugin-dir D:/projects/claude-play-wt/E24`, despachando productivity-tools:final-reviewer nos modos review e verify. A fixture sintética marcada SYNTHETIC FIXTURE fica em D:/projects/claude-play-wt/_tmp/E24-comportamental/ e tem um defeito plantado real e um achado falso. O relatório vai para docs/reports/2026-11-13-E24-revisao-final-comportamental.md. Commit: 'E24 T6: relatório comportamental'. Apagar a pasta temporária no fim. | não |

### Textos cortados no registro (execução final)

Entradas 1 a 6 acima foram mantidas. As entradas abaixo são desta execução.

#### 7. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Só o achado de índice k com exatamente um veredicto n === k + 1, refuted === true e reason com algum caractere não branco; sem veredicto, veredicto repetido, número que não confere, reason vazio ou só de espaços, ou chamada nula: segue para a correção. r.issues fica com os menores mais os mantidos. O refutado fica em out.reviews como { stage: 'final-verify', round, refuted }, sem guarda de tamanho, e vai ao log de revisões.

#### 8. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Num agente do plugin, productivity-tools:final-reviewer (agents/final-reviewer.md), com os modos review e verify, só leitura, NO_ASK literal no corpo; as chamadas da revisão final e da verificação o despacham por agentType, com o modelo e o esforço de hoje, por um objeto de opções FRA do bloco; o prompt guarda só os dados, e as lentes viram chaves curtas definidas no corpo.

#### 9. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Medir workflowChars depois de cada edição; liberar espaço antes de somar código, só no bloco da revisão final (do agente de integridade dos testes ao fim de finalLoop, 2.776 caracteres), pelas fontes da tabela do Desenho: texto genérico da revisão para final-reviewer.md (cerca de -570), lentes por chave (-224), retorno do callback compacto (-52), instrução do agente de integridade para test-integrity.md (-210), a frase do prompt de correção que repete o modo de correção de implementer.md (-52), menos FRA (+63): cerca de -1.090 na primeira tarefa; onda única cerca de +135 e verificação cerca de +790 depois; limites por tarefa 239.300 (primeira), 239.600 (meio), 239.930 (última, T4, partida em 239.022 depois de T1 a T3 em a636183, build de referência 239.904); na T4, S_VERIFY com required só no nível de cima e 34 caracteres liberados no bloco (const do caminho do programa de integridade, lentes inline no map); nenhuma correção acima de 240.000; tarefa fora do limite, mesmo com o recuo de R12, não faz commit e devolve BLOCKED com o déficit.

#### 10. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

O orquestrador da sessão principal, no worktree de E24 antes do merge, com sessões claude -p e --plugin-dir que despacham final-reviewer pelo nome nos modos review e verify sobre fixture sintética marcada; relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.

#### 11. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Para um agente próprio, productivity-tools:test-integrity (agents/test-integrity.md, tools Read, Write, Bash, NO_ASK literal); a chamada <E>:test-integrity o despacha por agentType com haiku e low, e o prompt guarda o caminho do programa, o comando exato e TEST_INTEGRITY; a medida, os campos e os alertas não mudam; resume-test-integrity, do estágio de merge, não muda.

#### 12. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

flow.test.mjs entra no escopo; a asserção da linha 2189 vira três no mesmo teste: E1:final-1-r2 despacha agentType productivity-tools:final-reviewer, seu prompt traz Mode: review e os achados anteriores, e agents/final-reviewer.md traz no modo review a frase Blocks (defeito): an edit to the spec or the plan made by a fix round.

## Registro da execução final (ressincronização)

Os registros anteriores acima foram mantidos sem alteração. Esta execução repete as revisões e tarefas da execução final e traz os gates medidos na branch. Nenhuma falha de execução.

### Revisões por estágio

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores |
|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 1 |
| plan | 1 | opus | nenhum | nenhum | 0 |
| T3:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T3:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T4:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T4:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T5:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T5:quality | 1 | sonnet | nenhum | nenhum | 0 |
| T6:spec | 1 | sonnet | nenhum | nenhum | 0 |
| T6:quality | 1 | sonnet | nenhum | nenhum | 0 |
| final | 1 | opus | nenhum | nenhum | 1 |

Itens não resolvidos: nenhum em todos os estágios.

Riscos aceitos: nenhum.

### Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Validação de finalReview no preflight | RESUMED (already reviewed) | |
| 2 | Agentes da revisão final e espaço no teto | RESUMED (already reviewed) | |
| 3 | Onda única da correção final | DONE | 7 |
| 4 | Verificação adversarial | DONE | 1 |
| 5 | Teste dos prompts, README e gates | DONE_WITH_CONCERNS | 1 |
| 6 | Teste comportamental pelo orquestrador | NEEDS_HUMAN | 0 |

### Concerns

- the "executing" roadmap record failed (the integration worktree is not clean after the record (git status --porcelain is not empty): the record agent did not commit; reread status --json is missing or has no panel; reread brief --json is missing or is not JSON of the CLI; reread pending-decisions --json is missing or is not JSON of the CLI); decisions and the in-flight entry are not recorded yet
- T4: The WARN from G5 (plan-coordinator delegation-protocol links) is pre-existing and unrelated to T4. The 32-character margin left in the final review block is small for later fixes (239898 against 239930, with a hard ceiling of 240000). Two commands that were not among the plan's T4 checks gave only exploratory output: node --test on integrity.test.mjs (never run) and a measurement piped to head, run to see the size after each edit. Neither is reported as a check. The flow.test.mjs check was run as a plain call, but the tool truncated its output, so the full pass count comes from an earlier run redirected to a file.
- T5: 1) Trailer: the call prompt requires "Co-Authored-By: Claude <noreply@anthropic.com>" and the commit uses it; the Claude Code attribution reminder asks for a Haiku 5.5 trailer. I followed the call prompt. 2) The cwd for the gate commands is set with "env -C <worktree>", because the agent shell's cwd resets and the primary directory is the main checkout, which must not be used. The command strings are the literal ones run. 3) The tool printed no explicit exit code for the successful calls; the "exit 0" entries mean the call returned without error and the output shows no failures. 4) Pre-existing, outside this diff: G3 has an ICON_MISSING plugin-directory warning, and G5 has a WARN on plan-coordinator's delegation-protocol.md links. G4 is not in the plan's list for T5 and was not run. 5) The G1 total is 1709, not the baseline 1704, because the E24 branch adds the T1-T4 tests.

### Gates

G1: exit 0, total 1714, skipped 0, failing [] (baseline: exit 0, total 1704, skipped 0, failing []) | G2: exit 0 (baseline: exit 0) | G3: exit 0 (baseline: exit 0) | G4: exit 0 (baseline: exit 0) | G5: exit 0 (baseline: exit 0)

### Entradas humanas desta execução

| O quê | BLQ | Workaround | Bloqueante |
|---|---|---|---|
| Corrigir o card E24 por revisão da estratégia para nomear também plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs entre os arquivos de teste (validação de finalReview). | não informado | O spec nomeia o arquivo e o teste roda no G1. | não |
| execução comportamental do orquestrador da sessão principal (DEC-204) | não informado | Nenhum relatório foi escrito. O orquestrador deve rodar sessões `claude -p --plugin-dir D:/projects/claude-play-wt/E24`, despachando productivity-tools:final-reviewer nos modos review e verify. A fixture sintética marcada SYNTHETIC FIXTURE fica em D:/projects/claude-play-wt/_tmp/E24-comportamental/ e tem um defeito plantado real e um achado falso. O relatório vai para docs/reports/2026-11-13-E24-revisao-final-comportamental.md. Commit: 'E24 T6: relatório comportamental'. Apagar a pasta temporária no fim. | não |

### Textos cortados no registro (ressincronização)

Entradas 1 a 12 acima foram mantidas. As entradas abaixo são desta execução.

#### 13. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Só o achado de índice k com exatamente um veredicto n === k + 1, refuted === true e reason com algum caractere não branco; sem veredicto, veredicto repetido, número que não confere, reason vazio ou só de espaços, ou chamada nula: segue para a correção. r.issues fica com os menores mais os mantidos. O refutado fica em out.reviews como { stage: 'final-verify', round, refuted }, sem guarda de tamanho, e vai ao log de revisões.

#### 14. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Num agente do plugin, productivity-tools:final-reviewer (agents/final-reviewer.md), com os modos review e verify, só leitura, NO_ASK literal no corpo; as chamadas da revisão final e da verificação o despacham por agentType, com o modelo e o esforço de hoje, por um objeto de opções FRA do bloco; o prompt guarda só os dados, e as lentes viram chaves curtas definidas no corpo.

#### 15. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Medir workflowChars depois de cada edição; liberar espaço antes de somar código, só no bloco da revisão final (do agente de integridade dos testes ao fim de finalLoop, 2.776 caracteres), pelas fontes da tabela do Desenho: texto genérico da revisão para final-reviewer.md (cerca de -570), lentes por chave (-224), retorno do callback compacto (-52), instrução do agente de integridade para test-integrity.md (-210), a frase do prompt de correção que repete o modo de correção de implementer.md (-52), menos FRA (+63): cerca de -1.090 na primeira tarefa; onda única cerca de +135 e verificação cerca de +790 depois; limites por tarefa 239.300 (primeira), 239.600 (meio), 239.930 (última, T4, partida em 239.022 depois de T1 a T3 em a636183, build de referência 239.904); na T4, S_VERIFY com required só no nível de cima e 34 caracteres liberados no bloco (const do caminho do programa de integridade, lentes inline no map); nenhuma correção acima de 240.000; tarefa fora do limite, mesmo com o recuo de R12, não faz commit e devolve BLOCKED com o déficit.

#### 16. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

O orquestrador da sessão principal, no worktree de E24 antes do merge, com sessões claude -p e --plugin-dir que despacham final-reviewer pelo nome nos modos review e verify sobre fixture sintética marcada; relatório em docs/reports/; no workflow a tarefa devolve NEEDS_HUMAN, sem relatório fictício.

#### 17. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

Para um agente próprio, productivity-tools:test-integrity (agents/test-integrity.md, tools Read, Write, Bash, NO_ASK literal); a chamada <E>:test-integrity o despacha por agentType com haiku e low, e o prompt guarda o caminho do programa, o comando exato e TEST_INTEGRITY; a medida, os campos e os alertas não mudam; resume-test-integrity, do estágio de merge, não muda.

#### 18. add-decision --decision

Origem: docs/plans/evolucao-skills-E24/reviews.md (campo source do corte). Destino: argumento --decision de add-decision.

flow.test.mjs entra no escopo; a asserção da linha 2189 vira três no mesmo teste: E1:final-1-r2 despacha agentType productivity-tools:final-reviewer, seu prompt traz Mode: review e os achados anteriores, e agents/final-reviewer.md traz no modo review a frase Blocks (defeito): an edit to the spec or the plan made by a fix round.
