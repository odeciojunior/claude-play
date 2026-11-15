# E27, passada C (peça 2): plano de implementação do arnês

**Roadmap:** docs/plans/roadmap-evolucao-skills
**Spec:** docs/plans/2026-11-15-measure-e27-passada-c-design.md (revisão 1; as escolhas do dono listadas lá são ratificadas antes da T1). Branch `feat/e27-passada-c`, worktree `D:/projects/claude-play-wt/e27c`, base `336b7f8` (`release/roadmap-skills-v2`).

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
3. A conferência do agregado de `correcao-semeada-*` fica na T5 (teste 12): `loopAggregate` não é exportada, e a T1 não edita código.

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
5. `C1: each artifact has 2 entries with lens spec and 2 with lens quality, all with detectedBy reviewer and sentinel sentinels/lentes.mjs`.
6. `C1: each mention matches its template sentence and none of the other three of its artifact` (frases-modelo inline no teste, uma por id).
7. `C1: a seed whose anchor the suite flags or present cannot tell is refused with a scenario error` (suíte e sentinela injetados, como B1 teste 7).
8. `C1: legacy variants are unchanged` (árvore do `seededCommit` de `codigo-semeado-A` e de `correcao-semeada-A` igual ao hash inline medido antes de editar).
9. `C1: QL1 leaks lastIndex across calls and QL3 overflows the stack at 20,000 words` (`probe` sobre o arquivo semeado: `wordCount('ab')` seguido de `wordCount('x')` dá 0; `wordCount('a '.repeat(20000))` lança `RangeError`), para a âncora não perder o defeito numa reescrita.

**Implementação:**
1. `defects/sentinels/lentes.mjs`: esqueleto de `sentinels/fix.mjs` (`atRef`, `probe`, `lf`, `git`, `fail`, `replaceOnce`); exporta `seed(dir, id)` e `present(dir, ref = 'HEAD', id)` com tabela dos oito ids (`file`, `apply(text)`, `present(dir)`). Âncoras candidatas da spec (C1), com a regra de troca de DEC-724 (id novo com `replaces`, listado no relatório da tarefa). SP3, SP4, QL3 e QL4 compõem sobre o mesmo `src/word-count.mjs`: o `apply` de cada um parte do texto já semeado pelos anteriores do artefato, na ordem do manifesto, e o `present` de cada um olha só a sua marca.
2. `manifest.json`: 8 entradas (`id`, `class: 'code'`, `set: 'e5-lentes'`, `lens`, `kind`, `artifact`, `file`, `sentinel: 'sentinels/lentes.mjs'`, `detectedBy: 'reviewer'`, `mention`, `description`). Entradas existentes intactas.
3. `make-scenario.mjs`: `VARIANTS` e `RELEASE_RUN_VARIANTS` ganham as duas; `SEEDED['lentes-semeadas-A'|'-B'] = { class: 'code', artifact, set: 'e5-lentes' }`; o `case` de `makeScenario` copia o de `codigo-semeado-*` (`seedVariant`, prompt `run E5`). Nenhuma mudança no caminho de `codigo-semeado-*` e `correcao-semeada-*`.

**Verificação:** `node --test tools/measure/make-scenario.test.mjs` (antigos e 9 novos passam). G1 e `claude plugin validate .`.

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
2. `C3: laco-divergente` quando um laço replayado diverge do `loops[i].ok` do script, quando o script rodou o laço `quality` e o replay parou no `spec` (e o contrário), e com rótulo não usado ou repetido; 2 num lote param o lote (`aggregate.stoppedBy`).
3. `C3: formato-do-diario, laco-infra and semente-ausente` (este com `present` falso no `seededCommit`).
4. `C3: a first review with no hard finding is valid and the four seeds are perdido`.
5. `C3: bloqueou-sintetico only in unica, only when every fixable item is synthetic; more than 2 in a lot stop the lot`.
6. `C3: BLOCKED with a synthetic and a real finding is bloqueadoMisto, a valid stopped attempt (indeterminado)`.
7. `C3: failRiscoAceito counts unica attempts whose loop approved with accepted risks in a round with spec or quality not pass`.
8. `C3: sinteticoGerado and veredictoAusente counted per round in unica`.
9. `C3: capturadoPor names the first kind and round whose finding matches the mention; capturadoSemMencao as in B`.
10. `C3: outcomesByLens splits captures and determined by lens`.
11. `C3: rolesByLabel puts E5:t3:<kind><r> in review and E5:t3:<kind>-fix<k> in fix`.
12. `C3: the correcao-semeada replay and validity are unchanged` (diários de fixture de B dão o mesmo resultado de hoje; goldens da T1 intactos).

**Implementação (`run-batch.mjs`):**
1. `replayLoop`: ramo `lentes` com um `runReviewLoop` por `kind` de `h.kinds`, rótulos por `kind`, `cx = { taskReview: { restricted: false, single: h.arm === 'unica' }, was }`, parada no primeiro laço que não aprova; devolve `loops` (por laço: `ok`, `kind`, revisões, `fixTiers`, `accepted`, listas `fixable` de cada correção, para `bloqueou-sintetico`).
2. `loopResult`: com `lentes`, `stageLabels` por qualquer prefixo de `labelsFor(h)`; `ok` = todos os laços aprovaram.
3. `lensValidity(h, journal, scenario, loop, script)` nova (não toca `loopValidity` de B): motivos da spec (C3), na ordem `formato-do-diario`, `semente-ausente`, `laco-infra`, `bloqueou-sintetico`, `laco-divergente`.
4. Contadores por tentativa e no topo (`loopAggregate` com `{ lenses: true }`): `failRiscoAceito`, `bloqueadoMisto`, `sinteticoGerado`, `veredictoAusente`, `capturadoPor`, `capturadoSemMencao`, `outcomesByLens`, `bloqueouSintetico`, custo por tentativa válida.
5. `h.syntheticDescription` (ambiguidade 6) calculado na partida a partir de `h.loopFns.taskIssues`.
6. Paradas de lote: 2 `laco-divergente`, mais de 2 `bloqueou-sintetico`, mais de 3 inválidas, 2 `semente-ausente`.
7. `rolesByLabel`: regra da ambiguidade 3.

**Verificação:** `node --test tools/measure/run-batch.test.mjs`. G1 e `claude plugin validate .`.

**Commit:** `fix(measure): replay, validade e contadores da passada C`.

---

## T6. C4: regra de decisão e agregado (revisor opus)

**Arquivos (2):** `tools/measure/run-batch.mjs`, `tools/measure/run-batch.test.mjs`.

**Testes primeiro** (`run-batch.test.mjs`, seção `C4:`; agregados de fixture com `outcomes`, `outcomesByLens`, `capturadoSemMencao`, `failRiscoAceito` e custo):
1. `C4: ruleSideC gives teto when atual has 38 or more of 40` (a única não é olhada).
2. `C4: ruleSideC gives piso when atual has fewer than 20 of 40 or fewer than 32 determined`.
3. `C4: ruleSideC gives unica with 32+ determined, at most 2 fewer in total and in each lens, and a lower cost per valid attempt` (atual 36, única 35, lentes 18/17 e 18/18, custo 0,55 contra 0,85).
4. `C4: ruleSideC gives atual` por total (36 contra 33), por lente (quality 18 contra 15 com total 36 contra 34), por custo (igual ou maior) e por determinadas da única (31).
5. `C4: ruleSideC gives inconclusivo when the recount with capturadoSemMencao, or with the failRiscoAceito attempts, as indeterminado changes the side`.
6. `C4: the aggregate of a lenses batch records harness.taskReview, kinds, outcomesByLens and the counters of C3`.

**Implementação (`run-batch.mjs`):** `export function ruleSideC({ atual, unica })` pura, devolvendo `{ side: 'teto'|'piso'|'unica'|'atual'|'inconclusivo', reason, recount }`, com os limiares da spec (C4) como constantes nomeadas no topo da função; `recountLenses(aggregate)` no molde de `recountArm`. O `runBatch` não chama a regra: o relatório do orquestrador a aplica sobre os dois agregados (como `ruleSide` em B).

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
   `node tools/measure/run-batch.mjs --variant lentes-semeadas-A --runs 1 --work D:/claude-e27c-work --out D:/claude-e27c-out/sondas --config-dir D:/claude-e17-cfg --permission-mode bypassPermissions --model sonnet --max-budget-usd 3 --stage task-review --rounds loop --arm atual --review-model sonnet --plugin-dir D:/claude-e27c-release/plugins/productivity-tools --stop-on-denial` (rodado de `D:/claude-e27c-release`).
   Parada: custo × 10 acima de US$ 13.
5. Lote atual: o mesmo comando com `--out D:/claude-e27c-out/atual`, `lentes-semeadas-A` (4 execuções, ou 5 se a sonda foi inválida) e `lentes-semeadas-B` (5), repondo inválidas até as paradas da spec.
6. Aplicar `ruleSideC` só ao atual: teto ou piso fecham a passada (única com 0 execuções). Senão, sonda e lote da única com `--arm unica` e `--out D:/claude-e27c-out/unica` (parada: soma projetada acima de US$ 25).
7. Relatório `docs/reports/2026-11-<dd>-E27-passada-C.md` (formato do de B), linha em `measurements.md` e decisão pelo roadmap-tracker para o dono ratificar (card E27, critério 2).
