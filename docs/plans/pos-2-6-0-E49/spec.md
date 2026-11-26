# Spec E49 -- Base inválida antes da descoberta com alvo explícito

Entregável E49 do roadmap `docs/plans/roadmap-pos-2-6-0` (estratégia `docs/plans/2026-11-25-roadmap-pos-2-6-0.md`, card E49), no caminho crítico, depois do E48. Cobre REQ-013. Detalhe técnico: tarefa A4 (#8) de `docs/plans/2026-11-25-correcoes-issues-plan.md`, reduzida pela DEC-018 (antecipar a medida só com alvo explícito em args ou config, nunca em dry-run; cache de base e modo baseline-only adiados). Branch de trabalho: `release/pos-2.6.0`, no worktree `D:/projects/claude-play-wt/pos-2-6-0`. O código foi lido na árvore do E46 em execução (`D:/projects/claude-play-wt/pos-2-6-0-E46`, commit `5d06604`), e as specs do E47 e do E48 foram levadas em conta: esta spec cita símbolos, não números de linha.

## Intenção

Hoje o `roadmap-release.js` só mede a base dos portões no passo 4 do agente `preflight`, que depende da descoberta inteira (`TARGET`, `BASEBR`, `REPO`, `COMMON_BASE`, a lista `order` do `run-record baseline`). Uma base inválida aparece depois de cerca de 20 agentes de descoberta (#8). Quando o alvo vem explícito (`args.targetBranch` ou `config.releaseBranch`, o `PRE_TARGET` de hoje) e o repositório vem em `args.repo` (a skill sempre o passa), o alvo e o lugar da medida já são conhecidos antes da descoberta. O E49 mede os portões nesse momento, num agente próprio, e para com `preflight:baseline-invalid` sem chamar nenhum agente de descoberta quando a medida não vale. Quando vale, essa medida é a base da execução: o `preflight` não mede de novo. Em dry-run, em plan-only, sem alvo explícito, sem `args.repo` ou com orçamento abaixo de `MIN_BUDGET`, a ordem atual se mantém e nada é medido antes.

## Escopo

Dentro:

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: um bloco novo de medida antecipada entre a definição de `RUN_TAG` (com `runPrompt` e `S_RUN`) e a leitura da descoberta (`discCmd` e o `readSlices` do rótulo `discovery`); a subida, sem mudança de corpo, de `WT`, `gateDesc`, `gateNonce`, `gateTask`, `measureTxt` e `rereadMeasure` para antes desse bloco (`WT` hoje só é definido depois da descoberta, junto de `TODAY` e `REPO`); a constante `MIN_BUDGET` antes do bloco; o prompt do agente `preflight` (passos 3 e 4 e a linha `Return`) e a atribuição de `pre.baseline` logo depois dele; os comentários de `runToken` (cabeçalho ARGS e o comentário acima de `const { runToken: RUN_TOKEN_ARG, ...A }`), da leitura da descoberta ("The run token is the nonce of slice 0, in the FIRST agent() call") e a linha `targetBranch` do cabeçalho ARGS.
- `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`: testes de AC1, de AC2 e de retomada (risco do card), pelo `exec()` e pelo `makeJournal()` de hoje.
- `plugins/productivity-tools/skills/roadmap-release/references/operator.md`: a linha `preflight:baseline-invalid` da tabela de ações, a frase "A resume skips the spec, plan and final reviews ... and reuses the gate measurements when the target is unchanged" e o parágrafo "A resume never uses the Workflow cache" (custo da retomada).

Fora:

- `roadmap-release-agy.py` e o teste dele: paridade agy pendente #13 (DEC-008). Os commits que tocam `roadmap-release.js` e o commit de merge levam no corpo a linha `paridade agy: pendente #13`.
- Cache de base fora do `run.json` e `mode: "baseline-only"` (DEC-018, DEC-004: reabrir item adiado volta ao dono).
- Antecipar `preflight:red-baseline` (R4), `scripts/preflight.mjs`, `scripts/run-record.mjs`, `lib/` e qualquer bloco embutido (sem G5 obrigatório).
- O que E46, E47 e E48 mudam (`selectDeliverables` com `explain`, `shq`, ramo `finish-merge`, `MAXPAR` e `withoutApprove`): o E49 não toca nesses trechos.

O que não fazer:

- Não antecipar em `dry-run` nem em `plan-only`, e não antecipar com alvo derivado da descoberta (`disc.releaseBranch` ou `integracao/<slug>`) (DEC-018).
- Não medir duas vezes a base numa execução normal: com a medida antecipada válida, o `preflight` pula setup e medida.
- Não abortar merge, limpar, commitar nem criar branch no agente antecipado; ele só mede no worktree próprio `${WT}/_integracao` e nunca remove, move ou recria um worktree. O checkout da pessoa, autorizado ou não, fica com o `preflight`, como hoje.
- Não afrouxar nem apagar teste existente, em especial os de `runToken` e de retomada (DEC-004). O mock do `exec()` ganha uma resposta padrão `{ skipped: true }` para o rótulo `preflight-early`. Só a resposta do mock muda; nenhuma asserção muda. Com ela, o teste 'I3: args.repo wins over the discovered repo' (que passa `repo` em `run` com alvo explícito) segue o caminho atual sem ajuste. O teste (e) de AC2 cobre também agente nulo e `{}` (C5).
- Não escrever o número do limite de cópia fora de `lib/plan-digest.mjs` (`copy-budget.test.mjs`); usar `MAX_COPY_BYTES` se precisar.
- Não depender de número de linha do `roadmap-release.js`. Sem bump, push, tag ou comentário em issue.

## Desenho

### Condição e lugar da antecipação (R1, R2, R7)

Uma constante, por exemplo `EARLY_ON = MODE === 'run' && !!PRE_TARGET && !!A.repo && !lowBudget()`, decide a antecipação; `!lowBudget()` fica como último operando, para que execuções sem antecipação não chamem `budget.remaining()` a mais (os testes de `flow.test.mjs` "item 6: the report never commits in the person's checkout when the budget skipped every deliverable" e "ledger: plan-only with every deliverable skipped still explains the hold" contam essas chamadas). `lowBudget = () => typeof budget !== 'undefined' && budget.total && budget.remaining() < MIN_BUDGET` substitui as duas checagens de orçamento que já existem (a de antes do briefing e a do agendamento por entregável, `token budget too low`), e a constante `MIN_BUDGET` sobe para antes do bloco, sem mudar o valor nem o padrão por modo. Com orçamento baixo não há antecipação: a descoberta roda e a parada `partial` de hoje (`remaining budget (...) is below the minimum per deliverable`) acontece depois da seleção, como hoje.

Com `EARLY_ON`, um agente novo, rótulo `preflight-early`, fase `Preflight`, sonnet medium, schema `S_EARLY = { ...S_MEASURE, properties: { ...S_MEASURE.properties, skipped: BOOL, integrationWorktree: STR }, required: ['skipped'] }`, roda antes de qualquer chamada da descoberta. O prompt traz o `RUN_TOKEN` literal (R5) e as regras mínimas que não dependem da descoberta: não corrigir nada; sem commit, merge, push ou mudança de branch; pergunta ao usuário proibida; `You HOLD every lock`; arquivos temporários só em `${WT}/_tmp/preflight-early/`. Os passos: (1) se `refs/heads/<PRE_TARGET>` não existe em `git -C "<A.repo>"`, `skipped=true`; (2) worktree de integração com a mesma regra do passo 2 do `preflight` (o caminho de `git worktree list` para o alvo, senão `git -C "<A.repo>" worktree add "${WT}/_integracao" <PRE_TARGET>`), com `skipped=true` sempre que o caminho não é `${WT}/_integracao`, autorizado ou não (o checkout da pessoa fica com o `preflight`, como hoje: a `foreignRule` autorizada libera setup, install, `beforeEvidence` e portões nele, e as paradas de `allowIntegrationBranch` e `unfinished-merge` só vêm depois da descoberta), e também quando qualquer comando do passo 2 falha, quando há merge em andamento, quando `git status --porcelain` não está vazio ou quando um comando de `SETUP_CMDS` falha; nunca remover, mover ou recriar um worktree. O workflow descarta (trata como `skipped`) um `EARLY` cuja `integrationWorktree` não passe em `isOwnWorktree(integrationWorktree, WT)`; (3) setup, install (`INSTALL`) e a medida de todos os portões com `measureTxt(GATES, i => gateNonce('preflight', i), '"<integration worktree>"', 'preflight-gates')`, os mesmos nonces e a mesma task do passo 4 de hoje. Retorno: `skipped=false`, `integrationWorktree`, `headSha` (40 hex), `clean`, `gates`. Como os campos da medida ficam no nível de cima, o `withCapture` do `exec()` monta as linhas de captura sem mudança no teste.

### AC1 -- alvo explícito e portão quebrado: baseline-invalid sem agente de descoberta (R4, R10)

Quando o agente devolve `skipped === false`, a medida passa pela releitura do E43 (`rereadMeasure(GATES, m, i => gateNonce('preflight', i), m.integrationWorktree, 'preflight-gates', 'preflight', 'Preflight')`, a mesma chamada do preflight de hoje; um auxiliar comum aos dois pontos evita repetir os argumentos). Se o resultado falha em `validMeasure(m, null, GATES)`, o workflow registra `op('preflight:baseline-invalid', null, 'the baseline measure is invalid: ' + measureProblems(m, null, GATES).join('; '), <o doNow de hoje>, { ...A })` e devolve `mkResult('needs-operator')`, com `selection` nulo, sem nenhuma chamada `discovery*`, `discovery-donot` ou `preflight`. A frase e o `doNow` são os de hoje (um auxiliar comum às duas paradas pode montá-los). `resumeArgs` e `resumeWith` saem de `withoutApprove(A)` e de `{ ...A }`, que já não têm `runToken`. Agente nulo ou `skipped !== false` não param nada: segue a ordem atual (R3). `preflight:red-baseline` continua só depois do `preflight`, sobre `BASE` (R4).

Medida antecipada válida: o resultado fica numa variável (por exemplo `EARLY`). O prompt do `preflight` trata `EARLY` como trata hoje o plan-only nos passos 3 e 4 (`(skip: the gates were measured before the discovery)`) e não pede `recorded` nem `baseline` na linha `Return`; o texto de cabeçalho `You HOLD every lock` continua. Logo depois do agente, `if (pre && EARLY) pre.baseline = EARLY` vira o primeiro ramo de uma cadeia `if / else if / else if` com os dois ramos de hoje (`pre.recorded` com `recordedBaseline` e a releitura com `rereadMeasure`), que hoje são independentes. Com `EARLY`, nem `recordedBaseline` nem `rereadMeasure` rodam, mesmo que o agente devolva `recorded` ou `baseline` (o `S_PRE` continua aceitando os dois); sem `EARLY`, os dois ramos ficam como estão. O `validMeasure(pre.baseline, pre.targetHead, GATES)` de hoje confere a medida antecipada contra o `targetHead` do `preflight`: se o alvo andou entre as duas chamadas, a parada é a `preflight:baseline-invalid` de hoje, com `measured at commit X, expected Y`. `BASE`, `isRedBaseline` e o resto da execução não mudam.

`flow.test.mjs` (todos com `args: { repo: '/r' }` além do `targetBranch: 'integracao/x'` padrão do `exec()`): (a) `preflight-early` devolve uma medida com captura ilegível (`unreadable(gm('abc1234'))`) e as releituras recusadas pelo mock padrão: `r.status === 'needs-operator'`, `invalidBaseline(r)` presente com `gate lint missing from the measure` na frase, `labels[0] === 'preflight-early'`, nenhum rótulo que case `isDisc`, nenhum `discovery-donot`, nenhum rótulo igual a `preflight` (comparação exata, porque as releituras `preflight:reread-g<i>` aparecem), e `r.selection === null`; o prompt de `preflight-early` não contém `merge --abort`, `branch <alvo>` nem `commit`; (b) medida com portão `tests` incoerente (exit 1 sem `failedNames`): a mesma parada, sem descoberta; (c) cópia errada com releitura certa (o caso (a) do E43, agora no agente antecipado): sem parada, a execução segue e integra; (d) medida antecipada válida e o mock do `preflight` devolvendo uma `baseline` inválida e também `recorded`: a execução integra (a `baseline` e o `recorded` do `preflight` são ignorados, sem `recordedBaseline` nem releitura `preflight:reread-g<i>`), o prompt do `preflight` não tem linha `CAP_LINE` nem `run-record.mjs" baseline` e diz que os portões foram medidos antes da descoberta, e a ordem dos rótulos é `preflight-early`, descoberta, `preflight`; (e) medida antecipada válida com `headSha` diferente do `targetHead` do `preflight`: `preflight:baseline-invalid` depois da descoberta, com `measured at commit`. As regex aceitam valores com e sem aspas (o `shq` do E46).

### AC2 -- dry-run ou alvo da descoberta: ordem atual, nada medido antes (R1, R3, R7)

O bloco só existe sob `EARLY_ON`, então o `return mkResult(...)` do dry-run e a seleção ficam como estão. `flow.test.mjs`: (a) `mode: 'dry-run'` com `repo` e `targetBranch`: nenhum `preflight-early`, `calls[0]` é a descoberta (`preflight.mjs" discover`) e nenhum prompt traz `capture.mjs" run`; (b) `targetBranch: undefined`, config sem `releaseBranch` e `repo` presente (alvo derivado da descoberta): nenhum `preflight-early`, e o prompt do `preflight` traz as linhas de captura do passo 4 como hoje; (c) `mode: 'plan-only'` com `repo` e `targetBranch`: nenhum `preflight-early`; (d) orçamento baixo (`{ total: 1e9, remaining: () => 0 }`) com `repo` e `targetBranch`: nenhum `preflight-early`, a descoberta roda e o resultado é `partial` com `remaining budget`; (e) `preflight-early` devolve `skipped: true`, `null`, `{}` ou uma medida válida com `integrationWorktree` fora de `${WT}/_integracao`: a execução segue a ordem atual, com a medida no `preflight`; (f) sem `repo` (o `exec()` padrão, com `targetBranch`): nenhum `preflight-early`.

### Retomada, runToken e resumeFromRunId (risco do card, R5, R6)

Hoje a primeira chamada de agente é a fatia 0 da descoberta, com `nonce = RUN_TOKEN`, e é isso que faz uma retomada (com ou sem `resumeFromRunId`) não aproveitar o cache do runtime. Com a antecipação, a primeira chamada passa a ser `preflight-early`, cujo prompt traz o `RUN_TOKEN` literal e os nonces de portão com `RUN_TAG`; a fatia 0 da descoberta continua com o `RUN_TOKEN` como nonce. Os três comentários citados no Escopo passam a dizer "in the first agent call (the early measure when it runs, then the discovery read)". O `runToken` continua fora de `resumeArgs` e `resumeWith` (nenhuma mudança em `withoutApprove`, `mkResult` ou `op`).

Testes de retomada no mesmo entregável, com `makeJournal()`: (a) execução 1 com `runToken: 'pf-1'` e `repo`, medida antecipada válida, morta em `discovery`; execução 2 com `runToken: 'pf-2'` e o mesmo journal: `s2.cached` vazio, `preflight-early` roda ao vivo, o prompt dele traz `pf-2` e não `pf-1`; (b) com antecipação, `labels[0] === 'preflight-early'` e o prompt traz `pf-test`; a primeira chamada `discovery` tem `--nonce` igual a `pf-test`; nenhuma chamada depois da descoberta traz `pf-test` (a mesma afirmação do teste de hoje "the runToken never comes back in resume args", que continua sem mudança porque não passa `repo`); (c) a parada antecipada de AC1 devolve `resumeArgs` e `resumeWith` sem `runToken`, e uma segunda execução com esse `resumeWith` mais `runToken: 'pf-2'` e o mesmo journal mede de novo ao vivo (nada do cache).

Base gravada no `run.json`: o passo 4 de hoje roda `run-record.mjs baseline` e pula a medida quando há um registro para o mesmo `targetHead` e `GATES_KEY`. Esse atalho precisa de `order` e `disc.roadmapSlug`, que só existem depois da descoberta, então, com antecipação, toda retomada mede os portões de novo (no agente antecipado) em vez de reaproveitar o registro (R6): cerca de 10 minutos neste repositório, que o E53 vê na linha de base de parada e retomada. `operator.md`: no parágrafo "A resume never uses the Workflow cache", a frase de que, com alvo explícito e `repo`, os portões são medidos antes da descoberta e o registro do `run.json` não é reaproveitado; na frase "A resume skips the spec, plan and final reviews ... and reuses the gate measurements when the target is unchanged", a mesma exceção; na linha `preflight:baseline-invalid` da tabela, que com alvo explícito a medida acontece antes da descoberta. O texto também diz que a antecipação só liga com `args.targetBranch` ou com `releaseBranch` no `release.config.json`: o `releaseBranch` do `roadmap.config.json` chega pela descoberta, então nesse caso é preciso passar `targetBranch` para antecipar.

A pendência do E43 ("numa retomada com o mesmo runToken, a releitura pode aceitar a linha de uma execução anterior com o mesmo nonce") vale igual para o agente antecipado; o caminho suportado sempre traz um `runToken` novo (SKILL.md, passo 4), e o E49 não a resolve.

### Tamanho (R8)

Medida feita agora (CRLF trocado por LF e `length`, a fórmula de `discovery-slices.test.mjs`): `release/pos-2.6.0` tem 269.471 caracteres LF; a árvore do E46 depois da Tarefa 3 tem 269.800. Somando os tetos da DEC-007 que ainda faltam antes do E49: E46 Tarefa 6 até 270.100 (parada em 270.160); E47 até 273.600 (parada em 274.360); E48 até 274.300 (parada em 275.200). Com o teto do E49 de 6.000, o arquivo fica em até 280.300, com 4.200 de folga sob a trava de 284.500; no pior caso, com todos na parada de 20% e o E49 em 7.200, fica em 282.400 (folga de 2.100) e ainda abaixo do gatilho de 290.000 de `size.test.mjs` com mais de 10.000 de folga. Estimativa do desenho: entre 2.700 e 3.700 caracteres de delta líquido (prompt do agente antecipado perto de 1.600, código e schema perto de 900, com a conferência `isOwnWorktree` e a cadeia `else if`, condicionais do `preflight` perto de 250, comentários perto de 500, menos o que `lowBudget` e os auxiliares de releitura e de parada economizam; a subida de funções não muda a contagem). O desenho cabe; não há corte agora.

## Para o plano

- Uma tarefa de workflow e testes (`roadmap-release.js`, `flow.test.mjs`) e uma de docs (`operator.md`), cada uma com no máximo 4 arquivos e um commit, em worktree próprio criado de `release/pos-2.6.0` depois do merge do E48.
- Medir o tamanho antes e depois da tarefa do workflow: teto de 6.000 de delta líquido (DEC-007); entre 6.000 e 7.200, enxugar até o teto (primeiro corte: encurtar o prompt do agente antecipado, que pode remeter ao texto de `measureTxt` e ao passo 2 do `preflight`); acima de 7.200, parar e voltar ao dono via subagente opus (DEC-007, DEC-021). Se não couber, o E49 sai e a #8 fica aberta com a causa mitigada (DEC-018); a trava de 284.500 não muda.
- Texto exato do prompt de `preflight-early`, do `(skip: ...)` do `preflight` e das frases de `operator.md`; provar as frases contra orçamentos de prosa que as cubram, se houver (lint do plugin).
- Conferir que a subida de `WT`, `gateDesc`, `gateNonce`, `gateTask`, `measureTxt` e `rereadMeasure` não muda nenhum prompt (os testes de prompt de hoje passam sem ajuste) e que nada que eles usam fica em zona morta (`WT`, `BEFORE_EVIDENCE`, `lockList`, `pluginRootOf`, `shq`, `runPrompt`, `S_RUN`, `capturedMeasure`, `gateResult`, `agent`).
- G1 pelo Git Bash com o worktree parado, nunca com outra execução de testes correndo; piso: a contagem do último merge registrado em `docs/plans/roadmap-pos-2-6-0/log.md` antes do E49 (o do E48). Lint do plugin sem FAIL; G5 não se aplica (sem `lib/`). Revisão T2 (risco alto no plano de correções).
- Executado por coordinator, o gate de onda roda o G1 sem roadmap-release-agy, run-batch e make-scenario (`node --test "plugins/**/!(roadmap-release-agy).test.mjs" ".claude/hooks/*.test.mjs" "tools/**/!(run-batch|make-scenario).test.mjs"`); esses três e o G1 completo rodam pelo orquestrador no merge, com rollback (DEC-036). Nenhum check de tarefa inclui o `roadmap-release-agy.test.mjs` nem o G1 completo.

```json data
{
  "schema": "spec/1",
  "id": "E49",
  "title": "Base inválida antes da descoberta com alvo explícito",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um alvo explícito e um portão quebrado, quando o workflow roda, então acusa baseline-invalid sem chamar nenhum agente de descoberta. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dado o modo dry-run ou um alvo derivado da descoberta, quando o workflow roda, então a ordem atual se mantém e nada é medido antes. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Quando a medida dos portões é antecipada para antes da descoberta?",
      "decision": "Só com mode run, PRE_TARGET não vazio (args.targetBranch ou config.releaseBranch), args.repo presente e orçamento não abaixo de MIN_BUDGET; em dry-run, plan-only, alvo derivado da descoberta, sem repo ou com orçamento baixo, a ordem atual se mantém.",
      "basis": "DEC-018 manda antecipar só com alvo explícito em args ou config e nunca em dry-run; sem args.repo o repositório só é conhecido pela descoberta (REPO = A.repo || disc.repo), e a skill sempre passa repo (SKILL.md, passo 4). Nos testes, o mock do exec() ganha a resposta padrão { skipped: true } para preflight-early, sem mudar nenhuma asserção, porque o teste I3 já passa repo em run com alvo explícito. !lowBudget() fica como último operando para não somar chamadas de budget.remaining() sem antecipação.",
      "alternative": "Antecipar só com PRE_TARGET, rodando os comandos git no diretório do agente sem -C.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Que forma tem a medida antecipada e o que acontece com o preflight depois dela?",
      "decision": "Um agente novo preflight-early (sonnet medium, schema S_MEASURE mais skipped e integrationWorktree) antes da leitura da descoberta, com as regras mínimas que não dependem dela e os mesmos nonces, task e measureTxt do passo 4 de hoje; a medida válida vira pre.baseline e o preflight pula setup e medida, como no plan-only.",
      "basis": "O agente preflight depende da descoberta (TARGET, BASEBR, REPO, COMMON_BASE, order do run-record), então não pode subir inteiro; reaproveitar a medida antecipada mantém uma só medida de base por execução normal.",
      "alternative": "Medir cedo só para validar e medir de novo no preflight (dobra o tempo de base, perto de 10 minutos no G1 deste repositório).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Quando o agente antecipado não mede?",
      "decision": "Devolve skipped=true quando a branch do alvo não existe, quando o worktree do alvo não é ${WT}/_integracao (autorizado ou não), quando um comando do passo 2 falha, com merge em andamento, com árvore suja ou com setup que falha; nunca remove, move ou recria worktree; o workflow descarta um EARLY cuja integrationWorktree não passe em isOwnWorktree(..., WT); skipped=true, agente nulo ou {} seguem a ordem atual, e o preflight faz os passos 1 a 5 como hoje.",
      "basis": "Esses casos já têm tratamento e mensagem no preflight (criação da branch a partir de BASEBR, foreignRule, merge --abort só no worktree próprio, dirty, setup); a foreignRule autorizada libera setup, install, beforeEvidence e portões no checkout da pessoa, e as paradas de allowIntegrationBranch e unfinished-merge só vêm depois da descoberta, então medir no checkout da pessoa antes delas seria um efeito sem as guardas de hoje.",
      "alternative": "Parar antes da descoberta também nesses casos, com as mensagens do preflight.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "O que para a execução antes da descoberta?",
      "decision": "Só uma medida devolvida (skipped false) que, depois da releitura do E43, falha em validMeasure(m, null, GATES): op preflight:baseline-invalid com a frase e o doNow de hoje, resumeWith { ...A }, selection nulo; preflight:red-baseline continua depois do preflight.",
      "basis": "O card e REQ-013 tratam a base inválida; a base vermelha depende de acceptRedBaseline e de zeroTestGates e fica com o comportamento de hoje, sem gastar o teto do E49.",
      "alternative": "Antecipar também a parada preflight:red-baseline.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como manter a garantia do runToken quando a primeira chamada de agente deixa de ser a descoberta?",
      "decision": "O prompt de preflight-early traz o RUN_TOKEN literal (e os nonces de portão com RUN_TAG); a fatia 0 da descoberta continua com o RUN_TOKEN como nonce; os comentários do cabeçalho ARGS, de RUN_TOKEN e da leitura da descoberta passam a falar da primeira chamada; testes de retomada com makeJournal no mesmo entregável.",
      "basis": "O cache do runtime casa o prefixo de chamadas por prompt; com o token literal na primeira chamada, uma retomada com runToken novo roda tudo ao vivo, como hoje; RUN_TAG sozinho é um hash de 32 bits.",
      "alternative": "Confiar só no RUN_TAG dos nonces de portão.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Com antecipação, a base gravada no run.json continua sendo reaproveitada numa retomada?",
      "decision": "Não: com alvo explícito e repo, toda retomada mede a base de novo no agente antecipado (cerca de 10 minutos neste repositório; o E53 vê esse custo na linha de base de parada e retomada); o caminho sem antecipação continua usando run-record baseline; operator.md documenta o custo no parágrafo do cache e na frase 'reuses the gate measurements when the target is unchanged'.",
      "basis": "run-record baseline precisa de order e de disc.roadmapSlug, que só existem depois da descoberta; derivar os dois dos args antes dela acopla o workflow ao formato das pastas e aproxima o cache adiado pela DEC-018.",
      "alternative": "Rodar run-record baseline no agente antecipado com slug e ids derivados de args.roadmap e args.deliverables.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como fica o MIN_BUDGET?",
      "decision": "A constante MIN_BUDGET sobe para antes do bloco antecipado, um auxiliar lowBudget() serve às checagens de orçamento, e com orçamento baixo não há antecipação: a parada partial de hoje acontece depois da seleção.",
      "basis": "O card pede MIN_BUDGET antes da medida; manter a parada onde está preserva o resultado com selection que o operador recebe hoje, e o auxiliar paga parte do custo em caracteres.",
      "alternative": "Parar com partial antes da descoberta, sem selection.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "O desenho cabe no teto de 6.000 caracteres LF e na trava de 284.500?",
      "decision": "Cabe: estimativa entre 2.700 e 3.700 de delta líquido; com os tetos de E46 (Tarefa 6), E47 e E48, o arquivo fica em até 280.300 (282.400 no pior caso, com todos na parada de 20%); entre 6.000 e 7.200 o executor enxuga o prompt antecipado, e acima disso o E49 sai (DEC-018).",
      "basis": "Medido agora: 269.471 em release/pos-2.6.0 e 269.800 na árvore do E46 depois da Tarefa 3, com a fórmula da trava de discovery-slices.test.mjs; tetos da DEC-007.",
      "alternative": "Cortar já a subida de MIN_BUDGET e o lowBudget para reservar folga.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "A releitura do E43 vale na medida antecipada?",
      "decision": "Sim: a mesma chamada rereadMeasure do preflight de hoje (rótulo preflight, fase Preflight, task preflight-gates, cwd do integrationWorktree devolvido), por um auxiliar comum aos dois pontos, antes do validMeasure.",
      "basis": "Sem ela uma cópia errada de hash, que o E43 torna barata (DEC-009), voltaria a parar a execução, agora antes da descoberta.",
      "alternative": "Validar a medida antecipada sem releitura.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como fica a paridade com o caminho agy?",
      "decision": "Pendente #13: roadmap-release-agy.py não muda, e os commits que tocam roadmap-release.js e o merge levam a linha paridade agy: pendente #13.",
      "basis": "DEC-008 deixa G3a (#13) para o roadmap de paridade agy e exige o item de checklist em todo entregável que toca roadmap-release.js.",
      "alternative": "Portar a antecipação para o roadmap-release-agy.py.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Alvo explícito e repo, branch do alvo ainda inexistente.",
      "expected": "preflight-early devolve skipped=true; a descoberta roda e o preflight cria a branch e mede como hoje."
    },
    {
      "id": "C2",
      "input": "Medida antecipada válida, e o alvo recebe um commit antes do preflight.",
      "expected": "validMeasure contra o targetHead do preflight falha e a parada é preflight:baseline-invalid depois da descoberta, com measured at commit X, expected Y."
    },
    {
      "id": "C3",
      "input": "Alvo explícito igual ao integrationBranch sem allowIntegrationBranch, ou merge interrompido fora da seleção.",
      "expected": "A medida antecipada roda sem commit, ou pula quando o worktree do alvo não é ${WT}/_integracao; depois da descoberta valem o erro de allowIntegrationBranch ou a ação unfinished-merge de hoje; se a medida antecipada for inválida, a parada baseline-invalid vem antes."
    },
    {
      "id": "C4",
      "input": "Medida antecipada válida e seleção vazia.",
      "expected": "O resultado é o partial de hoje, sem preflight; a medida antecipada foi gasta sem uso."
    },
    {
      "id": "C5",
      "input": "Agente preflight-early nulo, {} (skipped ausente) ou com integrationWorktree fora de ${WT}/_integracao.",
      "expected": "Nada para; a execução segue a ordem atual com a medida no preflight."
    }
  ],
  "removedTests": []
}
```
