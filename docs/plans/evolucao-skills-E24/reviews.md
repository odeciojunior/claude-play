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
