# Plano correcoes-2.0.1 -- Pendências 2.0.1: portão vazio, SHA completo nas referências de agente e implementadores fora do worktree

**Roadmap:** nenhum (lote de correções sem card; o registro em `docs/plans/roadmap-evolucao-skills/` fica para o executor depois da integração).

**Spec:** `docs/plans/correcoes-2.0.1/spec.md`. Worktree `D:/projects/claude-play-wt/fix-2.0.1`, branch `fix/2.0.1-pendencias`, a partir de `91f182a` (ponta de `feat/E28`). Nenhuma tarefa precisa de navegador nem de servidor. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main`, na branch de release nem em `D:/projects/claude-play`, sem bump de versão (a próxima publicação do dono decide), sem editar a pasta do roadmap. Nenhuma trava configurada.

## Contexto lido

- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` (74.755 caracteres LF; teto `MAX_COORDINATOR_CHARS = 120000` em `workflow/size.test.mjs`): bloco `// <pure>` nas linhas 31-1047, com os blocos embutidos de `lib/` até ~839 (não editar: `embedded blocks are not stale`); `failedTestNames` (~841), `waveGatePasses` (~858), `tailOf` (~920), `GATE_Q_CAP = 600` (~928), `baselineEvent(test, out)` (~953). Fora do bloco: `stopWith`/`failWith` (~1094), `finish` (~1213), `testCmd`, `runTest` e `ensureBaseline` (~1299-1314: grava a base com `queue(baselineEvent(test, out))` e devolve `null`), `case 'launch'` (~1412: `const bad = await ensureBaseline(); if (bad) return await finish(bad)` antes do evento `launch`), `case 'wave-gate'` (~1459: modelo de `queue block` + `stopWith('ask', { question, excerpt })`).
- `lib/progress-state.mjs`: `block` aceita `map-ready` ou `in-progress`; `unblock` volta a `in-progress`; `nextAction` com `blocked` devolve `ask`. Não muda.
- `plan-coordinator/workflow/gate.test.mjs` (testes puros por `loadPure`: `failedTestNames`, `waveGatePasses`, `baselineEvent`, `gateQuestion`); `plan-coordinator/workflow/flow.test.mjs` (arnês `sandbox()`, `makeSim(sb)` com o script-runner rodando de verdade os comandos, `launchArgs(sb, over)`, `CHECK` que imprime `ok 1 - fine`, ou `not ok 1 - new failure` com exit 1 quando existe `check.mjs.fail`; `byAgent`, `readState`); `references/delegation-protocol.md` (seção "Relaunch": "A stop of the run itself (a failed wave gate, a lost reviewer, the final gate asking) has no step: answer it with `{ "event": "unblock" }`").
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (242.263 caracteres LF, teto 250.000, DEC-647): `fullSha` (~193) e `normSha` (~197) no bloco `// <pure>` (56-1288); `gatePasses`, `isRedBaseline`, `zeroTestGates` (~216-258, sem mudança); `buildImplPrompt(ctx, task)` (~588); preflight: agente `preflight` (~1672), `recordedBaseline(pre.recorded, pre.targetHead, ...)` (~1682), guarda de falha (~1687-1693), `let lastGood = pre.targetHead || TARGET` (~1696), `validMeasure(pre.baseline, pre.targetHead, GATES)` (~1698); `persistMergeRisks` (~1932-1943) e `persistMergeEffects` (~1946-1956), cada um com `if (!w || !w.head) { out.concerns.push(...); return exp }` e `return w.head`; `postMerge` (~1967) com `exp = await persistMergeRisks(riskFrom, rr.headSha)` (~1990); merge (~2850-2866): `if (!mg || !mg.clean || !mg.mergeCommit || gateShaMatch(mg.mergeCommit, preSha)) return rollback(..., mg ? 'conteudo' : 'infra')`, `mergeParentsOk`, `let firstExp = mg.mergeCommit`, `postMerge(mg.mergeCommit, ...)`.
- `roadmap-release/workflow/flow.test.mjs` (5.041 linhas): `gm(head, over)` (linha 20) já completa `headSha` com `head.padEnd(40, '0')`; o retorno padrão do preflight (linha 197) e os de `redBase` (897), 924, 1155, `foreignPre` (1191), `foreignNoBase` (1363) e 4792 usam `targetHead: 'abc1234'` (13 ocorrências); `mergeCommit: 'e1'` em 222, 266 e 1832; testes de base gravada com `prep.targetHead: 'abc1234'` (4766, 4783) e `assert.equal(pay.prep.targetHead, 'abc1234')` (4738); `minor 13: a risk accepted on the merge fix is committed, and the next measure expects that head` (~1843) é o modelo dos testes de `persist*`. `merge.test.mjs` (testes puros: `mergeParentsOk`). `prompts.test.mjs`: `ctx` com `wt: '/wt/E7'` e `planPath: 'docs/plan.md'`; `AC3: implementer and fixer prompts cite no superpowers and forbid asking` (seis chamadas de `implAgent`, `buildImplPrompt` sem `NO_ASK`, frontmatter do agente fixo) e `implementer.md carries the checks contract ...` (frases literais que ficam).
- `plugins/productivity-tools/agents/implementer.md` (48 linhas): linha 23 `(no `;`, `&&` or pipes around it)`; linha 40 `nothing chained after it with `;` or `&&``; sem seção de diretório de trabalho.
- `tools/measure/run-batch.mjs` (~875-883): literais que o arnês procura no workflow (`TASK_SLICE_LITERALS`, `TASK_RESTRICTED_LITERAL = 'tr.restricted === true'`, `MAXFIX_LITERAL`, `REVIEW_OPTS_LITERAL`, `FIX_OPTS_LITERAL`, `FINAL_FRA_LITERAL`, `FINAL_SLICE_LITERALS`) e `tools/measure/arms/*.md` (trechos copiados dos prompts de revisão e correção, conferidos por `armMatches`). Nenhuma tarefa deste plano toca esses trechos; o G1 completo os confere.

## Tamanho dos scripts

Medido na ponta `91f182a`: `roadmap-release.js` 242.263 caracteres LF (folga 7.737); `coordinator.js` 74.755 (folga 45.245). Comandos e saídas na spec, seção "Folga medida". A Tarefa 1 mede `coordinator.js` com `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs`; as Tarefas 2 e 3 medem `roadmap-release.js` com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` depois de cada edição e relatam o total. Acima do teto, a tarefa para com `BLOCKED`, diz quanto passou e pede ação do dono; nunca edita os testes de tamanho nem os tetos e nunca encurta texto de outro estágio.

## Tarefas

### Tarefa 1: Coordinator para antes do primeiro passo com base vermelha ou vazia

Arquivos: `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`, `plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md`; testes `plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs` e `plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs`. Não edita `lib/progress-state.mjs` nem os blocos `// <embed>`.

Teste primeiro em `gate.test.mjs` (por `loadPure`, como os testes de `baselineEvent`), `2.0.1 AC1: baselineProblem names a failing or empty baseline and lets a plain green run through`:

- `baselineProblem({ exit: 1, stdout: 'not ok 1 - x' })` casa `/exited 1/`; `baselineProblem({ exit: 2, stdout: '' })` casa `/exited 2/`.
- `{ exit: 0, stdout: 'TAP version 13\n# tests 0\n# suites 0\n# pass 0\n# fail 0\n' }` casa `/executed 0 tests/`; `{ exit: 0, stdout: 'ℹ tests 0\nℹ pass 0\n' }` casa `/executed 0 tests/`; `{ exit: 0, stdout: '  # tests 3  \n# pass 0\n# skipped 3\n' }` casa `/passed 0 tests/`; `{ exit: 0, stdout: 'ℹ tests 2\r\nℹ pass 0\r\n' }` casa `/passed 0 tests/`.
- `{ exit: 0, stdout: 'ok 1 - fine' }`, `{ exit: 0, stdout: '# tests 2\n# pass 2\n' }`, `{ exit: 0, stdout: 'ℹ tests 5\nℹ pass 5\n' }` e `{ exit: 0, stdout: undefined }` devolvem `null` (C1).

Teste primeiro em `flow.test.mjs`:

- `2.0.1 AC1: a red baseline stops before any implementer and unblock accepts it`: `withSandbox`; antes de lançar, `writeFileSync(sb.check + '.fail', '')`. `const sim = makeSim(sb); const r = await sim.go(launchArgs(sb))`: `r.status === 'stopped'`, `r.stop.kind === 'ask'`, `r.stop.question` casa `/exited 1/`, contém `check.mjs` e casa `/answer unblock to accept this baseline/`; `byAgent(sim, IMPL).length === 0`; `readState(sb)` tem `run.status === 'blocked'`, `run.baseline.exit === 1` e `run.baseline.failedNames` igual a `['new failure']`. Relançar com o arquivo `.fail` ainda presente: `const sim2 = makeSim(sb); const r2 = await sim2.go(launchArgs(sb, { answers: [{ event: 'unblock' }] }))`: `r2.status === 'done'`; nenhuma chamada de `sim2` tem `o.label === 'baseline'`; `byAgent(sim2, IMPL).length === 4` (C2: os portões de onda falham com o mesmo nome da base aceita e passam).
- `2.0.1 AC1: a baseline that runs 0 tests stops before any implementer`: `withSandbox`; escrever `join(sb.dir, 'empty.mjs')` com `console.log('TAP version 13'); console.log('# tests 0'); console.log('# pass 0');` e lançar com `launchArgs(sb, { test: \`node ${shq(join(sb.dir, 'empty.mjs').replace(/\\/g, '/'))}\` })`: `r.status === 'stopped'`, `r.stop.kind === 'ask'`, a pergunta casa `/executed 0 tests/`; `byAgent(sim, IMPL).length === 0`; `readState(sb).run.baseline.exit === 0`.

Rodar `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs` e `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` e relatar as falhas (`baselineProblem` não existe; o run com base vermelha termina `done`).

Implementar em `coordinator.js`:

1. No bloco `// <pure>`, logo depois de `baselineEvent`, com um comentário de uma linha: `function baselineProblem(out)` que devolve `the baseline test run exited <exit>` quando `out.exit !== 0`; senão lê `String(out.stdout == null ? '' : out.stdout).split(/\r?\n/)`, apara cada linha, reconhece `^(?:#|ℹ) tests (\d+)$` e `^(?:#|ℹ) pass (\d+)$`, e devolve `the baseline test run executed 0 tests` quando `tests` é 0 ou `the baseline test run passed 0 tests` quando `pass` é 0; senão `null`.
2. Em `ensureBaseline`, depois de `queue(baselineEvent(test, out))`: `const why = baselineProblem(out)`; se não é `null`, montar `question` = `${why} (command: ${test}); fix the test command, or answer unblock to accept this baseline`, cortando o comando para caber em `GATE_Q_CAP` (o motivo e o final da frase ficam inteiros); `queue({ type: 'block', text: question })` e `return stopWith('ask', { question, excerpt: tailOf(out.stdout) })`. O comentário acima de `ensureBaseline` ganha uma oração dizendo que uma base que falha ou roda 0 testes para o run antes do primeiro passo. Nada mais muda (`case 'launch'` já devolve `finish(bad)`).

Em `references/delegation-protocol.md`, na linha "A stop of the run itself (...)", acrescentar `a baseline whose tests fail or run 0 tests` à lista entre parênteses e uma oração: fix the test command and relaunch, or answer `unblock` to accept that baseline. `SKILL.md` não muda.

Rodar `gate.test.mjs`, `flow.test.mjs`, `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs` (relatar o total; `embedded blocks are not stale` precisa passar) e `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` até passar. Commit `correcoes-2.0.1 T1: coordinator para com base vermelha ou vazia`.

### Tarefa 2: Referências de SHA vindas de agente passam por fullRef no release

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs`.

Primeiro, só o arnês de `flow.test.mjs`, sem mudar o que cada teste confere: no topo, ao lado de `gm`, `const FULL = (s) => s.padEnd(40, '0')` (o mesmo valor que `gm` já produz); trocar todo `targetHead: 'abc1234'` de retorno de preflight e de `prep` por `targetHead: FULL('abc1234')`, a asserção `assert.equal(pay.prep.targetHead, 'abc1234')` por `FULL('abc1234')`, e todo `mergeCommit: 'e1'` por `mergeCommit: FULL('e1')`. Os outros valores curtos (`'a1'`, `'e9'`, `firstParent`, `head` de setup, de sync e de `docs-read`, as chamadas puras `recordedBaseline(out, 'abc1234', ...)` com o `out` local do próprio teste) não mudam. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`: precisa continuar verde antes da mudança do script (o prefixo já casava).

Teste primeiro em `merge.test.mjs` (por `loadPure`), `2.0.1 AC2: fullRef keeps a full SHA normalized and nothing else`: `fullRef('a'.repeat(40))` e `fullRef('b'.repeat(64))` devolvem o próprio valor; `fullRef('ABC' + 'd'.repeat(37) + '\n')` devolve `'abc' + 'd'.repeat(37)`; `fullRef('abc1234')`, `fullRef('a'.repeat(39))`, `fullRef('commit ' + 'a'.repeat(40))`, `fullRef('HEAD')`, `fullRef('')`, `fullRef(undefined)`, `fullRef(null)` e `fullRef(123)` devolvem `null`. No mesmo arquivo, `2.0.1 AC2: both persist steps hand back fullRef of the head they read`: com o texto do script (CRLF normalizado), `return fullRef(w.head)` aparece exatamente 2 vezes e `persistMergeRisks(riskFrom, fullRef(rr.headSha))` aparece 1 vez.

Teste primeiro em `flow.test.mjs`, no fim do arquivo:

- `2.0.1 AC2: a preflight targetHead that is not a full SHA stops before any deliverable work`: preflight com `targetHead: 'abc1234'` e `baseline: gm('abc1234')`: `r.status === 'needs-operator'`; uma ação de operador com `kind` começando por `preflight:` cujo texto contém `targetHead is not a full SHA: abc1234`; nenhum rótulo `E1:setup`.
- `2.0.1 AC2: a full targetHead in uppercase with a newline is accepted normalized` (C3): preflight com `targetHead: FULL('abc1234').toUpperCase() + '\n'` e `baseline: gm('abc1234')`: o rótulo `E1:setup` existe e o prompt dele contém `FULL('abc1234')` (o `lastGood` normalizado vai no `worktree add ... -b feat/E1 <lastGood>`).
- `2.0.1 AC2: a mergeCommit that is not a full SHA rolls the merge back as infra before any post-merge gate` (C5): merge com `mergeCommit: 'e1'` (curto) e, numa segunda execução, `mergeCommit: 'sha ' + FULL('e1')`: em cada uma, o rótulo `E1:rollback` existe, nenhum rótulo casa `/merge-gates/`, o resultado de E1 não está integrado e a falha registrada (o campo que os testes de rollback existentes já leem) contém `mergeCommit is not a full SHA` e o tipo `infra`.
- `2.0.1 AC2: a merge-risks head that is not a full SHA leaves the next measure without an expected commit` (C4): como `minor 13: a risk accepted on the merge fix ...`, com `E1:merge-risks` devolvendo `{ head: 'commit ' + FULL('e9'), commit: 'x' }` e `E1:merge-gates2` devolvendo `gm('e9')`: nenhum rótulo `E1:rollback`; `r.results[0].merge.docsOk === true`.
- `2.0.1 AC2: a merge-fix review headSha that is not a full SHA does not reject the next measure`: `E1:merge-gates1` com falha (`gm('e1', { exit: 1, failedNames: ['t'] })`), `E1:merge-fix` `DONE`, `E1:merge-fix-review` `{ issues: [], headSha: 'HEAD', clean: true, commitsInRange: 1 }` (sem risco aceito: `persistMergeRisks` devolve o `exp` que recebeu) e `E1:merge-gates2` `gm('f7')`: nenhum rótulo `E1:rollback`; `r.results[0].merge.docsOk === true`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs` e `flow.test.mjs` e relatar as falhas.

Implementar em `roadmap-release.js`, medindo depois de cada edição:

1. No bloco `// <pure>`, logo depois de `normSha`, com um comentário de uma linha: `function fullRef(x) { const s = normSha(x); return fullSha(s) ? s : null }`.
2. Preflight: logo depois do agente `preflight` e antes da linha de `recordedBaseline`, `const rawHead = pre && pre.targetHead` e `if (pre) pre.targetHead = fullRef(pre.targetHead)`. Na guarda de falha, acrescentar `|| (MODE !== 'plan-only' && !foreignHold && !pre.targetHead)` e, no texto do op, usar `targetHead is not a full SHA: ${rawHead}` quando `pre.ok` é verdadeiro, não há `pre.error` e `pre.targetHead` é nulo (o resto do op e o `needs-operator` não mudam). `lastGood`, `validMeasure`, `measureProblems` e `recAt` não mudam de texto.
3. Merge: logo depois do agente `merge`, `if (mg) mg.mergeCommit = fullRef(mg.mergeCommit)`; na condição de merge não concluído, o tipo passa a `infra` quando `!mg || !mg.mergeCommit` e fica `conteudo` nos outros casos; o motivo, quando `mg` existe e `mg.mergeCommit` é nulo, diz `mergeCommit is not a full SHA` (em vez de `mg.details`). O resto do estágio não muda.
4. `persistMergeRisks` e `persistMergeEffects`: `return w.head` passa a `return fullRef(w.head)`; o `if (!w || !w.head)` e o concern ficam. Os comentários acima das duas funções ganham "(null when the head is not a full SHA: the next measure then expects no commit)" ou equivalente curto, só neles.
5. `postMerge`: `exp = await persistMergeRisks(riskFrom, rr.headSha)` passa a `exp = await persistMergeRisks(riskFrom, fullRef(rr.headSha))`.

Rodar `merge.test.mjs`, `flow.test.mjs`, `gates.test.mjs`, `prompts.test.mjs`, `review.test.mjs` e `size.test.mjs` (relatar o total; `BLOCKED` acima de 250.000), e `node --test "tools/**/*.test.mjs"` (literais do arnês intactos). Conferir com `git -C D:/projects/claude-play-wt/fix-2.0.1 diff -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` que só mudaram `fullRef`, a guarda e a normalização do preflight, a condição do merge, as duas linhas de retorno de `persist*` com seus comentários e a linha do `rr.headSha`. Commit `correcoes-2.0.1 T2: referências de SHA de agente passam por fullRef`.

### Tarefa 3: Implementador recebe o worktree absoluto e a regra de caminhos

Arquivos: `plugins/productivity-tools/agents/implementer.md`, `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`. Depende da Tarefa 2 (mesmo `roadmap-release.js`).

Teste primeiro em `prompts.test.mjs`:

- `2.0.1 AC3: the task implementation prompt names the absolute worktree first and forbids relative paths, cd and &&`: `const p = P.buildImplPrompt(ctx, task)`; `const w = p.indexOf('WORKING DIRECTORY: the deliverable worktree /wt/E7.')`; `w > p.indexOf('CURRENT BASELINE OF THE TARGET')` e `w < p.indexOf('Implement ONLY Task 3')`; `p` contém `absolute paths under /wt/E7 or git -C "/wt/E7"`, `never cd, never chain with &&` e `/wt/E7/docs/plan.md`; com `{ ...ctx, wt: 'D:/w t/E9' }`, o prompt contém `git -C "D:/w t/E9"`.
- `2.0.1 AC3: implementer.md states the working directory rule before the modes and forbids || around a check`: lê o agente (CRLF normalizado); `agent.indexOf('## Working directory')` é maior que 0 e menor que `agent.indexOf('## Choosing the mode')`; a seção (de `## Working directory` até o próximo `\n## `) contém `does not carry to the next call`, `absolute paths`, `git -C <dir>`, `never prefix a command with \`cd <dir> &&\`` e `\`command\` reports that string`; o agente contém `(no \`;\`, \`&&\`, \`||\` or pipes around it)` e `nothing chained after it with \`;\`, \`&&\` or \`||\``.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e relatar as falhas.

Implementar:

1. Em `buildImplPrompt` (`roadmap-release.js`), a primeira linha depois de `${briefing(ctx)}` e da linha em branco passa a ser `WORKING DIRECTORY: the deliverable worktree ${ctx.wt}. Your shell does not start there and cd does not carry to the next call: run every command with absolute paths under ${ctx.wt} or git -C "${ctx.wt}" (a check written with relative paths runs with them made absolute there); never cd, never chain with &&.`; na linha seguinte, `of the plan ${ctx.planPath}, in the deliverable worktree (...)` passa a `of the plan ${ctx.wt}/${ctx.planPath}, in that worktree (...)`, mantendo o parêntese e o resto. Nada mais muda: sem `NO_ASK`, sem `superpowers`, as seis chamadas de `implAgent`, o `runImpl` e os corretores ficam como estão.
2. Em `agents/implementer.md`, antes de `## Choosing the mode`, a seção:

   ```
   ## Working directory

   The prompt names the directory you work in: the worktree (or the repository). Your shell does not start there, and a `cd` does not carry to the next call. Run every command with absolute paths under that directory, or with `git -C <dir>`; never use a path relative to where the shell starts and never prefix a command with `cd <dir> &&`. A check written with relative paths runs with those paths made absolute under the directory, and `command` reports that string.
   ```

   A linha 23 passa a `(no \`;\`, \`&&\`, \`||\` or pipes around it)`; na linha 40, `nothing chained after it with \`;\` or \`&&\`` passa a `nothing chained after it with \`;\`, \`&&\` or \`||\``. Frontmatter, `NO_ASK` literal e as frases conferidas por `implementer.md carries the checks contract ...` ficam.

Rodar `prompts.test.mjs`, `flow.test.mjs`, `size.test.mjs` (relatar o total) e `node --test "tools/**/*.test.mjs"` até passar. Commit `correcoes-2.0.1 T3: implementador recebe o worktree absoluto`.

### Tarefa 4: Gates

Sem arquivos e sem commit. Roda no worktree `D:/projects/claude-play-wt/fix-2.0.1` depois das Tarefas 1 a 3:

- G1 completo do `CLAUDE.md`: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`. Ele inclui `tools/`, que procura literais do workflow (`TASK_RESTRICTED_LITERAL` e os outros de `tools/measure/run-batch.mjs`, e os trechos de `tools/measure/arms/*.md`): uma falha ali devolve a tarefa que editou o trecho, sem editar o arnês.
- Testes de tamanho, com os totais relatados: `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs`.
- G2: `claude plugin validate .`.
- G3: `claude plugin validate plugins/productivity-tools`.
- G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.
- Os comandos de evidência dos quatro critérios (tabela abaixo).

Evidência aceitável se um gate não puder rodar neste ambiente (por exemplo, `claude` ausente): a saída literal do comando e o motivo, sem resultado inventado. Uma falha volta à tarefa dona do arquivo, sem editar testes de tamanho nem tetos.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs` | `2.0.1 AC1: baselineProblem names a failing or empty baseline and lets a plain green run through`, `2.0.1 AC1: a red baseline stops before any implementer and unblock accepts it`, `2.0.1 AC1: a baseline that runs 0 tests stops before any implementer` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `2.0.1 AC2: fullRef keeps a full SHA normalized and nothing else`, `2.0.1 AC2: both persist steps hand back fullRef of the head they read` e os cinco testes `2.0.1 AC2:` de `flow.test.mjs` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | `2.0.1 AC3: the task implementation prompt names the absolute worktree first and forbids relative paths, cd and &&`, `2.0.1 AC3: implementer.md states the working directory rule before the modes and forbids \|\| around a check` |
| AC4 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs` | `the release workflow stays within the size launched by name`, `the coordinator workflow stays within its own size cap` |

## Decisões do plano

- R10: quatro tarefas; T1 (coordinator) e T2 (release) têm arquivos disjuntos e não dependem entre si; T3 depende de T2 porque as duas editam `roadmap-release.js`; T4 depende das três.
- R11: na T2, o arnês de `flow.test.mjs` passa a SHAs completos antes da mudança do script, num passo que mantém a suíte verde, para que cada falha nova venha só dos testes `2.0.1 AC2:`.
- R12: a T4 roda o G1 completo do `CLAUDE.md` (inclui `tools/`), G2, G3 e G5, sem arquivo nem commit.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "correcoes-2.0.1",
  "title": "Pendências 2.0.1: portão vazio, SHA completo nas referências de agente e implementadores fora do worktree",
  "spec": "spec.md",
  "roadmap": null,
  "constraints": [
    "Trabalhar só no worktree D:/projects/claude-play-wt/fix-2.0.1 (branch fix/2.0.1-pendencias); sem push; nunca tocar em main, na branch de release nem em D:/projects/claude-play.",
    "Sem bump de versão; não editar docs/plans/roadmap-evolucao-skills/.",
    "Não aumentar MAX_WORKFLOW_CHARS (250000) nem MAX_COORDINATOR_CHARS (120000) nem editar os testes de tamanho; medir depois de cada edição dos scripts de workflow; acima do teto, BLOCKED com ação do dono.",
    "Não mudar waveGatePasses, gatePasses, isRedBaseline, zeroTestGates, validMeasure, gateShaMatch, lib/progress-state.mjs nem os blocos // <embed>.",
    "Não tocar o laço de revisão por tarefa, a revisão final, as opções de revisor e corretor nem os trechos copiados em tools/measure/arms/*.md: os literais de tools/measure/run-batch.mjs (TASK_SLICE_LITERALS, TASK_RESTRICTED_LITERAL 'tr.restricted === true', MAXFIX_LITERAL, REVIEW_OPTS_LITERAL, FIX_OPTS_LITERAL, FINAL_FRA_LITERAL, FINAL_SLICE_LITERALS) precisam continuar no workflow.",
    "Não citar superpowers no agente, no script nem em prompt; buildImplPrompt continua sem NO_ASK.",
    "Um comando simples por chamada, com caminhos absolutos ou git -C: sem cd, sem heredoc, sem laço, sem &&, sem || e sem ;.",
    "Commits de tarefa começam com \"correcoes-2.0.1 T<n>:\", via git commit -F <arquivo>, e terminam com a linha Co-Authored-By da sessão; nunca git add -A nem git stash."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Coordinator para antes do primeiro passo com base vermelha ou vazia",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js",
          "plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md"
        ],
        "test": [
          "plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs",
          "plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["baselineProblem(out) no bloco <pure> de coordinator.js; ensureBaseline devolve stopWith('ask') com block quando a base falha ou roda 0 testes"],
      "consumes": [],
      "covers": ["AC1", "AC4", "C1", "C2"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0 (até 120000 caracteres LF; blocos embutidos em dia)" },
        { "cmd": "node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Referências de SHA vindas de agente passam por fullRef no release",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 2, "blast": 2, "verifiability": 1 },
      "produces": [
        "fullRef(x) no bloco <pure> de roadmap-release.js",
        "pre.targetHead, mg.mergeCommit, w.head de persistMergeRisks e persistMergeEffects e rr.headSha normalizados por fullRef"
      ],
      "consumes": [],
      "covers": ["AC2", "AC4", "C3", "C4", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 250000 caracteres LF)" },
        { "cmd": "node --test \"tools/**/*.test.mjs\"", "expect": "exit 0 (literais do arnês intactos)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Implementador recebe o worktree absoluto e a regra de caminhos",
      "deps": [2],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/implementer.md",
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["buildImplPrompt abre com WORKING DIRECTORY e o worktree absoluto; implementer.md com a seção Working directory e || proibido"],
      "consumes": [],
      "covers": ["AC3", "AC4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 250000 caracteres LF)" },
        { "cmd": "node --test \"tools/**/*.test.mjs\"", "expect": "exit 0 (literais do arnês intactos)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Gates",
      "deps": [1, 2, 3],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só roda os gates; não muda arquivo" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1 completo)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs", "expect": "exit 0 (totais relatados)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC4",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/size.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R10",
      "question": "Em que ordem e com que dependências as tarefas rodam?",
      "decision": "Quatro tarefas: coordinator, referências de SHA no release, diretório de trabalho do implementador e gates; T1 e T2 têm arquivos disjuntos; T3 depende de T2 (mesmo roadmap-release.js); T4 depende das três.",
      "basis": "Spec, seção Deixado para o plano; limite de quatro arquivos por tarefa; plan-tool recusa duas tarefas da mesma onda escrevendo o mesmo arquivo.",
      "alternative": "Uma tarefa só para as duas mudanças de roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Como o arnês de flow.test.mjs convive com fullRef?",
      "decision": "Na T2, antes de mudar o script, targetHead 'abc1234' e mergeCommit 'e1' do arnês passam a FULL(...) (o mesmo padEnd(40, '0') de gm), com a suíte verde; só depois entram os testes 2.0.1 AC2 e a mudança do script.",
      "basis": "Com fullRef os SHAs curtos param o preflight e desfazem o merge; o prefixo de gateShaMatch faz a troca ser neutra antes da mudança.",
      "alternative": "Aceitar SHA curto em fullRef quando casa por prefixo com a medida.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Que gates roda a tarefa final?",
      "decision": "G1 completo do CLAUDE.md (plugins, hooks e tools), os dois testes de tamanho, G2, G3 e G5, sem arquivo nem commit (noCommit).",
      "basis": "Pedido do orquestrador; CLAUDE.md (No CI); o G1 completo confere os literais do arnês em tools/.",
      "alternative": "G1 restrito às suítes dos dois workflows.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
