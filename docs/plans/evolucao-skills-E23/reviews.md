# E23: log de revisões

Execução: falhou (task 3).

## Revisões por estágio ou tarefa

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores | Não resolvidos |
|---|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 0 | nenhum |
| spec | 2 | opus | opus | nenhum | 0 | nenhum |
| plan | 1 | opus | nenhum | nenhum | 1 | nenhum |
| T1:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T1:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T2:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T2:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |

Riscos aceitos: nenhum.

## Tarefas

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Script do registro da execução com teste | DONE | 1 |
| 2 | Regra de permissão do script e config.md | DONE | 1 |

## Falha

task 3: test-first without a failing check then the same check passing (4 checks). A rerun takes the task as done and skips this check: first drop its commits, keeping the review log: git -C "D:/projects/claude-play-wt/E23" rebase --onto c99639b8b331eb0f38ddd8824103285da0941f6a <last task commit> feat/E23

## Concerns

- T1: The test file does not exercise the 'key' output for an invalid run.json (schema other than run/1). The script handles that case by treating it as no record.
- T3: The margin under the cap is only 19 characters. T4, T5 and T6 must each free space in their own stage text before adding code, as the plan says. Two choices were mine because the plan left them open. recordCmd takes (rr, wt, dir, E, stages, tip, payload), where rr is the full path of run-record.mjs. recordedBaseline takes (prep, head, key, defs) and passes the head to validMeasure as the expected sha. I also updated the existing 'artifactPaths follows DEC-026' test in flow.test.mjs to expect the new `run` field. The failing run before implementing was filtered through grep, so its exit code was grep's, not the test's.

## Gates

Nenhum registrado nesta execução.

## Entradas humanas

- O quê: Corrigir o card E23 por revisão da estratégia para nomear o teste do script, plugins/productivity-tools/scripts/run-record.test.mjs (risco 4 do card).
  - Bloqueante (blq): não
  - Workaround: O spec nomeia o arquivo e o teste roda no G1.

## Textos cortados no registro

### 1. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Em docs/plans/<slug>-<E>/run.json na branch do entregável, gravado e commitado só por plugins/productivity-tools/scripts/run-record.mjs (subcomandos approve, key e baseline, git por execFileSync sem shell), com teste em run-record.test.mjs. approve funde com o run.json de HEAD: troca só os estágios recebidos e só troca prep quando a carga o traz.

### 2. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Sem chamada nova: spec e plano como primeiro comando do agente de leitura de progresso, só quando uma das duas revisões rodou; final como primeiro comando do agente do log de revisões em persistReviews(''), só quando a revisão final rodou. Em plan-only, que retorna antes do agente de progresso, spec e plano vão no primeiro comando de persistReviews('plan'), chamado só quando uma das duas revisões rodou (junto com o caso de textos cortados). approve funde com HEAD:<dir>run.json e mantém os estágios que não grava. Falha na gravação só faz a retomada revisar.

### 3. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Em prep { targetHead, gatesKey, baseline } de cada run.json, gravado junto de cada aprovação; no modo run o preflight roda run-record.mjs baseline sobre as branches dos entregáveis selecionados e, se houver saída, não mede; o workflow aceita só com targetHead igual, gatesKey igual a fnv1a(canon(GATES)) e validMeasure, senão mede como hoje.

### 4. block-open --what

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: block-open --what
- Texto completo: E23 bloqueado: automatic execution stopped (conteudo): task 3: test-first without a failing check then the same check passing (4 checks). A rerun takes the task as done and skips this check: first drop its commits, keeping the review log: git -C "D:/projects/claude-play-wt/E23" rebase --onto c99639b8b331eb0f38ddd8824103285da0941f6a <last task commit> feat/E23; branch feat/E23 kept at D:/projects/claude-play-wt/E23

Nota: os itens 1 a 3 desta execução (registro bloqueado) têm texto idêntico aos já gravados acima por execução anterior; foram mantidos sem duplicar.

## Execução registrada em blocked-record

Execução: bloqueada (task 3), registrada em blocked-record. Dados desta execução, transcritos sem resumir.

### Revisões por estágio ou tarefa (esta execução)

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores | Não resolvidos |
|---|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 0 | nenhum |
| spec | 2 | opus | opus | nenhum | 0 | nenhum |
| plan | 1 | opus | nenhum | nenhum | 1 | nenhum |
| T1:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T1:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T2:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T2:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |

Riscos aceitos: nenhum.

### Tarefas (esta execução)

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Script do registro da execução com teste | DONE | 1 |
| 2 | Regra de permissão do script e config.md | DONE | 1 |

### Falha (esta execução)

task 3: test-first without a failing check then the same check passing (4 checks). A rerun takes the task as done and skips this check: first drop its commits, keeping the review log: git -C "D:/projects/claude-play-wt/E23" rebase --onto c99639b8b331eb0f38ddd8824103285da0941f6a <last task commit> feat/E23

### Concerns (esta execução)

- T1: The test file does not exercise the 'key' output for an invalid run.json (schema other than run/1). The script handles that case by treating it as no record.
- T3: The margin under the cap is only 19 characters. T4, T5 and T6 must each free space in their own stage text before adding code, as the plan says. Two choices were mine because the plan left them open. recordCmd takes (rr, wt, dir, E, stages, tip, payload), where rr is the full path of run-record.mjs. recordedBaseline takes (prep, head, key, defs) and passes the head to validMeasure as the expected sha. I also updated the existing 'artifactPaths follows DEC-026' test in flow.test.mjs to expect the new `run` field. The failing run before implementing was filtered through grep, so its exit code was grep's, not the test's.

### Gates (esta execução)

Nenhum registrado nesta execução.

### Entradas humanas (esta execução)

- O quê: Corrigir o card E23 por revisão da estratégia para nomear o teste do script, plugins/productivity-tools/scripts/run-record.test.mjs (risco 4 do card).
  - Bloqueante (blq): não
  - Workaround: O spec nomeia o arquivo e o teste roda no G1.

## Execução concluída com tarefa pendente de humano (esta execução)

Execução: tarefas 1 a 7 concluídas ou retomadas; tarefa 8 em NEEDS_HUMAN. Dados desta execução, transcritos sem resumir.

### Revisões por estágio ou tarefa (esta execução)

| Estágio | Rodada | Modelo do revisor | Tier da correção anterior | Críticos/importantes | Menores | Não resolvidos |
|---|---|---|---|---|---|---|
| spec | 1 | opus | nenhum | nenhum | 0 | nenhum |
| plan | 1 | opus | nenhum | nenhum | 1 | nenhum |
| T7:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T7:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T8:spec | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| T8:quality | 1 | sonnet | nenhum | nenhum | 0 | nenhum |
| final | 1 | opus | nenhum | nenhum | 1 | nenhum |
| final | 2 | opus | sonnet | nenhum | 1 | nenhum |
| final | 3 | opus | sonnet | nenhum | 1 | nenhum |

Observação: o estágio final registra 1 menor no total (dado agregado do estágio, não por rodada).

Riscos aceitos: nenhum.

### Tarefas (esta execução)

| N | Título | Status | Commits |
|---|---|---|---|
| 1 | Script do registro da execução com teste | RESUMED (already reviewed) | - |
| 2 | Regra de permissão do script e config.md | RESUMED (already reviewed) | - |
| 3 | Liberar espaço e funções puras do registro | RESUMED (already reviewed) | - |
| 4 | Setup lê o registro; pulo de spec e plano; aprovação em progress e plan-only | RESUMED (already reviewed) | - |
| 5 | Sincronização devolve o registro; pulo da revisão final | RESUMED (already reviewed) | - |
| 6 | Preflight reaproveita a medição registrada | RESUMED (already reviewed) | - |
| 7 | operator.md e gates | DONE | 16 |
| 8 | Teste comportamental pelo orquestrador | NEEDS_HUMAN | 0 |

### Concerns (esta execução)

- final fix1: The failing and passing flow.test.mjs runs both executed the whole file, because --test-name-pattern did not filter, so the F1 test was not run alone. I did not capture the failing run's exact exit code or output; the tool returned exit 1 with the output cut. I did not run the full G1 gate, only flow.test.mjs and size.test.mjs.
- final fix2: The full G1 suite was not run, only the roadmap-release workflow tests. The F2 test's two runs use the same command string, run from the workflow directory.

### Gates (esta execução)

Nenhum registrado nesta execução.

### Entradas humanas (esta execução)

- O quê: Corrigir o card E23 por revisão da estratégia para nomear o teste do script, plugins/productivity-tools/scripts/run-record.test.mjs (risco 4 do card).
  - Bloqueante (blq): não
  - Workaround: O spec nomeia o arquivo e o teste roda no G1.
- O quê: execução comportamental do orquestrador da sessão principal (DEC-204)
  - Bloqueante (blq): não
  - Workaround: None. No report was written and nothing was committed, because the plan forbids a fictional report. The main-session orchestrator should run the stop and resume on the fixture at D:/projects/claude-play-wt/_tmp/E23-comportamental/, marked SYNTHETIC FIXTURE. It should check that the resume skips the recorded reviews and reuses the recorded measurement. It should then write docs/reports/2026-11-13-E23-retomada-comportamental.md, delete the folder, and commit as 'E23 T8: relatório comportamental'.

### Textos cortados no registro (esta execução)

#### 5. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Em docs/plans/<slug>-<E>/run.json na branch do entregável, gravado e commitado só por plugins/productivity-tools/scripts/run-record.mjs (subcomandos approve, key e baseline, git por execFileSync sem shell), com teste em run-record.test.mjs. approve funde com o run.json de HEAD: troca só os estágios recebidos e só troca prep quando a carga o traz.

#### 6. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Sem chamada nova: spec e plano como primeiro comando do agente de leitura de progresso, só quando uma das duas revisões rodou; final como primeiro comando do agente do log de revisões em persistReviews(''), só quando a revisão final rodou. Em plan-only, que retorna antes do agente de progresso, spec e plano vão no primeiro comando de persistReviews('plan'), chamado só quando uma das duas revisões rodou (junto com o caso de textos cortados). approve funde com HEAD:<dir>run.json e mantém os estágios que não grava. Falha na gravação só faz a retomada revisar.

#### 7. add-decision --decision

- Origem: docs/plans/evolucao-skills-E23/reviews.md
- Destino: add-decision --decision
- Texto completo: Em prep { targetHead, gatesKey, baseline } de cada run.json, gravado junto de cada aprovação; no modo run o preflight roda run-record.mjs baseline sobre as branches dos entregáveis selecionados e, se houver saída, não mede; o workflow aceita só com targetHead igual, gatesKey igual a fnv1a(canon(GATES)) e validMeasure, senão mede como hoje.
