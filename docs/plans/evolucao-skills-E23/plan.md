# Plano E23 -- Retomada do release sem repetir revisões

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Spec:** `docs/plans/evolucao-skills-E23/spec.md`. Worktree `D:/projects/claude-play-wt/E23`, branch `feat/E23`, portas 5200-5209 (nenhum servidor). Nenhuma tarefa precisa de navegador. Nenhuma tarefa tem efeito externo: sem push, sem tocar em `main` nem em `D:/projects/claude-play`, sem bump de versão, sem editar a pasta do roadmap. Nenhuma trava configurada; nenhuma tarefa usa trava. Um comando simples por chamada; temporários só em `D:/projects/claude-play-wt/_tmp/E23-*/`. Commits `E23 T<n>: ...`, só com os arquivos da tarefa, terminando com `Co-Authored-By: Claude <noreply@anthropic.com>`.

## Contexto lido

- `workflow/roadmap-release.js` (239.866 caracteres LF; teto 240.000): bloco `// <pure>` (56-1243) com `validMeasure` (~201), `artifactPaths` (~1061), `pluginRootOf` (~1069), `canon` (~1219), `fnv1a` (~1230); `S_PRE`, `S_SETUP` (~1376-1380), `S_SYNC` (~1403); preflight (~1585-1620, passo 4 do `BASELINE`, conferência de preflight incompleto e `validMeasure(pre.baseline, ...)`); `order` é a seleção (~1506); `persistReviews(tag)` (~1754); setup (~2017-2029); laço do spec (~2085-2130, `specReused`, `specLoadIssues`); laço do plano (~2271-2317, `planGaps`, `plan.reused`); `if (MODE === 'plan-only')` (~2335-2343, hoje `persistReviews('record')` só com cortes); `${E}:progress` (~2358, "Read-only."); `syncBranch` (~2532), `${E}:test-integrity` (~2552), `finalLoop` (~2561); `persistReviews('')` (~2656).
- `workflow/flow.test.mjs`: arnês `exec({ cards, deliverables, config, args, over })` (~142) com respostas padrão por rótulo (`preflight`, `:setup`, `:sync`, `:progress`, `review-log`); `loadPure()` já importado.
- `workflow/size.test.mjs`: `MAX_WORKFLOW_CHARS = 240000`, `workflowChars`; não muda.
- `scripts/preflight.mjs`: `WORKFLOW_SCRIPTS = ['roadmap.mjs', 'review-package.mjs']` (~196), montagem de `extras.scripts` (~415-417); `preflight.test.mjs` ~504 (`deepEqual`) e ~778 (caso de `review-package.mjs`).
- `references/config.md` ~55 (regras de script); `references/operator.md`.

## Tamanho do script

Toda tarefa que edita `roadmap-release.js` mede com `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` depois de cada edição e anota o total. A T3 é a primeira que edita o script: antes de somar qualquer código, libera espaço só no texto e nos comentários dos estágios que E23 muda (preflight, setup, spec, plano, progresso, sincronização e revisão final, log de revisões) e relata a folga; T4-T6 liberam no próprio estágio antes de somar. A lógica nova fica em `run-record.mjs`; no workflow só funções puras curtas e linhas de prompt. Nunca encurta outro estágio nem edita `size.test.mjs` ou `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563, DEC-592). Acima de 240.000, a tarefa para com `BLOCKED` e o déficit medido.

## Tarefas

### Tarefa 1: Script do registro da execução com teste

Não edita o workflow. Teste primeiro: `plugins/productivity-tools/scripts/run-record.test.mjs` cria repositório git temporário (`mkdtempSync`, `git init`, `user.email/user.name` locais, commit com `docs/plans/x-E9/spec.md` e `plan.md`) e roda o script por `execFileSync(process.execPath, [script, ...])`. Testes:

- `run-record approve writes run.json and commits only it`: `approve <repo> docs/plans/x-E9/ E9 spec,plan - <carga com prep e trailer>` grava `schema: "run/1"`, `spec { spec }`, `plan { spec, plan }` com os blobs de `git rev-parse HEAD:<arquivo>`, `prep`; um commit novo, assunto `E9: run record (spec,plan)`, só `run.json`.
- `run-record approve merges stages and keeps prep` (C5): depois, `approve ... final <ponta> <carga sem prep>` deixa `spec`, `plan`, `final { spec, plan, tree, target }` e o `prep` da primeira carga.
- `run-record key ignores run.json and reviews.md in the tree key`: `key` imprime `{ recorded, spec, plan, tree }`; `recorded` null sem `run.json` (C1); commitar `reviews.md` e `run.json` não muda `tree`; mudar outro arquivo muda.
- `run-record baseline prints the matching prep or exits 1`: `baseline <repo> <alvo> <gatesKey> <branch:dir>` imprime o `prep` com `targetHead` igual a `git rev-parse <alvo>` e `gatesKey` igual; outra chave ou outra ponta sai 1 sem saída (C3); uso inválido sai 2.

Rodar e relatar a falha. Implementar `run-record.mjs` conforme o Desenho da spec: git por `execFileSync('git', ['-C', wt, ...])`, sem shell; carga por `decodeURIComponent` e `JSON.parse`; `run.json` de `HEAD` só aceito com `schema: "run/1"`; chave da árvore = sha256 de `git ls-tree -r HEAD` sem as linhas de `<dir>run.json` e `<dir>reviews.md`; commit por `git commit -F <arquivo temporário> -- <dir>run.json`. Sem `superpowers`. Commit `E23 T1: script do registro da execução`.

### Tarefa 2: Regra de permissão do script e config.md

Teste primeiro em `preflight.test.mjs`: o `deepEqual` de ~504 passa a `['roadmap.mjs', 'review-package.mjs', 'run-record.mjs']`; caso novo `E23: the run-record.mjs rule is always required, from the plugin root`: com `taskReview` ausente, as regras exigidas incluem `scriptRule('run-record.mjs')` com caminho `<raiz do plugin>/scripts/run-record.mjs`, e o arquivo existe. Rodar e relatar a falha. Implementar em `preflight.mjs`: lista e derivação do caminho como a de `review-package.mjs`, sem filtro. Em `config.md`, uma frase: a regra `Bash(node *run-record.mjs" *)` é exigida em toda execução. Rodar `preflight.test.mjs` e `flow.test.mjs`. Commit `E23 T2: regra do run-record.mjs`.

### Tarefa 3: Liberar espaço e funções puras do registro

Primeiro liberar espaço (seção Tamanho) e medir. Teste primeiro em `flow.test.mjs`, por `loadPure()`: `E23: runKey and skipReview compare every recorded value` (`runKey` de JSON inválido é null; `skipReview('spec'|'plan'|'final', k, ponta)` verdadeiro só com o estágio registrado e cada valor exigido string não vazia igual ao atual; valor ausente ou diferente dá falso); `E23: recordCmd builds the approve command` (`node "<RR>" approve "<wt>" <dir> <E> <estágios> <ponta|-> '<carga>'`, carga com `encodeURIComponent` e `'` como `%27`); `E23: recordedBaseline accepts only a matching valid measure` (null com `targetHead` ou `gatesKey` diferente ou `validMeasure` falso). Rodar e relatar a falha. Implementar no bloco `// <pure>`: `artifactPaths` ganha `run`; `runKey`, `skipReview`, `recordCmd`, `recordedBaseline`. Rodar `flow.test.mjs`, `review.test.mjs`, `prompts.test.mjs` e o teste de tamanho. Commit `E23 T3: funções puras do registro`.

### Tarefa 4: Setup lê o registro; pulo de spec e plano; aprovação em progress e plan-only

Teste primeiro em `flow.test.mjs`: `AC1: a resume with every recorded value skips the spec, plan and final reviews` (setup com `nativeSpec`/`nativePlan` e `record` igual aos blobs; nenhum rótulo `:spec-review` ou `:plan-review`; a parte final entra na T5); `E23: progress records spec and plan only after a review ran` (sem registro, o prompt de `E1:progress` começa pelo comando `approve ... spec,plan`; com pulo, abre com "Read-only"); `E23: plan-only records spec and plan in the review log` (um `E1:review-log-plan` com o comando `approve`). Rodar e relatar a falha. Implementar: `RR` por `pluginRootOf(A.trackerCli)`; passo `record` no setup (`S_SETUP.record`); `K0 = runKey(setup.record)`; laços de spec e plano trocados por `{ ok: true }` nas condições de R3, com `out.concerns` citando `run.json`; `persistReviews(tag, stages)` com `recordCmd` como primeiro comando; `plan-only` chama `persistReviews(cortes ? 'record' : 'plan', 'spec,plan')` quando uma revisão rodou; carga sem `prep` em `plan-only`, com `prep { targetHead: pre.targetHead, gatesKey: fnv1a(canon(GATES)), baseline: pre.baseline }` no modo `run`. Rodar `flow.test.mjs` e o teste de tamanho. Commit `E23 T4: pulo das revisões de spec e plano`.

### Tarefa 5: Sincronização devolve o registro; pulo da revisão final

Teste primeiro em `flow.test.mjs`: completar `AC1: a resume with every recorded value skips the spec, plan and final reviews` (sync com `record` igual nos quatro valores e `targetTip` registrada: nenhum `:final-` nem `:test-integrity`, segue para os gates); `AC2: the final review runs again when the target moved` (mesmo registro, `targetTip` diferente: `E1:final-1-r1` chamado e o prompt de `E1:review-log` traz `approve ... final`). Rodar e relatar a falha. Implementar: `syncBranch` devolve `record` (`S_SYNC.record`, mesmo `key` depois do merge); `skipReview('final', runKey(sync.record), sync.targetTip)` pula integridade e `finalLoop` (R6), com concern; `persistReviews('', 'final')` só quando a final rodou. Rodar `flow.test.mjs` e o teste de tamanho. Commit `E23 T5: pulo da revisão final`.

### Tarefa 6: Preflight reaproveita a medição registrada

Teste primeiro em `flow.test.mjs`: `AC3: an unchanged target reuses the recorded gates baseline` (preflight devolve `recorded` válido sem `baseline`: o prompt de `preflight` traz `run-record.mjs" baseline`, a execução não para em `preflight:` e `BASE` vem da medição registrada); recusa com `gatesKey` diferente para em `preflight:` como hoje (C3). Rodar e relatar a falha. Implementar: no modo `run`, passo 4 começa pelo comando `baseline` com `branch:dir` de cada entregável de `order`; `S_PRE.recorded`; `recordedBaseline(pre.recorded, pre.targetHead, fnv1a(canon(GATES)), GATES)` vira `pre.baseline` antes da conferência de preflight incompleto. Rodar `flow.test.mjs` e o teste de tamanho. Commit `E23 T6: reaproveita a medição dos gates`.

### Tarefa 7: operator.md e gates

Em `references/operator.md`, uma frase: a retomada pula a revisão de spec, de plano e final cujos valores são os de `run.json` e reaproveita a medição dos gates com o alvo inalterado. Sem bump. Rodar G1, G2, G3, G5 e o teste de tamanho. Evidência aceitável se um gate não rodar aqui: saída literal e motivo. Commit `E23 T7: operator.md e gates`.

### Tarefa 8: Teste comportamental pelo orquestrador

Tarefa do orquestrador da sessão principal (DEC-204, R9 da spec), no worktree de E23 antes do merge: parada e retomada sobre fixture sintética marcada (`SYNTHETIC FIXTURE`) em `D:/projects/claude-play-wt/_tmp/E23-comportamental/`, conferindo que a retomada pula as revisões registradas e reaproveita a medição; relatório em `docs/reports/2026-11-13-E23-retomada-comportamental.md`; pasta apagada no fim. Sem ferramenta de subagent, devolve `NEEDS_HUMAN` com `humanInputs` "execução comportamental do orquestrador da sessão principal (DEC-204)", sem relatório fictício; essa é a evidência aceitável. Commit `E23 T8: relatório comportamental`.

## Evidência dos critérios

| Critério | Tipo | Comando | Teste |
|---|---|---|---|
| AC1 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `AC1: a resume with every recorded value skips the spec, plan and final reviews` |
| AC2 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `AC2: the final review runs again when the target moved` |
| AC3 | test | `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` | `AC3: an unchanged target reuses the recorded gates baseline` |

## Decisões do plano

- R11: oito tarefas; script e preflight primeiro, independentes; T3 libera espaço e põe as funções puras; T4-T6 ligam cada estágio.
- R12: testes das funções puras em `flow.test.mjs` por `loadPure()`, sem arquivo de teste novo no workflow.
- R13: nomes `runKey`, `skipReview`, `recordCmd`, `recordedBaseline`, `RR`; a lista do preflight vem de `order`.
- R14: T8 sem subagent devolve `NEEDS_HUMAN`.

```json data
{
  "schema": "plan/1",
  "id": "E23",
  "title": "Retomada do release sem repetir revisões",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ nem a estratégia.",
    "Medir roadmap-release.js com workflowChars depois de cada edição; liberar espaço antes de somar código, só no texto dos estágios que E23 muda; nunca encurtar outro estágio nem editar size.test.mjs ou MAX_WORKFLOW_CHARS; acima de 240000, BLOCKED com o déficit (DEC-556, DEC-563, DEC-592).",
    "Chave de retomada sem a ponta da branch; nenhuma revisão pulada sem registro ou com valor diferente; lógica de efeito externo, planFingerprint e cargas de spec e plano inalteradas.",
    "Nenhuma chamada de agente nova no caminho comum do modo run.",
    "Sem bump de versão; sem push; nunca tocar em main nem em D:/projects/claude-play; não citar superpowers.",
    "Execução comportamental com subagent é do orquestrador da sessão principal (DEC-204); sem relatório fictício."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "Script do registro da execução com teste",
      "deps": [],
      "files": { "create": ["plugins/productivity-tools/scripts/run-record.mjs"], "modify": [], "test": ["plugins/productivity-tools/scripts/run-record.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 2, "blast": 0, "verifiability": 0 },
      "produces": ["node run-record.mjs approve <wt> <dir> <E> <stages> <tip|-> <payload> | key <wt> <dir> -> {recorded,spec,plan,tree} | baseline <repo> <target> <gatesKey> <branch:dir>... -> prep | exit 1 | exit 2"],
      "consumes": [],
      "covers": ["AC1", "AC2", "AC3", "C1", "C3", "C5"],
      "testFirst": true,
      "checks": [{ "cmd": "node --test plugins/productivity-tools/scripts/run-record.test.mjs", "expect": "exit 0" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "Regra de permissão do script e config.md",
      "deps": [1],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs", "plugins/productivity-tools/skills/roadmap-release/references/config.md"], "test": ["plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": ["WORKFLOW_SCRIPTS = ['roadmap.mjs', 'review-package.mjs', 'run-record.mjs']"],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Liberar espaço e funções puras do registro",
      "deps": [1],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["runKey(stdout) -> object|null", "skipReview(stage, k, tip) -> boolean", "recordCmd(RR, wt, dir, E, stages, tip, payload) -> string", "recordedBaseline(stdout, head, gatesKey, defs) -> measure|null", "artifactPaths(...).run"],
      "consumes": [{ "task": 1, "sig": "node run-record.mjs approve <wt> <dir> <E> <stages> <tip|-> <payload> | key <wt> <dir> -> {recorded,spec,plan,tree} | baseline <repo> <target> <gatesKey> <branch:dir>... -> prep | exit 1 | exit 2" }],
      "covers": ["AC1", "AC2", "AC3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Setup lê o registro; pulo de spec e plano; aprovação em progress e plan-only",
      "deps": [3],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["S_SETUP.record", "persistReviews(tag, stages)"],
      "consumes": [{ "task": 3, "sig": "skipReview(stage, k, tip) -> boolean" }, { "task": 3, "sig": "recordCmd(RR, wt, dir, E, stages, tip, payload) -> string" }],
      "covers": ["AC1", "C1", "C2", "C5"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Sincronização devolve o registro; pulo da revisão final",
      "deps": [4],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 1 },
      "produces": ["S_SYNC.record"],
      "consumes": [{ "task": 4, "sig": "persistReviews(tag, stages)" }],
      "covers": ["AC1", "AC2", "C4"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Preflight reaproveita a medição registrada",
      "deps": [5],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"], "test": ["plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 1 },
      "produces": ["S_PRE.recorded"],
      "consumes": [{ "task": 3, "sig": "recordedBaseline(stdout, head, gatesKey, defs) -> measure|null" }],
      "covers": ["AC3", "C3"],
      "testFirst": true,
      "checks": [
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "expect": "exit 0" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "operator.md e gates",
      "deps": [2, 6],
      "files": { "create": [], "modify": ["plugins/productivity-tools/skills/roadmap-release/references/operator.md"], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "só documentação; os gates conferem o conjunto" },
      "checks": [
        { "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"", "expect": "exit 0 (G1)" },
        { "cmd": "claude plugin validate .", "expect": "exit 0 (G2)" },
        { "cmd": "claude plugin validate plugins/productivity-tools", "expect": "exit 0 (G3)" },
        { "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools", "expect": "exit 0 (G5)" },
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Teste comportamental pelo orquestrador",
      "deps": [7],
      "files": { "create": ["docs/reports/2026-11-13-E23-retomada-comportamental.md"], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 1 },
      "produces": [],
      "consumes": [],
      "covers": [],
      "testFirst": { "exempt": "execução comportamental do orquestrador (DEC-204), sem código" },
      "checks": [{ "cmd": "node -e \"process.exit(require('fs').existsSync('docs/reports/2026-11-13-E23-retomada-comportamental.md') ? 0 : 1)\"", "expect": "exit 0 (relatório presente)" }],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    }
  ],
  "evidence": [
    { "ac": "AC1", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "testRef": "AC1: a resume with every recorded value skips the spec, plan and final reviews", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC2", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "testRef": "AC2: the final review runs again when the target moved", "external": false, "externalDedupe": null, "blq": null },
    { "ac": "AC3", "kind": "test", "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs", "testRef": "AC3: an unchanged target reuses the recorded gates baseline", "external": false, "externalDedupe": null, "blq": null }
  ],
  "rulings": [
    {
      "id": "R11",
      "question": "Em que ordem e em quantas tarefas dividir o trabalho?",
      "decision": "Oito tarefas: script com teste (T1); preflight e config.md (T2); espaço e funções puras (T3); setup, spec, plano, progress e plan-only (T4); sync e final (T5); preflight com a medição registrada (T6); operator.md e gates (T7); comportamental (T8). T3-T6 editam roadmap-release.js em cadeia.",
      "basis": "Spec deixa a ordem ao plano, com teste primeiro; nota do dono manda liberar espaço antes de somar código; cada tarefa fica com até quatro arquivos.",
      "alternative": "Uma tarefa única para todo o roadmap-release.js.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "Onde ficam os testes das funções puras?",
      "decision": "Em flow.test.mjs por loadPure(), sem arquivo de teste novo no workflow.",
      "basis": "Escopo da spec cita só casos novos em flow.test.mjs; o arquivo já importa loadPure.",
      "alternative": "Testá-las em review.test.mjs.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Quais nomes finais das funções puras e da lista do preflight?",
      "decision": "runKey, skipReview, recordCmd, recordedBaseline e RR; a lista branch:dir do preflight vem de order, a seleção já calculada.",
      "basis": "Spec deixa os nomes ao plano e já usa runKey, skipReview e recordCmd; order é a seleção do workflow.",
      "alternative": "Nova variável de entregáveis selecionados.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "O que a tarefa comportamental faz num executor sem ferramenta de subagent?",
      "decision": "Devolve NEEDS_HUMAN com humanInputs citando a execução do orquestrador da sessão principal (DEC-204) e não escreve relatório.",
      "basis": "DEC-204, R9 da spec e a nota do dono.",
      "alternative": "Marcar a tarefa noCommit e deixar o relatório fora do plano.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
