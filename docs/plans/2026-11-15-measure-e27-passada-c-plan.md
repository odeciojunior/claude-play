# E27, passada C (peça 2): plano de implementação do arnês

**Roadmap:** docs/plans/roadmap-evolucao-skills
**Spec:** docs/plans/2026-11-15-measure-e27-passada-c-design.md (revisão 2, com as emendas do dono de 2026-11-15 aplicadas; escolhas aceitas e emendadas na seção "Emendas do dono (2026-11-15)" de lá). Branch `feat/e27-passada-c`, worktree `D:/projects/claude-play-wt/e27c`, base `336b7f8` (`release/roadmap-skills-v2`).

Formato das tarefas: o de `2026-11-15-measure-e26-bloco-b-plan.md`.

## Regras do bloco

- Só `tools/measure/`. Nunca editar `plugins/` (só leitura: `roadmap-release.js`, `agents/task-reviewer.md`). Sem bump, sem `claude -p`, sem lote pago.
- 4 arquivos fora os testes no bloco inteiro: `run-batch.mjs`, `make-scenario.mjs`, `defects/manifest.json`, `defects/sentinels/lentes.mjs` (novo). Um 5º arquivo fora os testes, ou tarefa com mais de 4 arquivos: parar e perguntar. Sem módulo novo, sem fixture em arquivo (hashes e fixtures inline nos `*.test.mjs`).
- Testes do bloco: `run-batch.test.mjs`, `review-loop.test.mjs`, `make-scenario.test.mjs`.
- TDD: em cada tarefa, escrever os testes, vê-los falhar pelo motivo certo, implementar, vê-los passar. Um commit por tarefa (teste e código juntos), salvo a T1, que é só teste.
- O que já existe para `codigo-semeado-*` (rodada única) e `correcao-semeada-*` (laço, braços `atual|restrita`) gera o mesmo script e o mesmo agregado de hoje: os goldens da T1 conferem.
- Commits no formato `fix(measure): ...` ou `test(measure): ...`, terminando com a linha de atribuição da sessão.

## Tier e revisão

| Tarefa | Implementador | Revisor da tarefa |
|---|---|---|
| T1 | sonnet/medium | sonnet |
| T2 | sonnet/medium | opus |
| T3 | sonnet/medium | sonnet |
| T4 | sonnet/medium | opus |
| T5 | sonnet/medium | opus |
| T6 | sonnet/medium | opus |
| Portão final da branch | - | opus/high (revisão adversarial) |

Escalonamento: falhou, repete uma vez no mesmo tier com o feedback do revisor; 2ª falha sobe a opus com agent novo; falha em opus, parar e avisar o dono.

## Comandos de verificação

- Teste focado: `node --test tools/measure/<arquivo>.test.mjs` (da raiz da worktree).
- G1 completo: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`. Medir a linha de base na própria worktree antes da T1 (total, 0 falhas) e anotá-la no relatório da T1; depois de cada tarefa o total só cresce e `fail` fica 0. Nunca rodar G1 junto de um lote pago ou de um release (porta 48731).
- `claude plugin validate .` (deve passar; nada em `plugins/` muda, então nenhum `claude plugin validate plugins/<x>`).
- Guarda de escopo, antes de cada commit e no portão: `git diff --name-only 336b7f8..HEAD` só lista `tools/measure/` e os dois documentos desta passada; a lista fora `*.test.mjs` é subconjunto dos 4 arquivos acima.

## Ordem e paralelismo

| Tarefa | Arquivos |
|---|---|
| T1 | `run-batch.test.mjs`, `review-loop.test.mjs` |
| T2 | `make-scenario.mjs`, `defects/manifest.json`, `defects/sentinels/lentes.mjs`, `make-scenario.test.mjs` |
| T3 | `run-batch.mjs`, `run-batch.test.mjs` |
| T4 | `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs` |
| T5 | `run-batch.mjs`, `run-batch.test.mjs` |
| T6 | `run-batch.mjs`, `run-batch.test.mjs` |

Dependências: T3 depende de T2 (as variantes existem); T4 de T1 e T3; T5 de T4; T6 de T5.

Ondas:
1. **Onda 1 em paralelo: T1 e T2.** Nenhum arquivo em comum.
2. **Série: T3, T4, T5, T6.** Todas editam `run-batch.mjs` e `run-batch.test.mjs`.
3. Portão final (opus/high) sobre a branch inteira, depois do G1 verde.

## Ambiguidades da spec resolvidas aqui

1. **Nome do braço.** `unica`, sem acento (como `restrita`): o nome entra no diretório de saída e passa por `/^[A-Za-z0-9_-]+$/` em `prepareHarness`.
2. **Rótulos novos só nas variantes novas.** `correcao-semeada-*` segue com `E5:task-review<r>`; `lentes-semeadas-*` usa `E5:t3:<kind><r>` e `E5:t3:<kind>-fix<k>`. `h.st.label` deixa de bastar para o ramo novo: o replay e a validade recebem a lista de prefixos por `kind` (`labelsFor(h)`), e `stageLabels` em `loopResult` passa a filtrar por qualquer prefixo dessa lista.
3. **`rolesByLabel`.** `E5:t3:spec1` e `E5:t3:quality1` não contêm `review` e cairiam em `other`. Regra nova antes do teste de `review`: rótulo que casa `/^E5:t3:(spec|quality|review)\d/` vai a `review`; `-fix` continua indo a `fix` primeiro.
4. **Texto do corretor por `kind`.** `harnessPrompts` monta hoje `fix the spec problems below`. No ramo novo, o `fixPrompt` leva `{{kind}}` no lugar de `spec`, e o script preenche por laço; o ramo de `correcao-semeada-*` e o da rodada única ficam com o texto de hoje (goldens).
5. **Retorno do script.** Lido do `tool_result` do `Workflow` como em B (`readScriptResult`); o ramo novo devolve `loops: [{ kind, ok, stop, accepted }]` e a validade compara laço a laço.
6. **Achado sintético no replay.** O replay usa `h.loopFns.taskIssues` (bloco puro do workflow medido) com `cx.taskReview.single`; o arnês não copia nem reimplementa o texto do sintético. Para reconhecê-lo (`bloqueou-sintetico`, `sinteticoGerado`), compara com o achado que o próprio `taskIssues` medido acrescenta a `{ issues: [] }` com `single` ligado e sem veredictos (chamada pura na partida, guardada em `h.syntheticDescription`).
7. **`semente-ausente` sem `fixSha`.** Confere `present(dir, seededCommit, id)` para cada SP/QL do artefato antes da 1ª revisão, no `runBatch`, e grava o motivo na tentativa; não reusa `loopValidity` de B.

---

## T1. Goldens congelados (revisor sonnet; onda 1)

**Arquivos (2):** `tools/measure/run-batch.test.mjs`, `tools/measure/review-loop.test.mjs`.

**Testes** (só teste, antes de qualquer edição de `run-batch.mjs`; o golden B2 da rodada única de `codigo-semeado-A`, `run-batch.test.mjs` linha ~2356, já existe e não muda):
1. `C2: the task loop script of correcao-semeada-A, arm atual, is frozen (golden)`. Monta o `scenario` fixo (`dir` fixo, `seededCommit` de 40 `a`, `fixSha` de 40 `b`), `pure` de uma fixture inline pequena (o golden não depende do workflow real), `opts` fixos (`restricted: false`, `reviewModel: 'sonnet'`, `pluginRoot`, `work`, `title: 'wordCount and the index'`, `fixPrompt` igual ao de `harnessPrompts`), chama `buildTaskLoopScript` e afirma o sha256 inline do texto (LF).
2. Idem para o braço `restrita` (`restricted: true`).
3. A conferência do agregado de `correcao-semeada-*` fica na T5 (teste 14): `loopAggregate` não é exportada, e a T1 não edita código.

**Verificação:** `node --test tools/measure/run-batch.test.mjs tools/measure/review-loop.test.mjs` passa sem mudança de código (os hashes são medidos no código de hoje). G1 e linha de base anotadas.

**Commit:** `test(measure): goldens do laço de task-review antes da passada C`.

---

## T2. C1: sementes de spec e de quality (revisor opus; onda 1)

**Arquivos (4):** `tools/measure/make-scenario.mjs`, `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/lentes.mjs` (novo), `tools/measure/make-scenario.test.mjs`.

**Testes primeiro** (`make-scenario.test.mjs`, seção `C1:`, no molde dos testes de `codigo-semeado-*` e de B1):
1. `C1: VARIANTS, RELEASE_RUN_VARIANTS and SEEDED list lentes-semeadas-A and -B (class code, set e5-lentes)`; `manifestEntries` devolve SP1, SP2, QL1, QL2 (A) e SP3, SP4, QL3, QL4 (B), ou os ids que os trocarem; as variantes antigas devolvem o mesmo de hoje.
2. `C1: feat/E5 stays at seededCommit and the seeded diff touches only the three files of Task 3` (`git diff --name-only <seededCommit>~1 <seededCommit>` é subconjunto de `src/word-count.mjs`, `src/index.mjs`, `tests/e5-word-count.test.mjs`).
3. `C1: the sandbox suite passes at seededCommit` (`runSandboxSuite(dir).ok === true`).
4. `C1: present is true at seededCommit and false at the clean T3 for every SP and QL`.
5. `C1: present is behavioural for SP1 to SP4 and QL1 to QL3, textual only for QL4`: com a âncora reescrita sem mudar o comportamento (outros nomes de variável, outra formatação), o `present` comportamental continua verdadeiro; com o comportamento desfeito e o texto parecido, continua falso. A lista de ids com `presentBy: 'text'` no manifesto é igual a `['QL4']` (ou o id que o trocar).
6. `C1: each artifact has 2 entries with lens spec and 2 with lens quality, all with detectedBy reviewer and sentinel sentinels/lentes.mjs`.
7. `C1: each artifact has at most 2 seeds per file and touches index, word-count and the test` (contagem por `file` no manifesto e pelo diff do `seededCommit`; A e B: index 1, word-count 2, teste 1).
8. `C1: each mention matches at least 3 paraphrases of its seed and none of the paraphrases of the other three of its artifact` (paráfrases inline no teste, 3 ou mais por id, pelo menos uma no vocabulário da lente spec, como "the index does not re-export wordCount as the spec says", e uma no da lente quality, como "the module-level regex with the g flag keeps lastIndex between calls"; nenhuma é cópia da `description` do manifesto).
9. `C1: a seed whose anchor the suite flags or present cannot tell is refused with a scenario error` (suíte e sentinela injetados, como B1 teste 7).
10. `C1: legacy variants are unchanged` (árvore do `seededCommit` de `codigo-semeado-A` e de `correcao-semeada-A` igual ao hash inline medido antes de editar).
11. `C1: QL1 leaks lastIndex, QL2 fails outside the repository root and QL3 is quadratic`, para a âncora não perder o defeito numa reescrita: `probe` sobre o arquivo semeado, `wordCount('ab')` seguido de `wordCount('x')` dá 0 (QL1); `node --test <caminho absoluto de tests/e5-word-count.test.mjs>` com `cwd` em `tests/` falha no `seededCommit` e passa na T3 limpa, e o mesmo comando da raiz passa nos dois (QL2); `wordCount('a' + ' '.repeat(60000) + 'b')` passa de 200 ms no semeado e fica abaixo de 20 ms no limpo (QL3; conferido em Node 22.17: ≈ 760 ms contra < 1 ms).
12. `C1: quality seeds keep the algorithm of Step 3 and add no test`: no `seededCommit` de cada artefato, o arquivo de teste tem os mesmos dois `test(` da T3 limpa; QL1 (módulo novo por chamada) e QL3 dão os mesmos resultados do limpo em `'the quick fox'`, `''`, `'   '` e `' a  b '`; o `word-count.mjs` semeado ainda faz trim, devolve 0 para branco e divide em `/\s+/`.

**Implementação:**
1. `defects/sentinels/lentes.mjs`: esqueleto de `sentinels/fix.mjs` (`atRef`, `probe`, `lf`, `git`, `fail`, `replaceOnce`); exporta `seed(dir, id)` e `present(dir, ref = 'HEAD', id)` com tabela dos oito ids (`file`, `apply(text)`, `present(dir)`). Âncoras candidatas da spec (C1), com a regra de troca de DEC-724 (id novo com `replaces`, listado no relatório da tarefa); a troca respeita o limite de 2 sementes por arquivo por artefato e a classe (quality sem teste a mais e sem mudar o algoritmo do Step 3). SP2 e QL1 (A) e SP4 e QL3 (B) compõem sobre `src/word-count.mjs`: o `apply` de cada um parte do texto já semeado pelos anteriores do artefato, na ordem do manifesto. `present` por comportamento: `probe` (o de `fix.mjs`) em SP1 a SP4, QL1 e QL3 (QL3 com limiar de 200 ms sobre `'a' + ' '.repeat(60000) + 'b'`); para QL2, `runTest(dir, cwd)` roda `node --test` sobre o caminho absoluto do teste com `cwd` em `tests/` e devolve se falhou; marca textual só em QL4.
2. `manifest.json`: 8 entradas (`id`, `class: 'code'`, `set: 'e5-lentes'`, `lens`, `kind`, `artifact`, `file`, `sentinel: 'sentinels/lentes.mjs'`, `detectedBy: 'reviewer'`, `presentBy: 'behaviour'|'text'`, `mention`, `description`). O `mention` de cada id é escrito para casar as paráfrases do teste 8 (as duas lentes), não só a `description`. Entradas existentes intactas.
3. `make-scenario.mjs`: `VARIANTS` e `RELEASE_RUN_VARIANTS` ganham as duas; `SEEDED['lentes-semeadas-A'|'-B'] = { class: 'code', artifact, set: 'e5-lentes' }`; o `case` de `makeScenario` copia o de `codigo-semeado-*` (`seedVariant`, prompt `run E5`). Nenhuma mudança no caminho de `codigo-semeado-*` e `correcao-semeada-*`.

**Verificação:** `node --test tools/measure/make-scenario.test.mjs` (antigos e 12 novos passam). G1 e `claude plugin validate .`.

**Commit:** `fix(measure): sementes de spec e de quality na tarefa 3 (lentes-semeadas-A/B)`.

---

## T3. C2: opções, braços e recusas (revisor sonnet)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`, seção `C2:`; todos saem com `UsageError` antes de qualquer `claude`):
1. `C2: --stage task-review --rounds loop accepts lentes-semeadas-A/B with --arm atual|unica and a --review-model`. Afirma `h.base === 'atual'`, `h.harness.taskReview` igual a `{ restricted: false, single: false }` (atual) e `{ restricted: false, single: true }` (unica), e `h.kinds` igual a `['spec', 'quality']` e `['review']`.
2. `C2: refusals`: `--arm unica` com `correcao-semeada-A`, com `--rounds single`, com `--stage spec-review`; `lentes-semeadas-A` com `--rounds single` e com `--arm restrita`; `codigo-semeado-A` com `--rounds loop` segue recusado (teste de B estreitado, não removido).
3. `C2: startup refusals on the measured workflow for lentes-semeadas`. Fixtures do workflow real, sem um literal por vez: `TR.single ? ['review'] : ['spec', 'quality']`, `single: tr.single === true`, `(c.taskReview || {}).single` dentro de `function taskIssues` do bloco puro. Afirma `UsageError` com o literal na mensagem. As mesmas fixtures com `correcao-semeada-A` não são recusadas (a regra só vale para as variantes novas).
4. `C2: a measured plugin without "## Review mode" in agents/task-reviewer.md is refused for --arm unica` (diretório de plugin temporário).
5. `C2: STAGES['task-review'].variant accepts lentes-semeadas-[AB]` e `STAGE_LOOP` de task-review continua `{ tier: 'sonnet', reviewModel, reviewEffort, maxFix: 2, byId: true }`.

**Implementação (`run-batch.mjs`):**
1. `STAGES['task-review'].variant`: `/^(codigo-semeado-[AB]|correcao-semeada-[AB]|lentes-semeadas-[AB])$/`.
2. `prepareHarness`: `const lenses = stage === 'task-review' && /^lentes-semeadas-/.test(opts.variant)`; `unica` entra na lista de braços `built-in` (`base = 'atual'`); recusas do teste 2; `rounds` padrão `loop` para `lenses`; `taskReview = { restricted: arm === 'restrita', ...(lenses ? { single: arm === 'unica' } : {}) }` (o objeto de `correcao-semeada-*` fica `{ restricted }`, como hoje, para o agregado não mudar); `h.kinds`.
3. `checkLoopWorkflow(workflowText, stage, { lenses })`: com `lenses`, as três recusas novas (`TASK_SINGLE_LITERALS`), procurando o literal de `taskIssues` só entre `function taskIssues(` e a próxima `\nfunction ` do bloco puro.
4. `runBatch`: com `--arm unica`, exige `## Review mode` em `agents/task-reviewer.md` do plugin medido (ao lado da checagem de existência do agente).
5. `USAGE`: `--arm <nome|atual|restrita|unica|adversarial>`.

**Verificação:** `node --test tools/measure/run-batch.test.mjs` (goldens da T1 intactos). G1 e `claude plugin validate .`.

**Commit:** `fix(measure): braços atual e unica de task-review nas lentes semeadas`.

---

## T4. C2: script de dois laços e da revisão única (revisor opus)

**Arquivos (3):** `tools/measure/run-batch.mjs`, `tools/measure/review-loop.test.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`review-loop.test.mjs`, com o simulador de agente do arquivo e o bloco puro do workflow real da ponta):
1. `C2: the lenses loop script carries the pure block byte for byte, compiles and stays under 200,000 characters on the real workflow` (para `atual` e `unica`).
2. `C2: atual runs the spec loop, then the quality loop, with Mode: spec. and Mode: quality.` Sequência simulada: `E5:t3:spec1` com 1 achado duro, `E5:t3:spec-fix1`, `E5:t3:spec2` limpa, `E5:t3:quality1` limpa. Afirma a ordem dos rótulos, `agentType: 'productivity-tools:task-reviewer'`, `model: 'sonnet'`, `effort: 'medium'`, e o retorno `loops` com dois itens `ok: true`.
3. `C2: when the spec loop stops, no quality label is called` (mesmo achado repetido até opus; retorno `ok: false`, `loops` com um item).
4. `C2: unica runs one loop with Mode: review. and labels E5:t3:review<r>`.
5. `C2: a unica review with quality fail and only a minor finding gets the synthetic finding and a fix` (o `taskIssues` medido acrescenta o sintético; o prompt de `E5:t3:review-fix1` contém `single review` e `fix the review problems below`).
6. `C2: fix1 is the HEAD fixer in sonnet with the kind in its text, and a BLOCKED fix stops the loop` (sem aplicador haiku; `schema` com `status`, `summary`, `checks`; `H_cur` atualizado com os checks do corretor).
7. `C2: a repeated finding escalates the fixer and the reviewer to opus` (no laço `quality` e no `review`).
- `run-batch.test.mjs`:
8. `C2: runBatch picks the lenses script for lentes-semeadas and keeps the correcao-semeada script byte for byte` (goldens da T1 passam; o script de `lentes-semeadas-A` contém `H_KINDS`).

**Implementação (`run-batch.mjs`):**
1. `buildTaskLoopScript({ pure, scenario, opts })`: com `opts.kinds` (só no ramo novo), gera `H_KINDS`, `H_TR = { restricted: false, single }`, `H_FIX` com `{{kind}}`, e o laço em série:
   `for (const kind of H_KINDS) { let cx; const r = await runReviewLoop(H_env, 'T3:' + kind, review(kind, c => cx = c), fix(kind), r => reviewTruth({ ...r, issues: taskIssues(r, cx) }, 1, H_SEEDED + '~1..HEAD'), H_OPT); loops.push({ kind, ok: r.ok, stop: r.kind || null, accepted: H_accepted.splice(0) }); if (!r.ok) break }`.
   Sem `opts.kinds`, o texto é o de hoje, linha a linha (goldens).
2. `harnessPrompts`: no ramo de `lentes-semeadas-*`, o `fixPrompt` diz `fix the {{kind}} problems below`; demais ramos intactos.
3. Seleção do script em `runBatch`: `buildTaskLoopScript` recebe `kinds: h.kinds` e `single` quando `lentes`.
4. Retorno do script: `{ ok, kind, msg, loops, reviews: H_env.reviews, accepted }`.

**Verificação:** `node --test tools/measure/review-loop.test.mjs tools/measure/run-batch.test.mjs`. G1 e `claude plugin validate .`.

**Commit:** `fix(measure): script de task-review com dois laços ou revisão única`.

---

## T5. C3: replay, validade, desfecho e contadores (revisor opus)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`, seção `C3:`, diários de fixture com `jl(...)`):
1. `C3: replay ok equals the script ok, loop by loop, in both arms` (quatro sequências por braço: limpa na 1ª; corrige e limpa; para no 1º laço; aprova o 1º e para o 2º, só `atual`).
2. `C3: laco-divergente` quando um laço replayado diverge do `loops[i].ok` do script, quando o script rodou o laço `quality` e o replay parou no `spec` (e o contrário), e com rótulo não usado ou repetido; 2 numa invocação param a invocação (`aggregate.stoppedBy`; a soma do braço é o teste 15).
3. `C3: formato-do-diario, laco-infra and semente-ausente` (este com `present` falso no `seededCommit`).
4. `C3: a first review with no hard finding is valid and the four seeds are perdido`.
5. `C3: bloqueou-sintetico only when the fixer answers BLOCKED to a fixable list with only synthetic findings`: lista só com sintético e `BLOCKED` dá inválida; a mesma lista com correção `DONE` não dá; mais de 2 numa invocação param a invocação.
6. `C3: BLOCKED with a synthetic and a real finding is bloqueadoMisto, a valid stopped attempt (indeterminado)`.
7. `C3: a loop stopped without BLOCKED with only synthetic findings open is paradoSoSintetico, a valid stopped attempt (indeterminado)` (`maxFix` esgotado com só o sintético repetido); com um achado real aberto junto não conta.
8. `C3: failRiscoAceito counts, in both arms, attempts whose loop approved with accepted risks in a round whose verdict is not pass` (`unica`: `spec` ou `quality` diferente de `pass`; `atual`: `clean === false` daquela revisão); aprovação com risco aceito e veredicto `pass` não conta.
9. `C3: sinteticoGerado and veredictoAusente counted per round in unica`.
10. `C3: capturadoPor names the first kind and round whose finding matches the mention; capturadoSemMencao as in B`.
11. `C3: capturadoPorMatriz counts captures by first mentioning loop and design class` (atual: semente de spec pega primeiro no laço `quality` cai na célula `quality × spec`; única: tudo na linha `review`; captura sem menção na coluna própria).
12. `C3: outcomesByLens splits captures, misses and determined by lens`.
13. `C3: rolesByLabel puts E5:t3:<kind><r> in review and E5:t3:<kind>-fix<k> in fix`.
14. `C3: the correcao-semeada replay and validity are unchanged` (diários de fixture de B dão o mesmo resultado de hoje; goldens da T1 intactos).
15. `C3: armTotals sums the aggregates of A and B of one arm and fires the arm stops`: inválidas, `laco-divergente`, `bloqueou-sintetico`, contadores, `outcomes`, `outcomesByLens` e custo somados; 2 + 1 `bloqueou-sintetico` dá parada (mais de 2 no braço) sem nenhuma invocação parar sozinha; 1 + 1 `laco-divergente` dá parada; 2 + 2 inválidas dá parada (mais de 3); agregados de braços diferentes (`harness.taskReview` distinto) são recusados; a ordem das tentativas válidas por artefato fica nos totais, para `earlyCeiling` (T6).

**Implementação (`run-batch.mjs`):**
1. `replayLoop`: ramo `lentes` com um `runReviewLoop` por `kind` de `h.kinds`, rótulos por `kind`, `cx = { taskReview: { restricted: false, single: h.arm === 'unica' }, was }`, parada no primeiro laço que não aprova; devolve `loops` (por laço: `ok`, `kind`, revisões, `fixTiers`, `accepted`, listas `fixable` de cada correção, para `bloqueou-sintetico`).
2. `loopResult`: com `lentes`, `stageLabels` por qualquer prefixo de `labelsFor(h)`; `ok` = todos os laços aprovaram.
3. `lensValidity(h, journal, scenario, loop, script)` nova (não toca `loopValidity` de B): motivos da spec (C3), na ordem `formato-do-diario`, `semente-ausente`, `laco-infra`, `bloqueou-sintetico`, `laco-divergente`.
4. Contadores por tentativa e no topo (`loopAggregate` com `{ lenses: true }`): `failRiscoAceito` (nos dois braços), `bloqueadoMisto`, `paradoSoSintetico`, `sinteticoGerado`, `veredictoAusente`, `capturadoPor`, `capturadoPorMatriz`, `capturadoSemMencao`, `outcomesByLens` (com perdidos), `bloqueouSintetico`, custo por tentativa válida, e, por tentativa válida, `artifact` e hora de início (ordem para `earlyCeiling`).
5. `h.syntheticDescription` (ambiguidade 6) calculado na partida a partir de `h.loopFns.taskIssues`.
6. Paradas por invocação: 2 `laco-divergente`, mais de 2 `bloqueou-sintetico`, mais de 3 inválidas, 2 `semente-ausente`. As paradas do braço (A + B somados) ficam em `export function armTotals(aggregates)`, pura, que soma os agregados e devolve `{ totals, stop: null | motivo }`; o operador a chama entre invocações (o arnês não vê a outra invocação).
7. `rolesByLabel`: regra da ambiguidade 3.

**Verificação:** `node --test tools/measure/run-batch.test.mjs`. G1 e `claude plugin validate .`.

**Commit:** `fix(measure): replay, validade e contadores da passada C`.

---

## T6. C4: regra de decisão e agregado (revisor opus)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`, seção `C4:`; totais de braço de fixture no formato de `armTotals` (T5), com `outcomes`, `outcomesByLens` (capturas, perdidos, determinadas), `capturadoSemMencao`, `failRiscoAceito`, ordem das válidas e custo):
1. `C4: ruleSideC gives teto when atual has 38 or more of 40` (a única não é olhada).
2. `C4: ruleSideC gives piso when atual has fewer than 20 of 40 or fewer than 32 determined`.
3. `C4: ruleSideC gives unica with 32+ determined, at most 2 fewer captures and at most 2 more misses in total and in each lens, and a lower cost per valid attempt` (atual 36 capturas e 2 perdidos, única 35 e 3; lentes 18/17 e 18/18 em capturas, perdidos dentro de 2 em cada; custo 0,55 contra 0,85).
4. `C4: ruleSideC gives atual` por total de capturas (36 contra 33), por lente (quality 18 contra 15 com total 36 contra 34), por custo (igual ou maior) e por determinadas da única (31).
5. `C4: ruleSideC gives atual by misses even when captures are within 2` (fixture do dono): atual 30 capturas, 2 perdidos, 8 indeterminados (lentes spec 15/1/4 e quality 15/1/4 em capturas/perdidos/indeterminados); única 28 capturas, 12 perdidos, 0 indeterminados (lentes 14/6/0 e 14/6/0), 40 determinadas, custo menor: lado `atual`, motivo `perdidos` (a única não entra).
6. `C4: ruleSideC gives atual by misses in one lens with the total within 2`: atual perdidos spec 0 e quality 2; única perdidos spec 3 e quality 1 (total 4 contra 2, dentro de 2), capturas, determinadas e custo dentro da regra: lado `atual`, motivo `perdidos por lente (spec)`.
7. `C4: ruleSideC gives inconclusivo when the recount with capturadoSemMencao, or with the failRiscoAceito attempts of either arm, as indeterminado changes the side`.
8. `C4: the diary reading prevails over the regex in the recount`: com `leitura` marcando como mencionada uma captura que o regex não casou, ela não é recontada como indeterminada (o lado não muda); com `leitura` marcando como não mencionada uma captura que o regex casou, ela é recontada (e o lado vira `inconclusivo` no caso montado); sem `leitura`, vale o regex.
9. `C4: earlyCeiling gives teto with the first 6 valid attempts of atual, 3 of A and 3 of B interleaved, at 24 of 24`; não dá com 23/24, com 6 válidas de um artefato só, com A, A, A, B, B, B (não intercaladas), nem quando a 24/24 só aparece olhando além das 6 primeiras (sem extensão); com teto antecipado, `ruleSideC` devolve `teto` sem olhar a única.
10. `C4: the aggregate of a lenses batch records harness.taskReview, kinds, outcomesByLens and the counters of C3`.

**Implementação (`run-batch.mjs`):** `export function ruleSideC({ atual, unica, leitura })` pura, sobre totais de braço (`armTotals`), devolvendo `{ side: 'teto'|'piso'|'unica'|'atual'|'inconclusivo', reason, recount }`, com os limiares da spec (C4) como constantes nomeadas no topo da função (capturas −2 e perdidos +2, no total e por lente; 32 determinadas; teto 38; piso 20); `export function earlyCeiling(atualTotals)` pura (6 primeiras válidas, 3 A + 3 B intercaladas, 24/24); `recountLenses(totals, leitura)` no molde de `recountArm`, com `leitura` (mapa tentativa × semente → mencionada ou não, preenchido pelo orquestrador ao ler o diário) prevalecendo sobre o `capturadoSemMencao` do regex. O `runBatch` não chama a regra: o relatório do orquestrador a aplica sobre os dois agregados (como `ruleSide` em B).

**Verificação:** `node --test tools/measure/run-batch.test.mjs`. G1 completo e `claude plugin validate .`.

**Commit:** `fix(measure): regra de decisão da passada C (ruleSideC)`.

---

## Portão final da branch

Revisão adversarial opus/high sobre `336b7f8..HEAD`: escopo (só `tools/measure/` e os dois documentos; 4 arquivos fora os testes), goldens intactos, replay fiel ao `runReviewLoop` medido nos dois braços, os motivos de invalidez, a regra `ruleSideC` contra a spec e as escolhas ratificadas. G1 completo verde e `claude plugin validate .` antes do merge.

## Depois do merge (operação do dono; nada aqui roda no plano)

1. Merge de `feat/e27-passada-c` em `release/roadmap-skills-v2`; a nova ponta é M_C. G1 a G5 verdes em M_C.
2. Worktree destacada: `git -C D:/projects/claude-play-wt/_integracao worktree add --detach D:/claude-e27c-release <M_C>`.
3. Ambiente: `export CLAUDE_CONFIG_DIR=D:/claude-e17-cfg`. Nenhum outro lote, G1 ou release rodando.
4. Sonda do braço atual (vale como 1ª tentativa se válida):
   `node tools/measure/run-batch.mjs --variant lentes-semeadas-A --runs 1 --work D:/claude-e27c-work/sondas/atual --out D:/claude-e27c-out/sondas --config-dir D:/claude-e17-cfg --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 --stage task-review --rounds loop --arm atual --review-model sonnet --plugin-dir D:/claude-e27c-release/plugins/productivity-tools --stop-on-denial` (rodado de `D:/claude-e27c-release`).
   Parada: custo × 10 acima de US$ 13.
5. Lote atual intercalado: o mesmo comando com `--runs 1`, `--out D:/claude-e27c-out/atual/<artefato>-<k>` e `--work D:/claude-e27c-work/atual/<artefato>-<k>` (cada invocação com seu diretório de trabalho, espelhando `--out`: o sandbox é `<work>/<variante>-<k>` e com `--runs 1` o k é sempre 1, então um work compartilhado falha com "target directory is not empty"), na ordem B, A, B, A, B depois da sonda (A), repondo cada inválida no mesmo artefato antes de seguir. Entre invocações, `armTotals` sobre os agregados do braço: uma parada do braço (A + B somados) para o lote. Depois das 6 primeiras válidas, `earlyCeiling`: 24/24 fecha o braço como teto, sem tentativa extra. Senão, as 4 restantes (2 A e 2 B), até 10 válidas.
6. Aplicar `ruleSideC` só ao atual: teto (antecipado ou 38/40) ou piso fecham a passada (única com 0 execuções); `inconclusivo` decidido só com o atual também fecha a passada e a única não roda. O teto antecipado é conferido também nos totais recontados com `leitura`: se deixar de valer (`continua`), o atual segue até 10 válidas, nunca piso a partir de 6 tentativas. Senão, sonda (`--work D:/claude-e27c-work/sondas/unica`) e lote da única com `--arm unica`, `--out D:/claude-e27c-out/unica/<artefato>-<k>`, `--work D:/claude-e27c-work/unica/<artefato>-<k>`, a mesma intercalação e `armTotals` entre invocações (parada: soma projetada acima de US$ 25); o teto antecipado não se aplica à única.
6a. Na recontagem, o orquestrador lê no diário cada captura (com e sem menção pelo regex) e preenche `leitura` para `ruleSideC` para toda captura (os regex de menção são frouxos e só auxiliares); as correções de leitura vão ao relatório. O relatório declara também a assimetria residual de `failRiscoAceito` (única aprovada com risco aceito e veredictos pass/pass não conta) e que repor tentativas `bloqueou-sintetico` inválidas tira da amostra o modo de falha próprio da única (no máximo 2 antes da parada).
7. Relatório `docs/reports/2026-11-<dd>-E27-passada-C.md` (formato do de B), linha em `measurements.md` e decisão pelo roadmap-tracker para o dono ratificar (card E27, critério 2).
