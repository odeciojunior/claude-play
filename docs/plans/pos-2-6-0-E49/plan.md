# Plano E49 -- Base inválida antes da descoberta com alvo explícito

Pré-condição: o merge do E48 já está commitado em `release/pos-2.6.0` (sem `MERGE_HEAD`), com o G1 do merge passado e a contagem registrada em `docs/plans/roadmap-pos-2-6-0/log.md`. Só então commitar este plano e criar o worktree a partir de `release/pos-2.6.0`, antes da Tarefa 1 (`git -C D:/projects/claude-play worktree add -b plan/pos-2-6-0-E49 D:/projects/claude-play-wt/pos-2-6-0-E49 release/pos-2.6.0`).

Spec: `docs/plans/pos-2-6-0-E49/spec.md`. Cobre REQ-013 (#8), com as decisões DEC-004, DEC-007, DEC-008, DEC-018, DEC-021, DEC-036 e DEC-037. Detalhe técnico: tarefa A4 de `docs/plans/2026-11-25-correcoes-issues-plan.md`, reduzida pela DEC-018. Branch `plan/pos-2-6-0-E49`, no worktree `D:/projects/claude-play-wt/pos-2-6-0-E49`, com merge em `release/pos-2.6.0` depois da conferência, com revisão T2 (risco alto). Todos os caminhos abaixo são relativos à raiz do repositório, e todo comando e todo check rodam com o diretório atual na raiz desse worktree (rodados em outro checkout, testam outro código e dão verde falso).

O código foi lido com o merge do E48 aplicado na árvore de `release/pos-2.6.0`. Os trechos são citados por símbolo, não por número de linha.

Duas tarefas em sequência: a medida antecipada no workflow com os testes, e as frases do `operator.md`. Um commit por tarefa, feito pelo coordinator depois dos checks: o executor não commita, e nenhum check roda depois do commit.

O ruling R2 substitui a exigência da spec (seção "Fora" e ruling R10 da spec) de levar a linha `paridade agy: pendente #13` nos commits que tocam o `roadmap-release.js`: os commits de tarefa usam o assunto do coordinator e não precisam de corpo; a linha vai obrigatoriamente no commit de merge.

## Testes: o que roda e quando

- Piso do G1: a contagem do merge do E48 registrada em `docs/plans/roadmap-pos-2-6-0/log.md`, nunca abaixo de tests 2736 e pass 2734, com exit 0 e fail 0.
- DEC-036: nenhum check de tarefa inclui `roadmap-release-agy.test.mjs`, `run-batch.test.mjs`, `make-scenario.test.mjs` nem o G1 completo.
- O gate de onda é do coordinator, depois de cada onda, e não é repetido nos checks: `node --test "plugins/**/!(roadmap-release-agy).test.mjs" ".claude/hooks/*.test.mjs" "tools/**/!(run-batch|make-scenario).test.mjs"`.
- Cada check precisa terminar com folga abaixo de 600 s.
- DEC-037: falha isolada do teste de processos "... ended by its own port kill, with its subtree" (`verify-run.test.mjs`) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.
- Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree. Não rodar suíte enquanto outra execução de testes corre em outro worktree.

## Medida de tamanho

Antes e depois da Tarefa 1, medir os caracteres LF do `roadmap-release.js` e informar os dois números no resumo da tarefa:

```
node -e "const n=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length;console.log(n)"
```

A partida medida na escrita do plano é 272.367. O teto do E49 é de 6.000 caracteres LF de delta líquido (DEC-007, DEC-018, R8 da spec) entre o commit anterior à Tarefa 1 e o resultado da tarefa. Entre 6.000 e 7.200, o executor enxuga até caber no teto e não marca a tarefa como pronta antes disso; o primeiro corte é encurtar o prompt do agente antecipado, remetendo ao texto de `measureTxt` e ao passo 2 do `preflight`, sem perder nenhuma condição de `skipped`. Acima de 7.200, parar e voltar ao dono via subagente opus (DEC-007, DEC-021): se não couber, o E49 sai e a #8 fica aberta com a causa mitigada (DEC-018). A trava de 284.500 não muda. A estimativa da spec é de 2.700 a 3.700.

O check de tamanho compara o arquivo do worktree com a versão mais nova do histórico que ainda não tem a marca `preflight-early`, então vale antes do commit e também com commits de correção.

## Tarefas

### Tarefa 1: Medida antecipada da base no workflow

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

#### Subida sem mudança de corpo

Um bloco novo fica depois de `readBack` (portanto depois de `RUN_TAG`, `runPrompt` e `S_RUN`) e antes do comentário da leitura da descoberta, de `discCmd` e do `readSlices` do rótulo `discovery`. Sobem para o começo dele, sem mudar o corpo:

- `MIN_BUDGET` (mesmo valor e mesmo padrão por modo);
- `WT` (sai do grupo de `TODAY` e `REPO`);
- `gateDesc`, `gateNonce`, `gateTask`, `measureTxt` e `rereadMeasure`, cada um com o comentário que o acompanha.

`gatesTxt` continua no briefing. O cabeçalho de seção `preflight` e o `phase('Preflight')` continuam no lugar. Conferir que nada que esses símbolos usam fica em zona morta: `BEFORE_EVIDENCE`, `GATES`, `INSTALL`, `SETUP_CMDS`, `PRE_TARGET`, `S_RUN` e `runPrompt` são constantes declaradas antes do bloco; `lockList` é do bloco puro; `pluginRootOf`, `shq`, `capturedMeasure`, `gateResult` e `isOwnWorktree` são funções; `agent` é do runtime. Nenhum prompt de hoje muda por causa da subida.

#### Símbolos novos

- `lowBudget()`: a condição de orçamento de hoje (`budget` definido, com `budget.total`, e `budget.remaining()` abaixo de `MIN_BUDGET`). Substitui as duas checagens que comparam com `MIN_BUDGET` (a de antes do briefing, que continua no mesmo lugar com a mesma mensagem, e a do agendamento por entregável, `token budget too low`). A checagem de 80000 do estágio de merge não muda.
- `S_EARLY = { ...S_MEASURE, properties: { ...S_MEASURE.properties, skipped: BOOL, integrationWorktree: STR }, required: ['skipped'] }`, junto dos schemas.
- `rereadPreflight(m, dir)`: a chamada de `rereadMeasure` do preflight de hoje (`GATES`, nonces `gateNonce('preflight', i)`, task `preflight-gates`, rótulo `preflight`, fase `Preflight`). Usada pela medida antecipada e pelo ramo `pre.baseline`.
- `opInvalidBaseline(m, expectedSha)`: o `op('preflight:baseline-invalid', ...)` de hoje, com a mesma frase (`measureProblems(m, expectedSha, GATES)`), o mesmo `doNow` e `{ ...A }`. Usada pelas duas paradas.
- `EARLY_ON = MODE === 'run' && !!PRE_TARGET && !!A.repo && !lowBudget()`, com `!lowBudget()` como último operando.
- `EARLY`: a medida antecipada aceita, ou nula.

#### Agente antecipado e parada

Só sob `EARLY_ON`: uma chamada `agent()` com rótulo `preflight-early`, `phase: 'Preflight'`, `schema: S_EARLY`, `model: 'sonnet'`, `effort: 'medium'`, antes de qualquer chamada da descoberta, com este texto (as expressões entre `${}` são os símbolos do arquivo):

```
EARLY BASELINE (once per run, before the discovery; run token ${RUN_TOKEN}). You HOLD every lock.
Rules: fix nothing; git history is read-only (nothing is recorded, merged or pushed, and no branch is created, moved or switched; the only git write allowed is the worktree add of step 2); never perform an external effect; asking the user is FORBIDDEN (do not use AskUserQuestion); temporary files only in ${WT}/_tmp/preflight-early/; stop every process you started before returning.
When a step says skipped=true, return only that and do nothing else.
1. If git -C "${A.repo}" rev-parse --verify --quiet ${shq('refs/heads/' + PRE_TARGET)} fails: skipped=true.
2. Integration worktree: if git -C "${A.repo}" worktree list already shows ${PRE_TARGET}, that is its path; otherwise git -C "${A.repo}" worktree add "${WT}/_integracao" ${shq(PRE_TARGET)}. skipped=true if the path is not ${WT}/_integracao (the person's own checkout, authorized or not: touch nothing in it), if a command of this step fails, if a merge is in progress (git rev-parse -q --verify MERGE_HEAD succeeds there) or if git status --porcelain is not empty there (do not abort or clean anything). Never remove, move or recreate a worktree.
3. In the integration worktree (the path of step 2), in this order: {SETUP}record clean (git status --porcelain empty) and headSha (the full output of git rev-parse HEAD, 40 hex); install{INSTALL}; measure every gate. ${measureTxt(GATES, i => gateNonce('preflight', i), '"<integration worktree>"', 'preflight-gates')}
Return skipped=false, integrationWorktree, headSha, clean, gates.
PROJECT:
${PROJECT}
```

- `{SETUP}`: com `SETUP_CMDS`, o texto `environment setup, in order: ` seguido dos comandos entre aspas separados por `; ` (como no passo 3 do `preflight`), mais `; if one fails, skipped=true. Then `; sem eles, vazio.
- `{INSTALL}`: ` (${INSTALL})`, ou ` (nothing to install)`.
- O texto fixo do prompt não pode conter `commit`, `merge --abort` nem `branch ` seguido do nome do alvo (o teste de AC1 confere).

Depois da chamada: só uma resposta com `skipped === false` e `isOwnWorktree(integrationWorktree, WT)` verdadeiro conta. Agente nulo, `{}`, `skipped: true` ou worktree de fora são tratados como não medidos: nada para e a execução segue a ordem atual. Da resposta que conta saem `skipped` e `integrationWorktree`: só os campos da medida passam por `rereadPreflight(medida, resposta.integrationWorktree)` e viram `EARLY`, para o `prep` do `run.json` não engordar com os dois (o `recordCmd` descarta o `prep` quando o comando passa de `CMD_CAP`). Se `validMeasure(EARLY, null, GATES)` falha, `opInvalidBaseline(EARLY, null)` e `return mkResult('needs-operator')`, com `selection` nulo, sem nenhuma chamada `discovery`, `discovery-donot` ou `preflight`. A base vermelha não para aqui: `preflight:red-baseline` continua depois do `preflight`.

#### Prompt e baseline do preflight

- Com `EARLY`, os passos 3 e 4 do prompt do `preflight` viram `(skip: the gates were measured before the discovery)` e a linha `Return` não pede `recorded` nem `baseline`, como no plan-only. Em plan-only o texto continua `(skip)`. O cabeçalho `You HOLD every lock.` não muda. Sem `EARLY`, o prompt fica idêntico ao de hoje.
- Logo depois do agente, uma cadeia `if / else if / else if`: primeiro `pre && EARLY` (então `pre.baseline = EARLY`), depois os dois ramos de hoje (`pre.recorded` com `recordedBaseline`; `pre.baseline` relido por `rereadPreflight(pre.baseline, pre.integrationWorktree)`), com as mesmas condições. Com `EARLY`, o `recorded` e a `baseline` devolvidos pelo `preflight` são ignorados.
- O `validMeasure(pre.baseline, pre.targetHead, GATES)` de hoje confere a medida antecipada contra o `targetHead` do `preflight`, e a parada usa `opInvalidBaseline(pre.baseline, pre.targetHead)`.
- `S_PRE`, `BASE`, `isRedBaseline`, `foreignRule`, o registro `prep` e o resto da execução não mudam.

#### Comentários

- Cabeçalho ARGS, item `runToken`: `runToken: new on each preflight; in the first agent call (the early measure when it runs, then the discovery read), so a resume with resumeFromRunId reruns everything live; never returned in resumeArgs/resumeWith. Without it no authorized external task is launched` (quebrado em linhas no recuo de hoje).
- Cabeçalho ARGS, linha `targetBranch`: acrescentar no fim `; with it or config.releaseBranch, plus repo, a run measures the gates before the discovery`.
- Comentário acima de `const { runToken: RUN_TOKEN_ARG, ...A }`: o trecho `the token, in the discovery read (the first agent call), makes every call differ` passa a `the token, in the first agent call (the early measure when it runs, then the discovery read), makes every call differ`.
- Comentário da leitura da descoberta: a linha `The run token is the nonce of slice 0, in the FIRST agent() call, ...` passa a `The run token is in the first agent call (the early measure when it runs, then the discovery read) and is the nonce of slice 0, so on a resume nothing comes from the cache.`

#### Testes em `flow.test.mjs`

Única mudança no `exec()`: o `answerRaw` ganha a resposta padrão `{ skipped: true }` para o rótulo `preflight-early`. Nenhuma asserção de hoje muda e nenhum teste é apagado ou afrouxado (DEC-004); o teste `I3: args.repo wins over the discovered repo and stands in for it` e os de `runToken` e retomada passam sem ajuste.

Auxiliar local para a resposta antecipada: `earlyOf(measure, dir = '/wt/_integracao')`, que devolve `{ skipped: false, integrationWorktree: dir, ...measure }` (os campos da medida no nível de cima, para o `withCapture` montar as linhas de captura). Em todo caso que mede antes da descoberta (AC1 (a) a (e), (g), (i) e (j), e retomada (a) a (c)), a resposta de `preflight-early` é `earlyOf(<medida>)`, por exemplo `earlyOf(unreadable(gm('abc1234')))` ou `earlyOf(miscopied(p, gm('abc1234')))`. Uma medida sem `skipped: false` é tratada como não medida (C5): não mude o workflow para aceitá-la. Os casos (f) e (h) de AC1 só conferem rótulo e prompt e ficam com a resposta padrão do mock. Todos os casos que antecipam usam `args: { repo: '/r' }` com o `targetBranch` padrão do `exec()`, salvo (f) e (j) de AC1, que dizem os próprios args. As regex aceitam valores com e sem aspas (`shq`).

`E49 AC1: ...`

- (a) `preflight-early` devolve `earlyOf(unreadable(gm('abc1234')))` e as releituras recebem a recusa padrão do mock: `needs-operator`; `invalidBaseline(r)` com `gate lint missing from the measure`; `labels[0] === 'preflight-early'`; nenhum rótulo que case `isDisc`, nenhum `discovery-donot`, nenhum rótulo exatamente igual a `preflight`; `r.selection === null`; o prompt antecipado não casa `merge --abort`, `branch integracao/x` nem `commit`, e traz `/wt/_tmp/preflight-early/`, `Never remove, move or recreate a worktree`, `rev-parse --verify --quiet` com `refs/heads/integracao/x` e a linha de captura de cada portão (`CAP_LINE`) com a task `preflight-gates`; `model` `sonnet`, `effort` `medium`, fase `Preflight`.
- (b) portão `tests` incoerente (`gm('abc1234', { exit: 1, failedNames: [] })`): a mesma parada, com `gate unit: exit 1 disagrees with its failing names`, sem descoberta.
- (c) cópia errada (`miscopied`) com releitura certa (`reread`): sem parada, o entregável integra, há `preflight:reread-g0` e `preflight:reread-g1` antes da descoberta e o `preflight` não relê.
- (d) medida antecipada válida, e o mock do `preflight` devolvendo uma `baseline` inválida e também `recorded`: integra; nenhum `preflight:reread-g<i>`; o prompt do `preflight` não tem linha `CAP_LINE` nem `run-record.mjs" baseline`, traz `(skip: the gates were measured before the discovery)` e a linha `Return` não cita `recorded` nem `baseline`; a ordem é `preflight-early`, descoberta, `preflight`; o `prep.baseline` do `approve` no prompt `E1:progress` (`payloadOf`) tem o `headSha` da medida antecipada e não tem as chaves `skipped` nem `integrationWorktree`.
- (e) medida antecipada válida com `headSha` diferente do `targetHead` do `preflight`: `preflight:baseline-invalid` depois da descoberta, com `measured at commit` (C2).
- (f) alvo explícito só por `config.releaseBranch` (`args: { targetBranch: undefined, repo: '/r' }`): `labels[0] === 'preflight-early'`.
- (g) medida antecipada válida com `lint` em exit 1: a descoberta e o `preflight` rodam e a parada é `preflight:red-baseline`, sem `preflight:baseline-invalid`.
- (h) com `setup` no config, o prompt antecipado traz o comando de setup e `if one fails, skipped=true`.
- (i) medida antecipada válida e seleção vazia (o card pedido já integrado no alvo): o resultado `partial` de hoje, sem chamada `preflight` (C4).
- (j) C3: `args: { repo: '/r', targetBranch: 'main' }` (o `integrationBranch` do mock). Com `earlyOf(gm('abc1234'))`: `labels[0] === 'preflight-early'`, `r.status === 'error'` com `/integrationBranch/`, a descoberta rodou e não houve chamada `preflight`. Com `earlyOf(unreadable(gm('abc1234')))`: `needs-operator` com `invalidBaseline(r)` e nenhum rótulo que case `isDisc`.

`E49 AC2: ...`

- (a) `mode: 'dry-run'` com `repo` e `targetBranch`: nenhum `preflight-early`; `calls[0]` é a descoberta (`preflight.mjs" discover`) e nenhum prompt traz `capture.mjs" run`.
- (b) `targetBranch: undefined`, config sem `releaseBranch`, `repo` presente: nenhum `preflight-early`, e o prompt do `preflight` traz as linhas `CAP_LINE` do passo 4.
- (c) `mode: 'plan-only'` com `repo` e `targetBranch`: nenhum `preflight-early`.
- (d) orçamento `{ total: 1e9, remaining: () => 0 }` com `repo` e `targetBranch`: nenhum `preflight-early`, a descoberta roda e o resultado é `partial` com `remaining budget`.
- (e) `preflight-early` devolve `{ skipped: true }`, `null`, `{}` ou `earlyOf(gm('abc1234'), '/r')`: em cada um a execução integra, o `preflight` mede (linhas `CAP_LINE` no prompt) e não há releitura da medida descartada (C1, C5).
- (f) sem `repo` (o `exec()` padrão): nenhum `preflight-early`.

`E49 retomada: ...`, com `makeJournal()`:

- (a) execução 1 com `runToken: 'pf-1'` e `repo`, medida antecipada válida, morta em `discovery`; execução 2 com `runToken: 'pf-2'` e o mesmo journal: `cached` vazio, `preflight-early` roda ao vivo e o prompt dele traz `pf-2` e não `pf-1`.
- (b) com antecipação: `labels[0] === 'preflight-early'` e o prompt traz `pf-test`; a primeira chamada `discovery` tem `--nonce` igual a `pf-test`; nenhuma chamada depois dela traz `pf-test`.
- (c) a parada antecipada devolve `resumeArgs` e `resumeWith` sem `runToken`; uma segunda execução com esse `resumeWith` mais `runToken: 'pf-2'` e o mesmo journal mede de novo ao vivo (`cached` vazio).

Passos:

1. Medir o tamanho do `roadmap-release.js` rodando o check de tamanho desta tarefa (o `node -e` dos checks que compara com a versão sem a marca `preflight-early`): ele já imprime o tamanho e o delta (antes da mudança, delta 0).
2. Teste primeiro, em `flow.test.mjs` (mock padrão, auxiliar e casos novos); rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e ver falhar os casos que esperam `preflight-early`. Os casos de AC2 que só afirmam a ausência dele passam antes da mudança: são o comportamento a preservar.
3. Fazer a subida dos símbolos e ver os testes de hoje passando.
4. Implementar o agente antecipado, a parada, as condicionais do `preflight` e os comentários; ver o arquivo de teste passar.
5. Rodar o mesmo check de tamanho de novo e informar no resumo os dois tamanhos e o delta (teto de 6.000; entre 6.000 e 7.200, enxugar até o teto; parada acima de 7.200).
6. Rodar os checks da tarefa. O commit é do coordinator, depois deles, só com os arquivos da tarefa.

### Tarefa 2: Docs da medida antecipada

Arquivos: mudar `plugins/productivity-tools/skills/roadmap-release/references/operator.md`. Cada frase fica numa linha só, literal.

Na tabela de `## Action kinds`, a linha `preflight:baseline-invalid` passa a:

> | `preflight:baseline-invalid` | The baseline measure was unusable. With an explicit target and `repo`, a `run` measures the gates before the discovery, so this stop can come before any discovery agent. | Fix the environment and run again. |

Em `## Resuming a run`, a frase "A resume skips ..." passa a:

> A resume skips the spec, plan and final reviews whose values are those of `run.json`, and reuses the gate measurements when the target is unchanged, except in a run that measures before the discovery (explicit target and `repo`), which measures every gate again.

Em `## Known limits`, no fim do parágrafo que começa por "A resume never uses the Workflow cache" (mesma linha, sem mudar o que já está escrito):

> With an explicit target (`args.targetBranch`, or `releaseBranch` in `release.config.json`) and `repo`, a `run` measures the gates before the discovery, and that measure does not reuse the baseline in `run.json`: such a resume measures every gate again. The `releaseBranch` of `roadmap.config.json` arrives through the discovery, so pass `targetBranch` to measure before it. Nothing is measured early, and the run works as described above, when the target branch does not exist, its worktree is not the run's own `_integracao`, a git or setup command fails, a merge is in progress, the tree is dirty or the token budget is below the minimum.

Os testes que leem o `operator.md` são `docs.test.mjs`, `flow.test.mjs` e `prompts.test.mjs`; `copy-budget.test.mjs`, `encoding.test.mjs` e `independence.test.mjs` varrem os arquivos do plugin.

Passos:

1. Editar o arquivo.
2. Rodar os checks da tarefa. O commit é do coordinator, depois deles, só com o arquivo da tarefa.

## Fechamento

- Conferir AC1 e AC2 na branch, com revisão T2 (risco alto).
- Antes do merge e no merge, o G1 completo é do orquestrador, pelo Git Bash, com o worktree parado e sem outra execução de testes correndo: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`. Ele inclui `roadmap-release-agy.test.mjs`, `run-batch.test.mjs` e `make-scenario.test.mjs`. Se o teste do agy falhar por causa do workflow, não editar o `roadmap-release-agy.py` (DEC-008): voltar a decisão ao dono via subagente opus.
- Merge de `plan/pos-2-6-0-E49` em `release/pos-2.6.0` depois da conferência. O corpo do commit de merge leva obrigatoriamente a linha `paridade agy: pendente #13`.
- No merge, o G1 completo na árvore do merge: exit 0, `fail 0`, `tests` e `pass` não menores que os do merge do E48 em `log.md` (nunca abaixo de 2736 e 2734). Com falha, desfazer o merge (rollback), salvo a exceção da DEC-037 descrita acima.
- Pronto: AC1 e AC2 verdes em `release/pos-2.6.0`; G1 no piso ou acima; lint do plugin sem FAIL; `claude plugin validate .` válido; `roadmap-release.js` dentro do teto da tarefa e da trava de 284.500. G5 não se aplica (sem `lib/`).
- Item para o registro do entregável, feito por quem integra, pela CLI do tracker (este plano não edita o roadmap): checklist "paridade agy: pendente #13".
- Sem bump de versão, push, tag ou comentário em issue.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E49",
  "title": "Base inválida antes da descoberta com alvo explícito",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-6-0/",
  "constraints": [
    "Pré-condição: o merge do E48 já está commitado em release/pos-2.6.0 (sem MERGE_HEAD), com o G1 do merge passado e a contagem registrada em log.md. Só então commitar este plano e criar o worktree a partir de release/pos-2.6.0, antes da Tarefa 1.",
    "Trabalhar só no worktree D:/projects/claude-play-wt/pos-2-6-0-E49, branch plan/pos-2-6-0-E49; merge em release/pos-2.6.0 depois da conferência, com revisão T2 (risco alto). Todo comando e check roda com o diretório atual na raiz desse worktree.",
    "Cada tarefa edita no máximo 4 arquivos e tem um commit com só os arquivos da própria tarefa, feito pelo coordinator depois dos checks; nenhum check roda depois do commit.",
    "Nenhum check de tarefa inclui roadmap-release-agy.test.mjs, run-batch.test.mjs, make-scenario.test.mjs nem o G1 completo; check por diretório usa o padrão !(roadmap-release-agy).test.mjs. Esses três arquivos e o G1 completo são do orquestrador no merge, na árvore do merge, com rollback (DEC-036).",
    "Piso do G1: a contagem do merge do E48 registrada em docs/plans/roadmap-pos-2-6-0/log.md, nunca abaixo de tests 2736 e pass 2734, com exit 0 e fail 0.",
    "Cada check termina com folga abaixo de 600 s. O comando do gate de onda é do coordinator e não é repetido nos checks.",
    "DEC-037: falha isolada do teste de processos '... ended by its own port kill, with its subtree' (verify-run.test.mjs) num gate de onda ou no G1: uma nova rodada, com registro no log. Duas falhas seguidas no mesmo gate, ou três no roadmap, param e vão ao dono via subagente opus. Qualquer outra falha segue a parada normal ou o rollback.",
    "Nenhum commit, de nenhuma sessão, enquanto uma suíte roda no mesmo worktree; nenhuma suíte enquanto outra execução de testes corre em outro worktree.",
    "roadmap-release.js: delta líquido de no máximo 6000 caracteres LF na Tarefa 1; entre 6000 e 7200, enxugar até o teto; acima de 7200, parar e voltar ao dono via subagente opus (DEC-007, DEC-018, DEC-021, R8 da spec); trava de 284500 mantida.",
    "Antecipar só em mode run, com alvo explícito (args.targetBranch ou config.releaseBranch), args.repo presente e orçamento não abaixo de MIN_BUDGET; nunca em dry-run, plan-only ou com alvo derivado da descoberta (DEC-018). Numa execução com medida antecipada válida, a base não é medida duas vezes.",
    "O agente antecipado só mede no worktree próprio _integracao: não aborta merge, não limpa, não commita, não cria branch e nunca remove, move ou recria worktree. O checkout da pessoa fica com o preflight.",
    "Fora: cache de base fora do run.json, mode baseline-only, antecipar preflight:red-baseline, scripts/preflight.mjs, scripts/run-record.mjs, lib/, blocos embutidos, e o que E46, E47 e E48 mudaram (selectDeliverables com explain, shq, ramo finish-merge, MAXPAR e withoutApprove).",
    "Paridade agy: pendente #13. Não tocar em workflow/roadmap-release-agy.py nem no teste dele (DEC-008); o commit de merge leva no corpo a linha 'paridade agy: pendente #13' (pelo R2, os commits de tarefa usam o assunto do coordinator e não precisam dela).",
    "Não apagar nem afrouxar teste existente (DEC-004), em especial os de runToken e de retomada; no exec() só entra a resposta padrão { skipped: true } para preflight-early. Não escrever .skip, .only, .todo ou skipIf em linhas novas ou alteradas de teste.",
    "Não escrever o número do limite de cópia em nenhum arquivo do plugin fora de lib/plan-digest.mjs; usar MAX_COPY_BYTES se precisar.",
    "Citar símbolos, nunca depender de número de linha do roadmap-release.js.",
    "Não editar nada em docs/plans/roadmap-pos-2-6-0/.",
    "Sem bump de versão, push, tag ou comentário em issue."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Medida antecipada da base no workflow",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "produces": [
        "agente preflight-early (S_EARLY) sob EARLY_ON: medida inválida para com preflight:baseline-invalid antes da descoberta; medida válida vira pre.baseline e o preflight pula os passos 3 e 4"
      ],
      "consumes": [],
      "covers": [
        "AC1",
        "AC2",
        "C1",
        "C2",
        "C3",
        "C4",
        "C5"
      ],
      "testFirst": true,
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 2,
        "blast": 2,
        "verifiability": 0
      },
      "checks": [
        {
          "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/workflow/!(roadmap-release-agy).test.mjs\"",
          "expect": "exit 0 (o roadmap-release-agy.test.mjs é do orquestrador no merge, DEC-036)"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs plugins/productivity-tools/scripts/agy-bridge.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test tools/measure/checkpoint.test.mjs tools/measure/review-loop.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node -e \"const c=require('child_process'),f='plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js',len=s=>s.split(String.fromCharCode(13,10)).join(String.fromCharCode(10)).length,git=a=>c.execFileSync('git',a,{encoding:'utf8',maxBuffer:67108864}),show=r=>git(['show',r+':'+f]),rev=git(['rev-list','HEAD','--',f]).split(String.fromCharCode(10)).filter(Boolean).find(r=>show(r).indexOf('preflight-early')<0),now=len(require('fs').readFileSync(f,'utf8')),d=now-len(show(rev));console.log(now,d);process.exit(d<=6000&&now<=284500?0:1)\"",
          "expect": "exit 0, com o tamanho e o delta impressos (delta de no máximo 6000 e tamanho de no máximo 284500)"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    },
    {
      "n": 2,
      "title": "Docs da medida antecipada",
      "deps": [
        1
      ],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/references/operator.md"
        ],
        "test": []
      },
      "writes": [],
      "produces": [],
      "consumes": [
        {
          "task": 1,
          "sig": "agente preflight-early (S_EARLY) sob EARLY_ON: medida inválida para com preflight:baseline-invalid antes da descoberta; medida válida vira pre.baseline e o preflight pula os passos 3 e 4"
        }
      ],
      "covers": [
        "AC1",
        "AC2"
      ],
      "testFirst": {
        "exempt": "só documentação: frases no operator.md, conferidas por um check de texto"
      },
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false,
      "score": {
        "ambiguity": 0,
        "reasoning": 0,
        "blast": 1,
        "verifiability": 1
      },
      "checks": [
        {
          "cmd": "node -e \"const t=require('fs').readFileSync('plugins/productivity-tools/skills/roadmap-release/references/operator.md','utf8').split(String.fromCharCode(10)),line=s=>t.find(l=>l.startsWith(s))||'',row=t.find(l=>l.startsWith('|')&&l.includes('preflight:baseline-invalid'))||'',a=line('A resume skips'),b=line('A resume never uses the Workflow cache'),has=(s,x)=>x.every(y=>s.includes(y));process.exit(has(row,['before the discovery'])&&has(a,['except in a run that measures before the discovery'])&&has(b,['that measure does not reuse the baseline','arrives through the discovery','Nothing is measured early'])?0:1)\"",
          "expect": "exit 0"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs plugins/productivity-tools/scripts/encoding.test.mjs plugins/productivity-tools/scripts/independence.test.mjs",
          "expect": "exit 0"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0, sem FAIL"
        }
      ]
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Qual é o texto do prompt de preflight-early e que regras ele leva?",
      "decision": "O texto literal da Tarefa 1, com as regras mínimas da spec (não corrigir, sem escrever histórico nem mexer em branch, sem perguntar, You HOLD every lock, temporários em _tmp/preflight-early/), mais a proibição de efeito externo, a ordem de parar os processos iniciados e o bloco PROJECT; as regras evitam a palavra commit.",
      "basis": "A spec deixou o texto exato ao plano e lista as regras como mínimas. A medida de hoje roda com a proibição de efeito externo, a regra de processos e o bloco PROJECT, nenhum dos três depende da descoberta, e a medida antecipada passa a ser a base da execução. O teste de AC1 da spec exige que o prompt não contenha commit.",
      "alternative": "Levar só as regras listadas na spec, sem PROJECT.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "A linha 'paridade agy: pendente #13' vai no corpo dos commits de tarefa, como diz a spec?",
      "decision": "Não é exigida nos commits de tarefa; é obrigatória no corpo do commit de merge. Este ruling substitui a exigência da spec (seção Fora e ruling R10 da spec) para os commits de tarefa: um commit de tarefa sem a linha não é divergência.",
      "basis": "A instrução do chamador deste plano: o coordinator usa assuntos próprios nos commits de tarefa; o commit de merge preserva o registro da paridade pedido pela DEC-008.",
      "alternative": "Exigir corpo de commit na Tarefa 1.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Como dividir o trabalho e conferir o tamanho?",
      "decision": "Duas tarefas em cadeia, workflow com testes (2 arquivos) e operator.md (1 arquivo); a Tarefa 1 roda o diretório do workflow sem o agy e os testes que leem o roadmap-release.js, a Tarefa 2 os testes que leem os docs; o delta é medido contra a última versão do histórico sem a marca preflight-early.",
      "basis": "Segue a spec, o limite de 4 arquivos, a DEC-036 e o padrão de check de delta do plano do E48; a marca não existia no arquivo na escrita do plano.",
      "alternative": "Uma tarefa única com os três arquivos.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "Quais nomes e quais casos de teste além dos listados na spec?",
      "decision": "Auxiliares rereadPreflight e opInvalidBaseline no workflow e earlyOf no teste; casos extras para alvo só por config.releaseBranch, base vermelha antecipada que para só depois do preflight, setup no prompt antecipado, seleção vazia (C4) e alvo igual ao integrationBranch (C3).",
      "basis": "A spec pede um auxiliar comum aos dois pontos sem fixar nomes; os casos extras provam os rulings R1, R3 e R4 da spec e as bordas C3 e C4, que a lista de testes dela não cobre.",
      "alternative": "Só os casos listados na spec.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "Que campos da resposta antecipada viram pre.baseline?",
      "decision": "Só os campos da medida: skipped e integrationWorktree saem antes da releitura, que recebe o integrationWorktree como diretório; EARLY continua sendo o valor atribuído a pre.baseline, e o AC1 (d) confere o prep do approve.",
      "basis": "O registro prep leva pre.baseline para o run.json num comando limitado por CMD_CAP, e o recordCmd descarta o prep acima dele; validMeasure e measureProblems não leem os dois campos, e a atribuição pre.baseline = EARLY da spec se mantém.",
      "alternative": "Guardar a resposta inteira em pre.baseline.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "removedTests": []
}
```
