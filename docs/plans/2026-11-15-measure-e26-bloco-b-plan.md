# E26, bloco B do arnês: plano de implementação

**Roadmap:** docs/plans/roadmap-evolucao-skills
**Spec:** docs/plans/2026-11-15-measure-e26-bloco-b-design.md (revisão 2, DEC-732 a DEC-737 ratificadas). Branch `fix/measure-e26-b`, worktree `D:/projects/claude-play-wt/measure-e26-b`.

Plano do bloco A: não existe (só `2026-11-14-measure-e26-bloco-a-design.md`); o formato abaixo segue o das tarefas da spec.

## Regras do bloco

- Só `tools/measure/`. Nunca editar `plugins/` (só leitura: `roadmap-release.js`, `scripts/review-package.mjs`). Sem bump, sem `claude -p`, sem lote pago.
- DEC-736: 6 arquivos fora os testes no bloco inteiro: `run-batch.mjs`, `make-scenario.mjs`, `defects/manifest.json`, `defects/sentinels/fix.mjs` (novo), `arms/final-review-atual.md` (novo), `arms/final-fix-atual.md` (novo). Qualquer 7º arquivo fora os testes, ou tarefa com mais de 4 arquivos: parar e perguntar. Sem módulo novo, sem fixture em arquivo (hashes e fixtures dos testes ficam inline nos `*.test.mjs`).
- Testes do bloco: `run-batch.test.mjs`, `review-loop.test.mjs`, `make-scenario.test.mjs`, `checkpoint.test.mjs`. `checkpoint.mjs` fica intacto (o `armStatus` já lista todo `*-atual.md`).
- TDD: em cada tarefa, escrever os testes, vê-los falhar pelo motivo certo, implementar, vê-los passar. Um commit por tarefa (teste e código juntos), salvo o commit `test(measure)` do golden em T2.
- Commits terminam com `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` (o do commit do implementador segue a atribuição da sessão).

## Tier e revisão

| Tarefa | Implementador | Revisor da tarefa (spec) |
|---|---|---|
| T1 | sonnet/medium | opus |
| T2 | sonnet/medium | opus |
| T3 | sonnet/medium | opus |
| T4 | sonnet/medium | sonnet |
| T5 | sonnet/medium | opus |
| T6 | sonnet/medium | opus |
| Portão final da branch | - | opus/high (revisão adversarial, ver abaixo) |

Escalonamento: falhou, repete uma vez no mesmo tier com o feedback do revisor; 2ª falha sobe a opus com agent novo; falha em opus, parar e avisar o dono.

## Comandos de verificação

- Teste focado: `node --test tools/measure/<arquivo>.test.mjs` (a partir da raiz da worktree).
- G1 completo: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.
  - **Linha de base medida em HEAD desta branch (a79999d): 1929 testes, 1929 passando, 0 falhas, 0 canceladas, 0 puladas (102 s).** Depois de cada tarefa o total só pode crescer e `fail` fica 0.
- `claude plugin validate .` (marketplace; deve passar, o bloco não toca plugin). Nenhum `claude plugin validate plugins/<x>` é necessário porque nada em `plugins/` muda.
- Guarda de escopo, antes de cada commit e no portão: `git diff --name-only a79999d..HEAD` só lista caminhos `tools/measure/` e este plano; e a lista de arquivos fora `*.test.mjs` é subconjunto dos 6 de DEC-736.

## Ordem e paralelismo

Arquivos por tarefa (para decidir o que corre junto):

| Tarefa | Arquivos |
|---|---|
| T1 | `make-scenario.mjs`, `defects/manifest.json`, `defects/sentinels/fix.mjs`, `make-scenario.test.mjs` |
| T2 | `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs` |
| T3 | `run-batch.mjs`, `run-batch.test.mjs` |
| T4 | `arms/final-review-atual.md`, `arms/final-fix-atual.md`, `checkpoint.test.mjs`, `run-batch.test.mjs` |
| T5 | `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs` |
| T6 | `run-batch.mjs`, `run-batch.test.mjs` |

Dependências:
- T2 depende de T1 (o `runBatch` chama `makeScenario` de verdade; precisa de `correcao-semeada-*`, `scenario.fixSha`, `fixEntries`).
- T3 depende de T1 e T2 (replay e validade usam `fixSha` e o script de laço de tarefa).
- T4 não depende de código; só do texto de `roadmap-release.js` em HEAD.
- T5 depende de T2 (reaproveita aplicador, `loopResult` parametrizado e recusas por trecho) e de T4 (lê os braços).
- T6 depende de T3 e T5.

Ondas:
1. **Onda 1 em paralelo: T1 e T4.** Nenhum arquivo em comum (T1: make-scenario*, manifest, fix.mjs; T4: arms, checkpoint.test, run-batch.test). Duas worktrees filhas ou dois agentes na mesma worktree com `git add` por caminho; merge sem conflito porque `run-batch.test.mjs` só muda em T4 nesta onda.
2. **Série: T2, depois T3, depois T5, depois T6.** Todas editam `run-batch.mjs` e `run-batch.test.mjs`; não rodam em paralelo.
3. Portão final (opus/high) sobre a branch inteira, depois do G1 verde.

## Ambiguidades da spec resolvidas aqui

1. **Base do seed de `correcao-semeada-*`.** A spec dá `class: 'code', set: 'e5-fix'`, mas `seedVariant` semeia o que `manifestEntries(variant)` devolve, e o filtro `set: 'e5-fix'` só traz CR/CG. Resolução: `SEEDED['correcao-semeada-A'] = { class: 'code', artifact: 'A', set: 'e5-fix', baseSet: 'e5' }`; `seedVariant` semeia o `baseSet` (C1..C4 ou C5..C8) no `seededCommit` e `attemptOutcomes`/`manifestEntries` continuam lendo só o `set` (CR/CG).
2. **Estado limpo da correção.** "Volta T1..T3 ao estado limpo" = recopiar `scenario/e5/code/t1..t3` sobre a árvore e remover do índice os arquivos que só existem por causa de um C (hoje `src/helpers.mjs` de C4). Não há outra cópia limpa.
3. **`scenario.seeded` nas variantes novas.** Fica com os ids C (semântica do `seededCommit`, mantém o gate `scenario.seeded?.length > 0` do `runBatch`); `scenario.fixEntries` traz os ids CR/CG; só estes entram em `outcomes`.
4. **Golden sem fixture em arquivo.** O golden da rodada única de task-review é um sha256 inline do script gerado (`buildReviewOnlyScript` + `harnessPrompts`) com entradas fixas, gravado em T2 antes de qualquer mudança de código. O `dir` fixo é um diretório temporário que contém o plano (`docs/superpowers/plans/2026-01-01-e5-text-utilities.md` com `### Task 3: ...`), senão `harnessPrompts` cai no título `task 3`.
5. **Braços de arnês que não são arquivo.** `--arm restrita` e `--arm adversarial` não têm `*-restrita.md`; `prepareHarness` ganha o campo `h.base` (`'atual'` para `atual`, `restrita` e `adversarial`) e todo teste "é o braço atual" passa a usar `h.base === 'atual'`. Pontos exatos: `prepareHarness` (`current`, `builtIn`), `harnessPrompts` (linha ~827, o ramo `h.arm === 'atual'`), `runBatch` (linhas ~1177 e ~1181: a checagem de `task-reviewer.md` e o ramo que lê o workflow), `assertArmsCurrent` (linha ~568, `h.arm !== 'atual'`); o nome do braço no diretório de saída e no agregado segue `h.arm`.
6. **`fix1` do estágio final.** Sem `--review-model` (o revisor final é fixo opus/high, `FRA`); `--review-model` segue recusado fora de `task-review`.
7. **Rótulo do corretor.** O agregado usa os rótulos `E5:final-review<r>`, `E5:final-verify<r>`, `E5:final-review-fix<k>` (o `STAGES['final-review'].fix` da spec, `final-fix`, só nomeia o arquivo de braço `final-fix-atual.md`); `loopResult` usa `st.label + '-fix' + k`.
8. **Diário de `fix1`, retorno do script e `restricted`.** O aplicador é um agente haiku e tem entrada de diário como os demais (`E5:...-fix1`, `result.checks`). O diário dos subagentes não leva o retorno do script; `runBatch` passa a lê-lo do `tool_result` do `Workflow` no transcript principal (T3, item 4; formato a confirmar na 1ª sonda). `restricted[]` é recalculado no replay (dentro de `review(round, prev, rvModel, was)`, com o `was` de `runReviewLoop`) e o retorno do script é conferência (divergência = `laco-divergente`).

---

## T1. B1: correção semeada (cenário e sementes) (revisor opus)

**Arquivos (4):** `tools/measure/make-scenario.mjs`, `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/fix.mjs` (novo), `tools/measure/make-scenario.test.mjs`.

**Testes primeiro** (`make-scenario.test.mjs`, seção `B1:`; usam `makeScenario` em diretório temporário como os testes de `codigo-semeado-*`):
1. `B1: VARIANTS and SEEDED list correcao-semeada-A and correcao-semeada-B (class code, set e5-fix, baseSet e5)`. Afirma: `artifactOf('correcao-semeada-A')` deep-equal ao objeto; `manifestEntries` devolve só CR1 e CG1 (A) ou CR2 e CG2 (B); `codigo-semeado-A/B` seguem devolvendo C1..C4 / C5..C8.
2. `B1: feat/E5 stays at seededCommit and fixSha is a parentless-of-refs child`. Afirma: `git rev-parse feat/E5 === seededCommit`; `git rev-parse fixSha^ === seededCommit`; `git for-each-ref --contains fixSha` vazio; `git reflog --all` não cita `fixSha` (depois do `reflog expire` do passo i) e `git cat-file -e <fixSha>^{commit}` funciona; `git config gc.auto` é `0`; mensagem do commit `E5 T3: fix review findings`.
3. `B1: the sandbox suite passes at fixSha`. Afirma: `checkout --detach fixSha` + `runSandboxSuite(dir).ok === true`, e a árvore volta a `main` depois (cenário não deixa a sandbox suja).
4. `B1: present is true at fixSha and false at the clean T3 for every CR and CG`. Afirma, por id do artefato: `present(dir, fixSha, id) === true`; num worktree temporário com a árvore limpa (`scenario/e5/code/t1..t3` num commit descartável), `present(...) === false`.
5. `B1: the C sentinels C1..C8 read absent at fixSha, except the C whose sentinel coincides with the residue`. Afirma: para cada C do artefato, `present === false` em `fixSha`; se algum der `true`, o teste registra qual (`assert.deepEqual(coincide, [...])` com a lista esperada medida na 1ª execução) e o relatório do executor a cita.
6. `B1: each artifact has exactly 1 residue and 1 regression in the manifest`. Afirma: entradas `set: 'e5-fix'` por artefato: 1 com `residueOf`, 1 com `introducedBy: 'fix'` sem `residueOf`; todas com `detectedBy: 'reviewer'`, `sentinel: 'sentinels/fix.mjs'`, e `mention` que casa com uma frase-modelo (campo novo, regex em string; o teste compila e testa).
7. `B1: a CR or CG whose anchor the suite flags or present cannot tell is refused with a scenario error`. Afirma: com `runSandboxSuite` injetado para falhar, `makeScenario` lança erro que cita o id e `fixSha`; com sentinel injetado que dá `present` igual nos dois estados, lança erro `indistinguivel`.
8. `B1: legacy variants are unchanged`. Afirma: o script/ árvore de `codigo-semeado-A` (`seededCommit` tree hash via `git rev-parse seededCommit^{tree}`) é igual ao de HEAD (hash inline gravado antes de editar).
9. `B1: CR, CG seeds are anchored on the files the spec names`. Afirma: `seed(dir, 'CR1')` etc. lançam `anchor not found` num arquivo qualquer (a convenção `fail()` dos C), e os ids têm `file` no manifesto.

**Implementação:**
1. `defects/sentinels/fix.mjs`: copia o esqueleto de `C1.mjs` (`atRef`, `probe`, `lf`, `git`, `fail`, `replaceOnce`). Exporta `seed(dir, id)` e `present(dir, ref = 'HEAD', id)` com tabela `{ CR1: {...}, CG1, CR2, CG2 }` (cada entrada: `file`, `apply(text)`, `present(dir)`). `attemptOutcomes` chama `mod.present(scenario.dir, ref, e.id)`, então o `id` chega. Âncoras candidatas da spec:
   - CR1 (A): `tests/e5-word-count.test.mjs` volta a importar `assert` e a afirmar `'the quick fox'`, mas sem asserção para `wordCount('')`. `present`: texto do arquivo inclui `assert` mas não afirma `''` (regex).
   - CG1 (A): `src/index.mjs` deixa de reexportar `truncate`. `present`: `probe(dir, "typeof m.truncate === 'undefined'")` sobre `src/index.mjs`.
   - CR2 (B): `src/truncate.mjs`: `max === 0` lança `RangeError`, `max` negativo devolve `''`. `present`: `probe` com `truncate('abc', -1) === ''`.
   - CG2 (B): `src/word-count.mjs` perde o `trim`. `present`: `probe` com `wordCount('   ') !== 0` (sem `trim`, `'   '.split(/\s+/)` dá 2 elementos vazios, então 2, nunca 0).
   - Regra de troca: âncora acusada pela suíte em `fixSha`, ou que `present` não distingue, vira CR3/CG3 em diante com `replaces: 'CR1'`; a tabela do `fix.mjs` e o manifesto mudam juntos; o executor lista a troca no relatório.
2. `manifest.json`: 4 entradas novas (`id`, `class: 'code'`, `kind`, `artifact`, `set: 'e5-fix'`, `file`, `sentinel: 'sentinels/fix.mjs'`, `detectedBy: 'reviewer'`, `introducedBy: 'fix'`, `residueOf` (CR), `mention`, `description`). As entradas C existentes não mudam.
3. `make-scenario.mjs`:
   - `VARIANTS` (linha 17-20): somar `'correcao-semeada-A'`, `'correcao-semeada-B'`.
   - `SEEDED` (linha ~203): as duas chaves com `baseSet: 'e5'`. `manifestEntries` fica como está (lê `set`); novo helper `baseEntries(variant)` devolve o filtro por `baseSet ?? set`.
   - `seedVariant` (linha ~233): `entries` passa a ser `baseEntries(variant)`; após `const seededCommit = ...` (linha ~260), se `a.baseSet`, chamar `makeFixCommit(dir, variant, seededCommit)`: (a) `copyTree(t1)`, `copyTree(t2)`, `copyTree(t3)` sobre a árvore; `git rm -q -f --ignore-unmatch` dos arquivos que existem só por causa de um C (`src/helpers.mjs`); (b) para cada entrada de `manifestEntries(variant)` (CR/CG): `mod.seed(dir, e.id)`; (c) `git add -A`, `git write-tree`, `git commit-tree <tree> -p <seededCommit> -m "E5 T3: fix review findings"` com `-c user.name=measure -c user.email=measure@example.invalid`; (d) `git reset -q --hard <seededCommit>` (restaura `feat/E5` e a árvore; sem ref nem reflog para `fixSha`); (e) `git config gc.auto 0`; (f) `git checkout -q --detach <fixSha>`, `runSandboxSuite(dir)`; se `!ok` lança `Error('correcao-semeada: a suite acusa a correcao semeada ...')`; (g) verificar por entrada que `present(dir, fixSha, id)` é verdadeiro e que, na árvore limpa de (a) (antes de aplicar seeds, via `checkout` do tree limpo, ou `git stash`-free: gravar também `cleanTree = git write-tree` antes de (b)), `present` é falso, senão lança `indistinguivel`; (h) `git checkout -q feat/E5`; (i) `git reflog expire --expire-unreachable=now --all` (o `checkout --detach` de (f) e o `atRef` do `present` de (g) gravam `fixSha` no reflog de HEAD; com `gc.auto 0` o objeto continua existindo). O `present` chamado depois por `attemptOutcomes` (`atRef` com `fixSha`) volta a gravar no reflog dentro da sandbox descartável; só o estado ao fim do `makeScenario` é o que o teste afirma.
   - Retornar `{ seeded, seededCommit, seededBlobs, fixSha, fixEntries: [ids CR/CG] }`. O `case 'correcao-semeada-A'|'B'` de `makeScenario` copia `codigo-semeado-*`: `Object.assign(scenario, await seedVariant(...))`; `scenario.prompts = [`${RELEASE} run E5`]`; incluir ambas em `RELEASE_RUN_VARIANTS` (linha 54) para o `.claude/settings.local.json` e o `-wt`.
   - `scenario` inicial (linha ~285) ganha `fixSha: null, fixEntries: []`.

**Verificação:** `node --test tools/measure/make-scenario.test.mjs` (esperado: tudo passa, incluindo os testes antigos; pelo menos 9 testes novos). Depois G1 completo (1929 + novos, 0 falhas) e `claude plugin validate .`.

**Commit:** `fix(measure): correcao semeada da sandbox (fixSha sem ref, CR/CG e sentinela fix.mjs)`.

---

## T4. B3: braços do estágio final (revisor sonnet; onda 1, em paralelo com T1)

**Arquivos (4):** `tools/measure/arms/final-review-atual.md` (novo), `tools/measure/arms/final-fix-atual.md` (novo), `tools/measure/checkpoint.test.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro:**
1. (`run-batch.test.mjs`) `B3: final-review-atual.md and final-fix-atual.md match the workflow in HEAD`. Afirma: `readArm(join(here,'arms',f), { requireSource: true })` devolve `source.commit` com 40 hex e `armMatches(arm.text, WF)` verdadeiro, para os dois arquivos, lendo `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`.
2. `B3: a stale final arm is a UsageError`. Afirma: `assertArmsCurrent({ arm: 'atual', base: 'atual', review: arm1, fixArm: arm2, fixCheck: null }, wf.replace('Mode: review, lens:', 'Mode: look, lens:'))` lança `UsageError` com `/review/`; idem trocando `Fix the final review problems below` por `Mend ...` dá `/fix/`.
3. `B3: the final arm placeholders are the ones the harness fills`. Afirma: o texto de `final-review-atual.md` tem `{{lens}}`, `{{wt}}`, `{{TARGET}}`, `{{specPath}}`, `{{planPath}}`, `{{cardRef}}`; `final-fix-atual.md` tem `{{E}}`, `{{lockNote}}`, `{{noSpecEdit}}`, `{{issues}}`; nada além disso.
4. (`checkpoint.test.mjs`) `B3: arm.files lists final-review-atual.md and final-fix-atual.md and both are true; a stale one is false and does not block the plan class`. Afirma, no molde de `E26 A2: arm.files lists every *-atual.md` (linha 244): `names` do diretório inclui os dois; com `readAt` defasado para `final-review-atual.md`, `arm.files['final-review-atual.md'] === false` e `blockReasons` não cita o arquivo (só os braços de plano decidem).

**Implementação:**
1. `final-review-atual.md`: primeira linha `Copied from: plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js at commit <git rev-parse HEAD da branch base, 40 hex>`; corpo literal das linhas 2661-2665 do workflow: `Mode: review, lens: {{lens}}. Diff: git -C "{{wt}}" diff {{TARGET}}...HEAD` e `Spec {{specPath}}, plan {{planPath}}, {{cardRef}}.` (o prefixo `${C()}` e o trecho `Alerts`/`Previous issues` ficam no código, como a spec define). Copiar byte a byte, sem editar o workflow; o `armMatches` ignora `{{...}}`.
2. `final-fix-atual.md`: mesma primeira linha com o mesmo commit; corpo: `Fix the final review problems below and commit "{{E}} final-fix: ...". {{lockNote}} {{noSpecEdit}}` e linha `{{issues}}` (linha 2677-2679 do workflow).
3. Mesmo commit nos dois (regra `assertArmCommits`).

**Verificação:** `node --test tools/measure/run-batch.test.mjs tools/measure/checkpoint.test.mjs` (esperado: passam; 4 testes novos). Depois G1 e `claude plugin validate .`.

**Commit:** `test(measure): bracos final-review-atual e final-fix-atual copiados do workflow`.

---

## T2. B2: script do laço de tarefa (revisor opus)

**Arquivos (3):** `tools/measure/run-batch.mjs`, `tools/measure/review-loop.test.mjs`, `tools/measure/run-batch.test.mjs`.

**Passo 0, commit próprio `test(measure): golden da rodada unica de task-review` (antes de qualquer edição em `run-batch.mjs`):**
`run-batch.test.mjs`, teste `B2: the single-round task-review script of codigo-semeado-A is frozen (golden)`. Monta um `scenario` fixo (sem git real: `dir`, `seededCommit` de 40 `a`, plano com `### Task 3: Word count`), chama `harnessPrompts` (exportá-la com `export` se necessário, ou montar via `buildReviewOnlyScript({ stage: 'task-review', model: 'sonnet', effort: 'medium', agentType: 'productivity-tools:task-reviewer', ...prompts })`) e afirma `sha256(script) === '<hash inline>'`. O hash é calculado em HEAD e colado no teste; deve passar em HEAD sem mudar código. Esse teste não pode mudar em nenhuma tarefa (DEC-735).

**Testes primeiro** (depois do golden):
- `review-loop.test.mjs`, com simulador de agente como o `run()` do arquivo; `buildTaskLoopScript` é a função nova:
  1. `B2: the task loop script carries the pure block byte for byte, compiles and stays under 200,000 characters on the real workflow`. Afirma: `text.includes('\n' + PURE + '\n')`, `new AsyncFunction('agent', ...)` compila, `text.length <= 200000`, sem `^import `, contém `runReviewLoop(H_env, `.
  2. `B2: restrita arm, round 2 prompt has Mode: restricted, spec and review-package.mjs <seededCommit> HEAD`. Achados `F1..Fn` com `id` na rodada 1 e achado novo ou aberto na 2: afirma que o prompt da chamada `E5:task-review2` contém `Mode: restricted, spec` e `node ".../scripts/review-package.mjs" "<wt>" <seededCommit> HEAD "<work>/_tmp/E5-t3-spec2.diff"`.
  3. `B2: atual arm, round 2 prompt has the full Range log -p`. Afirma `Range: git -C ... log -p` e ausência de `review-package.mjs`.
  4. `B2: fix1 is the haiku applier with merge --ff-only <fixSha>, fix2 is the HEAD fixer in sonnet`. Afirma na sequência `[review1, fix1, review2, fix2, review3]`: `fix1` com `model: 'haiku', effort: 'low'`, prompt `git -C "<sb>" merge --ff-only <fixSha>`, schema com `checks`; `fix2` com `model: 'sonnet'`, rótulo `E5:task-review-fix2`, prompt com `fmt(iss)`.
  5. `B2: a repeated finding escalates the fixer and the reviewer to opus`. Afirma que, com o mesmo achado repetido, o `review` seguinte tem `model: 'opus'` (via `rvModel`) e o corretor `tier: 'opus'`.
  6. `B2: the script returns restricted per round and ok`. Afirma `result.restricted` com `[false, true, ...]` no braço restrito e `[false, false]` no atual (o script e o replay usam `!!restrictedRound(cx)`: a função devolve `undefined` na rodada 1 do braço restrito); achado sem `id` na rodada 1 dá `restricted[1] === false`.
  7. `B2: the diff path is outside the sandbox`. Afirma que `diffPath` começa em `<work>/_tmp/` e não em `<sandbox>/`.
- `run-batch.test.mjs`:
  8. `B2: --stage task-review --rounds loop accepts only correcao-semeada-A/B with --arm atual|restrita and a --review-model`. Afirma `UsageError` (saída 2, antes de qualquer `claude`) para: loop com `codigo-semeado-*`; `correcao-semeada-*` em rodada única; `--arm adversarial` em task-review; sem `--review-model`.
  9. `B2: STAGE_LOOP['task-review'] is { tier: 'sonnet', reviewModel: <--review-model>, reviewEffort, maxFix: 2, byId: true }`. Afirma o objeto para `sonnet` e `opus`, e `h.harness.taskReview = { restricted: false|true }`.
  10. `B2: startup refusals on the task slice`. Fixtures do workflow sem cada um destes literais, um por vez, em dois recortes: no trecho entre `` reviewLoop(`T${t.n}:${kind}`, `` e o `reviewLoop(` seguinte (`byId: true })`, `taskReview: TR`, `taskIssues(r, cx)`, `revAgent(buildTaskReviewPrompt(`) e, no texto inteiro do workflow (ou a partir de `const TR =`, linha ~2600, que vem ANTES do `reviewLoop(` da linha ~2603), o literal `(CFG.taskReview || {}).restricted === true`; e sem `function restrictedRound` ou `function taskIssues` no bloco puro; e plugin sem `scripts/review-package.mjs`. Cada um dá `UsageError` com o literal na mensagem, sem chamar `claude`.
  11. `B2: the A1 refusal of task-review loop is narrowed, not removed` (o teste da linha ~1768 e a lista da linha ~1777 mudam: `codigo-semeado-A` com `--rounds loop` segue `UsageError`).
  12. `B2: a restrita attempt with a finding without id is invalid as restrita-nao-ativada` fica para T3 (precisa do diário); aqui só o retorno `restricted` do script (teste 6).

**Implementação (`run-batch.mjs`):**
1. `STAGES['task-review']` (linha ~528): `variant: /^(codigo-semeado-[AB]|correcao-semeada-[AB])$/`. No `runBatch` (linha ~1171) trocar `const seeded = /semeado|nativo/.test(variant)` por `/semead[oa]|nativo/` (senão `seedSource` some nas variantes `correcao-semeada-*`); o mesmo em `makeScenario` (`make-scenario.mjs`, linha ~283, `/semeado|nativo/` do aviso `variant not implemented`).
2. `STAGE_LOOP` (linha ~643): a entrada de task-review depende de `--review-model`; função `stageLoopFor(stage, reviewModel)` devolve `{ tier: 'sonnet', reviewModel, reviewEffort: reviewEffortFor(reviewModel), maxFix: 2, byId: true }`; `STAGE_LOOP['spec-review'|'plan-review']` inalterados (teste A1 da linha 46 segue). `loopResult` e `buildLoopScript` passam a chamar `stageLoopFor`.
3. `STAGE_CALL` (linha ~648): `'task-review': { call: "reviewLoop(`T${t.n}:${kind}`,", literal: "{ tier: implModel(t), reviewModel: reviewModelFor(t), haltOn:", name: 'spec' }`; `checkLoopWorkflow` ganha ramo task: exige `byId: true })`, `taskReview: TR`, `(CFG.taskReview || {}).restricted === true`, `taskIssues(r, cx)`, `revAgent(buildTaskReviewPrompt(` no trecho; `/^function restrictedRound\(/m` e `/^function taskIssues\(/m` no bloco puro; mantém `MAXFIX_LITERAL`. O trecho da tarefa usa `implModel(t)`/`reviewModelFor(t)`: o literal de opções é o da linha 2615 (`byId: true })` termina o trecho); a spec manda checar só os itens listados, sem cobrar `REVIEW_OPTS_LITERAL`/`FIX_OPTS_LITERAL` (os modelos vêm de `reviewModelFor(t)`, não de literal).
3. `prepareHarness` (linha ~755): `h.base = arm === 'atual' || arm === 'restrita' || arm === 'adversarial' ? 'atual' : arm`; validar `restrita` só com `task-review` e `adversarial` só com `final-review` (T5); condição de laço na linha ~781 vira: loop só com `STAGE_LOOP`/task-review-correcao e `h.base === 'atual'`; `rounds` default para task-review em `correcao-semeada-*` é obrigatoriamente `loop`, e `loop` em `codigo-semeado-*` é `UsageError`; `builtIn` usa `h.base`; `harness.taskReview = { restricted: arm === 'restrita' }` quando loop; `pluginRoot` exigido em `runBatch` (arquivo `scripts/review-package.mjs` existe em `plugin.installPath`).
4. `runBatch` (linha ~1172-1192): o ramo `h.arm === 'atual' && h.stage !== 'task-review'` passa a incluir task-review com `h.rounds === 'loop'`: lê o workflow, `h.pure = checkLoopWorkflow(wfText, 'task-review')`, `h.loopFns = loadPure(wfFile)`, `h.harness.pureSha256`, `h.harness.stageOptions`. Rodada única em `codigo-semeado-*` continua sem ler o workflow (preserva o golden).
5. `buildTaskLoopScript({ pure, scenario, opts })` novo (junto de `buildLoopScript`, linha ~689): saída `meta` + `pure` literal + constantes `H_*` (`H_TR = { restricted }`, `H_SEEDED`, `H_FIXSHA`, `H_APPLY`, `H_SCHEMA_TASK` copiando `S_TASKREVIEW` com `id` e `verdicts`, `H_RM`) + `H_ctxFor`, `H_review(round, prev, rvModel, was)`, `H_fix(iss, k, tier)`, `H_truth`, `runReviewLoop(H_env, 'spec', H_review, H_fix, H_truth, H_OPT)`; retorna `{ ok, kind, msg, reviews, accepted, restricted }`. `H_fix`: `k === 1` aplicador haiku/low (`H_APPLY`: `git -C "<sb>" merge --ff-only <fixSha>`, depois `node --test`, devolver `checks` com saída real) e atualizar `cur.summary = 'Fixed the findings ' + ids` e `cur.checks`; `k >= 2` o `fixPrompt` de `harnessPrompts` + `fmt(iss)`, `model: tier, effort: effortFor(tier)`, rótulo `E5:task-review-fix<k>`. Limite de 200.000 caracteres (`LOOP_SCRIPT_LIMIT`).
6. `harnessPrompts` (linha ~807): ramo `task-review` + loop devolve também `fixPrompt` e `title`; `ctx` igual ao da rodada única (para o golden não mudar o ramo de rodada única fica intocado).
7. Seleção do script em `runBatch` (linha ~1248): `h.stage === 'task-review' && h.rounds === 'loop'` chama `buildTaskLoopScript`; `h.arm === 'perguntas'` e demais caminhos inalterados.
8. `parseCli`/`USAGE`: `--arm` já aceita livre; atualizar a frase de `USAGE` (`--stage ... final-review`, `--arm atual|restrita|adversarial`).

**Verificação:** `node --test tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs` (esperado: passa; o golden idêntico ao do passo 0). Depois G1 (1929 + novos, 0 falhas) e `claude plugin validate .`.

**Commits:** (0) `test(measure): golden da rodada unica de task-review`; (1) `fix(measure): laco de task-review (completa contra restrita) com correcao semeada`.

---

## T3. B4: validade, desfecho e replay de tarefa (revisor opus)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`, diários simulados por `jl(...)`/`makeFake`; um por motivo):
1. `B4: formato-do-diario when E5:task-review1 has no issues list`.
2. `B4: sem-correcao when the replay never called fix1 (loop.fixes === 0)`. Afirma `invalidReasons['sem-correcao'] === 1`.
3. `B4: correcao-semeada-ausente when review 2 headSha does not resolve to fixSha, or fixSha is not an ancestor of feat/E5`. Afirma também que um `headSha` abreviado (7 hex) de `fixSha` é aceito (via `git rev-parse <sha>^{commit}`).
4. `B4: restrita-nao-ativada when the restrita arm reaches round 2 and restrictedRounds[1] === false` (achado sem `id` na 1ª revisão). Afirma o valor calculado no callback `review` do replay com `was` vindo do `runReviewLoop`, igual ao `restricted` de um retorno de script simulado.
5. `B4: laco-infra after a null review or fix with the retry`.
6. `B4: laco-divergente when the replay ok differs from the script ok, or the journal has an unused or repeated stage label`; um diário adulterado (um veredito trocado) dá `laco-divergente`; 2 num lote param o lote (o `runBatch` interrompe o laço de tentativas e grava `aggregate.stoppedBy`). Casos novos: o retorno do script (`tool_result` do `Workflow`, linha inline de transcript) ausente dá `formato-do-diario`; `ok` ou `restricted` diferentes do replay dão `laco-divergente`. Anotar no teste: confirmar o formato do `tool_result` na 1ª sonda. A checagem de rótulo não usado ou repetido do estágio final usa o prefixo `E5:final-review` e inclui os rótulos `E5:final-verify<r>`.
7. `B4: semente-ausente when afterFirstFix headSha is not fixSha or CR/CG are not present there`. Nos estágios task e final isso substitui `afterFixVerified` por blob (`blobKey` nulo): o teste afirma que com `blobKey: null` o resultado não é sempre "não verificado".
8. `B4: capturado requires fix2`. Sem `fix2`, CR/CG ficam `perdido` (aprovado) ou `indeterminado` (parado); com `fix2` que remove o defeito, `capturado`.
9. `B4: mentionedAfterFix, capturadoSemMencao, perdidoDoCorretor, residuoSemAchadoPai counted on fixture journals`. Afirma: `mention` do CR casa o achado pai da 1ª revisão; sem pai, `residuoSemAchadoPai += 1` e 3 tentativas assim (mais de 2) param o lote; `mentionedAfterFix[id]` considera as revisões ≥ 2 e o veredito `open: true` do id do resíduo no modo restrito; `capturadoSemMencao` conta capturado sem menção; `perdidoDoCorretor` conta presente no fim e mencionado.
10. `B4: replay ok equals the script ok in the task arms (atual and restrita)`. Com agente simulado e `loopResult` por estágio (`byId: true`, `taskIssues(r, cx)`, `cx` reconstruído por rodada com `was = { iss: fixable, head }` e `taskReview.restricted` do braço) o `ok` do replay é igual ao `ok` do script em 4 sequências: limpa na 1ª; fix e limpa; bloqueia sempre; achado repetido (escala).
11. `B4: aggregate fields`. `harness.seededFix = { sha, ids }`, `harness.taskReview`, por tentativa `loop.restrictedRounds`, `mentionedAfterFix`; topo `capturadoSemMencao`, `perdidoDoCorretor`, `residuoSemAchadoPai`; o relatório recontado com `capturadoSemMencao` como `indeterminado` (função `recountWithoutMention(aggregate)` exportada) e a marca `inconclusivo` quando a regra muda de lado (DEC-737).

**Implementação (`run-batch.mjs`):**
1. `harnessValidity` (linha ~1012): ramo `task-review` + loop: `formato-do-diario` se `E5:task-review1` sem `issues` em lista; `sem-correcao` se o replay não chamou `fix1` (`loop.fixes === 0`; não é contagem de `BLOCKING`); `correcao-semeada-ausente` por `gitOut(dir, 'rev-parse', `${sha}^{commit}`) !== scenario.fixSha` ou `!is-ancestor fixSha feat/E5`; logo depois, na mesma função, `semente-ausente` (`present` verdadeiro em `fixSha` para cada CR/CG; `afterFirstFix` roda depois de `validRuns.push`, tarde demais para invalidar); `restrita-nao-ativada` com `loop.restrictedRounds[1] === false` (calculado em 4).
2. `loopResult` (linha ~1060): recebe `{ truth, opts, labelOf }` por estágio. Task: `byId: true`; `review(round)` devolve `e.result` e guarda `cx`; `truth = r => reviewTruth({ ...r, issues: taskIssues(r, cx) }, 1, `${scenario.seededCommit}~1..HEAD`)` com `cx = { taskReview: { restricted }, was, pluginRoot, diffPath, ...}` reconstruído por rodada. Spec e plano seguem como no bloco A (`reviewTruth(r, 0, 'main..HEAD')`). `fixTiers` registra `tier`. Rótulos usados contados contra `labels` para `laco-divergente`.
3. `afterFixVerified` (linha ~1092): para task e final troca a conferência por blob por `rev-parse <sha>^{commit} === scenario.fixSha`; a checagem `present` de CR/CG em `fixSha` fica em `harnessValidity` (item 1), antes do `validRuns.push`.
4. **Retorno do script e `restricted` (correções 4 e 12 da revisão).** `runBatch` hoje só lê os diários dos subagentes (`readSessionJournals`). Novo `readScriptResult(configDir, sessions)` em `run-batch.mjs`: lê o transcript principal da sessão e acha o `tool_result` da ferramenta `Workflow` com o objeto `{ ok, restricted, verify }` devolvido pelo script (formato a confirmar na 1ª sonda; o teste usa uma linha inline de transcript e o plano anota "confirmar o formato na 1ª sonda"). Ausente ou ilegível: tentativa `formato-do-diario`. O replay calcula `restricted` dentro do callback `review(round, prev, rvModel, was)` do `loopResult`, com `!!P.restrictedRound({ taskReview: { restricted: h.arm === 'restrita' }, was })`, onde `was` é o `{ iss: fixable, head }` que `runReviewLoop` passa (nunca reconstruído de `r.issues`: `fixable` só tem issues duras e inclui sintéticas sem `id`). Grava `loop.restrictedRounds`. `restrita-nao-ativada` = braço restrito, rodada 2 alcançada e `restrictedRounds[1] === false`. Divergência de `ok` ou de `restricted` entre replay e retorno do script = `laco-divergente`.
5. `attemptOutcomes` (linha ~441) já filtra por `set`; garantir que `correcao-semeada-*` filtra CR/CG (teste do passo 2 de T1). `stageOf` em loop usa `loop.ok`.
6. Contadores no `attempt`: `mentionedAfterFix`, `loop.restrictedRounds`; topo em `loopAggregate` (linha ~493) e agregado final: `capturadoSemMencao`, `perdidoDoCorretor`, `residuoSemAchadoPai`, `refutouTudo` (zerado até T5), `harness.seededFix`. `mention` vem do manifesto (campo da T1).
7. Parada de lote: `residuoSemAchadoPai > 2`, 2 `correcao-semeada-ausente`, 2 `laco-divergente` encerram o laço de tentativas com `aggregate.stoppedBy`.

**Verificação:** `node --test tools/measure/run-batch.test.mjs` (esperado: passa; 11 testes novos, os antigos intactos, golden de T2 intacto). G1 completo e `claude plugin validate .`.

**Commit:** `fix(measure): validade, desfecho e replay de task-review com correcao semeada`.

---

## T5. B3: estágio final em laço (revisor opus)

**Arquivos (3):** `tools/measure/run-batch.mjs`, `tools/measure/review-loop.test.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro:**
- `review-loop.test.mjs`:
  1. `B3: the final loop script carries the pure block byte for byte, compiles and stays under 200,000 characters`.
  2. `B3: the atual arm never calls verify`. Afirma que nenhuma chamada tem rótulo `E5:final-verify<r>`.
  3. `B3: the adversarial arm calls E5:final-verify<r> only with a blocking issue and drops the refuted ones through splitRefuted`. Afirma: sem bloqueante, nenhuma chamada verify; com bloqueante, uma chamada com `Mode: verify.` + `fmt(bl)` no prompt, `schema` de `S_VERIFY`, `model: 'opus', effort: 'high'`, `agentType: 'productivity-tools:final-reviewer'`; achado refutado some das issues da rodada.
  4. `B3: fix1 is the haiku applier and fix2 is the final-fix-atual arm in sonnet`. Prompt de `fix2` começa com `Fix the final review problems below and commit "E5 final-fix: ..."`.
  5. `B3: one review per round with lens all and the prefix is briefing(ctx)`. Afirma `Mode: review, lens: all. Diff: git -C "<sandbox>" diff main...HEAD`, `Previous issues (<repeatRule()>):` a partir da rodada 2, e que o `base` do ctx nomeia a worktree, a branch `feat/E5` e o alvo `main`.
  6. `B3: refutou-tudo`. 1ª revisão com bloqueante e verify refutando todos: o script retorna sem `fix1`; o retorno inclui `verify` com `refutedByRound`.
- `run-batch.test.mjs`:
  7. `B3: STAGES['final-review'] accepts correcao-semeada-A/B only, loop only, arm atual|adversarial`. `UsageError` para `codigo-semeado-*`, `--rounds single`, `--arm restrita`, `--review-model`.
  8. `B3: startup refusals on the final slice`. Fixture sem cada literal, um por vez, o literal de `FRA` (`FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }`) procurado a partir de `const FR = CFG.finalReview` (linha ~2657, ANTES do `reviewLoop('final',` da ~2659) ou no texto todo; e, no trecho `reviewLoop('final',` até o `reviewLoop(` seguinte, `{ tier: 'sonnet', reviewModel: 'opus', once: FR.singleWave === true })`, `FR.adversarial === true && bl.length`, `card.critical ? ['correctness', 'security'] : ['all']`, `reviewTruth(r, 1,`, `Mode: verify.`. Cada um dá `UsageError`.
  9. `B3: rolesByLabel has a verify bucket`. Rótulos com `verify` somam em `verify` e saem de `review`; `sumRolesByLabel` soma o balde novo; `session` inalterado.
  10. `B3: validity of the final stage`. Reaproveita os motivos de T3 com rótulos `E5:final-review<r>`, mais `refutou-tudo` (só adversarial), com contador `refutouTudo` no topo e `invalidReasons['refutou-tudo']`.
  11. `B3: refutedTotal, refutedSeeded and refutedByRound`. Afirma contagem em diário de fixture: `refuted: true` conta em `refutedTotal`; só o que bate o `mention` de CR/CG conta em `refutedSeeded`; `verify.calls` conta as chamadas `E5:final-verify<r>` (zero no braço atual).

**Implementação (`run-batch.mjs`):**
1. `STAGES['final-review']` (linha ~525): `{ variant: /^correcao-semeada-[AB]$/, fix: 'final-fix', label: 'E5:final-review', blobKey: null, artifact: null }`; só `--rounds loop`; `--arm atual|adversarial`; `h.base = 'atual'` para os dois.
2. `STAGE_LOOP['final-review'] = { tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'high', maxFix: 2, byId: false }`; `STAGE_CALL['final-review'] = { call: "reviewLoop('final',", literal: "{ tier: 'sonnet', reviewModel: 'opus', once: FR.singleWave === true })", name: 'final' }`; `checkLoopWorkflow` ganha o ramo final com as seis recusas.
3. `prepareHarness`: ler `final-review-atual.md` e `final-fix-atual.md` para os dois braços (`readArm(join(armsDir, ...), { requireSource: true })`); `assertArmCommits`; `assertArmsCurrent` (usa `h.base`).
4. `buildFinalLoopScript` novo: `pure` literal + `H_FRA`, `H_FINAL_REVIEW`, `H_SCHEMA_FINAL` (cópia de `S_REVIEW`), `H_SCHEMA_VERIFY` (cópia de `S_VERIFY`), `H_ADVERSARIAL`; `H_review(round, prev)`: uma lente `all`, prompt `briefing(ctx) + '\n\n' + fill(final-review-atual)` + `Previous issues (...)`; com `H_ADVERSARIAL && bl.length` chama `agent(briefing(ctx) + '\n\nMode: verify.\n' + fmt(bl), { label: 'E5:final-verify' + round, schema: H_SCHEMA_VERIFY, ...H_FRA })` e `splitRefuted(bl, v)`, reconstruindo as issues como o produto: `r.issues = [...r.issues.filter(i => !bl.includes(i)), ...s.keep]`; `H_fix` com aplicador em `k === 1` (rótulo `E5:final-review-fix1`) e `final-fix-atual` em `k >= 2`; `truth = r => reviewTruth(r, 1, 'main..HEAD')`; opções `{ tier: 'sonnet', reviewModel: 'opus' }` sem `once`; devolve `{ ok, kind, reviews, verify }`.
5. `rolesByLabel` (linha ~207) e `sumRolesByLabel`: balde `verify` (`name.includes('verify')` antes de `review`).
6. `harnessValidity`/`loopResult`: ramo `final-review` (a verdade e o replay com verify ficam em T6; aqui só validade e `refutou-tudo`: 1ª revisão com bloqueante e `E5:final-verify1` refutando todos).
7. `runBatch`: seleção do script e contadores `refutouTudo` (topo) e `attempt.verify = { calls, refutedTotal, refutedSeeded, refutedByRound }`; `harness.finalReview = { adversarial }`.

**Verificação:** `node --test tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs` (esperado: passa). G1 e `claude plugin validate .`.

**Commit:** `fix(measure): estagio final em laco com braco adversarial e balde verify`.

---

## T6. B3: replay final e onda única (revisor opus)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`; agente simulado e a função pura `runReviewLoop` carregada do workflow real por `loadPure`):
1. `B3: single wave replay ok equals runReviewLoop(..., { once: true }) for the four sequences`. Sequências: limpa na 1ª; limpa após `fix1`; bloqueia após `fix1`; só menores após `fix1`. Afirma `replay.ok === direto.ok` e que as chamadas de `once` são prefixo das do laço.
2. `B3: the single wave replay runs without new calls and only in the atual arm`. O replay lê `E5:final-review1`, `E5:final-review-fix1`, `E5:final-review2` do diário; o braço adversarial não grava `singleWave`.
3. `B3: singleWave outcomes are the fixSha sentinels`. `perdido` se `ok`, `indeterminado` (parada) se não; tentativa sem `fix1` sai inválida (`sem-correcao` ou `refutou-tudo`).
4. `B3: loopResult applies splitRefuted before reviewTruth in the final stage`. Com `E5:final-verify<r>` no diário, `splitRefuted(blocking(r), verify.result)` roda antes de `reviewTruth(r, 1, 'main..HEAD')`; sem verify, não roda.
5. `B3: replay ok equals script ok in the four arms (task atual and restrita, final atual and adversarial)`. Com diários simulados; um diário adulterado dá `laco-divergente`.
6. `B3: aggregate has outcomesSingleWave, singleWaveStopped and per attempt singleWave { ok, outcomes }`.
7. `B3: whole aggregate keeps the A shapes for the old stages` (nada muda para spec-review, plan-review, task-review de `codigo-semeado-*`).

**Implementação (`run-batch.mjs`):**
1. `loopResult` (ramo final): `review(round)` lê `E5:final-review<r>`; `verify` lido de `E5:final-verify<r>` e aplicado como no produto: `bl = P.blocking(r)`, `s = P.splitRefuted(bl, v.result)`, `r.issues = [...r.issues.filter(i => !bl.includes(i)), ...s.keep]`; `truth = r => P.reviewTruth(r, 1, 'main..HEAD')`.
2. `singleWaveReplay(h, entries, P)`: chama `P.runReviewLoop(env, 'final', review, fix, truth, { tier: 'sonnet', reviewModel: 'opus', once: true })` sobre o mesmo diário; devolve `{ ok, calls }`.
3. `attempt.singleWave = { ok, outcomes }` só no braço `atual`; `outcomes` com os sentinelas em `fixSha` (CR e CG presentes por construção): `perdido` se `ok`, `indeterminado` caso contrário.
4. Agregado: `outcomesSingleWave`, `singleWaveStopped`, regras de parada de lote do bloco (já em T3) aplicadas também ao final, e `harness.finalReview`.
5. Fechamento do bloco: README dos achados do executor (troca de ids de CR/CG, C que coincide com resíduo, caminho usado para `restricted`) entra no relatório da entrega, não em arquivo.

**Verificação:** `node --test tools/measure/run-batch.test.mjs` (esperado: passa). G1 completo (esperado: 1929 + todos os novos, 0 falhas) e `claude plugin validate .`. Guarda de escopo: `git diff --name-only a79999d..HEAD`.

**Commit:** `fix(measure): replay do estagio final e onda unica derivada`.

---

## Portão final (opus/high, branch inteira)

Antes: G1 verde (0 falhas, total >= 1929 + novos) e `claude plugin validate .`. Revisão adversarial da branch `fix/measure-e26-b` contra a spec: aceite 1 a 9, DEC-732 a DEC-737, escopo (6 arquivos fora os testes, nada fora de `tools/measure/`, golden de task-review sem mudança de byte), os riscos da spec (modo restrito que não liga, aplicador que desobedece, `run-batch.mjs` crescendo sem módulo novo). Sondas e lotes são do dono (DEC-728, DEC-729).

## Sonda (nada abaixo foi executado; DEC-736: sondas e peça 3 primeiro, depois peça 4)

Pré-requisitos do dono: `claude` autenticado, `$CFG` com `projects/` e `plugins/installed_plugins.json`, `$WORK` e `$OUT` vazios, porta 48731 livre (a suíte da sandbox a usa; execuções em série, nunca duas ao mesmo tempo). Raiz do repo da medição, `PLUGIN=plugins/productivity-tools`. Sessão sonnet, teto de US$ 3 por sessão, `--stop-on-denial`, 1 execução cada, `correcao-semeada-A`, `--permission-mode bypassPermissions` (o checkpoint exige).

Prefixo comum (`COMMON`): `node tools/measure/run-batch.mjs --variant correcao-semeada-A --runs 1 --work "$WORK" --out "$OUT" --config-dir "$CFG" --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 --stop-on-denial --plugin-dir "$PLUGIN"`

1. Peça 3, braço atual (revisão completa), `--review-model sonnet` (DEC-707):
   `$COMMON --stage task-review --arm atual --review-model sonnet --rounds loop`
2. Peça 3, braço restrita:
   `$COMMON --stage task-review --arm restrita --review-model sonnet --rounds loop`
3. Peça 4, braço atual (com a onda única derivada no mesmo laço):
   `$COMMON --stage final-review --arm atual --rounds loop`
4. Peça 4, braço adversarial:
   `$COMMON --stage final-review --arm adversarial --rounds loop`

Ler de cada `aggregate.json` o custo da tentativa `max(cost.session.max cliCostUsd, rolesByLabel.session.transcriptCostUsd + soma dos papéis)` e projetar `P3 = (custo sonda 1 + custo sonda 2) x 10`, `P4 = (custo sonda 3 + custo sonda 4) x 10`, mais o gasto das sondas; sem margem inventada. Paradas antes do lote (DEC-736): `P3` acima de US$ 20 para e pergunta; sondas + `P3` + `P4` acima de US$ 60 tira o braço adversarial e, se ainda passar de 60, para e pergunta; `P4` acima de US$ 45, o dono corta um braço. Paradas durante o lote: mais de 3 inválidas; 2 `correcao-semeada-ausente` ou mais de 2 `residuoSemAchadoPai`; 2 `laco-divergente`.
