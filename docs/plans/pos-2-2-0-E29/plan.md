# Plano E29 -- Remover o modo de revisão única

**Roadmap:** docs/plans/roadmap-pos-2-2-0/

**Spec:** `docs/plans/pos-2-2-0-E29/spec.md`. Worktree `D:/projects/claude-play-wt/E29`, branch `feat/E29`, a partir da ponta `878ba58` da release (o workflow nela é o mesmo blob `e656aafc34b7a778e4d7b7bcb0abaf681a8063f4` de `ccac3c5`). Todas as tarefas rodam nesse worktree, antes do merge. Nenhuma tarefa precisa de navegador nem de servidor (faixa de portas 5200-5209 sem uso). Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main`, na branch de release nem em `D:/projects/claude-play`, sem bump de versão nem README (E33), sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava. Commits de tarefa começam com `E29 T<n>:`; o chamador comita.

## Contexto lido

- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js` (246.571 bytes CRLF): no bloco `// <pure>`, comentário `// Restricted: ... Single: ...` e `taskIssues(r, c)` (~400-409, linha 407 com o achado `single review: spec or quality verdict missing or fail, no blocking finding`); em `runDeliverable`, linha 2622 `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }` e linha 2623 `for (const kind of TR.single ? ['review'] : ['spec', 'quality'])`. `FR.singleWave === true` (~2705) é de outro recurso e fica.
- `skills/roadmap-release/scripts/preflight.mjs` (~26-33): `validateReleaseConfig` aceita `restricted` e `single` e recusa outra chave com `(only taskReview.restricted and taskReview.single)`; o filtro de `review-package.mjs` (~584-585) só olha `restricted`.
- `agents/task-reviewer.md`: linha 21 `review`: judge both in one call (the workflow's single review); linha 44, seção `## Review mode`, com a frase do achado do script e o parágrafo `restricted, review`.
- `skills/roadmap-release/references/config.md` linha 21: `taskReview` com `restricted` e `single`.
- Testes do release: `workflow/review.test.mjs` (`AC2: taskReview is normalized once ...` ~601-619; `AC3: by default each task gets the spec and quality reviews on today's model` ~631; bloco `E28 T2` ~643-685 com `E28 AC1` duas vezes e `E28 AC3`); `workflow/flow.test.mjs` (bloco `E28 T2: taskReview.single on the task-reviewer agent` ~5021-5042); `workflow/prompts.test.mjs` (`E28 AC2: single review prompts cite no superpowers and forbid asking` ~194-216); `scripts/preflight.test.mjs` (`E28: validateReleaseConfig accepts taskReview.restricted and taskReview.single ...` ~784; `E21: the review-package.mjs rule ...` ~800 com o caso `single`).
- Arnês: `tools/measure/run-batch.mjs` (`TASK_SINGLE_LITERALS` e `TASK_SINGLE_ISSUES_LITERAL` ~907-910, `checkLoopWorkflow(workflowText, stage, { lenses = false } = {})` ~928, bloco `if (lenses)` ~944-951, chamada em `runBatch` ~2269, `syntheticOf` ~1682, que devolve `null` num workflow sem o modo único e não muda); `tools/measure/review-loop.test.mjs` (`WF` ~11-12, `lensScript` ~433-438 e os testes `C2` de lentes ~441-530); `tools/measure/run-batch.test.mjs` (`WORKFLOW` ~479, `loadPure` ~2514, `lentesPlugin` ~3567, `C2: startup refusals on the measured workflow for lentes-semeadas` ~3624, `C2: a measured plugin without "## Review mode" ...` ~3654, `C2: runBatch picks the lenses script ...` ~3668, `hL` ~3710, `lensRun` ~3726, testes `C3` ~3745-3990 e `statsOf` ~3907).
- `skills/plan-coordinator/workflow/coordinator.js` despacha `Mode: review` ao `task-reviewer` (R3 da spec): não muda.

## Tarefas

### Tarefa 1: Workflow com o caminho único spec e quality

Arquivos: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`.

Teste primeiro em `review.test.mjs`:

- `AC2: taskReview is normalized once in runDeliverable and only true turns a mode on`: a contagem `(SRC.match(/single === true/g) || []).length` passa a `0`; a expressão da normalização passa a `/const (tr = CFG\.taskReview \|\| \{\}, TR = \{ restricted: tr\.restricted === true \})(?=\r?\n)/`; os `deepEqual` passam a `{ restricted: <bool> }`; `run({ single: true })` e `run({ restricted: true, single: true })` esperam `{ restricted: false }` e `{ restricted: true }` (a chave é ignorada pelo workflow; a recusa é do preflight); a contagem de `CFG\.taskReview` continua 1 e a de `restricted === true` continua 1.
- `AC3: by default each task gets the spec and quality reviews on today's model`: o `match` do laço passa a `/for \(const kind of \['spec', 'quality'\]\)/`; o resto fica.
- Saem os testes `E28 AC1: taskIssues fails a single review ...`, `E28 AC1: with taskReview.single the per-task loop ...` e `E28 AC3: by default the per-task review keeps two loops and does not read taskReview.single`, com o comentário `// ---- E28 T2 ... ----`. Entra `E29 AC1: taskIssues ignores verdicts and returns the restricted join or r.issues`: para `c` em `rCtx({})` e `rCtx({ taskReview: { restricted: false, single: true } })`, com `const r = { issues: [], spec: 'fail' }`, `assert.equal(P2.taskIssues(r, c), r.issues)` (mesma referência, sem achado sintético).

Em `flow.test.mjs` sai o bloco `// ---- E28 T2: taskReview.single on the task-reviewer agent ----` com o teste `E28 AC1: taskReview.single runs one review call per round on the task-reviewer agent`.

Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e relatar a falha.

Implementar em `roadmap-release.js`: linha 2622 passa a `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true }`; linha 2623 a `for (const kind of ['spec', 'quality']) {`; em `taskIssues` sai a linha `if ((c.taskReview || {}).single ...` e a função volta a `return iss`; o comentário acima perde a frase `Single: a missing or failing verdict with no blocking finding is a finding.`. `S_TASKREVIEW` não muda. Nenhum outro texto muda. Rodar `review.test.mjs`, `flow.test.mjs`, `prompts.test.mjs` e `size.test.mjs`. Conferir com `git -C D:/projects/claude-play-wt/E29 diff --stat` que só os três arquivos mudaram. Commit `E29 T1: workflow sem o modo de revisão única`.

### Tarefa 2: Preflight recusa taskReview.single

Arquivos: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`, `plugins/productivity-tools/skills/roadmap-release/references/config.md`; teste `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`.

Teste primeiro em `preflight.test.mjs`: o teste `E28: validateReleaseConfig accepts ...` vira `E29: validateReleaseConfig accepts only taskReview.restricted and refuses taskReview.single with the removal message`, com `const REMOVED = 'taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json'`: `good()` e `taskReview` `{}`, `{ restricted: true }`, `{ restricted: false }` dão `[]`; `{ single: true }`, `{ single: false }` (C1), `{ single: 'true' }` e `{ restricted: true, single: true }` (C2) dão exatamente `[REMOVED]` (`deepEqual`); `true`, `[]` e `{ restricted: 'yes' }` dão algum erro que casa `/taskReview/`; `{ other: true }` e `{ restricted: true, foo: 1 }` dão algum erro com `taskReview.other` (ou `taskReview.foo`) e `only taskReview.restricted`, e nenhum erro cita `taskReview.single`. No teste `E21: the review-package.mjs rule ...` saem as três linhas do caso `single`. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` e relatar a falha.

Implementar em `validateReleaseConfig`: para `k === 'single'`, `errors.push(REMOVED)` com a mensagem exata acima (única ocorrência de `taskReview.single` no arquivo); outra chave fora de `restricted` dá `taskReview.${k} is not a supported key (only taskReview.restricted)`; `restricted` presente e não booleano dá `taskReview.restricted must be a boolean`; `taskReview must be an object` fica. Em `references/config.md`, linha 21: objeto com o booleano opcional `restricted`, lido com `=== true`, desligado por padrão, com a explicação atual do modo restrito; nota em inglês, como o resto do arquivo: "`single` (single review, E28) was removed in E29 after pass C: the preflight refuses the key with a message asking to delete it"; recusa de não objeto, não booleano e outra chave, nomeando-a. A linha 58 não muda. Rodar o teste até passar. Commit `E29 T2: preflight recusa taskReview.single`.

### Tarefa 3: task-reviewer sem a ligação ao release e teste de ausência

Arquivos: `plugins/productivity-tools/agents/task-reviewer.md`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`; teste `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`. Depende das Tarefas 1 e 2 (o teste novo lê os três arquivos).

Teste primeiro em `review.test.mjs`, no fim, `E29 AC1: the release, the preflight and the task-reviewer carry no single review`: lê `roadmap-release.js` (`SRC`), `../scripts/preflight.mjs` e `../../../agents/task-reviewer.md`; confere `doesNotMatch(SRC, /taskReview\.single|TR\.single|\['review'\]|single review/)`, nenhuma linha de `SRC` com `taskReview` casa `/\.single ===/`; no preflight, `/taskReview\.single/g` casa exatamente uma vez e essa ocorrência está na linha que contém `was removed: the per-task review always runs the spec and quality loops`; o agente não contém `single review` nem `the workflow's single review` nem `restricted, review`; e `SRC.slice(SRC.indexOf('async function runDeliverable'))` casa `/for \(const kind of \['spec', 'quality'\]\)/`. Em `prompts.test.mjs` sai `E28 AC2: single review prompts cite no superpowers and forbid asking`. Rodar `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs` e relatar a falha (o agente ainda cita a revisão única).

Implementar em `agents/task-reviewer.md`: linha 21 passa a "`review`: judge both in one call (used by the plan-coordinator workflow)."; a seção `## Review mode` passa a "Judge compliance and quality in one call, applying both the `spec` and the `quality` block lists, and return `spec` and `quality` (`pass` or `fail`). Every `fail` comes with a blocking finding in `issues`." Frontmatter e o resto sem mudança. Rodar `review.test.mjs`, `prompts.test.mjs` e `flow.test.mjs`. Commit `E29 T3: task-reviewer sem a revisão única do release`.

### Tarefa 4: Arnês de medição ao caminho único com fixture congelada

Arquivos: criar `tools/measure/fixtures/workflow-com-single/roadmap-release.js`; modificar `tools/measure/run-batch.mjs`; testes `tools/measure/run-batch.test.mjs` e `tools/measure/review-loop.test.mjs`. Depende da Tarefa 1.

Criar a fixture com `git -C D:/projects/claude-play-wt/E29 show ccac3c5:plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js > D:/projects/claude-play-wt/E29/tools/measure/fixtures/workflow-com-single/roadmap-release.js` (saída do blob em LF; criar a pasta antes com `mkdir -p`) e conferir que `git -C D:/projects/claude-play-wt/E29 hash-object tools/measure/fixtures/workflow-com-single/roadmap-release.js` imprime `e656aafc34b7a778e4d7b7bcb0abaf681a8063f4`.

Teste primeiro:

- `review-loop.test.mjs`: no topo, `const WF_SINGLE = readFileSync(join(here, 'fixtures', 'workflow-com-single', 'roadmap-release.js'), 'utf8')` com o comentário "fixture congelada: roadmap-release.js em ccac3c5, antes de E29; só o braço unica a lê". `lensScript(arm)` passa `pure: checkLoopWorkflow(arm === 'unica' ? WF_SINGLE : WF, 'task-review', { lenses: true, arm })`; em `C2: the lenses loop script carries the pure block byte for byte ...` o bloco esperado do braço `unica` é `extractPure(WF_SINGLE).pure` e o de `atual` continua `PURE`. Os demais testes `C2` de lentes não mudam (o `unica` passa a vir da fixture por `lensScript`).
- `run-batch.test.mjs`: `const WORKFLOW_SINGLE = join(REPO, 'tools/measure/fixtures/workflow-com-single/roadmap-release.js')` com o mesmo comentário; `lensRun({ arm })` lê `arm === 'unica' ? WORKFLOW_SINGLE : WORKFLOW` e passa `{ lenses: true, arm }`; `hL(arm)` usa `loadPure(arm === 'unica' ? WORKFLOW_SINGLE : undefined)`; nos testes `C3` (`C3: replay ok equals the script ok ...`, `C3: laco-divergente ...`, `C3: bloqueou-sintetico ...`, `C3: BLOCKED with a synthetic and a real finding ...`, `C3: a loop stopped without BLOCKED ...`, `C3: failRiscoAceito ...` e `statsOf`), toda chamada de replay ou de contagem do braço `unica` recebe as funções de `loadPure(WORKFLOW_SINGLE)` (um auxiliar `const pOf = (arm) => (arm === 'unica' ? loadPure(WORKFLOW_SINGLE) : loadPure())`); `C2: a measured plugin without "## Review mode" ...` e o braço `unica` de `C2: runBatch picks the lenses script ...` montam o plugin com o texto de `WORKFLOW_SINGLE`. `C2: startup refusals on the measured workflow for lentes-semeadas` passa a: os três desvios de literal aplicados ao texto da fixture recusam `runBatch` com `arm: 'unica'`, citando o literal, com zero chamadas `claude`, e `checkLoopWorkflow(<desvio>, 'task-review', { lenses: true, arm: 'unica' })` lança; o mesmo desvio com `{ lenses: true, arm: 'atual' }` e sem opções não lança; o workflow real com `{ lenses: true, arm: 'atual' }` não lança (C3); o workflow real com `{ lenses: true, arm: 'unica' }` lança citando `TR.single ? ['review'] : ['spec', 'quality']`, e `runBatch` com `arm: 'unica'` sobre um plugin com o workflow real recusa com zero chamadas `claude` (C4); a cópia em comentário fora de `taskIssues` continua não escondendo o desvio no braço `unica`.

Rodar `node --test tools/measure/run-batch.test.mjs tools/measure/review-loop.test.mjs` e relatar a falha.

Implementar em `run-batch.mjs`: assinatura `checkLoopWorkflow(workflowText, stage, { lenses = false, arm } = {})`; o bloco hoje `if (lenses)` passa a `if (lenses && arm === 'unica')`; o comentário acima de `TASK_SINGLE_LITERALS` diz que os literais só valem para `--arm unica` em lentes-semeadas; a chamada em `runBatch` passa `{ lenses: h.lenses === true, arm: h.arm }`. O script do braço `atual` continua gravando `H_TR = {"restricted":false,"single":false}` e `harness.taskReview` com `single: false`; `ruleSideC`, `armTotals`, `replayLenses` e `syntheticOf` não mudam. Rodar os dois testes e `node --test "tools/**/*.test.mjs"`. Commit `E29 T4: arnês exige o modo único só no braço unica`.

### Tarefa 5: Gates

Sem arquivos e sem commit. Roda no worktree `D:/projects/claude-play-wt/E29` depois das Tarefas 1 a 4: G1 `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (cerca de 207 s), o teste de tamanho isolado, G2, G3, G4 e G5, e o comando de evidência de cada critério. Linha de base da release: tudo exit 0, G1 com 2175 testes e 2 pulados; qualquer falha é desta branch. Evidência aceitável se um gate não puder rodar neste ambiente (por exemplo, `claude` ausente): a saída literal e o motivo, sem resultado inventado. Uma falha volta à tarefa dona do arquivo; nunca editar `size.test.mjs` nem `MAX_WORKFLOW_CHARS`. No fim, `git -C D:/projects/claude-play-wt/E29 status --porcelain` vazio (diferença só de fim de linha: `git checkout -- <arquivo>`).

## Evidência dos critérios

| Critério | Tipo | Comando | testRef |
|---|---|---|---|
| AC1 | test | `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` | `E29 AC1: the release, the preflight and the task-reviewer carry no single review` e `E29 AC1: taskIssues ignores verdicts and returns the restricted join or r.issues` (`review.test.mjs`), `AC3: by default each task gets the spec and quality reviews on today's model` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` | `E29: validateReleaseConfig accepts only taskReview.restricted and refuses taskReview.single with the removal message` |

Os dois comandos só leem arquivos do worktree: não externos.

## Decisões do plano

- R5: cinco tarefas na ordem workflow, preflight, agente, arnês e gates; T1 e T2 independentes, T3 depende de T1 e T2, T4 de T1, T5 de todas.
- R6: o teste `E28 AC3` sai na T1 junto com os `E28 AC1` (afirma o laço com `TR.single`); a ausência passa ao teste novo de T3. Entre os commits de T1 e T4 os testes de lentes do arnês ficam vermelhos (o workflow real perde os literais); o G1 inteiro é conferido em T4 e T5.
- R7: os testes do braço `unica` listados na T4 leem a fixture; a fixture é criada pelo `git show` do blob de `ccac3c5` e conferida pelo `git hash-object`.
- R8: a nota de `config.md` sai em inglês, como o arquivo; o sentido é o da spec.
- R9: nenhuma tarefa precisa de navegador, servidor, trava ou efeito externo.

## Bloco de dados

```json data
{
  "schema": "plan/1",
  "id": "E29",
  "title": "Remover o modo de revisão única",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-2-0/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-pos-2-2-0/, workflow/size.test.mjs nem MAX_WORKFLOW_CHARS.",
    "Não remover o modo review do task-reviewer nem mudar skills/plan-coordinator/workflow/coordinator.js.",
    "Não aceitar taskReview.single em silêncio nem tratá-lo como chave desconhecida genérica: a mensagem de remoção é exata.",
    "Não mudar finalReview.singleWave, finalReview.adversarial, ruleSideC, armTotals, replayLenses nem syntheticOf; não mudar notas de versão, relatórios nem planos antigos.",
    "Sem bump de versão nem README (E33); sem push; nunca tocar em main, na branch de release nem no worktree D:/projects/claude-play.",
    "Um comando simples por chamada: sem heredoc, sem laço, sem && e sem ;.",
    "Commits de tarefa começam com \"E29 T<n>:\" e terminam com a linha Co-Authored-By: Claude <noreply@anthropic.com>; nunca git add -A nem git stash; o chamador comita."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Workflow com o caminho único spec e quality",
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
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "TR = { restricted: tr.restricted === true } em runDeliverable",
        "for (const kind of ['spec', 'quality']) no laço por tarefa",
        "taskIssues(r, c) devolve a junção do modo restrito ou r.issues, sem achado sintético"
      ],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Preflight recusa taskReview.single",
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
      "produces": ["validateReleaseConfig recusa taskReview.single com 'taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json' e outra chave com '(only taskReview.restricted)'"],
      "consumes": [],
      "covers": ["AC2", "C1", "C2"],
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
      "n": 3,
      "title": "task-reviewer sem a ligação ao release e teste de ausência",
      "deps": [1, 2],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/task-reviewer.md",
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ],
        "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": ["agents/task-reviewer.md: modo review usado pelo plan-coordinator, sem a revisão única do release"],
      "consumes": [
        { "task": 1, "sig": "for (const kind of ['spec', 'quality']) no laço por tarefa" },
        { "task": 2, "sig": "validateReleaseConfig recusa taskReview.single com 'taskReview.single was removed: the per-task review always runs the spec and quality loops; delete the key from release.config.json' e outra chave com '(only taskReview.restricted)'" }
      ],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Arnês de medição ao caminho único com fixture congelada",
      "deps": [1],
      "files": {
        "create": ["tools/measure/fixtures/workflow-com-single/roadmap-release.js"],
        "modify": ["tools/measure/run-batch.mjs"],
        "test": ["tools/measure/run-batch.test.mjs", "tools/measure/review-loop.test.mjs"]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["checkLoopWorkflow(workflowText, stage, { lenses, arm }) exige TASK_SINGLE_LITERALS e TASK_SINGLE_ISSUES_LITERAL só com arm === 'unica'"],
      "consumes": [
        { "task": 1, "sig": "TR = { restricted: tr.restricted === true } em runDeliverable" }
      ],
      "covers": ["AC1", "C3", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "git -C D:/projects/claude-play-wt/E29 hash-object tools/measure/fixtures/workflow-com-single/roadmap-release.js", "expect": "e656aafc34b7a778e4d7b7bcb0abaf681a8063f4" },
        { "cmd": "node --test tools/measure/run-batch.test.mjs tools/measure/review-loop.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test \"tools/**/*.test.mjs\"", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Gates",
      "deps": [1, 2, 3, 4],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só roda os gates; não muda arquivo" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid", "expect": "exit 0 (G4)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0 (evidência AC2)" }
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
      "command": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R5",
      "question": "Em que ordem e com que dependências as tarefas rodam?",
      "decision": "Workflow (T1), preflight (T2), agente com o teste de ausência (T3, depende de T1 e T2), arnês com a fixture (T4, depende de T1) e gates (T5, depende de todas).",
      "basis": "Spec, seção Deixado para o plano; o teste de ausência lê os três arquivos; limite de quatro arquivos por tarefa.",
      "alternative": "Teste de ausência na T1, vermelho até T3.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "O que acontece com o teste E28 AC3 e com a suíte do arnês entre T1 e T4?",
      "decision": "E28 AC3 sai na T1 com os E28 AC1 (afirma TR.single) e um teste E29 AC1 de taskIssues entra; os testes de lentes do arnês ficam vermelhos entre os commits de T1 e T4, e o G1 inteiro é conferido em T4 e T5.",
      "basis": "Spec: remoção dos testes de E28 sobre single; o arnês depende do workflow novo.",
      "alternative": "Arnês antes do workflow, com o caso do workflow real adiado.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Quais testes do arnês leem a fixture e como ela é criada?",
      "decision": "lensScript('unica'), lensRun e hL do braço unica, os replays e contagens unica dos testes C3, o teste de Review mode e o braço unica de runBatch picks the lenses script; a fixture vem de git show ccac3c5:<workflow> e é conferida por git hash-object igual a e656aafc34b7a778e4d7b7bcb0abaf681a8063f4.",
      "basis": "R4 da spec; ccac3c5 e a ponta 878ba58 têm o mesmo blob do workflow.",
      "alternative": "Aposentar o braço unica e seus testes.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Em que língua sai a nota de remoção em config.md?",
      "decision": "Em inglês, como o resto de references/config.md, com o sentido da nota da spec.",
      "basis": "Regra de escrever artefatos consistentes com o projeto; config.md é todo em inglês.",
      "alternative": "Nota literal em português.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Alguma tarefa precisa de navegador, servidor, trava ou efeito externo?",
      "decision": "Não: todas rodam no worktree D:/projects/claude-play-wt/E29 e só leem e escrevem arquivos dele; se um gate não puder rodar, a evidência aceitável é a saída literal e o motivo.",
      "basis": "Spec sem efeitos externos; nenhuma trava configurada.",
      "alternative": "Nenhuma.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
