# E7 -- Coordinator com mapa e estado em código: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Goal:** O `plan-coordinator` passa a tirar o mapa de `plan-tool`/`lib/routing.mjs`, a guardar o estado em `progress.json` (esquema `progress/1`) com transições em funções puras e CLI, a resolver as paradas incidentais por padrão, e o tracker fecha a peça lendo esse JSON, com teste de contrato.

**Architecture:** `plugins/productivity-tools/lib/progress-state.mjs` é fonte pura (DEC-058; passa em `checkPureSource`) com `STATE_SCHEMA`, `STEP_STATUSES`, `RUN_STATUSES`, `EVENT_TYPES`, `initState`, `applyEvent` e `nextAction`. `skills/plan-coordinator/scripts/progress.mjs` é a CLI (`select`, `init`, `next`, `apply`, `show`) que lê/grava o arquivo, chama `emitPlan`/`buildBriefs` de `scripts/plan-tool.mjs` e usa git só para base e raiz. `skills/roadmap-tracker/scripts/roadmap.mjs` ganha `close-from-state`, com leitor próprio e `PROGRESS_CONTRACT`. A prosa do coordinator deixa a tabela de 31 linhas e manda chamar a CLI.

**Tech Stack:** Node 18+ (medido: v22.17.1), ESM, `node:test`, `node:assert/strict`, `node:child_process` (`spawnSync` para git e para a CLI em processo novo), sem dependências nem npm.

**Spec:** `docs/superpowers/specs/2026-11-12-E7-coordinator-mapa-estado-codigo-design.md` (o executor lê o spec junto: forma do esquema na peça 2, regras de seleção na peça 3, regra de fechamento na peça 4, casos de borda).

## Global Constraints

- `lib/progress-state.mjs` sem `import`, `require`, `process`, `Buffer`, `crypto` nem `Date` de relógio (o instante chega como argumento `now`, string ISO), nem em texto entre aspas; `checkPureSource(texto, 'progress-state.mjs')` de `plugins/productivity-tools/scripts/embed.mjs` devolve `null`. Nomes de topo prefixados `ps` nas funções internas (a cópia de E12 junta fontes num escopo; `routing.mjs` usa `rt`, `plan-digest.mjs` usa `canon`/`fnv1a`/`planDigest`).
- `schema` exatamente `"progress/1"`. Status de passo exatos: `pending`, `launched`, `review-owed`, `pass`, `skip`, `skip-manual`, `waiting-manual`, `stopped`. Status de execução: `map-ready`, `in-progress`, `blocked`, `completed`. `finalGate.status`: `pending`, `pass`, `skip`. Tipos de entrada manual: `refused`, `prelaunch-failed`, `not-named`, `open-question`.
- `applyEvent(state, event, now)` nunca muta `state` (nem objetos aninhados): devolve `{ ok: true, state }` com objeto novo, ou `{ ok: false, code, message }`. Recusa nunca grava arquivo.
- Códigos de recusa (exatos): `dependency-not-passed`, `wrong-status`, `blocked`, `external-unauthorized`, `external-relaunch`, `wave-order`, `unknown-step`, `unknown-event`, `inline-not-allowed`, `tier-down`, `dependency-held`, `gate-owed`, `steps-open`. Códigos da CLI: `plan-no-data-block`, `plan-invalid`, `state-exists`, `state-schema`, `concurrent-change`, `plan-changed` (ação, não recusa). Do tracker: `state-schema`, `roadmap-mismatch`, `deliverable-unknown`.
- Mensagem de `plan-no-data-block`, literal: `plano sem bloco de dados: o coordinator não interpreta planos em prosa; adote-o com a skill plan-writer (modo de adoção), que o reescreve no formato plan/1 no mesmo caminho`.
- Linha nova do prompt do executor, literal, na seção Rules do template de `delegation-protocol.md`: `Never ask the person a question. If something only a person can answer blocks you, stop and report BLOCKED with the question in CONCERNS.`
- CLI do coordinator: saída `--json` no molde `{ tool: "progress", command, path, ok, ..., errors: [], warnings: [] }`; exit 0 feito (pergunta de `select` incluída), 1 recusado sem alteração, 2 uso inválido ou arquivo ilegível. Mensagens em português. Gravação: LF, sem BOM, `JSON.stringify(state, null, 2) + '\n'`, por arquivo temporário na mesma pasta e `renameSync`. Leitura aceita CRLF e BOM.
- CLI do tracker: mensagens em inglês, como o resto de `roadmap.mjs`; `COMMAND_NAMES` passa de 18 para 19; o tracker não importa nada de `skills/plan-coordinator/` nem de `lib/progress-state.mjs` (só o teste importa).
- Nenhum arquivo sob `plugins/productivity-tools/skills/plan-coordinator/` (inclusive `scripts/` e o próprio teste) contém a palavra superpowers em qualquer caixa; o teste monta a palavra por concatenação (`'super' + 'powers'`).
- Nenhum arquivo embarcado recomenda `bypassPermissions` como modo padrão (DEC-312); as regras de permissão sugeridas continuam regras exatas.
- Não editar: `scripts/plan-tool.mjs`, `lib/routing.mjs`, `lib/plan-digest.mjs` (contratos de E6), `roadmap-release.js` nem o SKILL.md do release (E8), `docs/plans/roadmap-evolucao-skills/`, `plugins/_template/`, nenhum `plugin.json` nem a tabela de versões do `README.md` da raiz (nenhuma versão sobe), nem o comando de nenhum gate. `plan-tool.test.mjs` e `spec-tool.test.mjs` não mudam de expectativa.
- Testes que gravam usam `fs.mkdtempSync(path.join(os.tmpdir(), 'progress-'))` (coordinator) ou `'roadmap-cli-'` (tracker), removidas no fim; git nos testes sempre com `-c user.name=t -c user.email=t@t -c commit.gpgsign=false` e `init -q -b main`. Nada é gravado em `fixtures/` pelos testes.
- Ambiente medido: Windows 11, Git Bash e PowerShell 7, Node v22.17.1, git 2.50.1, `core.autocrlf=true` (fixtures chegam em CRLF). Rode tudo a partir de `D:/projects/claude-play-wt/E7`, branch `feat/E7`. Linha de base de G1: 1421 testes, 0 falhas, 0 pulados; G2 a G5 exit 0.
- Nenhum servidor nem porta (a faixa 5210-5219 não é usada). Nenhuma tarefa precisa de navegador. Nenhum push, nenhum efeito externo.
- Commits só com os arquivos da tarefa (`git add <arquivos>`, nunca `git add -A` nem `git stash`), mensagem começando por `E7 T<n>:` e terminando com a linha `Co-Authored-By: Claude <noreply@anthropic.com>`. Temporários de verificação manual só em `D:/projects/claude-play-wt/_tmp/E7/` (apagar no fim). Árvore limpa ao fim de cada tarefa.

## Review Focus

- `progress.json` gravado em CRLF ou com BOM (checkout `core.autocrlf=true`): `next` e `apply` leem igual, e `apply` regrava em LF. Teste na Task 4 (`state file in CRLF with BOM is read and rewritten in LF`).
- Plano editado depois do `init`: `next` devolve a ação `plan-changed` e nenhum evento é aplicado sozinho. Teste na Task 4 (`next returns plan-changed after the plan text changes`).
- Passo externo já lançado nunca volta a `pending` por nenhum evento (falha, sem relatório, defeitos de revisão, portão de onda, portão final): teste exaustivo na Task 3 (`no event takes a launched external step back to pending`).
- Estado com `schema` desconhecido (`progress/2`) em `next`/`apply` e no tracker: recusa `state-schema`, exit 1, arquivo intacto. Testes nas Tasks 4 e 6.
- Seleção sem `--query` com dois planos em andamento, ou sem nenhum plano: pergunta, nunca escolha. Teste na Task 5 (`select without query and two runs in progress asks`).

---

### Task 1: esquema `progress/1`, `initState` e `nextAction` (critério 3 na lib)

**Files:**
- Create: `plugins/productivity-tools/lib/progress-state.mjs`
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: `emitPlan(text, { planPath, root, specText, specPath, maxWidth }) -> { errors, warnings, out }` e `checkPlan`, `buildMap(plan, levels, { maxWidth })` de `plugins/productivity-tools/scripts/plan-tool.mjs` (só no teste); `checkPureSource` de `scripts/embed.mjs` (só no teste).
- Produces (exportados):
  - `STATE_SCHEMA = 'progress/1'`; `STEP_STATUSES` (os 8, na ordem das Global Constraints); `RUN_STATUSES`; `EVENT_TYPES` (lista das Tasks 2 e 3: `approve-map`, `block`, `unblock`, `launch`, `inline-start`, `inline-result`, `report`, `no-report`, `review-result`, `hold`, `release`, `skip`, `commit`, `wave-gate`, `advance`, `final-gate`, `prelaunch-review`, `authorize`, `refuse`, `card-changed`, `answer`).
  - `initState(emitted, opts) -> state`, com `emitted` = `emitPlan(...).out` e `opts = { planPath, spec = null, piece = null, worktree = null, branch = null, base = null, commits = 'none', test = null, baseline = null, now }`. Forma: a do spec (peça 2) mais `plan.spec` (caminho do spec usado ou `null`), `run.wave` (onda corrente, começa em 1), `steps[].brief` (`briefs/T<n>.md`), `steps[].rounds` (rodadas de correção, 0) e `steps[].outputs` (`null`; `true|false` só em `skip`). `plan = { path: opts.planPath, id: emitted.plan.id, digest: emitted.digest, maxWidth: emitted.plan.maxWidth, roadmap: emitted.plan.roadmap ?? null, spec }`; `run.status = 'map-ready'`; `steps[i]` copia `n`, `title`, `deps`, `external`, `wave` e `route.tier/effort/reviewTier/gate` de `emitted.plan.tasks[i]`; `waves` = tarefas agrupadas por `wave`, ordenadas por `n`; `finalGate = { status: 'pending', rounds: 0, lastVerdict: null }`; `manual = []`; `history = [{ event: 'init', at: now }]`.
  - `nextAction(state) -> { action, ... }` (ordem abaixo).
  - Funções internas prefixadas `ps` (`psClone`, `psStep`, `psDepsOk`, ...).

- [ ] **Step 1: Escrever os testes** em `progress.test.mjs` (novo; importa `../../../lib/progress-state.mjs`, `../../../scripts/plan-tool.mjs`, `../../../scripts/embed.mjs`; o plano de exemplo é `plugins/productivity-tools/scripts/fixtures/plan-tool/plan.md`, lido com `emitPlan(text, { planPath })`):
  - `progress-state is pure`: `checkPureSource(texto, 'progress-state.mjs') === null`.
  - `AC3: initState copies waves, tiers and gates from plan-tool (default width)`: com `r = checkPlan(...)` e `m = buildMap(r.data, r.levels, { maxWidth: 4 })`, `state.waves` deep-equal `m.waves.map(w => ({ n: w.n, tasks: w.tasks.map(t => t.n) }))`; para cada tarefa de cada onda de `m`, o passo `n` tem `tier`, `effort`, `reviewTier`, `gate`, `external` e `wave` iguais. Valores conhecidos: ondas `[[1],[2,3,5],[4],[6]]`; T5 `sonnet`/`opus`/`gate true`/`external true`; T2 `haiku`.
  - `AC3: same with maxWidth 2`: idem com `emitPlan(..., { maxWidth: 2 })` e `buildMap(..., { maxWidth: 2 })`; `state.plan.maxWidth === 2` e o `digest` difere do de largura 4.
  - `initState shape`: `schema === STATE_SCHEMA`, `run.status === 'map-ready'`, `run.wave === 1`, todos os passos `pending`, `attempts 0`, `mode 'delegated'`, `agent 'general-purpose'`, `brief 'briefs/T1.md'`.
  - `nextAction order` (estados montados à mão a partir de `initState`, um caso por ação): `map-ready` -> `approve-map`; `blocked` com `question 'q'` -> `{ action: 'ask', question: 'q' }`; passo `launched` com `agentId 'a1'` -> `{ action: 'await', steps: [n], agentIds: ['a1'] }`; passo `review-owed` -> `{ action: 'review', step, reviewTier }`; `waveGateOwed: 1` sem nada em voo -> `{ action: 'wave-gate', wave: 1 }`; onda 2 corrente com T2,T3 admitidos e T5 externo sem revisão -> `{ action: 'prelaunch-review', steps: [5] }`; T5 revisado sem autorização -> `{ action: 'authorize', steps: [5] }`; dependente de passo `skip` com `outputs: false` -> `{ action: 'hold', steps: [n] }`; onda 1 recém-aprovada -> `{ action: 'launch', wave: 1, steps: [{ n: 1, tier: 'sonnet', effort, agent: 'general-purpose', brief: 'briefs/T1.md', mode: 'delegated' }] }`; na onda 2 os candidatos inline (haiku, não externo, sem portão: T2, T3) vêm primeiro com `mode: 'inline'`; todos terminais e `finalGate pending` -> `final-gate`; `finalGate pass` e entrada manual aberta -> `{ action: 'ask', manual: [...] }`; `completed` -> `done`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`
Expected: FAIL (módulo `lib/progress-state.mjs` não existe).

- [ ] **Step 3: Implementar** `initState` e `nextAction` em `lib/progress-state.mjs`. Ordem de `nextAction` (Step 8 item 6 e laço de ondas atuais): `completed` -> `done`; `map-ready` -> `approve-map`; `blocked` -> `ask`; passos `launched` -> `await`; `review-owed` -> `review` (o de menor `n`); `waveGateOwed` -> `wave-gate`; na onda `run.wave`: pendentes cuja dependência está em `skip` sem saídas, `skip-manual`, `waiting-manual` ou `stopped` -> `hold`; externos pendentes sem `preLaunchReview` -> `prelaunch-review`, revisados sem `authorized` -> `authorize`; admitidos (dependências `pass` ou `skip` com `outputs: true`; externo só com revisão e autorização) -> `launch` com inline primeiro; onda corrente sem pendente nem em voo e onda seguinte existe -> `{ action: 'advance', wave: run.wave + 1 }`; nenhum pendente -> `final-gate` se `finalGate.status === 'pending'`, senão `ask` com as entradas manuais abertas, senão `done`.

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`
Expected: PASS, todos os testes acima.

- [ ] **Step 5: Gates e commit**

Run: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` -> exit 0, 0 falhas (total > 1421). `claude plugin validate .` e `claude plugin validate plugins/productivity-tools` -> exit 0.

```bash
git add plugins/productivity-tools/lib/progress-state.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T1: esquema progress/1, initState e nextAction" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `applyEvent` -- execução, passos não externos e portões (critério 1)

**Files:**
- Modify: `plugins/productivity-tools/lib/progress-state.mjs`
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: `initState`, `STEP_STATUSES` (Task 1).
- Produces: `applyEvent(state, event, now) -> { ok: true, state } | { ok: false, code, message }`, com `event = { type, step?, steps?, value?, text?, agentId?, sha?, tier? }`. Todo evento aceito anexa a `history` `{ event: type, step|steps, value?, at: now }` e grava `run.updated = now`. Regra comum: `schema` diferente de `STATE_SCHEMA` -> `state-schema`; `type` fora de `EVENT_TYPES` -> `unknown-event`; passo inexistente -> `unknown-step`.

Regras desta tarefa (fonte: tabela de `references/delegation-protocol.md` § Step lifecycle, ainda presente nesta tarefa; cada regra leva em comentário `// linha <n>`):

| Evento | Pré-condição (senão código) | Efeito | Linhas |
|---|---|---|---|
| `approve-map` | `run.status` `map-ready` (`wrong-status`) | `in-progress` | 28 |
| `block` (`text` = pergunta) | `map-ready` ou `in-progress` (`wrong-status`) | `blocked`, `run.question = text` | 29, 30 |
| `unblock` | `blocked` (`wrong-status`) | `in-progress`, `question null` | 30 |
| `launch` (`steps`, `agentId?`, `tier?`) | `in-progress` (`blocked` se bloqueado, `wrong-status` se outro); cada passo `pending` (`wrong-status`); `wave === run.wave` e `waveGateOwed null` (`wave-order`); toda dependência `pass` ou `skip` com `outputs true` (`dependency-not-passed`); `tier` dado não abaixo do registrado (`tier-down`) | `launched`, `attempts + 1`, `agentId`, `tier` se dado | 1, 8 |
| `inline-start` (`step`) | como `launch`; mais `tier haiku`, não externo, `gate false`, nenhum passo `launched` (`inline-not-allowed`) | `launched`, `mode 'inline'`, `attempts + 1` | 2 |
| `inline-result` (`value pass\|fail`) | `launched` e `mode inline` (`wrong-status`) | `pass`; `fail` -> `pending`, `mode 'delegated'`, `tier 'sonnet'` | 2 |
| `report` (`value pass\|fail\|blocked`), não externo | `launched` (`wrong-status`) | `pass` -> `review-owed` se `gate`, senão `pass`; `fail`/`blocked` -> `pending` se `attempts < 3`, senão `skip-manual` + manual `open-question` | 9, 10 |
| `no-report`, não externo | `launched` | `pending` | 11 |
| `review-result` (`value pass\|defects\|lost`), não externo | `review-owed` | `pass` -> `pass`; `lost` -> fica `review-owed` com `note 'reviewer lost'` (nova revisão); `defects` -> `launched`, `rounds + 1` se `rounds < 2`, senão como `report fail` | 13, 14 |
| `hold` (`step`, `text`) | `pending` | dependência em `skip-manual`, `waiting-manual` ou `stopped` -> `waiting-manual`; senão `skip-manual` + manual `open-question` com `text`; os dependentes transitivos `pending` -> `waiting-manual` | 3, 4 |
| `release` (`step`) | `skip-manual` (fecha as entradas abertas do passo) ou `waiting-manual` sem dependência retida (`dependency-held`) | `pending` | 18, 24 |
| `skip` (`step`, `value outputs\|no-outputs`) | `pending`, `run.status` `map-ready` (`wrong-status`) | `skip`, `outputs` | 26 |
| `commit` (`step`, `sha`) | `pass` | `sha` | 25 |
| `wave-gate` (`value pass\|fail`, `step?`) | `waveGateOwed` não nulo e nada `launched`/`review-owed` (`wrong-status`) | `pass` -> `waveGateOwed null`; `fail` com passo `pass` da onda: não externo -> `pending` (linha 10) | 25 |
| `advance` | `waveGateOwed null` (`gate-owed`); nenhum passo da onda corrente `pending`, `launched` ou `review-owed` (`steps-open`) | `run.wave` = próxima onda com passos | laço de ondas |
| `final-gate` (`value pass\|defects\|skip`, `step?`) | nenhum passo `pending`/`launched`/`review-owed` e `waveGateOwed null` (`steps-open`) | `rounds + 1`, `lastVerdict = value`; `pass`/`skip` -> `finalGate.status`, `run.status completed`; `defects` com passo não externo -> `pending` | 27, 31 |

`waveGateOwed`: depois de qualquer evento que leve um passo da onda corrente a `pass`, se nenhum passo dessa onda ficou `launched` ou `review-owed`, `run.waveGateOwed = run.wave`.

- [ ] **Step 1: Escrever os testes** (um por recusa e um por linha):
  - `AC1: launch with a dependency not passed is refused and the state does not change`: `s = applyEvent(initState(...), { type: 'approve-map' }, T0).state`; `frozen = structuredClone(s)`; levar T1 a `launched` e não a `pass`, avançar a onda à força num estado montado (`run.wave = 2`); `applyEvent(x, { type: 'launch', steps: [2] }, T1)` -> `{ ok: false, code: 'dependency-not-passed' }` e `assert.deepEqual(x, cópiaAntes)`; idem com T1 em `skip` com `outputs: false`.
  - `applyEvent never mutates its input`: para cada evento aceito do roteiro feliz (approve-map, launch [1], report pass, advance, ...), `deepEqual(entrada, cloneAntes)` e `result.state !== entrada`.
  - Um teste por código: `wrong-status` (launch de passo `pass`), `blocked` (launch com `run.status blocked`), `wave-order` (launch de T4 na onda 2), `unknown-step` (step 99), `unknown-event` (`type 'jump'`), `inline-not-allowed` (inline-start de T1 sonnet), `tier-down` (launch com `tier 'haiku'` em T1 sonnet), `dependency-held` (release com dependência `stopped`), `gate-owed` e `steps-open` (advance), `state-schema` (`schema 'progress/2'`).
  - `report pass on a gated step owes a review; review pass closes it`; `report fail three times holds the step` (attempts 3 -> `skip-manual` e manual `open-question`); `defects after two rounds behave as report fail`; `inline fail re-routes to sonnet`; `hold marks transitive dependents waiting`; `wave gate becomes owed when the wave settles`; `final-gate pass completes the run`.

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> FAIL (`applyEvent` não exportado).

- [ ] **Step 3: Implementar** `applyEvent` com uma função `ps<Evento>` por evento, cada uma recebendo um clone profundo (`psClone`, via `JSON.parse(JSON.stringify(...))`) e devolvendo recusa antes de qualquer escrita no clone. Os ramos externos de `report`, `no-report`, `review-result`, `wave-gate` e `final-gate` devolvem por ora `{ ok: false, code: 'wrong-status' }` (a Task 3 os completa).

- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS.

- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2 e G3 exit 0.

```bash
git add plugins/productivity-tools/lib/progress-state.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T2: applyEvent para passos não externos, ondas e portões" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `applyEvent` -- passos externos e respostas manuais

**Files:**
- Modify: `plugins/productivity-tools/lib/progress-state.mjs`
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: `applyEvent` e os auxiliares `ps*` (Task 2).
- Produces: os eventos `prelaunch-review`, `authorize`, `refuse`, `card-changed`, `answer` e os ramos externos; nenhuma assinatura nova.

| Evento | Pré-condição | Efeito | Linhas |
|---|---|---|---|
| `launch` de externo | `preLaunchReview === 'pass'` e `authorized` não nulo (`external-unauthorized`); `attempts >= 1` (`external-relaunch`); nunca `inline-start` (`inline-not-allowed`) | como Task 2 | 1, 6 |
| `prelaunch-review` (`value pass\|defects`) | externo `pending` (`wrong-status`) | `pass` -> `preLaunchReview 'pass'`; `defects` -> `rounds + 1`; com `rounds` 2 -> `skip-manual` + manual `prelaunch-failed` | 5 |
| `authorize` | externo `pending` com `preLaunchReview pass`, ou `skip-manual` externo com entrada `refused`/`not-named` (`wrong-status`) | `authorized = now`; de `skip-manual` -> `pending` fechando a entrada | 6, 20, 23 |
| `refuse` (`value refused\|not-named`) | externo `pending` revisado | `skip-manual` + manual do tipo dado | 6 |
| `card-changed` | externo `pending` ou `skip-manual` | `preLaunchReview null`, `authorized null` | 7, 19 |
| `report fail\|blocked`, `no-report` de externo | `launched` | `stopped` + manual `open-question` (resultado não conferido) | 12 |
| `review-result defects` de externo | `review-owed` | `stopped` + `open-question` | 14 |
| `wave-gate fail` / `final-gate defects` em externo `pass` | -- | `stopped` + `open-question` | 25 |
| `answer` (`value done\|no\|rerun\|value`, `text?`) | passo `stopped` ou `skip-manual` (`wrong-status`) | `stopped`: `done` -> `pass`; `no` -> fica `stopped`, entrada vira `refused`; `rerun` -> fica `stopped`, entrada `refused`, `replacedBy = N` com N = maior `n` + 1, passo novo N externo `pending` (cópia de título, `deps`, onda, nível; `attempts 0`, revisão e autorização nulas), dependentes de n e `waves` passam a apontar N. `skip-manual`: `done` -> `pass`; `no` -> entrada `refused`, fica `skip-manual`; `value` -> `note = text`, `pending`; externo: revisão e autorização zeradas | 15-17, 19, 21, 22 |

- [ ] **Step 1: Escrever os testes**:
  - `external launch needs review and authorization`: T5 do plano de exemplo na onda 2 -> `external-unauthorized`; após `prelaunch-review pass` ainda `external-unauthorized`; após `authorize` aceita.
  - `external step launches at most once`: T5 `stopped` -> `answer rerun` -> T5 continua `stopped`, `replacedBy 7`, passo 7 `pending`, `deps [1]`, T6 com `deps` contendo 7 e não 5; `launch [5]` -> `wrong-status`; um estado com T5 `pending` e `attempts 1` -> `external-relaunch`.
  - `no event takes a launched external step back to pending`: a partir de T5 `launched`, para cada `type` de `EVENT_TYPES` e cada `value` aceito pelo tipo (lista fechada no teste), aplicado ao passo 5 e encadeado com `review-result`/`wave-gate`/`final-gate` quando aplicável, o passo 5 nunca termina `pending`.
  - `card-changed clears review and authorization`; `prelaunch defects twice holds the step as prelaunch-failed`; `refuse not-named then authorize returns to pending`; `answer done on stopped is pass`; `answer value writes the note and returns to pending`.

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> FAIL.
- [ ] **Step 3: Implementar** os eventos e ramos da tabela.
- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS.
- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2, G3 exit 0.

```bash
git add plugins/productivity-tools/lib/progress-state.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T3: applyEvent para passos externos e respostas manuais" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: CLI `progress.mjs` -- `init`, `next`, `apply`, `show` (critérios 2, 3 e 7 pela CLI)

**Files:**
- Create: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs`
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: `emitPlan`, `buildBriefs`, `checkPlan`, `buildMap` de `../../../scripts/plan-tool.mjs`; `readDataBlock` de `../../../lib/data-block.mjs`; `initState`, `applyEvent`, `nextAction`, `STATE_SCHEMA` de `../../../lib/progress-state.mjs`.
- Produces:
  - `main(argv, io = { stdout, stderr }) -> exitCode` (molde de `plan-tool.mjs main`), executado quando o arquivo é o script de entrada.
  - `readState(file) -> { state, bytes }` (tira BOM, aceita CRLF; `schema` errado -> lança `{ code: 'state-schema' }`).
  - `writeState(file, bytesBefore, state)` (relê, compara com `bytesBefore`; diferente -> lança `{ code: 'concurrent-change' }`; senão temporário + `renameSync`).
  - Comandos: `init <plan.md> [--spec <spec.md>] [--max-width <n>] [--piece <rótulo>] [--base <sha>] [--commits per-step|none] [--restart] [--json]`; `next <progress.json> [--json]`; `apply <progress.json> <evento> [--step <n>] [--steps <n,...>] [--value <v>] [--text <t>] [--agent-id <id>] [--sha <sha>] [--tier <t>] [--json]`; `show <progress.json>`.

Comportamento:
- `init`: sem bloco `json data` de nível superior (`readDataBlock`) -> `plan-no-data-block`, exit 1, mensagem literal das Global Constraints, nada gravado e nenhuma outra leitura do plano. Erros de `emitPlan` -> `plan-invalid`, exit 1, com os códigos. `progress.json` já existe e sem `--restart` -> `state-exists`, exit 1. Raiz = `git rev-parse --show-toplevel` a partir da pasta do plano, senão a pasta do plano; `plan.path` relativo à raiz com `/`. Base: `--base`; senão, se `HEAD` está no ramo padrão (`git symbolic-ref --short refs/remotes/origin/HEAD` sem `origin/`, senão `main` se existir, senão `master`), o SHA de `HEAD`; senão `git merge-base <padrão> HEAD`; sem git, `null`. Cada padrão aplicado vira entrada de `history` `{ event: 'default', what: 'base', value, at }`. Grava `briefs/T<n>.md` (de `buildBriefs`, em LF) e `progress.json` na pasta do plano; imprime o mapa (ondas com nível, effort, portão, externo).
- `next`: recalcula `emitPlan` do `plan.path` (com `plan.spec` e `plan.maxWidth`); digest diferente -> `{ action: 'plan-changed' }`, exit 0; senão `nextAction(state)`. `--json` imprime `{ tool: 'progress', command: 'next', path, ok: true, action: {...}, errors: [], warnings: [] }`.
- `apply`: monta o evento das opções, `applyEvent(state, event, new Date().toISOString())`; recusa -> exit 1, `ERROR <código>: <mensagem>` em stderr, arquivo intacto; aceita -> `writeState`, exit 0, imprime a próxima ação.
- `show`: tabela de passos (`n`, título, onda, nível/effort, portão, externo, status, tentativas, sha) e `run.status`.
- Uso inválido (comando, opção, `--max-width` não inteiro >= 1, `--steps` malformado) ou arquivo ilegível -> exit 2.

- [ ] **Step 1: Escrever os testes** (CLI por `spawnSync(process.execPath, [PROGRESS, ...])`; cada teste copia `scripts/fixtures/plan-tool/plan.md` para `<tmp>/plan-tool/plan.md` e `scripts/fixtures/spec-tool/spec.md` para `<tmp>/spec-tool/spec.md`, com `git init` em `<tmp>` e um commit inicial):
  - `AC7: plan without data block is refused pointing to adoption`: plano só em prosa -> exit 1; stdout `--json` com `code 'plan-no-data-block'`; mensagem contém `plan-writer` e `adoção`; a pasta não ganha `progress.json` nem `briefs/`.
  - `AC3: init through the CLI matches plan-tool map` (largura padrão e `--max-width 2`): `progress.json` gravado tem as ondas e o roteamento de `buildMap`; `briefs/T1.md` a `T6.md` existem.
  - `init refuses plan-invalid` (plano com `deps: [99]`) e `state-exists`; `--restart` recria.
  - `init records the default base`: em `main`, `run.base` é o SHA de `HEAD` e `history` tem `{ event: 'default', what: 'base' }`; num ramo `feat` com um commit a mais, `run.base` é o merge-base.
  - `AC2: next in a fresh process returns the next action from the file alone`: estado gravado com T1 `pass`, onda 2 corrente, T2 `launched` (`agentId 'a2'`) e T5 `review-owed`: primeiro `{ action: 'await', steps: [2], agentIds: ['a2'] }`; depois de mudar T2 para `pass` no arquivo, `{ action: 'review', step: 5, reviewTier: 'opus' }`. Cada chamada é um `spawnSync` novo, sem outro argumento além do caminho.
  - `AC1: apply refused leaves the file byte-identical`: `apply <f> launch --steps 2` com T1 `pending` -> exit 1, `dependency-not-passed`, bytes iguais aos de antes.
  - `apply accepted writes LF and appends history`; `state file in CRLF with BOM is read and rewritten in LF`; `next returns plan-changed after the plan text changes`; `next and apply refuse state-schema` (`progress/2`, exit 1, arquivo intacto); `writeState refuses concurrent-change` (chamada direta: grava outro conteúdo entre `readState` e `writeState` -> lança `concurrent-change`, arquivo com o conteúdo alheio); `usage errors exit 2`; `show prints one row per step`.

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> FAIL (`progress.mjs` não existe).
- [ ] **Step 3: Implementar** `progress.mjs` conforme acima.
- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS.
- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2, G3 exit 0; G5 `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` exit 0.

```bash
git add plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T4: CLI progress com init, next, apply e show" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: seleção de plano por padrão (`select`, critério 4)

**Files:**
- Modify: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs`
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: `main`, `readState` (Task 4); `readDataBlock`.
- Produces: `selectPlan({ root, query = null }) -> { choice: '<caminho relativo>' } | { question: '<texto>', candidates: ['<caminho>', ...] }` exportado; comando `select [--query <texto>] [--root <pasta>] [--json]` (raiz padrão: `git rev-parse --show-toplevel` do cwd, senão cwd), sempre exit 0.

Regras (spec, peça 3): candidatos = todo `plan.md` sob `<root>/docs/plans/` (recursivo, sem `node_modules` nem `.git`). Com `query`: forte = nome da pasta igual ao texto, ou pasta terminada em `-<ID>` com o texto igual ao ID, ou `id` do bloco de dados igual ao texto (sem diferenciar caixa); uma forte -> `choice`; duas ou mais -> `question` com elas; nenhuma -> `question` com as fracas (texto contido no caminho, sem caixa), ou, sem nenhuma, `question` que oferece escrever o plano e `candidates: []`. Sem `query`: forte = plano com `progress.json` ao lado e `run.status !== 'completed'`; uma -> `choice`; nenhuma e exatamente um `plan.md` sem `progress.json` -> `choice`; qualquer outro caso -> `question`.

- [ ] **Step 1: Escrever os testes** (pastas geradas em `<tmp>/docs/plans/`, cada `plan.md` com um bloco `json data` mínimo `{ "schema": "plan/1", "id": "<ID>" }`):
  - `AC4: one strong match is chosen`: pastas `roadmap-x-E7/plan.md` (id `E7`) e `outra-E8/plan.md` (id `E8`); `select --query e7` -> `{ choice: 'docs/plans/roadmap-x-E7/plan.md' }`, exit 0.
  - `AC4: two tied candidates return a question`: `a-E7/plan.md` e `b-E7/plan.md`; `select --query E7` -> `question` e `candidates` com os dois, exit 0, sem `choice`.
  - `select without query resumes the only run in progress`; `select without query and two runs in progress asks`; `select without query and a single plan without state chooses it`; `select with no candidates offers to write the plan`; `weak matches are offered, never chosen`.

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> FAIL.
- [ ] **Step 3: Implementar** `selectPlan` e o comando.
- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS.
- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2, G3 exit 0.

```bash
git add plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T5: seleção de plano por padrão com pergunta no empate" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: tracker `close-from-state` e teste de contrato (critério 5)

**Files:**
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs`
- Test: `plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs`

**Interfaces:**
- Consumes: no teste, `initState`, `applyEvent`, `STATE_SCHEMA`, `STEP_STATUSES` de `../../../lib/progress-state.mjs` e `emitPlan` de `../../../scripts/plan-tool.mjs`; no script, só o que `roadmap.mjs` já usa (`setSegment`, `set-status`, `log`, `commitWrites`).
- Produces:
  - `export const PROGRESS_CONTRACT = { schema: 'progress/1', fields: ['schema', 'plan.id', 'plan.roadmap', 'piece', 'run.status', 'finalGate.status', 'steps[].n', 'steps[].status', 'steps[].replacedBy', 'steps[].sha'], statuses: ['pending', 'launched', 'review-owed', 'pass', 'skip', 'skip-manual', 'waiting-manual', 'stopped'] }`.
  - Comando `close-from-state <pasta> --state <progress.json> [--dry-run] [--json]` em `COMMAND_NAMES` (19), no `HELP` e em `COMMANDS`; `state` e `dry-run` em `VALUE_OPTIONS`/`FLAGS`.
  - `result: { decision: 'closed' | 'not-closed', deliverable, piece, word, reasons: [<texto>] }`.

Regra: lê o JSON (BOM e CRLF aceitos). `schema !== PROGRESS_CONTRACT.schema` -> `Refusal('state-schema')`; `plan.roadmap` resolvido contra a raiz git da pasta (`git rev-parse --show-toplevel`) diferente do caminho real da pasta -> `roadmap-mismatch`; `plan.id` sem linha no painel -> `deliverable-unknown`. Fecha quando `run.status === 'completed'`, `finalGate.status === 'pass'` e todo passo efetivo (seguindo `replacedBy` até o último) está `pass` ou `skip`; senão `reasons` diz o primeiro motivo. Fechado -> mesma escrita de `set-status <id> <posição 5> [--piece <piece>] --evidence <caminho do progress.json> --evidence <sha>...` (shas conferidos como commits) e uma linha de `log`. Não fechado -> sobe para a posição 3 só se o status atual for anterior; nunca rebaixa nem grava a posição 6. `--dry-run` decide e não grava.

- [ ] **Step 1: Escrever os testes** em `roadmap.test.mjs`. Ajuda: `completedState(sha)` monta o estado do plano de exemplo (`plugins/productivity-tools/scripts/fixtures/plan-tool/plan.md`, `plan.id 'E1'`, `plan.roadmap 'docs/plans/roadmap-exemplo/'`) com `initState` e o leva a `completed` só com `applyEvent` (approve-map; onda a onda: `launch`, `report pass`, `review-result pass` em T5, `prelaunch-review pass` e `authorize` antes de T5, `commit` com `sha`, `wave-gate pass`, `advance`; `final-gate pass`), conferindo `ok` a cada passo. O repositório temporário tem a fixture `valid/` em `<tmp>/docs/plans/roadmap-exemplo/`, git `main` com um commit cujo SHA é o `sha`.
  - `AC5: close-from-state closes a completed plan from the JSON`: `decision 'closed'`, `word 'on-branch'`, a linha `E1` do `state.md` fica `on-branch` com o caminho do `progress.json` e o SHA na evidência, `log.md` ganha uma linha.
  - `AC5: contract -- STATE_SCHEMA and statuses match PROGRESS_CONTRACT`: `STATE_SCHEMA === PROGRESS_CONTRACT.schema`; `assert.deepEqual(STEP_STATUSES, PROGRESS_CONTRACT.statuses)`; cada caminho de `PROGRESS_CONTRACT.fields` existe (chave presente) no estado de `completedState` (`steps[].x` em todo passo).
  - `close-from-state not closed moves only to plan`: um passo `skip-manual` -> `not-closed`, E1 vai de `spec` a `plan`; com E1 já `executing` não muda.
  - `--dry-run decides and writes nothing` (snapshot igual); recusas `state-schema` (`progress/2`), `roadmap-mismatch` (`plan.roadmap 'docs/plans/outro/'`), `deliverable-unknown` (`plan.id 'E9'`), todas exit 1 e pasta intacta.
  - Atualizar `processo: --help lista os 18 comandos` para 19 (título e asserção).

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs` -> FAIL (comando desconhecido, contagem 18).
- [ ] **Step 3: Implementar** o comando e `PROGRESS_CONTRACT` em `roadmap.mjs`.
- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS; `node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.test.mjs` -> PASS (sem mudança).
- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2, G3, G4 (`node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`), G5 exit 0.

```bash
git add plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs
git commit -m "E7 T6: close-from-state no tracker com teste de contrato do estado" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: prosa do coordinator sobre a CLI e proibição de perguntar (critério 6)

**Files:**
- Modify: `plugins/productivity-tools/skills/plan-coordinator/SKILL.md`
- Modify: `plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md`
- Create: `plugins/productivity-tools/skills/plan-coordinator/references/state.md` (substitui `references/progress-template.md`, removido com `git rm`)
- Test: `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`

**Interfaces:**
- Consumes: os comandos e códigos de `progress.mjs` (Tasks 4 e 5) e os eventos de `applyEvent` (Tasks 2 e 3).
- Produces: `references/state.md` (esquema `progress/1`: campos, status, eventos com o efeito em uma linha cada, códigos de recusa); SKILL.md e `delegation-protocol.md` reescritos.

Conteúdo:
- SKILL.md (inglês, frontmatter só com chaves da política do repositório): descrição sem superpowers e sem `docs/superpowers/plans/`, apontando `docs/plans/<topic>/plan.md`. Fases: Step 0 = `progress.mjs select` (pergunta só quando ela devolve `question`) e `next` na retomada; Step 1 = `init` (plano sem bloco: repassar a recusa `plan-no-data-block`, sem interpretar); mapa = saída do `init`, auto-aprovado com `apply approve-map`; Phase 2 = laço "`next` -> agir -> `apply <evento>`". Padrões registrados: base, reexecução (`completed` não roda; `--restart` só a pedido da pessoa). Paradas que ficam: autorização de efeito externo, ações manuais, árvore com mudanças alheias, empate e ausência de plano. Nenhuma linha recomenda `bypassPermissions` como padrão.
- `delegation-protocol.md`: § Step lifecycle (tabela de 31 linhas) sai; ficam laço de ondas, camadas de contexto (Shared Brief = `briefs/` + restrições), fork/fresh, prompt template (com a linha literal das Global Constraints na seção Rules), verificação, escrita de volta, recuperação e conclusão, todos em termos de eventos da CLI. O texto total de SKILL.md + `delegation-protocol.md` + `state.md` não passa do total atual de SKILL.md + `delegation-protocol.md` + `progress-template.md` (contar com `wc -l` antes de editar; a prosa não cresce).
- Links internos: nenhum arquivo da skill aponta mais para `progress-template.md` nem `§ Step lifecycle`.

- [ ] **Step 1: Escrever os testes**:
  - `AC6: no published file of the coordinator skill mentions the word`: percorre recursivamente `plugins/productivity-tools/skills/plan-coordinator/` e, para cada arquivo, `assert.ok(!texto.toLowerCase().includes('super' + 'powers'), arquivo)`.
  - `AC6: executor prompt forbids asking the person`: lê `references/delegation-protocol.md`, isola o bloco do template (de `## Prompt template` até `## Verification`) e a seção `## Rules` dentro dele, e confere que contém a linha literal.
  - `skill files link only to existing references`: todo `references/<x>.md` citado em SKILL.md e nas referências existe; nenhum cita `progress-template.md`.
  - `no shipped coordinator file recommends bypassPermissions as default`: nenhum arquivo da skill casa `/bypassPermissions/i` numa linha que também contenha `default` ou `recommend`.

- [ ] **Step 2: Rodar e ver falhar** -- `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> FAIL (SKILL.md cita a palavra; linha do prompt ausente).
- [ ] **Step 3: Reescrever** os três arquivos e remover `progress-template.md` (`git rm`).
- [ ] **Step 4: Rodar e ver passar** -- mesmo comando -> PASS.
- [ ] **Step 5: Gates e commit** -- G1 exit 0 sem falhas; G2, G3, G5 exit 0 (G5 confere o frontmatter do SKILL.md reescrito).

```bash
git rm -q plugins/productivity-tools/skills/plan-coordinator/references/progress-template.md
git add plugins/productivity-tools/skills/plan-coordinator/SKILL.md plugins/productivity-tools/skills/plan-coordinator/references/delegation-protocol.md plugins/productivity-tools/skills/plan-coordinator/references/state.md plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs
git commit -m "E7 T7: prosa do coordinator sobre a CLI de estado e proibição de perguntar" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: `routing.md` remete a `lib/routing.mjs`; tracker lê `progress.json`

**Files:**
- Modify: `plugins/productivity-tools/skills/plan-coordinator/references/routing.md`
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/references/events/14-plan-coordinator.md`
- Modify: `plugins/productivity-tools/skills/roadmap-tracker/SKILL.md` (só a linha do passo 0 e a menção ao arquivo de progresso no item 8)

**Interfaces:**
- Consumes: `close-from-state` (Task 6); `progress.json` (Task 4).
- Produces: prosa; nenhum código.

Conteúdo:
- `routing.md`: §1 (tabela de dimensões) fica igual, palavra por palavra (o workflow do release a lê). §2 a §4 passam a dizer que a rota (nível, effort, revisor, portão) é a de `lib/routing.mjs` (`route`), devolvida por `plan-tool emit/map` e copiada no `progress.json`, sem repetir a tabela; §3.1 nos termos de DEC-206 (efeito externo conta como blast 2: sonnet no mínimo, portão e revisor opus, nunca inline, lançado no máximo uma vez, só com autorização registrada). "Inline" = modo de lançamento do evento `inline-start` (haiku, não externo, sem portão). §5 a §7 ficam, em termos de eventos (`launch --tier` para subir nível). Sem a palavra superpowers.
- `events/14-plan-coordinator.md`: localizar o `progress.json` (o que o coordinator nomeia, ou o da pasta do plano), rodar `node <skill>/scripts/roadmap.mjs close-from-state <pasta> --state <progress.json> --json` e seguir com o resto do evento (`now`, `inflight-add`, § 9); um `progress-*.md` antigo cai na regra de artefatos (posição 3 a partir do plano). Não aumentar o número de linhas do arquivo.
- Tracker `SKILL.md`: o passo 0 lê `plan.roadmap` do `progress.json` do coordinator em vez do campo `**Roadmap**:` do arquivo de progresso em Markdown; o item 8 diz "the coordinator's progress.json". Não aumentar linhas.

- [ ] **Step 1: Medir antes** -- `wc -l` dos três arquivos (anotar).
- [ ] **Step 2: Editar** os três arquivos.
- [ ] **Step 3: Verificar** -- `node --test plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/skills/roadmap-planner/scripts/prose-budget.test.mjs` -> PASS; `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` -> PASS (varredura e links continuam); `wc -l` de `events/14-plan-coordinator.md` e do `SKILL.md` do tracker <= antes; `grep -n "^## 1" -A 12 plugins/productivity-tools/skills/plan-coordinator/references/routing.md` mostra a tabela §1 inalterada (`git diff` sem linhas de §1).
- [ ] **Step 4: Gates e commit** -- G1 exit 0 sem falhas; G2, G3, G5 exit 0.

```bash
git add plugins/productivity-tools/skills/plan-coordinator/references/routing.md plugins/productivity-tools/skills/roadmap-tracker/references/events/14-plan-coordinator.md plugins/productivity-tools/skills/roadmap-tracker/SKILL.md
git commit -m "E7 T8: routing.md remete a lib/routing.mjs e o tracker fecha pelo progress.json" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: documentação do caminho do estado e gates finais

**Files:**
- Modify: `plugins/productivity-tools/README.md` (linha da tabela de skills do `plan-coordinator` e linha do caminho do estado)
- Modify: `CLAUDE.md` (linhas de Layout `lib/` e `scripts/` dentro de `plugins/<name>/`)

**Interfaces:**
- Consumes: caminhos das Tasks 1, 4 e 6.
- Produces: texto.

- [ ] **Step 1: Editar** -- README do plugin: a linha da skill descreve "executing a multi-step plan from `docs/plans/<topic>/plan.md`", sem `docs/superpowers/plans/`; a linha do estado passa a `docs/plans/<topic>/progress.json` (e `briefs/`). `CLAUDE.md`: a linha `lib/` acrescenta `progress-state.mjs` (estado `progress/1` e transições, importado por `skills/plan-coordinator/scripts/progress.mjs`); nenhuma versão muda e a tabela de versões do `README.md` da raiz não é tocada.
- [ ] **Step 2: Verificar** -- `grep -n "superpowers" plugins/productivity-tools/README.md` -> nenhuma linha; G1 `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` -> exit 0, 0 falhas, total maior que 1421; G2 `claude plugin validate .` -> exit 0; G3 `claude plugin validate plugins/productivity-tools` -> exit 0; G4 `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` -> exit 0; G5 `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` -> exit 0. `git status --porcelain` vazio depois do commit.
- [ ] **Step 3: Commit**

```bash
git add plugins/productivity-tools/README.md CLAUDE.md
git commit -m "E7 T9: README e CLAUDE.md com o caminho do estado progress.json" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Roteamento por tarefa

| Tarefa | tier | reviewTier | external | externalDedupe | needsLock | Navegador | Depende de |
|---|---|---|---|---|---|---|---|
| T1 | sonnet | sonnet | false | - | (nenhum) | não | - |
| T2 | sonnet | sonnet | false | - | (nenhum) | não | T1 |
| T3 | sonnet | sonnet | false | - | (nenhum) | não | T2 |
| T4 | sonnet | sonnet | false | - | (nenhum) | não | T3 |
| T5 | sonnet | sonnet | false | - | (nenhum) | não | T4 |
| T6 | sonnet | sonnet | false | - | (nenhum) | não | T3 |
| T7 | sonnet | sonnet | false | - | (nenhum) | não | T5 |
| T8 | sonnet | sonnet | false | - | (nenhum) | não | T6, T7 |
| T9 | haiku | sonnet | false | - | (nenhum) | não | T8 |

Pontuação (`plan-coordinator/references/routing.md` §1 e `lib/routing.mjs`): T1 escopo 1, ambiguidade 1, raciocínio 1, raio 1 (código interno compartilhado que o tracker e E12 leem), verificabilidade 0 -> 4, sonnet. T2 e T3 1+1+2+1+0 = 5 (máquina de estados), sonnet. T4 e T5 1+1+1+1+0 = 4, sonnet. T6 1+1+1+1+0 = 4, sonnet. T7 1+2+1+1+1 = 6, sonnet com `effort: high` (reescrita de prosa; portão só a partir de 7). T8 1+1+0+1+1 = 4, sonnet. T9 1+0+0+1+0 = 2, haiku; revisor sonnet (nunca abaixo do executor). Nenhuma tarefa tem raio 2 (nenhuma autenticação, segredo, escrita em produção, migração de dados nem push), então nenhum revisor opus. T1 a T5 e T7 tocam `progress.test.mjs` e rodam em sequência; T6 pode rodar em paralelo a T4/T5 (arquivos disjuntos), mas depende de T3 (o teste leva o estado a `completed` com `applyEvent`).

Nenhuma tarefa tem efeito externo (nenhum push, publicação, mensagem, escrita em dado compartilhado nem leitura de produção), então nenhuma declara `externalDedupe`; o spec diz "o card não pede efeito externo". A tarefa externa T5 do plano de exemplo é dado de fixture: nunca roda. Nenhum passo depende de navegador nem de algo fora deste ambiente; todo passo é exercitado aqui pelos testes e comandos listados, e a evidência aceitável é a saída desses comandos (git roda só em repositórios temporários dos testes).

## Acceptance criteria evidence

| ac | kind | command | testRef | blq | external |
|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC1: launch with a dependency not passed is refused and the state does not change" (Task 2) e "AC1: apply refused leaves the file byte-identical" (Task 4) | | false |
| AC2 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC2: next in a fresh process returns the next action from the file alone" (Task 4) e "nextAction order" (Task 1) | | false |
| AC3 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC3: initState copies waves, tiers and gates from plan-tool (default width)", "AC3: same with maxWidth 2" (Task 1) e "AC3: init through the CLI matches plan-tool map" (Task 4) | | false |
| AC4 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC4: one strong match is chosen", "AC4: two tied candidates return a question" (Task 5) | | false |
| AC5 | test | node --test plugins/productivity-tools/skills/roadmap-tracker/scripts/roadmap.test.mjs | roadmap.test.mjs: "AC5: close-from-state closes a completed plan from the JSON", "AC5: contract -- STATE_SCHEMA and statuses match PROGRESS_CONTRACT" (Task 6) | | false |
| AC6 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC6: no published file of the coordinator skill mentions the word", "AC6: executor prompt forbids asking the person" (Task 7) | | false |
| AC7 | test | node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs | progress.test.mjs: "AC7: plan without data block is refused pointing to adoption" (Task 4) | | false |

Todos os comandos são os das marcas `{verify: test; ...}` do card, mantidos; `progress.test.mjs` é criado na Task 1 e estendido nas Tasks 2 a 5 e 7; `roadmap.test.mjs` já existe e é estendido na Task 6. Cada comando sai 0 só se todos os testes do arquivo passam, incluindo os de testRef. Nenhum é externo: só lê arquivos da branch e escreve em pastas temporárias do sistema.

## Decisões autônomas deste plano (Origem executor, status pendente)

1. Campos acrescentados à forma do spec dentro de `progress/1`: `plan.spec`, `run.wave`, `steps[].brief`, `steps[].rounds`, `steps[].outputs`; a referência do esquema chama-se `references/state.md` e substitui `progress-template.md`. Alcance: contrato.
2. Eventos `skip` (linha 26, com `outputs`/`no-outputs`) e opções `--text` (pergunta, motivo, valor de resposta) e `--tier` (subida de nível na repetição, recusa `tier-down`) além dos listados no spec; recusas extras `inline-not-allowed`, `tier-down`, `dependency-held`, `gate-owed`, `steps-open`. Alcance: contrato.
3. Repetição de passo não externo: `report fail|blocked` volta a `pending` até 3 tentativas (mesmo nível, um acima, nova em opus, conforme routing.md §5) e depois retém com pergunta; o diagnóstico de qual nível usar fica com o orquestrador, pelo `--tier` do `launch`. Alcance: local.
4. `nextAction` ganha as ações `approve-map`, `hold` e `advance` além das do spec, para que a retomada nunca dependa da conversa. Alcance: contrato.
5. `lib/progress-state.mjs` exporta também `STEP_STATUSES`, `RUN_STATUSES` e `EVENT_TYPES`; o teste de contrato exige `STEP_STATUSES` igual a `PROGRESS_CONTRACT.statuses`, de modo que um status novo na lib falha até o tracker decidir sobre ele. Alcance: contrato.
6. O tracker resolve `plan.roadmap` contra a raiz git da pasta; o teste de contrato monta a fixture `valid/` em `docs/plans/roadmap-exemplo/` de um repositório temporário para casar com o plano de exemplo de E6. Alcance: local.
