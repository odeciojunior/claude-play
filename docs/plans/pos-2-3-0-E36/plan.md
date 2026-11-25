# Plano E36 -- Gate de testes com remoção declarada

**Roadmap:** docs/plans/roadmap-pos-2-3-0/

**Spec:** `docs/plans/pos-2-3-0-E36/spec.md`.

**Branch:** `release/pos-2.3.0`, um commit por tarefa (`type(scope): descrição`), sem bump de versão (DEC-042).

O plano segue a ordem pedida pelo dono: primeiro os scripts (campo `removedTests`, extrator de nomes, subcomando `removed`), depois o workflow (`roadmap-release.js`) em três tarefas sequenciais sobre o mesmo arquivo, e por fim os agentes autores e a conferência final. Toda tarefa tem no máximo 4 arquivos. Nada em `plugins/productivity-tools/lib/` muda.

## Cobertura dos critérios

| Critério | Tarefas | Evidência |
|---|---|---|
| AC1 (`gatePasses` e `mergeFloor` com remoção declarada) | T1 (campo e leanEmit), T2 e T3 (conferidor), T4 (regra pura, `outPath`/`outSha`), T5 (fluxo com declaração conferida, merge-gates, `concerns`) | `gates.test.mjs` e `flow.test.mjs` |
| AC2 (`branchGates` sem `gates-fix` quando a única falha é o total) | T5 (curto-circuito, mensagem, retomada R9) | `flow.test.mjs` |

Casos de borda da spec: C1, C2, C3, C4 e C5 são cobertos por fixtures de T3 (conferidor) e pelo fluxo de T5 (queda sem conferência para com `conteudo`).

## Contexto lido

- `roadmap-release.js` (263.030 bytes na cópia CRLF; 259.673 caracteres LF, medidos pelo `size.test.mjs`): `nameKey` (l. 181), `gateFromCapture` (l. 189), `gatePasses` (l. 238), `allPass` (l. 257), `mergeFloor` (l. 280), `refreshBaseline` (l. 676), `recordedBaseline` (l. 1108, que usa `validMeasure`, e este só confere coerência exit/nomes, então aceita campos novos no resultado), `postMerge` (l. 2232, `mergeFloor(BASE, out.brM)` na l. 2236), `branchGates` (l. 3035), o prompt da revisão de plano (l. ~2689-2705) e o da revisão final (l. ~2970-2976). O `prep` gravado em `run.json` sai da l. 2402 (`pre.baseline`), portanto `outPath` e `outSha` passam a entrar nele.
- `spec-tool.mjs`: `TOP` (l. 29), `checkSpec` (l. 115) com o aviso `field-unknown` de topo (l. 142). `plan-tool.mjs`: `TOP` (l. 15), `leanEmit` (l. 644, digest só do que é impresso).
- `test-extract.mjs` (98 linhas): `cleanName`, `tapNames`, `specNames`, `extractTests` e a CLI mínima (l. 92). `test-extract.test.mjs` gera a suíte de 63 testes num diretório temporário.
- `flow.test.mjs` (5.400 linhas) monta medições de gate com `withCapture` (l. 190) a partir do prompt; `gates.test.mjs` (281 linhas) testa as funções puras; `size.test.mjs` mede em LF com folga > 10.000.

## Tarefas

### Tarefa 1: removedTests em spec-tool e plan-tool

Arquivos: modificar `plugins/productivity-tools/scripts/spec-tool.mjs` e `plugins/productivity-tools/scripts/plan-tool.mjs`; testes em `plugins/productivity-tools/scripts/spec-tool.test.mjs` e `plugins/productivity-tools/scripts/plan-tool.test.mjs`.

Passos:

1. Teste primeiro. Em `spec-tool.test.mjs`: `checkRemovedTests` aceita lista vazia e entradas `{ file, name, why }` e `{ file, name, why, gate }`; `field-type` para valor que não é lista, entrada que não é objeto, `file`, `name` ou `why` vazios ou não string, `gate` presente e não string; `removed-duplicate` para `(file, name, gate)` repetido e para o mesmo `(file, name)` sem `gate` e com `gate` na mesma lista, mas não para o mesmo par com dois gates diferentes; `field-unknown` para chave desconhecida na entrada; `checkSpec` de uma spec com `removedTests` válido não emite mais o aviso de topo. Em `plan-tool.test.mjs`: o plano com `removedTests` inválido dá os mesmos erros; `leanEmit` leva `removedTests` só quando a lista existe e não está vazia, e o digest de um plano sem o campo é idêntico ao de antes (comparar com o digest de um fixture existente, R10).
2. Implementar: `removedTests` em `TOP` dos dois arquivos; `export function checkRemovedTests(list, err, warn, ref)` em `spec-tool.mjs`, usada por `checkSpec` e importada por `plan-tool.mjs`; no `leanEmit`, incluir `removedTests` só quando presente e não vazio.
3. Rodar `node --test plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs`, depois `node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js`, e fazer o commit `feat(productivity-tools): E36 T1 removedTests nos blocos spec/1 e plan/1`.

### Tarefa 2: allTestNames em test-extract.mjs

Arquivos: modificar `plugins/productivity-tools/scripts/test-extract.mjs`; teste em `plugins/productivity-tools/scripts/test-extract.test.mjs`.

Passos:

1. Teste primeiro: com a suíte gerada e rodada nos dois reporters (TAP e spec), `allTestNames(text)` devolve todos os nomes (passando, falhando, `# SKIP`, `# TODO`) sem suites, sem duração `(Xms)`, sem repetição de nomes da seção "failing tests" do formato spec, e texto desconhecido devolve lista vazia.
2. Implementar `export function allTestNames(text)` pura, reaproveitando `cleanName` e a leitura de `tapNames`/`specNames` (estendidas para `ok`, `not ok`, `skip` e `todo`); não mudar o retorno de `extractTests`.
3. Rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs` e fazer o commit `feat(productivity-tools): E36 T2 allTestNames no extrator de saida do node:test`.

### Tarefa 3: Subcomando removed em test-extract.mjs

Arquivos: modificar `plugins/productivity-tools/scripts/test-extract.mjs`; teste em `plugins/productivity-tools/scripts/test-extract.test.mjs`.

Passos:

1. Teste primeiro, num repositório git temporário (`os.tmpdir()`), com dois commits (base e HEAD) e uma saída TAP gravada, cobrindo: entrada conferida (`verified` 1); teste gerado em laço (zero literais); nome duplicado na base; `describe` declarado junto com seus 3 testes (`verified` 3, não 4, com o `describe` em `unverified` por literal fora de `test(`/`it(`); nome que continua em HEAD; arquivo apagado em HEAD (C4); teste movido de arquivo e ainda rodando na saída (C3, `nameKey`); base com CRLF; nome com aspa e barra invertida escapadas; template com `${`; o mesmo par `(file, name)` declarado na spec e no plano, com e sem `gate`, contando 1; entradas sem `gate` sem `--single-tests-gate` saindo com motivo `gate obrigatório` e com a flag conferidas; `--sha` diferente do sha256 de `--output` dando recusa `{ tool, command: 'removed', nonce, error }` com exit 2; lista inválida dando recusa; linha assinada aceita por `checkRun` (digest `fnv1a(canon(resto))`) e com `unverified` cortado para caber em `MAX_COPY_BYTES` com `unverifiedCut`. As declarações vêm dos blocos de dados de arquivos de spec e plano escritos no diretório temporário, nunca por argv.
2. Implementar o subcomando `removed --nonce <n> --spec <spec.md> --plan <plan.md> --base <ref> --cwd <worktree> --output <arquivo> --sha <sha256> --gate <nome> [--single-tests-gate]`, com `readDataBlock`, `checkRemovedTests`, `git show <base>:<file>` e `HEAD:<file>` (`spawnSync`, sem shell), a busca do literal da R8 (CRLF para LF, aspas simples, duplas ou crases, template com `${` não casa, exatamente 1 ocorrência que seja o 1º argumento de `test(`/`it(` e variantes `.skip`/`.only`/`.todo`), a conferência por `nameKey` contra `allTestNames` e a linha `sign({ tool, command, nonce, gate, base, outputSha, verified, unverified, unverifiedCut })`. Importar de `../lib/plan-digest.mjs` só `MAX_COPY_BYTES`, `canon` e `fnv1a`.
3. Rodar `node --test plugins/productivity-tools/scripts/test-extract.test.mjs`, `node --test plugins/productivity-tools/scripts/copy-budget.test.mjs` (varredura do literal `3500`) e fazer o commit `feat(productivity-tools): E36 T3 subcomando removed do extrator`.

### Tarefa 4: Desconto na regra pura de roadmap-release.js e outPath/outSha

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; testes em `plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs` e `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `gates.test.mjs`: queda igual a `n` passa; queda maior que `n` reprova; queda sem `n` reprova; `n` não inteiro ou menor que 1 conta 0; `n` em gate fallback, `invariant` ou com `ignoreFailuresWhenChanged` é ignorado por `allPass`; `mergeFloor` com e sem `n`; `totalOnlyGates` devolve só gates `tests` com exit 0 (ou nomes não cortados contidos na baseline), `skipped` dentro da baseline e total menor, e não devolve gate com `skipped` maior, nome novo falhando, `invariant`, fallback ou `ignoreFailuresWhenChanged`; `gateFromCapture` guarda `outPath` e `outSha` (`path` e `sha256` da linha) só para gate `tests` não fallback.
2. Implementar em `roadmap-release.js`, dentro de `// <pure>`: `gateFromCapture` com `outPath`/`outSha`; `gatePasses(def, result, baselineResult, removed = 0)` com `(result.total || 0) >= Math.max(1, base - removed)` e `removed` só inteiro maior que 0; `allPass(defs, m, baseline, changedFiles, removed = {})`; `mergeFloor(baseline, branchMeasure, removed = {})` com `Math.max((floor.total || 0) - n, br.total - falhasDaBase)`; `export`-ável `totalOnlyGates(defs, m, base, changedFiles)` como função pura.
3. Risco `outPath`/`outSha` (nota do revisor): rodar `node --test` em `gates.test.mjs`, `flow.test.mjs`, `merge.test.mjs`, `review.test.mjs`, `integrity.test.mjs`, `selection.test.mjs`, `prompts.test.mjs`, `roadmap-release-agy.test.mjs` e `plugins/productivity-tools/scripts/run-record.test.mjs`; onde um teste compara resultado de gate, baseline ou `prep` de `run.json` por igualdade e falha só pelos campos novos, ajustar o teste (esperado com `outPath`/`outSha` ou comparação dos campos antigos). Confirmar por teste que `validMeasure` e `recordedBaseline` aceitam a baseline com os campos novos. Se `run-record.test.mjs` precisar de ajuste, ele entra nesta tarefa como quarto arquivo de teste.
4. Medir o tamanho (`node --test .../size.test.mjs` e contagem LF): peças puras em até cerca de 800 caracteres; ao fim da T6 o total tem de ficar em até 263.673 (R14).
5. Fazer o commit `feat(productivity-tools): E36 T4 gatePasses, allPass e mergeFloor com desconto conferido`.

### Tarefa 5: Curto-circuito de branchGates e conferidor no fluxo

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs`.

Passos:

1. Teste primeiro em `flow.test.mjs` (chamadas ao conferidor respondidas pelo `over`, com a linha assinada montada por helper de teste): (a) AC2: medição com gate `tests`, exit 0, nomes vazios, `skipped` igual e total menor, sem declaração, não despacha `E1:gates-fix1` e devolve `conteudo` com a mensagem de declarar `removedTests` ou restaurar os testes, na 1ª medição; (b) AC1: com declaração em `specLoad.data.removedTests` (e, noutro teste, em `planLoad.plan.removedTests`) e linha assinada com `verified` igual à queda, o fluxo segue à evidência sem `gates-fix`, e `out.concerns` traz a linha de base, branch e `n` quando o merge passa com desconto; (c) queda além de `verified` para com `conteudo` listando as entradas não conferidas com motivo e `unverifiedCut`; (d) linha com `outputSha`, `gate` ou `base` diferentes dos passados dá `n = 0`; recusa assinada não repete; cópia inválida repete o mesmo comando (tentativas 1-2 haiku, 3 sonnet); (e) declaração sem queda registra o concern e não chama o conferidor; (f) retomada (R9): 1ª execução para com `conteudo`, 2ª com a declaração já carregada passa sem `gates-fix`; (g) com um gate `exit` vermelho junto, o `gates-fix` segue como hoje, e se depois sobrar só o total a rodada seguinte cai no curto-circuito; (h) nonce `${RUN_TAG}:${E}:removed:${tag}<gate>:<k>` distinto para `''` e `re`; (i) merge-gates usam `mergeFloor(BASE, out.brM, out.removedN)` e a baseline seguinte não herda o desconto.
2. Implementar em `branchGates` e `postMerge`: depois de `gates(...)` reprovar sem `nullAgent`, se todo nome de `g.failures` está em `totalOnlyGates`, montar `removedN` por gate (entradas aplicáveis = união de `specLoad.data.removedTests` e `planLoad.plan.removedTests` com `gate` igual ou ausente), chamar `productivity-tools:script-runner` haiku/low com `node "<pluginRoot>/scripts/test-extract.mjs" removed ...` (`--single-tests-gate` quando `GATES` tem um único gate `tests` elegível), conferir com `checkRun(stdout, 'test-extract', nonce)` e com `outputSha`/`gate`/`base`; recalcular `allPass(..., removedN)`; se passar, gravar `out.removedN`, `out.brM`, e seguir para `runEvidence`; senão retornar `{ ok: false, kind: 'conteudo', msg }` com base, branch, diferença, `n`, entradas não conferidas e as duas saídas (declarar e retomar, ou restaurar os testes). Sem declaração, não chamar o conferidor. `out.removedN` é zerado a cada rodada. `postMerge` passa `out.removedN` a `mergeFloor`. A decisão de reaproveitar o laço de cópia: um pequeno laço próprio de 3 tentativas dentro de `branchGates`, porque os auxiliares existentes de cargas assinadas leem fatias, não uma única linha (ver R2 dos `rulings`).
3. Rodar `node --test` em `flow.test.mjs`, `gates.test.mjs` e `size.test.mjs`; o texto da mensagem e do `concerns` fica curto (R14).
4. Fazer o commit `feat(productivity-tools): E36 T5 branchGates sem gates-fix quando so o total cai`.

### Tarefa 6: Cláusula contra mascaramento nas revisões de plano e final

Arquivos: modificar `plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js`; teste em `plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs`.

Passos:

1. Teste primeiro em `prompts.test.mjs`: com `removedTests` na spec ou no plano, os prompts `E1:plan-review1` e `E1:final-1-r1` contêm a cláusula (conferir cada entrada contra o diff; teste declarado removido que foi renomeado, movido ou ainda cobre comportamento vivo é `defeito`); sem declaração, os prompts ficam idênticos aos de hoje.
2. Implementar a cláusula como uma constante curta, acrescentada ao prompt da revisão de plano (l. ~2695) e ao da revisão final (l. ~2970) só quando há entradas.
3. Rodar `node --test` em `prompts.test.mjs`, `review.test.mjs`, `size.test.mjs`; conferir `roadmap-release.js` em até 263.673 caracteres LF (R14) e, se passar, cortar texto de mensagem e de cláusula, nunca uma conferência.
4. Fazer o commit `feat(productivity-tools): E36 T6 clausula contra mascaramento nas revisoes`.

### Tarefa 7: Uma linha sobre removedTests em spec-author e plan-author

Arquivos: modificar `plugins/productivity-tools/agents/spec-author.md` e `plugins/productivity-tools/agents/plan-author.md`; teste em `plugins/productivity-tools/scripts/agent-contracts.test.mjs`.

Passos:

1. Teste primeiro: `agent-contracts.test.mjs` exige que os dois agentes citem `removedTests` com `{ file, name, why, gate? }`.
2. Acrescentar uma linha em cada agente: quando o entregável apaga testes, declarar cada um em `removedTests` no bloco de dados.
3. Rodar `node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs`, `node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools` e `claude plugin validate plugins/productivity-tools`; fazer o commit `docs(productivity-tools): E36 T7 spec-author e plan-author declaram removedTests`.

### Tarefa 8: Conferência final

Arquivos: nenhum.

Passos:

1. Rodar a suíte completa `node --test "plugins/**/*.test.mjs" ".claude/hooks/*.test.mjs" "tools/**/*.test.mjs"` (linha de base em 1a7c102: cerca de 2.533 testes, 0 falhas, 2 pulados; leva cerca de 15 minutos) e comparar os totais.
2. Rodar `embed.mjs --check` nos 4 alvos, o lint do plugin e `claude plugin validate plugins/productivity-tools`.
3. Medir `roadmap-release.js` em LF (até 263.673) e conferir `git diff --stat` sem nenhum arquivo em `plugins/productivity-tools/lib/`. Sem commit.

```json data
{
  "schema": "plan/1",
  "id": "E36",
  "title": "Gate de testes com remoção declarada",
  "spec": "spec.md",
  "roadmap": "docs/plans/roadmap-pos-2-3-0/",
  "constraints": [
    "Orçamento de roadmap-release.js: até +4.000 caracteres LF, de 259.673 para no máximo 263.673 (R14 da spec), medido por size.test.mjs; depois de cada tarefa do workflow o crescimento acumulado é conferido, e se apertar cortam-se textos de mensagem e de cláusula, nunca uma conferência.",
    "Nenhuma edição em plugins/productivity-tools/lib/; embed.mjs --check nos 4 alvos (check-roadmap.mjs, roadmap-release.js, coordinator.js, fixtures/plan-tool/workflow-copy.js) segue verde.",
    "Risco de outPath e outSha (nota do revisor Fable): passam a entrar na baseline via refreshBaseline (BASE) e no prep gravado em run.json; os testes que comparam resultados de gate, baselines ou run.json por igualdade (gates.test.mjs, flow.test.mjs, run-record.test.mjs e afins) são conferidos e ajustados na T4, e validMeasure e recordedBaseline têm de aceitar os campos novos.",
    "Não passar nomes de teste por argv: o conferidor lê as declarações dos próprios arquivos de spec e plano.",
    "Sem linha assinada válida o desconto é 0: nenhuma redução de total é aceita sem conferência; sem declaração o conferidor não roda.",
    "noSpecEdit continua valendo: o agente de gates-fix não edita spec nem plano; a declaração entra pela retomada (R9 da spec).",
    "Fora de escopo (R5): coordinator.js (waveGatePasses), gates em fallback ou com ignoreFailuresWhenChanged (desconto 0), aceite manual de remoção não conferível, test-integrity e merge-fix de postMerge.",
    "Tarefas com no máximo 4 arquivos em files (pedido do dono); tarefa maior é dividida.",
    "Commits na branch release/pos-2.3.0, um por tarefa, no formato type(scope): descrição; sem bump de versão (DEC-042).",
    "Comando da suíte completa: node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\" (linha de base em 1a7c102: cerca de 2.533 testes, 0 falhas, 2 pulados).",
    "O literal 3500 só em lib/plan-digest.mjs (copy-budget.test.mjs): o conferidor importa MAX_COPY_BYTES.",
    "Nenhuma chamada paga (claude -p) e nenhum efeito externo."
  ],
  "tasks": [
    {
      "n": 1,
      "title": "removedTests em spec-tool e plan-tool",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/spec-tool.mjs",
          "plugins/productivity-tools/scripts/plan-tool.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/spec-tool.test.mjs",
          "plugins/productivity-tools/scripts/plan-tool.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "spec-tool.mjs: export function checkRemovedTests(list, err, warn, ref) e removedTests em TOP",
        "plan-tool.mjs: removedTests em TOP e no leanEmit só quando a lista existe e não está vazia"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/spec-tool.test.mjs plugins/productivity-tools/scripts/plan-tool.test.mjs",
          "expect": "exit 0 com os casos de removedTests e o digest do emit enxuto inalterado sem declaração"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0, embutidos em dia"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 2,
      "title": "allTestNames em test-extract.mjs",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/test-extract.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/test-extract.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 1, "blast": 0, "verifiability": 0 },
      "produces": [
        "test-extract.mjs: export function allTestNames(text) -> string[] com todos os nomes executados (ok, not ok, SKIP, TODO), sem suites"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs",
          "expect": "exit 0 com allTestNames nos formatos TAP e spec e extractTests inalterado"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 3,
      "title": "Subcomando removed em test-extract.mjs",
      "deps": [1, 2],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/scripts/test-extract.mjs"
        ],
        "test": [
          "plugins/productivity-tools/scripts/test-extract.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 1, "verifiability": 0 },
      "produces": [
        "test-extract.mjs removed --nonce <n> --spec <spec.md> --plan <plan.md> --base <ref> --cwd <worktree> --output <arquivo> --sha <sha256> --gate <nome> [--single-tests-gate] -> linha assinada { tool, command: 'removed', nonce, gate, base, outputSha, verified, unverified: [{ file, name, reason }], unverifiedCut, digest } ou recusa { tool, command, nonce, error } com exit 2"
      ],
      "consumes": [
        { "task": 1, "sig": "spec-tool.mjs: export function checkRemovedTests(list, err, warn, ref) e removedTests em TOP" },
        { "task": 2, "sig": "test-extract.mjs: export function allTestNames(text) -> string[] com todos os nomes executados (ok, not ok, SKIP, TODO), sem suites" }
      ],
      "covers": ["C1", "C2", "C3", "C4", "C5"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/test-extract.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0 com os casos C1 a C5, CRLF, escape, sha divergente e linha cortada em MAX_COPY_BYTES"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 4,
      "title": "Desconto na regra pura de roadmap-release.js e outPath/outSha",
      "deps": [],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs",
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 0 },
      "produces": [
        "gatePasses(def, result, baselineResult, removed = 0), allPass(defs, m, baseline, changedFiles, removed = {}), mergeFloor(baseline, branchMeasure, removed = {}) e totalOnlyGates(defs, m, base, changedFiles), todos puros",
        "gateFromCapture guarda outPath e outSha em gate tests não fallback"
      ],
      "consumes": [],
      "covers": ["AC1"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/merge.test.mjs",
          "expect": "exit 0, inclusive os testes ajustados por outPath e outSha"
        },
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/integrity.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/selection.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release-agy.test.mjs plugins/productivity-tools/scripts/run-record.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0, nenhum teste de igualdade quebrado pelos campos novos"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 5,
      "title": "Curto-circuito de branchGates e conferidor no fluxo",
      "deps": [3, 4],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 1, "reasoning": 2, "blast": 2, "verifiability": 1 },
      "produces": [
        "branchGates: com a única falha sendo o total, confere removedTests pelo test-extract removed e passa com desconto ou devolve { ok: false, kind: 'conteudo', msg } sem gates-fix; out.removedN; postMerge usa mergeFloor(BASE, out.brM, out.removedN)"
      ],
      "consumes": [
        { "task": 3, "sig": "test-extract.mjs removed --nonce <n> --spec <spec.md> --plan <plan.md> --base <ref> --cwd <worktree> --output <arquivo> --sha <sha256> --gate <nome> [--single-tests-gate] -> linha assinada { tool, command: 'removed', nonce, gate, base, outputSha, verified, unverified: [{ file, name, reason }], unverifiedCut, digest } ou recusa { tool, command, nonce, error } com exit 2" },
        { "task": 4, "sig": "gatePasses(def, result, baselineResult, removed = 0), allPass(defs, m, baseline, changedFiles, removed = {}), mergeFloor(baseline, branchMeasure, removed = {}) e totalOnlyGates(defs, m, base, changedFiles), todos puros" }
      ],
      "covers": ["AC1", "AC2"],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 com parada sem gates-fix, passagem com declaração conferida, retomada e merge-gates com n"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 6,
      "title": "Cláusula contra mascaramento nas revisões de plano e final",
      "deps": [5],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js"
        ],
        "test": [
          "plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 1, "blast": 1, "verifiability": 0 },
      "produces": [
        "Cláusula curta nos prompts plan-review e final-review quando há removedTests; prompts idênticos aos de hoje sem declaração"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/prompts.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/review.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/size.test.mjs",
          "expect": "exit 0 e roadmap-release.js em até 263.673 caracteres LF"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 7,
      "title": "Uma linha sobre removedTests em spec-author e plan-author",
      "deps": [1],
      "files": {
        "create": [],
        "modify": [
          "plugins/productivity-tools/agents/spec-author.md",
          "plugins/productivity-tools/agents/plan-author.md"
        ],
        "test": [
          "plugins/productivity-tools/scripts/agent-contracts.test.mjs"
        ]
      },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 1, "verifiability": 0 },
      "produces": [
        "Uma linha em cada agente autor sobre quando e como declarar removedTests ({ file, name, why, gate? })"
      ],
      "consumes": [],
      "covers": [],
      "testFirst": true,
      "checks": [
        {
          "cmd": "node --test plugins/productivity-tools/scripts/agent-contracts.test.mjs plugins/productivity-tools/scripts/prose-budget.test.mjs plugins/productivity-tools/scripts/copy-budget.test.mjs",
          "expect": "exit 0, orçamentos de prosa respeitados"
        },
        {
          "cmd": "node plugins/marketplace-tools/skills/validate-plugin/scripts/lint-plugin.mjs plugins/productivity-tools",
          "expect": "exit 0 sem erro"
        },
        {
          "cmd": "claude plugin validate plugins/productivity-tools",
          "expect": "exit 0, plugin válido"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": false
    },
    {
      "n": 8,
      "title": "Conferência final",
      "deps": [5, 6, 7],
      "files": { "create": [], "modify": [], "test": [] },
      "writes": [],
      "score": { "ambiguity": 0, "reasoning": 0, "blast": 0, "verifiability": 0 },
      "produces": [],
      "consumes": [],
      "covers": ["AC1", "AC2"],
      "testFirst": { "exempt": "Tarefa de conferência: só roda a suíte, o lint e as medidas de tamanho; não muda arquivo." },
      "checks": [
        {
          "cmd": "node --test \"plugins/**/*.test.mjs\" \".claude/hooks/*.test.mjs\" \"tools/**/*.test.mjs\"",
          "expect": "exit 0, 0 falhas, total não menor que a linha de base de cerca de 2.533 testes mais os novos"
        },
        {
          "cmd": "node plugins/productivity-tools/scripts/embed.mjs --check plugins/productivity-tools/skills/roadmap-tracker/scripts/check-roadmap.mjs plugins/productivity-tools/skills/roadmap-release/workflow/roadmap-release.js plugins/productivity-tools/skills/plan-coordinator/workflow/coordinator.js plugins/productivity-tools/scripts/fixtures/plan-tool/workflow-copy.js",
          "expect": "exit 0"
        },
        {
          "cmd": "git diff --stat 1a7c102 -- plugins/productivity-tools/lib",
          "expect": "saída vazia: nada em lib/ mudou"
        }
      ],
      "locks": [],
      "external": false,
      "externalDedupe": null,
      "noCommit": true
    }
  ],
  "evidence": [
    {
      "ac": "AC1",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/gates.test.mjs plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    },
    {
      "ac": "AC2",
      "kind": "test",
      "command": "node --test plugins/productivity-tools/skills/roadmap-release/workflow/flow.test.mjs",
      "external": false,
      "externalDedupe": null,
      "blq": null
    }
  ],
  "rulings": [
    {
      "id": "R1",
      "question": "Como dividir o trabalho em roadmap-release.js, que três tarefas tocam em sequência?",
      "decision": "T4 (regras puras e outPath/outSha), T5 (fluxo de branchGates e postMerge) e T6 (cláusulas de revisão) rodam em ordem por dependência, cada uma com um arquivo de produção e um commit; T4 não depende dos scripts, T5 depende de T3 e T4.",
      "basis": "Pedido do dono de tarefas de até 4 arquivos e ordem natural dos scripts primeiro; o mesmo arquivo de produção em tarefas paralelas daria conflito.",
      "alternative": "Uma só tarefa para todo o roadmap-release.js, com mais de 4 arquivos de teste e orçamento de tamanho sem ponto de conferência intermediário.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R2",
      "question": "A chamada ao conferidor reaproveita um auxiliar de chamadas assinadas ou ganha laço próprio?",
      "decision": "Um pequeno laço próprio em branchGates (3 tentativas, 1-2 haiku e 3 sonnet) com checkRun, porque os auxiliares existentes (loadVia e load3) leem pares check/emit e fatias, não uma única linha de script-runner; a T5 troca por auxiliar existente se a leitura do código mostrar um que sirva sem custo de tamanho.",
      "basis": "Leitura de loadVia (l. 2469) e load3 (l. 2491), feitos para os comandos check e emit das cargas de spec e plano; orçamento de 4.000 caracteres (R14) estimou cerca de 1.300 para esta peça.",
      "alternative": "Generalizar loadVia, o que mexe no caminho de carga de spec e plano fora do escopo do E36.",
      "costIfWrong": "low",
      "reversible": true,
      "scope": "local",
      "contradicts": null
    },
    {
      "id": "R3",
      "question": "Onde se ajustam os testes de igualdade afetados por outPath e outSha?",
      "decision": "Na T4, junto da mudança de gateFromCapture, com a varredura de todos os arquivos de teste do workflow e de run-record.test.mjs listada nos checks da tarefa; ajustar só a expectativa dos campos novos, sem relaxar a comparação.",
      "basis": "Risco apontado pelo revisor Fable e pela spec (Deixado para o plano): os campos entram na baseline via refreshBaseline e no prep de run.json, e validMeasure só confere coerência de exit e nomes.",
      "alternative": "Excluir outPath e outSha da baseline, o que perderia o vínculo com a saída gravada na conferência de merge.",
      "costIfWrong": "medium",
      "reversible": true,
      "scope": "contract",
      "contradicts": null
    }
  ],
  "needsPerson": []
}
```
