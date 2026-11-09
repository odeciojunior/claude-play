# Correções da revisão adversarial dos skills de roadmap: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** corrigir os defeitos 1 a 14 e os itens importantes da revisão adversarial dos quatro skills de roadmap, com uma regra única de autorização de efeitos externos e teste comportamental dos skills sem cobertura.

**Architecture:** a lógica pura do workflow (entre `// <pure>` e `// </pure>`) ganha funções novas e testadas por `load-pure.mjs`. O corpo do script ganha travas determinísticas, testadas com agentes simulados em `flow.test.mjs`. O preflight (`preflight.mjs`) passa a ler a tabela de gates por posição e a marcar gates restritos. `plan-coordinator`, `roadmap-tracker` e `roadmap-planner` mudam só em texto, verificado por grep e por teste comportamental com subagente.

**Tech Stack:** Node 18+ sem dependências, `node:test`, API de Workflow (`agent`, `parallel`, `phase`, `log`, `budget`, `args`), Markdown.

**Spec:** `docs/plans/2026-11-09-correcoes-revisao-skills-design.md` (a autoridade). Executores leem o desenho e este plano. Linhas citadas referem-se a `ae8cde0`.

Worktree: `D:\projects\claude-play-wt\roadmap-skills`, branch `feat/roadmap-skills-autonomia`. Todos os comandos rodam da raiz da worktree. Abreviações: `SK/` = `plugins/productivity-tools/skills/roadmap-release/`; `PT/` = `plugins/productivity-tools/skills/`.

## Global Constraints

- Autonomia nunca executa efeito externo sem autorização. Silêncio nunca é autorização. Só a pessoa autoriza, nunca um agente.
- Itens de `authorizeExternal`, exatamente: `"gate:G3"`, `"E18:T4"`, `"checkout:<alvo>"`. Um "sim" vale só para os itens que a pergunta mostrou, por nome; a pessoa pode liberar parte citando os itens. A autorização vale até a entrega terminar, em todas as rodadas e retomadas. Decisão do dono: qualquer plano refeito invalida a autorização, mesmo com o mesmo número de tarefa; a forma vinculada é `"E18:T4@<fp>"`, com `<fp>` a impressão digital do plano, e a forma nua `"E18:T4"`, dada antes do run, se vincula ao plano no primeiro uso. A pergunta única lista todas as tarefas externas pendentes do plano de uma vez. Tarefa `external` declara como evita efeito duplicado.
- Efeito externo: produção, deploy, push, envio de e-mail ou mensagem, escrita em dados compartilhados, reset ou rollback no checkout da pessoa. Na dúvida, é externo.
- `roadmap-release` nunca pergunta durante o run; a pergunta de autorização vem uma só, no fim, depois do relatório (quarta pergunta permitida), combinável com a oferta de `resumeWith`.
- Script do Workflow: sem `import`, sem filesystem, sem `Date.now()`, `Math.random()` ou `new Date()` sem argumento; `meta` é literal puro; lógica pura só entre `// <pure>` e `// </pure>`.
- `SKILL.md` abaixo de 500 linhas; referência acima de 100 linhas com índice; frontmatter só com as chaves permitidas (`CLAUDE.md`, `.claude/rules/skills.md`). Texto dos skills em inglês.
- Sem merge nem push. Sem alterar `check-roadmap.mjs` (então a linha 1 do checker e `formatVersion` ficam como estão).
- Teste de regressão por item testável, visto falhar antes da correção, nos `*.test.mjs` existentes.
- Linha de base: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"` = 429 pass, 0 fail. Lint: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.
- Commits em português, `fix(roadmap-release): ...` (ou `fix(<skill>): ...`), cada um terminando com a linha `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Em cada passo de commit: `git commit -m "<assunto>" -m "Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"`.
- Cada tarefa roda com "STOP after this task": o implementador não segue para a tarefa seguinte.

## Review Focus

1. Bloco de gates de exemplo dentro de cerca de código antes do bloco real, e comando com `\|`: não podem virar gate nem quebrar a linha. Testes na Tarefa 1.
2. Gate com `Environment` ou `When` de texto desconhecido (`kubernetes cluster`) não pode rodar em silêncio: conta como restrito, com aviso. Teste na Tarefa 2.
3. `authorizeExternal` com erro de digitação ou zero à esquerda (`E18:T04`) não autoriza nada e dá `status: error`. Teste na Tarefa 3.
4. `maxParallel` é 1 em config gerado (o padrão do `flow.test.mjs`): a espera pelas retomadas não pode travar o semáforo. Teste na Tarefa 7.
5. Retomada de entrega parada numa tarefa `external` com tarefas anteriores já commitadas: só a tarefa liberada e as seguintes rodam, e a autorização permanece em `resumeArgs`. Teste na Tarefa 4.

---

### Task 1: Parser de gates por posição (item 3)

**Files:**
- Modify: `SK/scripts/preflight.mjs` (`parseGatesTable`, helpers locais `blankFences` e `splitRow`)
- Test: `SK/scripts/preflight.test.mjs`

**Interfaces:**
- Produces: `parseGatesTable(markdown: string): GateRow[]`, com `GateRow = { ID, Command, Environment, When, Baseline }` (strings; chaves fixas, lidas por posição 0 a 4, qualquer que seja o texto do cabeçalho). A tarefa 2 e `deriveConfig` leem essas chaves.

Regras: ignora blocos em cerca de código (mesma regra de `scanFences` do checker: cercas de 3+ crases ou til, fechamento do mesmo caractere e tamanho maior ou igual); localiza a âncora `<!-- roadmap:gates ... -->` com atributos opcionais e usa só o primeiro bloco; a primeira linha da tabela é o cabeçalho e é descartada sem olhar o texto, e a linha separadora (todas as células `:?-+:?`) também; separa células com `\|` como escape (`splitRow` do checker); descarta linha com colunas diferentes de 5 e linha cujo `Command` é vazio, `-` ou `—`. Copie os helpers em vez de importar do checker: o skill fica autocontido.

- [ ] **Step 1: Write the failing tests** em `preflight.test.mjs`:
  - `item 3: columns are read by position, whatever the header words say`: cabeçalho `| ID | Comando | Ambiente | Quando | Linha de base |`, linha `| G1 | \`npm test \\| tee out.txt\` | local | cada tarefa | verde |`. Assert `rows[0].ID === 'G1'`, `rows[0].When === 'cada tarefa'` e `deriveConfig({ gatesBlockRows: rows }).gates[0].cmd === 'npm test | tee out.txt'`.
  - `item 3: an anchor with attributes opens the block`: `<!-- roadmap:gates v=2 -->` rende a mesma linha.
  - `item 3: a gates block inside a code fence before the real one is ignored`: bloco cercado com `G9` e depois o real com `G1`. Assert `rows.map(r => r.ID)` igual a `['G1']`.
  - `item 3: rows with an empty, "-" or "—" command are dropped`: `G2`, `G3`, `G4` descartadas, `G1` fica.
  - `item 3: parity with the checker`: importa `readBlocks` e `parseTable` de `../../roadmap-tracker/scripts/check-roadmap.mjs` e confirma que, para o mesmo markdown (com `\|` e cerca), os comandos de `parseTable(readBlocks(md,'gates')[0].body)` (coluna 1, descartadas as vazias) iguais a `rows.map(r => r.Command)`.
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`. Expected: os cinco testes novos FAIL; os demais seguem PASS.
- [ ] **Step 3: Implement** `parseGatesTable` como descrito, mantendo o teste existente `parseGatesTable reads the roadmap:gates block` verde.
- [ ] **Step 4: Run the file again.** Expected: PASS, 0 fail.
- [ ] **Step 5: Commit.** `fix(roadmap-release): parser de gates por posicao, com escape e cercas do checker`.

---

### Task 2: Gates restritos no preflight (item 4)

**Files:**
- Modify: `SK/scripts/preflight.mjs` (`classifyGate`, `deriveConfig`, `validateReleaseConfig`, `runPreflight`), `SK/references/config.md`
- Test: `SK/scripts/preflight.test.mjs`

**Interfaces:**
- Consumes: `GateRow` da Tarefa 1.
- Produces: `classifyGate(environment: string, when: string): 'free' | 'restricted' | 'unknown'`; `deriveConfig({ gatesBlockRows, projectContext, install, warnings?: string[] })` (`warnings` é parâmetro de saída: recebe uma linha por gate `unknown`); gate derivado ganha `restricted: true` quando a classe não é `free`. `validateReleaseConfig` aceita `gates[i].restricted` booleano opcional. A Tarefa 4 filtra o workflow por esse campo.

Regras de `classifyGate`, **célula a célula**, em texto minúsculo, por token (`/[^\p{L}]+/u`), casando o prefixo do token; `release only` casa como frase. `undefined` conta como célula vazia (linhas sem essas colunas, como no teste existente de `deriveConfig`):
- Marca de restrição (`prod`, `produção`, `producao`, `staging`, `owner`, `dono`, `release only`) em qualquer célula: `restricted`, sempre, mesmo ao lado de palavra local.
- Célula livre: vazia, `-`, `—`, ou texto com marca local (`local`, `every`, `each`, `before`, `merge`, `task`, `cada`, `todo`, `antes`, `always`, `sempre`). `free` exige as duas células livres.
- Sem marca de restrição e com alguma célula não livre: `unknown` (trata como restrito, com aviso). Uma célula livre não absolve a outra: `('kubernetes cluster','every task')` é `unknown`.

`validateReleaseConfig` dá o erro `every gate is restricted: nothing can run without authorization` quando todos os gates têm `restricted: true`. Config sem o campo `restricted` segue como escrito.

- [ ] **Step 1: Write the failing tests:**
  - `item 4: classifyGate`: `('local','every task')`, `('','-')`, `('-','—')`, `('local','before merge')`, `('','cada tarefa')` dão `free`; `('prod','every task')`, `('Produção','before merge')`, `('staging','')`, `('owner laptop','merge')`, `('Release only','')` dão `restricted`; `('kubernetes cluster','nightly')`, `('CI runner','')`, `('kubernetes cluster','every task')`, `('local','nightly')` dão `unknown`.
  - `item 4: deriveConfig keeps restricted gates in the config with restricted: true and warns on unknown`: três linhas (livre, `prod`, `kubernetes cluster`). Assert `gates.map(g => g.restricted === true)` igual a `[false, true, true]`, `warnings.length === 1` citando o id do terceiro.
  - `item 4: a config where every gate is restricted is an error`, e `restricted: 'yes'` é erro `must be a boolean`.
  - `item 4: runPreflight on a roadmap with a free and a restricted gate returns both, the restricted one flagged, and no error`; com todos restritos, `errors` contém `every gate is restricted`. Use o helper `repoWithRoadmap` do arquivo, acrescentando um segundo parâmetro opcional com as linhas da tabela de gates (o padrão continua a linha `g1` atual, que segue `free` por causa de `always`).
  - `item 4: always and sempre are free`: `('','always')` e `('local','sempre')` dão `free`; `('prod','always')` dá `restricted`.
  - `item 4: a restricted gate needs no permission rule until authorized`: `requiredRules` de um config com `{cmd:'npm test'}` e `{cmd:'kubectl apply', restricted:true}` não contém a regra de `kubectl`; `runPreflight` nesse roadmap devolve em `warnings` uma linha com o id do gate e a regra a acrescentar caso ele venha a ser autorizado, e `missingRules` sem ela.
- [ ] **Step 2: Run to verify it fails.** Mesmo comando da Tarefa 1. Expected: os novos FAIL.
- [ ] **Step 3: Implement** as quatro mudanças. `runPreflight` passa um array `warnings` a `deriveConfig` e o junta aos avisos existentes. `requiredRules(cfg)` ignora gates com `restricted: true`, e `runPreflight` emite o aviso do teste acima por gate restrito.
- [ ] **Step 4: Document** em `config.md`: campo `restricted` (derivado de `Environment` e `When`, regras acima, "unknown conta como restrito"), erro quando todos são restritos, e a frase "um gate restrito só roda com `authorizeExternal: [\"gate:<id>\"]`".
- [ ] **Step 5: Run the file.** Expected: PASS. Rodar também `node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs` (usa o preflight): PASS.
- [ ] **Step 6: Commit.** `fix(roadmap-release): gates de ambiente restrito ficam no config como restricted`.

---

### Task 3: Autorização de efeitos externos, núcleo puro e plano

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (região pura; `S_PLAN`; prompts do plano e da revisão do plano; `planGaps`; validação de `args`; comentário ARGS do cabeçalho)
- Test: `SK/workflow/review.test.mjs`, `SK/workflow/flow.test.mjs`

**Interfaces:**
- Produces (região pura): `parseAuthorizeExternal(v: unknown): { items: string[], error: string | null }`; `isAuthorized(items: string[], item: string): boolean` (igualdade exata); `planFingerprint(tasks, planBlob = ''): string` (8 dígitos hexadecimais, hash determinístico de `planBlob` e de `n`, `title` com espaços aparados, `files` ordenados, `external` e `externalDedupe` de todas as tarefas; `planBlob` é o `S_PLAN.planBlob`, obrigatório, que o agente do plano e o `plan-fix` medem com `git rev-parse HEAD:<planPath>` depois do commit; sem `crypto`, porque a região pura não importa nada); `externalHold(task: { n: number, external?: boolean }, E: string, items: string[], fp: string): string | null` (devolve `` `${E}:T${task.n}@${fp}` `` quando `task.external !== false` e nem esse item nem a forma nua `` `${E}:T${task.n}` `` está em `items`; campo ausente conta como externo); `bindAuthorizations(items: string[], E: string, fp: string): string[]` (troca a forma nua de `E` por `@fp`, sem tocar os outros itens); `externalGaps(tasks): Issue[]`. Todas declaradas com `function` no nível de topo: `loadPure` só exporta essa forma.
- Produces (corpo): `AUTH = parseAuthorizeExternal(A.authorizeExternal)` e `authorized = item => isAuthorized(AUTH.items, item)`; `S_PLAN.tasks[].external` (boolean, obrigatório) e `externalDedupe` (string).

Gramática dos itens: `/^(gate:\S+|[A-Za-z][A-Za-z0-9-]*:T[1-9]\d*(@[0-9a-f]{8})?|checkout:\S+)$/`; duplicados somem. `A.authorizeExternal` que não é lista, ou com item fora da gramática, devolve `{ status: 'error', error: ... }` antes da descoberta (a mensagem cita o item). `externalGaps` produz lacuna `critical`/`defeito` para `external` ausente ou não booleano, e para tarefa `external: true` sem `externalDedupe` com texto.

- [ ] **Step 1: Write the failing tests** em `review.test.mjs`:
  - `parseAuthorizeExternal accepts the three item shapes and drops duplicates`: `['gate:G3','E18:T4','checkout:release/x','gate:G3']` dá 3 itens e `error === null`; `undefined` dá lista vazia.
  - `parseAuthorizeExternal rejects a typo, a leading zero and a non-list`: `['E18:T04']`, `['G3']`, `'gate:G3'` dão `error` não nulo e `items` vazio.
  - `externalHold: a bare or a matching bound item passes, anything else holds`, com `fp='aaaaaaaa'`: `({n:4,external:true},'E18',['E18:T4'],fp)` e `(...,['E18:T4@aaaaaaaa'],fp)` dão `null`; `(...,['E18:T4@bbbbbbbb'],fp)` dá `'E18:T4@aaaaaaaa'`; `({n:5,external:true},'E18',['E18:T4'],fp)` dá `'E18:T5@aaaaaaaa'`; `({n:4,external:false},'E18',[],fp)` dá `null`; `({n:1},'E1',[],fp)` dá `'E1:T1@aaaaaaaa'`.
  - `planFingerprint changes when a task changes and ignores key order and spacing`: dois planos iguais dão o mesmo valor casando `/^[0-9a-f]{8}$/`; `title` diferente, `files` diferente ou tarefa a mais dão valor diferente; `' a '` e `'a'` no título dão o mesmo.
  - `bindAuthorizations binds only the bare items of that deliverable`: `(['E1:T2','E2:T1','gate:x','E1:T3@bbbbbbbb'],'E1','aaaaaaaa')` dá `['E1:T2@aaaaaaaa','E2:T1','gate:x','E1:T3@bbbbbbbb']`.
  - `externalGaps flags a missing boolean and a missing dedupe note`: `[{n:2}]` gera 1 lacuna `/boolean/`; `[{n:1,external:true,externalDedupe:'  '}]` gera 1 `/externalDedupe/`; `[{n:1,external:true,externalDedupe:'checks outbox.log first'},{n:2,external:false}]` gera 0.
  
  em `flow.test.mjs`:
  - `authorizeExternal with a bad item stops the run before discovery`: `args: { authorizeExternal: ['E18:T04'] }` dá `r.status === 'error'` e `labels` vazio.
  - `the plan prompt asks for external and externalDedupe and the plan review blocks a gap`: o prompt de `E1:plan` casa `/externalDedupe/` e `/when in doubt/i`; plano com tarefa sem `external` faz o `planLoop` abrir lacuna (o rótulo `E1:plan-fix1` aparece).
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** as quatro funções puras, a validação de `args`, o campo no schema e `externalGaps` dentro de `planGaps`. No prompt do plano: "Per task declare `external` (true when the task touches anything outside the branch: production, deploy, push, e-mail or message, shared data, someone's checkout; when in doubt, true). An external task also declares `externalDedupe`: how running it twice avoids a duplicate effect (idempotency key or an existence check before acting)." Mesma exigência como bloqueio no prompt de revisão do plano. O "Return ..." dos prompts do plano e de `plan-fix` passa a listar `external` e `externalDedupe` em `tasks`, e a frase de reaproveitamento do prompt do plano ganha: "A reused plan whose tasks do not declare `external` is not reusable as is: add the declarations, commit and return reused=false." Atualizar o comentário ARGS com `authorizeExternal`.
- [ ] **Step 4: Run both files.** Expected: PASS (ponha `external: false` nas tarefas dos três mocks de plano de `flow.test.mjs`: o do `exec`, `planAc` e `noHeader`; confirme que os testes antigos seguem verdes).
- [ ] **Step 5: Commit.** `fix(roadmap-release): núcleo da autorização externa e declaração external no plano`.

---

### Task 4: Autorização de efeitos externos, parada determinística e gates restritos

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (laço de tarefas, `op`, agendamento, `GATES`, `COMMON_BASE`, `buildImplPrompt`)
- Test: `SK/workflow/flow.test.mjs`, `SK/workflow/prompts.test.mjs`

**Interfaces:**
- Consumes: `externalHold`, `isAuthorized`, `authorized` da Tarefa 3; `gates[i].restricted` da Tarefa 2.
- Produces: ação `authorize-external` com os campos `{ kind, deliverable, what, doNow, resumeWith, item }` (`op` ganha o sexto parâmetro opcional `extra`, mesclado na ação); `failKind: 'externo'`; `resumeWith.authorizeExternal = [...AUTH.items, item]`; `buildImplPrompt(ctx, task)` com `ctx.authorizedExternal: boolean`. SKILL.md (Tarefa 5) e a Tarefa 6 reusam `op(..., { item })`.

Comportamento: com o plano aprovado, `fp = planFingerprint(plan.tasks)`, e `bindAuthorizations` substitui a forma nua de `E` nos itens que irão para `resumeArgs` e `resumeWith`. Antes de implementar a tarefa `t` (e só se ela não foi retomada como já commitada), `externalHold(t, E, AUTH.items, fp)` não nulo faz: uma ação `op('authorize-external', E, ..., { ...A, authorizeExternal: [...itensVinculados, item], deliverables: [E] }, { item })` para `t` **e para cada tarefa seguinte do plano que também esteja retida** (o `what` traz o título da tarefa), `out.held = <item de t>`, `return fail('externo', ...)`. As tarefas anteriores à parada já rodaram. O agendamento não grava `blocked` nem abre `defect` para `failKind: 'externo'`; as demais entregas seguem. `GATES` passa a ser `CFG.gates.filter(g => !g.restricted || authorized('gate:' + g.name))`; por gate restrito sem autorização, no modo `run`, uma ação `authorize-external` com `deliverable: null`, `item: 'gate:<id>'`, `resumeWith: { ...A, authorizeExternal: [...AUTH.items, item] }` e `doNow` dizendo que as entregas mescladas não foram medidas por ele; sem nenhum gate restante, `status: 'error'`. `COMMON_BASE` ganha: "NEVER perform an external effect (production, deploy, push, sending e-mail or messages, writing shared data, resetting or rolling back someone's checkout) unless your task is marked external and authorized; when in doubt it is external." e a exceção na regra de pré-aprovação: "...except a strategy revision or migration and any external effect". Texto exato em `buildImplPrompt`, e igual no prompt de correção de tarefa (`:spec-fix`/`:quality-fix`): sem `ctx.authorizedExternal`, "Do NOT perform any external effect in this task."; com ele, "This task is external and AUTHORIZED: perform the effect at most once, first applying its duplicate check: ${task.externalDedupe}." A autorização termina com a entrega: no `return` final, quando `A.authorizeExternal` existe, `resumeArgs.authorizeExternal` perde os itens `E:Tn` de entregas com `merged && !broken` (`gate:` e `checkout:` ficam).

- [ ] **Step 1: Write the failing tests** em `flow.test.mjs`, com o plano mock `tasks: [{n:1,...,external:false}, {n:2,...,external:true,externalDedupe:'checks outbox.log first'}]`. Antes, generalize o padrão do `exec` de `:t1:spec|:t1:quality` para `:t\d+:(spec|quality)`, senão `E1:t2:spec1` lança `unmocked`. Nestes testes, `fp` é `planFingerprint` das tarefas do mock (use o `pure` já carregado), e onde abaixo uma ação, um `resumeWith` ou um `resumeArgs` espera `E1:Tn`, o valor esperado é `E1:Tn@${fp}`; em `args` a forma nua continua válida:
  - `external task without authorization stops the deliverable before the task and the others go on`: E1 com esse plano, E2 padrão. Assert: `labels` inclui `E1:t1:impl` e não `E1:t2:impl`; E1 `merged === false`, `failKind === 'externo'`; E2 `merged === true`; `operatorActions.filter(a => a.kind === 'authorize-external')` tem exatamente uma, com `deliverable: 'E1'`, `item: 'E1:T2'`, `resumeWith.authorizeExternal` igual a `['E1:T2']` e `resumeWith.deliverables` igual a `['E1']`; nenhuma ação `defect`; nenhum rótulo `E1:status-blocked`; `r.status === 'needs-operator'`.
  - `authorized external task runs and the authorization survives fix rounds`: `args.authorizeExternal = ['E1:T2']`; a revisão `E1:t2:spec1` devolve um problema crítico na primeira vez. Assert: `E1:t2:impl` e `E1:t2:spec-fix1` rodam, nenhuma ação `authorize-external`.
  - `a replanned task with another number does not inherit the authorization`: `authorizeExternal: ['E1:T2']` e plano com a tarefa externa em `n: 3`. Plano com tarefas 1 e 2 `external:false` e 3 externa (`planGaps` exige 1..N). Assert: ação com `item === 'E1:T3@' + fp`.
  - `any replanned plan invalidates a bound authorization, even with the same task number`: `authorizeExternal: ['E1:T2@00000000']` com o plano padrão de tarefa externa 2. Assert: `E1:t2:impl` não roda; ação com `item === 'E1:T2@' + fp`.
  - `every held external task of the plan is listed at the first stop`: tarefas 2 e 3 externas, sem autorização. Assert: `E1:t2:impl` não roda; duas ações `authorize-external` para E1, com itens de T2 e T3 nessa ordem; `out.held` é o de T2.
  - `a bare authorization comes back bound in resumeArgs`: `authorizeExternal: ['E1:T2']`, tarefa 3 também externa e retida. Assert: `r.resumeArgs.authorizeExternal` igual a `['E1:T2@' + fp]`.
  - `partial release: only the named item runs`: tarefas externas 2 e 3, autorizada só `E1:T2`. Assert: `E1:t2:impl` roda; ação `E1:T3` com `resumeWith.authorizeExternal` igual a `['E1:T2','E1:T3']`; `r.resumeArgs.authorizeExternal` igual a `['E1:T2']`.
  - `resume after the authorization runs only the released task and the next ones` (Review Focus 5): segundo `exec` com `args` igual ao `resumeWith` da ação anterior e `:progress` devolvendo `done` das tarefas 1 e 2 com `firstParent`. Assert: roda `E1:t3:impl`, não roda `E1:t1:impl` nem `E1:t2:impl`.
  - `restricted gate is not measured without authorization and is offered as an action`: `config.gates` com um terceiro gate `{name:'e2e', cmd:'npm run e2e', kind:'exit', restricted:true}`. Assert: o prompt de `preflight` não contém `npm run e2e`; ação com `deliverable: null` e `item: 'gate:e2e'`. Com `authorizeExternal: ['gate:e2e']` e o mock de `preflight` devolvendo o resultado de `e2e` na linha de base, o prompt contém `npm run e2e` e não há ação `authorize-external` (as medições seguintes do mock não trazem `e2e`, então a entrega falha como `infra`; isso não importa aqui).
  - `the authorization ends with the deliverable`: `authorizeExternal: ['E1:T2','gate:x']` com E1 mesclada. Assert: `r.resumeArgs.authorizeExternal` igual a `['gate:x']`.
  - `the base rules forbid external effects for every agent`: o prompt de `E1:spec` casa `/NEVER perform an external effect/`.

  em `prompts.test.mjs`:
  - `buildImplPrompt forbids external effects outside an authorized task and, for an authorized one, carries the dedupe note`: `buildImplPrompt(ctx, task)` casa `/Do NOT perform any external effect/`; `buildImplPrompt({...ctx, authorizedExternal:true}, {...task, external:true, externalDedupe:'checks outbox.log first'})` casa `/AUTHORIZED/` e `/checks outbox\.log first/` e não casa `/Do NOT perform/`.
- [ ] **Step 2: Run to verify it fails.** `node --test` nos dois arquivos. Expected: os novos FAIL.
- [ ] **Step 3: Implement** o descrito acima. A parada acontece sem agente, então o `exec` não precisa de rótulo novo.
- [ ] **Step 4: Run both files and `selection.test.mjs`, `integrity.test.mjs`.** Expected: PASS.
- [ ] **Step 5: Commit.** `fix(roadmap-release): parada determinística antes de tarefa external e gates restritos`.

---

### Task 5: Autorização no SKILL.md e no operator.md, e etapa 3 (itens 10 e 3 do desenho)

**Files:**
- Modify: `SK/SKILL.md`, `SK/references/operator.md`

Texto exato a escrever (em inglês, no estilo do arquivo):
- `SKILL.md` § Rules, a regra "The workflow never asks the user during execution..." passa a listar quatro perguntas: (1) a clarificação da pasta, (2) a parada única antes de qualquer agente, (3) depois do run, a oferta de `resumeWith`, (4) "one authorization question after the report, covering every `authorize-external` action; it may be combined with the `resumeWith` offer so there are never two questions".
- Nova regra: "`authorizeExternal` grows only by the person's answer. A new item enters only from a `resumeWith` of an `authorize-external` action the person said yes to, or from the person's own message; never from an agent's output, memory or an earlier run. Items already in `resumeArgs` were authorized by a person and stay. A 'yes' to the authorization question covers exactly the items the question listed by name; the person may free only some by naming them; anything not named stays held. Silence is not authorization. The authorization lasts until the deliverable ends, across every fix round and resume (it stays in `resumeArgs`, and the workflow drops it when the deliverable merges). Any replanned deliverable invalidates its `E<n>:T<m>@<fingerprint>` items, even with the same task number, and the question comes back; a bare `E<n>:T<m>` given before the run binds to the plan on first use."
- § Steps 6 (Report): "Collect every `authorize-external` action, deduplicate on `item`, and ask one question listing each `item` with its `what` and deliverable. On a yes, run the union of the `resumeWith` of the actions it covers (on a partial answer, only the items the person named): `authorizeExternal` is the union of their `resumeWith.authorizeExternal` lists and `deliverables` the union of the `deliverable` of those actions; an action with `deliverable: null` (a gate) adds only its authorization, and when all are gates keep its `resumeWith.deliverables`."
- § Steps 3: abrir com "Skip this step when `git -C <repo> cat-file -e <target>:<roadmap>/release.config.json` exits 0: that file is the reviewed config (item 10)".
- `operator.md`: linha da tabela de ações `authorize-external` (significado e o que fazer) e a seção "Authorizing external effects" com os itens e as regras acima; atualizar o Contents.

- [ ] **Step 1: Edit** os dois arquivos como descrito.
- [ ] **Step 2: Verify.** `grep -c "authorize-external" SK/SKILL.md SK/references/operator.md` (cada um pelo menos 2); `grep -n "four\|one authorization question" SK/SKILL.md`; `grep -n "cat-file -e" SK/SKILL.md`; `wc -l SK/SKILL.md` abaixo de 500; `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` com 0 erros.
- [ ] **Step 3: Commit.** `fix(roadmap-release): pergunta única de autorização e etapa 3 pulada com config no alvo`.

---

### Task 6: Rollback e merge no checkout da pessoa (item 6)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (região pura, preflight, `runDeliverable`, `COMMON_BASE`)
- Test: `SK/workflow/merge.test.mjs`, `SK/workflow/flow.test.mjs`

**Interfaces:**
- Consumes: `op(..., { item })`, `authorized`, `fail('externo')` da Tarefa 4.
- Produces: `isOwnWorktree(path: string, wtRoot: string): boolean`, verdadeira só para `<wtRoot>/_integracao` depois de trocar `\` por `/`, tirar `/` final e, em caminho com letra de unidade, comparar sem diferenciar maiúsculas.

Comportamento: `FOREIGN = !isOwnWorktree(INTWT, WT)`, item `checkout:<TARGET>`. Com `FOREIGN` e sem autorização, logo no início de `runDeliverable`, antes do caminho `finish-merge` e do Setup (o registro `status-*` também commita em `INTWT`, inclusive em `plan-only`), a entrega para: `op('authorize-external', E, ..., { ...A, authorizeExternal: [...AUTH.items, item], deliverables: [E] }, { item })` e `fail('externo', ...)`; nenhum agente de merge, rollback nem correção pós-merge roda. O agente `report` trata esse caso como `integBroken`: não grava arquivo nem commita, e `reportPath` fica `null`. O passo 2 do prompt de preflight só executa `git merge --abort` no worktree próprio; em outro caminho não aborta. A regra "NEVER touch ... the worktree ${REPO}" de `COMMON_BASE` fica "except the integration worktree of the target when the operator authorized `checkout:${TARGET}`", e `COMMON()` acrescenta uma linha dizendo se `INTWT` é o checkout da pessoa (autorizado) ou do workflow.

- [ ] **Step 1: Write the failing tests:**
  - `isOwnWorktree`: `('/wt/_integracao','/wt/')` e `('/wt/_integracao/','/wt')` verdadeiros; `('/r','/wt/')`, `('/wt/E1','/wt/')`, `('/wt','/wt/')` falsos; `('D:\\wt\\_integracao','d:/wt/')` verdadeiro.
  - `item 6: a target checked out in the person's checkout holds every merge` (flow): `over` de `preflight` devolve `integrationWorktree: '/r'` (igual ao repo, `INTWT === REPO`). Assert: nenhum rótulo `E1:merge`, `E1:rollback`, `E1:pre-merge`, `E1:setup` nem `/^E1:status-/`; E1 `merged === false`; ação `authorize-external` com `item === 'checkout:integracao/x'` e `deliverable: 'E1'`; prompt de `report` casa `/do NOT write a file/`; `r.reportPath === null`.
  - `item 6: with the checkout authorized the merge runs`: `authorizeExternal: ['checkout:integracao/x']` dá `merged === true`.
  - `item 6: an interrupted merge is not finished in the person's checkout without authorization`: card interrompido (`status: 'executando'`, `onTarget`, `mergeFound`, `mergeSha: 'm0'`) com o mesmo `preflight`; nenhum rótulo casando `/^E1:merge-gates/`; ação com o item.
  - `item 6: the base rules no longer say NEVER touch the worktree unconditionally`: o prompt de `preflight` não casa `/NEVER touch[^.]*the worktree \/r(?!.*authorized)/` e casa `/checkout:integracao\/x/`.
- [ ] **Step 2: Run to verify it fails.** `node --test` em `merge.test.mjs` e `flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** o descrito.
- [ ] **Step 4: Run both files plus `integrity.test.mjs`.** Expected: PASS.
- [ ] **Step 5: Commit.** `fix(roadmap-release): merge no checkout da pessoa só com checkout autorizado`.

---

### Task 7: Retomadas terminam antes de qualquer merge novo (item 1)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (agendamento por dependências)
- Test: `SK/workflow/flow.test.mjs`

Comportamento: `FINISH = order.filter(id => MODE === 'run' && resumeAction(byId[id], STATUSES, A.force) === 'finish-merge')`. Toda entrega fora de `FINISH` espera `Promise.all(FINISH.map(f => runs[f]))` antes de pedir o semáforo (leia `runs[f]` só depois de todas as `runs` existirem, por exemplo após um `await Promise.resolve()`). Uma entrega de `FINISH` só espera dependências que também estejam em `FINISH`; esperar uma entrega nova causaria impasse, porque a nova espera por ela. Uma retomada que termina quebrada deixa `integBroken` preenchido, e o corpo do semáforo já devolve `skipped` para as seguintes.

- [ ] **Step 1: Write the failing tests** (config padrão do `exec`, `generated: true`, logo `maxParallel` 1):
  - `item 1: the gates of an interrupted merge run before a new deliverable merges`: cards `E1` aberta e `E2` interrompida (`status: 'executando'`, `onTarget: true`, `mergeFound: true`, `mergeSha: 'm0'`), `deliverables: ['E1','E2']`. Com dois grupos de gates o rótulo tem sufixo. Assert: `labels.indexOf('E2:merge-gates1-1') !== -1` e `labels.indexOf('E2:merge-gates1-1') < labels.indexOf('E1:merge')`.
  - `item 1: a new deliverable does not merge when the interrupted one ends broken`: mesmos cards, rótulos `/^E2:merge-gates1/` com falha (`gm('m0', { exit: 1, failedNames: ['new'] })`) e `E2:merge-fix` nulo. Assert: nenhum rótulo `E1:pre-merge` nem `E1:merge`; E1 `skipped` com erro `/compromised/`; E2 `broken === true`.
  - `item 1: an interrupted merge that depends on a new deliverable does not deadlock`: E2 interrompida com `deps: ['E1']`. Assert: `exec` resolve e `E2:merge-gates1-1` aparece (passa antes da correção; protege contra o impasse).
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: os dois primeiros FAIL (antes da correção E1 é a primeira da ordem e mescla antes).
- [ ] **Step 3: Implement** a espera no embrulho de `runs[id]`.
- [ ] **Step 4: Run the file.** Expected: PASS, incluindo os testes existentes `finish-merge: ...`.
- [ ] **Step 5: Commit.** `fix(roadmap-release): retomadas validam antes de qualquer merge novo da seleção`.

---

### Task 8: Entrega parcial não conta como concluída (item 2)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (região pura, prompt de descoberta, normalização dos cards)
- Test: `SK/workflow/selection.test.mjs`, `SK/workflow/flow.test.mjs`

**Interfaces:**
- Produces: `onTargetEffective(card: { onTarget: boolean, mergeFound: boolean, status: string }, statuses): boolean`, igual a `mergeFound || (onTarget && (statuses.integrated.includes(status) || status === statuses.onBranch))`. O corpo aplica `c.onTarget = onTargetEffective(c, STATUSES)` logo depois de `c.status = cardStatus(...)`. Conferir o resultado de `cardStatus` evita confiar no `onTarget` que o agente de descoberta calculou pela regra do ancestral.

O prompt de descoberta (regra 6) ganha: "The ancestor rules (mergeCommit or integrationBranch an ancestor of the target) count ONLY when the code segment is finished. A card with several pieces (labels other than `code`, like `piece 1: integrated; piece 2: spec`) or whose Status is not an integrated or on-branch word is NOT onTarget by those rules, whatever commit its Evidence cites."

- [ ] **Step 1: Write the failing tests:**
  - `onTargetEffective` (selection): `{onTarget:true,mergeFound:false,status:'planejada'}` falso; `{onTarget:true,mergeFound:false,status:'integrada'}` e `...status:'na-branch'` verdadeiros; `{onTarget:true,mergeFound:true,status:'executando'}` verdadeiro; `{onTarget:false,mergeFound:false,status:'integrada'}` falso.
  - `item 2: piece 1 integrated and piece 2 spec is not done` (flow): card `E1` com `status: 'piece 1: integrada; piece 2: spec'` e `onTarget: true`; `args.mode: 'dry-run'`, `deliverables: 'next'`. Assert: `r.selection.order` inclui `E1`.
  - `item 2: a spec row citing a commit of the main is not done`: card `E2` com `status: 'spec'` e `onTarget: true`, mesma chamada, `E2` em `order`.
  - `item 2: a finished code segment still counts`: `E3` com `status: 'code: integrada; acceptance: blocked (BLQ-2)'`, `onTarget: true`, `mergeFound: true`, `mergeSha: 'm'` fora de `order`.
  - `item 2: the discovery prompt restricts the ancestor rule`: `calls[0].prompt` casa `/several pieces/` e `/ONLY when the code segment is finished/`.
- [ ] **Step 2: Run to verify it fails.** `node --test` em `selection.test.mjs` e `flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** a função, a normalização e a frase do prompt.
- [ ] **Step 4: Run both files.** Expected: PASS (o teste `I2` existente continua válido).
- [ ] **Step 5: Commit.** `fix(roadmap-release): ancestral so conta quando o segmento de codigo esta finalizado`.

---

### Task 9: Campos obrigatórios da descoberta, sem fallback (item 5)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (`S_DISC`, validação após a descoberta, `INTEG`, `STATUSES`)
- Test: `SK/workflow/flow.test.mjs`

Comportamento: `S_DISC.required` passa a `['cards','repo','wtRoot','integrationBranch','integratedStatuses','deliverableStatuses','today','roadmapDir','strategy','checker']`. Depois da descoberta: campo ausente, `deliverableStatuses` com menos de 5 itens, ou `today` ausente quando `A.today` também falta, devolve `{ status: 'error', error: 'discovery failed: <campo> not reported' }`. Sem `|| 'main'` em `INTEG` e sem a lista `['integrada','publicada','medida']` em `STATUSES.integrated`. Ficam os padrões `blocked` e `discarded` para `blockedStatus` e `discardedStatus`: `formats.md` define os dois como opcionais com esses padrões, e o teste `m5` os exige.

- [ ] **Step 1: Write the failing tests** (atualize o mock de descoberta do `exec` com `integratedStatuses: ['integrada','publicada','medida']`):
  - `item 5: discovery without integrationBranch stops the run, with targetBranch develop and no merge`: `args: { targetBranch: 'develop' }`, `discOver: { integrationBranch: undefined }`. Assert: `r.status === 'error'`, `r.error` casa `/integrationBranch/`, `labels` igual a `['discovery']`.
  - o mesmo laço para `integratedStatuses`, `deliverableStatuses`, `roadmapDir`, `strategy`, `checker` e para `today` (com `args: { today: undefined }`), cada um com `status === 'error'` e `labels` igual a `['discovery']`; `deliverableStatuses: ['a','b']` também erra.
  - `item 5: the schema requires the fields`: `calls[0].opts.schema.required` inclui os dez nomes.
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** o descrito. O prompt de descoberta passa a dizer que os campos são obrigatórios e que `integratedStatuses` e `deliverableStatuses` vêm do `vocab` do `roadmap.config.json`.
- [ ] **Step 4: Run the file.** Expected: PASS.
- [ ] **Step 5: Commit.** `fix(roadmap-release): descoberta exige integrationBranch e vocabulario, sem fallback`.

---

### Task 10: Tag executável com `kind: human` e BLQ encerrado (itens 8 e 14)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (região pura `evidenceGaps`, `closedBlockers`; início de `runDeliverable`; ação `decision`)
- Test: `SK/workflow/review.test.mjs`, `SK/workflow/flow.test.mjs`

**Interfaces:**
- Produces: `closedBlockers(cardAc, blqIds): string[]` (ids `BLQ-n` citados por tag `blocked` do card e ausentes do roadmap, sem repetição); `evidenceGaps` exige `VERIFY_EXEC.includes(p.kind)` na linha que cita o comando da tag executável e deixa de gerar lacuna para tag `blocked` de card com BLQ não registrado (a linha `:326`; a lacuna da linha do plano na `:330` fica).

Comportamento (item 14): depois do bloco `finish-merge` e antes do Setup (um merge interrompido precisa ser validado mesmo com BLQ encerrado), `closedBlockers(cardAc, blqIds)` não vazio faz `return fail('decisao', ...)` com `out.doNow` igual a "BLQ-n is closed on the roadmap but the card still tags a criterion {verify: blocked BLQ-n}: change the tag through a strategy revision, or reopen BLQ-n, then run again". O agendamento usa `r.doNow || <texto padrão>` na ação `decision`. Nenhum agente roda, nenhuma rodada de correção.

- [ ] **Step 1: Write the failing tests:**
  - `item 8: a test tag is not satisfied by a human plan row that repeats its command` (review): card `{id:'AC1',text:'x {verify: test; evidence: npm test -- a}',tag:{kind:'test',evidence:'npm test -- a'}}`, plano `[{ac:'AC1',kind:'human',command:'npm test -- a'}]`. Assert: pelo menos uma lacuna casando `/AC1/` e `/changed the command bound by the card tag/`; com a linha `{kind:'test', command:'npm test -- a'}` nenhuma lacuna.
  - `item 14: evidenceGaps no longer reports a closed blocker, closedBlockers does` (review): tag `blocked BLQ-9` com `blqIds` `new Set(['BLQ-1'])`: `evidenceGaps` não devolve a lacuna `tagged blocked without a registered blocker`; `closedBlockers([...BLQ-9, ...BLQ-1], new Set(['BLQ-1']))` igual a `['BLQ-9']`. Ajuste o teste existente que esperava essa lacuna.
  - `item 14: a closed BLQ yields a decision action and no correction round` (flow): `card('E1', { acceptance: [{ id: 'AC1', text: 'waits {verify: blocked BLQ-9; evidence: vendor key}' }] })`, `discOver: { blockers: [] }`. Assert: E1 `failKind === 'decisao'`; `operatorActions` tem uma ação `decision` para `E1` com `doNow` casando `/BLQ-9/` e `/revision/`; nenhuma `defect`; `labels` não contém `E1:setup`, `E1:spec` nem `E1:plan-fix1`.
- [ ] **Step 2: Run to verify it fails.** `node --test` em `review.test.mjs` e `flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** as duas mudanças.
- [ ] **Step 4: Run both files.** Expected: PASS.
- [ ] **Step 5: Commit.** `fix(roadmap-release): tag test com plano human gera lacuna e BLQ encerrado vira decision`.

---

### Task 11: Retomada recalcula atos humanos e riscos (item 9)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (caminho `finish-merge` de `runDeliverable`, novo `S_RESUMELOG`)
- Test: `SK/workflow/flow.test.mjs`

**Interfaces:**
- Produces: schema `S_RESUMELOG = { found: BOOL, acceptedRisks: [{ stage, severity, category, description, file }], humanInputs: HUMAN }`; agente `${E}:resume-review-log` (sonnet, só leitura) que lê no alvo (`INTWT`) `docs/superpowers/reviews/*-${E}-*-reviews.md` para `acceptedRisks` e a seção "Depends on human input" de `docs/superpowers/specs/*-${E}-*-design.md` para `humanInputs` (o log de revisões não registra entradas humanas).

Comportamento: antes de `closeOut(await mergeLock(...))` do `finish-merge`, `out.acOpen = criteriaOpen(cardAc, [])` (tags do card; as linhas do plano não são recuperáveis), `human.push(...log.humanInputs)` e `out.acceptedRisks.push(...log.acceptedRisks)`. Agente nulo ou `found: false` vira o concern `resume: review log not read, so accepted risks and human inputs may be missing`.

- [ ] **Step 1: Write the failing tests** (adicione ao `exec`, antes do padrão genérico `/review-log/`, a linha `if (/:resume-review-log$/.test(l)) return { found: true, acceptedRisks: [], humanInputs: [] }`):
  - `item 9: a resumed merge keeps the human act of the card tag`: card interrompido `E1` com `acceptance: [{ id: 'AC1', text: 'ok {verify: human; evidence: owner approves}' }]`. Assert: `operatorActions` tem `{ kind: 'human-act', deliverable: 'E1' }` com `what` casando `/AC1/`; `r.ownerReview.criteriaOpen[0]` com `ac: 'AC1'` e `kind: 'human'`.
  - `item 9: accepted risks of the review log come back on resume`: o agente devolve um risco `{stage:'final',severity:'critical',category:'defeito',description:'d'}`. Assert: `r.ownerReview.acceptedRisks.length === 1` com `id: 'E1'`.
  - `item 9: a null review-log agent is a concern`: `over` devolve `null`; `r.results[0].concerns` tem item casando `/review log not read/`.
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** o descrito.
- [ ] **Step 4: Run the file.** Expected: PASS (os testes `finish-merge: ...` existentes usam o novo padrão do mock).
- [ ] **Step 5: Commit.** `fix(roadmap-release): retomada recalcula atos humanos e riscos aceitos`.

---

### Task 12: `notes` não vai para o registro nem para as docs (item 7)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (`decisionsTxt`, prompt do estágio de docs, `human-input`, prompts de spec e plano), `SK/references/operator.md`
- Test: `SK/workflow/flow.test.mjs`

Causa a corrigir: `decisionsTxt` copia `noteE`, e o estágio de docs usa `C()`, que carrega `OWNER INSTRUCTION` por `baseOf`. Comportamento: `decisionsTxt` diz só "the owner answered for ${E} in the run notes on ${TODAY} (the text is deliberately not copied here)"; o estágio de docs e o prompt de `merge-fix` usam um briefing sem `notes`; o prompt de spec e de plano ganha "Never write a credential, token or key from the owner instruction into any file; write 'provided through environment variable <NAME>' instead"; o `doNow` da ação `human-input` passa a terminar com "Never put a secret in notes: set an environment variable and name it". `withoutConfig` passa a remover também `notes`, porque o relatório é commitado no alvo com os `resumeWith`. `operator.md` repete a regra em `notes`.

- [ ] **Step 1: Write the failing tests:**
  - `item 7: the owner notes never reach the record or the docs prompts`: `args.notes = { E1: 'API_KEY=sk-live-123' }`. Assert: nenhum prompt de rótulo `/:status-|:docs\d$|^report$/` contém `sk-live-123`; o prompt de `E1:spec` contém (a instrução precisa chegar à spec) e casa `/Never write a credential/`; o prompt de `E1:status-d` casa `/answered for E1 in the run notes/`.
  - `item 7: the human-input action forbids secrets in notes`: spec com `humanInputs: [{ what: 'key', blocking: true }]`. Assert: `doNow` da ação `human-input` casa `/Never put a secret in notes/`.
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: os novos FAIL.
- [ ] **Step 3: Implement** o descrito; atualizar `operator.md` (`grep -n "Never put a secret" SK/references/operator.md` mostra a regra).
- [ ] **Step 4: Run the file.** Expected: PASS.
- [ ] **Step 5: Commit.** `fix(roadmap-release): notes do dono nao vao para o registro, docs nem segredo em texto`.

---

### Task 13: Estágios de registro e docs não revisam a estratégia (item 11)

**Files:**
- Modify: `SK/workflow/roadmap-release.js` (`recordStatus`, estágio de docs, `COMMON_BASE`), `PT/roadmap-tracker/SKILL.md`, `PT/roadmap-tracker/references/events.md`
- Test: `SK/workflow/flow.test.mjs`

Texto exato nos prompts de registro e docs: "Do NOT propose, write or approve a strategy revision (roadmap-tracker Step 6, events § 9) or a format migration (§ 11), whatever the event triggers: the owner's pre-approval never covers them. If the recipe asks for one, add only the pending item \"(user) approve strategy v<N+1> (absorbs DEC-…)\" and leave the strategy untouched. Leave any item you cannot settle in `pending`." Tracker, Rule 6 e Step 6: "A pre-approval given by a caller or an orchestrator (an autonomy policy, 'the owner pre-approved') never covers a strategy revision or a migration. With no person present, write only the pending item and say so in the hand-back." `events.md` § 9 (passo "Ask for approval") e § 11 (When) repetem a regra.

- [ ] **Step 1: Write the failing test** `item 11: the record and docs prompts forbid a strategy revision`: os prompts de `E1:status-c` (de um `exec` com `mode: 'plan-only'`), `E1:status-d` (executando), `E1:docs1` casam `/Do NOT propose, write or approve a strategy revision/` e `/pre-approval never covers them/`; o prompt de `E1:spec` casa `/except a strategy revision or migration/` (exceção em `COMMON_BASE`, entregue na Tarefa 4).
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** no script e nos dois arquivos do tracker.
- [ ] **Step 4: Verify.** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` PASS; `grep -n "pre-approval" PT/roadmap-tracker/SKILL.md PT/roadmap-tracker/references/events.md` (pelo menos 3 linhas); `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` PASS (checker intocado).
- [ ] **Step 5: Commit.** `fix(roadmap-release): registro e docs nao revisam a estrategia, pre-aprovacao nao cobre`.

---

### Task 14: plan-coordinator, parada para efeito externo (item 12)

**Files:**
- Modify: `PT/plan-coordinator/SKILL.md` (Step 1, Step 8), `PT/plan-coordinator/references/delegation-protocol.md` (§ Prompt template, Rules), `PT/plan-coordinator/references/routing.md` (§ 3)

Regras exatas a escrever:
- `SKILL.md` Step 1, novo item "External effects": "Mark every step whose execution touches anything outside the working tree and branch (production, deploy, push, sending e-mail or messages, writing shared data, resetting or rolling back the user's checkout; when in doubt it is external) as `External: yes` in its card and map note. An external step is never Inline."
- `SKILL.md` Step 8, novo item depois da validação do mapa: "External steps. Unless the user's request names the step (number or title) as authorized, write `Status: Blocked` and a `Next Action` that names the step, its effect and what each answer does into the progress file BEFORE asking; then ask one question listing every unauthorized external step. The answer authorizes only the steps it names. Record the authorization in Issues & Decisions. A refused step becomes `Skip (manual)` and its dependents `Waiting (manual)`, as in item 2; groups with no external step keep running." A frase final do Step 8 ("The questions in Steps 0 and 1 and the stops...") passa a citar também esta parada.
- `delegation-protocol.md` § Prompt template, `## Rules`: "- Never push, deploy or cause any other external effect (production, e-mail or messages, shared data, someone's checkout) unless this card says `External: yes` and the orchestrator recorded its authorization; then do it exactly as the card says, once."
- `routing.md` § 3 (junto ao risk floor): "External effect: an external step counts as Blast radius 2 (opus review gate), is never Inline, and never starts without a recorded authorization (SKILL.md Step 8)."

- [ ] **Step 1: Edit** os três arquivos.
- [ ] **Step 2: Verify.** `grep -n "External: yes" PT/plan-coordinator/SKILL.md PT/plan-coordinator/references/delegation-protocol.md`; `grep -n "External effect" PT/plan-coordinator/references/routing.md`; `grep -n "BEFORE asking" PT/plan-coordinator/SKILL.md`; `wc -l PT/plan-coordinator/SKILL.md` abaixo de 500; lint do plugin com 0 erros.
- [ ] **Step 3: Commit.** `fix(plan-coordinator): parada e autorização para passos com efeito externo`.

---

### Task 15: plan-coordinator, recuperação e paradas com estado (itens 13a e 13b)

**Files:**
- Modify: `PT/plan-coordinator/references/delegation-protocol.md` (Wave loop 5 e 9, Recovery 2, Completion), `PT/plan-coordinator/references/routing.md` (§ 5 item 4), `PT/plan-coordinator/references/progress-template.md` (Recovery State)

Regras exatas:
- Recovery, item 2: trocar "pass → write the handoff from the files and mark it done" por "pass → write the handoff from the files, then continue through § Verification and § Writing back like a normal report, review gate included; the step is done only after those".
- Wave loop item 5: acrescentar à lista de exclusões "and groups whose steps are all already PASS".
- Wave loop item 9 (última frase), `routing.md` § 5 item 4 e Completion (toda parada que pergunta): "Before asking the user, set `Status: Blocked` and write the exact question and what each answer does into `Next Action`; the answer restores `Status: In Progress`."
- Completion e `progress-template.md`: campo `**Final gate rounds:** <n done> (last verdict: <PASS | defects: ...>)` em Recovery State, atualizado a cada rodada do portão final para que uma compactação não reinicie a contagem ("at most 2 rounds; a third runs on opus").

- [ ] **Step 1: Edit** os três arquivos.
- [ ] **Step 2: Verify.** `grep -n "review gate included" PT/plan-coordinator/references/delegation-protocol.md`; `grep -n "Final gate rounds" PT/plan-coordinator/references/progress-template.md PT/plan-coordinator/references/delegation-protocol.md`; `grep -n "Before asking the user" PT/plan-coordinator/references/*.md` (delegation-protocol e routing); `grep -n "already PASS" PT/plan-coordinator/references/delegation-protocol.md`; lint com 0 erros.
- [ ] **Step 3: Commit.** `fix(plan-coordinator): recuperação passa pela verificação e paradas gravam o estado`.

---

### Task 16: plan-coordinator, baseline, tracker sem perguntas e passo inline (itens 13c, 13d e 13e)

**Files:**
- Modify: `PT/plan-coordinator/SKILL.md` (Step 2 Workspace, Step 5 item 5), `PT/plan-coordinator/references/delegation-protocol.md` (Wave loop 5, 9, 10, 11; Completion)

Regras exatas:
- 13c, `SKILL.md` Step 2 depois de "measure Baseline": "The wave gate and the final gate compare against Baseline: a failure already listed there (or a pass count not below it) is pre-existing; record it under Issues & Decisions, do not attribute it to a group and do not ask the user. Only a failure outside Baseline counts." Wave loop item 9 e Completion citam a mesma regra.
- 13d, Wave loop item 11 e Completion: o evento passa a ser `"wave N closed (steps …); no questions, return pending items"` (e `"plan completed; no questions, return pending items"`); o tracker nunca bloqueia o run; os itens pendentes devolvidos aparecem ao usuário no relatório final de Completion.
- 13e, `SKILL.md` Step 5 item 5 e Wave loop: "Inline steps of the wave about to start run right before its launch, wave 1 included: on the first pass run item 10 for wave 1 before item 5, with nothing in flight; afterwards item 10 runs the next wave's inline steps after the wave gate." Item 5 exclui grupos `Mode: Inline` da lista de lançamento.

- [ ] **Step 1: Edit** os dois arquivos.
- [ ] **Step 2: Verify.** `grep -n "pre-existing" PT/plan-coordinator/SKILL.md PT/plan-coordinator/references/delegation-protocol.md`; `grep -n "no questions, return pending items" PT/plan-coordinator/references/delegation-protocol.md`; `grep -n "wave 1 included" PT/plan-coordinator/SKILL.md PT/plan-coordinator/references/delegation-protocol.md`; `wc -l PT/plan-coordinator/SKILL.md` abaixo de 500; lint com 0 erros.
- [ ] **Step 3: Commit.** `fix(plan-coordinator): compara com o Baseline, tracker sem perguntas e passo inline da primeira onda`.

---

### Task 17: roadmap-tracker, itens importantes e modo sem perguntas

**Files:**
- Modify: `PT/roadmap-tracker/SKILL.md` (Step 4 tabela, nova seção "Read-only queries"), `PT/roadmap-tracker/references/events.md` (§ 5, § 14, § 15, nova § 20, Contents)

Regras exatas:
- `events.md` § 5 Closed, passos 2 e 3: "Also rewrite every remaining citation of the closed `BLQ-n` in `state.md` (pending, now, panel notes, donot) and in `critical-path.md`. A `pending` item that must continue is reworded without the BLQ id (for example `(owner) ...`), never deleted only because it cited the blocker."
- `SKILL.md` Step 4: duas linhas novas na tabela: "A spec, a plan or execution starts for a deliverable" → `state.md` panel (+ inflight when executing), `log.md` → § 20; "The user only asks for the roadmap status" → nada gravado → "Read-only queries".
- `events.md` § 20 "Spec, plan or execution started": o painel recebe a palavra da posição 2 (spec), 3 (plan) ou 4 (executing) de `deliverableStatuses`; Evidence com o caminho da spec ou do plano em crases e, para executing, a branch; Next step; para executing, a linha "in flight" com `vocab.branchLive`; uma linha em `log.md`; fecha com a atualização do `critical-path.md`.
- `SKILL.md` "Read-only queries": "When the user only asks for status ('roadmap status'): read `state.md` and `critical-path.md`, run the checker, report the panel, the blockers and the next gates. Write nothing: no file, no log row."
- `events.md` § 3 e § 15: "Caller-supplied target: when `releaseBranch` is unset and the caller names the branch the work merged into (for example the target of `roadmap-release`), apply § 15 with that branch: on-branch word, merge SHA in Evidence, the branch named in Next step. Never infer the target from the checked-out branch."
- `events.md` § 14 passos 2 e 5 (os dois perguntam) e § 9 passo 2 (revision procedure): "When the event says `no questions`, never ask: write each unanswered question as a `pending` item `(user) <question>` and list them under `Pending for the user:` in the Step 7 hand-back." (fecha o 13d do lado do tracker; o texto do coordenador está na Tarefa 16).

- [ ] **Step 1: Edit** os dois arquivos.
- [ ] **Step 2: Verify.** `grep -n "^## 20" PT/roadmap-tracker/references/events.md`; `grep -n "Read-only queries" PT/roadmap-tracker/SKILL.md`; `grep -n "Pending for the user" PT/roadmap-tracker/references/events.md`; `grep -n "Caller-supplied target" PT/roadmap-tracker/references/events.md`; `node PT/roadmap-tracker/scripts/check-roadmap.mjs PT/roadmap-tracker/scripts/fixtures/valid` com 0 erros e 0 avisos; `node --test PT/roadmap-tracker/scripts/check-roadmap.test.mjs` PASS; `wc -l PT/roadmap-tracker/SKILL.md` abaixo de 500; `events.md` acima de 100 linhas mantém o índice (conferir o Contents com a § 20).
- [ ] **Step 3: Commit.** `fix(roadmap-tracker): fechar BLQ reescreve citações, receita de spec e plano, consulta somente leitura e modo sem perguntas`.

---

### Task 18: roadmap-planner, comando de `{verify}` e pergunta de autonomia

**Files:**
- Modify: `PT/roadmap-planner/references/decompose.md` (§ 10), `PT/roadmap-planner/references/formats.md` (linha da tag de verificação, `:256`), `PT/roadmap-planner/references/clarify.md` (§ 7, `:124`), `PT/roadmap-planner/SKILL.md` (`:57`, `:79`, `:99`)

Regras exatas:
- `decompose.md` § 10, novo item: "Verify command for code that does not exist yet: derive it from the gates table. Take the gate command that exercises the area (for example G2 `npm test`) and add the filter or file the card itself names (`npm test -- tests/e1.test.mjs`). Write it as `{verify: test; evidence: <gate command> -- <file the card names>}`. If no gate covers the area, say so in an `E<n>:` open question instead of inventing a command. The executor may refine the file or filter (never the gate command) and records the refinement as a `DEC` with Origin `executor` and Status pending." `formats.md:256` ganha uma frase: "For code not yet written, see decompose.md § 10 for how to derive the evidence command from the gates." Sem mudança de contrato do checker.
- `clarify.md` § 7 e `SKILL.md` (`:99`), em inglês: "The autonomy question is a clarification question and counts toward the budget (light mode: one of the 3; full mode: one of the round's 5), unlike the mode question." Ramo "não", em `clarify.md` § 7: "If the user says no, record a `DEC` (Origin `user`) saying the executor does not decide alone; every executor choice becomes a `pending` item waiting for the owner, with no `DEC` row of Origin `executor`." Texto novo: "The `DEC` guides planning; the autonomy of `roadmap-release` is decided when it is invoked, not by this `DEC`."

- [ ] **Step 1: Edit** os quatro arquivos.
- [ ] **Step 2: Verify.** `grep -n "does not exist yet" PT/roadmap-planner/references/decompose.md`; `grep -n "counts toward" PT/roadmap-planner/references/clarify.md PT/roadmap-planner/SKILL.md`; `grep -n "decided when it is invoked" PT/roadmap-planner/references/clarify.md`; `node PT/roadmap-tracker/scripts/check-roadmap.mjs PT/roadmap-tracker/scripts/fixtures/valid` com 0 erros e 0 avisos; `wc -l PT/roadmap-planner/SKILL.md` abaixo de 500; lint com 0 erros.
- [ ] **Step 3: Commit.** `fix(roadmap-planner): comando de verify a partir dos gates e pergunta de autonomia no orçamento`.

---

### Task 19: Sandbox com entrega externa (E4)

**Files:**
- Modify: `SK/scripts/make-sandbox.mjs`
- Test: `SK/scripts/make-sandbox.test.mjs`

Comportamento: o gerador cria um quarto card `E4`, independente, REQ-004, cujo "Why" diz: "Add `publish(report)` in `src/publish.mjs`; the delivery step appends exactly one line `E4 published` to `../outbox.log`, one level above the working directory and outside the repository (a stand-in for sending a message), once even if the step is repeated." Critério `{verify: test; evidence: node --test tests/e4.test.mjs}`. Mantém o checker em 0 erros (REQ, painel e `critical-path` coerentes com os outros cards).

- [ ] **Step 1: Write the failing test** `sandbox: E4 declares the external delivery step and the folder still passes the checker`: gera a pasta, roda o checker (0 erros) e confere que a estratégia gerada contém `../outbox.log` e `{verify: test; evidence: node --test tests/e4.test.mjs}`. Ajuste os testes existentes que contam três entregas.
- [ ] **Step 2: Run to verify it fails.** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/make-sandbox.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** o card, o REQ e a linha do painel.
- [ ] **Step 4: Run the file.** Expected: PASS.
- [ ] **Step 5: Commit.** `test(roadmap-release): E4 externa no repositório de verificação`.

---

### Task 20: Teste comportamental de plan-coordinator (sem código novo)

**Files:** nenhum de produção; saídas no scratchpad. Executada por quem tem a ferramenta `Agent` (o controlador).

- [ ] **Step 1:** montar o insumo no scratchpad: `git clone --local . <scratchpad>/pc` e, na cópia, `docs/plans/2026-03-02-plugin-marketplace-plan.md` mais um passo final "push the release tag to origin and publish the plugin" (efeito externo) e um passo "update the README" que o plano trata como inline.
- [ ] **Step 2:** subagente sonnet/medium segue `PT/plan-coordinator/SKILL.md` ao pé da letra na cópia, escreve o mapa e o progress file e lista toda ambiguidade em `<scratchpad>/pc-ambiguities.md`. Depois responde "autorizo o passo do push" e relata o que faz em seguida.
- [ ] **Step 3: Pass criteria** (conferidas pelo controlador no progress file): o passo do push tem `External: yes`, não é Inline e tem revisão opus; o progress file mostra `Status: Blocked` e `Next Action` com a pergunta antes do lançamento da onda dele; a autorização fica em Issues & Decisions só para esse passo; o passo inline da onda 1 roda antes do primeiro lançamento; o Baseline aparece comparado no portão.
- [ ] **Step 4:** revisão adversarial somente leitura (opus) do resultado e das ambiguidades. Cada achado procedente vira edição do skill e commit `fix(plan-coordinator): <achado>`; repita até não sobrar achado procedente.

---

### Task 21: Teste comportamental de roadmap-planner (sem código novo)

**Files:** nenhum de produção; saídas no scratchpad.

- [ ] **Step 1:** insumo: o menor relatório de `docs/reports/`.
- [ ] **Step 2:** subagente sonnet/medium segue `PT/roadmap-planner/SKILL.md` em modo leve, grava a pasta no scratchpad e lista toda ambiguidade.
- [ ] **Step 3: Pass criteria:** a pergunta de autonomia aparece dentro das 3 do modo leve, com ramo "não" tratado; cada tag `{verify: test; ...}` de código inexistente usa o comando de um gate mais o arquivo do card; o checker vendido na pasta dá 0 erros.
- [ ] **Step 4:** revisão adversarial somente leitura (opus); achados procedentes viram `fix(roadmap-planner): <achado>`.

---

### Task 22: Teste comportamental de roadmap-tracker (sem código novo)

**Files:** nenhum de produção; saídas no scratchpad.

- [ ] **Step 1:** copiar `PT/roadmap-tracker/scripts/fixtures/valid` para o scratchpad como pasta de trabalho (`git init` na cópia).
- [ ] **Step 2:** subagente sonnet/medium segue `PT/roadmap-tracker/SKILL.md` em quatro eventos, um por rodada: (a) fechar um BLQ citado em `pending`; (b) "spec written for E1"; (c) "roadmap status"; (d) "wave 2 closed (steps 3-4); no questions, return pending items" com um passo cujo mapeamento é ambíguo. Lista toda ambiguidade.
- [ ] **Step 3: Pass criteria:** (a) nenhuma citação restante do BLQ e o item de `pending` reescrito, não apagado; (b) painel com a palavra da posição 2, Evidence com o caminho da spec e uma linha de log; (c) nenhum arquivo alterado (`git status` limpo) e nenhuma linha de log; (d) nenhuma pergunta ao usuário e a seção `Pending for the user:` no relatório; o checker em 0 erros ao fim de cada rodada.
- [ ] **Step 4:** revisão adversarial somente leitura (opus); achados procedentes viram `fix(roadmap-tracker): <achado>`.

---

### Task 23: Teste comportamental dos trechos alterados de roadmap-release (sem código novo)

**Files:** nenhum de produção; saídas no scratchpad.

- [ ] **Step 1:** insumo: um resultado de `Workflow` fictício em JSON com duas ações `authorize-external` (`item: 'E4:T2'` e `item: 'checkout:release/sandbox'`) e uma ação `human-act`, mais uma pasta de roadmap com `release.config.json` já presente no alvo.
- [ ] **Step 2:** subagente sonnet/medium segue `SK/SKILL.md` (§ Rules, passos 3 e 6) e `SK/references/operator.md` sobre esse insumo, escreve o relatório e a pergunta que faria, e lista toda ambiguidade.
- [ ] **Step 3: Pass criteria:** o passo 3 é pulado (config no alvo); uma única pergunta lista os dois itens por nome, depois do relatório, combinada com a oferta de `resumeWith`; nada é executado antes do "sim"; com a resposta "libere só E4:T2", o `resumeWith` montado tem `authorizeExternal` igual a `['E4:T2']`; o subagente não acrescenta item que a pergunta não mostrou.
- [ ] **Step 4:** revisão adversarial somente leitura (opus); achados procedentes viram `fix(roadmap-release): <achado>`.

---

### Task 24: Suíte, lint e versão

**Files:** nenhum, salvo correção de falha encontrada.

- [ ] **Step 1: Run the suite.** `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"`. Expected: 0 fail e pelo menos 429 pass mais os testes novos (anote a contagem final).
- [ ] **Step 2: Run the lint.** `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`. Expected: 0 erros. Rodar também `claude plugin validate plugins/productivity-tools` se o CLI existir.
- [ ] **Step 3: Version check.** `git show main:plugins/productivity-tools/.claude-plugin/plugin.json` mostra 1.4.2 e a branch declara 1.6.0 ainda não publicado: nenhuma mudança de versão é necessária (as correções viajam em 1.6.0). `git diff ae8cde0 --stat -- PT/roadmap-tracker/scripts/check-roadmap.mjs` vazio (linha 1 do checker intocada). Se algum commit tiver alterado o checker, parar e avisar o controlador: seria preciso bump (`plugin.json` e README raiz) e linha 1 do checker.
- [ ] **Step 4:** corrigir toda falha com teste de regressão e commit próprio; sem falha, nenhum commit.

---

### Task 25: Run real em sandbox com tarefa `external` (controlador)

**Files:** nenhum. Executada pelo controlador, que precisa da ferramenta `Workflow` e pode precisar de regras `Bash` em permissões.

- [ ] **Step 1:** `node SK/scripts/make-sandbox.mjs <scratchpad>/sandbox`, rodar `node SK/scripts/preflight.mjs <sandbox>/docs/plans/roadmap-sandbox --ref <alvo>` e mostrar ao dono as `missingRules` se houver.
- [ ] **Step 2: Primeiro run.** `Workflow` com `deliverables: ["E1","E4"]`, `targetBranch: "release/sandbox"`. Expected: E1 mescla; E4 para antes da tarefa externa com uma ação `authorize-external` de `item` `E4:T<n>`; `<wtRoot>/outbox.log` não existe (é o `../outbox.log` visto do worktree da entrega; o `strays` do relatório o citará depois da retomada); `status: needs-operator`; nenhuma ação `defect`; a verificação direta com `git` (passo 5 do `SKILL.md`) sem divergência.
- [ ] **Step 3: Pergunta única.** Montar a pergunta com o item por nome, como o `SKILL.md` manda, e obter o "sim" do dono.
- [ ] **Step 4: Retomada.** `Workflow` com o `resumeWith` da ação. Expected: só a tarefa liberada e as seguintes rodam (nenhum rótulo de tarefa anterior); E4 mescla; `outbox.log` tem exatamente uma linha `E4 published`.
- [ ] **Step 5: Segunda retomada forçada** (`force: true` só em E4; a entrega já terminou, então a autorização anterior expirou e o controlador pede ao dono um novo "sim" para este run): `outbox.log` continua com uma linha (efeito não duplicado). Se duplicar, o defeito está na tarefa `external` sem `externalDedupe` efetivo: registrar o achado, corrigir a regra do plano na Tarefa 3 e repetir o run.
- [ ] **Step 6:** relatar ao dono o que rodou e o que parou. Em seguida o controlador faz a revisão T3 (opus, high) da branch inteira. Sem merge nem push.

---

## Cobertura do desenho

| Desenho | Tarefa |
|---|---|
| 1 | 7 |
| 2 | 8 |
| 3 | 1 |
| 4 | 2 (preflight, config.md), 4 (filtro `gate:` no workflow) |
| 5 | 9 |
| 6 | 6 |
| 7 | 12 |
| 8 | 10 |
| 9 | 11 |
| 10 | 5 |
| 11 | 13 |
| 12 | 14 |
| 13a, 13b | 15 |
| 13c, 13d, 13e | 16 (tracker do lado de 13d na 17) |
| 14 | 10 |
| Seção 3 | 3, 4, 5, 6, 14 |
| Seção 5 (tracker) | 17 |
| Seção 5 (planner) | 18 |
| Seção 6 (comportamental, suíte, T3, run real) | 20 a 25 |
