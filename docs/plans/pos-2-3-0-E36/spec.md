# Spec E36 -- Gate de testes com remoção declarada

## Intenção

Em cumprimento a `REQ-003` e `DEC-006`, o gate `tests` do `roadmap-release` passa a aceitar um total de testes menor que a baseline quando a queda se explica só por testes removidos que a spec ou o plano declaram por nome e que um script conferiu contra o código e contra a saída gravada da branch. Hoje `gatePasses` (`plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`, l. ~238) compara o total bruto: na remoção do modo single, 3 testes obsoletos apagados levaram o G1 de 2175 para 2172 sem nenhuma falha e custaram 2 rodadas de `gates-fix` em opus. Com E36, (1) a declaração é um campo de dados (`removedTests`) nos blocos `spec/1` e `plan/1`; (2) a conferência por nome é feita por um subcomando novo do extrator determinístico do E41 (`plugins/productivity-tools/scripts/test-extract.mjs`, como manda a `DEC-030`), que devolve uma linha assinada; (3) `gatePasses` e `mergeFloor` descontam só as entradas conferidas; (4) `branchGates` deixa de despachar `gates-fix` quando a única falha é o total, parando com uma mensagem que manda declarar e retomar.

As escolhas de formato, do conferidor, da regra de passagem, do comportamento do AC2 e do que fica de fora são do dono, decididas por um subagent Fable a quem ele delegou (intake desta spec); estão em `R1` a `R5`. As demais (`R6` em diante) são decisões autônomas desta spec.

## Escopo

Dentro:

- `plugins/productivity-tools/scripts/spec-tool.mjs`: `removedTests` em `TOP`, validação de tipo exportada (`checkRemovedTests`) e usada por `checkSpec`.
- `plugins/productivity-tools/scripts/plan-tool.mjs`: `removedTests` em `TOP`, mesma validação, e o campo no emit enxuto (`leanEmit`) só quando presente.
- `plugins/productivity-tools/scripts/test-extract.mjs`: função exportada que lista todos os nomes executados (passando, falhando, pulados) de uma saída node:test, e o subcomando `removed`, que confere as declarações e imprime uma linha assinada.
- `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`: `gateFromCapture` guarda o caminho e o sha256 da saída gravada; `gatePasses`, `allPass` e `mergeFloor` recebem o desconto; `branchGates` ganha o curto-circuito e a chamada ao conferidor; `postMerge` passa o desconto conferido a `mergeFloor`; os prompts das revisões de plano e final ganham uma cláusula contra mascaramento quando há declaração.
- `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`: uma linha cada sobre quando e como declarar `removedTests`.
- Testes: `gates.test.mjs`, `flow.test.mjs` (workflow), `test-extract.test.mjs`, `spec-tool.test.mjs`, `plan-tool.test.mjs` (scripts), e os testes de prompt e tamanho que mudarem por consequência.

Fora (decisão do dono, `R5`):

- `plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js` (`waveGatePasses`, l. ~1102-1110): só compara exit e nomes, não o total, então não precisa de desconto.
- Gates em fallback (formato que o extrator não conhece) ou com `ignoreFailuresWhenChanged`: desconto 0, comportamento atual.
- Aceite manual de remoção não conferível (teste gerado em laço, nome ambíguo): não há atalho; o operador ajusta o teste ou a baseline por fora.
- O programa de test-integrity (`TEST_INTEGRITY_DEFAULT`, l. ~1612) e o bloqueio de `integrityHardAlerts` na retomada pós-merge (l. ~2380).
- `merge-fix` em `postMerge`: segue igual (ver `R11`).

Não fazer:

- Não editar `plugins/productivity-tools/lib/` (o conferidor só importa `MAX_COPY_BYTES`, `canon`, `fnv1a` e `readDataBlock` de lá); `embed.mjs --check` não muda.
- Não passar nomes de teste por argv: o conferidor lê as declarações dos próprios arquivos de spec e plano.
- Não aceitar nenhuma redução de total sem conferência: sem linha assinada válida, o desconto é 0.
- Não permitir que o agente de `gates-fix` edite spec ou plano (`noSpecEdit` continua valendo); a declaração entra pela retomada (`R9`).
- Não passar de +4.000 caracteres LF em `roadmap-release.js` (`R14`).

## Desenho

### AC1 -- gatePasses e mergeFloor com remoção declarada

**Declaração.** `removedTests` é uma lista opcional no topo dos blocos `spec/1` e `plan/1`, de objetos `{ file, name, why, gate? }`: `file` é o caminho do arquivo de teste na base (relativo à raiz do repositório, com `/`), `name` é o nome do teste como o node:test imprime (sem o prefixo `arquivo::`), `why` diz por que sai, e `gate` (opcional, `R6`) restringe a entrada a um gate `tests` pelo nome; sem `gate`, a entrada vale para todo gate de `kind: tests`. Vale a união das duas listas: a spec declara a intenção e o plano acrescenta o que descobrir. `checkRemovedTests` em `spec-tool.mjs` (exportada e importada por `plan-tool.mjs` e `test-extract.mjs`) dá erro `field-type` se o valor não for lista, se uma entrada não for objeto ou se `file`, `name` ou `why` não forem strings não vazias (e `gate`, quando presente), erro `removed-duplicate` para `(file, name, gate)` repetido na mesma lista e também para o mesmo par `(file, name)` declarado uma vez sem `gate` e outra com `gate` na mesma lista (o mesmo par com dois gates diferentes é válido), e aviso `field-unknown` para chave desconhecida. Com o campo em `TOP`, o aviso `field-unknown` de topo some. O `leanEmit` de `plan-tool.mjs` passa a levar `removedTests` só quando a lista existe e não está vazia, de modo que o digest dos planos sem declaração (inclusive os congelados) não muda (`R10`); o emit da spec já leva o bloco inteiro, e `specLoad.data.removedTests` chega ao workflow.

**Conferidor.** `test-extract.mjs` ganha `allTestNames(text)` (exportada, pura: todos os nomes de teste de uma saída TAP ou spec do node:test, `ok`, `not ok`, `# SKIP` e `# TODO`, excluindo suites, com `cleanName`) e o subcomando `removed --nonce <n> --spec <spec.md> --plan <plan.md> --base <ref> --cwd <worktree> --output <arquivo> --sha <sha256> --gate <nome> [--single-tests-gate]`. Ele lê o bloco de dados dos dois arquivos com `readDataBlock`, valida com `checkRemovedTests` (lista inválida é recusa), e recusa (`{ tool: 'test-extract', command: 'removed', nonce, error }`, exit 2; o nonce vai na recusa para o workflow reconhecê-la como desta chamada) se o sha256 de `--output` não for `--sha`, para que a conferência leia exatamente a saída que o capture assinou (`R7`). Filtra as entradas com `gate` igual a `--gate` e as sem `gate`; uma entrada sem `gate` só é conferível quando o workflow passa `--single-tests-gate` (há um único gate `tests` elegível na configuração); sem a flag, ela fica não conferida com motivo `gate obrigatório` (`R6`). Depois do filtro, deduplica por `(file, name)` (spec e plano, com e sem `gate`) e confere cada par uma vez: (i) o literal do nome existe exatamente uma vez em `git show <base>:<file>` e essa ocorrência é o 1º argumento de uma chamada `test(` ou `it(`, inclusive `test.skip(`, `test.only(`, `test.todo(`, `it.skip(`, `it.only(` e `it.todo(`; (ii) o literal não existe em `HEAD:<file>` ou o arquivo sumiu em `HEAD`; (iii) `nameKey(name)` não está entre os `nameKey` de `allTestNames` da saída. A busca do literal (`R8`) normaliza CRLF para LF e procura o nome entre aspas simples, duplas ou crases, com a aspa e a barra invertida escapadas como o JS escreveria; template com `${` não casa. Falha fechada, com o motivo: teste gerado em laço (zero literais), nome que aparece mais de uma vez na base, literal único que está em `describe(`, `suite(` ou fora de uma chamada de teste, nome que continua no arquivo em `HEAD` ou que ainda roda na saída. Assim um `describe` declarado junto com seus 3 testes dá `verified` 3, não 4. A saída é uma linha `sign({ tool: 'test-extract', command: 'removed', nonce, gate, base, outputSha, verified, unverified: [{ file, name, reason }], unverifiedCut })` (digest `fnv1a(canon(resto))`, a mesma convenção que `checkRun` confere), com `unverified` cortado para a linha caber em `MAX_COPY_BYTES` (3.500) e `unverifiedCut` com o número omitido; `verified` conta pares `(file, name)` distintos.

**Ligação à saída gravada.** `gateFromCapture` (l. ~190), para gate `tests` não fallback, passa a guardar `outPath` e `outSha` (os campos `path` e `sha256` da linha do capture, já conferida por `checkCapture`). O conferidor só roda para gate com esses dois campos; os demais têm desconto 0.

**Regra de passagem.** `gatePasses(def, result, baselineResult, removed = 0)` continua pura e troca só a comparação do total por `(result.total || 0) >= Math.max(1, ((b && b.total) || 0) - removed)`, aceitando `removed` só quando é inteiro maior que 0 (outro valor conta 0); `skipped <= baseline` e falhas contidas na baseline seguem como estão. A desigualdade deixa a branch acrescentar testes além de remover. `allPass(defs, m, baseline, changedFiles, removed = {})` passa `removed[def.name]` a `gatePasses` só para gate `tests` sem `invariant`, sem `ignoreFailuresWhenChanged` e sem `fallback`. `mergeFloor(baseline, branchMeasure, removed = {})` passa a calcular `Math.max((floor[name].total || 0) - n, br.total - falhasDaBase)` com `n = removed[name] || 0`. Um total menor sem declaração (`removed` 0 ou ausente) continua reprovado, e um total menor que `base - n` também. Os testes em `gates.test.mjs` cobrem: queda igual a `n` passa; queda maior que `n` reprova; queda sem `n` reprova; `n` em gate fallback ou com `ignoreFailuresWhenChanged` é ignorado; `mergeFloor` com e sem `n`. O teste de fluxo em `flow.test.mjs` cobre a medição de branch com queda declarada e conferida passando e indo à evidência, e a mesma queda sem declaração parando (AC2).

**Merge-gates.** `postMerge` (l. ~2232) chama `mergeFloor(BASE, out.brM, out.removedN)`, onde `out.removedN` é o mapa `gate -> n` conferido na cabeça validada por `branchGates` (zerado a cada rodada, inclusive na `re` após ressincronização), sem nova conferência. Depois do merge, `Object.assign(BASE, refreshBaseline(...))` grava a medição pós-merge como baseline nova, então o desconto não se propaga ao entregável seguinte (conferido no código). Quando a aprovação passa com desconto, o workflow registra em `out.concerns` uma linha com base, branch e `n` por gate, para o log de revisões.

**Declaração sem queda.** Com total maior ou igual à baseline, o conferidor não roda; se houver declaração para o gate, `out.concerns` recebe uma linha dizendo que `removedTests` foi declarado sem queda de total.

### AC2 -- branchGates sem gates-fix quando a única falha é o total

Em `branchGates` (l. ~3035), depois de `gates(...)` reprovar sem `nullAgent`, uma função pura nova `totalOnlyGates(defs, m, base, changedFiles)` devolve os gates `tests` reprovados em que a única condição violada é o total: `ran` verdadeiro, sem `invariant`, sem fallback e sem `ignoreFailuresWhenChanged`, exit 0 ou nomes não cortados contidos na baseline, `skipped <= baseline` e `total < max(1, base.total)`. Se todo nome de `g.failures` está nessa lista, em qualquer rodada `k` (inclusive a 1ª):

1. Para cada um desses gates com entradas declaradas aplicáveis (união de `specLoad.data.removedTests` e `planLoad.plan.removedTests`, com `gate` igual ao do gate ou sem `gate`), uma chamada `productivity-tools:script-runner` haiku/low roda `node "<pluginRoot>/scripts/test-extract.mjs" removed ...` com `--spec`/`--plan` absolutos do worktree, `--base <syncAt>` (o tip do alvo que gerou `myBase`), `--cwd <wt>`, `--output`/`--sha` do gate (`outPath`/`outSha`), `--gate <nome>`, `--single-tests-gate` quando `GATES` tem um único gate `tests` elegível (sem `invariant` nem `ignoreFailuresWhenChanged`), e nonce `${RUN_TAG}:${E}:removed:${tag}<gate>:<k>` (com o `tag` de `branchGates`, porque as rodadas `''` e `'re'` repetem o mesmo `k`; o nome do gate higienizado para o padrão de nonce). A linha é conferida por `checkRun(stdout, 'test-extract', nonce)`, e o workflow só aceita `verified` se `outputSha`, `gate` e `base` da linha forem exatamente os que passou; qualquer diferença dá `n = 0`. Cópia que não confere (JSON inválido, outro nonce, digest errado) repete o mesmo comando (tentativas 1-2 haiku, 3 sonnet, `R12`); uma recusa assinada (linha com `error` e o nonce desta chamada) não repete e dá `n = 0`; sem linha válida após as tentativas, `n = 0`.
2. Recalcula `allPass(GATES, g.m, myBase, g.m.changedFiles, removedN)`. Se passar, grava `out.removedN = removedN` e segue para `out.brM = g.m` e `runEvidence`, como no caminho verde.
3. Se não passar (sem declaração, conferência insuficiente ou queda além de `n`), retorna `{ ok: false, kind: 'conteudo', msg }` sem despachar `gates-fix`. A mensagem lista, por gate, o total da base, o da branch, a diferença, o `n` conferido e as entradas não conferidas com o motivo (`reason` de `unverified`, com `unverifiedCut`), e oferece as duas saídas: se a remoção foi intencional, declarar os testes em `removedTests` da spec ou do plano e retomar (`R9`); se não foi, restaurar os testes na branch e retomar.

Com outras falhas junto (um gate `exit` vermelho, nomes novos falhando, `skipped` maior), o caminho do `gates-fix` segue como hoje; se depois de uma correção sobrar só o total, a rodada seguinte cai no curto-circuito acima e para do mesmo jeito. A contagem `k >= MAXFIX` continua valendo para o caminho normal. O teste em `flow.test.mjs` simula uma medição com um gate `tests` com exit 0, nomes vazios, `skipped` igual e total menor, sem declaração, e afirma que nenhuma chamada com rótulo `E1:gates-fix1` foi despachada e que o resultado é `conteudo` com a mensagem de declarar; um segundo teste com declaração e linha assinada do conferidor com `verified` igual à queda afirma que o fluxo segue à evidência sem `gates-fix`; um terceiro cobre a retomada (`R9`): a primeira execução para com `conteudo`, a segunda, com a spec (ou o plano) já carregando `removedTests` e o conferidor confirmando, passa nos gates sem `gates-fix`.

**Contra mascaramento (`DEC-006`).** Renomear um teste e declarar o nome antigo daria desconto sem queda real: a conferência (iii) pega o caso em que o nome antigo ainda roda, mas não o de um nome novo para o mesmo comportamento, que deixa o total igual (sem desconto útil) ou o reduz se outro teste for apagado. Quando há declaração, os prompts da revisão de plano e da revisão final ganham uma cláusula: conferir cada entrada de `removedTests` contra o diff, e um teste declarado como removido que foi renomeado, movido ou ainda cobre comportamento vivo é `defeito` (`R13`).

**Test-integrity.** No caminho normal, apagar um arquivo de teste inteiro entra em `deletedTests` e vira só alerta para os revisores finais (`integrityAlerts`, l. ~2967), sem bloqueio; o bloqueio por `integrityHardAlerts` existe só na retomada de um merge já feito (l. ~2380), onde não há saída da branch para conferir. Fica como está, com o caminho já existente de `acceptIntegrityAlerts` (`R5`, `R15`).

**Tamanho.** `roadmap-release.js` mede hoje 259.673 caracteres LF (263.030 bytes na cópia CRLF); E36 pode crescer até +4.000 caracteres LF, ficando em no máximo 263.673, dentro da folga de 10.000 de `size.test.mjs` (`DEC-034`) e longe do gatilho de 290.000 (`DEC-003`). Estimativa por peça: `gatePasses`/`allPass`/`mergeFloor`/`totalOnlyGates` cerca de 700; `gateFromCapture` cerca de 100; chamada ao conferidor com nonce, flag, laço de cópia e conferência de `outputSha`/`gate`/`base` cerca de 1.300; mensagem de parada e `concerns` cerca de 700; cláusulas de revisão e `postMerge` cerca de 600; total perto de 3.400, dentro do orçamento. Se apertar, corta-se texto de mensagem e de cláusula, nunca uma conferência. Nada em `lib/` muda (o conferidor e os scripts ficam fora do orçamento do workflow).

## Deixado para o plano

- Ordem das tarefas e divisão por arquivo (os scripts primeiro, o workflow depois), e quais testes existentes de `gates.test.mjs`, `flow.test.mjs`, `prompts.test.mjs` e `size.test.mjs` precisam de ajuste por `outPath`/`outSha` e pelas cláusulas novas.
- O texto exato da mensagem de parada, da linha de `concerns` e das cláusulas de revisão, dentro do orçamento de tamanho.
- Os fixtures de saída TAP e spec para `allTestNames` e `removed` (com teste em laço, nome duplicado, `describe` homônimo, arquivo apagado, teste movido de arquivo, CRLF), incluindo obrigatoriamente: o mesmo par `(file, name)` declarado na spec e no plano, com e sem `gate`, contando 1; um `describe` declarado junto com seus 3 testes dando `verified` 3, não 4; uma entrada sem `gate` sem `--single-tests-gate` saindo com `gate obrigatório`.
- Risco a tratar no plano: `outPath` e `outSha` passam a entrar na baseline via `refreshBaseline` (`BASE`) e no `prep` gravado em `run.json`; o plano deve localizar e ajustar os testes que comparam resultados de gate, baselines ou `run.json` por igualdade (`deepEqual`) e confirmar que `recordedBaseline`/`validMeasure` aceitam os campos novos.
- Se a chamada ao conferidor reaproveita um auxiliar existente de chamadas assinadas ou ganha um pequeno laço próprio.

```json data
{
  "schema": "spec/1",
  "id": "E36",
  "title": "Gate de testes com remoção declarada",
  "mode": "interactive",
  "acceptance": [
    {
      "id": "AC1",
      "text": "Dado um entregável cujo total de testes cai apenas pelos testes removidos declarados na spec ou no plano e sem falhas, quando gatePasses e mergeFloor avaliam a medição, então o gate passa e um total menor sem declaração continua reprovado. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    },
    {
      "id": "AC2",
      "text": "Dada uma medição de branchGates em que a única falha do gate tests é o total menor que a baseline, quando branchGates avalia a falha, então ele encerra na 1ª medição sem despachar o agente gates-fix. {verify: test; evidence: node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs}"
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Onde e em que formato a spec ou o plano declaram os testes removidos?",
      "decision": "Campo opcional removedTests no topo dos blocos spec/1 e plan/1, lista de { file, name, why } (name como o node:test imprime, file o caminho do teste na base); vale a união das duas listas; removedTests entra em TOP de spec-tool.mjs e plan-tool.mjs com validação de tipo.",
      "basis": "Decisão do dono via subagent Fable (intake da spec E36); hoje campo desconhecido só gera aviso field-unknown.",
      "alternative": "Lista de nomes soltos só no plano, sem arquivo nem motivo.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "Como a remoção é conferida por nome?",
      "decision": "Subcomando removed em test-extract.mjs, rodado por uma chamada script-runner haiku só quando há queda e há declaração: lê as declarações dos arquivos, confere o literal na base, a ausência em HEAD e a ausência na saída gravada da branch, e imprime uma linha assinada (nonce e digest) com verified e as entradas não conferidas cortadas em 3.500 bytes; falha fechada.",
      "basis": "Decisão do dono via subagent Fable (intake); DEC-030 manda usar o extrator determinístico do E41.",
      "alternative": "Estender o extrator para emitir todos os nomes e comparar base x branch no workflow (baseline pode vir recorded sem arquivo, milhares de nomes não cabem na linha); ou só diff estático (não pega teste movido de arquivo).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Qual a regra de passagem do gate tests com remoção conferida?",
      "decision": "total_branch >= total_base - n (n = entradas conferidas), sem outra tolerância; gatePasses recebe n como 4º parâmetro inteiro (default 0) e continua pura; mergeFloor passa a max(base.total - n, br.total - falhasDaBase); skipped <= baseline e falhas contidas na baseline seguem; declaração sem queda vira concern.",
      "basis": "Decisão do dono via subagent Fable (intake); DEC-006 pede ajustar mergeFloor.",
      "alternative": "Igualdade estrita total_branch == total_base - n (impede a branch de também acrescentar testes).",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R4",
      "question": "O que branchGates faz quando a única falha é o total do gate tests?",
      "decision": "Em qualquer rodada, inclusive a 1ª, não despacha gates-fix: confere a declaração e, se o desconto não basta, retorna { ok: false, kind: 'conteudo' } com base, branch, diferença e entradas não conferidas, instruindo declarar removedTests e retomar; com outras falhas junto o gates-fix segue normal; os merge-gates usam o mesmo n já conferido.",
      "basis": "Decisão do dono via subagent Fable (intake); DEC-006 e REQ-003 (parar na 1ª medição).",
      "alternative": "Deixar o gates-fix tentar uma rodada antes de parar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R5",
      "question": "O que fica fora do E36?",
      "decision": "coordinator.js (waveGatePasses), gates em fallback ou com ignoreFailuresWhenChanged (desconto 0), aceite manual de remoção não conferível e mudanças no test-integrity.",
      "basis": "Decisão do dono via subagent Fable (intake); waveGatePasses só compara exit e nomes.",
      "alternative": "Estender o desconto ao coordinator e aos gates em fallback.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R6",
      "question": "Com vários gates tests, como uma entrada se aplica a cada um?",
      "decision": "Campo gate opcional em cada entrada; uma entrada sem gate só é conferível quando há um único gate tests elegível (o workflow passa --single-tests-gate); com mais de um, fica não conferida com motivo 'gate obrigatório'. O conferidor roda uma vez por gate tests com queda (--gate), deduplica por (file, name) depois do filtro e n conta pares (file, name) distintos por gate; removed-duplicate pega o mesmo par com e sem gate na mesma lista.",
      "basis": "Cada gate tem sua própria saída gravada em pt-evidence; uma entrada sem gate com vários gates tests descontaria de cada gate um teste que só existia em um deles, e o mesmo par declarado na spec e no plano contaria duas vezes.",
      "alternative": "Sem campo gate, mesmo n para todo gate tests.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R7",
      "question": "Como o conferidor sabe que leu a saída que o gate mediu?",
      "decision": "gateFromCapture guarda outPath e outSha (path e sha256 da linha do capture já conferida) em resultado tests não fallback; o conferidor recebe --output e --sha e recusa se o sha256 do arquivo for outro; a linha leva outputSha, gate e base, e o workflow só aceita verified se os três forem os que passou, com nonce ${RUN_TAG}:${E}:removed:${tag}<gate>:<k> (o tag separa as rodadas '' e 're', que repetem k); sem os campos ou com diferença, desconto 0.",
      "basis": "capture.mjs já imprime path e sha256 na linha assinada; checkCapture confere a linha.",
      "alternative": "Ler o arquivo mais recente da pasta da tarefa em pt-evidence.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R8",
      "question": "Como achar o literal do nome no arquivo de teste?",
      "decision": "Normalizar CRLF para LF e procurar o nome entre aspas simples, duplas ou crases, com aspa e barra invertida escapadas como em JS; exatamente 1 ocorrência na base, e ela tem de ser o 1º argumento de test( ou it( (inclusive .skip, .only e .todo); literal só em describe(, suite( ou fora de chamada de teste fica não conferido com motivo; 0 ocorrências em HEAD (ou arquivo ausente); template com ${ não casa; casar com a saída por nameKey.",
      "basis": "Os testes do repositório nomeiam test/it/describe com literal; nameKey (l. ~181 de roadmap-release.js) já tira o prefixo arquivo::.",
      "alternative": "Analisar a árvore sintática do arquivo para achar chamadas test().",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R9",
      "question": "Como se retoma depois de declarar, se noSpecEdit impede o agente de editar spec e plano?",
      "decision": "A mensagem de parada manda o operador declarar removedTests (rodando de novo com notes[E] pedindo a declaração, que leva spec-author e plan-author a editar os arquivos existentes, ou commitando a edição na branch) e rodar com deliverables:[E]; como os blobs mudam, run-record não pula as revisões de spec, plano e final, que conferem a declaração; um teste em flow.test.mjs cobre parada e retomada.",
      "basis": "Caminho de notes já existe no workflow (autores editam o arquivo existente; tarefas commitadas ficam congeladas e removedTests não é tarefa); skipReview compara os blobs gravados em run.json.",
      "alternative": "Permitir que o gates-fix edite a spec ou o plano para declarar.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R10",
      "question": "Como o workflow sabe que o plano declara removedTests, se o emit do plano é enxuto?",
      "decision": "leanEmit de plan-tool.mjs inclui removedTests só quando a lista existe e não está vazia.",
      "basis": "O digest do emit enxuto cobre só o que é impresso; incluir sempre mudaria o digest de todo plano, inclusive congelados.",
      "alternative": "Incluir sempre (lista vazia por padrão) ou rodar o conferidor em toda queda sem saber se há declaração.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    },
    {
      "id": "R11",
      "question": "O merge-fix de postMerge também ganha curto-circuito?",
      "decision": "Não: postMerge usa mergeFloor com o n conferido na branch e segue com seu único merge-fix; após o merge refreshBaseline grava a medição nova em BASE, então o desconto não se propaga.",
      "basis": "Código de postMerge (l. ~2232): não há gates-fix ali e Object.assign(BASE, refreshBaseline(...)) roda após gates verdes; o cartão pede o curto-circuito só em branchGates.",
      "alternative": "Também parar o merge-fix quando a única falha for o total.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R12",
      "question": "O que fazer se a cópia da linha do conferidor não confere?",
      "decision": "Repetir o mesmo comando só quando a cópia não confere (JSON inválido, outro nonce, digest errado), em tentativas 1-2 haiku e 3 sonnet; uma recusa com error e o nonce desta chamada não repete; sem linha válida após as tentativas, ou com recusa, n = 0 e branchGates para com conteudo, sem gates-fix.",
      "basis": "Mesma regra das cargas assinadas (recordStatus para na recusa do próprio grupo); repetir uma recusa do script dá o mesmo resultado; falha fechada pedida pelo dono.",
      "alternative": "Tratar cópia inválida como infra e parar sem mensagem de declarar.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R13",
      "question": "Como mitigar o mascaramento por renomeação declarada como remoção (DEC-006)?",
      "decision": "Quando há declaração, os prompts da revisão de plano e da revisão final ganham uma cláusula: conferir cada entrada de removedTests contra o diff; teste declarado removido que foi renomeado, movido ou ainda cobre comportamento vivo é defeito.",
      "basis": "Risco do cartão E36 e de DEC-006; as revisões de plano e final são opus.",
      "alternative": "Instruir só em final-reviewer.md, sem cobrir a revisão de plano.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R14",
      "question": "Qual o orçamento de tamanho de roadmap-release.js?",
      "decision": "Até +4.000 caracteres LF: de 259.673 (medido em LF; 263.030 bytes na cópia CRLF) para no máximo 263.673; sem edição em lib/.",
      "basis": "Orçamento do dono (+4.000) no intake; size.test.mjs mede LF e exige folga > 10.000 (DEC-034).",
      "alternative": "Medir o orçamento em bytes da cópia CRLF (267.100).",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R15",
      "question": "Entradas conferidas de removedTests devem contar como remoção declarada para o test-integrity?",
      "decision": "Não mudar o test-integrity: no caminho normal deletedTests é só alerta aos revisores finais (sem bloqueio); o bloqueio existe só na retomada de um merge já feito, onde não há saída da branch para conferir, e segue com acceptIntegrityAlerts.",
      "basis": "Código: integrityAlerts vai para o prompt final (l. ~2967) e integrityHardAlerts bloqueia só na retomada pós-merge (l. ~2380); R5 tira o test-integrity do escopo.",
      "alternative": "Contar as entradas conferidas como remoção declarada também no bloqueio da retomada.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R16",
      "question": "Os autores de spec e plano precisam saber do campo?",
      "decision": "Uma linha em spec-author.md e em plan-author.md: quando o entregável apaga testes, declarar cada um em removedTests ({ file, name, why, gate? }).",
      "basis": "O schema não tem documento à parte; os agentes autores são a referência que o workflow despacha.",
      "alternative": "Documentar só no código do spec-tool.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    }
  ],
  "needsPerson": [],
  "externalEffects": [],
  "edgeCases": [
    {
      "id": "C1",
      "input": "Teste removido que era gerado em laço (nome montado em template ou concatenação, sem literal no arquivo da base)",
      "expected": "Entrada não conferida com motivo; n não conta; se a queda não se explica, branchGates para com conteudo sem gates-fix"
    },
    {
      "id": "C2",
      "input": "Nome declarado que aparece duas vezes no arquivo da base (dois testes homônimos, ou describe e test com o mesmo texto)",
      "expected": "Ambíguo: não conferido, mesmo que uma das ocorrências tenha saído"
    },
    {
      "id": "C3",
      "input": "Teste movido para outro arquivo e declarado como removido do arquivo antigo",
      "expected": "A conferência (iii) acha o nome na saída da branch: não conferido"
    },
    {
      "id": "C4",
      "input": "Arquivo de teste apagado inteiro, com seus testes declarados",
      "expected": "Arquivo ausente em HEAD conta como literal ausente; conferidos se o literal existia uma vez na base e o nome não roda; test-integrity segue só alertando no caminho normal"
    },
    {
      "id": "C5",
      "input": "Um describe e seus 3 testes declarados juntos em removedTests, o mesmo par (file, name) declarado na spec e no plano (com e sem gate), e entradas sem gate com dois gates tests configurados",
      "expected": "O describe fica não conferido (literal fora de test( e it( ) e verified dá 3, não 4; o par repetido conta 1 (e é removed-duplicate se estiver na mesma lista com e sem gate); sem --single-tests-gate as entradas sem gate saem com motivo 'gate obrigatório'"
    }
  ]
}
```
