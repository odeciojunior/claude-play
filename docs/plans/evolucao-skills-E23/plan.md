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

Toda tarefa que edita `roadmap-release.js` mede `workflowChars` (de `size.test.mjs`) depois de cada edição e anota o total. Antes de somar código, libera espaço só nos estágios que E23 muda (preflight, setup, spec, plano, progresso, sincronização e revisão final, log de revisões), em qualquer um deles, reescrevendo comentários e prosa de prompt sem tirar nenhuma regra. A lógica nova fica em `run-record.mjs`; no workflow só funções puras curtas e linhas de prompt. Nunca encurta outro estágio nem edita `size.test.mjs` ou `MAX_WORKFLOW_CHARS` (DEC-556, DEC-563, DEC-592).

Limites (nota do dono, retomada após r1), medidos depois do código da tarefa e antes do seu commit, sobre 239.866 na ponta da T2:

| Tarefa | Limite de `workflowChars` | Saldo frente à tarefa anterior |
|---|---|---|
| T3 | 238.800 | no mínimo 1.066 a menos que a T2 |
| T4 | 239.500 | até +700 sobre o limite da T3 |
| T5 | 239.700 | até +200 sobre o limite da T4 |
| T6 | 239.800 | até +100 sobre o limite da T5 |

Nenhuma rodada de correção termina acima de 240.000. O limite é conferido pelo check `node --input-type=module -e "import { workflowChars } ..."` da tarefa, que imprime o total e sai 1 acima do limite. A tarefa que não alcança o limite não commita nada e devolve `BLOCKED` com o déficit medido (total menos limite). Como a T4 soma mais código, a T3 libera o máximo que puder além do mínimo.

## Como rodar os checks

Cada comando de check roda sozinho na sua chamada, sem nada encadeado ou canalizado depois (sem `grep`, `tail`, `;` ou `&&`). Numa tarefa com teste primeiro, a execução que falha e a que passa são duas chamadas do mesmo comando idêntico (em T3-T6, `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`). Saída longa é cortada no relatório com `[...]`, nunca filtrada. Se a T3 falhar de novo em `testFirstGap`, para: não há terceiro rebase (DEC-619).

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

Retomada após r1 (DEC-619): o commit anterior desta tarefa saiu por rebase; ela roda de novo do zero sobre a T2. Primeiro liberar espaço (seção Tamanho), rodar `flow.test.mjs`, `review.test.mjs` e `prompts.test.mjs` para conferir que nenhuma regra caiu, e medir. Teste primeiro em `flow.test.mjs`, por `loadPure()`: `E23: runKey and skipReview compare every recorded value` (`runKey` de JSON inválido é null; `skipReview('spec'|'plan'|'final', k, ponta)` verdadeiro só com o estágio registrado e cada valor exigido string não vazia igual ao atual; valor ausente ou diferente dá falso); `E23: recordCmd builds the approve command` (`node "<RR>" approve "<wt>" <dir> <E> <estágios> <ponta|-> '<carga>'`, carga com `encodeURIComponent` e `'` como `%27`); `E23: recordedBaseline accepts only a matching valid measure` (null com `targetHead` ou `gatesKey` diferente ou `validMeasure` falso); o teste existente de `artifactPaths` passa a esperar `run`. Rodar `flow.test.mjs` sozinho e relatar a falha (seção Como rodar os checks). Implementar no bloco `// <pure>`: `artifactPaths` ganha `run`; `runKey`, `skipReview`, `recordCmd`, `recordedBaseline`. Rodar de novo o mesmo comando de `flow.test.mjs`, depois `review.test.mjs`, `prompts.test.mjs`, o teste de tamanho e o check do limite (até 238.800). Commit `E23 T3: funções puras do registro`.

### Tarefa 4: Setup lê o registro; pulo de spec e plano; aprovação em progress e plan-only

Teste primeiro em `flow.test.mjs`: `AC1: a resume with every recorded value skips the spec, plan and final reviews` (setup com `nativeSpec`/`nativePlan` e `record` igual aos blobs; nenhum rótulo `:spec-review` ou `:plan-review`; a parte final entra na T5); `E23: progress records spec and plan only after a review ran` (sem registro, o prompt de `E1:progress` começa pelo comando `approve ... spec,plan`; com pulo, abre com "Read-only"); `E23: plan-only records spec and plan in the review log` (um `E1:review-log-plan` com o comando `approve`). Rodar `flow.test.mjs` sozinho e relatar a falha. Liberar espaço nos estágios de E23 antes de somar e medir. Implementar: `RR` por `pluginRootOf(A.trackerCli)`; passo `record` no setup (`S_SETUP.record`); `K0 = runKey(setup.record)`; laços de spec e plano trocados por `{ ok: true }` nas condições de R3, com `out.concerns` citando `run.json`; `persistReviews(tag, stages)` com `recordCmd` como primeiro comando; `plan-only` chama `persistReviews(cortes ? 'record' : 'plan', 'spec,plan')` quando uma revisão rodou; carga sem `prep` em `plan-only`, com `prep { targetHead: pre.targetHead, gatesKey: fnv1a(canon(GATES)), baseline: pre.baseline }` no modo `run`. Rodar de novo o mesmo comando de `flow.test.mjs`, o teste de tamanho e o check do limite (até 239.500). Commit `E23 T4: pulo das revisões de spec e plano`.

### Tarefa 5: Sincronização devolve o registro; pulo da revisão final

Teste primeiro em `flow.test.mjs`: completar `AC1: a resume with every recorded value skips the spec, plan and final reviews` (sync com `record` igual nos quatro valores e `targetTip` registrada: nenhum `:final-` nem `:test-integrity`, segue para os gates); `AC2: the final review runs again when the target moved` (mesmo registro, `targetTip` diferente: `E1:final-1-r1` chamado e o prompt de `E1:review-log` traz `approve ... final`). Rodar `flow.test.mjs` sozinho e relatar a falha. Liberar espaço nos estágios de E23 antes de somar e medir. Implementar: `syncBranch` devolve `record` (`S_SYNC.record`, mesmo `key` depois do merge); `skipReview('final', runKey(sync.record), sync.targetTip)` pula integridade e `finalLoop` (R6), com concern; `persistReviews('', 'final')` só quando a final rodou. Rodar de novo o mesmo comando de `flow.test.mjs`, o teste de tamanho e o check do limite (até 239.700). Commit `E23 T5: pulo da revisão final`.

### Tarefa 6: Preflight reaproveita a medição registrada

Teste primeiro em `flow.test.mjs`: `AC3: an unchanged target reuses the recorded gates baseline` (preflight devolve `recorded` válido sem `baseline`: o prompt de `preflight` traz `run-record.mjs" baseline`, a execução não para em `preflight:` e `BASE` vem da medição registrada); recusa com `gatesKey` diferente para em `preflight:` como hoje (C3). Rodar `flow.test.mjs` sozinho e relatar a falha. Liberar espaço nos estágios de E23 antes de somar e medir. Implementar: no modo `run`, passo 4 começa pelo comando `baseline` com `branch:dir` de cada entregável de `order`; `S_PRE.recorded`; `recordedBaseline(pre.recorded, pre.targetHead, fnv1a(canon(GATES)), GATES)` vira `pre.baseline` antes da conferência de preflight incompleto. Rodar de novo o mesmo comando de `flow.test.mjs`, o teste de tamanho e o check do limite (até 239.800). Commit `E23 T6: reaproveita a medição dos gates`.

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
- R15: T3-T6 conferem seu limite de `workflowChars` por check; o par falha-aprovação é `flow.test.mjs` rodado sozinho duas vezes (DEC-619).

```json data
{
  "schema": "plan/1",
  "id": "E23",
  "title": "Retomada do release sem repetir revisões",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-evolucao-skills/",
  "constraints": [
    "Não editar a pasta docs/plans/roadmap-evolucao-skills/ nem a estratégia.",
    "Medir roadmap-release.js com workflowChars depois de cada edição; liberar espaço antes de somar código, só no texto dos estágios que E23 muda, sem tirar regra; nunca encurtar outro estágio nem editar size.test.mjs ou MAX_WORKFLOW_CHARS (DEC-556, DEC-563, DEC-592).",
    "Limites de workflowChars depois do código da tarefa e antes do commit: T3 <= 238800, T4 <= 239500, T5 <= 239700, T6 <= 239800; nenhuma rodada de correção termina acima de 240000; tarefa que não alcança o limite não commita e devolve BLOCKED com o déficit medido (DEC-619).",
    "Cada check roda sozinho na sua chamada, sem pipe nem encadeamento; falha e aprovação de tarefa com teste primeiro são duas chamadas do mesmo comando; saída longa cortada com [...], nunca filtrada; T3 falhando de novo em testFirstGap para, sem terceiro rebase (DEC-619).",
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
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 238800 ? 0 : 1\"", "expect": "exit 0 (workflowChars até 238800, medido depois do código e antes do commit; acima: BLOCKED com o déficit, sem commit)" }
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
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239500 ? 0 : 1\"", "expect": "exit 0 (workflowChars até 239500, medido depois do código e antes do commit; acima: BLOCKED com o déficit, sem commit)" }
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
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239700 ? 0 : 1\"", "expect": "exit 0 (workflowChars até 239700, medido depois do código e antes do commit; acima: BLOCKED com o déficit, sem commit)" }
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
        { "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs", "expect": "exit 0 (até 240000 caracteres LF)" },
        { "cmd": "node --input-type=module -e \"import { workflowChars } from './plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs'; import { readFileSync } from 'node:fs'; const n = workflowChars(readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js', 'utf8')); console.log('workflowChars', n); process.exitCode = n <= 239800 ? 0 : 1\"", "expect": "exit 0 (workflowChars até 239800, medido depois do código e antes do commit; acima: BLOCKED com o déficit, sem commit)" }
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
    },
    {
      "id": "R15",
      "question": "Como a retomada após r1 leva os limites de tamanho e o modo de rodar os checks às tarefas 3 a 6?",
      "decision": "Cada tarefa de T3 a T6 ganha um check que importa workflowChars de size.test.mjs, imprime o total e sai 1 acima do seu limite (238800, 239500, 239700, 239800); a T3 libera espaço antes do teste primeiro, o máximo que puder, porque a T4 soma mais código; o par falha-aprovação é flow.test.mjs rodado sozinho duas vezes.",
      "basis": "Nota do dono da retomada e DEC-619; no r1 a falha da T3 passou por grep e a folga ficou em 19 caracteres.",
      "alternative": "Conferir o limite só na prosa, sem check.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
