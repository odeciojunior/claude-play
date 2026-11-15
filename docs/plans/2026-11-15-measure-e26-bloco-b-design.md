# E26, bloco B do arnês: correção semeada, revisão por tarefa restrita em laço, estágio final com braço adversarial

Data: 2026-11-15. Branch: `fix/measure-e26`. Revisão 2, com DEC-732 a DEC-737 ratificadas. Base: DEC-722 (bloco B), DEC-729 (desenho de E27 B) com a emenda de DEC-734 (correção semeada nas peças 3 e 4), DEC-728 (teto e sessão), DEC-703/704/705/707/708 (E27 passada A), passo 0 e peças 1 e 2 de E26. Só `tools/measure/`. Teste antes, sem bump. Prepara E27 passada B; não roda lote pago.

## Objetivo

- **Peça 3 de E27:** medir se a revisão por tarefa restrita (achados abertos + diff da correção, modo de E21) perde captura frente à completa, com o laço do produto, num caso em que a 1ª correção deixa 1 resíduo e cria 1 regressão.
- **Peça 4 de E27:** medir, no estágio de revisão final, o braço atual contra o adversarial (verificação `Mode: verify.` de E24). A onda única (`singleWave`) sai do lote atual, sem lote próprio.

Por que a correção semeada: o passo 0 achou que a maioria dos casos verdadeiros pós-correção nasceu da própria correção (spec 4 de 5, final 5 de 9). Sementes plantadas antes da 1ª revisão deram teto em E27 A (40/40) e em E26 peças 1 e 2 (39/40, 40/40).

## Escopo

Dentro: B1 a B4 abaixo, em `tools/measure/` e nos testes de lá.

Fora: `plugins/` e `roadmap-release.js` (só lidos), a peça 2 de E27 (passada C, DEC-703), o braço parar contra decidir e seguir (DEC-706), a fix de `task-reviewer.md` (DEC-708, já separada), qualquer lote pago.

## Fatos lidos no código (HEAD de release/roadmap-skills-v2)

- **Revisão por tarefa** (`roadmap-release.js` 2600-2620): `reviewLoop('T<n>:<kind>', ...)` com `TR = { restricted: (CFG.taskReview || {}).restricted === true }` e opções `{ tier: implModel(t), reviewModel: reviewModelFor(t), haltOn, byId: true }`. O revisor é `revAgent` (`agentType: 'productivity-tools:task-reviewer'`, schema `S_TASKREVIEW` com `verdicts[{id, open}]`). A verdade é `reviewTruth({ ...r, issues: taskIssues(r, cx) }, ...)`.
- **Modo restrito** (puras, linhas 382-392 e 591): `restrictedRound(c)` só vale da 2ª rodada em diante, com `taskReview.restricted` e todos os achados abertos com `id`. Aí o `Range:` vira `node "<pluginRoot>/scripts/review-package.mjs" "<wt>" <was.head> HEAD "<diffPath>"`, e `taskIssues` junta os achados novos com os abertos que nenhum veredito fechou.
- **Tarefa 3 do cenário legado:** `tier: sonnet`, `reviewTier: sonnet`, logo corretor sonnet e revisor sonnet/medium (o mesmo da política de DEC-707).
- **Revisão final** (2658-2683): `FRA = { agentType: 'productivity-tools:final-reviewer', phase: 'Final review', model: 'opus', effort: 'high' }`; lentes `card.critical ? ['correctness', 'security'] : ['all']` (o card E5 da sandbox tem `critical=false`, logo uma lente); com `FR.adversarial === true` e bloqueante, um agente `Mode: verify.` + `fmt(bl)` (schema `S_VERIFY`), e `splitRefuted` tira os refutados; corretor `final-fix<k>` em `tier`; verdade `reviewTruth(r, 1, ...)`; opções `{ tier: 'sonnet', reviewModel: 'opus', once: FR.singleWave === true }`.
- **Onda única** (`runReviewLoop`, 507-552): com `once`, `lim = min(1, maxFix)` e sem rodada bônus. A sequência é `[review1, fix1(sonnet), review2(opus)]`, idêntica ao começo do laço sem `once`; o desfecho é `ok` se a verdade de `review2` não tem issue dura. Por isso a onda única é o prefixo do laço até a 2ª revisão (DEC-729).
- Todas as funções usadas (`runReviewLoop`, `buildTaskReviewPrompt`, `briefing`, `restrictedRound`, `taskIssues`, `splitRefuted`, `blocking`, `reviewTruth`, `fmt`, `repeatRule`, `effortFor`, `maxModel`, `isHard`) estão no bloco `// <pure>` (56-1271). O texto do prompt final e do corretor final não está: fica no corpo do workflow.
- **Arnês hoje:** `--stage task-review` só em rodada única, com prompt `built-in` (vem de `buildTaskReviewPrompt`) e `reviewSchema` sem `verdicts`; `--rounds loop` em task-review dá `UsageError` (teste do bloco A). `rolesByLabel` põe em `other` o que não tem `fix` nem `review`.

## Comportamento por item

### B1. Correção semeada (cenário e sementes)

- **Variantes novas:** `correcao-semeada-A` e `correcao-semeada-B`, `class: 'code'`, `set: 'e5-fix'`. A base é a mesma de `codigo-semeado-A/B`: T1 e T2 limpas, T3 com C1..C4 (A) ou C5..C8 (B) num commit (`seededCommit`).
- **Commit da correção semeada** (`fixSha`), criado por `make-scenario` depois do `seededCommit` e nunca apontado por ref:
  1. Parte da árvore de `seededCommit`, volta os arquivos de T1..T3 ao estado limpo (o que remove os 4 defeitos C) e aplica `seed(dir, id)` do resíduo e da regressão do artefato.
  2. Grava com `git write-tree` + `git commit-tree -p <seededCommit>`, mensagem `E5 T3: fix review findings`, sem mexer em `feat/E5` nem no reflog; `git config gc.auto 0` na sandbox. `feat/E5` fica no `seededCommit`.
  3. Recusa (erro do cenário) se a suíte da sandbox (`runSandboxSuite`) não passar em `fixSha`: a correção semeada não pode ser acusada por código (mesma regra de DEC-724).
  - `scenario.fixSha` e `scenario.fixEntries` entram no cenário e no agregado (`harness.seededFix = { sha, ids }`).
- **Sementes da correção** (manifesto, `set: 'e5-fix'`, `sentinel: 'sentinels/fix.mjs'`, `introducedBy: 'fix'`, `detectedBy: 'reviewer'`). Candidatas; a âncora final é do executor, com a regra de troca do bloco A:

  | Id | Art. | Tipo | Âncora candidata |
  |---|---|---|---|
  | CR1 | A | resíduo de C2 (`residueOf: 'C2'`) | o teste de `wordCount` volta a importar `assert` e a afirmar `'the quick fox'`, mas `wordCount('')` segue sem asserção |
  | CG1 | A | regressão (ao tirar o `helpers.mjs` de C4) | `src/index.mjs` deixa de reexportar `truncate` (nenhum teste importa do index) |
  | CR2 | B | resíduo de C5 (`residueOf: 'C5'`) | `max === 0` volta a lançar `RangeError`, mas `max` negativo segue devolvendo `''` |
  | CG2 | B | regressão (ao tirar o valor fixo de C8) | `wordCount` perde o `trim` e conta 1 palavra em texto só de espaços (o teste só cobre `''`) |

- **Regra de troca.** Um id cuja âncora a suíte acusa em `fixSha`, ou que o `present` não distingue (verdadeiro em `fixSha`, falso no T3 limpo), vira um id novo (CR3/CG3 em diante) com `replaces`; o executor lista a troca no relatório. Cada artefato fica com exatamente 1 resíduo e 1 regressão (DEC-729).
- **Defeitos C nas variantes novas.** Ficam no manifesto do set `e5`; as variantes `e5-fix` não os contam (o `fixSha` os remove por construção). Só CR/CG entram em `outcomes`.

### B2. Peça 3: task-review em laço, completa contra restrita

- **Opções.** `--stage task-review --rounds loop` passa a valer só com `correcao-semeada-A/B`, `--arm atual|restrita` e `--review-model` (obrigatório, DEC-700). `codigo-semeado-*` em laço e `correcao-semeada-*` em rodada única dão `UsageError`. A rodada única de `codigo-semeado-*` gera o mesmo script de hoje, byte a byte (golden congelado antes).
- **Braços** (ambos `built-in`, sem arquivo de braço): `atual` = revisão completa (`TR.restricted = false`, o padrão do produto); `restrita` = `TR.restricted = true`. Nada mais muda entre eles.
- **Recusas na partida** (além das do bloco A, sobre o trecho entre `` reviewLoop(`T${t.n}:${kind}`, `` e o `reviewLoop(` seguinte): faltam `byId: true })`, `taskReview: TR`, `(CFG.taskReview || {}).restricted === true`, `taskIssues(r, cx)` ou `revAgent(buildTaskReviewPrompt(`; falta `function restrictedRound` ou `function taskIssues` no bloco puro; `scripts/review-package.mjs` ausente no plugin medido.
- **`STAGE_LOOP['task-review']`:** `{ tier: 'sonnet', reviewModel: <--review-model>, reviewEffort: effortFor(...), maxFix: 2, byId: true }`.
- **Script** (bloco puro literal + constantes `H_`, como em A1):
  - `ctx` igual ao da rodada única de hoje, mais `taskReview: H_TR`, `pluginRoot` = instalação medida, `was` (vindo do laço) e `diffPath` = `<work>/_tmp/E5-t3-spec<round>.diff`, **fora** da sandbox (senão `reviewTruth` acusa árvore suja).
  - `review(round, prev, rvModel, was)`: `agent(buildTaskReviewPrompt(cx = ctxFor(...), {n: 3, title}, 'spec', cur), { agentType: 'productivity-tools:task-reviewer', schema: H_SCHEMA_TASK, label: 'E5:task-review' + round, model: rvModel || H_RM, effort: effortFor(rvModel || H_RM) })`. `H_SCHEMA_TASK` copia `S_TASKREVIEW` (com `id` e `verdicts`). Só o `kind` `spec`, como na passada A.
  - `fix(iss, k, tier)`:
    - `k === 1`: **aplicador**, `agent(H_APPLY, { label: 'E5:task-review-fix1', model: 'haiku', effort: 'low', schema: { checks } })`. `H_APPLY` manda rodar exatamente `git -C "<sb>" merge --ff-only <fixSha>` e depois os checks da tarefa 3 (`node --test`), e devolver os checks com saída real. O script põe `cur.summary = 'Fixed the findings ' + ids de iss` e `cur.checks` do aplicador; devolve `{ status: 'DONE' }`.
    - `k >= 2`: o corretor de HEAD, com o `fixPrompt` da rodada única de hoje, `fmt(iss)`, `model: tier, effort: effortFor(tier)`, rótulo `E5:task-review-fix<k>`; atualiza `cur` como o produto.
  - `truth = r => reviewTruth({ ...r, issues: taskIssues(r, H_lastCx) }, 1, '<seededCommit>~1..HEAD')`.
  - Devolve também `restricted: [restrictedRound(cx) por rodada]`.
- **Como o desfecho é decidido** (ver B4).

### B3. Peça 4: estágio final, atual contra adversarial

- **Estágio novo** `final-review` em `STAGES`: `variant: /^correcao-semeada-[AB]$/`, `fix: 'final-fix'`, `label: 'E5:final-review'`, só `--rounds loop`, `--arm atual|adversarial`.
- **Braços de prompt** (dados, copiados de HEAD com `Copied from`, conferidos por `armMatches` como no bloco A):
  - `arms/final-review-atual.md`: `Mode: review, lens: {{lens}}. Diff: git -C "{{wt}}" diff {{TARGET}}...HEAD` e `Spec {{specPath}}, plan {{planPath}}, {{cardRef}}.`
  - `arms/final-fix-atual.md`: `Fix the final review problems below and commit "{{E}} final-fix: ...". {{lockNote}} {{noSpecEdit}}` e `{{issues}}`.
  - O prefixo `C()` é `briefing(ctx)` da região pura. O `base` do ctx do estágio final nomeia a worktree (a sandbox), a branch `feat/E5` e o alvo `main`: o modo verify não tem linha `Diff:` e lê os dois do briefing; `Previous issues (${repeatRule()})` e `Mode: verify.` ficam no código, com recusa se o literal sumir do trecho `reviewLoop('final',`.
  - Os dois braços de arnês (`atual` e `adversarial`) usam os mesmos dois arquivos; `--arm adversarial` só liga a verificação.
- **Recusas na partida** (trecho `reviewLoop('final',` até o `reviewLoop(` seguinte): faltam o literal de `FRA`, `{ tier: 'sonnet', reviewModel: 'opus', once: FR.singleWave === true })`, `FR.adversarial === true && bl.length`, `card.critical ? ['correctness', 'security'] : ['all']`, `reviewTruth(r, 1,` ou `Mode: verify.`.
- **Script:**
  - `review(round, prev)`: uma lente `all`, `agent(briefing(ctx) + '\n\n' + H_FINAL_REVIEW + (prev ? '\nPrevious issues (' + repeatRule() + '):\n' + prev : ''), { label: 'E5:final-review' + round, schema: H_SCHEMA_FINAL, ...FRA })`. No braço adversarial, com bloqueante: `agent(briefing(ctx) + '\n\nMode: verify.\n' + fmt(bl), { label: 'E5:final-verify' + round, schema: H_SCHEMA_VERIFY, ...FRA })`, depois `splitRefuted` como no produto.
  - `fix`: `k === 1` o mesmo aplicador de B2 (rótulo `E5:final-review-fix1`); `k >= 2` o braço `final-fix-atual` em `tier`.
  - `truth = r => reviewTruth(r, 1, 'main..HEAD')`; opções `{ tier: 'sonnet', reviewModel: 'opus' }`, sem `once` nos dois braços.
- **Onda única derivada** (só no braço `atual`, sem chamada extra): o replay de B4 roda de novo com `{ ..., once: true }`, alimentado pelos resultados gravados no diário (`E5:final-review1`, `-fix1`, `E5:final-review2`). O `ok` desse replay decide o estágio da onda única; os desfechos são os sentinelas em `fixSha` (CR e CG presentes por construção): `perdido` se `ok`, `indeterminado` (parada) se não. Uma tentativa sem `fix1` já sai inválida (`sem-correcao` ou `refutou-tudo`, B4).
- **Papéis.** `rolesByLabel` ganha o balde `verify` (rótulos com `verify`), para o custo do braço adversarial sair separado.

### B4. Validade, desfecho e anti falso positivo (peças 3 e 4)

- **Validade** (tentativa inválida, com motivo):
  - `formato-do-diario`: `E5:<stage>1` sem `issues` em lista.
  - `sem-correcao`: a 1ª revisão não teve issue dura, logo a correção semeada não entrou.
  - `refutou-tudo` (só braço `adversarial`): a 1ª revisão teve bloqueante e o verify refutou todos, logo não houve correção. Sem este motivo cairia em `sem-correcao`; pela DEC-737 conta como dano. Tem contador próprio no topo (`refutouTudo`), separado das inválidas por infraestrutura.
  - `correcao-semeada-ausente`: `git rev-parse <E5:<stage>2.headSha>^{commit}` (o revisor pode abreviar o SHA) diferente de `fixSha`, ou `fixSha` não é ancestral de `feat/E5`.
  - `restrita-nao-ativada` (só braço `restrita`): o script devolveu `restricted[1] === false` (achado sem `id` na 1ª revisão: o modo cairia no completo).
  - `laco-infra`: revisão ou correção nula depois do retry (bloco A).
  - `laco-divergente`: o `ok` do replay difere do `ok` devolvido pelo script, ou o diário tem rótulo do estágio não usado ou repetido (2 num lote param o lote, DEC-737).
- **Replay por estágio** (DEC-737). `loopResult` (hoje em `run-batch.mjs`, linha 1061, e usado na 1396 para decidir `approved`/`stopped`) passa a receber a verdade e as opções do estágio:
  - task-review: `byId: true`; `reviewTruth({ ...r, issues: taskIssues(r, cx) }, 1, ...)`, com `cx` reconstruído por rodada (`was = { iss: fixable, head: headSha da revisão anterior }` e `taskReview.restricted` do braço).
  - final-review: na revisão `r`, se houver `E5:final-verify<r>` no diário, aplica `splitRefuted(blocking(r), verify.result)` antes de `reviewTruth(r, 1, ...)`.
  - spec e plano seguem como no bloco A.
- **Desfecho no fim** (laço): sentinelas de CR/CG no tip de `feat/E5`; estágio `approved` se o replay terminou `ok`, senão `stopped`; `outcomeFor` sem mudança: ausente = `capturado`, presente e aprovado = `perdido`, presente e parado = `indeterminado`.
- **Por que o corretor de HEAD decide:** sem 2ª correção a árvore final é `fixSha`, onde CR e CG estão presentes; logo `capturado` exige que a revisão ≥ 2 tenha bloqueado e que o corretor de HEAD (`fix2` em diante) tenha removido o defeito. É a cadeia revisor + corretor, como na passada A.
- **Conferência de `afterFirstFix`:** `git rev-parse <headSha>^{commit}` igual a `fixSha` e `present` verdadeiro para CR e CG nesse commit; se algum vier falso, a tentativa é inválida (`semente-ausente`), não captura. Nos estágios task e final isso substitui a conferência por blob de `afterFixVerified`, que com `blobKey` nulo daria sempre "não verificado".
- **Falso positivo (captura sem o revisor ter visto).** O `fix2` pode remover o defeito por acaso ao corrigir outro achado. Cada entrada CR/CG leva `mention` (regex sobre `file` + descrição, testada contra uma frase-modelo). O agregado grava, por tentativa, `mentionedAfterFix: { id: bool }` (revisões ≥ 2, incluindo veredito `open: true` do id do resíduo no modo restrito). O id do resíduo é o id do achado da 1ª revisão cujo `file` e descrição casam com o `mention` do CR; sem esse achado pai, a tentativa soma em `residuoSemAchadoPai` (mais de 2 num lote param o lote, DEC-734). No topo, `capturadoSemMencao` e `perdidoDoCorretor` (presente no fim e mencionado). A regra de decisão usa o sentinela (como na passada A); os dois contadores vão ao relatório, como o "ajuste perdido do corretor" de E27 A. O relatório também reconta com `capturadoSemMencao` como `indeterminado`: se isso mudar o lado da regra, o resultado é inconclusivo (DEC-732).
- **Refutação de verdadeiro** (peça 4, adversarial): `refutedSeeded` conta veredito `refuted: true` cujo achado bate o `mention` de CR/CG; `refutedTotal` conta todos.
- **Agregado** (novo ou alterado): `harness.seededFix`, `harness.taskReview: { restricted }`, `harness.finalReview: { adversarial }`; por tentativa `loop.restrictedRounds`, `mentionedAfterFix`, `verify: { calls, refutedTotal, refutedSeeded, refutedByRound }`, `singleWave: { ok, outcomes }` (final atual); topo `outcomesSingleWave`, `singleWaveStopped`, `capturadoSemMencao`, `perdidoDoCorretor`, `residuoSemAchadoPai`, `refutouTudo`, `rolesByLabel.verify`.

## Arquivos (DEC-729 e DEC-736: 6 fora os testes)

Contagem estrita (código e dados somados), sem a divisão de DEC-730 (DEC-736):

- Código (4): `tools/measure/run-batch.mjs`, `tools/measure/make-scenario.mjs`, `tools/measure/defects/manifest.json`, `tools/measure/defects/sentinels/fix.mjs` (novo; `seed` e `present` de CR1, CG1, CR2, CG2).
- Dados (2): `tools/measure/arms/final-review-atual.md`, `tools/measure/arms/final-fix-atual.md` (novos).
- Intactos: `checkpoint.mjs` (o `armStatus` já lista todo `*-atual.md`), braços e sementes do bloco A, `C*.mjs`.
- Testes: `run-batch.test.mjs`, `review-loop.test.mjs`, `make-scenario.test.mjs`, `checkpoint.test.mjs`.

## Aceite (verificável por `node --test`)

1. **B1:** em `correcao-semeada-A/B`, `feat/E5` fica em `seededCommit`; `fixSha` tem pai `seededCommit`, não tem ref nem entrada de reflog; a suíte passa em `fixSha`; para cada CR/CG, `present` é verdadeiro em `fixSha` e falso no T3 limpo; os sentinelas C1..C8 dão ausente em `fixSha`, salvo o C cujo sentinela coincida com o resíduo (o teste registra qual); cada artefato tem 1 resíduo e 1 regressão no manifesto; as variantes antigas não mudam.
2. **B2, script:** o golden da rodada única de `codigo-semeado-A` (task-review) não muda; o script de laço contém o bloco puro byte a byte, compila com `AsyncFunction` e fica abaixo de 200.000 caracteres sobre o workflow real.
3. **B2, agente simulado:** braço `restrita` com achados `F1..Fn` dá, na rodada 2, prompt com `Mode: restricted, spec` e `review-package.mjs ... <seededCommit> HEAD`; braço `atual` dá `Range: git -C ... log -p`; `fix1` é o aplicador haiku com `merge --ff-only <fixSha>`; `fix2` é o corretor de HEAD em sonnet; achado repetido escala para opus com revisão em opus; achado sem `id` no braço restrito dá `restrita-nao-ativada`.
4. **B2, recusas** (saída 2, sem `claude -p`): laço com `codigo-semeado-*`; `correcao-semeada-*` em rodada única; fixture sem `byId: true })` no trecho da tarefa; sem `review-package.mjs`.
5. **B3:** `final-review-atual.md` e `final-fix-atual.md` casam com HEAD; uma fixture defasada dá `UsageError`; o braço adversarial chama `E5:final-verify<r>` só com bloqueante e tira os refutados por `splitRefuted`; o braço atual nunca chama verify; recusa por fixture sem o literal de `once: FR.singleWave === true })`.
6. **B3, onda única:** para cada sequência simulada (limpa na 1ª; limpa após `fix1`; bloqueia após `fix1`; só menores após `fix1`), o `ok` do replay é igual ao de `runReviewLoop(..., { once: true })` rodado direto com o mesmo agente simulado, e as chamadas dele são o prefixo das do laço.
7. **B4:** os sete motivos de invalidez (`formato-do-diario`, `sem-correcao`, `refutou-tudo`, `correcao-semeada-ausente`, `restrita-nao-ativada`, `laco-infra`, `semente-ausente`) saem nos casos montados, e `refutou-tudo` tem contador no topo; um `headSha` abreviado de `fixSha` é aceito; `capturado` exige `fix2` (sem `fix2`, CR/CG ficam `perdido` ou `indeterminado`); `capturadoSemMencao`, `perdidoDoCorretor`, `residuoSemAchadoPai`, `refutedSeeded` e `refutedByRound` contados certo em diário de fixture; `rolesByLabel.verify` separado.
8. **B4, replay:** nos quatro braços (task `atual` e `restrita`, final `atual` e `adversarial`), com agente simulado, o `ok` do replay por estágio é igual ao `ok` devolvido pelo script; um diário adulterado (um veredito trocado) dá `laco-divergente`.
9. Suíte inteira verde: `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"`; nenhum arquivo fora de `tools/measure/` no diff da branch.

## Sonda e projeção de custo (teto E27 B US$ 60, DEC-728; prioridade e paradas de DEC-736)

- **Sessão:** sonnet, `--max-budget-usd 3` por sessão, `--stop-on-denial`, em série (porta 48731).
- **Sondas** (1 execução cada, `correcao-semeada-A`): peça 3 `atual` e `restrita` (`--review-model sonnet`, DEC-707); peça 4 `atual` e `adversarial`.
- **Custo por tentativa** de cada braço: `max(cliCostUsd, transcriptCostUsd + soma dos papéis)`, porque ainda não se sabe se `total_cost_usd` inclui os agentes do Workflow (incógnita de A5).
- **Projeção** com 10 válidas por braço nas duas peças (DEC-732, DEC-733): `P3 = Σ braços (custo da sonda × 10)`, `P4 = Σ braços (custo da sonda × 10)`, mais o gasto das sondas. Não entra margem inventada: o critério é a soma.
- **Prioridade** (DEC-736): as sondas e a peça 3 vêm primeiro; a peça 4 fica com o resto do teto, até US$ 45.
- **Paradas antes do lote:**
  - Peça 3 sozinha acima de US$ 20: para e pergunta (DEC-732, DEC-736).
  - Sondas + `P3 + P4` acima de 60: sai o braço adversarial; se mesmo sem ele passar de 60, para e pergunta (DEC-736).
  - `P4` acima de 45: o dono corta um braço (DEC-729).
- **Paradas durante o lote:** mais de 3 inválidas (padrão de DEC-725); 2 `correcao-semeada-ausente` ou mais de 2 `residuoSemAchadoPai` (DEC-734); 2 `laco-divergente` (DEC-737).
- **Referências de fonte, só para ordem de grandeza:** sessão sonnet do laço de spec com revisor opus, US$ 3,61 a 3,74 por 5 execuções (E26 peça 1); agentes de task-review em rodada única, US$ 0,123 (sonnet) e 0,176 (opus) por tentativa (E27 A). Não há fonte para o custo do revisor final opus/high; a sonda dá.

## Decisões (ratificadas pelo dono via Fable, DEC-732 a DEC-737)

As decisões do executor da revisão 1 foram ratificadas: 1, 2, 5, 6, 7 e 11 como propostas; 3, 4, 8, 9 e 10 com emenda.

- **DEC-734** (emenda a DEC-729): a correção semeada vale nas peças 3 e 4 (decisões 2 e 3). O commit não tem ref, é aplicado por haiku/low com `merge --ff-only` e o SHA é conferido por `git rev-parse`. Entra com qualquer lista da 1ª revisão (decisão 4), com o contador `residuoSemAchadoPai`. Só CR/CG contam; as âncoras são candidatas (decisão 11).
- **DEC-735** (forma do arnês): laço em task-review só com `correcao-semeada-A/B` e `--arm atual|restrita` `built-in` (decisões 6 e 7). `codigo-semeado-*` em laço segue recusado, com o golden da rodada única congelado. Só o `kind` spec (decisão 5) e a lente `all` (decisão 8). Emenda da 8: o resultado não vale para card crítico de duas lentes. Rótulos `E5:final-*`.
- **DEC-736:** contagem estrita de 6 arquivos (decisão 1). Teto de 60 com as sondas e a peça 3 primeiro; a peça 4 fica com o resto, até 45. Acima de 60 sai o adversarial (substitui a divisão fixa da decisão 10).
- **DEC-737:** o desfecho é pelo sentinela, e `mention` é auxiliar (decisão 9). Emenda da 9: se a recontagem com `capturadoSemMencao` como indeterminado mudar o lado da regra, o resultado é inconclusivo. Replay por estágio; `refutou-tudo` conta como dano.
- **Regras fixadas antes do lote** (substituem a questão aberta de n):
  - DEC-732, peça 3: 10 válidas por braço (5 por artefato), 20 oportunidades. A restrita só entra com 16 ou mais determinadas por braço e até 2 capturas a menos que a completa. Os dois braços em 19 ou mais é teto; completa abaixo de 10 é piso; nos dois casos fica a completa.
  - DEC-733, peça 4: 10 válidas por braço, 20 oportunidades. A adversarial só entra com 16 ou mais determinadas, até 2 capturas a menos, nenhum semeado refutado e pelo menos 1 falso bloqueante refutado. A onda única só entra se o laço também parar em mais da metade das paradas dela; com menos de 8 paradas da onda única, é inconclusivo.
  - O arnês não fixa n (`--runs`); os contadores de B4 dão o que as duas regras pedem.

## Riscos

- **Modo restrito pode não ligar** (achado sem `id`): motivo `restrita-nao-ativada` e contagem por lote.
- **Aplicador desobedecer** (haiku faz outra coisa): `correcao-semeada-ausente`; 2 num lote param o lote.
- **Revisor ver o objeto solto** de `fixSha` (`git fsck`, `cat-file --batch-all-objects`): improvável; a mensagem é neutra e não há ref nem reflog.
- **Suíte ou checks acusam a regressão:** pego na criação do cenário (B1), troca de id.
- **`fix2` corrige por acaso:** `capturadoSemMencao` no relatório.
- **`run-batch.mjs` cresce** (hoje 1.505 linhas): sem módulo novo, para caber nos 6 arquivos.
- **Custo da revisão final opus/high desconhecido:** sonda e gatilho de US$ 45.
- **Efeito teto também aqui:** se os dois braços capturarem tudo, DEC-705 vale (teto não é equivalência).

## Tarefas (ordem; até 4 arquivos cada; teste antes)

Comandos: por tarefa `node --test tools/measure/<arquivo>.test.mjs`; antes de cada commit, a suíte inteira. O "(opus)" ou "(sonnet)" de cada tarefa é o tier do revisor: opus em T1, T2, T3, T5 e T6 (semeadura, laço e desfecho), sonnet em T4. O implementador é sonnet/medium em todas e só sobe a opus na 2ª falha. Portão final da branch: T3 (opus, high).

1. **T1. B1: correção semeada** (opus). Arquivos: `make-scenario.mjs`, `defects/manifest.json`, `defects/sentinels/fix.mjs`, `make-scenario.test.mjs`. Teste primeiro: aceite 1.
2. **T2. B2: script do laço de tarefa** (opus). Arquivos: `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs`. Golden da rodada única de task-review primeiro; depois opções, recusas, `STAGE_LOOP['task-review']`, aplicador e braços. Aceite 2, 3 e 4. O teste do bloco A que recusava laço em task-review é estreitado, não removido: segue recusando `codigo-semeado-*` em laço.
3. **T3. B4: validade, desfecho e replay de tarefa** (opus). Arquivos: `run-batch.mjs`, `run-batch.test.mjs`. Motivos, `rev-parse ^{commit}` contra `fixSha`, `loopResult` por estágio (ramo task), `mention`, `residuoSemAchadoPai`, contadores. Aceite 7 (menos `verify` e `refutou-tudo`) e 8 (braços task).
4. **T4. B3: braços finais** (sonnet). Arquivos: `arms/final-review-atual.md`, `arms/final-fix-atual.md`, `checkpoint.test.mjs`, `run-batch.test.mjs`. Teste primeiro: casam com HEAD; defasado dá `UsageError`. Aceite 5 (parte de braços).
5. **T5. B3: estágio final em laço** (opus). Arquivos: `run-batch.mjs`, `review-loop.test.mjs`, `run-batch.test.mjs`. `STAGES['final-review']`, recusas, briefing com worktree/branch/alvo, verify, `splitRefuted`, `refutou-tudo`, `refutedByRound`, balde `verify`. Aceite 5 e o restante do 7.
6. **T6. B3: replay final e onda única** (opus). Arquivos: `run-batch.mjs`, `run-batch.test.mjs`. `loopResult` por estágio (ramo final com `E5:final-verify<r>`), replay com `once: true`, `singleWave`, agregado. Aceite 6, 8 (braços final) e 9.

Depois da T6, portão final com a suíte inteira verde. As sondas e os lotes são do dono (DEC-728, DEC-729).
