# E27, passada C (peça 2): dois laços por tarefa contra a revisão única de E28

Data: 2026-11-15. Branch: `feat/e27-passada-c` (worktree `D:/projects/claude-play-wt/e27c`, base `336b7f8` de `release/roadmap-skills-v2`). Revisão 1, para o dono. Base: card E27 (peça 2), DEC-697/703 (passadas), DEC-704/705 (n e leitura de teto), DEC-707 (revisor sonnet/medium), DEC-735 a DEC-737 (forma do arnês, desfecho pelo sentinela), DEC-752 a DEC-755 (fechamento de A e B; C com o braço atual primeiro), DEC-766 a DEC-769 (E28 e a emenda para a passada C). Só `tools/measure/`. Teste antes, sem bump. Desenha o lote; não roda nada pago.

## Objetivo

Medir se a revisão por tarefa única de E28 (`taskReview.single`: uma chamada por rodada, `Mode: review`, veredictos `spec` e `quality`) captura tanto quanto os dois laços de hoje (`spec`, depois `quality`), com o laço de rodadas do produto. O resultado é uma decisão de política (card E27, critério 2): ligar o modo único por padrão ou manter os dois laços. Resultado inconclusivo mantém os dois laços.

Por que sementes novas: o arnês de A e B mede só o laço `spec`, e esse laço sozinho já capturou tudo em `codigo-semeado-A/B` (40/40 nos dois modelos) e em `correcao-semeada-A/B` (20/20). Com essas sementes o braço atual dá teto por construção e, por DEC-755, o braço único nem rodaria; a pendência de `state.md` pede "sementes de spec e de quality". A pergunta da peça 2 é justamente se uma chamada só deixa escapar o que só uma das duas listas de bloqueio de `agents/task-reviewer.md` cobre.

## Escopo

Dentro: C1 a C5 abaixo, em `tools/measure/` e nos testes de lá.

Fora: `plugins/` e `roadmap-release.js` (só lidos); a correção dos achados 2 e 3 da revisão final de E28 (DEC-769: antes de o modo virar padrão, não antes de medir); a combinação `restricted` + `single` (DEC-768; a restrita fica desligada por DEC-752); `parentMention` (só para lote com `correcao-semeada`, ver "Pendência parentMention"); qualquer lote pago.

## Fatos lidos no código (ponta `336b7f8`)

- **Produto, laço por tarefa** (`roadmap-release.js` 2622-2645): `const tr = CFG.taskReview || {}, TR = { restricted: tr.restricted === true, single: tr.single === true }` e `for (const kind of TR.single ? ['review'] : ['spec', 'quality'])`. Cada `kind` é um `reviewLoop('T<n>:<kind>', ...)` com o mesmo `revAgent` (agente `productivity-tools:task-reviewer`, schema `S_TASKREVIEW` com `verdicts`, `spec`, `quality`), o mesmo modelo e effort (`reviewModelFor(t)`, `effortFor`), corretor `implAgent` com o texto `fix the ${kind} problems below`, verdade `reviewTruth({ ...r, issues: taskIssues(r, cx) }, ...)` e opções `{ tier: implModel(t), reviewModel: reviewModelFor(t), haltOn, byId: true }`. Os laços correm em série sobre o mesmo `cur` (resumo e checks); `if (!loop.ok) return fail(...)` para no primeiro laço que não aprova, logo o laço `quality` só roda se o `spec` aprovou.
- **Rótulos do produto:** `${E}:t${n}:${kind}${round}` e `${E}:t${n}:${kind}-fix${k}`.
- **Achado sintético** (`taskIssues`, bloco puro, linha 407): com `taskReview.single`, veredicto `spec` ou `quality` ausente ou diferente de `pass` e nenhum achado bloqueante (`blocking`: severidade `critical` ou `important`) acrescenta `{ severity: 'critical', category: 'defeito', description: 'single review: spec or quality verdict missing or fail, no blocking finding' }`. Sem `single`, `taskIssues` devolve `r.issues` (mesma referência, DEC-766).
- **Risco aceito** (`runReviewLoop`, 566-568): no fim, achados não duros (`isHard` falso: categoria `ambiente` com `blq`, `fora-do-escopo`, `pelo-plano`, com severidade `important`) vão a `acceptRisks` e o laço aprova. Um `fail` acompanhado só de achado bloqueante não duro não gera o sintético (já há bloqueante) e passa como risco aceito: é o achado 3 da revisão final de E28 que DEC-767/769 mandam contar à parte.
- **Corretor BLOCKED** (`runReviewLoop`, 545): `fx.status === 'BLOCKED'` para o laço com `kind: 'conteudo'`. Diante só do achado sintético, o corretor pode não ter o que corrigir e responder BLOCKED (achado 2; DEC-769: execução inválida na passada C).
- **Agente** (`agents/task-reviewer.md`): `review` aplica as duas listas (`spec` bloqueia requisito ausente, divergência da spec, escopo extra, teste ausente ou que não testa o que diz, arquivo fora da lista; `quality` bloqueia bug, problema de segurança, convenção violada, teste frágil) e devolve `spec` e `quality`.
- **Arnês hoje** (`tools/measure/run-batch.mjs`, 2.161 linhas):
  - `STAGES['task-review'].variant` aceita `codigo-semeado-[AB]` e `correcao-semeada-[AB]`; `--rounds loop` em task-review só com `correcao-semeada-*` (`prepareHarness`, 1197-1202); `--arm` `atual` ou `restrita` (`h.base` é `atual` nos dois).
  - `buildTaskLoopScript` (996-1056) roda **um** laço, `kind` `spec` fixo, com `H_TR = { restricted }`, rótulos `E5:task-review<r>` e `E5:task-review-fix<k>`; `fix1` é o aplicador haiku da correção semeada; o texto do corretor vem de `harnessPrompts` com `fix the spec problems below` fixo (1272).
  - `checkLoopWorkflow` (899-934) recusa na partida o workflow sem `TASK_SLICE_LITERALS`, `tr.restricted === true` ou `restrictedRound`/`taskIssues` no bloco puro; não confere nada de `single`.
  - `replayLoop` (1564-1622) refaz o laço com as funções do workflow medido (`h.loopFns = loadPure(wfFile)`), mas monta `cx = { taskReview: { restricted } }` sem `single`: o sintético nunca apareceria no replay.
  - `loopValidity` (1627-1665) é desenhada para a correção semeada: `sem-correcao` é inválida e confere `fixSha`. Com semente plantada antes da 1ª revisão, uma 1ª revisão sem achado duro é perda, não invalidez.
  - `mentionStats` (657) e `recountWithoutMention` (629) existem; `ruleSide` (625) é a regra da peça 3, específica de completa/restrita.
- **Custos de referência:** passada B, peça 3 (laço de tarefa, sessão sonnet, revisor sonnet/medium): US$ 0,58 por tentativa válida nos dois braços (3 revisões, aplicador haiku e 1 a 2 correções sonnet). Passada A (rodada única, revisor sonnet): agentes US$ 0,123 por tentativa (revisão + correção).

## Comportamento por item

### C1. Sementes de spec e de quality (`lentes-semeadas-A/B`)

- **Variantes novas:** `lentes-semeadas-A` e `lentes-semeadas-B`, `class: 'code'`, `set: 'e5-lentes'`, no mesmo cenário legado `e5` (T1 e T2 limpas, T3 limpa e depois as quatro sementes do artefato num commit, `seededCommit`). Entram em `VARIANTS` e `RELEASE_RUN_VARIANTS` de `make-scenario.mjs` como `codigo-semeado-*`.
- **Regras de desenho das sementes** (conferidas por teste, aceite 1):
  1. Só nos três arquivos da Tarefa 3 (`src/word-count.mjs`, `src/index.mjs`, `tests/e5-word-count.test.mjs`). Semente em arquivo de T1 ou T2 seria acusada pela regra "arquivo fora da lista" da lente spec, o que daria à lente spec um caminho para pegar uma semente de quality.
  2. A suíte da sandbox passa no `seededCommit` (regra de DEC-724: semente acusada por código não é defeito de revisor).
  3. `present` verdadeiro no `seededCommit` e falso na T3 limpa.
  4. **Spec (`lens: 'spec'`):** código limpo, idiomático, que contradiz uma linha escrita da spec ou do plano; um revisor de qualidade que não lê a spec não teria o que apontar.
  5. **Quality (`lens: 'quality'`):** comportamento coerente com toda linha da spec e do plano nas entradas que eles citam, mas defeito pela lista `quality` (bug, teste frágil, robustez); um revisor de conformidade que confere AC por AC não o vê.
  6. Cada entrada tem `mention` (regex sobre `file` + descrição), testada contra uma frase-modelo, só para o contador auxiliar `capturadoPor` (DEC-737: o desfecho é pelo sentinela).
- **Candidatas** (a âncora final é do executor, com a regra de troca de DEC-724: id acusado pela suíte ou que o `present` não distingue vira id novo com `replaces`, listado no relatório). Cada artefato fica com 2 de spec e 2 de quality:

  | Id | Art. | Lente | Arquivo | Âncora candidata | Linha que contradiz ou lista que cobre |
  |---|---|---|---|---|---|
  | SP1 | A | spec | `src/index.mjs` | reexporta `wordCount` só como `countWords` (`export { wordCount as countWords }`); nenhum teste importa do index | spec, Peça 3: "re-exports the three functions" |
  | SP2 | A | spec | `src/word-count.mjs` | lança `TypeError` para entrada não string em vez de coagir | spec, decisão autônoma 2: "coerced with String(text)" |
  | QL1 | A | quality | `src/word-count.mjs` | teste de vazio por regex de módulo com `g` (`const NB = /\S/g; if (!NB.test(t)) return 0`): `lastIndex` vaza entre chamadas (`wordCount('ab')` e depois `wordCount('x')` dá 0); a suíte passa (conferido em Node 22) | bug |
  | QL2 | A | quality | `tests/e5-word-count.test.mjs` | teste a mais de tempo (`performance.now()` em volta de `wordCount` sobre 10⁵ palavras, `assert.ok(ms < 50)`): passa na máquina, falha em máquina lenta ou sob carga | teste frágil |
  | SP3 | B | spec | `src/word-count.mjs` + `src/index.mjs` | função extra `charCount` exportada e reexportada pelo index | escopo extra (lista `spec`) |
  | SP4 | B | spec | `src/word-count.mjs` | `String(text ?? '')`: `null` e `undefined` dão 0 em vez de 1 (`'null'`) | spec, decisão autônoma 2 |
  | QL3 | B | quality | `src/word-count.mjs` | contagem recursiva (`1 + rec(s.replace(/^\S+\s*/, ''))`): estoura a pilha (`RangeError`) com ~20.000 palavras (conferido em Node 22); a suíte passa | bug (robustez) |
  | QL4 | B | quality | `src/word-count.mjs` | memo de módulo sem limite (`const memo = new Map()` com todo texto visto como chave) | bug (memória sem limite) |

  SP3 e SP4 tocam o mesmo arquivo que QL3 e QL4: o `seed` aplica as quatro numa escrita só e cada `present` olha só a sua marca (como `fix.mjs` faz com CR e CG).
- **Sentinela:** um arquivo novo, `defects/sentinels/lentes.mjs`, com `seed(dir, id)` e `present(dir, ref, id)` dos oito ids (forma de `sentinels/fix.mjs`).
- **Classificação por lente é de desenho, não de medição.** O agregado grava, por semente, qual laço e rodada a mencionou primeiro (`capturadoPor`, auxiliar), para o relatório dizer se a lente spec pegou semente de quality no braço atual.

### C2. Braços `atual` (dois laços) e `unica` (revisão única)

- **Opções.** `--stage task-review --rounds loop` passa a aceitar também `lentes-semeadas-A/B`, com `--arm atual|unica` e `--review-model` obrigatório (DEC-700). Recusas novas (saída 2, sem `claude -p`): `--arm unica` fora de `task-review`, fora de `--rounds loop` ou fora de `lentes-semeadas-*`; `lentes-semeadas-*` em rodada única; `--arm restrita` com `lentes-semeadas-*` (fora do escopo, DEC-768). Ficam como hoje: `codigo-semeado-*` em laço recusado e o golden da rodada única intacto (DEC-735); `correcao-semeada-*` com `atual|restrita`.
- **Braços** (ambos `built-in`, sem arquivo de braço; `h.base = 'atual'`):
  - `atual`: `H_TR = { restricted: false, single: false }`, `H_KINDS = ['spec', 'quality']`. É o padrão do produto: dois laços em série; o `quality` só roda se o `spec` aprovou.
  - `unica`: `H_TR = { restricted: false, single: true }`, `H_KINDS = ['review']`.
  - Nada mais muda entre eles: revisor `productivity-tools:task-reviewer` em `--review-model sonnet`, effort `medium` (DEC-707); corretor sonnet (tier da Tarefa 3); `maxFix` 2; `byId: true`.
- **Recusas na partida do workflow medido** (só com `lentes-semeadas-*`; somam-se às de hoje): faltam `TR.single ? ['review'] : ['spec', 'quality']` ou `single: tr.single === true` no texto; falta `(c.taskReview || {}).single` dentro de `function taskIssues` no bloco puro; falta `## Review mode` em `agents/task-reviewer.md` do plugin medido.
- **Script** (`buildTaskLoopScript`, ramo novo para `lentes-semeadas-*`; o ramo de `correcao-semeada-*` gera o mesmo texto de hoje, byte a byte, conferido por golden congelado antes):
  - `ctx` como hoje, com `taskReview: H_TR`; sem `diffPath` útil (a restrita não liga).
  - Para cada `kind` de `H_KINDS`, em série: `runReviewLoop(H_env, 'T3:' + kind, review, fix, truth, H_OPT)`, com `cx` novo por `kind` e o mesmo `H_cur` (como o produto). Para no primeiro laço que não aprova.
  - `review(round, prev, rvModel, was)`: `agent(buildTaskReviewPrompt(cx, { n: 3, title }, kind, H_cur), { agentType: 'productivity-tools:task-reviewer', schema: H_SCHEMA_TASK, label: 'E5:t3:' + kind + round, ... })`. Rótulos espelham o produto (`E5:t3:spec1`, `E5:t3:quality2`, `E5:t3:review1`).
  - `fix(iss, k, tier)`: o corretor de HEAD desde `k === 1` (não há aplicador: a semente está antes da 1ª revisão), com o texto do corretor da tarefa trocando `spec` por `${kind}` (`fix the ${kind} problems below`), rótulo `E5:t3:${kind}-fix${k}`, `schema: H_SCHEMA_FIX` (status, summary, checks), atualizando `H_cur` como o produto. `BLOCKED` volta como `{ status: 'BLOCKED', summary }`.
  - `truth = r => reviewTruth({ ...r, issues: taskIssues(r, cx) }, 1, H_SEEDED + '~1..HEAD')`: com `unica`, o `taskIssues` do bloco puro medido acrescenta o sintético.
  - Devolve `{ ok, kind, msg, loops: [{ kind, ok, kind: stopKind, accepted }], reviews, accepted }`.

### C3. Replay, validade e desfecho

- **Replay por `kind`** (DEC-737). `replayLoop` ganha o ramo `lentes-semeadas-*`: refaz, em série e com as funções do workflow medido (`h.loopFns`), um `runReviewLoop` por `kind` de `H_KINDS`, rótulos `E5:t3:<kind><r>` e `E5:t3:<kind>-fix<k>`, `cx = { taskReview: { restricted: false, single: h.arm === 'unica' }, was }`, `byId: true`, e para no primeiro laço que não aprova. Devolve, por laço, `ok`, `kind`, as revisões, as camadas de correção e os achados aceitos como risco.
- **Desfecho** (sem mudança de regra): sentinelas de SP/QL no tip de `feat/E5`; estágio `approved` se todos os laços replayados aprovaram, senão `stopped`; `outcomeFor`: ausente = `capturado`, presente e aprovado = `perdido`, presente e parado = `indeterminado`. Determinadas = capturadas + perdidas.
- **Validade** (tentativa inválida, com motivo; motivos de `correcao-semeada` como `sem-correcao`, `correcao-semeada-ausente` e `semente-ausente` por `fixSha` não valem aqui):
  - `formato-do-diario`: a 1ª revisão do 1º laço sem `issues` em lista.
  - `laco-infra`: revisão ou correção nula depois do retry.
  - `laco-divergente`: o `ok` de algum laço replayado difere do devolvido pelo script, o script rodou um laço que o replay não rodou (ou o contrário), ou o diário tem rótulo da tarefa não usado ou repetido. 2 num lote param o lote (DEC-737).
  - `semente-ausente`: algum `present` falso no `seededCommit` (conferência antes da 1ª revisão).
  - `bloqueou-sintetico` (só `unica`, DEC-769): uma correção devolveu `BLOCKED` e a lista que ela recebeu (`fixable`) tem só achados sintéticos. Mais de 2 num lote param o lote e voltam ao dono (gatilho de DEC-767: rever o modo).
  - Uma 1ª revisão sem achado duro é **válida**: as sementes ficam no fim e contam como perdidas (a revisão aprovou com elas).
- **Contadores à parte** (topo do agregado; não mudam a validade):
  - `failRiscoAceito` (DEC-769): tentativas do braço `unica` em que um laço aprovou com risco aceito (`acceptRisks` não vazio) numa rodada com `spec` ou `quality` diferente de `pass`.
  - `bloqueadoMisto`: `BLOCKED` com sintético e achado real na mesma lista (conta como parada comum, `indeterminado`).
  - `sinteticoGerado`, `veredictoAusente` (rodadas da `unica` sem `spec` ou sem `quality`).
  - `capturadoPor`: por semente, `{ kind, round }` da 1ª revisão cujo achado casa o `mention`; `capturadoSemMencao` como em B.
  - `outcomesByLens`: capturas e determinadas separadas por `lens` (spec, quality).
  - Custo por tentativa: `max(cliCostUsd, transcriptCostUsd + soma dos papéis)`, como em B; `rolesByLabel` põe `E5:t3:<kind><r>` em `review` e `-fix` em `fix`.

### C4. Regra de decisão (fixada antes do lote)

Proposta para o dono ratificar como DEC antes de qualquer lote (escolhas 3 a 5 abaixo). Por braço: 10 válidas (5 por artefato) e 40 oportunidades (4 sementes por tentativa), como DEC-704.

1. **Braço atual primeiro** (DEC-755). Ao fim do lote dele:
   - **Teto:** atual com 38 ou mais capturas em 40 (DEC-705). O braço `unica` não roda; ficam os dois laços. Registra-se `unica` com 0 execuções, como DEC-741.
   - **Piso:** atual com menos de 20 capturas em 40 (metade, como o piso de DEC-732), ou com menos de 32 determinadas. O braço `unica` não roda; ficam os dois laços (sementes difíceis ou ruidosas demais para separar os braços).
   - Fora dos dois: roda o braço `unica`.
2. **Braço único** (só fora de teto e piso). O modo único entra (como decisão; o padrão só muda depois de corrigidos os achados 2 e 3 de E28, DEC-769) se, ao mesmo tempo:
   - `unica` tem 32 ou mais determinadas;
   - capturas `unica` ≥ capturas atual − 2, no total das 40;
   - em cada lente (20 oportunidades), capturas `unica` ≥ capturas atual − 2;
   - custo por tentativa válida da `unica` menor que o da atual.
   Senão ficam os dois laços.
3. **Recontagens** (como DEC-737): refazer a conta com `capturadoSemMencao` como indeterminado e, à parte, com as tentativas de `failRiscoAceito` como indeterminadas. Se alguma recontagem mudar o lado da regra, o resultado é inconclusivo: ficam os dois laços.
4. O arnês não fixa `--runs`; a função pura `ruleSideC({ atual, unica })` devolve o lado e o motivo a partir dos dois agregados (teste com fixtures dos casos).

## Arquivos (4 fora os testes)

- Código: `tools/measure/run-batch.mjs`, `tools/measure/make-scenario.mjs`, `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/lentes.mjs` (novo).
- Intactos: braços em `arms/`, `checkpoint.mjs`, sentinelas C/CR/CG, cenário `scenario/e5/`.
- Testes: `run-batch.test.mjs`, `review-loop.test.mjs`, `make-scenario.test.mjs`.
- Um 5º arquivo fora os testes, tarefa com mais de 4 arquivos ou edição fora de `tools/measure/`: parar e perguntar.

## Aceite (verificável por `node --test`)

1. **C1:** em `lentes-semeadas-A/B`, `feat/E5` fica no `seededCommit`; o diff do `seededCommit` só toca os três arquivos da Tarefa 3; a suíte passa nele; para cada SP/QL, `present` é verdadeiro no `seededCommit` e falso na T3 limpa; cada artefato tem 2 entradas `lens: 'spec'` e 2 `lens: 'quality'`; cada `mention` casa a sua frase-modelo e não casa a das outras três do artefato; as variantes antigas não mudam.
2. **C2, script:** o golden da rodada única de `codigo-semeado-A` e os goldens do laço de `correcao-semeada-A` (`atual` e `restrita`) não mudam; o script de `lentes-semeadas-A` contém o bloco puro byte a byte, compila com `AsyncFunction` e fica abaixo de 200.000 caracteres sobre o workflow real da ponta.
3. **C2, agente simulado:** `atual` chama `E5:t3:spec1`, …, depois `E5:t3:quality1`, …, com `Mode: spec.` e `Mode: quality.`; se o laço `spec` para, nenhum rótulo `quality` é chamado; `unica` chama só `E5:t3:review<r>` com `Mode: review.`; `fix1` é o corretor sonnet com `fix the <kind> problems below`; uma revisão `unica` com `quality: 'fail'` e só achado menor gera o sintético e uma correção; achado repetido escala a opus.
4. **C2, recusas** (saída 2, sem `claude -p`): `--arm unica` em `correcao-semeada-*`, em rodada única e fora de task-review; `lentes-semeadas-*` em rodada única ou com `--arm restrita`; fixture de workflow sem o literal do laço `TR.single`, sem `single: tr.single === true` ou com `taskIssues` sem `.single`; plugin sem `## Review mode` no agente.
5. **C3:** nos dois braços, com agente simulado, o `ok` de cada laço replayado é igual ao do script; um diário adulterado dá `laco-divergente`; os motivos `formato-do-diario`, `laco-infra`, `laco-divergente`, `semente-ausente` e `bloqueou-sintetico` saem nos casos montados; `BLOCKED` com sintético e achado real dá `bloqueadoMisto` e tentativa válida parada; 1ª revisão sem achado é válida com as quatro sementes `perdido`; `failRiscoAceito`, `sinteticoGerado`, `veredictoAusente`, `capturadoPor` e `outcomesByLens` contados certo em diário de fixture.
6. **C4:** `ruleSideC` devolve `teto` (atual 38/40), `piso` (atual 19/40 ou 31 determinadas), `unica` (37 contra 36, lentes dentro de 2, custo menor), `atual` por total (atual 36, única 33), por lente (quality 18 contra 15), por custo e por determinadas (31), e `inconclusivo` quando a recontagem muda o lado.
7. Suíte inteira verde: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`; nenhum arquivo fora de `tools/measure/` (e destes dois documentos) no diff da branch.

## Plugin medido e ambiente do lote

- **SHA medido M_C:** a ponta de `release/roadmap-skills-v2` depois do merge desta branch (arnês e plugin no mesmo commit, como `cc0cb15` em B; o aviso `harnessCommit differs` não pode aparecer). Contém E28 desligado por padrão; o braço `unica` o liga só no script do arnês (`H_TR.single`), sem mexer na config da sandbox.
- **Worktree destacada** em M_C: `git -C D:/projects/claude-play-wt/_integracao worktree add --detach D:/claude-e27c-release <M_C>`; `run-batch.mjs` roda de lá, com `--plugin-dir D:/claude-e27c-release/plugins/productivity-tools`.
- **Config:** `export CLAUDE_CONFIG_DIR=D:/claude-e17-cfg` e `--config-dir D:/claude-e17-cfg`.
- **Sessão:** `--model sonnet`, `--permission-mode bypassPermissions` (só na orquestração da medição, DEC-311/312), `--max-budget-usd 3` por sessão, `--stop-on-denial`, em série. Nunca junto de outro lote, de G1 ou de um release (porta 48731).
- **Saídas:** `D:/claude-e27c-out/{sondas,atual,unica}/` (fora do repositório).
- **Conferência por tentativa** (como A): `agentType` do revisor `productivity-tools:task-reviewer` e modelo `claude-sonnet-5-5` no `.meta.json` dos subagentes.

## Orçamento e projeção

- **Estimativa por tentativa** (da passada B, US$ 0,58 por tentativa com 3 revisões, aplicador haiku e 1 a 2 correções sonnet):
  - `atual`: dois laços, tipicamente 4 revisões e 2 correções sonnet: **≈ US$ 0,85**.
  - `unica`: tipicamente 2 revisões (prompt maior, as duas listas) e 1 correção: **≈ US$ 0,55**.
- **Projeção:** sonda atual 0,85 + 9 × 0,85 = **US$ 8,50**; sonda única 0,55 + 9 × 0,55 = **US$ 5,50**; total **≈ US$ 14** sem inválidas, **≈ US$ 18** com 3 inválidas repostas em cada lote (o máximo antes da parada). Se o atual der teto ou piso: **≈ US$ 8,50 a 11**.
- **Teto proposto:** US$ 25 no total (sonda e lote atual até US$ 13; sonda e lote único até US$ 10). Uma sonda válida no mesmo M_C, arnês e config conta como 1ª tentativa do braço (como DEC-749).
- **Paradas antes do lote:** sonda atual × 10 acima de US$ 13, ou soma projetada (sonda atual × 10 + sonda única × 10) acima de 25: parar e perguntar.
- **Paradas durante o lote:** mais de 3 inválidas num lote (padrão de DEC-725); 2 `laco-divergente` (DEC-737); mais de 2 `bloqueou-sintetico` no braço `unica` (DEC-767/769); 2 sementes com `present` falso no `seededCommit` (desenho do C1 errado); gasto acumulado em US$ 25 com braço incompleto: parar; o lote retoma do que está em `--out`.

## Pendência parentMention

`state.md` pede `parentMention` no CR do manifest (CR3 com o texto de C5), lido por `mentionStats`, antes de outro lote com `correcao-semeada` (DEC-753). Esta passada não usa `correcao-semeada`: a pendência não é feita aqui e continua valendo para o próximo lote que usar essas variantes. Se o dono escolher medir C também sobre a correção semeada (escolha 1, alternativa c), ela vira a tarefa T0 do plano, antes de qualquer outra, com `manifest.json`, `run-batch.mjs` e `run-batch.test.mjs`.

## Escolhas do dono (com a recomendação)

1. **Sementes.** (a) Novas `lentes-semeadas-A/B`, 2 de spec e 2 de quality por artefato, só nos arquivos da Tarefa 3. (b) Reusar `codigo-semeado-A/B` (sem trabalho de sementes; o laço `spec` sozinho já deu 40/40, o atual dá teto quase certo e a passada fecha sem medir nada, o que DEC-755 rejeitou). (c) `correcao-semeada-A/B` (mede a 2ª rodada; exige `parentMention` antes). **Recomendo (a).**
2. **Braço atual com os dois laços** (`spec` e depois `quality`), como o produto, e não só o laço `spec` de A e B. **Recomendo medir os dois**: comparar a única com metade do atual subestima o atual e favorece a única.
3. **n.** 10 válidas por braço (5 por artefato), 40 oportunidades, mínimo de 32 determinadas (DEC-704, DEC-705). **Recomendo assim**; 20 por braço dobraria o custo (≈ US$ 28 a 36) sem precedente nas passadas A e B.
4. **Limiar de entrada da única.** (a) Até 2 capturas a menos no total e em cada lente, e custo menor. (b) Até 5 a menos (o limiar 6 de DEC-705 lido ao contrário). **Recomendo (a)**: adotar uma redução pede prova mais forte que manter o atual, como DEC-732 pediu para a restrita (2 em 20); o corte por lente pega exatamente o risco medido (a única esquecer uma das listas).
5. **Teto e piso do atual.** Teto em 38/40 (DEC-705) e piso abaixo de 20/40 ou com menos de 32 determinadas, e nos dois a única não roda. **Recomendo assim** (lógica de DEC-741: nenhum resultado da única mudaria a política).
6. **DEC-769 na prática.** `bloqueou-sintetico` inválida só quando a lista do corretor tem apenas sintéticos (lista mista conta como parada comum, `bloqueadoMisto`); mais de 2 num lote param; `failRiscoAceito` contado à parte e recontado como indeterminado, com mudança de lado = inconclusivo. **Recomendo assim.**
7. **Medir E28 como está**, antes de corrigir os achados 2 e 3 (DEC-769 manda corrigi-los antes de o modo virar padrão, e a emenda já trata os dois casos como inválido e contado à parte). **Recomendo medir agora.** Alternativa: corrigir antes e medir o que será publicado (DEC-702); custa um ciclo de produto e uma nova M_C.
8. **Combinação `restricted` + `single`** (DEC-768): fora. **Recomendo fora**: a restrita ficou desligada (DEC-752) e o braço triplicaria o custo.
9. **Teto de gasto** US$ 25 (atual até 13, única até 10), sonda válida conta como 1ª tentativa. **Recomendo assim.**
10. **`parentMention`:** não fazer agora. **Recomendo não fazer** (só serve à escolha 1c).
11. **Revisor e corretor:** revisor sonnet/medium (DEC-707), corretor sonnet (tier da Tarefa 3), nos dois braços. **Recomendo assim**; revisor opus está fora do que E27 decide nesta peça.
12. **Limite do bloco:** 4 arquivos fora os testes, tarefa com até 4 arquivos. **Recomendo assim.**

## Riscos

- **Teto de novo:** sementes de quality fáceis demais dão 38/40 no atual e a passada fecha sem a única. Aceito: a regra fixa isso antes, e o custo é só o do braço atual (≈ US$ 8,50).
- **Classificação por lente vaza:** uma semente de quality pode desviar de uma linha do plano (QL1 troca o "trim, return 0 for blank" por regex) e ser pega pela lente spec. `capturadoPor` mostra no relatório; a regra por lente usa a classe de desenho.
- **Revisor chama a semente de menor** (QL2, QL4): o laço aprova com ela e ela conta como perdida nos dois braços. Isso baixa o teto e é o mesmo nos dois; não é inválido.
- **Correção remove a semente por acaso** (o corretor reescreve `word-count.mjs`): `capturadoSemMencao` e a recontagem de C4.
- **Achado sintético sem correção possível:** `bloqueou-sintetico` e a parada de mais de 2 por lote.
- **`run-batch.mjs` cresce** (2.161 linhas): sem módulo novo, para caber nos 4 arquivos.
- **M_C com outro commit no meio:** se `plugins/` mudar depois de M_C sem nova M_C, gates e sonda, o lote para (como DEC-744).

## Tarefas (ordem; até 4 arquivos cada; teste antes)

Ver o plano: `docs/plans/2026-11-15-measure-e27-passada-c-plan.md`. Resumo: T1 goldens congelados; T2 sementes (C1); T3 opções e recusas (C2); T4 script de dois laços e da única (C2); T5 replay, validade e contadores (C3); T6 regra `ruleSideC` e agregado (C4). Implementador sonnet/medium; revisor opus em T2, T4, T5 e T6, sonnet em T1 e T3; portão final opus/high. Sondas e lotes são do dono, depois do merge na release e da ratificação das escolhas acima.
