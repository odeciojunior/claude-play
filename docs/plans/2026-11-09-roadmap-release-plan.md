# roadmap-release: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** criar o skill `roadmap-release`, que executa várias entregas de um roadmap em paralelo, sem interrupção, por um workflow empacotado.

**Architecture:** `SKILL.md` fino roda um preflight em Node (configuração e permissões) e chama a ferramenta `Workflow` com o script empacotado. O script é portado de `D:\projects\udv-center\.claude\workflows\roadmap-release.js`, sem nada do projeto. A lógica pura fica numa região marcada do script, testada sem executar o workflow.

**Tech Stack:** Node 18+ sem dependências, `node:test`, API de Workflow (`agent`, `parallel`, `phase`, `log`, `budget`, `args`), Markdown.

**Spec:** `docs/plans/2026-11-09-roadmap-release-design.md`. Executores leem a spec e o script de origem.

Worktree: `D:\projects\claude-play-wt\roadmap-skills`, branch `feat/roadmap-skills-autonomia`. Caminhos abaixo relativos a `plugins/productivity-tools/skills/roadmap-release/` (`SK/`), salvo indicação.

## Global Constraints

- `SKILL.md` abaixo de 500 linhas; referência acima de 100 linhas com índice; frontmatter só com chaves permitidas (`CLAUDE.md`, `.claude/rules/skills.md`).
- Texto do skill e do script em inglês; artefatos gerados no idioma do roadmap.
- Sem dependências npm. Nenhuma menção a Supabase, Deno, RLS, Docker ou `udv` em `SK/`.
- O workflow nunca pergunta ao usuário, nunca faz push e nunca mescla na `integrationBranch` sem `allowIntegrationBranch`.
- `meta` do script é literal puro. O script é autocontido, sem `import`.
- Testes: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs"`. Lint: `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools`.
- Limites: 16 agentes simultâneos por padrão, 1.000 por run, `maxDeliverables` padrão 12, `maxParallel` padrão 3, `maxFixRounds` padrão 2.
- Não usar `isolation: worktree`; o script cria worktrees com `git worktree add` a partir de `lastGood`.

## Review Focus

1. Palavras de status localizadas: `na-branch` no lugar de `on-branch` deve funcionar por posição em `deliverableStatuses`. Teste na Tarefa 2.
2. Comando de evidência contendo `;`, `}` ou aspas não pode quebrar a leitura da tag. Teste na Tarefa 4.
3. Run morto no meio do merge: a retomada termina a validação e as docs, sem refazer a entrega. Teste na Tarefa 4; cenário na Tarefa 10.
4. Caminho de repositório com espaços, em Windows: comandos gerados citam todos os caminhos. Teste na Tarefa 5.
5. Gate `tests` com exit diferente de zero e nenhum nome de falha não pode virar verde. Teste na Tarefa 3.

---

### Task 1: Prova do caminho de chamada e esqueleto

**Files:**
- Create: `SK/SKILL.md` (frontmatter e instrução mínima), `SK/workflow/roadmap-release.js` (mínimo, com região pura vazia), `SK/workflow/load-pure.mjs`
- Test: `SK/workflow/load-pure.test.mjs`

**Interfaces:**
- Produces: `loadPure(scriptPath?: string): Record<string, Function>`. Lê o texto entre as linhas `// <pure>` e `// </pure>`, avalia com `new Function` e devolve cada função de nível superior declarada ali.

- [ ] **Step 1:** teste `load-pure` extrai `function probe(){return 1}` de um script temporário e `loadPure` falha com mensagem clara sem os marcadores.
- [ ] **Step 2:** rodar `node --test SK/workflow/load-pure.test.mjs`. Esperado: FAIL, módulo inexistente.
- [ ] **Step 3:** implementar `load-pure.mjs` e o script mínimo: `meta` literal, um `agent()` haiku rotulado `probe` que devolve o texto `ok`, retorno `{ status: 'done', args }`.
- [ ] **Step 4:** rodar o teste. Esperado: PASS.
- [ ] **Step 5:** chamar a ferramenta `Workflow` com `scriptPath` absoluto do script e `args: {"probe":true}`. Esperado: `status: done` com os args de volta. Se falhar, reportar BLOCKED com o erro literal: a arquitetura da spec depende disso.
- [ ] **Step 6:** no `SKILL.md`, registrar que o caminho do script se monta a partir da linha "Base directory for this skill" entregue ao carregar o skill.
- [ ] **Step 7:** commit `feat(roadmap-release): esqueleto e prova do caminho de chamada`.

### Task 2: Seleção e ordem das entregas

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: `SK/workflow/selection.test.mjs`

**Interfaces:**
- Consumes: `loadPure`.
- Produces: `cleanSlug(s, id): string`; `selectDeliverables({ cards, statuses, selector, filters, heldBy, overrideDonot, autoDeps, force, maxDeliverables }): { order: string[], skipped: {id,reason}[], notes: string[], error?: string }`; `isUnfinished(card, statuses): boolean`. `card` = `{ id, phase, track, priority, deps, status, onTarget, mergeFound, mergeSha }`. `statuses` = `{ onBranch, integrated[], blocked, discarded }`, com `onBranch` lido por posição.

- [ ] **Step 1:** testes: `next` inclui cadeia selecionada; `ready` só dependências já no alvo; ciclo devolve `error`; card com status bloqueado fica fora de `next` com nota; `heldBy` retira o card, salvo `overrideDonot`; acima de `maxDeliverables` vira `skipped`, mantendo prefixo topológico; `cleanSlug('E11-relatorios','E11') === 'relatorios'`; `isUnfinished` com `statuses.onBranch === 'na-branch'` e status localizado (Review Focus 1).
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** portar a lógica das linhas 171 e 260–321 do script de origem para a região pura, nas assinaturas acima.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** commit `feat(roadmap-release): seleção e ordem das entregas`.

### Task 3: Medição e comparação de gates

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: `SK/workflow/gates.test.mjs`

**Interfaces:**
- Produces: `validMeasure(m, expectedSha, gateDefs): boolean`, com `m = { headSha, clean, gates: GateResult[] }`, `GateResult = { name, ran, exit, total, skipped, failedNames }`; `gatePasses(def, result, baselineResult): boolean`; `allPass(defs, m, baseline, changedFiles): { ok, failures: string[] }`; `isRedBaseline(defs, baseline): string[]`; `mergeFloor(baseline, branchMeasure): Baseline`. `Baseline` = mapa `name → GateResult`. `def` = `{ name, kind: 'exit'|'tests', invariant?, ignoreFailuresWhenChanged?: { paths: string[], failurePrefix: string } }`.

- [ ] **Step 1:** testes: `tests` com exit 1 e `failedNames` vazio é inválido em `validMeasure` e não passa (Review Focus 5); falhas subconjunto do baseline passam; falha nova reprova; `total` menor ou `skipped` maior que o baseline reprova; `exit` só olha o código, respeitando baseline já vermelho; `invariant` não usa baseline e `ran:false` reprova; `isRedBaseline` lista gate `exit` falhando, `tests` com total 0 e invariante violado; árvore suja ou SHA diferente é inválido; `ignoreFailuresWhenChanged` só ignora falhas do prefixo quando `changedFiles` toca os caminhos; `mergeFloor` desconta falhas instáveis do baseline.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** portar `validMeasure`, `okExit`, `passA/passB`, `mergeFloor` (linhas 160–169, 390–403, 539–547), generalizando por `def`.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** commit `feat(roadmap-release): medição genérica de gates`.

### Task 4: Revisões, critérios e retomada

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: `SK/workflow/review.test.mjs`

**Interfaces:**
- Produces: `isHard(issue, blqIds): boolean`; `nextTier(tier, sameFindingAgain): 'sonnet'|'opus'|null`; `sameFinding(prevIssues, issues): boolean`; `parseVerifyTag(item): { kind, blq?, evidence?, invalid? } | null`; `evidenceGaps(cardAc, planAc, blqIds): Issue[]`; `lastContiguousDone(tasks, doneMap): number`; `resumeAction(card, statuses, force): 'finish-merge'|'run'`.

- [ ] **Step 1:** testes: `isHard` conforme as linhas 156–157; `nextTier('sonnet', true) === 'opus'`, `nextTier('opus', true) === null`, sem repetição devolve o tier atual; `parseVerifyTag` aceita `evidence` com `;`, `}` e aspas (Review Focus 2) lendo do último `{verify:` até o `}` final do item; plano que troca o comando da tag gera lacuna e plano que acrescenta não gera; card sem tag aceita linha do plano; `blocked` sem BLQ registrado gera lacuna; `lastContiguousDone` para na primeira lacuna; `resumeAction` devolve `finish-merge` com merge presente e status anterior ao pós-merge (Review Focus 3).
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar, portando `isHard`, `acGaps` e as linhas 756–758 e 621.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** commit `feat(roadmap-release): revisões, critérios e retomada`.

### Task 5: Preflight do skill: configuração e permissões

**Files:** Create: `SK/scripts/preflight.mjs`, `SK/references/config.md`. Test: `SK/scripts/preflight.test.mjs`

**Interfaces:**
- Produces: `validateReleaseConfig(cfg): string[]`; `deriveConfig({ gatesBlockRows, projectContext }): ReleaseConfig` (com `generated: true`); `effectiveMaxParallel(cfg, requested): number`; `requiredRules(cfg): string[]`; `missingRules(required, settingsList): string[]`; `quoteArg(path): string`. CLI: `node preflight.mjs <roadmap-folder>`, imprime JSON `{ configPath, generated, errors, missingRules }`, exit 1 quando `errors` não vazio.

- [ ] **Step 1:** testes: campos da spec seção 8 validados (`kind` inválido, `gates` vazio, `needsLock` citando lock não declarado); `deriveConfig` marca `generated` e classifica lint/build como `exit` e demais como `tests`; `effectiveMaxParallel` devolve 1 com `generated`; `requiredRules` cobre gates, `install`, `setup`, `beforeEvidence` e git; `missingRules` entende curinga `Bash(npm:*)`, lendo settings de usuário, projeto e local; `quoteArg('D:/a b/c')` cita o caminho (Review Focus 4).
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** implementar sem nunca escrever settings. `config.md` documenta o contrato da seção 8 da spec, com exemplo mínimo.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** commit `feat(roadmap-release): preflight de configuração e permissões`.

### Task 6: Workflow: descoberta, preflight e setup

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: verificação em Step 3.

**Interfaces:** Consumes: Tarefas 2, 3 e 5. Produces: `args = { config, deliverables, mode, targetBranch, baseBranch, allowIntegrationBranch, maxParallel, maxFixRounds, maxDeliverables, notes, acceptRedBaseline, overrideDonot, acceptRisks, roadmap }`; retorno `{ status, operatorActions, resumeArgs, selection, results, ownerReview, truth, reportPath }` da linha 42 de origem.

- [ ] **Step 1:** portar linhas 229–385 e 632–643, substituindo `PROJETO`, `GATES` e `DOCS_CHECK` por `args.config`, `setup` por `config.setup`, e as travas fixas por um `makeLock` para cada nome de `config.locks`, com `merge` antes das demais. Alvo padrão: `config`/roadmap `releaseBranch`, senão `integracao/<slug>`.
- [ ] **Step 2:** `grep -inE 'supabase|deno|rls|docker|udv' SK/workflow/roadmap-release.js`. Esperado: nada.
- [ ] **Step 3:** rodar o workflow em `mode:"dry-run"` sobre a fixture da Tarefa 10 ou, enquanto ela não existir, sobre uma cópia temporária do roadmap da fixture do checker. Esperado: `selection.order` correto, nenhum agente além da descoberta.
- [ ] **Step 4:** commit `feat(roadmap-release): descoberta, preflight e setup`.

### Task 7: Workflow: spec, plano e tarefas

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: `SK/workflow/prompts.test.mjs`

**Interfaces:** Consumes: Tarefas 3, 4 e 6. Produces: `buildImplPrompt(ctx, task): string` e `buildTaskReviewPrompt(ctx, task, kind, impl): string` na região pura; `S_IMPL` ganha `checks: {command, output, exit}[]` obrigatório.

- [ ] **Step 1:** testes: prompt de implementação contém "STOP after this task" e `envFacts`; prompt de revisão contém os `checks` do implementador; tarefa com `reviewTier:'opus'` usa opus e as demais sonnet.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** portar linhas 449–505 e 645–808. Mudanças da spec seção 7: saída real ao revisor (item 2), `S_PLAN.tasks` com `tier` e `reviewTier` (item 4), escalonamento por `sameFinding`/`nextTier` no `reviewLoop` (item 3), registro de revisões com rodada e modelo (item 5), tag de `verify` lida do card e `evidenceGaps` no plano.
- [ ] **Step 4:** rodar. Esperado: PASS.
- [ ] **Step 5:** commit `feat(roadmap-release): spec, plano e tarefas`.

### Task 8: Workflow: revisão final, gates, merge e relatório

**Files:** Modify: `SK/workflow/roadmap-release.js`. Test: `SK/workflow/merge.test.mjs`

**Interfaces:** Consumes: Tarefas 3, 4 e 7. Produces: `needsDeltaReview(changedFiles, roadmapDir, docsPrefixes): boolean` na região pura.

- [ ] **Step 1:** testes: `needsDeltaReview` falso para delta só de docs/roadmap e verdadeiro com qualquer outro arquivo.
- [ ] **Step 2:** rodar. Esperado: FAIL.
- [ ] **Step 3:** portar linhas 515–618, 811–1045. Mudanças: re-sincronização refaz a evidência e, se `needsDeltaReview`, revisão opus de `git diff <syncAt>..<novo alvo>` dentro da trava de merge (spec seção 7 item 1); registro de revisões antes da medição final (item 5); passo de docs por `config.docsStage`; `config.conflictRules` nos prompts de sync e merge; `beforeEvidence` antes dos gates com estado; `TEST_INTEGRITY` (linhas 103–131) como padrão, substituído por `config.testIntegrity` ou desligado com `false`.
- [ ] **Step 4:** rodar testes e `node --check` numa cópia `.mjs` do script envolvida em função assíncrona. Esperado: PASS e sem erro de sintaxe.
- [ ] **Step 5:** commit `feat(roadmap-release): revisão final, merge e relatório`.

### Task 9: Texto do skill e integração no plugin

**Files:** Modify: `SK/SKILL.md`; Create: `SK/references/operator.md`; Modify: `plugins/productivity-tools/.claude-plugin/plugin.json`, `README.md` raiz, `plugins/productivity-tools/README.md`, `skills/roadmap-planner/SKILL.md` (handoff).

- [ ] **Step 1:** `SKILL.md`: rodar `preflight.mjs`; com `errors`, parar; com `missingRules`, parar uma única vez mostrando as regras exatas e sem escrever settings; gravar e commitar o config gerado na branch alvo; então chamar `Workflow` com `scriptPath` montado do diretório base do skill. Ao terminar, conferir por `git` direto `targetHead`, merges e árvore limpa contra `truth` (spec seção 7 item 6) e relatar `operatorActions`. Description só com gatilhos; diferenciar do `plan-coordinator`.
- [ ] **Step 2:** `operator.md`: tipos de falha, como retomar com `resumeArgs` e `notes`, como liberar o paralelismo de um config gerado.
- [ ] **Step 3:** handoff do planner aponta `roadmap-release` para várias entregas.
- [ ] **Step 4:** versão 1.6.0 em `plugin.json` e README raiz; linha do skill no README do plugin. Rodar lint. Esperado: 0 FAIL.
- [ ] **Step 5:** commit `feat(roadmap-release): skill e integração no plugin (productivity-tools 1.6.0)`.

### Task 10: Verificação ponta a ponta

**Files:** Create: `SK/scripts/make-sandbox.mjs`. Test: `SK/scripts/make-sandbox.test.mjs`

**Interfaces:** Produces: `node make-sandbox.mjs <dir>` cria repositório git descartável com roadmap válido de 3 entregas (E2 depende de E1; E3 independente com critério que falha de propósito), `release.config.json` com gates `node --test` e um lock.

- [ ] **Step 1:** teste: o sandbox passa em `check-roadmap.mjs` com 0 erros e `preflight.mjs` sem `errors`.
- [ ] **Step 2:** implementar e rodar. Esperado: PASS.
- [ ] **Step 3:** em sandbox no scratchpad, rodar o skill em `dry-run`, `plan-only` e `run`. Esperado em `run`: E1 e E2 mescladas no alvo, E3 em `operatorActions` com `resumeArgs`, `integrationBranch` intocada, sem push.
- [ ] **Step 4:** matar um run depois do merge de E1 e antes das docs, simulando com commit de merge e sem status; retomar. Esperado: E1 só validada e documentada (Review Focus 3).
- [ ] **Step 5:** teste comportamental por subagente e revisão adversarial exigidos por `.claude/rules/skills.md`; rodar suíte completa e lint. Esperado: 0 falhas.
- [ ] **Step 6:** commit `test(roadmap-release): verificação ponta a ponta`.
