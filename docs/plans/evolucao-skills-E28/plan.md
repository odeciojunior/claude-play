# Plano E28 -- Revisão única por tarefa com dois veredictos (metade adiada do critério 3 de E21)

**Roadmap:** docs/plans/roadmap-evolucao-skills

**Spec:** `docs/plans/evolucao-skills-E28/spec.md`. Worktree `D:/projects/claude-play-wt/E28`, branch `feat/E28`, a partir da ponta `1017db5` da release. Nenhuma tarefa precisa de navegador nem de servidor. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main`, na branch de release nem em `D:/projects/claude-play`, sem bump de versão, sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (241.819 caracteres LF): no bloco `// <pure>` (linhas 56-1284), `SEV` e `blocking` (~378-381), `fmt` (~390), `restrictedRound(c)` (~394), `taskIssues(r, c)` (~399, hoje só a junção do modo restrito), `reviewTruth` (~409), `reviewModelFor` (~424), `runReviewLoop` (~519), `buildTaskReviewPrompt(ctx, task, kind, impl)` (~603; a linha `Mode: ${rr ? 'restricted, ' : ''}${kind}` já escreve `Mode: review` e `Mode: restricted, review`). Fora do bloco: `PF` e `S_TASKREVIEW` (~1422-1423, já com `spec` e `quality`), `NO_ASK`, `implAgent` e `revAgent` (~1750-1752), `C = () => briefing(ctxFor())` (~1844), e no laço por tarefa de `runDeliverable` (~2613-2632): `const TR = { restricted: (CFG.taskReview || {}).restricted === true }`, `for (const kind of ['spec', 'quality'])`, o despacho por `revAgent` com `model: rvModel || reviewModelFor(t)` e `effort: effortFor(...)`, o corretor `implAgent(\`${C()} ... fix the ${kind} problems below ...\`, { label: \`${E}:t${t.n}:${kind}-fix${k}\` ... })` e `truth` com `taskIssues(r, cx)`.
- `plugins/productivity-tools/agents/task-reviewer.md`: modos `spec`, `quality`, `review` (sem uso) e `restricted`; seção `## Review mode` com duas frases.
- `skills/roadmap-release/scripts/preflight.mjs` (~25-30): `validateReleaseConfig` aceita só `taskReview.restricted` e recusa outra chave com `taskReview.<k> is not a supported key (only taskReview.restricted)`. `references/config.md` linha 21 documenta só `restricted`; linha 58 traz a regra de `review-package.mjs` só com `restricted`.
- Testes: `workflow/review.test.mjs` (`SRC` cru ~100, `P2 = loadPure()`, `rTask`, `rImpl`, `F(id, description)`, `rCtx(over)` ~547-552; `AC2: taskReview is normalized once in runDeliverable and only true turns a mode on` ~601 e `AC3: by default each task gets the spec and quality reviews on today's model` ~630 afirmam a ausência de `single`); `workflow/prompts.test.mjs` (`ctx`, `task`, `impl` ~9-16, `reviewerAgent()` ~14, `AC5: task review prompts cite no superpowers and forbid asking` ~198); `workflow/flow.test.mjs` (arnês `exec({ cards, deliverables, config, over })` ~176, `withPlan` ~1026, retorno padrão das revisões por tarefa só para rótulos `spec|quality` ~207; `restrictedRun` ~4586 e `AC3: default spec and quality reviews on the task-reviewer agent` ~4611); `scripts/preflight.test.mjs` (`E21: validateReleaseConfig accepts a missing taskReview and restricted only, refuses other shapes and keys` ~784 e a regra de `review-package.mjs` ~797); `workflow/size.test.mjs` (`MAX_WORKFLOW_CHARS = 250000`, `workflowChars`), que não muda.

## Tamanho do script

Medido na ponta `1017db5`: 241.819 caracteres LF, teto 250.000 (DEC-647), folga 8.181 ≥ 450 exigidos pelo card (comando e saída na spec, seção "Folga medida"). Só a Tarefa 2 edita `roadmap-release.js`; acréscimo esperado de poucas centenas de caracteres. Ela mede depois de cada edição com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` e relata o total. Acima de 250.000, para com `BLOCKED`, diz quantos caracteres passou e pede ação do dono; nunca edita `size.test.mjs` nem `MAX_WORKFLOW_CHARS` e nunca toca texto ou comentário de outro estágio.

## Tarefas

### Tarefa 1: Preflight aceita taskReview.single booleano

Arquivos: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`, `plugins/productivity-tools/skills/roadmap-release/references/config.md`; teste `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`. Não edita `roadmap-release.js`.

Teste primeiro em `preflight.test.mjs`:

- O teste `E21: validateReleaseConfig accepts a missing taskReview and restricted only, refuses other shapes and keys` passa a se chamar `E28: validateReleaseConfig accepts taskReview.restricted and taskReview.single booleans and names any other key` e confere: `assert.deepEqual(validateReleaseConfig({ ...good(), taskReview: tr }), [])` para `tr` ausente, `{}`, `{ restricted: true }`, `{ restricted: false }`, `{ single: true }`, `{ single: false }` e `{ restricted: true, single: true }`; para `true`, `[]` e `{ restricted: 'yes' }`, algum erro casa `/taskReview/`; para `{ single: 1 }` e `{ single: 'true' }`, algum erro é exatamente `taskReview.single must be a boolean`; para `{ other: true }` e `{ restricted: true, foo: 1 }`, algum erro contém `taskReview.other` (ou `taskReview.foo`) e `taskReview.single` (a mensagem lista as chaves aceitas).
- No teste `E21: the review-package.mjs rule is required only with taskReview.restricted === true, from the plugin root`, acrescentar `const single = run({ single: true }); assert.deepEqual(single.errors, []); assert.ok(!single.missingRules.includes(rule));`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e relatar a falha (`{ single: true }` ainda recusado).

Implementar em `validateReleaseConfig`: com `taskReview` objeto, cada chave fora de `restricted` e `single` gera `taskReview.<k> is not a supported key (only taskReview.restricted and taskReview.single)`; para `restricted` e `single`, valor presente e não booleano gera `taskReview.<k> must be a boolean`; `taskReview` que não é objeto continua `taskReview must be an object`. O filtro de `review-package.mjs` não muda. Em `references/config.md`, a linha `taskReview` (21) documenta os dois booleanos opcionais: ausente ou outro valor que não `true` vale falso (lido com `=== true`); `restricted` como hoje; `single` troca os dois laços (`spec`, `quality`) por uma chamada por rodada que devolve os dois veredictos `spec` e `quality`, e um veredicto ausente ou `fail` sem achado bloqueante vira achado crítico; os dois se combinam; desligados por padrão, E27 decide ligar; o preflight recusa `taskReview` que não é objeto, valor não booleano e qualquer outra chave, nomeando-a. A linha 58 não muda. Rodar `preflight.test.mjs` até passar. Commit `E28 T1: preflight aceita taskReview.single`.

### Tarefa 2: Laço kind review e achado de veredicto no taskIssues

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`.

Teste primeiro em `review.test.mjs` (por `P2` e `SRC`, depois de `rCtx`):

- `E28 AC1: taskIssues fails a single review with a missing or failing verdict and no blocking finding`: com `const S = (o = {}) => rCtx({ taskReview: { restricted: false, single: true }, ...o })`: `P2.taskIssues({ issues: [], spec: 'pass' }, S())`, `{ issues: [], spec: 'pass', quality: 'fail' }`, `{ issues: [], spec: 'fail', quality: 'pass' }` e `{ issues: [] }` devolvem cada um exatamente um achado com `severity === 'critical'`, `category === 'defeito'` e `description` casando `/single review/`; `{ issues: [], spec: 'pass', quality: 'pass' }` devolve `[]` (`deepEqual`); `{ issues: [F('F1')], spec: 'pass', quality: 'fail' }` devolve `[F('F1')]` (`deepEqual`, sem achado extra); `{ issues: [{ severity: 'minor', description: 'm' }], spec: 'pass', quality: 'fail' }` devolve dois itens (achado menor não bloqueia). Com os dois modos, `const B = rCtx({ taskReview: { restricted: true, single: true }, was: { iss: [F('F1')], head: 'h1' } })`: `{ issues: [], verdicts: [], spec: 'pass', quality: 'pass' }` devolve `[F('F1')]` (aberto sem veredicto, bloqueante, sem extra) e `{ issues: [], verdicts: [{ id: 'F1', open: false }] }` devolve um único achado `/single review/`.
- `E28 AC1: with taskReview.single the per-task loop makes one review call per round on today's model`: em `const body = SRC.slice(SRC.indexOf('async function runDeliverable'))`, `assert.match(body, /for \(const kind of TR\.single \? \['review'\] : \['spec', 'quality'\]\)/)`; `assert.match(body, /const tr = CFG\.taskReview \|\| \{\}, TR = \{ restricted: tr\.restricted === true, single: tr\.single === true \}/)`; o trecho de `reviewLoop(\`T${t.n}:${kind}\`` até `if (loop.halted)` contém `revAgent(`, `model: rvModel || reviewModelFor(t)` e `effort: effortFor(rvModel || reviewModelFor(t))`.
- `E28 AC3: by default the per-task review keeps two loops and does not read taskReview.single`: `assert.doesNotMatch(SRC, /taskReview\.single/)`; em `body`, as linhas que casam `/\.single\b/` são exatamente duas: a da normalização (`const tr = CFG.taskReview`) e a do laço (`for (const kind of TR.single`); para `c` em `rCtx({})`, `rCtx({ taskReview: undefined })` e `rCtx({ taskReview: { restricted: false, single: false } })`, com `const r = { issues: [] }` (sem veredictos), `assert.equal(P2.taskIssues(r, c), r.issues)` (mesma referência: o padrão não olha os veredictos).
- Ajustes, sem perder o que conferem: em `AC2: taskReview is normalized once in runDeliverable and only true turns a mode on`, a expressão passa a `/const (tr = CFG\.taskReview \|\| \{\}, TR = \{ restricted: [^\r\n]*\})(?=\r?\n)/`, `run` vira `new Function('CFG', \`const ${norm[1]}; return TR\`)`, os `deepEqual` passam a esperar `{ restricted: <bool>, single: false }` nos casos de hoje, e entram `run({ single: 'true' })` → `{ restricted: false, single: false }`, `run({ single: true })` → `{ restricted: false, single: true }`, `run({ restricted: true, single: true })` → os dois `true`, e `(SRC.match(/single === true/g) || []).length === 1`; a contagem de `CFG\.taskReview` continua 1. Em `AC3: by default each task gets the spec and quality reviews on today's model`, o `match` de `for (const kind of ['spec', 'quality'])` passa à expressão do laço nova acima e o `doesNotMatch(body, /\.single\b/)` sai (o teste `E28 AC3` cobre a leitura); o resto fica.

Teste complementar em `flow.test.mjs`, no fim do arquivo, `E28 AC1: taskReview.single runs one review call per round on the task-reviewer agent`: `const pass = { issues: [], spec: 'pass', quality: 'pass', headSha: 'a1', clean: true, commitsInRange: 3 }` e `const singleRun = (config, review) => exec({ cards: [card('E1')], deliverables: ['E1'], config, over: withPlan([tk(1, false)], (l) => (/^E1:t1:review\d$/.test(l) ? review(l) : l === 'E1:t1:review-fix1' ? { status: 'DONE', summary: 'f', checks: [] } : undefined)) })` (o arnês não tem retorno padrão para `review<n>`). Com `config: { taskReview: { single: true } }` e `() => pass`: os rótulos que casam `/^E1:t1:(spec|quality|review)\d$/` são `['E1:t1:review1']`; seu `opts.agentType` é `productivity-tools:task-reviewer`; seu `opts.model` é igual ao de `E1:t1:spec1` numa execução padrão (`exec({ cards: [card('E1')], deliverables: ['E1'], over: withPlan([tk(1, false)]) })`); o prompt casa `/Mode: review\./`. Com o primeiro retorno `{ ...pass, quality: undefined }` e os seguintes `pass`: os rótulos incluem `E1:t1:review-fix1` e `E1:t1:review2`, e o prompt do corretor casa `/single review/` e `/fix the review problems/`. Com `config: { taskReview: { single: 'true' } }`: os rótulos são `['E1:t1:spec1', 'E1:t1:quality1']`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`, medindo depois de cada edição:

1. Em `runDeliverable`, trocar `const TR = { restricted: (CFG.taskReview || {}).restricted === true }` por `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }`.
2. Trocar `for (const kind of ['spec', 'quality'])` por `for (const kind of TR.single ? ['review'] : ['spec', 'quality'])`. O despacho, o corretor, `truth` e o `opt` do `reviewLoop` não mudam.
3. Em `taskIssues(r, c)` (bloco `// <pure>`), manter a junção do modo restrito e, quando `(c.taskReview || {}).single` é verdadeiro, `r.spec !== 'pass' || r.quality !== 'pass'` e `!blocking({ issues: iss }).length`, devolver `[...(iss || []), { severity: 'critical', category: 'defeito', description: 'single review: spec or quality verdict missing or fail, no blocking finding' }]`; senão devolver `iss` (que é `r.issues`, mesma referência, fora do modo restrito). O comentário acima da função ganha uma oração curta para o modo único; nenhum outro comentário muda.

Rodar `review.test.mjs`, `flow.test.mjs`, `prompts.test.mjs` e `size.test.mjs` (relatar o total; `BLOCKED` acima de 250.000). Conferir com `git -C D:/projects/claude-play-wt/E28 diff -- plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` que só mudaram `taskIssues`, seu comentário e as duas linhas de `runDeliverable`. Commit `E28 T2: revisão única com dois veredictos`.

### Tarefa 3: Agente usa o modo review e prompts do modo único

Arquivos: `plugins/productivity-tools/agents/task-reviewer.md`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`. Não edita `roadmap-release.js`.

Teste primeiro em `prompts.test.mjs`, novo teste `E28 AC2: single review prompts cite no superpowers and forbid asking`, que lê `agentText = reviewerAgent()`, `script` (texto de `roadmap-release.js` com CRLF normalizado) e `noAsk` (`script.match(/const NO_ASK = '([^']*)'/)[1]`):

- `const single = { ...ctx, taskReview: { restricted: false, single: true } }`; `p = P.buildTaskReviewPrompt(single, task, 'review', impl)`: `p.startsWith(ctx.base)`, `assert.match(p, /Mode: review\./)`, `assert.doesNotMatch(p, /superpowers/i)`.
- `const both = { ...single, taskReview: { restricted: true, single: true }, was: { iss: [{ severity: 'critical', category: 'defeito', id: 'F1', file: 'a.js', description: 'bug' }], head: 'h1' }, pluginRoot: '/plug', diffPath: '/wt/_tmp/x.diff' }`; o prompt de `review` abre com `ctx.base`, casa `/Mode: restricted, review\./` e `/review-package\.mjs/`, e não cita `superpowers`.
- `const sec = (agentText.match(/## Review mode\n([\s\S]*?)(?=\n## |$)/) || [])[1] || ''`: `assert.match(sec, /both the `spec` and the `quality` block lists/)`, `assert.match(sec, /Every `fail` comes with a blocking finding/)`, `assert.match(sec, /`restricted, review`[\s\S]*`verdicts`[\s\S]*`spec` and `quality`/)`, `assert.doesNotMatch(agentText, /superpowers/i)`, `assert.ok(agentText.includes(noAsk))`.
- No texto do script, o trecho do laço por tarefa de `reviewLoop(\`T${t.n}:${kind}\`` até `if (loop.halted)` contém `implAgent(\`${C()}` e `fix the ${kind} problems` (o corretor do modo único abre com o briefing, que proíbe perguntar, e vale para `kind` `review`).

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` e relatar a falha (seção `## Review mode` sem o texto novo).

Implementar em `agents/task-reviewer.md`: na lista de `## Choosing the mode`, a linha de `review` passa a `review`: judge both in one call (the workflow's single review); na seção `## Review mode`, três frases: julgar conformidade e qualidade numa chamada, aplicando both the `spec` and the `quality` block lists, e devolver `spec` e `quality` (`pass` ou `fail`); Every `fail` comes with a blocking finding in `issues`, e um veredicto ausente ou `fail` sem achado bloqueante vira um achado crítico do script; com `Mode: restricted, review`, seguir a seção do modo restrito para os achados abertos (`verdicts`) e devolver também `spec` and `quality` sobre a tarefa como ficou. Em inglês, como o resto do agente; sem `superpowers`; frontmatter sem mudança. Rodar `prompts.test.mjs` e `review.test.mjs` até passar. Commit `E28 T3: task-reviewer usa o modo review`.

### Tarefa 4: Gates

Sem arquivos e sem commit. Roda no worktree `D:/projects/claude-play-wt/E28` depois das Tarefas 1 a 3:

- G1 (subconjunto do release: testes do workflow, do preflight e de tamanho): `node --test "plugins/productivity-tools/skills/roadmap-release/**/*.test.mjs"`.
- Teste de tamanho isolado, com o total relatado: `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`.
- G2: `claude plugin validate .`.
- G3: `claude plugin validate plugins/productivity-tools`.
- G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.
- Os comandos de evidência dos três critérios (tabela abaixo).

Evidência aceitável se um gate não puder rodar neste ambiente (por exemplo, `claude` ausente): a saída literal do comando e o motivo, sem resultado inventado. Uma falha devolve a tarefa ao dono do arquivo que falhou, sem editar `size.test.mjs` nem o teto.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` | `E28 AC1: taskIssues fails a single review with a missing or failing verdict and no blocking finding`, `E28 AC1: with taskReview.single the per-task loop makes one review call per round on today's model` (complemento: `E28 AC1: taskReview.single runs one review call per round on the task-reviewer agent` em `flow.test.mjs`) |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` | `E28 AC2: single review prompts cite no superpowers and forbid asking` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` | `E28 AC3: by default the per-task review keeps two loops and does not read taskReview.single`, `AC3: by default each task gets the spec and quality reviews on today's model`, `the release workflow stays within the size launched by name` |

## Decisões do plano

- R8: quatro tarefas na ordem preflight -> script -> agente -> gates; T1, T2 e T3 têm arquivos disjuntos e não dependem entre si, e a T4 depende das três.
- R9: os testes de E21 que afirmam a ausência de `single` mudam na T2, a mesma tarefa que muda o script, para a suíte nunca ficar vermelha entre commits.
- R10: `flow.test.mjs` recebe o teste ponta a ponta do critério 1 na T2 (três arquivos, dentro do limite de quatro); o arnês ganha retorno só para os rótulos `review<n>` do próprio teste.
- R11: a T4 não cria arquivo nem commit; o G1 é o subconjunto do release pedido para este card, e o G1 completo do CLAUDE.md fica para os gates do workflow na release.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E28",
  "title": "Revisão única por tarefa com dois veredictos (metade adiada do critério 3 de E21)",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ (só nos estágios de registro e docs, na release).",
    "Não aumentar MAX_WORKFLOW_CHARS nem editar workflow/size.test.mjs; medir roadmap-release.js com size.test.mjs depois de cada edição; acima de 250000 caracteres LF, parar com BLOCKED e ação do dono (DEC-647).",
    "Não tocar texto nem comentário de outro estágio de roadmap-release.js; a T2 só muda taskIssues, seu comentário, a normalização de taskReview e a linha do laço por tarefa.",
    "taskReview.single e taskReview.restricted desligados por padrão (ausente vale falso, lido com === true numa única normalização); padrão: dois laços spec e quality no modelo e effort de hoje (DEC-021); não mudar reviewModelFor, effortFor, MAXFIX, sameFinding, implAgent nem agents/implementer.md.",
    "Não citar superpowers no agente, no script nem em prompt.",
    "Sem bump de versão; sem push; nunca tocar em main, na branch de release nem no worktree D:/projects/claude-play.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;.",
    "Commits de tarefa começam com \"E28 T<n>:\" e terminam com a linha Co-Authored-By da sessão; nunca git add -A nem git stash."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Preflight aceita taskReview.single booleano",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs",
          "plugins/productivity-tools/skills/roadmap-release/references/config.md"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["validateReleaseConfig aceita taskReview.restricted e taskReview.single booleanos e recusa outra chave com 'taskReview.<k> is not a supported key (only taskReview.restricted and taskReview.single)'"],
      "consumes": [],
      "covers": ["C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Laço kind review e achado de veredicto no taskIssues",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": [
        "TR = { restricted, single } normalizado uma vez em runDeliverable",
        "laço por tarefa com kinds ['review'] quando TR.single",
        "taskIssues(r, c) acrescenta achado critical/defeito 'single review: ...' quando spec ou quality não é pass e não há achado bloqueante"
      ],
      "consumes": [],
      "covers": ["AC1", "AC3", "C1", "C2", "C3", "C4", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 250000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Agente usa o modo review e prompts do modo único",
      "deps": [],
      "files": {
        "create": [],
        "modify": ["plugins/productivity-tools/agents/task-reviewer.md"],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": ["agents/task-reviewer.md: seção Review mode com as duas listas de bloqueio, fail com achado bloqueante e a combinação restricted, review"],
      "consumes": [],
      "covers": ["AC2", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" }
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
        { "cmd": "node --test \"plugins/productivity-tools/skills/roadmap-release/**/*.test.mjs\"", "expect": "exit 0 (G1, subconjunto do release)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 250000 caracteres LF)" },
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
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC3",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R8",
      "question": "Em que ordem e com que dependências as tarefas rodam?",
      "decision": "Quatro tarefas: preflight, script, agente e gates; T1, T2 e T3 têm arquivos disjuntos e não dependem entre si; a T4 depende das três.",
      "basis": "Spec, seção Deixado para o plano; limite de quatro arquivos por tarefa.",
      "alternative": "Uma tarefa só para script, agente e testes.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Quando mudam os testes de E21 que afirmam a ausência de single?",
      "decision": "Na T2, a mesma tarefa que muda o script, sem perder o que conferem (só true liga, CFG.taskReview lido uma vez, modelo e effort de hoje).",
      "basis": "R6 da spec; a suíte não fica vermelha entre commits.",
      "alternative": "Ajustá-los numa tarefa própria depois da T2.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Onde fica o teste ponta a ponta do modo único?",
      "decision": "Em flow.test.mjs, na T2 (três arquivos), com retorno simulado só para os rótulos review<n> do próprio teste; a evidência do critério 1 continua review.test.mjs, como manda a marca do card.",
      "basis": "Mesmo arranjo de E21 (testes complementares no arnês, sem copiá-lo); o arnês não tem retorno padrão para review<n>.",
      "alternative": "Só testes puros e de texto em review.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "Que gates roda a tarefa final?",
      "decision": "G1 restrito aos testes de skills/roadmap-release (workflow, preflight e tamanho), o teste de tamanho isolado, G2, G3 e G5, sem arquivo nem commit (noCommit); o G1 completo fica para os gates do workflow na release.",
      "basis": "Pedido do orquestrador para este card; CLAUDE.md lista G2, G3 e G5.",
      "alternative": "G1 completo do CLAUDE.md na tarefa final.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
