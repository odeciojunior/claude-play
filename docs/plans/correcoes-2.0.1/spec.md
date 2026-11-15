# Spec correcoes-2.0.1 -- Pendências 2.0.1: portão vazio, SHA completo nas referências de agente e implementadores fora do worktree

## Intenção

Três pendências da 2.0.0 anotadas em `docs/plans/roadmap-evolucao-skills/state.md` (linhas "2.0.1", DEC-762) e medidas no E11 (`docs/reports/2026-11-15-E11-P15-sondas.md`, `docs/reports/2026-11-15-E11-lote.md`) viram um lote pequeno de correções, sem card de roadmap:

1. **Portão vazio no plan-coordinator.** Na sonda do coordinator M′ a sessão passou `node --test tests/`, que no Node 22 falha igual antes e depois; a linha de base gravou `exit 1` com o mesmo nome de falha que o portão de onda depois mediu, `waveGatePasses` aceitou "mesma falha da base vermelha" e o plano terminou sem nenhum teste rodado. A linha de base de `workflow/coordinator.js` (`ensureBaseline`) passa a parar o run antes do primeiro passo quando o comando de teste sai com código diferente de zero ou quando o resumo do `node:test` mostra 0 testes ou 0 aprovados, com uma pergunta que nomeia o motivo; a pessoa corrige o comando ou aceita a base com `unblock`.
2. **SHA completo nas referências vindas de agente no release.** `roadmap-release.js` usa como commit esperado de uma medida valores copiados por agentes: `pre.targetHead` (preflight e `lastGood` inicial), `mg.mergeCommit` (merge e `firstExp`), `w.head` de `persistMergeRisks` e `persistMergeEffects` e `rr.headSha` (revisão do merge-fix). Uma referência corrompida (não é um SHA completo) faz `validMeasure` recusar medidas corretas, o que vira `infra` em `postMerge` e pode desfazer um merge válido. Cada referência passa por `fullSha`/`normSha` no ponto em que chega e, quando não é completa, segue o caminho de retorno inválido daquele agente, nunca a comparação da medida.
3. **Implementadores começam fora do worktree.** No lote E11, 9 de 12 implementadores rodaram primeiro o teste com caminho relativo a partir do repositório principal do sandbox (14 falhas "Could not find") e 4 rodaram `node --test` sem argumento na pasta errada. O prompt de implementação de tarefa do release e o agente `implementer` passam a dizer logo no início o caminho absoluto do worktree e que todo comando usa caminho absoluto ou `git -C`, sem `cd` e sem `&&`.

## Escopo

Dentro:

- `skills/plan-coordinator/workflow/coordinator.js`: função pura `baselineProblem(out)` no bloco `// <pure>` e parada `ask` em `ensureBaseline` (peça 1).
- `skills/plan-coordinator/references/delegation-protocol.md`: a parada de base vermelha ou vazia na lista das paradas do próprio run respondidas com `unblock` (peça 1).
- `skills/roadmap-release/workflow/roadmap-release.js`: função pura `fullRef(x)` ao lado de `fullSha` e `normSha`; uso dela no preflight (`pre.targetHead`), no merge (`mg.mergeCommit`), em `persistMergeRisks`, `persistMergeEffects` e no `rr.headSha` de `postMerge` (peça 2); linha de diretório de trabalho em `buildImplPrompt` (peça 3).
- `agents/implementer.md`: seção curta de diretório de trabalho antes de `## Choosing the mode` e `||` na lista de encadeamentos proibidos (peça 3; fecha também a pendência de `state.md` "implementer.md: alinhar as linhas 23, 39 e 40 sobre o prefixo cd <worktree> && ... e pôr || na lista proibida").
- Testes: `plan-coordinator/workflow/gate.test.mjs` e `flow.test.mjs`; `roadmap-release/workflow/merge.test.mjs`, `flow.test.mjs` e `prompts.test.mjs`.

Fora:

- **Portão `tests` do release com base de total 0 (item 1b do pedido).** Já coberto, sem mudança: `isRedBaseline` marca vermelho um portão `tests` com `!(r.total > 0)` e o preflight para com `preflight:red-baseline` (mensagem própria de `zeroTestGates`) salvo `acceptRedBaseline`; mesmo com a base aceita, `gatePasses` exige `total >= max(1, base.total)`, então um portão de 0 testes nunca passa. Testes que já fixam isso: `selection.test.mjs` (`I5: zeroTestGates names the tests gates that measured no tests`), `gates.test.mjs` (bases com `total: 0`) e `flow.test.mjs` (`redBase(gm('abc1234', { total: 0 }))`). A base que sai com falha também já para no preflight (`isRedBaseline`), salvo aceite explícito do dono.
- Arnês `tools/measure` (detector `gate-vazio` aceitar `N tests, N pass, N fail`, bytes do plan-only de DEC-763): correção própria do arnês, fora deste lote.
- E27, E16, E13 e qualquer outra pendência de `state.md`.
- Mudança de padrão (DEC-021): nenhum modo, teto, modelo ou effort muda.
- `lib/progress-state.mjs` e os blocos embutidos (`// <embed>`): não mudam; o evento `baseline` e o esquema `progress/1` ficam como estão.
- Versão do plugin (sem bump neste lote; a próxima publicação do dono decide) e a pasta do roadmap `docs/plans/roadmap-evolucao-skills/`.
- `mergeParentsOk`, `firstParent`/`secondParent`, `loc.mergeSha` (retomada), `probe.head` e `read.head`: fora do pedido; seguem com `gateShaMatch`.

O que não fazer:

- Não aumentar `MAX_WORKFLOW_CHARS` (250.000, DEC-647) nem `MAX_COORDINATOR_CHARS` (120.000); não editar os testes de tamanho; não encurtar texto de outro estágio para abrir espaço.
- Não mudar `waveGatePasses`, `gatePasses`, `isRedBaseline`, `zeroTestGates`, `validMeasure` nem `gateShaMatch`.
- Não quebrar os literais que o arnês procura no workflow (G1 completo roda `tools/**/*.test.mjs`): `TASK_SLICE_LITERALS`, `TASK_RESTRICTED_LITERAL` (`tr.restricted === true`), `MAXFIX_LITERAL`, `REVIEW_OPTS_LITERAL`, `FIX_OPTS_LITERAL`, `FINAL_FRA_LITERAL` e `FINAL_SLICE_LITERALS` em `tools/measure/run-batch.mjs`, e os trechos copiados em `tools/measure/arms/*.md` (`armMatches`).
- Não citar `superpowers`; não fazer push; não tocar em `main`, na branch de release nem em `D:/projects/claude-play`.

## Critérios de aceite

1. Dada uma linha de base cujo comando de teste sai com código diferente de zero ou cujo resumo do node:test mostra 0 testes ou 0 aprovados, quando o coordinator vai lançar o primeiro passo, então grava a linha de base, bloqueia o run com uma pergunta que nomeia o motivo e o comando e devolve a parada ask sem despachar nenhum implementador; respondida com unblock, a execução segue contra a linha de base aceita. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}
2. Dada uma referência de SHA devolvida por agente que não é um SHA completo (targetHead do preflight, mergeCommit do merge, head de persistMergeRisks ou persistMergeEffects, headSha da revisão do merge-fix), quando o release a usaria como commit esperado, então o preflight para pedindo ação do operador, o merge é desfeito como infra antes de qualquer portão pós-merge, e as demais deixam a medida seguinte sem commit esperado, de modo que nenhuma medida válida é recusada por causa da referência; uma referência completa em maiúsculas ou com quebra de linha é aceita normalizada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}
3. Dados o prompt de implementação de tarefa do release e o agente implementer, quando inspecionados, então o prompt diz, logo depois do briefing e antes da tarefa, o caminho absoluto do worktree e que todo comando usa caminho absoluto sob ele ou git -C, sem cd e sem &&; o agente traz a mesma regra antes dos modos e proíbe ;, &&, || e pipes em volta de um comando de verificação. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}
4. Dados os scripts de workflow alterados, quando medidos, então roadmap-release.js fica em até 250000 caracteres LF e coordinator.js em até 120000, sem mudar os tetos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs}

## Folga medida

Medido em 2026-11-15 na ponta `91f182a` (worktree `D:/projects/claude-play-wt/fix-2.0.1`, branch `fix/2.0.1-pendencias`), texto em LF:

```
node -e "const s=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').replace(/\r\n/g,'\n').length;console.log(s,250000-s)"
242263 7737
node -e "const s=require('fs').readFileSync('plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js','utf8').replace(/\r\n/g,'\n').length;console.log(s,120000-s)"
74755 45245
```

O acréscimo previsto em `roadmap-release.js` é de 600 a 1.000 caracteres (helper, cinco pontos de uso e uma linha de prompt); o texto genérico da regra de diretório fica no agente, que não conta no teto.

## Desenho

**Base vermelha ou vazia para o coordinator (critério 1, R1, R2, R3).** No bloco `// <pure>` de `coordinator.js`, ao lado de `baselineEvent`, entra `baselineProblem(out)`: devolve `null` ou um texto curto. Regras, na ordem: `out.exit !== 0` dá `the baseline test run exited <exit>`; senão, lido o `stdout` linha a linha (aparado), as linhas de resumo do node:test `# tests <n>` e `# pass <n>` (repórter TAP) ou `ℹ tests <n>` e `ℹ pass <n>` (repórter spec) dão `the baseline test run executed 0 tests` quando `tests` é 0 e `the baseline test run passed 0 tests` quando `pass` é 0. Sem linha de resumo reconhecível e com `exit 0`, devolve `null` (outros executores de teste e a fixture do arnês de `flow.test.mjs`, que imprime só `ok 1 - fine`, seguem como hoje). Em `ensureBaseline`, depois de `queue(baselineEvent(test, out))`, se `baselineProblem(out)` não é `null`: monta `question` = `<motivo> (command: <test>); fix the test command, or answer unblock to accept this baseline`, cortada a `GATE_Q_CAP` (o comando cortado primeiro); `queue({ type: 'block', text: question })` e devolve `stopWith('ask', { question, excerpt: tailOf(out.stdout) })`. O chamador (`case 'launch'`) já faz `return await finish(bad)` antes do evento `launch`, então nenhum implementador é despachado e a base fica gravada. No relançamento com `answers: [{ event: 'unblock' }]`, o run volta a `in-progress`, `ensureBaseline` não mede de novo (a base existe) e os portões de onda comparam com ela pelo `waveGatePasses` de hoje. `test` ausente ou `none` não muda (base verde sem rodar). `lib/progress-state.mjs`, os blocos embutidos e o esquema não mudam.

**Documentação do coordinator (critério 1).** Em `references/delegation-protocol.md`, a lista "A stop of the run itself (a failed wave gate, a lost reviewer, the final gate asking)" passa a incluir a base que falha ou roda 0 testes, respondida com `unblock` depois que a pessoa decidiu (aceitar a base) ou relançada depois de corrigir o comando. `SKILL.md` não muda (orçamento de prosa de `prose-budget.test.mjs`).

**Referências de SHA vindas de agente (critério 2, R5, R6, R7).** No bloco `// <pure>`, logo depois de `normSha`: `function fullRef(x) { const s = normSha(x); return fullSha(s) ? s : null }`. Uso:

- **Preflight.** Logo depois do agente `preflight` e antes de `recordedBaseline`: guarda o valor cru (`rawHead`) e normaliza `pre.targetHead = fullRef(pre.targetHead)` quando `pre` existe. A guarda de falha do preflight ganha a condição `MODE !== 'plan-only' && !foreignHold && !pre.targetHead`, com a mensagem `targetHead is not a full SHA: <rawHead>` quando `pre.ok` é verdadeiro e não há `pre.error`; o resto da guarda (op `preflight:<kind>`, `needs-operator`) não muda. `lastGood = pre.targetHead || TARGET`, `validMeasure(pre.baseline, pre.targetHead, GATES)`, `measureProblems` e o `prep.targetHead` de `recAt` passam a ver o valor normalizado sem outra edição. Em `plan-only` e com `foreignHold`, um `targetHead` não completo vira `null` e `lastGood` cai em `TARGET`, como hoje quando o campo falta.
- **Merge.** Logo depois do agente `merge`: `if (mg) mg.mergeCommit = fullRef(mg.mergeCommit)`. A condição existente `!mg || !mg.clean || !mg.mergeCommit || gateShaMatch(mg.mergeCommit, preSha)` passa a pegar a referência não completa; o tipo do `rollback` vira `infra` quando `mg` é nulo ou `mg.mergeCommit` é nulo (agente que não devolveu a referência) e fica `conteudo` nos outros casos; o motivo diz `mergeCommit is not a full SHA` nesse caso. Nada roda depois do merge antes dessa conferência, então o rollback desfaz só o commit de merge recém-feito, antes de qualquer portão; `mergeParentsOk`, `reviewConflicts`, `firstExp` e `postMerge` recebem o valor normalizado.
- **persistMergeRisks e persistMergeEffects.** `if (!w || !w.head)` continua (concern e `return exp`: o agente não confirmou o commit); depois, `return fullRef(w.head)`: um `head` não completo devolve `null`, e a medida seguinte de `postMerge` roda sem commit esperado (`gates(..., null, ...)`), ainda exigindo árvore limpa, SHA medido completo, todos os portões e grupos no mesmo commit.
- **rr.headSha.** Em `postMerge`, `exp = await persistMergeRisks(riskFrom, fullRef(rr.headSha))`.

**Diretório de trabalho do implementador (critério 3, R8).** Em `buildImplPrompt`, a primeira linha depois de `briefing(ctx)` passa a ser `WORKING DIRECTORY: the deliverable worktree ${ctx.wt}. Your shell does not start there and cd does not carry to the next call: run every command with absolute paths under ${ctx.wt} or git -C "${ctx.wt}" (a check written with relative paths runs with them made absolute there); never cd, never chain with &&.`; a linha da tarefa nomeia o plano como `${ctx.wt}/${ctx.planPath}`. O texto continua sem `NO_ASK` e sem `superpowers`, e as seis chamadas de `implAgent` não mudam. Em `agents/implementer.md`, uma seção `## Working directory` antes de `## Choosing the mode`: o prompt nomeia o worktree (ou o repositório); o shell não começa nele e `cd` não passa para a próxima chamada; todo comando usa caminho absoluto sob ele ou `git -C <dir>`, nunca caminho relativo ao ponto de partida do shell e nunca `cd <dir> &&`; um check com caminho relativo roda com o caminho tornado absoluto sob o worktree e `command` registra essa string. A linha 23 passa a `(no `;`, `&&`, `||` or pipes around it)` e a de `checks` ganha `||` na lista do que não se encadeia. O frontmatter não muda.

**Tamanho.** Toda tarefa que edita `roadmap-release.js` ou `coordinator.js` roda o teste de tamanho respectivo depois de cada edição e relata o total; acima do teto, para com `BLOCKED` e ação do dono (R9).

## Riscos

- A parada nova pega um repositório com falhas antigas legítimas e trava o coordinator -> a pergunta diz o motivo e o caminho (`unblock` aceita a base); a comparação de base vermelha de `waveGatePasses` continua valendo depois do aceite.
- O resumo do node:test muda de forma entre versões -> só as quatro linhas de resumo conhecidas contam; sem resumo reconhecido e com `exit 0`, nada muda (falso negativo, nunca parada indevida).
- O arnês de `roadmap-release/workflow/flow.test.mjs` usa SHAs curtos (`targetHead: 'abc1234'`, `mergeCommit: 'e1'`) que, com `fullRef`, param o preflight ou desfazem o merge -> a tarefa troca esses retornos padrão (e o `prep.targetHead` dos testes de base gravada) pelo SHA completo que `gm()` já produz (`'abc1234'.padEnd(40, '0')`, `'e1'.padEnd(40, '0')`), sem mudar o que cada teste confere.
- O merge desfeito por referência corrompida custa refazer o estágio de merge -> só acontece antes de qualquer portão e como `infra` (relançável); a alternativa de reler o SHA com um agente só de leitura ficou registrada em R6.
- Uma medida sem commit esperado aceita um commit errado -> só depois de um agente de registro que disse ter commitado; a medida ainda exige árvore limpa e SHA completo, no worktree de integração sob a trava de merge.
- Os literais do arnês somem do workflow -> nenhuma edição toca o laço de revisão por tarefa, a revisão final nem as opções de revisor e corretor; o G1 completo roda `tools/**/*.test.mjs`.

## Deixado para o plano

- Ordem: coordinator; referências de SHA no release; diretório de trabalho (depois da anterior, mesmo arquivo); gates.
- Nomes exatos dos testes e o desenho dos retornos simulados.
- Gates: G1 completo do `CLAUDE.md`, G2, G3 e G5 na tarefa final.

```json data
{
  "schema": "spec/1",
  "id": "correcoes-2.0.1",
  "title": "Pendências 2.0.1: portão vazio, SHA completo nas referências de agente e implementadores fora do worktree",
  "mode": "unattended",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dada uma linha de base cujo comando de teste sai com código diferente de zero ou cujo resumo do node:test mostra 0 testes ou 0 aprovados, quando o coordinator vai lançar o primeiro passo, então grava a linha de base, bloqueia o run com uma pergunta que nomeia o motivo e o comando e devolve a parada ask sem despachar nenhum implementador; respondida com unblock, a execução segue contra a linha de base aceita. {verify: test; evidence: node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma referência de SHA devolvida por agente que não é um SHA completo (targetHead do preflight, mergeCommit do merge, head de persistMergeRisks ou persistMergeEffects, headSha da revisão do merge-fix), quando o release a usaria como commit esperado, então o preflight para pedindo ação do operador, o merge é desfeito como infra antes de qualquer portão pós-merge, e as demais deixam a medida seguinte sem commit esperado, de modo que nenhuma medida válida é recusada por causa da referência; uma referência completa em maiúsculas ou com quebra de linha é aceita normalizada. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC3",
      "text": "Dados o prompt de implementação de tarefa do release e o agente implementer, quando inspecionados, então o prompt diz, logo depois do briefing e antes da tarefa, o caminho absoluto do worktree e que todo comando usa caminho absoluto sob ele ou git -C, sem cd e sem &&; o agente traz a mesma regra antes dos modos e proíbe ;, &&, || e pipes em volta de um comando de verificação. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs}"
    },
    {
      "id": "AC4",
      "text": "Dados os scripts de workflow alterados, quando medidos, então roadmap-release.js fica em até 250000 caracteres LF e coordinator.js em até 120000, sem mudar os tetos. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde fica a recusa da base vermelha ou vazia do coordinator?",
      "decision": "Função pura baselineProblem(out) no bloco <pure> de coordinator.js e parada em ensureBaseline (queue block, stopWith ask) antes do evento launch; lib/progress-state.mjs, os blocos embutidos e o esquema progress/1 não mudam.",
      "basis": "O pedido exige recusa determinística no script, não em prosa; ensureBaseline já roda antes do primeiro launch e o chamador já devolve finish(bad); mudar o evento baseline exigiria tocar a lib embutida e progress.mjs.",
      "alternative": "Recusar o evento baseline em lib/progress-state.mjs (applyEvents) e reembutir.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "A base que falha recusa o run de vez ou pergunta?",
      "decision": "Pergunta: grava a base, bloqueia com a pergunta (motivo, comando, 'fix the test command, or answer unblock to accept this baseline') e devolve ask; com unblock o run segue e os portões comparam com a base aceita pelo waveGatePasses de hoje.",
      "basis": "waveGatePasses foi feito para bases vermelhas legítimas (falhas antigas nomeadas); o release faz o mesmo com acceptRedBaseline explícito; DEC-762 pede que o portão não aceite em silêncio.",
      "alternative": "Recusa definitiva (status error) até a pessoa trocar o comando de teste.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como se reconhece uma base de 0 testes?",
      "decision": "Só pelas linhas de resumo do node:test no stdout aparado: '# tests <n>' e '# pass <n>' (TAP) ou 'ℹ tests <n>' e 'ℹ pass <n>' (spec); tests 0 ou pass 0 param; sem resumo reconhecido e com exit 0, nada muda.",
      "basis": "O pedido cita o resumo TAP; node 22 usa TAP ou spec conforme o terminal; outros executores e a fixture do arnês (ok 1 - fine, sem resumo) não podem parar por engano.",
      "alternative": "Exigir um resumo reconhecido para aceitar qualquer base.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "O portão tests do release precisa de mudança para base de total 0 (item 1b)?",
      "decision": "Não: isRedBaseline já marca vermelho um portão tests sem testes, o preflight para com preflight:red-baseline e a mensagem de zeroTestGates salvo acceptRedBaseline, e gatePasses exige total >= max(1, base.total); fica fora, com os testes existentes (selection.test.mjs I5, gates.test.mjs, flow.test.mjs redBase total 0) como prova.",
      "basis": "Leitura de roadmap-release.js (gatePasses, isRedBaseline, zeroTestGates, guarda do preflight) na ponta 91f182a; o pedido manda mudar só se for barato e claramente correto.",
      "alternative": "Recusar também em gatePasses uma base tests com total 0 aceita pelo dono.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Como as referências de SHA vindas de agente passam por fullSha?",
      "decision": "Helper puro fullRef(x) = normSha(x) quando fullSha, senão null, ao lado de normSha; aplicado no ponto em que cada referência chega (pre.targetHead, mg.mergeCommit, w.head de persistMergeRisks e persistMergeEffects, rr.headSha); a referência completa segue normalizada (minúsculas, sem espaços).",
      "basis": "Pedido (usar fullSha e normSha existentes); validMeasure e validEvidence já exigem SHA medido completo; DEC-762 (revisão de M′).",
      "alternative": "Conferir dentro de validMeasure se expectedSha é completo e ignorá-lo quando não for.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O que acontece com um mergeCommit não completo?",
      "decision": "Entra na condição de merge não concluído e vira rollback do tipo infra antes de qualquer portão pós-merge (mg nulo ou mergeCommit nulo dão infra; os outros casos seguem conteudo); o motivo diz mergeCommit is not a full SHA.",
      "basis": "mergeCommit alimenta o intervalo dos portões, a revisão de conflitos, a evidência dos docs e as claims do check final; sem um SHA confiável não há como validar; o rollback nesse ponto desfaz só o commit recém-feito e é relançável.",
      "alternative": "Reler HEAD, HEAD^1 e HEAD^2 com um agente haiku só de leitura e seguir com o SHA relido.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "O que acontece com um head de persist* ou um rr.headSha não completo?",
      "decision": "Vira null: a medida seguinte de postMerge roda sem commit esperado (ainda exige árvore limpa, SHA medido completo, todos os portões e grupos no mesmo commit); head ausente em persist* continua com o concern e o exp de hoje.",
      "basis": "O agente de registro disse ter commitado, então o exp anterior também recusaria a medida correta; sem commit esperado nenhuma medida válida é recusada, e o worktree de integração está sob a trava de merge.",
      "alternative": "Tratar como agente nulo (concern e exp anterior) ou como infra em postMerge.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como o implementador passa a começar no worktree?",
      "decision": "buildImplPrompt abre, logo depois do briefing, com WORKING DIRECTORY e o caminho absoluto ctx.wt, a regra de caminho absoluto ou git -C, sem cd e sem &&, e nomeia o plano como ctx.wt/ctx.planPath; implementer.md ganha a seção Working directory antes dos modos e || na lista proibida; NO_ASK, as seis chamadas de implAgent e o frontmatter não mudam.",
      "basis": "Lote E11 (9 de 12 implementadores com caminho relativo, 14 falhas); RULE_TMP proíbe && e ;; pendência de state.md sobre as linhas 23, 39 e 40 de implementer.md; restrições de prompts.test.mjs (AC3 de E21).",
      "alternative": "Só o agente (sem linha no prompt) ou só o prompt (sem o agente).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "As correções cabem sob os tetos?",
      "decision": "Folga medida de 7.737 caracteres LF em roadmap-release.js (242.263 de 250.000) e 45.245 em coordinator.js (74.755 de 120.000) na ponta 91f182a; teste de tamanho depois de cada edição; acima do teto, BLOCKED com ação do dono, sem mudar teto nem teste.",
      "basis": "DEC-647 (teto 250.000 do release); MAX_COORDINATOR_CHARS em plan-coordinator/workflow/size.test.mjs.",
      "alternative": "Encurtar texto de outros estágios.",
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
      "input": "Coordinator: comando de teste com exit 0 sem linha de resumo do node:test (a fixture do arnês imprime só 'ok 1 - fine').",
      "expected": "baselineProblem devolve null; nenhuma parada; os testes de fluxo de hoje seguem iguais."
    },
    {
      "id": "C2",
      "input": "Coordinator: base com exit 1 aceita por unblock e portão de onda com as mesmas falhas nomeadas.",
      "expected": "O relançamento não mede a base de novo; waveGatePasses aceita as falhas já vermelhas na base e o run termina done."
    },
    {
      "id": "C3",
      "input": "Release: preflight devolve targetHead com o SHA completo em maiúsculas e quebra de linha final.",
      "expected": "fullRef normaliza; a base é validada contra o valor normalizado e lastGood é o SHA em minúsculas."
    },
    {
      "id": "C4",
      "input": "Release: merge-risks devolve head 'commit <sha completo>' depois do merge-fix, e a medida seguinte está no SHA completo real.",
      "expected": "A medida roda sem commit esperado, é aceita e o merge segue para os docs (docsOk), sem rollback."
    },
    {
      "id": "C5",
      "input": "Release: o agente de merge devolve mergeCommit que não é SHA completo (curto ou com texto em volta).",
      "expected": "Rollback do tipo infra antes de qualquer merge-gates, motivo com 'mergeCommit is not a full SHA'."
    }
  ]
}
```
