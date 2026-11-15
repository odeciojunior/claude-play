# E26, bloco A do arnês: laço de rodadas, braços conferidos, sementes nativas, braço perguntas, custo da sessão

Data: 2026-11-14 (revisão 2, com a decisão D1 e os 7 ajustes do dono via Fable). Branch: `fix/measure-e26`. Base: DEC-722 a DEC-729 e card E26. Só `tools/measure/`. Teste antes, sem bump.

## Objetivo

Deixar o arnês de estágio (`run-batch.mjs --stage`) pronto para as peças 1 e 2 de E26:

- medir a revisão de spec e de plano com o laço do produto (DEC-723);
- sobre spec e plano nativos semeados (DEC-724);
- com o braço perguntas (DEC-725);
- com o custo da sessão principal no agregado (DEC-728).

O bloco A não roda medição paga. As sondas e os lotes são do dono.

## Escopo

Dentro: A1 a A5 abaixo, em `tools/measure/` e nos testes de lá. O bloco A não tira nada do passo 0.

Fora:

- o bloco B (DEC-729);
- as variantes de pipeline (`completo`, `parada-retomada`, `codigo-semeado-*`), que seguem nos caminhos antigos (pendência de E11);
- qualquer edição em `plugins/` ou em `roadmap-release.js`;
- a peça 3 (DEC-727);
- o bloco de tarefas do emit no prompt de plano, que fica fora em todos os braços (DEC-723).

## Limite de arquivos (D1, decidido)

O limite de DEC-722 conta só os arquivos de código de `tools/measure` (`.mjs` e `manifest.json`). O bloco A tem 5:

- `run-batch.mjs`
- `make-scenario.mjs`
- `checkpoint.mjs`
- `defects/manifest.json`
- `defects/sentinels/native.mjs` (novo; reúne as 16 sentinelas nativas)

Braços e sementes são dados, listados à parte, com limite próprio de 8. O bloco A usa 7:

- 2 recópias de spec;
- 1 fragmento de check do corretor de plano;
- 2 braços perguntas;
- 2 sementes.

`plan-fix-atual.md` e `plan-review-atual.md` não mudam.

## Fatos lidos no código (base do desenho)

- **Onde está o laço.** `runReviewLoop(env, stage, review, fix, truth, opt)` está na região `// <pure>` de `roadmap-release.js` (linhas 56 a 1271, uns 73.500 caracteres).
  - Depende de `fmt`, `compact`, `isHard`, `sameFinding`, `nextTier` e `maxModel`, todas puras.
  - `env = { maxFix, blqIds, reviews, concerns, acceptRisks }`.
  - `MAXFIX = intArg(A.maxFixRounds, 2, 0)` (linha 1306).
- **Como o laço anda.**
  - Chama `review(round, prev, reviewer, extra)`; a rodada `'1b'` repete uma revisão nula.
  - Chama `fix(fixable, k, tier)`, que deve devolver um valor não nulo.
  - `truth(r)` dá as issues.
  - Limite: `maxFix` correções, mais 1 rodada bônus na primeira escalada.
  - Achado repetido: o corretor sobe um tier; se repetir em opus, o laço para.
- **Estágio spec** (linhas 2217 a 2241):
  - revisor em opus/medium;
  - corretor em `model: tier, effort: effortFor(tier)`;
  - opções `{ tier: 'opus', reviewModel: 'opus' }`, logo um achado repetido para o laço na hora.
- **Estágio plano** (linhas 2385 a 2411):
  - revisor sempre opus/medium (o callback ignora o 3º argumento);
  - corretor começa em sonnet, com opções `{ tier: 'sonnet', reviewModel: 'opus' }`;
  - a repetição escala o corretor para opus com 1 rodada bônus, e a repetição em opus para.
- **O literal de opções do plano se repete.** `{ tier: 'sonnet', reviewModel: 'opus' })` aparece também na linha 2806, no estágio delta, e uma variante dele na linha 2683, na revisão final. Por isso o detector de deriva procura só dentro do trecho do estágio (A1).
- **Revisões a partir da 2ª rodada.** Recebem `\nIssues from the previous round (${repeatRule()}):\n${prev}` antes de `Measure:`.
- **Diferenças que o arnês não replica.**
  - O `truth` do produto junta `reviewTruth` com `specLoadIssues()` (spec), ou com `planBlobGaps(r)` e `planGaps()` (plano).
  - O produto recarrega o artefato pela ferramenta depois de cada correção.
  - O arnês usa `reviewTruth(r, 0, ...)`, porque o artefato semeado conta como reutilizado, e grava o exit do check da ferramenta no fim (A1).
- **Caminhos.**
  - `artifactPaths(roadmapSlug, E)` é pura (linha 1058). Na sandbox, `roadmapSlug = 'sandbox'`, então os artefatos ficam em `docs/plans/sandbox-E5/{spec,plan}.md`.
  - As ferramentas ficam em `${pluginRoot}/scripts/{spec,plan}-tool.mjs`.
- **`armMatches` só confere a ordem das partes.** Uma linha omitida passa. Em HEAD, só `spec-review-atual.md` falha (conferido com node nesta branch). Os corretores "casam" sem a linha de check.
- **`${RM}` literal.** `plan-review-atual.md` manda `${RM}` literal ao revisor, porque `fill` só troca `{{x}}`. O arquivo fica intacto; só o modo laço troca no código (A2).
- **Diferenças entre a rodada única de hoje e o laço.**
  - Hoje o revisor roda em opus sem `effort`, e o corretor em sonnet, com a lista de issues formatada pelo arnês.
  - No laço o revisor recebe effort medium e a lista vem de `fmt()`, como no produto.
  - Os números de rodada única saem do lote do laço (DEC-725).
- **Sementes da 2ª sonda.** Repositório `D:/claude-e8q-work/completo/completo-1`, branch `release/sandbox`, pasta `docs/plans/sandbox-E5/`. Os dois blobs não mudaram até `release/sandbox`.

  | Arquivo | Blob (commit) | sha256 |
  |---|---|---|
  | spec.md | `52e8d1f` (1acda10) | `fa68eb1f1c1c017003beffb380887cb6143f3012b4136a5b1dc5a4dcbe1d7cec` |
  | plan.md | `36fc2df` (0ac8bd5) | `6d486e526820c082cfe008a63765acbc1377236ff69334285979f7c145c0da30` |

- **Como o plano nativo difere do antigo.**
  - As tarefas são `### Tarefa n:` e há um bloco `json data` plan/1.
  - Não há tarefa que rode a suíte inteira nem dependência entre tarefas.
  - Os tiers saem do `score`.
  - O cabeçalho cita a worktree da sonda.

## Comportamento por item

### A1. Laço de rodadas

- **Opção.** `--rounds loop|single`, padrão `single`.
  - `single` gera o mesmo script de hoje, byte a byte. O golden da T5 cobre o script inteiro de `plano-semeado-A`, incluindo o `FIX_PROMPT`.
  - `loop` só vale com `--stage spec-review|plan-review` e `--arm atual`. Outra combinação dá `UsageError`.
- **Recusas na partida.** `run-batch` lê `skills/roadmap-release/workflow/roadmap-release.js` do plugin medido e extrai o bloco puro com a regra de `loadPure` (split `/\r?\n/`, join `\n`). Recusa antes de qualquer `claude -p` se:
  - faltam os marcadores ou `function runReviewLoop` (gatilho de DEC-723);
  - `intArg(A.maxFixRounds, 2, 0)` sumiu;
  - o literal de opções não aparece no trecho entre `reviewLoop('spec',` (ou `reviewLoop('plan',`) e o `reviewLoop(` seguinte. O literal do spec é `{ tier: 'opus', reviewModel: 'opus' })` e o do plano, `{ tier: 'sonnet', reviewModel: 'opus' })`;
  - o script gerado passa de 200.000 caracteres.
- **Tabela `STAGE_LOOP`.**
  - spec: `{ tier: 'opus', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 }`
  - plano: `{ tier: 'sonnet', reviewModel: 'opus', reviewEffort: 'medium', maxFix: 2 }`
- **Script do laço**, na ordem:
  1. `export const meta`.
  2. O bloco puro, literal.
  3. As constantes do arnês, com prefixo `H_`.
  4. `H_env = { maxFix: 2, blqIds: new Set(), reviews: [], concerns: [], acceptRisks }`.
  5. `review = (round, prev) => agent(H_REVIEW_BODY + (prev ? '\nIssues from the previous round (' + repeatRule() + '):\n' + prev : '') + H_MEASURE, { label: H_LABEL + round, phase: 'Review', model: 'opus', effort: 'medium', schema: H_SCHEMA })`.
  6. `fix = async (iss, k, tier) => ...`: chama `agent(H_FIX com {{issues}} = fmt(iss), { label: H_LABEL + '-fix' + k, model: tier, effort: effortFor(tier) })` e devolve `{ status: 'DONE' }` se o retorno não for nulo, senão `null`.
  7. `truth = r => reviewTruth(r, 0, 'main..HEAD')`.
  8. `runReviewLoop(H_env, stage, review, fix, truth, H_OPT)`.
  9. Devolve `{ ok, kind, msg, reviews, accepted }`.
- **`${RM}` no laço.** No estágio de plano, o arnês troca no código o `${RM}` literal do braço de revisão por `docs/plans/roadmap-sandbox/` antes de montar `H_REVIEW_BODY`. O arquivo e o golden de rodada única não mudam.
- **Rótulos.**
  - Revisão: `E5:<stage><round>`. Correção: `E5:<stage>-fix<k>`.
  - Se `E5:<stage>1` vier com resultado nulo, a validade usa `E5:<stage>1b`.
- **Resultado do laço**, lido do diário com `reviewTruth` e `isHard` (vindos de `loadPure` sobre o workflow medido):
  - `ok`: a última revisão não tem issue dura.
  - `kind`: `decisao` se alguma issue dura tiver essa categoria, senão `conteudo`.
  - Revisão ou correção nula depois do retry: tentativa inválida, motivo `laco-infra`.
- **Desfecho no fim.** As sentinelas leem `feat/E5`. O estágio é `approved` se o laço terminou ok, senão `stopped`.
- **Desfecho após a 1ª correção** (`afterFirstFix`).
  - Sem `E5:<stage>-fix1`: `{ headSha: null, verified: true, outcomes: <os do fim> }`.
  - Com correção: `headSha` vem de `E5:<stage>2`. Ele vale (`verified: true`) só se, ao mesmo tempo:
    - o commit existe (`git cat-file -e <sha>^{commit}`);
    - `seededCommit` é ancestral dele e ele é ancestral de `feat/E5`;
    - o blob medido pelo revisor 2 (`measuredSpecBlob` ou `measuredPlanBlob`) é igual a `git rev-parse <headSha>:<artefato>`;
    - com exatamente 1 correção no diário, `headSha` é o tip de `feat/E5`.
  - Se vale: `present(dir, headSha, id)` e o estágio por `harnessStage`. Senão: `verified: false` e todos os desfechos `indeterminado`.
- **Check da ferramenta no fim.** Em cada tentativa válida de variante nativa, o arnês grava em `toolCheck` o exit de `spec-tool check <spec> --roadmap <rm>` ou de `plan-tool check <plan> --spec <spec>`, no tip de `feat/E5`, com o plugin medido.

### A2. Braços realinhados

- **Recópia dos braços de spec.** `arms/spec-review-atual.md` e `arms/spec-fix-atual.md` são recopiados de HEAD com `Copied from: ... at commit <HEAD>`. Placeholders:
  - `{{artifactPath}}`, `{{E}}`, `{{cardRef}}` e `{{repo}}/{{RM}}requirements.md` (e decisions);
  - no corretor, `{{issues}}` e a linha de check `run node "{{specTool}}" check "{{specAbs}}" --roadmap "{{rmAbs}}"`.
  - Ficam fora: `C()`, `NO_ASK` e `Measure:` (o arnês acrescenta a sua).
- **Corretor de plano.** `plan-fix-atual.md` não é recopiado: DEC-310 o mantém como instrumento de E15. Ele e `plan-review-atual.md` ficam intactos, com o sha testado.
  - Fragmento novo, `arms/plan-fix-check-atual.md`: a 1ª linha `Copied from` e só a linha de check copiada de HEAD, com placeholders `{{planTool}}`, `{{planAbs}}` e `{{specAbs}}`.
  - O arnês acrescenta essa linha ao prompt do corretor de plano só nas variantes `e5-native`. Nas `plano-semeado-*` o `FIX_PROMPT` fica como hoje.
- **Preenchimento.** `harnessPrompts` preenche:
  - `E = 'E5'`, `RM = 'docs/plans/roadmap-sandbox/'`, `rmAbs`;
  - `specTool` e `planTool` em `<installPath>/scripts/...`;
  - `specAbs` e `planAbs` a partir de `scenario.paths`.
  - Não pode sobrar `{{` fora o `{{issues}}` do corretor.
- **Regra do mesmo commit.** Continua valendo e passa a cobrir também o fragmento: revisão, correção e `fixCheck`, quando usado, do mesmo commit. A recusa por braço defasado entra por cima: com `--arm atual` em spec ou plano, `armMatches` confere a revisão, a correção e, nas nativas de plano, o fragmento contra o `roadmap-release.js` do plugin medido. Se algum falhar, `UsageError` antes de `claude --version`. O agregado grava `harness.armCommits = { review, fix, fixCheck }`.
- **Checkpoint.** `armMatches` passa para `run-batch.mjs`, e `checkpoint.mjs` importa e reexporta. `armStatus` confere todos os `tools/measure/arms/*-atual.md` com `listAt`. Forma: `arm = { planReview, planFix, files: { '<nome>': bool } }`. Só `planReview && planFix` bloqueia a classe plano.

### A3. Sementes nativas

- **Cópias.** `scenario/e5-native/spec.md` e `plan.md` são cópias exatas, em LF, dos blobs da sonda. `make-scenario` recusa se o sha256 divergir do `seedSha256` do manifesto.
- **Caminho no cabeçalho do plano.** Fica o da sonda. Se a sonda do dono mostrar um bloqueante que o cite, `make-scenario` troca o caminho pelo da sandbox depois da conferência do sha, e a sonda se repete.
- **Variantes.** Entram `spec-nativo-A/B` e `plano-nativo-A/B`, com `set: 'e5-native'`. As antigas ficam `set: 'e5'` implícito e não mudam.
- **Caminhos.** `NATIVE_PATHS = loadPure().artifactPaths('sandbox', 'E5')`. `makeScenario` devolve `scenario.paths`, e validade, prompts, `blobPath` e `seededBlobs` leem dali.
  - `STAGES` aceita `/^spec-(semeado|nativo)-[AB]$/` e `/^plano-(semeado|nativo)-[AB]$/`.
- **Manifesto.** Cada entrada nativa leva:
  - `set: 'e5-native'`;
  - `file` igual a `artifactPaths` (testado);
  - `seed` e `seedSha256`;
  - `sentinel: 'sentinels/native.mjs'`.
- **Filtro e sentinelas.** `seedVariant` e `attemptOutcomes` filtram por `set` e passam o id: `seed(dir, id)` e `present(dir, ref, id)`. Num defeito acoplado, `present` é verdadeiro enquanto qualquer um dos dois lugares ainda tiver o defeito.

| Id | Art. | Tipo | Onde | Âncora no plano nativo |
|---|---|---|---|---|
| P1 | A | missing-verification | acoplado | Tarefa 2: some o passo 4 (`Run node --test tests/e5-truncate.test.mjs: exit 0`) e `checks` da tarefa 2 fica `[]` |
| P2 | A | phantom-command | JSON | `checks[0].cmd` da tarefa 1 vira `npm run verify-slug` |
| P9 | A | wrong-order (`replaces: 'P3'`) | prosa | Tarefa 3: escrever o módulo vem antes do passo da falha esperada, com `testFirst: true` |
| P4 | A | weak-test | prosa | Tarefa 2, passo 1: os casos viram "asserts that truncate is a function" |
| P5 | B | hidden-side-effect | prosa | Tarefa 1 ganha "append a line to ../outbox.log" e segue `external: false` |
| P6 | B | missing-lock | JSON | Tarefa 3 ganha `{"cmd":"node --test","expect":"exit 0"}` (a suíte prende a porta 48731) com `locks: []` |
| P7 | B | roadmap-edit | acoplado | Tarefa 2: `docs/plans/roadmap-sandbox/state.md` em Files (prosa) e em `files.modify` e `writes` (JSON) |
| P8 | B | score-mismatch | JSON | Tarefa 3: `score.blast` vai a 2 sem efeito externo nem arquivo compartilhado |

- **Notas para E11.**
  - P3 antigo (ordem entre tarefas) não tem contraparte nativa. Entra P9 com `replaces: 'P3'` e `noteE11` dizendo que o plano nativo não tem dependência entre tarefas.
  - P6 mantém o id, com `noteE11` dizendo que a âncora foi construída (o plano nativo não roda a suíte).

| Id | Art. | Tipo | Onde | Âncora no spec nativo (critérios de aceite intactos) |
|---|---|---|---|---|
| SN1 | A | wrong-behavior | prosa | Design, critério 1: os acentos ficam no slug (`'café-au-lait'`), contra o AC1 |
| SN2 | A | decision-violation | acoplado | ruling R4 nova (cache em `.cache/truncate.json`, `contradicts: null`) e um parágrafo do Design que cita o cache, contra DEC-002 |
| SN3 | A | contradiction | prosa | critério 2 passa a medir com `text.length`, contra a ruling R2 |
| SN4 | A | not-viable | prosa | critério 3 importa `splitWords` de `src/text-core.mjs`, que não existe |
| SN5 | B | scope-creep | prosa | Scope In ganha `src/capitalize.mjs` |
| SN6 | B | false-claim | prosa | Intent: "the product owner confirmed the ellipsis in DEC-004" |
| SN7 | B | false-human-input | acoplado | `needsPerson` (hífen, `blocking: true`) no JSON e uma seção "Depends on human input" na prosa |
| SN8 | B | hidden-side-effect | prosa | Design: "after the merge, append the release note to ../outbox.log", com `externalEffects: []` |

- **Regra de troca.** Um id que o código pega (check com exit diferente de 0, `planGaps` não vazio ou âncora ausente) vira um id novo (P10 em diante, SN9 em diante), com `replaces` e `noteE11`. O executor lista a troca no relatório. Se o acoplado cair, entra outro acoplado do mesmo artefato.
- **`seedSourceOf` nas nativas:** `{ kind: 'nativo-sonda-2', spec, plan, specSha256, planSha256, probePluginCommit: 'c5658cf' }`.

### A4. Braço perguntas (última tarefa, cortável)

- **Leitor.** `arms/spec-review-perguntas.md`, sem `Copied from`, com placeholders `{{artifactPath}}`, `{{E}}`, `{{cardRef}}`, `{{repo}}` e `{{RM}}`. O leitor só lê e devolve perguntas que mudariam o plano.
- **Autor.** `arms/spec-fix-perguntas.md` tem o formato de chamada do workflow:
  - linhas `mode: unattended`, `output: {{specAbs}}`, `specTool: {{specTool}}`, `roadmap: {{rmAbs}}` e `card: {{E}}`;
  - `ownerNote` com `{{questions}}` e a instrução de resolver cada pergunta lendo o código, sem perguntar à pessoa, editar o spec e commitar.
- **Script** (`--arm perguntas`, só em spec-review e com `--rounds single`):
  - leitor `E5:spec-review1` em opus/medium, com o schema `{ questions: [{ q, whyItChangesThePlan }], headSha, clean, commitsInRange, measuredSpecBlob }`;
  - com perguntas: 1 chamada `agentType: 'productivity-tools:spec-author'`, rótulo `E5:spec-review-fix1`, sem modelo explícito e sem segunda leitura;
  - lista vazia: nenhuma chamada.
- **Validade:** igual à de spec.
- **Estágio:** `approved` se a lista vier vazia, ou se o autor rodou e algum defeito sumiu. Senão `stopped`.
- **O que a tentativa grava:**
  - `attempt.review = { questions: n }`;
  - `toolCheck`;
  - `attempt.humanInputs = { blockingSeeded, blockingAtEnd }`: a contagem de `needsPerson` com `blocking: true` no bloco spec/1, lida em código no `seededCommit` e no tip de `feat/E5`. É a 2ª exclusão de DEC-726.
- **Corte.** A T7 é a última e não tem dependentes. Se o dono cortar o braço (decisão pendente sobre a condição 3 de DEC-726), nada das outras tarefas é refeito. Os campos `toolCheck` e `humanInputs` ficam no arnês de spec, na T6.

### A5. Custo da sessão e papéis

- **Custo da sessão.** `total_cost_usd` do JSON de cada `claude -p`, somado nas sessões, vai para `attempt.counters.session = { cliCostUsd }`, ou `null` sem o campo.
- **Papéis.** `attempt.rolesByLabel = { review, fix, session }`, contado em `run.roles` antes do colapso de `other:*`:
  - `review`: chaves com `review` e sem `fix`;
  - `fix`: chaves com `fix`;
  - o resto vai para `other`;
  - `session = { cliCostUsd, transcriptCostUsd: run.main.cost }`.
- **Agregado.** `rolesByLabel` somado e `cost.session = { median, min, max }`.
- **Incógnita.** Não se sabe se `total_cost_usd` inclui os agentes do Workflow. Os dois números ficam lado a lado, e a sonda do dono compara.

## Formas no agregado (novas ou alteradas)

```text
harness: { stage, arm, armSource, workflowCommit, armCommits: { review, fix, fixCheck|null }, harnessCommit,
           rounds: 'single'|'loop', pureSha256 (loop), stageOptions: { tier, reviewModel, reviewEffort, maxFix } (loop) }
attempts[i] (válida, estágio):
  outcomes: [...]                                                       // no fim
  loop: { reviews, fixes, fixTiers: [...], ok, kind: null|'conteudo'|'decisao' }        // só loop
  afterFirstFix: { headSha|null, verified, outcomes: [...] }                            // só loop
  toolCheck: { exit|null }                                              // nativas
  humanInputs: { blockingSeeded, blockingAtEnd }                        // spec nativo
  review: { blocking, minor } | { questions }
  counters.session: { cliCostUsd }
  rolesByLabel: { review: {calls, cost, agents}, fix: {...}, session: { cliCostUsd, transcriptCostUsd } }
topo: outcomes, deteccaoPorCodigo (fim); outcomesAfterFirstFix; loopSummary: { reviews: {'1': n, ...}, ok, stopped };
      afterFirstFixUnverified; rolesByLabel; cost.session
```

## Arquivos

**Código (5):**

- `tools/measure/run-batch.mjs`
- `tools/measure/make-scenario.mjs`
- `tools/measure/checkpoint.mjs`
- `tools/measure/defects/manifest.json`
- `tools/measure/defects/sentinels/native.mjs` (novo)

**Dados (7):**

- `tools/measure/arms/spec-review-atual.md` e `tools/measure/arms/spec-fix-atual.md` (recopiados)
- `tools/measure/arms/plan-fix-check-atual.md` (novo fragmento)
- `tools/measure/arms/spec-review-perguntas.md` e `tools/measure/arms/spec-fix-perguntas.md` (novos)
- `tools/measure/scenario/e5-native/spec.md` e `tools/measure/scenario/e5-native/plan.md` (novos)

**Intactos, com sha testado:** `arms/plan-fix-atual.md`, `arms/plan-review-atual.md`.

**Testes:** `run-batch.test.mjs`, `make-scenario.test.mjs`, `checkpoint.test.mjs` e `review-loop.test.mjs` (novo).

## Aceite e testes por item

- **A1**
  - O script do laço contém o bloco puro byte a byte (LF), compila com `AsyncFunction` e tem até 200.000 caracteres sobre o workflow real.
  - Com agente simulado, as sequências esperadas:

    | Estágio | Cenário | Sequência e resultado |
    |---|---|---|
    | spec | sem bloqueante | `[review1]` |
    | spec | bloqueante e depois limpo | `[review1, fix1, review2]`, `ok: true` |
    | spec | achado repetido | `[review1, fix1(opus), review2]`, para com `conteudo` |
    | plano | achado repetido | `[review1, fix1(sonnet), review2, fix2(opus), review3]`, para |
    | plano | achados sempre diferentes | para depois de 2 correções |

  - O revisor vai sempre em opus/medium. A rodada 2 em diante traz `repeatRule()`. No laço de plano, o prompt de revisão não contém `${RM}`.
  - O golden congelado da rodada única cobre o script inteiro de `plano-semeado-A`, `FIX_PROMPT` incluído.
  - Recusas, todas com saída 2 e sem `claude -p`:
    - falta `runReviewLoop`;
    - falta `intArg(A.maxFixRounds, 2, 0)`;
    - o literal de opções não está no trecho do estágio, mesmo presente na linha 2806 (fixture);
    - `--rounds loop` em task-review;
    - `--rounds loop` com `--arm perguntas`.
  - `afterFirstFix` dá `verified: false` em quatro casos:
    - o SHA não existe;
    - o SHA está fora de `seededCommit..feat/E5`;
    - o blob do revisor 2 difere de `git rev-parse <headSha>:<artefato>`;
    - houve 1 correção e o SHA não é o tip de `feat/E5`.
- **A2**
  - `spec-review-atual`, `spec-fix-atual` e `plan-fix-check-atual` casam com HEAD, e o fragmento contém a linha de check.
  - O sha de `plan-fix-atual.md` e de `plan-review-atual.md` não muda.
  - A linha de check entra no `FIX_PROMPT` só de `plano-nativo-*`.
  - Commits diferentes entre revisão, correção e fragmento dão `UsageError`. Um braço defasado num `--plugin-dir` de fixture dá `UsageError` sem chamar `claude`.
  - No checkpoint, `arm.files` lista todos, e só a classe plano bloqueia.
- **A3**
  - O sha das sementes bate com o manifesto.
  - Para cada id, `present` dá verdadeiro no semeado e falso no limpo.
  - `spec-tool check` e `plan-tool check` saem com exit 0 no semeado.
  - `planGaps` fica vazio, recomposto com as puras `evidenceGaps`, `externalGaps` e `evidenceExternalGaps`, a numeração 1..N e as travas da sandbox, sobre o `plan-tool emit` e o card E5.
  - `entry.file` é igual a `artifactPaths`. P9 tem `replaces: 'P3'`, e P9 e P6 têm `noteE11`.
  - As variantes antigas não mudam.
- **A4**
  - Lista vazia: nenhum autor. Lista com perguntas: exatamente 1 `spec-author`.
  - `humanInputs` é contado do bloco spec/1 no semeado (SN7 dá `blockingSeeded: 1`) e no tip.
  - `--arm perguntas` fora de spec-review dá `UsageError`.
- **A5**
  - A soma de `total_cost_usd` está certa, e sem o campo o valor é `null`.
  - `rolesByLabel` separa `spec-review` de `other:spec-review-fix`, e `cost.session` vem calculado.

## Riscos e incógnitas

- **Colisão de nomes entre o bloco puro e o script.** O prefixo `H_` e a compilação no teste cobrem. Um modo estrito diferente no runtime do Workflow aparece na sonda.
- **Resultado do laço tirado do diário.** Diverge do produto nas issues de carga. O `toolCheck` mostra a correção que quebrou o check.
- **Defeitos que o código pode pegar.** P1, P6, P7 e SN7 são os candidatos frágeis; a regra de troca cobre (DEC-724).
- **Caminho da sonda no cabeçalho do plano.** Mantido; a troca está prevista em A3 se a sonda mostrar um bloqueante que o cite.
- **Card E5 em HEAD.** `make-sandbox.mjs` pode ter mudado desde c5658cf; o teste de check do A3 pega antes de medir.
- **`armMatches` continua sendo subsequência.** Não pega linha omitida. O fragmento e o teste da linha de check protegem o corretor de plano nativo.
- **Repetição do literal de opções do plano** (linhas 2683 e 2806). O trecho delimitado por `reviewLoop(` resolve; um teste de fixture prova.
- **`total_cost_usd`.** Ver A5.
- **Importação circular.** Não há: `armMatches` passa para `run-batch`, e `checkpoint` já importava dele.

## Tarefas (ordem; até 4 arquivos cada; teste antes)

**Comandos de teste:**

- Por tarefa: `node --test tools/measure/<arquivo>.test.mjs`.
- Antes de cada commit, a suíte inteira: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`.

**Revisão:** sonnet em T1, T2, T7 e T8; opus em T3 a T6 (A1 e A3). O portão final da branch é tier T3 (opus, high).

1. **T1. A2: recusa e checkpoint** (sonnet)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`, `checkpoint.mjs`, `checkpoint.test.mjs`.
   - `armMatches` passa para `run-batch`.
   - Recusa por braço defasado por cima da regra do mesmo commit.
   - `armCommits` e `armStatus` sobre todos os `*-atual.md`.
   - Teste: `node --test tools/measure/run-batch.test.mjs tools/measure/checkpoint.test.mjs`.
2. **T2. A2: recópias de spec e fragmento** (sonnet)
   - Arquivos: `arms/spec-review-atual.md`, `arms/spec-fix-atual.md`, `arms/plan-fix-check-atual.md`, `checkpoint.test.mjs`.
   - Teste primeiro: os três casam com HEAD e o sha dos dois braços de plano não muda.
   - Teste: `node --test tools/measure/checkpoint.test.mjs`.
3. **T3. A3: cenário nativo limpo** (opus)
   - Arquivos: `scenario/e5-native/spec.md`, `scenario/e5-native/plan.md`, `make-scenario.mjs`, `make-scenario.test.mjs`.
   - Cópia com `git -C <sonda> show release/sandbox:docs/plans/sandbox-E5/<x>.md`, gravada em LF.
   - `NATIVE_PATHS`, `scenario.paths` e conferência do sha.
   - Teste: `node --test tools/measure/make-scenario.test.mjs`.
4. **T4. A3: defeitos nativos** (opus)
   - Arquivos: `defects/manifest.json`, `defects/sentinels/native.mjs`, `make-scenario.mjs`, `make-scenario.test.mjs`.
   - P1, P2, P4 a P9 e SN1 a SN8, com filtro por `set`, id passado às sentinelas, `noteE11` e a regra de troca.
   - Teste: `node --test tools/measure/make-scenario.test.mjs`.
5. **T5. A1: script do laço** (opus)
   - Arquivos: `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs`.
   - O golden do script inteiro de `plano-semeado-A` vem primeiro.
   - Depois `--rounds`, a extração do bloco puro, `STAGE_LOOP`, o detector por trecho, a recusa por `intArg`, a troca de `${RM}` no laço e o gerador.
   - Teste: `node --test tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs`.
6. **T6. A1: agregado e fiação nativa** (opus)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`.
   - `STAGES` com as nativas, `scenario.paths` e o fragmento de check nas nativas de plano.
   - Resultado do laço tirado do diário e `afterFirstFix` com as quatro conferências.
   - `toolCheck`, `humanInputs`, `outcomesAfterFirstFix`, `loopSummary` e `laco-infra`.
   - Teste: `node --test tools/measure/run-batch.test.mjs`.
7. **T8. A5: custo e papéis** (sonnet)
   - Arquivos: `run-batch.mjs`, `run-batch.test.mjs`.
   - Teste: `node --test tools/measure/run-batch.test.mjs`.
8. **T7. A4: braço perguntas** (sonnet; última e cortável)
   - Arquivos: `arms/spec-review-perguntas.md`, `arms/spec-fix-perguntas.md`, `run-batch.mjs`, `run-batch.test.mjs`.
   - Teste: `node --test tools/measure/run-batch.test.mjs`.

Depois da última tarefa feita vem o portão final da branch (tier T3) com a suíte inteira verde. O bloco A não roda sonda paga: a 1ª execução real de cada braço é do dono (DEC-725, DEC-728).
