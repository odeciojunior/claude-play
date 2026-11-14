# E26, bloco A do arnês: laço de rodadas, braços conferidos, sementes nativas, braço perguntas, custo da sessão

Data: 2026-11-14. Branch: `fix/measure-e26`. Base: DEC-722 a DEC-729 (dono via Fable), card E26. Só `tools/measure/`. Teste antes, sem bump.

## Objetivo

Deixar o arnês de estágio (`run-batch.mjs --stage`) pronto para as peças 1 e 2 de E26: medir a revisão de spec e de plano com o laço do produto (DEC-723), sobre spec e plano nativos semeados (DEC-724), com o braço perguntas (DEC-725) e o custo da sessão principal no agregado (DEC-728). O bloco A não roda medição paga. As sondas e os lotes são do dono.

## Escopo

Dentro: A1 a A5 abaixo, em `tools/measure/` e nos testes de lá.

Fora: o bloco B (estágio final, revisão restrita, correção semeada, DEC-729). As variantes de pipeline (`completo`, `parada-retomada`, `codigo-semeado-*`) seguem nos caminhos antigos (pendência de E11). Nenhuma edição em `plugins/` nem em `roadmap-release.js`. A peça 3 (autor de plano, DEC-727). O prompt de plano com o bloco de tarefas do emit (fica fora em todos os braços, DEC-723).

## Decisão pendente antes de implementar (D1: contagem de DEC-722)

Pela letra, o bloco A toca 12 arquivos fora os testes. São 5 de código (`run-batch.mjs`, `make-scenario.mjs`, `checkpoint.mjs`, `defects/manifest.json`, `defects/sentinels/native.mjs`) e 7 de dados copiados: 3 braços recopiados, 2 braços perguntas e 2 sementes. O próprio desenho já pede pelo menos 7 arquivos de dados (A2 com 3, A3 com 2 e A4 com 2), então a leitura literal disparava o gatilho com qualquer implementação.

Recomendação: contar só os módulos de código e o manifesto (5 de 8) e listar os dados à parte. Pela regra de 2026-11-12, isso vai ao Fable antes da T1. Se a leitura for a literal, o gatilho de DEC-722 dispara e o dono decide.

Para economizar arquivos, todas as 16 sentinelas nativas ficam num módulo só, e `plan-review-atual.md` não é tocado (ver A2).

## Fatos lidos no código (base do desenho)

- `runReviewLoop(env, stage, review, fix, truth, opt)` está na região `// <pure>` de `roadmap-release.js`, linhas 56 a 1271, com uns 73.500 caracteres. Depende de `fmt`, `compact`, `isHard`, `sameFinding`, `nextTier` e `maxModel`, todas puras. `env = { maxFix, blqIds, reviews, concerns, acceptRisks }`. `MAXFIX = intArg(A.maxFixRounds, 2, 0)`.
- O laço chama `review(round, prev, reviewer, extra)`. A rodada `'1b'` repete uma revisão nula. Depois `fix(fixable, k, tier)`, que deve devolver um valor não nulo (`{ status: 'DONE' }`), e `truth(r)` dá a lista de issues.
  - Limite: `maxFix` correções, mais 1 rodada bônus na primeira escalada.
  - Achado repetido (`sameFinding`): o corretor sobe um tier. Se repetir em opus, o laço para.
- Estágio spec (linhas 2217 a 2241): o revisor roda em `model: 'opus', effort: 'medium'` e o corretor em `model: tier, effort: effortFor(tier)`. Opções do laço: `{ tier: 'opus', reviewModel: 'opus' }`. O corretor começa em opus, e um achado repetido para na hora.
- Estágio plano (linhas 2385 a 2411): o revisor roda em opus/medium e o corretor começa em sonnet. Opções: `{ tier: 'sonnet', reviewModel: 'opus' }`. A repetição escala o corretor para opus com 1 rodada bônus, e a repetição em opus para. O revisor é sempre opus: o callback ignora o 3º argumento.
- O revisor de rodada maior que 1 recebe `\nIssues from the previous round (${repeatRule()}):\n${prev}` antes da linha `Measure:`. `repeatRule` é pura.
- Diferenças do produto que o arnês não replica:
  - `truth` do produto: `reviewTruth(r, minCommits, label)`, que soma os bloqueantes mais commits faltando e árvore suja. O spec junta `specLoadIssues()`, e o plano junta `planBlobGaps(r)` e `planGaps()`.
  - Artefato reutilizado: `minCommits` é 0. No arnês, o artefato semeado conta como reutilizado.
  - O arnês não recarrega o artefato pela ferramenta depois da correção. Em vez disso, a linha de check no prompt do corretor manda o corretor rodar o check, e o arnês grava o exit do check no fim da tentativa (A1).
- `artifactPaths(roadmapSlug, E)` é pura (linha 1058) e devolve `docs/plans/<slug>-<E>/{spec,plan,reviews,run}`. Na sandbox, `roadmapSlug = 'sandbox'`, então os caminhos ficam `docs/plans/sandbox-E5/spec.md` e `docs/plans/sandbox-E5/plan.md`. O caminho das ferramentas é `${pluginRoot}/scripts/spec-tool.mjs` e `${pluginRoot}/scripts/plan-tool.mjs`.
- `armMatches` (`checkpoint.mjs`) confere uma subsequência: só exige que as partes do braço apareçam em ordem. Uma linha que o braço omite passa despercebida. Por isso, em HEAD, `spec-fix-atual.md` e `plan-fix-atual.md` "casam" sem a linha de check, e só `spec-review-atual.md` falha (conferido com node nesta branch).
- `plan-review-atual.md` manda `${RM}` literal ao revisor, porque `fill` só troca `{{x}}`. Fica como está, para preservar a identidade do script de rodada única. É nota para E11.
- O script de rodada única de hoje chama o revisor de spec e plano em opus sem `effort`, e o corretor em sonnet com a lista de issues formatada pelo arnês. No laço, o revisor recebe effort medium e a lista vem de `fmt()`, como no produto. Os números de rodada única de E26 saem do lote do laço (DEC-725), não deste script.
- As sementes da 2ª sonda estão em `D:/claude-e8q-work/completo/completo-1`, `release/sandbox`, `docs/plans/sandbox-E5/`. O spec é o blob `52e8d1f` (commit 1acda10) e o plano é o blob `36fc2df` (commit 0ac8bd5), sem mudança até `release/sandbox`. sha256 de cada um:
  - spec.md: `fa68eb1f1c1c017003beffb380887cb6143f3012b4136a5b1dc5a4dcbe1d7cec`
  - plan.md: `6d486e526820c082cfe008a63765acbc1377236ff69334285979f7c145c0da30`
- Diferenças do plano nativo para o antigo:
  - As tarefas são `### Tarefa n:` e o fim é um bloco `json data` plan/1.
  - Nenhuma tarefa roda a suíte inteira, então P3 e P6 antigos não têm âncora.
  - Os tiers saem do `score` (não existe `reviewTier`).
  - O cabeçalho traz `**Branch / worktree:** feat/E5 in D:/claude-e8q-work/completo/completo-1-wt/E5`.

## Comportamento por item

### A1. Laço de rodadas

- Nova opção `--rounds loop|single`, com padrão `single`. `single` gera o mesmo script de hoje, byte a byte, para as mesmas entradas. `loop` só vale com `--stage spec-review|plan-review` e `--arm atual`. Com qualquer outra combinação, `UsageError` (saída 2).
- Na partida, `run-batch` lê `skills/roadmap-release/workflow/roadmap-release.js` do plugin medido (`--plugin-dir` ou `installPath`) e extrai as linhas entre `// <pure>` e `// </pure>` com a mesma regra de `loadPure` (split `/\r?\n/`, join `\n`). Recusa antes de qualquer `claude -p` nestes casos:
  - Os marcadores ou `function runReviewLoop` não existem no texto (gatilho de DEC-723).
  - O literal `{ tier: 'opus', reviewModel: 'opus' })` (spec) ou `{ tier: 'sonnet', reviewModel: 'opus' })` (plano) não aparece no texto. É o detector de deriva das opções do estágio.
  - O script gerado passa de 200.000 caracteres.
- Tabela `STAGE_LOOP` no arnês:
  - spec: `{ tier: 'opus', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 }`
  - plano: `{ tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 }`
- Script `review-only.js` no modo laço, nesta ordem:
  1. `export const meta`.
  2. O bloco puro, literal.
  3. As constantes do arnês, com prefixo `H_` para não colidir com nomes do bloco puro: `H_SCHEMA`, `H_REVIEW_BODY`, `H_MEASURE`, `H_FIX`, `H_LABEL`, `H_OPT`.
  4. `H_env = { maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks: (s, i) => H_accepted.push(...i) }`.
  5. `review = (round, prev) => agent(H_REVIEW_BODY + (prev ? '\nIssues from the previous round (' + repeatRule() + '):\n' + prev : '') + H_MEASURE, { label: H_LABEL + round, phase: 'Review', model: 'opus', effort: 'medium', schema: H_SCHEMA })`.
  6. `fix = async (iss, k, tier) => { const fx = await agent(H_FIX.split('{{issues}}').join(fmt(iss)), { label: H_LABEL + '-fix' + k, phase: 'Review', model: tier, effort: effortFor(tier) }); return fx == null ? null : { status: 'DONE' } }`.
  7. `truth = r => reviewTruth(r, 0, 'main..HEAD')`.
  8. `const res = await runReviewLoop(H_env, stage, review, fix, truth, H_OPT)`.
  9. `return { ok: res.ok, kind: res.kind ?? null, msg: res.msg ?? null, reviews: H_env.reviews, accepted: H_accepted }`.
- Os rótulos seguem os de hoje: `E5:spec-review<round>` e `E5:spec-review-fix<k>`, com `plan` no lugar de `spec` no estágio de plano. Assim `harnessValidity` e `reviewCounts` continuam valendo. Se `E5:<stage>1` vier com resultado nulo, a validade usa `E5:<stage>1b`.
- No agregado, o resultado do laço vem do diário, porque o retorno do script não chega a ele. São usadas as funções puras do workflow medido (`reviewTruth`, `isHard`), carregadas com `loadPure(<workflow medido>)`:
  - `ok`: a última revisão não tem issue dura.
  - `kind` quando não está ok: `decisao` se alguma issue dura tiver essa categoria, senão `conteudo`.
  - Revisão ou correção nula depois do retry: tentativa inválida, motivo `laco-infra`.
- Desfecho no fim (`outcomes`): as sentinelas leem `feat/E5`. O estágio conta como `approved` se o laço terminou ok, senão `stopped`. `outcomeFor` não muda.
- Desfecho após a 1ª correção (`afterFirstFix`):
  - Sem `E5:<stage>-fix1`: `{ headSha: null, verified: true, outcomes: <iguais aos do fim> }`.
  - Com correção: `headSha` vem de `E5:<stage>2`. Para valer, o commit existe, tem `seededCommit` como ancestral e é ancestral de `feat/E5`, conferido com `git cat-file -e <sha>^{commit}` e dois `merge-base --is-ancestor`. As sentinelas então leem `present(dir, headSha, id)`, e o estágio vem de `harnessStage` com essas presenças.
  - Se a conferência falhar: `verified: false` e todos os desfechos `indeterminado`.
- No fim de cada tentativa válida de variante nativa, o arnês grava o exit do check da ferramenta no tip de `feat/E5`: `spec-tool check <spec> --roadmap <rm>` ou `plan-tool check <plan> --spec <spec>`, ambos do plugin medido. É código, sem chamada de modelo, e serve à regra de DEC-726 para o braço perguntas.

### A2. Braços realinhados

- Recopiar de HEAD (`roadmap-release.js`) os textos dos estágios em `arms/spec-review-atual.md`, `arms/spec-fix-atual.md` e `arms/plan-fix-atual.md`, com a 1ª linha `Copied from: ... at commit <HEAD>`. Os `${...}` viram placeholders:
  - `{{artifactPath}}`, `{{E}}`, `{{cardRef}}` e `{{repo}}/{{RM}}requirements.md` (e decisions).
  - Nos corretores, `{{issues}}` e a linha de check inteira: `run node "{{specTool}}" check "{{specAbs}}" --roadmap "{{rmAbs}}"` no spec, `run node "{{planTool}}" check "{{planAbs}}" --spec "{{specAbs}}"` no plano.
  - Ficam fora os pedaços que o arnês não manda: o prefixo `C()`, `NO_ASK`, o bloco de tarefas do emit e a linha `Measure:` (o arnês acrescenta a dele).
- `harnessPrompts` preenche os placeholders novos:
  - `E = 'E5'`, `RM = 'docs/plans/roadmap-sandbox/'`, `rmAbs = <sb>/docs/plans/roadmap-sandbox`.
  - `specTool` e `planTool` em `<installPath do plugin medido>/scripts/...`, com barras normais.
  - `specAbs` e `planAbs` vêm de `scenario.paths`.
  - Nenhum `{{` pode sobrar no prompt de revisão. No de correção, só `{{issues}}`.
- `plan-review-atual.md` não muda. A regra de hoje "revisão e correção do mesmo commit" sai e no lugar entra a recusa por braço defasado, que é mais forte. O agregado passa a gravar `harness.armCommits = { review, fix }`, e `workflowCommit` continua sendo o commit do braço de revisão.
- Recusa: com `--arm atual` e estágio spec ou plano, `run-batch` confere `armMatches(<braço>, <roadmap-release.js do plugin medido>)` para o braço de revisão e o de correção. Se algum não casar, sai com `UsageError: arm <arquivo> is stale against <plugin>` antes de `claude --version` e de qualquer `claude -p`.
- `armMatches` passa para `run-batch.mjs`. `checkpoint.mjs` importa e reexporta (`checkpoint.test.mjs` segue importando de lá). `armStatus` lista `tools/measure/arms/*-atual.md` com `listAt` no `tagCommit` e confere todos.
- Forma: `arm = { planReview, planFix, files: { '<nome>': bool } }`. A regra de bloqueio da classe plano continua a mesma: só `planReview && planFix`. O markdown lista todos os braços.

### A3. Sementes nativas

- `scenario/e5-native/spec.md` e `scenario/e5-native/plan.md` são cópias exatas dos blobs da 2ª sonda, em LF. `make-scenario` confere o sha256 (texto em LF) contra `seedSha256` no manifesto e recusa se divergir.
- Variantes novas: `spec-nativo-A`, `spec-nativo-B`, `plano-nativo-A`, `plano-nativo-B`. `SEEDED` ganha `set: 'e5-native'`. As antigas ficam implícitas como `set: 'e5'` e não mudam: S1 a S8 e os P1 a P8 antigos ficam intocados.
- `NATIVE_PATHS = loadPure().artifactPaths('sandbox', 'E5')`. `makeScenario` devolve `scenario.paths` (`E5_PATHS` nas antigas, `NATIVE_PATHS` nas nativas). `checkValidity`, `harnessPrompts`, `STAGES.blobPath` e as chaves de `seededBlobs` passam a ler `scenario.paths`, sem caminho literal no código.
- `STAGES`: spec-review aceita `/^spec-(semeado|nativo)-[AB]$/` e plan-review aceita `/^plano-(semeado|nativo)-[AB]$/`.
- No manifesto, cada entrada nativa leva estes campos:
  - `set: 'e5-native'`.
  - `file` com o caminho de `artifactPaths` (um teste confere a igualdade).
  - `seed: 'scenario/e5-native/<x>.md'` e `seedSha256`.
  - `sentinel: 'sentinels/native.mjs'`.
- `seedVariant` e `attemptOutcomes` filtram por `(e.set ?? 'e5') === art.set` e chamam `mod.seed(dir, e.id)` e `mod.present(dir, ref, e.id)`. As sentinelas antigas ignoram o argumento extra.
- Plano (A: P1 a P4, B: P5 a P8). Cada artefato tem 1 defeito acoplado (dois lugares). Nele, `present` é verdadeiro enquanto qualquer um dos dois lugares ainda tiver o defeito.

| Id | Tipo | Onde | Âncora no plano nativo |
|---|---|---|---|
| P1 | missing-verification | acoplado | Tarefa 2: some o passo 4 (`Run node --test tests/e5-truncate.test.mjs: exit 0`) e `checks` da tarefa 2 no JSON fica `[]` |
| P2 | phantom-command | JSON | `checks[0].cmd` da tarefa 1 vira `npm run verify-slug` |
| P3 | wrong-order | prosa | Tarefa 3: o passo de escrever o módulo vem antes do passo da falha esperada, com `testFirst: true` |
| P4 | weak-test | prosa | Tarefa 2, passo 1: os casos viram "asserts that truncate is a function" |
| P5 | hidden-side-effect | prosa | Tarefa 1 ganha o passo "append a line to ../outbox.log", e a tarefa continua `external: false` |
| P6 | missing-lock | JSON | Tarefa 3 ganha `{"cmd":"node --test","expect":"exit 0"}` (a suíte inteira prende a porta 48731) com `locks: []` |
| P7 | roadmap-edit | acoplado | Tarefa 2: `docs/plans/roadmap-sandbox/state.md` entra em Files (prosa) e em `files.modify` e `writes` (JSON) |
| P8 | score-mismatch | JSON | Tarefa 3: `score.blast` vai a 2 sem efeito externo nem arquivo compartilhado |

- Spec (A: SN1 a SN4, B: SN5 a SN8). Os critérios de aceite nunca mudam, porque o spec-tool pega critério alterado (DEC-724).

| Id | Tipo | Onde | Âncora no spec nativo |
|---|---|---|---|
| SN1 | wrong-behavior | prosa | Design, critério 1: os acentos ficam no slug (`'café-au-lait'`), contra o AC1 |
| SN2 | decision-violation | acoplado | ruling R4 nova no JSON (cache em `.cache/truncate.json`, `contradicts: null`) e um parágrafo do Design que cita o cache, contra DEC-002 |
| SN3 | contradiction | prosa | Design, critério 2: o comprimento passa a `text.length` (UTF-16), contra a ruling R2 |
| SN4 | not-viable | prosa | Design, critério 3: importa `splitWords` de `src/text-core.mjs`, que não existe e está fora do escopo |
| SN5 | scope-creep | prosa | Scope In ganha `src/capitalize.mjs` |
| SN6 | false-claim | prosa | Intent: "the product owner confirmed the ellipsis in DEC-004" (DEC inexistente) |
| SN7 | false-human-input | acoplado | `needsPerson` no JSON (escolha do hífen, `blocking: true`) e uma seção "Depends on human input" na prosa |
| SN8 | hidden-side-effect | prosa | Design: "after the merge, append the release note to ../outbox.log", com `externalEffects: []` |

- Regra de troca: um id que o código pega (check com exit diferente de 0, `planGaps` não vazio, ou a âncora não existe) é substituído por um id novo, P9 em diante ou SN9 em diante. A entrada ganha `replaces` e `noteE11` no manifesto, e o executor lista a troca no relatório final para o tracker. O par acoplado, se cair, é substituído por outro acoplado do mesmo artefato.
- `seedSourceOf` nas nativas: `{ kind: 'nativo-sonda-2', spec, plan, specSha256, planSha256, probePluginCommit: 'c5658cf' }`.

### A4. Braço perguntas

- `arms/spec-review-perguntas.md`, sem a linha `Copied from`: o leitor só lê e devolve perguntas que mudariam o plano. Placeholders: `{{artifactPath}}`, `{{E}}`, `{{cardRef}}`, `{{repo}}`, `{{RM}}`.
- `arms/spec-fix-perguntas.md`: o prompt do `productivity-tools:spec-author` no formato de chamada do workflow:
  - Cabeçalho: `mode: unattended`, `output: {{specAbs}}`, `specTool: {{specTool}}`, `roadmap: {{rmAbs}}`, `card: {{E}}`.
  - `ownerNote` com `{{questions}}`: as perguntas, com a instrução de resolver cada uma lendo o código, sem perguntar à pessoa, editar o spec existente e commitar.
- Com `--arm perguntas`, só no estágio spec-review e com `--rounds single`, o script tem:
  - O leitor `E5:spec-review1` em opus/medium, com o schema `{ questions: [{ q, whyItChangesThePlan }], headSha, clean, commitsInRange, measuredSpecBlob }` (todos obrigatórios).
  - Se `questions.length > 0`: 1 chamada `agent(..., { agentType: 'productivity-tools:spec-author', label: 'E5:spec-review-fix1', phase: 'Review' })`, sem modelo explícito (o frontmatter do agente diz opus/medium) e sem segunda leitura.
  - Lista vazia: nenhuma chamada do autor.
- Validade: a mesma de spec (`measuredSpecBlob` igual ao blob semeado). Estágio: `approved` se a lista vier vazia, ou se o autor rodou e algum defeito sumiu. Senão `stopped`.
- `attempt.review = { questions: n }`. `toolCheck` (A1) também é gravado.

### A5. Custo da sessão e papéis

- Cada `claude -p` tem o JSON lido. `total_cost_usd` é somado nas sessões da tentativa e vai para `attempt.counters.session = { cliCostUsd }` (null se faltar).
- `attempt.rolesByLabel = { review, fix, session }`, contado a partir de `run.roles` antes do colapso de `other:*`:
  - `review`: chaves com `review` e sem `fix`.
  - `fix`: chaves com `fix`.
  - O resto vai para `other`.
  - `review` e `fix` levam `{ calls, cost, agents }`. `session` leva `{ cliCostUsd, transcriptCostUsd: run.main.cost }`.
- No agregado: `rolesByLabel` somado nas válidas e `cost.session = { median, min, max }`.
- Ainda não se sabe se `total_cost_usd` já inclui os agentes do Workflow. Os dois números ficam lado a lado, e a sonda do dono compara `cliCostUsd` com `run.main.cost + run.total.cost` antes de usar a soma.

## Formas no agregado (novas ou alteradas)

```text
harness: { stage, arm, armSource, workflowCommit, armCommits: { review, fix }, harnessCommit,
           rounds: 'single'|'loop', pureSha256 (loop), stageOptions: { tier, reviewModel, reviewEffort, maxFix } (loop) }
attempts[i] (válida, estágio):
  outcomes: [...]                       // no fim (semântica de hoje no single)
  loop: { reviews: n, fixes: m, fixTiers: ['sonnet','opus'], ok: bool, kind: null|'conteudo'|'decisao' }   // só loop
  afterFirstFix: { headSha: sha|null, verified: bool, outcomes: [...] }                                 // só loop
  toolCheck: { exit: int|null }          // variantes nativas
  review: { blocking, minor } | { questions }
  counters.session: { cliCostUsd }
  rolesByLabel: { review: {calls, cost, agents}, fix: {...}, session: { cliCostUsd, transcriptCostUsd } }
topo: outcomes, deteccaoPorCodigo (fim, como hoje); outcomesAfterFirstFix (mesma forma, totalOutcomes sobre afterFirstFix);
      loopSummary: { reviews: { '1': n, '2': n, ... }, ok: n, stopped: n }; afterFirstFixUnverified: n;
      rolesByLabel; cost.session
```

## Arquivos

Código (5): `tools/measure/run-batch.mjs`, `tools/measure/make-scenario.mjs`, `tools/measure/checkpoint.mjs`, `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/native.mjs` (novo).
Dados (7): `tools/measure/arms/{spec-review-atual,spec-fix-atual,plan-fix-atual}.md` (recopiados), `tools/measure/arms/{spec-review-perguntas,spec-fix-perguntas}.md` (novos), `tools/measure/scenario/e5-native/{spec,plan}.md` (novos).
Testes: `run-batch.test.mjs`, `make-scenario.test.mjs`, `checkpoint.test.mjs`, `review-loop.test.mjs` (novo).

## Aceite e testes por item

- A1:
  - O script do laço contém o bloco puro extraído do workflow, igual byte a byte (LF), compila com `AsyncFunction('agent', ...)`, tem até 200.000 caracteres sobre o `roadmap-release.js` real e não tem `import`.
  - Agente simulado em spec: sem bloqueante → `[review1]`. Bloqueante e depois limpo → `[review1, fix1, review2]`, `ok: true`. Achado repetido → `[review1, fix1(opus), review2]`, para com `kind: 'conteudo'`.
  - Agente simulado em plano: achado repetido → `[review1, fix1(sonnet), review2, fix2(opus), review3]`, para na repetição em opus. Achados sempre diferentes → para depois de 2 correções.
  - Em todas as rodadas, o revisor vai com `model: 'opus', effort: 'medium'`. Revisão de rodada maior que 1 traz `Issues from the previous round (` + `repeatRule()`.
  - O script de rodada única de plan-review atual é igual a um golden congelado antes da mudança.
  - Recusa (saída 2, nenhum `claude -p`) sem `runReviewLoop`, sem o literal de opções e com `--rounds loop` em task-review ou com `--arm perguntas`.
  - No agregado com o executor falso: `loop`, `afterFirstFix` e `outcomesAfterFirstFix` corretos. `headSha` inexistente ou fora de `seededCommit..feat/E5` → `verified: false` e desfechos `indeterminado`.
- A2:
  - Todo `arms/*-atual.md` casa com o `roadmap-release.js` de HEAD, e `spec-fix` e `plan-fix` contêm a linha `json data block` com o check.
  - O braço defasado num `--plugin-dir` de fixture → `UsageError`, sem chamada a `claude`.
  - `checkpoint` com `readAt`/`listAt` falsos: `arm.files` lista todos, e só a classe plano bloqueia.
  - O conteúdo de `plan-review-atual.md` não muda (o teste compara o sha do arquivo).
- A3:
  - O sha256 das sementes bate com o manifesto.
  - Em cada variante nativa, `present(dir, seededCommit, id)` é verdadeiro e `present(dir, <commit limpo>, id)` é falso.
  - `spec-tool check` (com `--roadmap`) e `plan-tool check` (com `--spec`) do plugin do repo saem com exit 0 no commit semeado.
  - `planGaps` fica vazio no commit semeado. É recomposto com as puras `evidenceGaps`, `externalGaps` e `evidenceExternalGaps`, mais a numeração 1..N e as travas de `release.config.json` da sandbox. `tasksFromPlan`/`evidenceFromPlan` saem do `plan-tool emit` e `cardAc` sai do card E5 com `parseVerifyTag`.
  - `entry.file === artifactPaths('sandbox','E5').<spec|plan>`. As variantes antigas dão o mesmo `scenario` de hoje.
- A4:
  - O script perguntas usa o schema de perguntas. Lista vazia → nenhum `agent` do autor. Lista com perguntas → exatamente 1 chamada com `agentType: 'productivity-tools:spec-author'`.
  - `--arm perguntas` fora de spec-review → `UsageError`.
- A5:
  - Com o executor falso devolvendo `total_cost_usd`, `counters.session.cliCostUsd` é a soma das sessões e `rolesByLabel` separa `spec-review` de `other:spec-review-fix`.
  - Sem o campo, o valor é `null`, sem quebrar a mediana.

## Riscos e incógnitas

- Colisão de nomes entre o bloco puro e o script: o prefixo `H_` e a compilação no teste (const duplicado vira SyntaxError) cobrem. Se o runtime do Workflow avaliar o script em modo estrito diferente do teste, a sonda do dono mostra.
- O resultado do laço vem do diário, não do retorno do script. Ele diverge do produto nas issues de carga (`specLoadIssues`, `planGaps` e `planBlobGaps` não entram no `truth`). O `toolCheck` no fim mostra o caso em que a correção quebrou o check.
- Pode ser que nenhuma variação de algum P ou SN passe sem o código pegar. A regra de troca cobre isso (DEC-724). Os candidatos mais frágeis são P1 (`checks: []` numa tarefa test-first), P7 (escrita na pasta do roadmap), P6 (lint de travas) e SN7 (`needsPerson` bloqueante sem `blq`).
- O cabeçalho do plano semeado cita a worktree da sonda (`D:/claude-e8q-work/...`). Um revisor pode acusar isso em todos os braços como ruído comum. Não muda o sha. Fica registrado e, se aparecer na sonda, o dono decide.
- O card E5 de `make-sandbox.mjs` em HEAD pode ter mudado desde c5658cf. O teste de check do A3 pega isso antes de qualquer medição.
- A2 muda o texto do corretor de plano (linha de check e placeholders): uma rodada única real de plano não é idêntica às de antes no `FIX_PROMPT`. A identidade exigida é a do gerador e do braço de revisão.
- `armMatches` continua sendo subsequência e não pega linha omitida. As cópias de A2 ficam completas, e o teste da linha de check protege os dois corretores.
- `total_cost_usd` com ou sem os agentes: ver A5.
- Uma importação circular `checkpoint` ↔ `run-batch` não acontece, porque `armMatches` passa para `run-batch` e `checkpoint` já importava dele.

## Tarefas (ordem; até 4 arquivos cada; teste antes)

Comandos comuns: `node --test tools/measure/<arquivo>.test.mjs`. Antes de cada commit, a suíte do repo inteira: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`. Revisão por tarefa: sonnet em T1, T2, T7 e T8. Opus em T3 a T6 (A1 e A3). Portão final da branch: tier T3 (opus, high).

1. **T1, A2 recusa e checkpoint** (sonnet)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`, `checkpoint.mjs`, `checkpoint.test.mjs`.
   - `armMatches` passa para `run-batch`, que confere os braços contra o workflow do plugin medido e recusa antes de qualquer `claude`. A checagem de mesmo commit sai. Entram `armCommits` e `armStatus` sobre todos os `*-atual.md`.
   - Testes: `node --test tools/measure/run-batch.test.mjs tools/measure/checkpoint.test.mjs`.
2. **T2, A2 recópia** (sonnet)
   - Arquivos: `arms/spec-review-atual.md`, `arms/spec-fix-atual.md`, `arms/plan-fix-atual.md`, `checkpoint.test.mjs`.
   - Teste primeiro: todo `*-atual.md` casa com HEAD, os corretores têm a linha de check e o sha de `plan-review-atual.md` não muda. Depois a recópia.
   - Testes: `node --test tools/measure/checkpoint.test.mjs`.
3. **T3, A3 cenário nativo limpo** (opus)
   - Arquivos: `scenario/e5-native/spec.md`, `scenario/e5-native/plan.md`, `make-scenario.mjs`, `make-scenario.test.mjs`.
   - Cópia por `git -C <sonda> show release/sandbox:docs/plans/sandbox-E5/<x>.md` gravada em LF. Também: `NATIVE_PATHS` via `artifactPaths`, `scenario.paths`, a conferência do sha e `prepareE5Branch` nativo.
   - Testes: sha bate, os checks das ferramentas saem com exit 0 no branch limpo e as variantes antigas não mudam. `node --test tools/measure/make-scenario.test.mjs`.
4. **T4, A3 defeitos nativos** (opus)
   - Arquivos: `defects/manifest.json`, `defects/sentinels/native.mjs`, `make-scenario.mjs`, `make-scenario.test.mjs`.
   - Entram P1 a P8 e SN1 a SN8, o filtro por `set`, o id passado a `seed`/`present` e a regra de troca aplicada.
   - Testes: `present` semeado/limpo, check com exit 0 e `planGaps` vazio no semeado, `entry.file` igual a `artifactPaths`. `node --test tools/measure/make-scenario.test.mjs`.
5. **T5, A1 script do laço** (opus)
   - Arquivos: `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs`.
   - Golden da rodada única gravado primeiro. Depois `--rounds`, a extração do bloco puro, `STAGE_LOOP`, as recusas e o gerador do laço.
   - Testes: os três cenários simulados por estágio, o tamanho até 200.000 sobre o workflow real e o golden. `node --test tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs`.
6. **T6, A1 agregado e fiação nativa** (opus)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`.
   - Entram `STAGES` com as variantes nativas, `scenario.paths` em validade e prompts, o resultado do laço pelo diário (`loadPure` do workflow medido), `afterFirstFix` com a conferência do SHA, `toolCheck`, `outcomesAfterFirstFix`, `loopSummary` e `laco-infra`.
   - Testes: `node --test tools/measure/run-batch.test.mjs`.
7. **T7, A4 braço perguntas** (sonnet)
   - Arquivos: `arms/spec-review-perguntas.md`, `arms/spec-fix-perguntas.md`, `run-batch.mjs`, `run-batch.test.mjs`.
   - Testes: schema, lista vazia sem autor, 1 chamada `spec-author` e as recusas de combinação. `node --test tools/measure/run-batch.test.mjs`.
8. **T8, A5 custo e papéis** (sonnet)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`.
   - Testes: soma de `total_cost_usd`, `null` sem o campo, `rolesByLabel` e `cost.session`. `node --test tools/measure/run-batch.test.mjs`.

Depois da T8 vem o portão final da branch (tier T3, opus high) com a suíte inteira verde. Não há sonda paga dentro do bloco A: a 1ª execução real de cada braço é a sonda do dono (DEC-725, DEC-728).
