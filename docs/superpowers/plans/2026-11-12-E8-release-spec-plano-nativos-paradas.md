# E8 -- Release com spec e plano nativos e paradas em código: plano de implementação

> **Para agentes executores:** execute tarefa por tarefa, na ordem; os passos usam caixas (`- [ ]`). Cada tarefa roda na worktree do entregável `D:/projects/claude-play-wt/E8`, branch `feat/E8`, antes do merge.

**Roadmap:** docs/plans/roadmap-evolucao-skills/

**Objetivo:** ligar os agentes nativos `productivity-tools:spec-author` e `productivity-tools:plan-author`, a carga com resumo de integridade e a definição única de roteamento ao workflow do release, com as regras de parada e a retenção por decisão de contrato em código.

**Arquitetura:** toda lógica nova que decide (caminhos, paradas, adaptador de `plan/1`, conferência de carga, retenção) é função pura no bloco `// <pure>` de `roadmap-release.js`, testada por `loadPure`; os estágios só chamam agentes para escrever arquivos e para devolver a saída bruta das ferramentas (`spec-tool`, `plan-tool`, `git`), e o JavaScript faz o parse. As cópias de `lib/routing.mjs` e `lib/plan-digest.mjs` entram por `scripts/embed.mjs`.

**Tecnologia:** Node 22 (ESM, `node:test`), workflow JavaScript sem imports, CLI do tracker.

**Spec:** docs/superpowers/specs/2026-11-12-E8-release-spec-plano-nativos-paradas-design.md

## Restrições globais

- Nenhuma versão sobe (nem `plugin.json` nem `README.md`).
- Não editar `skills/plan-writer/SKILL.md`, `agents/plan-author.md` (DEC-458), `tools/measure/arms/*.md` (DEC-310) nem a pasta `docs/plans/roadmap-evolucao-skills/`.
- Linhas "Review (read-only) the spec ...", "Review (read-only) the plan ...", "Blocks: ..." e "Blocks (defeito): ..." e o texto atual dos corretores de spec e de plano ("Fix the spec ..."/"Fix the plan ..." até o "Return ...") ficam byte a byte iguais; `tools/measure/run-batch.test.mjs` e `tools/measure/checkpoint.test.mjs` continuam verdes.
- Semântica de autorização de efeito externo intocada: `planFingerprint`, `bindAuthorizations`, `externalHold`, `evidenceHolds` não mudam; a impressão digital vem de `planBlob` medido e das tarefas.
- Nenhum arquivo embarcado indica `bypassPermissions` como padrão (DEC-312).
- Prompts escritos por E8 (autores, carga, commit): um comando simples por chamada, sem heredoc, sem laço, sem `&&`/`;`; arquivos gravados com Write; commit com `git commit -F <arquivo>`.
- Ambiente medido: Windows 11, Git Bash e PowerShell 7, node v22.17.1, `core.autocrlf=true` (testes normalizam `\r\n`). Nenhum servidor, nenhuma porta (faixa 5200-5209 não usada), nenhum navegador.
- Travas: nenhuma configurada; nenhuma tarefa usa trava (`needsLock` vazio).
- Commits: assunto começa com `E8 T<n>:`; adicione só os arquivos da tarefa (nunca `git add -A`); a mensagem termina com `Co-Authored-By: Claude <noreply@anthropic.com>`.
- Gates canônicos (linha de base da release: G1 exit 0, 1568 testes, 0 falhas, 0 pulados; G2 a G5 exit 0; nenhuma falha esperada):
  - G1: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`
  - G2: `claude plugin validate .`
  - G3: `claude plugin validate plugins/productivity-tools`
  - G4: `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid`
  - G5: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`

Abreviações: `WF` = `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; `FT` = `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`; `PT` = `node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

## Foco de revisão

1. Plano reutilizado na retomada com tarefas já commitadas: nenhuma tarefa commitada muda de número, texto ou campos, e nenhuma é reimplementada (T6, teste `frozen tasks`).
2. `emit` com `digest` certo e `route` de uma tarefa diferente do recalculado: carga falha, nunca despacho com o `route` errado (T3, teste `loadPlanEmit rejects a route`).
3. Ruling caro e irreversível aprovado com o hash de outro texto: para de novo (T2 e T5).
4. Dependente transitivo de uma decisão de contrato: pulado citando a decisão de origem; o dono da decisão nunca é retido (T2 e T8).
5. `trackerCli` fora do layout do plugin: falha de infraestrutura antes de qualquer autor (T1 e T5).

## Fora do plano (orquestrador da sessão principal, DEC-204)

Não são tarefas deste plano, porque precisam da ferramenta Workflow ou de subagent: a sonda `acceptEdits` (`tools/measure/run-batch.mjs --permission-mode acceptEdits --stop-on-denial --max-budget-usd 10`), o teste comportamental `plan-only` da skill e a medição de `MAX_WORKFLOW_CHARS` pelo nome. Os relatórios vão para `docs/reports/` pelo orquestrador. A tarefa 13 grava o teto provisório previsto no spec para o caso "a medição não rodar"; o orquestrador troca o número pelo medido, se medir.

---

### Tarefa 1: cópias embutidas, `artifactPaths` e `pluginRootOf`

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Produz (no bloco `// <pure>` de WF): `route(task, ctx)`, `planDigest({ plan, source })`, `canon(value)`, `fnv1a(str)` (cópias geradas); `artifactPaths(roadmapSlug: string, E: string) -> { dir, spec, plan, reviews }` com `dir = docs/plans/<roadmapSlug>-<E>/` e os três arquivos `spec.md`, `plan.md`, `reviews.md` dentro dele; `reportPathFor(today: string, ids: string) -> 'docs/reports/<today>-<ids>-run.md'`; `pluginRootOf(trackerCli: string) -> string | null` (tira o sufixo `skills/roadmap-tracker/scripts/roadmap.mjs`, aceitando `\` e `/`; `null` sem o sufixo).

- [ ] **Passo 1: testes que falham.** Em FT, testes:
  - `embedded copies of routing and plan-digest are not stale`: `embedFile(WF, { check: true }).stale === false` (import de `plugins/productivity-tools/scripts/embed.mjs`).
  - `embedded route and planDigest equal the lib ones`: para as tarefas de `scripts/fixtures/plan-tool/routing-table.json` e o `emit` de `scripts/fixtures/plan-tool/plan.md`, `loadPure().route` e `loadPure().planDigest` dão `deepEqual` aos de `lib/routing.mjs` e `lib/plan-digest.mjs`.
  - `artifactPaths follows DEC-026`: `artifactPaths('evolucao-skills', 'E8')` → `{ dir: 'docs/plans/evolucao-skills-E8/', spec: 'docs/plans/evolucao-skills-E8/spec.md', plan: 'docs/plans/evolucao-skills-E8/plan.md', reviews: 'docs/plans/evolucao-skills-E8/reviews.md' }`; `reportPathFor('2026-11-12', 'E8')` → `'docs/reports/2026-11-12-E8-run.md'`.
  - `pluginRootOf strips the tracker suffix or returns null`: `'/p/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs'` → `'/p/productivity-tools'`; `'C:\\p\\pt\\skills\\roadmap-tracker\\scripts\\roadmap.mjs'` → `'C:/p/pt'`; `'/t/roadmap.mjs'` → `null`.
- [ ] **Passo 2:** `PT --test-name-pattern "embedded|artifactPaths|pluginRootOf"` → FALHA (marcadores ausentes, funções indefinidas).
- [ ] **Passo 3: implementar.** Dentro de `// <pure>`, os marcadores `// <embed src="../../../lib/routing.mjs" exports="strip">` / `// </embed>` e o mesmo para `../../../lib/plan-digest.mjs`, no formato de `scripts/fixtures/plan-tool/workflow-copy.js`; gere com `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`. Nomes da cópia que colidirem com nomes de WF: renomeie do lado de WF, nunca na cópia. Escreva as três funções novas.
- [ ] **Passo 4:** `PT --test-name-pattern "embedded|artifactPaths|pluginRootOf"` → PASSA; `node --test plugins/productivity-tools/skills/roadmap-release/workflow/load-pure.test.mjs` → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T1: cópias embutidas de routing e plan-digest, artifactPaths e pluginRootOf` com WF e FT.

### Tarefa 2: funções puras de parada, decisões e retenção

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: `fnv1a` (T1).
- Produz:
  - `approveKey(ruling) -> 'R<n>:<fnv1a(collapseWs(ruling.decision))>'`.
  - `stopOrCarry({ rulings, needsPerson, approved }) -> { stops: [{ id, kind: 'humano'|'decisao'|'approve-ruling', action: 'human-input'|'decision'|'approve-ruling', key? }], carry: [ruling] }`. Ordem das regras do spec: `needsPerson` com `blocking: true` → `humano`/`human-input`; ruling com `contradicts` preenchido → `decisao`/`decision`; ruling `costIfWrong === 'high' && reversible === false` cujo `approveKey` não está em `approved` (array de strings) → `approve-ruling` com `key`; o resto vai para `carry`.
  - `rulingDecisions(rulings) -> [{ text, scope: 'local'|'contrato', discarded }]` (`text` = `decision`, `scope` de `scope` (`contract` → `contrato`), `discarded` = `alternative`), na forma que `recordCommands` já recebe de `parseDecision`.
  - `specCardMismatch(data, E, card) -> string[]` (vazio = confere): `data.id === E` e a lista de critérios igual à do card (mesmos ids, `textWithoutTag` com espaços colapsados, `verify` normalizado).
  - `heldBy({ cards, selected, contractDecisions: [{ id, deliverable }], started }) -> Map<E, { decision, owner }>`: dependentes diretos e transitivos (pelos `deps` dos cards) de cada dono, só os selecionados e não iniciados; o dono nunca entra.
  - `holdReason({ decision, owner }) -> 'held by <DEC-id> (<owner>, contract, pending ratification)'`.

- [ ] **Passo 1: testes que falham** em FT:
  - `stopOrCarry stops equal spec-tool stopsOf`: tabela de pelo menos 6 casos (comum; `contradicts: 'DEC-12'`; `contradicts: 'G1'`; alto e irreversível; alto e reversível; bloqueante humano; não bloqueante) e, para cada um, os ids de `stops` sem aprovação são iguais a `stopsOf(rulings, needsPerson)` de `plugins/productivity-tools/scripts/spec-tool.mjs`.
  - `stopOrCarry releases an approved costly ruling only for the same text`: com `approved: [approveKey(r)]` o ruling vai para `carry`; com a chave de outro texto, para de novo.
  - `rulingDecisions maps scope and alternative`: `scope: 'contract'` → `'contrato'`, `'local'` → `'local'`, `discarded` = `alternative`.
  - `specCardMismatch compares ids, text and verify`: igual → `[]`; id do entregável diferente, critério a mais, texto diferente ou `verify` diferente → lista não vazia.
  - `heldBy holds transitive dependents and never the owner`: cards E1←E2←E3 e E4 independente, decisão de E1; selecionados E1..E4 → E2 e E3 retidos com a decisão de E1, E1 e E4 não; `started: ['E2']` → E2 fora do mapa.
- [ ] **Passo 2:** `PT --test-name-pattern "stopOrCarry|rulingDecisions|specCardMismatch|heldBy"` → FALHA.
- [ ] **Passo 3: implementar** as funções em `// <pure>` de WF.
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T2: regras de parada, decisões e retenção como funções puras` com WF e FT.

### Tarefa 3: adaptador de `plan/1`, carga do plano e roteamento

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`

**Interfaces:**
- Consome: `route`, `planDigest`, `canon` (T1).
- Produz:
  - `loadPlanEmit(stdout: string, { E, RM }) -> { ok: true, plan, digest } | { ok: false, why }`: parse; `tool === 'plan-tool'`, `schema === 'plan/1'`, `plan.id === E`, `plan.roadmap === RM`, `planDigest({ plan, source }) === digest`, e para cada tarefa `route(task, { hasDependents })` (`hasDependents` = alguma tarefa tem `n` em `deps`) igual ao `route` emitido.
  - `tasksFromPlan(plan) -> [{ n, title, files, needsLock, external, externalDedupe, noCommit, route, deps }]` (`files` = união sem repetição de `files.create`, `files.modify`, `files.test`; `needsLock` = `locks`).
  - `evidenceFromPlan(plan) -> [{ ac, kind, command, testRef, blq, external, externalDedupe }]` na forma das linhas `ac` que `evidenceGaps`, `criteriaOpen`, `evidenceHolds` e `evidenceExternalGaps` consomem.
  - `frozenTaskDiffs(prevPlan, nextPlan, committed: number[]) -> string[]` (JSON canônico por `canon`, `route` incluído; tarefa commitada ausente é diferença).
  - `implModel(task)` → `task.route.tier`; `implEffort(task)` → `task.route.effort`; `reviewModelFor(task)` → `task.route.reviewTier`, e `'opus'` quando `task.external === true` ou `task.route.tier === 'opus'`; sem `route`: `'sonnet'`/`'medium'` como hoje.

- [ ] **Passo 1: testes que falham.**
  - Em FT, helper de teste `planEmitOf({ id, roadmap, tasks, evidence })` que monta o JSON de `plan-tool emit` com `route` e `digest` calculados por `lib/routing.mjs` e `lib/plan-digest.mjs` (fica para T6).
  - `loadPlanEmit accepts a faithful emit`; `loadPlanEmit rejects a wrong digest, id, roadmap, tool or schema`; `loadPlanEmit rejects a route that differs from the recalculated one` (digest recalculado sobre o `route` adulterado, de modo que só a conferência de `route` reprova).
  - `tasksFromPlan merges files and copies locks and external`; `evidenceFromPlan keeps the row fields`, sobre o `emit` de `scripts/fixtures/plan-tool/plan.md`.
  - `frozenTaskDiffs flags a changed or missing committed task and ignores the others`.
  - Em `prompts.test.mjs`, as asserções de `implModel` (linhas 51-54) passam a usar `{ route: { tier: 'haiku', effort: 'low', reviewTier: 'sonnet' } }` etc., mais `implEffort` e `reviewModelFor` com `route`.
- [ ] **Passo 2:** `PT --test-name-pattern "loadPlanEmit|tasksFromPlan|evidenceFromPlan|frozenTaskDiffs"` e `node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs` → FALHAM.
- [ ] **Passo 3: implementar** em `// <pure>`. Os chamadores de `implModel`/`reviewModelFor` em WF ainda recebem tarefas transcritas até T6: mantenha o comportamento antigo quando `route` falta (lê `tier`/`reviewTier`), e T6 remove esse ramo.
- [ ] **Passo 4:** os dois comandos → PASSAM; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T3: adaptador de plan/1, carga com resumo e modelo pelo route` com WF, FT e prompts.test.mjs.

### Tarefa 4: guarda da versão anterior e medições do setup

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: `artifactPaths` (T1).
- Produz: `S_SETUP` com os campos obrigatórios `taskCommits: INT`, `committedTasks: INT[]`, `nativeSpec: BOOL`, `nativePlan: BOOL`, medidos pelo agente de setup em `<TARGET>..HEAD` (assunto `^<E> T(\d+):`) e pela existência de `artifactPaths(roadmapSlug, E).spec|plan` na branch; ação de operador `previous-version`.

- [ ] **Passo 1: testes que falham** em FT:
  - Mock padrão de `:setup` em `exec()` ganha `taskCommits: 0, committedTasks: [], nativeSpec: false, nativePlan: false`.
  - `AC2: a branch with task commits and no native spec stops with previous-version and writes no spec`: setup com `taskCommits: 2, committedTasks: [1, 2], nativeSpec: false` → resultado do entregável `failKind === 'conteudo'`, uma `operatorActions` com `kind: 'previous-version'` e `deliverable: 'E1'` cujo `doNow` cita terminar na versão anterior ou descartar a branch e a worktree; nenhuma chamada com rótulo `E1:spec`, `E1:spec-load1` ou `E1:plan`.
  - `a branch with an old superpowers spec and no task commit is not stopped`: `taskCommits: 0` → a chamada `E1:spec` acontece.
  - `the setup schema requires the new measurements`: `required` de `S_SETUP` contém os quatro campos, e o prompt do setup cita `${TARGET}..HEAD` e o caminho `docs/plans/x-E1/spec.md`.
- [ ] **Passo 2:** `PT --test-name-pattern "AC2|old superpowers spec|setup schema requires"` → FALHA.
- [ ] **Passo 3: implementar** a medição no prompt do setup, os campos no schema e a parada logo depois do setup, antes do estágio de spec (`op('previous-version', E, ...)` e `fail('conteudo', ...)`), com o texto do spec (planos já escritos entram pela adoção do `plan-writer`, DEC-018). Registre o tipo de ação em `references/operator.md` só na T11.
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T4: guarda da versão anterior medida no setup` com WF e FT.

### Tarefa 5: estágio de spec nativo, paradas e registro das decisões

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: `artifactPaths`, `pluginRootOf` (T1); `stopOrCarry`, `approveKey`, `rulingDecisions`, `specCardMismatch` (T2); `nativeSpec` (T4).
- Produz: constante `NO_ASK` (começa com "Never ask the person anything"); `S_TOOLOUT = { checkExit: INT, checkStdout: STR, emitExit: INT, emitStdout: STR, blob: STR, head: STR, clean: BOOL }`; `S_COMMITTED = { ok: BOOL, head: STR, commit: STR, error: STR }`; rótulos `E<n>:spec` (autor, `agentType: 'productivity-tools:spec-author'`, sem `model`), `E<n>:spec-load<k>` (k = 1..3; 1 e 2 em haiku/low, 3 em sonnet/medium), `E<n>:spec-commit` (haiku/low); arg `approveRulings: { "E<n>": ["R<k>:<hash>"] }`, nunca copiado para `resumeWith`; ação `approve-ruling`; `recordVerdict` recebe `rulings` e usa `rulingDecisions` no lugar de `parseDecision` para as decisões do spec.

- [ ] **Passo 1: testes que falham** em FT. Helper `specEmitOf(E, { acceptance, rulings = [], needsPerson = [] })` monta o JSON de `spec-tool emit`; o mock padrão de `exec()` responde `:spec-load\d` com `{ checkExit: 0, checkStdout: '{}', emitExit: 0, emitStdout: specEmitOf(E, { acceptance: <critérios do card> }), clean: true, head: 'h1' }` e `:spec-commit` com `{ ok: true, head: 'h1', commit: 'c1' }`; testes antigos que respondiam `:spec` com `decisions` passam a responder `:spec-load\d` com `rulings`.
  - `AC5: a ruling that contradicts a registered decision stops the deliverable`: ruling `contradicts: 'DEC-12'` → `failKind 'decisao'`, ação `decision`, nenhuma chamada `E1:plan`.
  - `AC6: a common ruling is recorded as pending ratification and the run goes on`: ruling comum de alcance `local` → o prompt de `E1:status-...` tem um `add-decision` com o texto da decisão e o alcance `local`, e o entregável chega a `E1:t1:impl`.
  - `AC7: a costly irreversible ruling stops after the spec commit without writing the plan`: `costIfWrong: 'high', reversible: false` → `E1:spec-commit` chamado, nenhuma chamada `E1:plan`, ação `approve-ruling` cujo `doNow` contém a chave exata `approveKey(r)` e cujo `resumeWith` não tem `approveRulings`; com `args.approveRulings: { E1: [key] }` o plano é escrito; com a chave de outro texto, para.
  - `the spec author gets the native contract`: `opts.agentType === 'productivity-tools:spec-author'`, `opts.model === undefined`; o prompt tem uma linha por campo, `mode: unattended`, `output: /wt/E1/docs/plans/x-E1/spec.md`, `specTool:` absoluto terminado em `scripts/spec-tool.mjs`, `card: E1` e `ownerNote:` como último campo.
  - `a trackerCli outside the plugin layout fails as infra before the author`: `args.trackerCli: '/t/roadmap.mjs'` → `failKind 'infra'`, nenhuma chamada `E1:spec`. Os testes que usam `/t/roadmap.mjs` passam a usar `'/p/productivity-tools/skills/roadmap-tracker/scripts/roadmap.mjs'` como padrão de `exec()`.
  - `a spec load that keeps diverging from the card fails as infra after three tries`: os três `:spec-load` com critério divergente → rótulos `E1:spec-load1..3`, modelos haiku, haiku, sonnet, `failKind 'infra'`.
  - `a reused native spec without owner note calls no author and records no duplicate`: `nativeSpec: true` → nenhuma chamada `E1:spec`; rodando duas vezes o registro do mesmo `emit` (journal), o segundo `add-decision` devolve `existing: true` no mock e nenhuma decisão nova entra em `decisionIds`.
  - `the spec fixer keeps its text and adds the block sentence`: o prompt de `E1:spec-fix1` contém o texto atual inteiro do corretor e depois a frase sobre o bloco `spec/1` e `spec-tool check --roadmap`.
- [ ] **Passo 2:** `PT --test-name-pattern "AC5|AC6|AC7|spec author|trackerCli outside|spec load|reused native spec|spec fixer"` → FALHA.
- [ ] **Passo 3: implementar** o estágio do spec conforme "Estágio de spec" do spec: autor (prompt `key: value` + `ownerNote` multilinha com nota do dono, regras fixas e `NO_ASK`), reutilização com `nativeSpec`, carga com `S_TOOLOUT` (os dois comandos `node "<specTool>" check|emit "<abs spec>" --roadmap "<abs roadmap>"`), commit mecânico (`Write` da mensagem em `<wtRoot>/_tmp/`, `git -C "<wt>" add <rel>`, `git -C "<wt>" commit -F <arquivo>`, apagar), laço de revisão mantido com a carga repetida depois de cada correção, e `stopOrCarry` aplicado depois da revisão e antes do plano. `check` com saída diferente de 0 vira problema crítico da revisão, não carga falha. O que o corretor devolve em `decisions`/`humanInputs` deixa de ser lido.
- [ ] **Passo 4:** mesmo comando → PASSA; `node --test tools/measure/run-batch.test.mjs tools/measure/checkpoint.test.mjs` → PASSA (texto do corretor e linhas Blocks intactos); G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T5: estágio de spec pelo spec-author, carga conferida e paradas em código` com WF e FT.

### Tarefa 6: estágio de plano nativo, carga com resumo e despacho pelo route

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`, `plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs`

**Interfaces:**
- Consome: `loadPlanEmit`, `tasksFromPlan`, `evidenceFromPlan`, `frozenTaskDiffs`, `implModel`, `implEffort`, `reviewModelFor` (T3); `nativePlan`, `committedTasks` (T4); `S_TOOLOUT`, `S_COMMITTED`, `NO_ASK`, `pluginRootOf` (T5).
- Produz: rótulos `E<n>:plan` (`agentType: 'productivity-tools:plan-author'`, sem `model`), `E<n>:plan-load<k>` (k = 1..3; haiku/low, haiku/low, sonnet/medium), `E<n>:plan-commit`; ação `plan-frozen-tasks`; `S_PLAN` e `S_PLANREVIEW.evidenceRows` removidos; `S_PLANREVIEW` mantém `measuredPlanBlob`.

- [ ] **Passo 1: testes que falham** em FT.
  - Adaptador de teste em `exec()`: uma resposta de `over` para `E<n>:plan` no formato antigo (`tasks`, `ac`, `planBlob`, `reused`) vira a resposta de `E<n>:plan-load<k>` = `{ emitExit: 0, emitStdout: planEmitOf(...), blob: planBlob, clean: true }`, com cada `tier` antigo traduzido por `scoreFor(tier)` (haiku: um arquivo e score zero; sonnet: `{ ambiguity: 1, reasoning: 1, blast: 1, verifiability: 0 }`; opus: `{ ambiguity: 2, reasoning: 2, blast: 2, verifiability: 1 }`, conferido com `lib/routing.mjs`), e `reused: true` vira `nativePlan: true` no setup. O mock padrão de `/:plan$/` passa a responder pelo mesmo caminho. O revisor do plano deixa de receber `evidenceRows`.
  - Testes removidos, com o motivo no corpo do commit: os que exigem `roadmapHeader === false` (`noHeader`) e os de `evidenceRows`/`evidenceRowGaps`, porque o spec tira essas checagens (decisões 3 e 10). Em `review.test.mjs`, a asserção sobre `const S_PLAN` (linha 151) passa a afirmar que `S_PLAN` não existe e que `evidenceFromPlan` devolve `ac` como o id do critério.
  - `AC3: a plan whose digest does not match after the retries fails as infra without running a task`: os três `E1:plan-load` com `digest` errado → modelos haiku, haiku, sonnet, `failKind 'infra'` com `plan load: integrity digest` no erro, nenhum rótulo `:t\d+:` e nenhum registro "executando".
  - `AC4: the implementer and the task reviewer get model and effort from route`: plano com uma tarefa cujo `route` é `{ tier: 'haiku', effort: 'low', reviewTier: 'sonnet' }` e outra `{ tier: 'sonnet', effort: 'high', reviewTier: 'opus' }` → `E1:t1:impl` com `model 'haiku'`/`effort 'low'`, `E1:t2:impl` com `'sonnet'`/`'high'`, revisor `E1:t2:spec1` com `'opus'`.
  - `the plan author gets the native contract and the plan rules`: `agentType 'productivity-tools:plan-author'`, `output: /wt/E1/docs/plans/x-E1/plan.md`, `planTool:` absoluto, `spec:` absoluto, `roadmap: docs/plans/roadmap-x/`, `ownerNote:` por último com a linha exata `**Roadmap:** docs/plans/roadmap-x/`, `externalDedupe`, prefixo `E1 T<n>:` e `NO_ASK`.
  - `frozen tasks: an owner note that rewrites a committed task restores the plan and stops`: `nativePlan: true`, `committedTasks: [1, 2]`, nota do dono, segunda carga com T2 diferente nas duas chamadas do autor → duas chamadas `E1:plan`, o prompt do commit pede `git -C "/wt/E1" checkout -- docs/plans/x-E1/plan.md`, ação `plan-frozen-tasks`, `failKind 'conteudo'`, nenhum `:t\d+:impl`.
  - `a native plan reused without owner note calls no author and makes no commit`: `nativePlan: true` sem nota → nenhum `E1:plan`, nenhum `E1:plan-commit`, a carga roda e T1 commitada não é reimplementada.
  - `the plan fixer keeps its text and adds the block sentence`.
- [ ] **Passo 2:** `PT --test-name-pattern "AC3|AC4|plan author|frozen tasks|native plan reused|plan fixer"` → FALHA.
- [ ] **Passo 3: implementar** conforme "Estágio de plano" do spec: autor, carga (`node "<planTool>" emit "<abs plan>" --spec "<abs spec>"` e `git -C "<wt>" rev-parse "HEAD:<rel plan>"`, um por chamada), `fail('infra', 'plan load: integrity digest ...')` antes do registro "executando", adaptador, despacho com `model: implModel(t)`/`effort: implEffort(t)` e revisor por `reviewModelFor(t)`, lista "THE TASKS THE CODE ACTS ON" vinda do `emit`, saída de `evidenceRows`/`evidenceRowGaps`/`roadmapHeader`, `planBlobGaps` mantido, congelamento das tarefas commitadas. Remova o ramo de compatibilidade de T3 (tarefa sem `route`). `planFingerprint(tasks, planBlob)` recebe as tarefas do adaptador e o `planBlob` medido; os testes de autorização existentes continuam passando sem mudar suas asserções.
- [ ] **Passo 4:** mesmo comando → PASSA; `node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs tools/measure/run-batch.test.mjs tools/measure/checkpoint.test.mjs` → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T6: estágio de plano pelo plan-author, carga por resumo e despacho pelo route` com WF, FT e review.test.mjs.

### Tarefa 7: caminhos de artefato, sem superpowers nos estágios e comandos simples

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: `artifactPaths`, `reportPathFor` (T1); `NO_ASK` (T5).
- Produz: todas as ocorrências de `docs/superpowers/specs|plans|reviews|reports` de WF (`logPath`, `logSource`, `readPersistedLog`, `specTxt`, `planTxt`, `reviewsTxt`, riscos e efeitos executados, `reportPath`) passam por `artifactPaths`/`reportPathFor`; o `slug` do autor não compõe caminho; regras fixas de `C()` com comandos simples.

- [ ] **Passo 1: testes que falham** em FT:
  - `AC1: spec and plan stage prompts and artifact paths never cite superpowers and all forbid asking the person`: num run feliz, para cada chamada com `opts.phase` em `['Spec', 'Plan']` cujo rótulo é de autor, carga, commit, revisor ou corretor de spec ou de plano (`/:(spec|plan)(-load\d|-commit|-review\d|-fix\d)?$/`), o prompt contém `NO_ASK` e não contém `superpowers`; `r.reportPath` e os caminhos citados por `E1:review-log` e `E1:resume-review-log` não contêm `superpowers`; e o texto de WF não tem `docs/superpowers`.
  - `a finish-merge resume of a previous-version deliverable reports review log not read`: `readPersistedLog` procura só `docs/plans/x-E1/`; com `found: false` vira a preocupação existente.
  - `the fixed rules ask for simple commands`: o texto de `C()` (prompt de `E1:t1:impl`) cita um comando por chamada, sem heredoc, laço, `&&` ou `;`, Write para arquivos e `git commit -F`.
  - Atualize as asserções existentes que citam `docs/superpowers/...` (há duas em FT) para os caminhos novos.
- [ ] **Passo 2:** `PT --test-name-pattern "AC1|previous-version deliverable reports|simple commands"` → FALHA.
- [ ] **Passo 3: implementar.** As menções a `superpowers:test-driven-development` (implementador) e `superpowers:systematic-debugging` (corretores de merge e de gates) ficam (E9); o teste do AC1 só olha os estágios de spec e plano e os caminhos.
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T7: artefatos em docs/plans/<slug>-<E>/, estágios sem superpowers e comandos simples` com WF e FT.

### Tarefa 8: retenção dos dependentes por decisão de contrato

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Consome: `heldBy`, `holdReason` (T2); `recordVerdict(...).decisionIds`.
- Produz: `S_DISC` com o campo obrigatório `pendingDecisionsStdout: STR` (stdout bruto de `node "<trackerCli>" pending-decisions "<abs roadmap na worktree de integração>" --json`); entregável retido com resultado `skipped` e motivo `holdReason(...)`; em `dry-run`, só relatado em `selection`.

- [ ] **Passo 1: testes que falham** em FT (mock padrão de discovery com `pendingDecisionsStdout: cliJson({ result: { decisions: [] } })`):
  - `AC8: a contract ruling holds a selected dependent citing the decision and an independent deliverable runs`: cards E1, E2 (`deps: ['E1']`), E3 independente, selecionados os três; o spec de E1 tem um ruling `scope: 'contract'` comum; o mock do registro devolve `DEC-900` → E1 roda até o merge, E2 tem motivo `held by DEC-900 (E1, contract, pending ratification)` e nenhum rótulo `E2:spec`, E3 roda até `E3:merge`.
  - `a transitive dependent is held citing the origin decision`: E3 com `deps: ['E2']` e E2 com `deps: ['E1']`.
  - `a pending contract decision read in discovery holds unstarted dependents and not its owner`: `pendingDecisionsStdout` com `{ id: 'DEC-7', deliverable: 'E1', scope: 'contract', startedDependents: [] }` → E1 roda, E2 retido citando DEC-7; em `plan-only` igual; em `dry-run` nenhum agente de entregável e a retenção aparece em `selection`.
  - `discovery requires pendingDecisionsStdout`: o `required` de `S_DISC` contém o campo; JSON inválido nele para o run como os outros campos obrigatórios.
- [ ] **Passo 2:** `PT --test-name-pattern "AC8|transitive dependent|pending contract decision read|requires pendingDecisionsStdout"` → FALHA.
- [ ] **Passo 3: implementar** a leitura na descoberta e a checagem antes de iniciar cada entregável (na mesma execução e por decisões pendentes), em `run` e `plan-only`.
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T8: dependentes retidos por decisão de contrato pendente` com WF e FT.

### Tarefa 9: campo `status` do `docs-measure` (DEC-444)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`
- Testar: `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`

**Interfaces:**
- Produz: `S_DOCMEAS = { statusStdout, briefStdout, clean, head, measureOk, measureDetails }`, obrigatórios `statusStdout`, `briefStdout`, `clean`; o prompt nomeia `statusStdout` e `briefStdout`; o JavaScript mapeia para `recordVerdict`.

- [ ] **Passo 1: testes que falham** em FT: mock de `:docs-measure` passa a devolver `statusStdout`/`briefStdout`; `docs-measure schema has no status field` (`'status' in S_DOCMEAS.properties === false`); `a docs-measure answer with statusStdout passes without the missing-panel alarm` (nenhuma preocupação contendo `reread status --json is missing or has no panel`).
- [ ] **Passo 2:** `PT --test-name-pattern "docs-measure"` → FALHA.
- [ ] **Passo 3: implementar.**
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T9: docs-measure devolve statusStdout e briefStdout` com WF e FT.

### Tarefa 10: preflight com permissões declaradas e novo aviso da regra (DEC-313, DEC-283)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.mjs`
- Testar: `plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs`

**Interfaces:**
- Produz: `runPreflight(folder, { ..., declarePermissions = null })` devolve `permissionsDeclared: string | null`; a CLI aceita `--declare-permissions "<texto>"` (texto não vazio; vazio → `null`); o aviso de `workflowRuleCovered === false` passa a dizer que o lançamento pela skill não precisa da regra e que ela só é precisa para lançar o workflow fora da skill, sem a frase `claude -p` ... `denied`.

- [ ] **Passo 1: testes que falham** em `preflight.test.mjs`: `--declare-permissions is returned as permissionsDeclared` (CLI por `spawnSync` com o texto `"granted by managed settings"` → `permissionsDeclared` igual ao texto); `without the flag permissionsDeclared is null`; `the workflow rule warning says the skill launch needs no rule` (o aviso casa `/launched by this skill/i` e `/outside (this|the) skill/i` e não casa `/claude -p[^.]*denied/`). Atualize os testes atuais que casam o texto antigo do aviso.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/scripts/preflight.test.mjs` → FALHA.
- [ ] **Passo 3: implementar.** O preflight nunca deriva a declaração; `missingRules` continua calculado igual.
- [ ] **Passo 4:** mesmo comando → PASSA; G1 → exit 0, 0 falhas.
- [ ] **Passo 5: commit** `E8 T10: preflight aceita --declare-permissions e aviso novo da regra do workflow` com os dois arquivos.

### Tarefa 11: SKILL.md e operator.md (receita sem interface, ações novas, passo 2)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/skills/roadmap-release/SKILL.md`, `plugins/productivity-tools/skills/roadmap-release/references/operator.md`
- Criar: `plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs`

**Interfaces:**
- Consome: `permissionsDeclared` (T10); ações `previous-version`, `approve-ruling`, `plan-frozen-tasks` (T4, T5, T6); `approveRulings` (T5).

- [ ] **Passo 1: testes que falham** em `docs.test.mjs` (lê os arquivos com `\r\n` normalizado):
  - `no shipped file sets bypassPermissions as the default`: em `SKILL.md`, `references/*.md` e WF, toda linha que contém `bypassPermissions` também casa `/not the default|never the default|não é o padrão/i`.
  - `operator.md has the headless recipe`: seção `## Without the interface (claude -p)` contendo `--allowedTools "Bash(git:*)" "Bash(node:*)"`, `CLAUDE_CODE_PRINT_BG_WAIT_CEILING_MS=0`, `.claude/settings.local.json` e `--declare-permissions`.
  - `operator.md lists the new action kinds`: `previous-version`, `approve-ruling` (com `approveRulings` digitado pela pessoa e fora de `resumeWith`) e `plan-frozen-tasks`.
  - `SKILL.md step 2 keeps DEC-218 with the owner-resume exception`: o passo 2 cita `permissionsDeclared` e a exceção (dono selecionado, `startedDependents` vazio, nenhum outro selecionado dependente).
  - `the scriptPath fallback states the dialog limit`: o passo 4 de `SKILL.md` e `operator.md` dizem que o lançamento por `scriptPath` do script inteiro não passa pelo diálogo de aprovação acima de 213.337 caracteres (valor de `state.md`; "não medido" quando o orquestrador não medir) e que o caminho suportado é o nome.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/docs.test.mjs` → FALHA.
- [ ] **Passo 3: escrever** as seções em inglês (língua dos dois arquivos), sem indicar `bypassPermissions` como padrão. Respeite os limites de prosa de `plugins/productivity-tools/scripts/prose-budget.test.mjs` (enxugue texto existente do mesmo arquivo se o limite estourar).
- [ ] **Passo 4:** mesmo comando → PASSA; G1, G3 e G5 → exit 0.
- [ ] **Passo 5: commit** `E8 T11: receita sem interface, ações novas e exceção do passo 2 na documentação` com os três arquivos.

### Tarefa 12: `agents/spec-author.md` alinhado (DEC-421, DEC-422, DEC-477)

tier: sonnet · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

**Arquivos:**
- Modificar: `plugins/productivity-tools/agents/spec-author.md`
- Testar: `plugins/productivity-tools/scripts/spec-tool.test.mjs`

**Interfaces:** contrato do agente lido pelo prompt da T5 (`output` absoluto, `ownerNote` por último).

- [ ] **Passo 1: testes que falham** em `spec-tool.test.mjs`: `spec-author contract: absolute output, multiline last field, topic as given` (a tabela tem `output` com "absolute path of the spec to write", `ownerNote` e `intake` com "last field, may span several lines to the end of the prompt", `topic` com "used as given" e `E<n>`); `spec-author step 5 asks for the verify tag in both modes`; `spec-author keeps ruling ids when merging an owner note`.
- [ ] **Passo 2:** `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs` → FALHA.
- [ ] **Passo 3: editar** o agente; não use a frase que `plugins/productivity-tools/scripts/independence.test.mjs` proíbe.
- [ ] **Passo 4:** `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/scripts/independence.test.mjs` → PASSA; G1, G3 e G5 → exit 0.
- [ ] **Passo 5: commit** `E8 T12: spec-author com output absoluto, ownerNote por último, marca verify e tópico como id` com os dois arquivos.

### Tarefa 13: teto de tamanho do script de workflow

tier: haiku · reviewTier: sonnet · external: false · needsLock: nenhuma · navegador: não

Depois de T1 a T12 (mede o script na ponta de `feat/E8`).

**Arquivos:**
- Criar: `plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs`

**Interfaces:** `MAX_WORKFLOW_CHARS` exportado do teste como constante.

- [ ] **Passo 1: medir** `node -e "const fs=require('fs');console.log(fs.readFileSync('plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js','utf8').length)"` → N; teto = `Math.ceil(N / 10000) * 10000`.
- [ ] **Passo 2: escrever** `size.test.mjs` com o teste `the release workflow stays within the size launched by name` (`readFileSync(WF, 'utf8').length <= MAX_WORKFLOW_CHARS`), com comentário: valor provisório (N na ponta de `feat/E8` arredondado para cima ao múltiplo de 10.000), o lançamento pelo nome com a concessão ainda não medido; crescimento acima disso pede nova medição ou decisão.
- [ ] **Passo 3:** `node --test plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs` → PASSA; G1 → exit 0, 0 falhas; G2, G3, G4 e G5 → exit 0.
- [ ] **Passo 4: commit** `E8 T13: teto provisório de tamanho do workflow com teste` com o arquivo.

## Acceptance criteria evidence

Todas as linhas rodam só testes locais na worktree do entregável (nenhum efeito externo).

| AC | kind | command | testRef | external | externalDedupe |
|---|---|---|---|---|---|
| AC1 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC1: spec and plan stage prompts and artifact paths never cite superpowers and all forbid asking the person" | false | |
| AC2 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC2: a branch with task commits and no native spec stops with previous-version and writes no spec" | false | |
| AC3 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC3: a plan whose digest does not match after the retries fails as infra without running a task" | false | |
| AC4 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC4: the implementer and the task reviewer get model and effort from route" | false | |
| AC5 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC5: a ruling that contradicts a registered decision stops the deliverable" | false | |
| AC6 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC6: a common ruling is recorded as pending ratification and the run goes on" | false | |
| AC7 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC7: a costly irreversible ruling stops after the spec commit without writing the plan" | false | |
| AC8 | test | node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs | flow.test.mjs: "AC8: a contract ruling holds a selected dependent citing the decision and an independent deliverable runs" | false | |

Quando um passo não pode ser exercido neste ambiente (execução real do workflow com agentes), a evidência aceitável é o teste de `flow.test.mjs` com o agente simulado e a saída de G1; a execução real fica com o orquestrador (seção "Fora do plano").
