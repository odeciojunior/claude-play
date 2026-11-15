# Preparo de E11: plano de implementação

**Roadmap:** docs/plans/roadmap-evolucao-skills
**Spec:** docs/plans/2026-11-15-preparo-e11-design.md (aprovada; decisões vigentes DEC-744..751, emenda DEC-741 em `docs/plans/roadmap-evolucao-skills/decisions.md`)
**Base:** `release/roadmap-skills-v2`. Linha de base do G1 registrada: 1990/0 em cc0cb15 (não se reexecuta para este plano).

## 0. Regras que valem para todas as tarefas

- **Restrição do lote pago (DEC-710):** o lote de E27 B usa a porta 48731. Enquanto ele roda: nenhum `node --test` amplo, nem G1, nem `claude -p`, nem suíte do sandbox, nem merge na release. O implementador escreve o teste e o código; só executa o arquivo de teste da própria tarefa quando ele é puro (sem sandbox, sem porta). Testes marcados **[após o lote]** (suíte do sandbox) só rodam entre lotes.
- Teste antes: em cada tarefa o teste é escrito e visto falhar (`node --test <arquivo>`, esperado: falha no assert novo, não erro de import) antes do código. Nos itens **[após o lote]**, o "ver falhar" também espera.
- No máximo 4 arquivos de código por tarefa; dados contados à parte (DEC-730).
- Executor: sonnet/medium. Revisor por tarefa: opus para `plugins/` (T-A1, T-A2, T-B, T-I; DEC-696, DEC-720), sonnet para `tools/measure`. Portão final por branch: opus/high (`dispatching-final-whole-branch-review`).
- Commits: `type(scope): descrição`, terminando com a linha `Co-Authored-By` vigente. Um commit por tarefa (teste e código juntos, depois de verde).
- Lê-se o arquivo antes de editar; nenhum arquivo fora da lista da tarefa muda. `plugins/_template/` nunca.
- Bump de versão só em T-I (seção 3).
- Falhou: repete uma vez no mesmo tier com o feedback do revisor; 2ª falha sobe um tier com agente novo; falha em opus, parar e avisar o dono.

## 1. Branches, paralelismo e ordem de merge

Cada branch sai de `release/roadmap-skills-v2` em worktree própria (`D:/projects/claude-play-wt/<nome>`), base explícita no `git worktree add -b`. Nenhum arquivo é compartilhado entre branches.

| Branch | Tarefas (em série) | Arquivos exclusivos | Revisor por tarefa |
|---|---|---|---|
| `feat/e11-prep-plugins` | T-A1 → T-A2 → T-B | `plan-coordinator/{workflow,scripts}`, `lib/progress-state.mjs`, `plan-writer/`, `agents/plan-author.md` | opus |
| `feat/e11-prep-native` | T-C1 → T-C2 → T-C3 → T-C4 → T-G | `scenario/e5-native/code`, `defects/**`, `make-scenario.mjs`, `scenario/coordinator-plan-native.md` | sonnet |
| `feat/e11-prep-batch` | T-D → T-H | `run-batch.mjs`, `session-metrics.mjs` (+ testes; T-D inclui `--coordinator-fixture`) | sonnet |
| `feat/e11-prep-baseline` | T-E, depois T-F | `baseline.mjs`, `run-baseline.mjs`, `checkpoint.mjs` (+ testes) | sonnet |
| `feat/e11-prep-version` | T-I (criada só no fim, de uma release que já tem as quatro anteriores) | 2 `plugin.json`, `README.md`, `roadmap-release/workflow/flow.test.mjs` | opus |

Início agora, em paralelo: `plugins`, `native` (T-C1), `batch` (T-D) e `baseline` (T-E). T-F depende de `native` (T-C4), de `batch` (T-D: `--ratify`, `--coordinator-fixture`) e de T-E. Duas saídas, a primeira é a escolhida: (a) `baseline` mescla direto `native` e `batch` (`git merge feat/e11-prep-native feat/e11-prep-batch` na worktree de `baseline`, sem esperar a release; arquivos disjuntos) e então começa T-F, cujos testes só usam stubs e `--dry-run`; (b) esperar o fim do lote de E27 B e os merges na release. Em (a), o merge de `baseline` na release vem depois de `native` e `batch` e não repete commits.

**Ordem de merge na release** (serial, entre lotes, `--no-ff`, G1 a G5 em cada um, na worktree `_integracao`):
1. `feat/e11-prep-plugins` (primeiro, para P4 poder rodar cedo; portão opus/high da branch obrigatório).
2. `feat/e11-prep-batch`.
3. `feat/e11-prep-native`; logo depois roda P5c (seção 5).
4. `feat/e11-prep-baseline` (com T-F já sobre 2 e 3).
5. P4 (conferência paga de N5-1/N5-2, seção 5), depois `feat/e11-prep-version` (T-I) com `git merge --ff-only` (a branch sai da ponta da release, então o fast-forward vale): **M é o commit de T-I e a ponta da release**. A worktree destacada do lote nasce em M (`git worktree add --detach <pasta> M`). Sem merge commit para T-I.

**Onde o G1 roda:** só em `D:/projects/claude-play-wt/_integracao` (a release), depois de cada merge e depois de T-I, nunca nas worktrees das branches e nunca com o lote de E27 B ativo. As worktrees só rodam o arquivo de teste da tarefa. G1 esperado: 0 falhas, contagem acima de 1990 (cresce pelos testes novos).

## 2. Tarefas

### T-A1. Teto de evento no coordinator (P2, parte 1) — branch `plugins`, plugins/: sim, revisor opus

Arquivos (4): `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`, `plugins/productivity-tools/lib/progress-state.mjs`, `.../workflow/gate.test.mjs`, `.../scripts/progress.test.mjs`.

Observações de código: `loadPure` só expõe funções entre `// <pure>` (linha 31) e `// </pure>` (linha 1004); `runCmd` (linha 1038) e `CMD_CAP` (linha 1112) ficam fora, então a regra vira função pura testável. A linha 639 (`state.run.baseline = ...`) está dentro do bloco `<embed src="../../../lib/progress-state.mjs" exports="strip">` (linha 32): **não se edita à mão** (`size.test.mjs:24`, "embedded blocks are not stale"). A mudança entra em `lib/progress-state.mjs` e o bloco é regenerado.

Testes primeiro:
- `gate.test.mjs`, `capNames keeps 50 names and counts the rest`: `P.capNames(80 nomes)` devolve `{ names, cut }` com `names.length === 50` e `cut === 30`; nenhum item de `names` contém `+`; 3 nomes voltam intactos com `cut: 0`.
- `gate.test.mjs`, `gateQuestion stays within 600 characters`: assinatura fixa `gateQuestion(wave, exit, failedNames)`, que chama `capNames` por dentro; com 80 nomes longos a pergunta (2.000+ caracteres hoje) sai com `length <= 600`, contém `+30` (o `+N` só existe no texto da pergunta, nunca em `names`) e a marca de corte `...`; com 1 nome curto é a frase de hoje, byte a byte.
- `gate.test.mjs`, `baselineEvent caps names and tail`: `P.baselineEvent('node --test', { exit: 1, stdout })` usa `tailOf` (no máximo 1500), `failedNames` com no máximo 50 e `failedNamesCut` com o excedente.
- `gate.test.mjs`, `waveGatePasses with a cut baseline` (sem alterar `waveGatePasses`, linha 854): baseline `exit 1` com 50 nomes e `failedNamesCut: 3`; gate com `failedNames` todos entre esses 50 → `true`; gate com um nome fora dos 50 (só na parte cortada) → `false`.
- `gate.test.mjs`, `cmdOverCap refuses a command above CMD_CAP`: 6.001 caracteres → `{ refuse: true, size: 6001 }`; 6.000 → `{ refuse: false }`.
- `progress.test.mjs`, `baseline event accepts failedNamesCut`: evento `baseline` com `failedNamesCut: 3` grava o campo em `state.run.baseline`; sem o campo, o estado fica como hoje; valor não inteiro → recusa `wrong-status`.

Passos:
1. `lib/progress-state.mjs` (origem do trecho embutido, correspondente às linhas 636-639 do coordinator): aceitar `failedNamesCut` opcional (inteiro >= 0) no evento `baseline` e gravá-lo em `state.run.baseline`.
2. `coordinator.js`, bloco `pure`, junto de `tailOf` (linha 918): `const GATE_Q_CAP = 600`, `const NAMES_CAP = 50`, `capNames(list)`, `gateQuestion(wave, exit, failedNames)` (chama `capNames`, monta a frase da linha 1427, acrescenta ` +N` quando há corte, trunca em `GATE_Q_CAP` preservando a marca), `baselineEvent(test, out)`, e `const CMD_CAP = 6000` movida de 1112 para o bloco + `cmdOverCap(cmd)`.
3. `coordinator.js:1262-1267` (`ensureBaseline`): o evento passa a ser `baselineEvent(test, out)`.
4. `coordinator.js:1427-1430` (`wave-gate`): `question = gateQuestion(act.wave, gate.exit, gate.failedNames)`; evento `wave-gate` e `block` recebem o mesmo texto curto.
5. `coordinator.js:1038` (`runCmd`): `cmdOverCap(cmd)`; se recusar, `return Promise.resolve({ exit: -1, stdout: 'command of N characters, above the limit of 6000: not dispatched' })`, sem chamar o agente.
6. Regenerar o bloco: `node plugins/productivity-tools/scripts/embed.mjs plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js`; conferir com `... embed.mjs --check <mesmo arquivo>` (esperado: exit 0, sem `stale:`).
7. Ler `workflowChars` contra `MAX_COORDINATOR_CHARS = 120000` (`size.test.mjs`); se o acréscimo estourar, parar e reportar (não subir o teto sem o dono).

Verificação (worktree, só os arquivos): `node --test plugins/productivity-tools/skills/plan-coordinator/workflow/gate.test.mjs plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs` e `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` → testes passam, embed sem `stale`. `size.test.mjs` e `flow.test.mjs` rodam só no G1 da release.

Commit: `fix(plan-coordinator): cap gate question, failed names, tail and runCmd size`

### T-A2. Página 0 contada no `read` (P2, parte 2) — branch `plugins`, depois de T-A1, plugins/: sim, revisor opus

Arquivos (2): `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.mjs`, `plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`.

Testes primeiro:
- `page 0 may leave empty when the state alone fills it`: 1 passo de ~19.000 caracteres e estado-base de ~8.000: `readPages(steps, 8000)` devolve `pages[0] === []` e o passo na página 1 (a guarda atual `pages[last].length > 0` poria o passo na página 0; é o que o teste cobre); `readSigned` aceita uma página 0 só com estado.
- `page 0 output stays under READ_PAGE_CHARS`: `read` página 0 em JSON compacto, com estado-base grande, sai abaixo de `READ_PAGE_CHARS` mais a margem do cabeçalho assinado.
- `readPages without baseSize is unchanged`: as páginas > 0 não carregam o estado.

Passos:
1. `progress.mjs:87-98`: `readPages(steps, baseSize = 0)`: `size = baseSize` só para a primeira página; quando `baseSize + n > READ_PAGE_CHARS` com a página 0 ainda sem passos, ela fica vazia (só estado) e o passo abre a página 1; nas demais a guarda `length > 0` continua.
2. `progress.mjs:386-389`: `baseSize = JSON.stringify({ ...head, pages: 99, state: { ...state, history: [], steps: [] } }).length + 200` com head provisório (`pages: 99` cobre o campo ainda desconhecido) e margem de 200; `pages = readPages(state.steps, baseSize)`, e só depois o `head` real.

Verificação: `node --test plugins/productivity-tools/skills/plan-coordinator/scripts/progress.test.mjs`.

Commit: `fix(plan-coordinator): count page 0 state size when paging read output`

### T-B. N5-1 e N5-2 no plan-writer e plan-author (P3) — branch `plugins`, depois de T-A2, plugins/: sim, revisor opus

Arquivos (3): `plugins/productivity-tools/skills/plan-writer/SKILL.md`, `plugins/productivity-tools/agents/plan-author.md`, `plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs` (novo).

`SKILL.md` e `plan-author.md` são escritos em inglês: os testes fixam as frases em inglês. Antes de editar, ler `plugins/productivity-tools/scripts/independence.test.mjs:203-270` (asserts já existentes sobre o texto da adoção e do autor): continuam valendo e **esse arquivo roda na verificação**.

Testes primeiro (`adoption-text.test.mjs`, leitura com `\r\n` para `\n`):
- `plan-writer step 3 pastes the approval blocks literally`: o passo 3 da adoção contém `paste` e `literally` para a seção `## Adoção`, o `--stat` e a saída de `summary`, e `do not summarize`.
- `plan-writer step 3 keeps the 200-line stat rule`: contém `200`, `--stat` e o comando para ver o diff inteiro.
- `plan-author step 4 marks "added" or "derived"`: o passo 4 contém `"added" or "derived"` e `never "kept"` para valor que o plano antigo não declara (deps, score, effort, título encurtado) e a regra de que coluna do plano antigo sem campo no bloco (`Test reference`) ganha linha na tabela `## Adoção`.
- `plan-writer keeps APPROVAL QUESTION fallback`: continua contendo `APPROVAL QUESTION:`.
- (O teste de frontmatter é omitido: já existe em `independence.test.mjs:94`.)

Passos:
1. `plan-writer/SKILL.md`, adoção, passo 3 ("Then show the `## Adoção` section ... Print all of it in your own message first"): mandar colar literalmente, em ordem, `## Adoção`, o `--stat` (diff acima de 200 linhas) e a saída de `summary`, sem resumir nem parafrasear, em mensagem própria, antes do `AskUserQuestion`. Manter o resto (checagens, redespacho uma vez, fallback `APPROVAL QUESTION:`).
2. `agents/plan-author.md`, Process passo 4 (modo `adopt`): valor estrutural que o plano antigo não declara é descrito como "added" or "derived", com a origem, never "kept"; coluna sem campo no bloco ganha linha própria. Sem mudar o contrato de chamada nem `model: opus`.
3. Não tocar `plan-tool.mjs` (DEC-458); o gatilho de DEC-458 só vale se P4 falhar.

Verificação: `node --test plugins/productivity-tools/skills/plan-writer/adoption-text.test.mjs plugins/productivity-tools/scripts/independence.test.mjs` → passam. Na release, G5 (`lint-plugin.mjs`).

Commit: `fix(plan-writer): paste approval blocks literally and mark derived values (N5-1, N5-2)`

### T-C1. Código limpo nativo (P5) — branch `native`, revisor sonnet

Arquivos (1 de código + 6 de dados): `tools/measure/native-code.test.mjs` (novo); dados `tools/measure/scenario/e5-native/code/t1/{src/slugify.mjs,tests/slugify.test.mjs}`, `.../t2/{src/truncate.mjs,tests/truncate.test.mjs}`, `.../t3/{src/word-count.mjs,tests/word-count.test.mjs}`. Antes de escrever, ler `scenario/e5-native/plan.md` e `spec.md` para os nomes e a lista de arquivos exatos; se diferirem dos nomes acima, o plano nativo manda e o implementador ajusta o caminho (não o plano).

Testes primeiro (`native-code.test.mjs`):
- `native code files match the plan file list`: o conjunto de arquivos de `code/t1..t3` é exatamente o da seção de arquivos do `plan.md` nativo (nenhum a mais, nenhum a menos).
- `truncate counts code points (R2)`: `truncate('a😀b', 2)` conta pontos de código (usa `[...text]`, não `length`/`slice`), conforme `spec.md:31,78`.
- `sandbox suite is green with T1..T3` **[após o lote]**: cria o diretório com `makeSandbox` (de `make-scenario.mjs`, antes da cópia, para ter o repositório e o `package.json` do sandbox), copia `code/t1..t3` e roda `runSandboxSuite` (`make-scenario.mjs:321`); espera exit 0 e nenhum arquivo fora da lista. Skip explícito com `process.env.E11_SANDBOX_SUITE !== '1'` para o G1 não depender da porta; o `P5c` liga a variável.

Passos: escrever T1 slugify, T2 truncate (code points), T3 word-count, cada um com os testes do plano nativo (nomes dos casos copiados do plano). Nenhum `index.mjs`. Cabeçalhos de comentário mínimos.

Verificação: `node --test tools/measure/native-code.test.mjs` → os 2 primeiros passam, o terceiro `skipped`.

Commit: `feat(measure): native clean code for E5 scenario (T1..T3)`

### T-C2. Sentinelas C1..C4 portados — branch `native`, depois de T-C1

Arquivos (≤ 5, dados à parte): `tools/measure/defects/sentinels/native/C1.mjs`..`C4.mjs` (só os que a âncora legada não casa, até 3), `tools/measure/defects/native-sentinels.test.mjs` (novo); dados: `tools/measure/defects/manifest.json` (entradas C1..C4 com `set: "e5-native"` **acrescentadas no fim do arquivo, sem alterar as legadas**; ids repetidos entre o set legado e `e5-native` são separados pelo `set` em `manifestEntries`/`baseEntries`, `make-scenario.mjs:230-237`; o teste confere que as entradas legadas ficam byte a byte; `file` aponta para o arquivo de `e5-native/code`). `fix.mjs` é sentinela e não é tocado.

Primeiro, ler `defects/sentinels/C1..C4.mjs` e o código novo de T-C1: decidir, por C, se a âncora legada casa (reusa o sentinela legado: o manifest aponta `sentinels/C<n>.mjs`) ou não (sentinela novo em `sentinels/native/`). Registrar a decisão no corpo do commit.

Testes primeiro (`native-sentinels.test.mjs`, tabela `C1..C4` percorrida num `for`):
- `C<n> is absent in the clean native code`: `present(dir, 'HEAD', id)` é `false` no código limpo (copiado para repo git temporário).
- `C<n> is present after seed`: `seed(dir, id)`, commit, `present(...)` é `true`.
- `C4 extracts helpers from a T3 file without index.mjs`: o seed cria e importa o helper num arquivo de T3 e `index.mjs` não existe antes nem depois.
- `manifest entries for e5-native have set, sentinel path and a code class`: toda entrada C1..C4 tem `set: 'e5-native'`, `class: 'code'` e o `sentinel` existe.
- Usa `execFileSync('git', ...)` em diretório temporário; não roda a suíte do sandbox, então roda hoje.

Um C que não porta sem acusação por código ganha id novo (ex.: `C4n`) e a tarefa para e volta ao dono (DEC-745).

Verificação: `node --test tools/measure/defects/native-sentinels.test.mjs` → todos passam.

Commit: `feat(measure): port sentinels C1..C4 to native clean code`

### T-C3. Sentinelas C5..C8 portados — branch `native`, depois de T-C2

Mesmo desenho de T-C2 para C5..C8 (`C5` e `C3` ancoram em literais legados, conforme a spec): arquivos `defects/sentinels/native/C5..C8.mjs` (até 3), `defects/native-sentinels.test.mjs` (estende a tabela para C1..C8), dado `defects/manifest.json` (C5..C8). Testes novos: os mesmos 4 da T-C2 aplicados a C5..C8, mais `no C is accused on clean code` **[após o lote]**: para código, "acusação" é a suíte do sandbox (`runSandboxSuite`, `make-scenario.mjs:321`) ficar vermelha com o C semeado e verde no limpo; fica `skipped` sem `E11_SANDBOX_SUITE=1` (roda em P5c).

Verificação: `node --test tools/measure/defects/native-sentinels.test.mjs`.

Commit: `feat(measure): port sentinels C5..C8 to native clean code`

### T-C4. Variantes `codigo-nativo-A/B` — branch `native`, depois de T-C3

Arquivos (2): `tools/measure/make-scenario.mjs`, `tools/measure/make-scenario.test.mjs`.

Testes primeiro:
- Atualizar o teste que fixa a lista (`make-scenario.test.mjs:28-31`): hoje `VARIANTS.length === 21` e `VARIANTS[VARIANTS.length - 1] === 'correcao-semeada-B'`; passa a 23, com `codigo-nativo-A` e `codigo-nativo-B` **acrescentadas depois de `correcao-semeada-B`** (o último item vira `codigo-nativo-B`), e a lista ordenada do teste inclui as duas.
- `artifactOf('codigo-nativo-A')` é `{ class: 'code', artifact: 'A', set: 'e5-native' }` (e B).
- `taskTitles accepts "### Tarefa n:" and the data block title`: `### Tarefa 2: truncate` devolve `{2:'truncate'}`; `### Task 1: x` continua funcionando.
- `prepareNativeBranch(dir, { withPlan: true, code: true })` cria a branch com spec e plano nativos e três commits `E5 T1: <título>`, `E5 T2: ...`, `E5 T3: ...` (regex `^E5 T(\d+): `, `roadmap-release.js:2124`), sem `index.mjs`.
- `seedVariant for codigo-nativo-A applies the C1..C8 entries of set e5-native` e deixa 3 commits `E5 T<n>:` (defeitos emendados no de T3).
- `codigo-nativo-A/B are in RELEASE_RUN_VARIANTS and use NATIVE_PATHS` (exportar `RELEASE_RUN_VARIANTS`, hoje `const`).

Passos: (1) `VARIANTS` (linhas 17-23) acrescenta as duas no fim; (2) `SEEDED` (linha 204) ganha as duas entradas; (3) `taskTitles` (linha 177) com `^### (?:Task|Tarefa) (\d+): (.+?)\s*$` e fallback para o título do bloco de dados; (4) `prepareNativeBranch` (linha 141) aceita `code: true` e comita `scenario/e5-native/code/t1..t3` em três commits `E5 T<n>: <título>`; `seedVariant` (linhas 283-292) chama `prepareNativeBranch(dir, { withPlan: true, code: isCode, expect })` e, no ramo nativo, pula o `copyTree(.. 'e5','code','t3')` legado (linha 296); (5) no ramo nativo os defeitos entram como emenda no commit de T3 (`git commit --amend`), de modo que o release conta 3 tarefas; (6) `RELEASE_RUN_VARIANTS` (linha 55) inclui as duas, com `paths: { ...NATIVE_PATHS }` (linhas 352/357).

Verificação: `node --test tools/measure/make-scenario.test.mjs`.

Commit: `feat(measure): codigo-nativo-A/B variants seeded on the native branch`

### T-G. Fixture do coordinator com bloco plan/1 — branch `native`, depois de T-C4

Arquivos (2 de código + 1 dado): `tools/measure/make-scenario.mjs`, `tools/measure/make-scenario.test.mjs`; dado `tools/measure/scenario/coordinator-plan-native.md` (novo). `scenario/coordinator-plan.md` permanece byte a byte (DEC-747).

Caminho: hoje `FIXED_PLAN = 'docs/plans/2026-11-10-fixed-plan.md'` (`make-scenario.mjs:65`) e os testes `make-scenario.test.mjs:41` e `:56` o fixam. A spec cita `docs/plans/fixed-plan/plan.md`. Fica o caminho existente `FIXED_PLAN` para as duas fixtures; os testes `:41` e `:56` seguem como estão. Se `plan-tool check` exigir a pasta `docs/plans/<nome>/plan.md`, o implementador muda `FIXED_PLAN` para o caminho da spec e atualiza `:41` e `:56` no mesmo commit.

Testes primeiro:
- `coordinator-plan.md is unchanged`: sha256 igual ao do HEAD (valor fixado, lido com `git hash-object`).
- `coordinator-plan-native.md passes plan-tool check`: `node plugins/productivity-tools/scripts/plan-tool.mjs check tools/measure/scenario/coordinator-plan-native.md` sai 0 (`execFileSync`; script puro).
- `native fixture has the same 3 steps` (mesmos títulos de passo).
- `makeScenario(dir, 'coordinator', { coordinatorFixture: 'native' })` grava a fixture nova em `FIXED_PLAN`; `'legacy'` grava a antiga; o prompt segue `/productivity-tools:plan-coordinator <FIXED_PLAN>`.

Passos: (1) ler `coordinator-plan.md` e o formato `plan/1`; escrever a fixture com bloco de dados e os mesmos 3 passos; (2) a assinatura real é `makeScenario(dir, variant, opts)` (linha 334): ler `opts.coordinatorFixture` (`'native'` padrão, `'legacy'`) em `case 'coordinator'` (linhas 379-383) e registrar `scenario.fixture`. O repasse vindo da linha de comando é de T-D (`--coordinator-fixture`).

Verificação: `node --test tools/measure/make-scenario.test.mjs`.

Commit: `feat(measure): plan/1 fixture for the coordinator variant (legacy fixture kept)`

### T-D. `--ratify between|off` e `--coordinator-fixture` — branch `batch`, revisor sonnet

Arquivos (2): `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

Testes primeiro:
- `parseCli accepts --ratify between|off, default between`; `--ratify x` → `UsageError`.
- `parseCli accepts --coordinator-fixture native|legacy` (padrão `native`); outro valor → `UsageError`; o valor chega a `makeScenario(dir, variant, { fromRun, coordinatorFixture })` (a chamada está em `run-batch.mjs:1745` e hoje só passa `{ fromRun }`; um stub de `makeScenario` confere a opção).
- `with --ratify off the ratify function is not called between sessions` (injeção `ratify`, linha 1696): 0 chamadas; a tentativa grava `pendingAtResume`.
- `a resume that stops for a pending decision is parou-por-decisao`: sinal de parada = retomada válida (`resumeRunValidity`) com `e5Integrated(sandbox)` falso (linha 1286) e decisões de E5 pendentes depois dela; resultado `stoppedBy = 'parou-por-decisao'`, tentativa inválida, variante encerrada (`batchStopReason`, linha 642).
- `with between (default) behavior is unchanged`.

Passos: (1) extrair de `ratifyE5Contract` (linha 1391) a leitura `pendingE5(sandbox, installPath)` (a chamada `roadmap.mjs pending-decisions` que ele já usa, via `exec`), reutilizada por `pendingAtResume` e pela detecção da parada; (2) `parseCli` (linha 2017) e `USAGE` (linha 2015) ganham `[--ratify between|off] [--coordinator-fixture native|legacy]`; (3) no laço de sessões (linha ~1785), no ramo `!h`: com `opts.ratify === 'off'`, pular `ratify(...)`, gravar `pendingAtResume = pendingE5(...)` e seguir com `resumeFrom`; após a retomada, se `!e5Integrated(sandbox) && pendingE5(...).length > 0`, `stoppedBy = 'parou-por-decisao'; break`; (4) `attempt.ratify: 'off'` registrado e `ratified: []`.

Verificação: `node --test tools/measure/run-batch.test.mjs` (usa `exec` injetado, sem `claude`).

Commit: `feat(measure): --ratify off, parou-por-decisao and --coordinator-fixture in run-batch`

### T-H. Contadores da peça 3 por tentativa (P10) — branch `batch`, depois de T-D

Arquivos (4): `tools/measure/session-metrics.mjs`, `tools/measure/session-metrics.test.mjs`, `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

Rótulos reais do release (`roadmap-release.js:2610` e `:2746`): correção por tarefa `E5:t<n>:<kind>-fix<k>` (kind `spec` ou `quality`) e do gate `E5:<tag>gates-fix<k>`; o gate tem também `gates-fix<k>-review`, que **não** conta como correção. Depois de `normalizeLabel` (`session-metrics.mjs:173`) as regex são `^t(\d+):(spec|quality)-fix\d+$` e `gates-fix\d+$`.

Testes primeiro (transcrições sintéticas):
- `piece3Of counts taskFixByTask`: rótulos `t1:spec-fix1`, `t1:quality-fix1`, `t3:spec-fix1` → `{1:2, 3:1}`.
- `piece3Of counts gateFix only for gates-fix<k>`: `gates-fix1`, `gates-fix2` contam 2; `gates-fix1-review` não conta.
- `piece3Of reads planAuthorModel`: modelo do agente `<E>:plan`, família dominante pelo `message.model` das mensagens do agente; sem esse agente, `null`; sem rótulos, zeros.
- `attempt.piece3` existe em tentativa válida de `completo`.
- `rolesByLabel` (linha 207) continua igual (o papel `gates` que junta gate e gate-fix não muda).

Passos: (1) `session-metrics.mjs`: o acréscimo por agente em `r.agents` (por rótulo normalizado: `{ calls, model }`, modelo pela família dominante de `message.model`) é **obrigatório** em `extract` (linha 270), pois hoje só `r.roles` guarda agregado; (2) `piece3Of(run)` junto de `classifyRole` (linha 207) com as regex acima; (3) `run-batch.mjs:1953`: `attempt` ganha `piece3: piece3Of(run)`; `toAttemptCounters` não muda.

Verificação: `node --test tools/measure/session-metrics.test.mjs tools/measure/run-batch.test.mjs`.

Commit: `feat(measure): piece-3 counters per attempt (task fixes, gate-fix, plan author model)`

### T-E. `baseline.mjs` para E11 (P7) — branch `baseline`

Arquivos (2): `tools/measure/baseline.mjs`, `tools/measure/baseline.test.mjs`.

Testes primeiro:
- `--plan e11 filters and checks completeness with E11_PLAN`: `main(['--plan','e11', ...])` com agregados sintéticos considera `incomplete` pela lista de E11 (inclui `plano-nativo-A/B`, `codigo-nativo-A/B`; exclui `plano-semeado-*`/`codigo-semeado-*`); sem `--plan` ou `--plan e17`, o comportamento atual (BASELINE_PLAN) é idêntico.
- `CLASS_OF maps plano-nativo-* to plano-semeado and codigo-nativo-* to codigo-semeado`.
- `isPlanVariant matches plano-nativo-A/B too` (hoje `/^plano-semeado-[AB]$/`, linha 25).
- `superpowers is recorded per variant and divergence needs --accept-superpowers DEC-xxx`: dois agregados com superpowers distintos → erro de coerência (hoje, linha 147) a menos que `--accept-superpowers DEC-747`, que fica gravado no agregado como `acceptedSuperpowers`.

Passos: (1) `baseline.mjs:11` importar `E11_PLAN` de `run-baseline.mjs` **depois** de T-F; como T-E vem antes, o plano de E11 é aqui uma constante local `E11_VARIANTS` (nomes e `runs`), e T-F reexporta o mesmo conteúdo com teste de igualdade em `run-baseline.test.mjs` (afirma `E11_PLAN` ≡ `E11_VARIANTS`); (2) `parseArgs` (linha 393) aceita `--plan` e `--accept-superpowers`; (3) trocar os usos de `BASELINE_PLAN` nas linhas 285, 310, 327, 347, 350, 353 por `planOf(opts)`; (4) `isPlanVariant` com `/^plano-(semeado|nativo)-[AB]$/`; (5) `CLASS_OF` mapeia as classes; (6) `coherenceErrors` (linha 147): superpowers por variante registrado em `variants[v].superpowers`, divergência aceita só com a flag.

Verificação: `node --test tools/measure/baseline.test.mjs`.

Commit: `feat(measure): baseline --plan e11, native classes and per-variant superpowers`

### T-F. `run-baseline.mjs` e `checkpoint.mjs` (P8) — branch `baseline`, depois de T-E e do merge direto de `native` e `batch` (seção 1)

Arquivos (4): `tools/measure/run-baseline.mjs`, `tools/measure/run-baseline.test.mjs`, `tools/measure/checkpoint.mjs`, `tools/measure/checkpoint.test.mjs`.

Testes primeiro:
- `E11_PLAN has the spec list`: planner 1, tracker 1, plan-only 5, coordinator 5 (M), coordinator 5 com `side: '1.7.0'` e `out` próprio, completo 3, parada-retomada 3 com `ratify: 'off'`, `plano-nativo-A/B` 5+5 (`stage: 'plan-review'`, `arm: 'atual'`, rodada única), `codigo-nativo-A/B` 5+5; e `E11_PLAN` ≡ `E11_VARIANTS` de `baseline.mjs` (T-E).
- `E11_PLAN carries maxBudgetUsd per entry (DEC-749)`: pipeline (completo, parada-retomada, codigo-nativo) 10; plan-only 5; arnês (plano-nativo) e coordinator 3; o `--dry-run` imprime `--max-budget-usd` com o valor de cada entrada.
- `--plan e11 --dry-run`: um comando por entrada, `--plugin-dir <M>` em cada um, `--ratify off` só na parada-retomada, `--coordinator-fixture` repassado, e o coordinator 1.7.0 com `--plugin-dir <pasta 1.7.0>` (de `--plugin-dir-before`) e `--out` próprio.
- `with --plugin-dir the commit is read from the folder`: `readPluginDir(pluginDir).commit` contra `--tag M` (hoje as linhas 109-113 leem `readPlugin(opts.configDir)` e saem 2); sem `--plugin-dir`, caminho antigo.
- `--plugin-dir-before commit is checked against e38cb35`: commit diferente → exit 2 antes de qualquer execução; plano com coordinator 1.7.0 sem `--plugin-dir-before` → exit 2 com mensagem de uso.
- `existingValid(entry.out) counts the valid attempts of the 1.7.0 side`: a reposição conta o `--out` próprio do lado 1.7.0, não o de M.
- `retries versus needsFromRun`: `isSeeded` (linha 35, `variant.includes('semeado')`) deixa `codigo-nativo-*` e `plano-nativo-*` sem reposição de inválida e sem a regra de DEC-745. Separar `retries = /semeado|nativo/` (reposição até `MAX_EXTRA`) de `needsFromRun = /semeado/` (a pré-conferência da semeadura por `--from-run`, só para estas). Teste: inválida de `codigo-nativo-A` é reposta; `--from-run` não é exigido nem conferido para variantes nativas.
- `native code class stops after more than 5 invalid attempts (DEC-745)`: 3 inválidas de `codigo-nativo-A` e 3 de `-B` (soma 6 > 5) → o lote para com mensagem citando DEC-745; 5 no total, não.
- `checkpoint --deliverable E11 writes E11 in measurement rows` (padrão `E17`, linha 116).
- `checkpoint --before-coordinator <baseline.json>`: a entrada é o `baseline.json` gerado por `baseline.mjs --plan e11` sobre o `--out` do lado 1.7.0 (o checkpoint lê `baseline.json`, não o diretório); ele troca o lado "antes" da variante coordinator e o relatório registra "Troca de lado: coordinator = <caminho>".

Passos: (1) `run-baseline.mjs:17-28` mantém `BASELINE_PLAN` e acrescenta `export const E11_PLAN` com `maxBudgetUsd` por entrada; (2) `parseCli` (linha 206) e `USAGE` (linha 204): `--plan e11`, `--plugin-dir`, `--plugin-dir-before`, `--coordinator-fixture`; (3) linhas 109-113: com `pluginDir`, commit pela pasta; conferir `pluginDirBefore` contra `e38cb35`; (4) `retries`/`needsFromRun` e o teto de 5 inválidas somando `codigo-nativo-A` e `-B`; (5) `runBatch({ ..., pluginDir, ratify, coordinatorFixture, maxBudgetUsd })` na linha 172; o lado 1.7.0 usa `pluginDirBefore`, `out` próprio e `existingValid(entry.out, ...)`; (6) `checkpoint.mjs`: `known` (linha 185) ganha `--deliverable` e `--before-coordinator`; `rowsFor` (linha 116) usa o entregável; `markdown` registra a troca. Nada chama `makeScenario` aqui: o repasse de fixture é a flag `--coordinator-fixture` de T-D.

Verificação: `node --test tools/measure/run-baseline.test.mjs tools/measure/checkpoint.test.mjs`. Dry-run real só depois de P11 e fora do lote ativo: `node tools/measure/run-baseline.mjs --plan e11 --dry-run ...`.

Commit: `feat(measure): E11 baseline plan, budgets, --plugin-dir commit check and checkpoint --deliverable`

### T-I. Commit de versão M — branch `version`, plugins/: sim, revisor opus

Arquivos (4): `plugins/productivity-tools/.claude-plugin/plugin.json`, `plugins/marketplace-tools/.claude-plugin/plugin.json`, `README.md` (linhas 26 e 29) e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs` (linha 3734: `assert.equal(p.version, '1.7.0')` passa a `'2.0.0'`).

Pré-condições (conferir antes de editar): as quatro branches anteriores e P4 integrados na release; G1 a G5 verdes na ponta; `git diff e38cb35..HEAD -- plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs` vazio (a linha 1 do checker não muda, DEC-028).

Teste antes: o `lint-plugin.mjs` (testes do lint em torno das linhas 516-530 do `lint-plugin.test.mjs`): com só o `plugin.json` editado, `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` falha por divergência com o README; e `flow.test.mjs:3734` falha com `plugin.json` em 2.0.0 até o assert ser atualizado (o arquivo é grande: roda no G1 da release). `independence.test.mjs` não é o teste antes.

Passos: `plugin.json` de productivity-tools `1.7.0` → `2.0.0`; de marketplace-tools `1.2.0` → `1.3.0`; `README.md:26` → `2.0.0`; `README.md:29` → `1.3.0`; `flow.test.mjs:3734` → `'2.0.0'`. `marketplace.json` não leva versão. Nenhum outro arquivo.

Verificação (G1 a G5 em M, P14, entre lotes, na release, depois do `--ff-only`):
- G1 `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` → 0 falhas, acima de 1990 testes.
- G2 `claude plugin validate .` → passa.
- G3 `claude plugin validate plugins/productivity-tools` → passa (e `plugins/marketplace-tools`).
- G4 `node plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-tracker/scripts/fixtures/valid` → exit 0.
- G5 `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` e o mesmo com `plugins/marketplace-tools` → sem FAIL.

Identidade de M (DEC-744): `version` entra com `git merge --ff-only`; M é o commit de T-I e a ponta da release; a worktree destacada do lote nasce em M. O lote só roda com `git diff --quiet M..HEAD -- plugins/` (exit 0). Fix só do arnês depois de M vale; fix do produto gera novo M, G1-G5 e sondas.

Commit: `chore(plugins): bump productivity-tools to 2.0.0 and marketplace-tools to 1.3.0`

## 3. Gates por branch e portão final

- Revisão por tarefa (spec): opus em T-A1, T-A2, T-B, T-I; sonnet nas demais.
- Portão final opus/high (revisão adversarial da branch inteira) em cada branch antes do merge; o de `plugins` e o de `version` conferem também o raio de identidade (`git diff` só nos arquivos da lista).
- G1 a G5 depois de cada merge na release; falha em G1 reverte o merge (`git revert -m 1`) e volta ao implementador.

## 4. Itens fora das tarefas, na ordem da seção 7 da spec

P1 (ratificação) e a atualização do painel de E11 são do tracker e do dono, não deste plano. P11 (superpowers 7.0.0 `bb92a77` fixado, atualização desligada, caminhos de M e `--work` com comprimento >= ao de E15) e P12 (cópia sonnet de `plan-author.md`, só se o braço opus sair do piso) seguem a spec.

## 5. Conferências e sondas

**P5c (sem custo, logo depois do merge de `native`, entre lotes):** `E11_SANDBOX_SUITE=1 node --test tools/measure/native-code.test.mjs tools/measure/defects/native-sentinels.test.mjs`; suíte verde no limpo; cada C presente após a semeadura e ausente no limpo; nenhuma acusação por código; assuntos `E5 T<n>:` contados pelo regex do release. Falha: gatilho de DEC-745 (id novo e volta ao dono).

**P4 (paga, até US$ 10, depois do merge de `plugins`, antes de T-I):** 1 `claude -p` até `APPROVAL QUESTION` na adoção (confere o texto colado literalmente e a ausência de "mantido" para valor derivado), 1 recusa (provisório apagado, original intacto), a adoção com o spec do card, e a cadeia spec-writer → plan-writer com `check --roadmap` 0. Falha: gatilho de DEC-458 (impressão da aprovação vira saída de ferramenta; muda os bytes do plugin, DEC-702), antes de M.

**P15, sondas (pagas, 1 execução cada, mesmo M, arnês e config contam como 1ª tentativa, DEC-749; depois de P11):**
1. `codigo-nativo-A` (inválida 2 vezes por causa do pipeline: parar, DEC-745).
2. `parada-retomada` com `--ratify off` (1ª `parou-por-decisao`: bloqueio em E8 e volta ao dono; 1ª sessão que deixa de parar em E5 T1: gatilho de DEC-565).
3. `coordinator` em M e em 1.7.0 com a fixture nova (a de 1.7.0 decide a fixture, DEC-747; é evidência do critério 6 do card). Lado 1.7.0 que não completa os 3 passos nem com a fixture antiga: volta ao dono.
4. `completo` por `--plugin-dir`: conferir nas transcrições que os scripts vêm da pasta de M, não do cache 1.7.0 (gatilho de DEC-744).
Defeito do arnês: corrige-se no arnês e repete (M vale). Defeito do produto: novo M. Teto do lote com sondas: US$ 120; projeção acima disso depois das sondas, parar e voltar ao dono (DEC-749).

**P16, proposta de bytes (decisão do dono, sem rodar nada, entre as sondas e o lote):** com os números medidos nas sondas (bytes por variante: plan-only, completo, coordinator em M e 1.7.0), montar uma tabela `variante | bytes E15 | bytes E17 | bytes sondas | proposta de teto | haiku liberado?` (subida conhecida: plan-only 1 em E15, 3 em E17, 8 a 11 nas sondas de E8; completo 7 para 13; tolerância de caminho 3%, DEC-033). Haiku liberado de antemão só onde ponderado, sonnet e opus não sobem na mediana (DEC-750); onde subirem, a variante volta ao dono. O dono (via Fable, regra do projeto) decide antes de `run-baseline --plan e11 --dry-run` e do lote. Nada disto grava arquivo nem roda `claude -p`; o resultado entra em `decisions.md` pelo tracker.
